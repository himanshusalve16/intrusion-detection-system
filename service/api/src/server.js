import { spawn } from "child_process";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_ROOT = path.resolve(__dirname, "..");
const ROOT = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(API_ROOT, ".env") });
dotenv.config({ path: path.join(API_ROOT, ".env.example"), override: false });

const config = {
  port: Number(process.env.PORT || 3001),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  dbName: process.env.MONGODB_DB_NAME || "IDPS",
  collectionName: process.env.MONGODB_COLLECTION || "live_test_dataset",
  csvPath:
    process.env.CSV_PATH ||
    path.join(ROOT, "tests", "live_test_dataset.csv"),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 1000),
  pythonCmd: process.env.PYTHON_CMD || "python",
  predictorScript:
    process.env.PREDICTOR_SCRIPT ||
    path.join(ROOT, "service", "models", "src", "live_predictor_worker.py"),
  reloadCsv: (process.env.RELOAD_CSV || "false").toLowerCase() === "true",
};

class PythonPredictorBridge {
  constructor({ pythonCmd, scriptPath, rootDir }) {
    this.pythonCmd = pythonCmd;
    this.scriptPath = scriptPath;
    this.rootDir = rootDir;

    this.process = null;
    this.requestCounter = 0;
    this.pending = new Map();
    this.startResolver = null;
  }

  async start() {
    this.process = spawn(this.pythonCmd, [this.scriptPath], {
      cwd: this.rootDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");

    let stdoutBuffer = "";

    this.process.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        this.#handleLine(line.trim());
      }
    });

    this.process.stderr.on("data", (chunk) => {
      const text = chunk.trim();
      if (text) {
        console.error(`[predictor] ${text}`);
      }
    });

    this.process.on("exit", (code, signal) => {
      const reason = `Predictor exited (code=${code}, signal=${signal})`;
      for (const [requestId, pendingRequest] of this.pending.entries()) {
        pendingRequest.reject(new Error(`${reason} while waiting for request ${requestId}`));
      }
      this.pending.clear();

      if (this.startResolver) {
        this.startResolver.reject(new Error(reason));
        this.startResolver = null;
      }
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for predictor readiness."));
      }, 20000);

      this.startResolver = {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
    });
  }

  #handleLine(line) {
    if (!line) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      console.warn(`[predictor] Non-JSON output ignored: ${line}`);
      return;
    }

    if (payload.type === "ready") {
      if (this.startResolver) {
        this.startResolver.resolve();
        this.startResolver = null;
      }
      return;
    }

    const pendingRequest = this.pending.get(payload.requestId);
    if (!pendingRequest) {
      return;
    }

    this.pending.delete(payload.requestId);

    if (payload.error) {
      pendingRequest.reject(new Error(payload.error));
      return;
    }

    pendingRequest.resolve(payload);
  }

  predict(sample) {
    if (!this.process || this.process.killed) {
      return Promise.reject(new Error("Predictor process is not running."));
    }

    this.requestCounter += 1;
    const requestId = this.requestCounter;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Prediction request timed out."));
      }, 10000);

      this.pending.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.process.stdin.write(
        `${JSON.stringify({ requestId, sample })}\n`,
        "utf8"
      );
    });
  }

  async stop() {
    if (!this.process || this.process.killed) {
      return;
    }

    this.process.kill("SIGTERM");
  }
}

function normalizeRecord(rawRecord, sampleIndex) {
  const record = { _sampleIndex: sampleIndex };

  for (const [key, rawValue] of Object.entries(rawRecord)) {
    if (rawValue === null || rawValue === undefined) {
      record[key] = 0;
      continue;
    }

    const value = String(rawValue).trim();
    if (value.length === 0) {
      record[key] = 0;
      continue;
    }

    const maybeNumber = Number(value);
    record[key] = Number.isFinite(maybeNumber) ? maybeNumber : value;
  }

  return record;
}

async function ensureCsvLoaded(collection) {
  const currentCount = await collection.countDocuments();
  const hasIndexedSamples =
    (await collection.countDocuments({ _sampleIndex: { $exists: true } })) > 0;

  if (currentCount > 0 && hasIndexedSamples && !config.reloadCsv) {
    await collection.createIndex({ _sampleIndex: 1 }, { unique: true });
    return {
      inserted: 0,
      total: currentCount,
      reusedExisting: true,
    };
  }

  const csvText = await fs.readFile(config.csvPath, "utf8");
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const documents = records.map((record, index) => normalizeRecord(record, index));

  await collection.deleteMany({});

  if (documents.length > 0) {
    await collection.insertMany(documents, { ordered: true });
  }

  await collection.createIndex({ _sampleIndex: 1 }, { unique: true });

  return {
    inserted: documents.length,
    total: documents.length,
    reusedExisting: false,
  };
}

const app = express();
app.use(express.json());

const state = {
  startedAt: null,
  processedSamples: 0,
  currentCursor: 0,
  totalSamples: 0,
  alerts: [],
};

let mongoClient;
let mongoCollection;
let predictor;
let pollTimer;
let httpServer;
let isPolling = false;

function addAlert(alert) {
  state.alerts.push(alert);
  if (state.alerts.length > 200) {
    state.alerts.shift();
  }
}

async function pollOnce() {
  if (!mongoCollection || !predictor) {
    return;
  }

  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const sample = await mongoCollection.findOne({ _sampleIndex: state.currentCursor });

    if (!sample) {
      state.currentCursor = 0;
      return;
    }

    const response = await predictor.predict(sample);

    state.processedSamples += 1;
    state.currentCursor += 1;

    if (state.currentCursor >= state.totalSamples) {
      state.currentCursor = 0;
    }

    const prediction = response.prediction;

    if (typeof prediction === "string" && prediction.toUpperCase() !== "NORMAL") {
      const alert = {
        sampleIndex: sample._sampleIndex,
        prediction,
        confidence: response.confidence,
        detectedAt: new Date().toISOString(),
      };

      addAlert(alert);

      console.log(
        `[ALERT] sample=${alert.sampleIndex} prediction=${alert.prediction} confidence=${alert.confidence.toFixed(4)}`
      );
    }
  } finally {
    isPolling = false;
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    startedAt: state.startedAt,
    processedSamples: state.processedSamples,
    cursor: state.currentCursor,
    totalSamples: state.totalSamples,
    alertsCount: state.alerts.length,
  });
});

app.get("/alerts", (_req, res) => {
  res.json({
    alerts: state.alerts,
  });
});

app.post("/poll-once", async (_req, res) => {
  try {
    await pollOnce();
    res.json({
      ok: true,
      processedSamples: state.processedSamples,
      cursor: state.currentCursor,
      alertsCount: state.alerts.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/config", (_req, res) => {
  res.json({
    port: config.port,
    dbName: config.dbName,
    collectionName: config.collectionName,
    csvPath: config.csvPath,
    pollIntervalMs: config.pollIntervalMs,
    predictorScript: config.predictorScript,
  });
});

async function shutdown() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  if (predictor) {
    await predictor.stop();
    predictor = null;
  }

  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
    httpServer = null;
  }
}

async function bootstrap() {
  mongoClient = new MongoClient(config.mongoUri);
  await mongoClient.connect();

  const db = mongoClient.db(config.dbName);
  mongoCollection = db.collection(config.collectionName);

  const seedStatus = await ensureCsvLoaded(mongoCollection);
  state.totalSamples = seedStatus.total;

  predictor = new PythonPredictorBridge({
    pythonCmd: config.pythonCmd,
    scriptPath: config.predictorScript,
    rootDir: ROOT,
  });

  await predictor.start();

  pollTimer = setInterval(() => {
    pollOnce().catch((error) => {
      console.error(`[poll] ${error.message}`);
    });
  }, config.pollIntervalMs);

  state.startedAt = new Date().toISOString();

  httpServer = app.listen(config.port, () => {
    console.log("IDPS test server started");
    console.log(`Port: ${config.port}`);
    console.log(`MongoDB: ${config.mongoUri}`);
    console.log(`Database: ${config.dbName}`);
    console.log(`Collection: ${config.collectionName}`);
    console.log(`CSV seed: ${config.csvPath}`);
    console.log(
      seedStatus.reusedExisting
        ? `Using existing Mongo data (${seedStatus.total} records)`
        : `Loaded ${seedStatus.inserted} records into MongoDB`
    );
    console.log("Polling every 1 second and showing only non-NORMAL predictions.");
  });
}

process.on("SIGINT", () => {
  shutdown()
    .finally(() => process.exit(0))
    .catch(() => process.exit(1));
});

process.on("SIGTERM", () => {
  shutdown()
    .finally(() => process.exit(0))
    .catch(() => process.exit(1));
});

bootstrap().catch(async (error) => {
  console.error(`[startup] ${error.message}`);
  await shutdown();
  process.exit(1);
});
