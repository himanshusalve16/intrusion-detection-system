# Project Master Context

**Repository audited:** `https://github.com/himanshusalve16/intrusion-detection-system` (public at time of audit)
**Audit date:** September 18, 2026
**Method:** Direct retrieval of repository file tree and file contents via GitHub. Every file cited below was read in full unless marked otherwise. No file content in this document was inferred or guessed.
**Source-of-truth hierarchy applied throughout:** (1) source code, (2) config/schemas/tests, (3) project documentation, (4) comments/TODOs, (5) the uploaded IEEE literature-review paper (context only).

---

## 1. Project Identity

- **Project name (as used in repo):** KodeMapper — "AI-Driven Intrusion Detection & Prevention System (IDPS)" *(README.md, others/Project_Synopsis.md)*
- **Objective (as stated by the team):** an end-to-end AI-based Network Intrusion Detection and Prevention System that adds two things most academic ML-IDS work lacks — per-alert explainability (SHAP/LIME) and automated, human-gated remediation (a "SOAR-lite" policy engine).
- **Domain:** Network Intrusion Detection / Prevention (NIDS/NIPS), flow-based (not host-based, not deep packet inspection).
- **Problem being solved (as framed by the team):** signature IDS (Snort/Suricata) miss zero-day attacks; academic ML-IDS papers stop at offline accuracy numbers and give operators no explanation and no way to act. The team is trying to close that gap.
- **Team:** "KodeMapper", a 4-member final-year team (documentation/01_project_overview.md lists anonymized roles A–D: Data/ML, Infra/DevOps, Backend, Frontend/Docs). The GitHub account owner's name and institution (Himanshu Salve, Dept. of Electronics Engineering, Shri Ramdeobaba College of Engineering and Management, Nagpur) match a co-author of the IEEE literature-review paper supplied alongside this repository, and the repo's `/literature` folder contains the same 25 source papers cited in that paper. **This connection is a reasonable inference from matching names/institution/citation set, not an independently confirmed fact** — treat it as likely context, not verified identity.
- **Target users / use case:** security operators in a lab/enterprise network segment; the current build is explicitly a demo/academic prototype, not a production deployment (README: "Safe demo mode… no risk of disrupting networks").

---

## 2. Executive Project Overview

This is a final-year engineering project with **two very different layers that must not be conflated**:

1. **An extensive, well-written *planned* production architecture** — documented across 10 Markdown design docs, a synopsis document, and 4 "packet pipeline" tutorials — describing a microservice system: Zeek/tcpdump capture → Redis → FastAPI preprocessing/ML/SHAP → PostgreSQL → WebSocket dashboard → SOAR-lite automated `iptables` remediation, deployed via Docker Compose with Prometheus/Grafana.

2. **A much smaller *actual, working* prototype** — a Node.js/Express server that replays 1,000 pre-sampled rows of the UNSW-NB15 dataset from MongoDB, one row per second, through a Python subprocess running a pre-trained tree-ensemble model (XGBoost + Random Forest + LightGBM, simple average), and displays non-"Normal" predictions on a React dashboard ("Sentinel"). There is **no live packet capture, no Redis, no PostgreSQL, no FastAPI, no SHAP/LIME in code, no automated remediation, no authentication, and no Docker/deployment configuration anywhere in the repository.**

The team's own internal synthesis document (`himanshu-docs/master_synthesis_document.md`) is candid about this gap and explicitly recommends framing the FastAPI/Postgres/SOAR design as the "Proposed Production Architecture" and the Express/MongoDB prototype as the "Evaluation Sandbox Prototype" in any paper — this audit independently confirms that framing is accurate by reading the actual code, not just trusting that document's claim.

The one part of the system that *is* substantively implemented, evidenced by real code, is the **ML model-training work**: half a dozen distinct exploratory training scripts on the UNSW-NB15 dataset, converging on a soft-voting XGBoost+RF+LightGBM ensemble with feature selection, whose artifacts are loaded by the live prediction bridge. However, none of the trained model files or evaluation logs are committed to the repository (they are `.gitignore`d), so the specific reported metrics cannot be reproduced or verified from the repo alone — only the code that would produce metrics of that shape is verifiable.

---

## 3. Actual Implemented System

What genuinely runs, end to end, based on reading the code:

```
tests/live_test_dataset.csv (1000 rows, 80% Normal / 20% Attack, sampled from
  UNSW-NB15 training set by service/collector/mongoDB_csvCreate.py)
        │  (loaded once, RELOAD_CSV=true)
        ▼
MongoDB collection `live_test_dataset` (indexed by _sampleIndex)
        │  (Express server polls every 1000ms, cursor wraps to 0 at the end)
        ▼
Node.js/Express server (service/api/src/server.js, port 3001)
  - spawns a persistent Python child process running
    service/models/src/live_predictor_worker.py
  - sends one JSON sample over stdin, reads one JSON prediction over stdout
        │
        ▼
Python predictor (loads final_xgb.pkl, final_rf.pkl, final_lgbm.pkl,
  feature_selector.pkl, final_encoders.pkl, final_labels.pkl from
  service/models/artifacts/ — NOT present in the repo, gitignored)
  - drops id/mongo columns, applies saved LabelEncoders, applies the saved
    SelectFromModel feature selector, averages the three models'
    predict_proba() outputs, returns the argmax label + confidence
        │
        ▼
Express: if prediction != "Normal", appended to an in-memory array
  (capped at 200 entries, lost on server restart — no DB persistence of alerts)
        │
        ▼
React dashboard "Sentinel" (service/dashboard, Vite, port 5173)
  - polls GET /health and GET /alerts every 1s (optionally auto), or the
    operator clicks "Ingest 1 Sample" to POST /poll-once manually
  - renders a stat sidebar + a live alert feed list (no charts, no SHAP,
    no maps, no approve/rollback controls)
```

This is a closed loop over a **static, pre-sampled 1,000-row snapshot** of UNSW-NB15 — not live traffic, not even a live re-sample of the dataset. When the cursor reaches row 1000 it wraps back to row 0 and repeats the same sequence indefinitely (`server.js`, `pollOnce()`).

---

## 4. Repository Structure

Reconstructed from a full recursive listing (binary files noted but not opened):

```
/
├── README.md, run_guide.md, requirements.txt, .gitignore
├── data/
│   ├── UNSW_NB15_training-set.csv   (15.3 MB, committed)
│   └── UNSW_NB15_testing-set.csv    (32.1 MB, committed)
├── documentation/            10 planning docs (01–10) + 5 "packet pipeline"
│                              tutorial docs + Flowchart.png + a MongoDB test guide
├── docs_sahil/                method.md, ml.md — one team member's ML notes/experiment log
├── himanshu-docs/             master_synthesis_document.md — a 63 KB internal audit/
│                              synthesis doc (dated June 20, 2026) already comparing
│                              planned vs. actual architecture
├── others/                    Project_Synopsis.md, SNORT tutorial video, install notes,
│                              a YouTube-link reading list, a synopsis screenshot
├── literature/                25 source PDFs (5 IEEE + 20 non-IEEE) + 2 survey PDFs
├── project evaluation/        2 large PDFs (March/April evaluation) — not opened, not
│                              needed for the implementation audit
├── notebooks/                 EMPTY (.gitkeep only) — no Jupyter notebooks despite being
│                              referenced repeatedly in docs
├── experiments/                EMPTY (.gitkeep only) — no logged results
├── infra/                     EMPTY (.gitkeep only) — no Dockerfiles, no compose file
├── tests/
│   ├── .gitkeep
│   └── live_test_dataset.csv  — a data fixture, NOT test code
├── service/
│   ├── api/            Express server (src/server.js, package.json, .env.example)
│   ├── automation/     EMPTY (.gitkeep only) — SOAR-lite is 0% implemented
│   ├── collector/      mongoDB_csvCreate.py only — no capture code (tcpdump/Zeek/Scapy)
│   ├── dashboard/      Vite + React app ("Sentinel"), plus leftover default
│   │                    Vite scaffold files never cleaned up (main.ts, counter.ts,
│   │                    style.css, typescript/vite logo assets — dead code)
│   ├── mobile/         EMPTY (.gitkeep only)
│   ├── models/         src/ has 9 training/eval scripts + train_model.py at top level
│   └── preproc/        EMPTY (.gitkeep only) — no standalone preprocessing module exists;
│                        all preprocessing is inlined inside the training/predictor scripts
```

`.gitignore` explicitly excludes `service/models/artifacts/`, `*.pkl`, `*.h5`, `service/api/node_modules/`, `service/api/.env`, `.venv/`, and a file called `globalPrompt.txt` (never seen — likely the team's internal AI-assistant prompt, not a project artifact).

---

## 5. Complete Technology Stack

| Layer | **Documented / Planned** (Docs 01–07, Project_Synopsis.md) | **Actually in the code** | Status |
|---|---|---|---|
| Backend language/API | Python, FastAPI, Uvicorn, Pydantic, JWT auth | **Node.js, Express 4** (`service/api/package.json`: cors, csv-parse, dotenv, express, mongodb — no auth library at all) | **MISMATCH** |
| Database | PostgreSQL (relational alerts/audit) | **MongoDB** (one collection, `live_test_dataset`) | **MISMATCH** |
| Message queue/cache | Redis pub/sub | **None** — Express in-process polling + an in-memory array | **NOT IMPLEMENTED** |
| Traffic capture | tcpdump, tshark, Zeek, CICFlowMeter | **None found anywhere** — only a CSV-sampling script | **NOT IMPLEMENTED** |
| ML/DL core | scikit-learn, XGBoost, PyTorch, class RF/XGB/LSTM/Autoencoder | **scikit-learn, XGBoost, LightGBM, TensorFlow/Keras** actually used (requirements.txt omits imbalanced-learn's SMOTE variants used in code, omits lightgbm/tensorflow — requirements.txt is stale/incomplete, see §33) | **PARTIAL / MISMATCH** |
| Explainability | SHAP, LIME | **No `shap` or `lime` import found in any fetched file** | **NOT IMPLEMENTED** |
| Frontend | React 18, Chart.js, D3.js, TypeScript | **React 19** (plain, via Vite) — no Chart.js, no D3, no axios, no TypeScript used for the actual app logic (a `.jsx` app; leftover `.ts` scaffold files are unused Vite boilerplate) | **PARTIAL / MISMATCH** |
| Alerting | SMTP, Slack webhook, Firebase push | **None** — alerts only shown in the dashboard / printed to server console | **NOT IMPLEMENTED** |
| Prevention | iptables, Suricata rule API | **`service/automation/` contains only `.gitkeep`** | **NOT IMPLEMENTED (0%)** |
| Containerization | Docker, Docker Compose, K8s | **`infra/` contains only `.gitkeep`** — no Dockerfile anywhere | **NOT IMPLEMENTED** |
| Monitoring | Prometheus, Grafana | **None found** | **NOT IMPLEMENTED** |
| CI/CD | GitHub Actions | **No `.github/workflows` found in the listed tree** | **NOT VERIFIED / likely absent** |
| Testing | pytest, Jest, Playwright, ≥80% coverage target | **`tests/` contains only a CSV data fixture — zero test code found** | **NOT IMPLEMENTED** |
| Model tracking | MLflow | **Not found** | **NOT IMPLEMENTED** |

---

## 6. System Architecture

**Planned (documented, `documentation/02_tech_and_architecture.md`, `others/Project_Synopsis.md`):** a 7-component microservice pipeline (Collector → Redis → Preprocessor → ML Engine w/ SHAP → FastAPI → {Dashboard, Alerting, SOAR-lite} → {PostgreSQL/Redis, Prometheus/Grafana, Nginx TLS}). This is a coherent, plausible design — but it is a design, not a build.

**Actual (as implemented):** a single-process Node.js server + a single spawned Python child process + a static MongoDB collection + a polling React SPA. See §3 for the exact loop. There is no message broker, no persistent alert store, no service boundary enforcement, no auth boundary, and no containerization tying any of it together.

---

## 7. End-to-End Data Flow

**Planned:** `Network Traffic → Mirror Port/TAP → Zeek/tcpdump → Redis → Feature Extraction/Encoding/Scaling → Ensemble+SHAP → FastAPI (Postgres write + WS broadcast) → Dashboard / Email-Slack / SOAR-lite iptables`.

**Actual:** `UNSW-NB15 training CSV → mongoDB_csvCreate.py samples 1000 rows (fixed 80/20 class ratio, fixed weak-attack exclusion, seed=42) → tests/live_test_dataset.csv → MongoDB (one-time load, gated by RELOAD_CSV env flag) → Express polls one row/second by cursor → stdin/stdout JSON round-trip to a persistent Python worker → 3-model averaged soft-voting prediction → non-Normal predictions pushed into an in-memory array (cap 200) → React dashboard polls REST endpoints`.

The gap between these two flows is total for every stage except "run a trained tabular ensemble model on one row of UNSW-NB15 at a time."

---

## 8. Frontend Implementation

- **Framework:** React 19 + Vite (`service/dashboard`), plain JSX, no TypeScript in the actual app, no component library, no charting library.
- **Files that matter:** `src/App.jsx` (state + polling), `src/components/{Header,StatsWidget,ControlPanel,TelemetryFeed}.jsx`, `src/index.css` (a dark "glassmorphism"/neon theme — this is where the visual identity actually lives).
- **What it shows:** connection status badge, 4 stat tiles (processed samples, critical-alert count at ≥90% confidence, average confidence, DB cursor position), a manual "Ingest 1 Sample" button, an auto-sync toggle, and a scrolling list of alerts (time, predicted attack type, confidence bar, sample index). No SHAP visuals, no model-comparison page, no settings page, no login screen, no SOAR approve/rollback UI — none of these exist despite being specified in `documentation/03_implementation_plan.md` and `07_api_and_user_manual.md`.
- **Dead code found:** `src/main.ts`, `src/counter.ts`, `src/style.css`, and the `typescript.svg`/`vite.svg`/`hero.png` assets are the **unmodified default Vite scaffold** (a counter button demo page) — never wired into the real app and never removed. Minor housekeeping issue, not a functional bug.
- **API base URL is hardcoded** (`http://127.0.0.1:3001`) in `App.jsx` — no environment-based configuration on the frontend.

---

## 9. Backend Implementation

- **Framework:** Express 4 on Node.js (`service/api/src/server.js`, ~330 lines).
- **Endpoints (all of them):** `GET /health`, `GET /alerts`, `POST /poll-once`, `GET /config`. That is the complete API surface. None require authentication; CORS is wide open (`app.use(cors())` with default/all-origins config).
- **Config:** environment-driven via `dotenv` (`PORT`, `MONGODB_URI`, `MONGODB_DB_NAME`, `MONGODB_COLLECTION`, `CSV_PATH`, `POLL_INTERVAL_MS`, `PYTHON_CMD`, `PREDICTOR_SCRIPT`, `RELOAD_CSV`). `.env` itself is gitignored (good practice); `.env.example` is committed and uses a placeholder MongoDB Atlas connection string.
- **Python bridge:** a custom `PythonPredictorBridge` class manages a long-lived child process, correlates requests/responses by an incrementing `requestId` over newline-delimited JSON on stdin/stdout, with a 20s startup timeout and a 10s per-prediction timeout.
- **State:** a single in-process `state` object (`processedSamples`, `currentCursor`, `totalSamples`, `alerts[]`). No database write-back of alerts — a server restart loses all alert history.

---

## 10. Database / Storage Implementation

- **Actual:** MongoDB only, one collection (`live_test_dataset`), seeded from a CSV, indexed uniquely on `_sampleIndex`. No `alerts`, `actions`, `users`, or `audit_log` collections/tables exist anywhere in the code — the detailed PostgreSQL schema in `documentation/03_implementation_plan.md` (four tables with UUID PKs, JSONB SHAP columns, etc.) is **entirely unimplemented**, design-only.
- **Planned:** PostgreSQL (relational, with the schema above) + Redis (pub/sub + cache). Neither appears in any dependency file or source file.

---

## 11. Data Collection

- **Planned:** live capture via mirror port/TAP using tcpdump/tshark/Zeek, converting packets to flow records.
- **Actual:** **zero packet-capture code**. "Collection" in the working system means `service/collector/mongoDB_csvCreate.py`, which deterministically samples rows from an already-existing, already-labeled CSV dataset (UNSW-NB15) — it does not touch a network interface. This is confirmed by a full read of every file under `service/collector/`.
- The extensive `documentation/packet_pipeline_part2_capture.md` (Zeek/tcpdump setup, BPF filters, log parsers) and `documentation/packet_pipeline_solutions.md` (a 62 KB "how to actually wire up 4 VMs/laptops with ZeroTier and Zeek" guide) are detailed, practically-oriented **plans for future work**, not descriptions of anything currently running. `packet_pipeline_part1_overview.md` itself contains an explicit team-authored table stating capture, Redis, and SOAR-lite are all "❌ Not built yet."

---

## 12. Dataset Details

- **Dataset actually present and used:** UNSW-NB15 only — both `UNSW_NB15_training-set.csv` and `UNSW_NB15_testing-set.csv` are committed to the repo and are read directly by every training script and by the live sample-generation script.
- **NSL-KDD and CICIDS2017:** referenced extensively across the documentation and synopsis (as planned evaluation datasets, with citations) but **no NSL-KDD or CICIDS2017 file, download script, or loader code was found anywhere in the repository.** Status: **PLANNED / DOCUMENTED ONLY.**
- **Class distribution and feature counts** (82,332 training samples, 49 raw features, 10 attack categories, per-class counts down to "Worms = 44") are reported in `docs_sahil/ml.md`. This is **documentation-tier evidence (team member's notes), not something this audit independently recomputed from the CSV** — the numbers are plausible and consistent with the training scripts' behavior (which do filter exactly the classes named as "weak": Analysis, Backdoor, Shellcode, Worms) but are not re-derived here from the raw data.

---

## 13. Data Preprocessing

Confirmed by reading every training/inference script:
- Dropped identifier/leakage columns: `srcip`, `dstip`, `id`, `Stime`, `Ltime` (consistently, across all scripts).
- Categorical encoding: `sklearn.preprocessing.LabelEncoder` per categorical column (proto/service/state), fit on train, applied to test with an unknown-category fallback (`-1` or `0`, inconsistently across scripts — see §33).
- Class-imbalance handling: multiple different techniques tried in different scripts — plain class weighting, `SMOTE`, `SMOTENC` (categorical-aware SMOTE), `SMOTETomek` (SMOTE + Tomek-link cleaning) — not a single consistent pipeline.
- Feature selection: only in `train_from_scratch.py`, via `sklearn.feature_selection.SelectFromModel` (threshold = median) fit on an initial XGBoost model.
- Scaling: `StandardScaler`, used only in the deep-learning script (`train_dl_model.py`); the tree-model scripts do not scale features (expected — tree ensembles don't need it).
- **No standalone preprocessing module exists** (`service/preproc/` is empty) — every script inlines its own preprocessing, and the several scripts are **not consistent with one another** (see §33 for the resulting bug in `predict_pipeline.py`).

---

## 14. Feature Engineering

- The project uses UNSW-NB15's **pre-computed 49 flow features as-is**; there is no custom flow-feature extraction from raw packets (no `feature_extractor.py`, no window-based connection tracker) anywhere in the code — the elaborate `ConnectionTracker` class and Zeek-to-UNSW-NB15 feature-mapping table in `documentation/packet_pipeline_part3_processing_ml.md` are **pseudocode within a planning document**, not implemented modules.
- Feature importance discussion (`ct_state_ttl`, `sttl`, `dttl`, `sbytes`, `dbytes`, `ct_dst_src_ltm`, `ct_srv_dst`, `ct_src_dport_ltm` as top features) appears only in `docs_sahil/ml.md` — plausible and consistent with UNSW-NB15 literature, but **not independently reproduced from a stored feature-importance run** in this repository.

---

## 15. Machine Learning Implementation

Nine distinct model files exist under `service/models/` (`src/` + one top-level script), each a **separate exploratory experiment**, not variations of one canonical pipeline:

| Script | What it trains | Classes covered | Balancing | Saves |
|---|---|---|---|---|
| `train_binary_model.py` | Single XGBoost | Benign vs Attack (binary) | none | (not saved — script prints only) |
| `train_stage1_binary.py` | Single XGBoost + 5-fold CV | Benign vs Attack (binary) | none | `stage1_binary.pkl`, `stage1_encoders.pkl` |
| `train2_model.py` | XGBoost + RF | 3 rare classes only (Backdoor/Shellcode/Worms, Analysis merged into Backdoor) | SMOTENC + class weights | `stage2_rare_*.pkl` |
| `train_stage2_major.py` | XGBoost + RF + LightGBM soft vote, per-class threshold tuning | 5 "major" classes (Generic, Exploits, Fuzzers, DoS, Reconnaissance) | targeted SMOTENC | `stage2_major_*.pkl` |
| `train_combined_model.py` | XGBoost + RF + LightGBM soft vote | 6 classes (train+test CSVs concatenated) | none | `combined_*.pkl` |
| `train_model.py` (top-level) | Single RandomForest | **All 10** original classes (rare ones kept) | SMOTETomek | (not saved) |
| **`train_from_scratch.py`** | **XGBoost + RF + LightGBM soft vote (equal weight)** | **6 classes** (4 rare classes dropped) | none (post feature-selection) | **`final_xgb.pkl`, `final_rf.pkl`, `final_lgbm.pkl`, `feature_selector.pkl`, `final_encoders.pkl`, `final_labels.pkl`** |
| `train_dl_model.py` | Keras dense NN (512→256→128→64→softmax) | 6 classes | SMOTE + class weights | `dl_model.h5`, `dl_scaler.pkl`, `dl_encoders.pkl`, `dl_labels.pkl` |
| `ensemble_model.py` | *Evaluation only* — weighted ensemble of all 4 models above (LightGBM 40% / DL 30% / XGB 20% / RF 10%), with per-class thresholds that are computed but **never actually applied** (dead code — `ensemble_preds_tuned` is assigned but not used in the printed metrics) | 6 classes | — | (evaluation only) |

**The artifact set that the live/serving path actually uses is `final_xgb.pkl` + `final_rf.pkl` + `final_lgbm.pkl` + `feature_selector.pkl` + `final_encoders.pkl` + `final_labels.pkl`, i.e., exactly what `train_from_scratch.py` saves.** `live_predictor_worker.py` loads precisely these six files and combines the three tree models with a simple unweighted average — not the weighted DL-inclusive scheme in `ensemble_model.py`.

Per the mandated model table:

| Model | Purpose | Training Code | Inference Code | Dataset | Metrics computed in-script? | Status |
|---|---|---|---|---|---|---|
| XGBoost, RF, LightGBM (soft-vote, "final") | Primary/serving model | `train_from_scratch.py` | `live_predictor_worker.py`, `predict_pipeline.py` (see §33 bug) | UNSW-NB15 (6 classes) | Yes — printed accuracy, macro recall, micro recall, classification report | **IMPLEMENTED (training + inference code); numeric results not stored in repo** |
| XGBoost, RF (rare-class stage-2) | Experiment | `train2_model.py` | none | UNSW-NB15 (3 classes) | Yes, printed | **IMPLEMENTED (experiment only, not wired to serving)** |
| XGBoost, RF, LightGBM (major-class stage-2 w/ threshold tuning) | Experiment | `train_stage2_major.py` | none | UNSW-NB15 (5 classes) | Yes, printed | **IMPLEMENTED (experiment only)** |
| XGBoost, RF, LightGBM (combined train+test) | Experiment | `train_combined_model.py` | none | UNSW-NB15 (6 classes, concatenated) | Yes, printed | **IMPLEMENTED (experiment only)** |
| RandomForest (SMOTETomek, all 10 classes) | Experiment | `train_model.py` | none | UNSW-NB15 (10 classes) | Yes, printed | **IMPLEMENTED (experiment only)** |
| XGBoost (binary) ×2 variants | Experiment | `train_binary_model.py`, `train_stage1_binary.py` | none | UNSW-NB15 (binary) | Yes, printed | **IMPLEMENTED (experiment only)** |
| Dense NN / Keras | Experiment, not in serving path | `train_dl_model.py` | `ensemble_model.py` (eval only) | UNSW-NB15 (6 classes) | Yes, printed | **IMPLEMENTED (experiment only; DL is not used by the live prediction bridge)** |

**No saved logs, CSV result files, or JSON metric files exist anywhere in the repo (`experiments/` is empty).** Every accuracy/recall figure quoted anywhere in the documentation traces back to console `print()` output that was never captured to a file, and is reported second-hand in `docs_sahil/ml.md` and `himanshu-docs/master_synthesis_document.md`.

---

## 16. Deep Learning Implementation

A single Keras `Sequential` dense network (`train_dl_model.py`): 512→BN→Dropout(0.4) → 256→BN→Dropout(0.4) → 128→BN→Dropout(0.3) → 64→Dropout(0.2) → softmax(6 classes), Adam(lr=0.001), `EarlyStopping`+`ReduceLROnPlateau`, trained on SMOTE-balanced data with class weights, up to 150 epochs / batch 256. Saved as `dl_model.h5` (gitignored, not present in repo). **This model is not part of the live prediction path** — it only appears combined into the separate `ensemble_model.py` evaluation script, which itself is not invoked anywhere else in the codebase (no import of it from `server.js` or `live_predictor_worker.py`).

The README/docs also describe an LSTM model and an Autoencoder for anomaly detection as part of the "4-model architecture." **No LSTM or Autoencoder code was found anywhere in the fetched repository.** Status: **PLANNED / DOCUMENTED ONLY.**

---

## 17. Model Training

- Training is run manually/locally (`python -m` style invocations mentioned in docs); there is no CI workflow found that runs training.
- Fixed `random_state=42` is used consistently across scripts (good reproducibility practice for the code itself).
- **No trained model artifacts are committed** — `*.pkl` and `*.h5` and the entire `service/models/artifacts/` directory are `.gitignore`d. This means: (a) the repository, as cloned fresh, cannot serve a prediction until someone re-runs one of the training scripts locally, and (b) the specific numeric results claimed in documentation cannot be reproduced or checked by a third party from the repo alone.

---

## 18. Model Evaluation

Every training script computes standard sklearn metrics (`accuracy_score`, `recall_score` macro/micro, `classification_report`) and prints them — none are written to a file. The specific headline numbers repeated across the documentation layer:

- **Accuracy: 89.75% (also written as 89.7%)**
- **Macro recall: 81.58% (also written as 81.5%)**
- **Micro recall: 89.75%**
- **Per-class recall:** Normal 0.98, Generic 0.98, Reconnaissance 0.83, Fuzzers 0.80, DoS 0.66, Exploits 0.65

These originate in `docs_sahil/ml.md` (self-described as one team member's "hit & trial" experiment log — five experiments tried: plain baseline 87%/56% macro recall → SMOTE → multi-stage → rare-only model → deep learning, before landing on "drop the 4 rarest classes + soft-vote ensemble" as final). `train_from_scratch.py` is structurally the script that would produce a result of exactly this shape (6 classes, ensemble of the same 3 model types, same drop-list). **Verdict: experiment implementation found and structurally consistent with the reported numbers; the specific numeric result is not independently verified from any stored output, log file, or artifact in the repository — it rests on the team's self-reported documentation only.**

---

## 19. Post-ML/DL System Implementation

Everything after "a trained model produces a label + confidence" is covered in §8–11 and §20–24: an Express bridge, MongoDB storage, and a React dashboard, with no queueing, no persistence of alerts, no auth, no explainability, no alerting channels, and no automated response. This is the entirety of "Part 2" as actually built.

---

## 20. APIs and Services

Complete inventory (already given in §9): `GET /health`, `GET /alerts`, `POST /poll-once`, `GET /config`. No `/auth/*`, no `/actions/*`, no `/models/*`, no `/detect`, no `/metrics` (Prometheus format), no WebSocket endpoint — all of these are specified in detail in `documentation/07_api_and_user_manual.md` but do not exist in `server.js`.

---

## 21. Real-Time / Streaming Components

None. "Real-time" in the working system is a `setInterval(pollOnce, 1000)` loop over a static, already-labeled dataset — not live traffic, not a stream, no backpressure handling, no queue. The Redis-based architecture described in the docs is unimplemented.

---

## 22. Explainability / XAI

**Not implemented.** No `shap` or `lime` package import appears in any Python file read during this audit (`requirements.txt` also does not list either package). SHAP/LIME are extensively discussed as the project's stated "primary innovation" across the README, all planning docs, the synopsis, and the uploaded IEEE reference paper — but this is exclusively a design/literature-derived proposal. The live prediction path returns only a label and a numeric confidence score (the average of the three models' max class probability); it returns no feature attributions of any kind.

---

## 23. Alerting / Monitoring

- **Alerting:** the only "alert" mechanism is (a) a `console.log` line on the server and (b) an entry appended to the in-memory `alerts` array shown on the dashboard. No SMTP/email code, no Slack webhook code, no Firebase/push code exists anywhere.
- **Monitoring:** no Prometheus client library, no `/metrics` endpoint, no Grafana config or dashboard JSON found anywhere in the repo. `infra/` (where these would live per the docs) is empty.

---

## 24. Automated Response / Prevention

**0% implemented.** `service/automation/` contains a single `.gitkeep` file and nothing else — confirmed by direct directory listing. No `iptables` subprocess calls, no Suricata rule-writing code, no policy engine, no approval/rollback logic exists anywhere in the fetched repository, despite this being described as the project's "secondary innovation" throughout the documentation and the uploaded reference paper.

---

## 25. Deployment

**Not implemented.** `infra/` contains only `.gitkeep`. No `Dockerfile`, no `docker-compose.yml`, no Kubernetes manifest, no Nginx config was found anywhere in the repository tree, despite detailed Docker Compose YAML and Dockerfile examples appearing in `documentation/06_deployment_and_ops.md`. The only "deployment" instructions that correspond to reality are the manual `npm install` / `npm start` / `npm run dev` steps in `README.md` and `run_guide.md`.

---

## 26. Testing

**Not implemented.** `tests/` contains only `live_test_dataset.csv` (a data fixture used by the runtime, not a test) and `.gitkeep`. No `pytest`, `unittest`, Jest, or Playwright test file was found anywhere in the repository, despite `documentation/09_test_plan_and_checklist.md` specifying roughly 50 detailed test cases (unit, integration, dataset, model, automation, API, security, performance) and an 80% coverage target.

---

## 27. Security

- No authentication or authorization anywhere in the actual code (contradicts the documented JWT-based scheme). Every endpoint is open.
- CORS is enabled with permissive defaults (`app.use(cors())`), not restricted to a specific origin.
- Credentials handling for the actual `.env` (containing the real Mongo URI) follows good practice — it's git-ignored, and `.env.example` only contains a placeholder connection string.
- No input validation library (no Pydantic-equivalent, no Zod/Joi) is used on the Express side; the CSV/Mongo record shape is trusted as-is.
- The prevention/automation module that would carry the most security risk (running `iptables` commands) is entirely unimplemented, so that specific risk is currently moot — but also means the "demo-mode safety gate" described in the docs protects nothing that exists yet.

---

## 28. Documentation vs. Actual Implementation

| Feature / Component | Documentation Claims | Repository Evidence | Status | Evidence |
|---|---|---|---|---|
| Backend framework | FastAPI (Python) | Express (Node.js) | **DOC/CODE MISMATCH** | `service/api/src/server.js`, `package.json` |
| Database | PostgreSQL | MongoDB | **DOC/CODE MISMATCH** | `server.js` (MongoClient usage) |
| Message broker | Redis | None (in-memory array) | **PLANNED / DOCUMENTED ONLY** | no redis dependency anywhere |
| Live packet capture | tcpdump/Zeek/tshark | CSV-sampling script only | **PLANNED / DOCUMENTED ONLY** | `service/collector/` contents |
| SHAP/LIME explainability | Core "primary innovation" | No shap/lime import found | **PLANNED / DOCUMENTED ONLY** | full read of all `.py` files |
| SOAR-lite automated response | Core "secondary innovation," full design | `service/automation/.gitkeep` only | **PLANNED / DOCUMENTED ONLY (0%)** | directory listing |
| WebSocket real-time alerts | Explicit spec + sample code | REST polling only | **PLANNED / DOCUMENTED ONLY** | `App.jsx`, `server.js` |
| Authentication (JWT) | Required on all endpoints | None implemented | **PLANNED / DOCUMENTED ONLY** | `server.js` endpoint list |
| Multi-channel alerting (email/Slack/push) | Explicit spec | None implemented | **PLANNED / DOCUMENTED ONLY** | no relevant deps/code |
| Docker / Docker Compose deployment | Detailed YAML + Dockerfiles | `infra/.gitkeep` only | **PLANNED / DOCUMENTED ONLY** | directory listing |
| Monitoring (Prometheus/Grafana) | Detailed config | None found | **PLANNED / DOCUMENTED ONLY** | no config files found |
| Test suite (~50 cases, 80% coverage) | Detailed test plan doc | `tests/` has a CSV fixture only | **PLANNED / DOCUMENTED ONLY** | directory listing |
| Multi-dataset eval (NSL-KDD, CICIDS2017) | Explicit, repeated | Only UNSW-NB15 present | **PARTIALLY IMPLEMENTED** (1 of 3 datasets) | `data/` contents |
| LSTM / Autoencoder models | Explicit, "4-model architecture" | Not found in code | **PLANNED / DOCUMENTED ONLY** | full read of `service/models/` |
| Ensemble classifier (XGBoost+RF+LightGBM) | Explicit spec | **Implemented and used in serving path** | **IMPLEMENTED** | `train_from_scratch.py`, `live_predictor_worker.py` |
| Dataset sampling / class-imbalance handling | Explicit spec | **Implemented** (multiple approaches tried) | **IMPLEMENTED** | 9 training scripts |
| React dashboard ("Sentinel") | Explicit spec, richer feature set claimed | **Implemented**, but simpler than documented (no SHAP visuals, no charts, no auth, REST polling not WS) | **PARTIALLY IMPLEMENTED** | `service/dashboard/src/` |
| Reported accuracy/recall figures | 89.75% acc / 81.58% macro recall | Code that could produce such numbers exists; numbers themselves not stored/reproducible | **NOT VERIFIED** | see §18 |

---

## 29. Implemented Features

- CSV-based dataset sampling with configurable class ratio (`mongoDB_csvCreate.py`).
- MongoDB seeding and cursor-based sequential playback (`server.js`).
- A working Python↔Node.js subprocess bridge over stdin/stdout JSON (`server.js`, `live_predictor_worker.py`).
- A trained (locally, not committed) tabular ensemble classifier (XGBoost + RF + LightGBM, soft-voted) with a feature-selection step, serving predictions with a confidence score.
- A minimal but functional live-updating React dashboard (manual + auto polling) with a distinct visual identity.
- At least 8 additional exploratory ML training scripts covering binary classification, rare-class specialization, major-class specialization with threshold tuning, combined-dataset training, SMOTE/SMOTENC/SMOTETomek balancing, and a deep neural network.

## 30. Partially Implemented Features

- **Multi-dataset evaluation:** only UNSW-NB15 is present; NSL-KDD and CICIDS2017 are cited/planned but absent.
- **React dashboard:** functional core loop, but missing every visualization/control feature beyond a basic alert list and stat tiles.
- **requirements.txt:** lists some but not all Python dependencies actually imported by the code (see §33).

## 31. Planned but Unimplemented Features

SHAP/LIME explainability; SOAR-lite automated remediation (iptables/Suricata); live packet capture (Zeek/tcpdump/Scapy); Redis message broker; PostgreSQL persistence; FastAPI backend; JWT authentication; WebSocket streaming; multi-channel alerting (email/Slack/push); Docker/Compose/K8s deployment; Prometheus/Grafana monitoring; automated test suite; LSTM and Autoencoder models; mobile push client; CI/CD pipeline.

## 32. Unverified Features

- The exact reported accuracy (89.75%) and macro recall (81.58%) figures — code exists that could produce numbers of this shape, but the values themselves are not stored anywhere retrievable in the repository (see §18).
- The precise UNSW-NB15 class-distribution numbers quoted in `docs_sahil/ml.md` (e.g., "Worms = 44 samples") — plausible and consistent with the code's behavior, but not independently recomputed from the raw CSV during this audit.
- Whether a GitHub Actions CI workflow exists — none was surfaced in the retrieved file tree, but a `.github/` directory was not explicitly enumerated in the top-level listing returned by the tool, so absence is inferred rather than exhaustively confirmed.

## 33. Current Limitations

**A. Confirmed limitations (directly observed in code):**
- No live traffic anywhere — the entire "real-time" system replays a fixed 1,000-row static sample on a loop.
- No persistence of alerts — an in-process array capped at 200, wiped on restart.
- No authentication or access control on any endpoint.
- `predict_pipeline.py` appears to have a **feature-shape bug**: it calls `model_xgb.predict_proba(packet_df)` directly after `encode_features()` without ever calling the saved `feature_selector.transform()` step that `train_from_scratch.py` used to reduce the training feature set — the models were trained on a post-selection feature count, so `predict_pipeline.py`'s input shape likely does not match what the models expect. (`live_predictor_worker.py`, the actually-used script, does apply the selector correctly, so the live path itself is not affected — but `predict_pipeline.py` as a standalone script looks broken.)
- `requirements.txt` lists only `pandas, numpy, matplotlib, seaborn, scikit-learn, xgboost, imbalanced-learn, lightgbm` — it omits `tensorflow` (used by `train_dl_model.py`, `ensemble_model.py`) and `joblib` (used throughout for model I/O, though often bundled with scikit-learn). A fresh `pip install -r requirements.txt` would not be sufficient to run every script in the repo.
- Dead/unused Vite scaffold files left in `service/dashboard/src` (`main.ts`, `counter.ts`, `style.css`) — cosmetic, not functional, but indicates the frontend was not fully cleaned up.
- `.gitignore`d model artifacts mean the repository cannot serve a prediction out of the box; a fresh clone requires re-running training locally, and the specific reported metrics cannot be reproduced by a third party.

**B. Missing components:** SHAP/LIME, SOAR-lite, live capture, Redis, PostgreSQL, FastAPI, auth, alerting channels, deployment config, monitoring, tests — see §31.

**C. Partially implemented components:** dataset breadth (1 of 3 planned datasets), dashboard feature completeness — see §30.

**D. Documentation/implementation mismatches:** see the full table in §28.

**E. Areas requiring future experiments:** cross-dataset generalization (NSL-KDD, CICIDS2017) is entirely unattempted in code; no throughput/latency/stress testing has been run against anything (the numbers in `05_experimental_plan_and_metrics.md` are targets, not measurements); no SHAP-latency benchmark exists because SHAP isn't implemented at all.

**F. Areas requiring additional implementation before publication:** at minimum, either (a) implement and measure SHAP/LIME plus save real evaluation artifacts to the repo (logs, confusion matrices, metric JSON) so numbers are independently reproducible, or (b) explicitly and consistently frame the paper(s) around the prototype that actually exists, with the microservice/XAI/SOAR design presented only as proposed future architecture (as the team's own `himanshu-docs/master_synthesis_document.md` already recommends).

---

## 34. Existing Experiments and Results

| Result | Value | Experiment | Source File | Verified? |
|---|---|---|---|---|
| Baseline (RF/XGBoost, all classes) | Accuracy 87%, Macro recall 56% | Exp. 1 | `docs_sahil/ml.md` (narrative); structurally matches `train_model.py`/`train_binary_model.py` shape | **Not verified from stored output** |
| SMOTE oversampling | "Recall improved slightly" (no numbers given) | Exp. 2 | `docs_sahil/ml.md` | **Not verified — no numbers to verify** |
| Multi-stage (binary → multi-class) | Stage 1: 98% acc; Stage 2: 80% acc | Exp. 3 | `docs_sahil/ml.md`; code shape matches `train_stage1_binary.py` + `train_stage2_major.py` | **Not verified from stored output** |
| Rare-attack-only model | Accuracy 65%, Recall 73% | Exp. 4 | `docs_sahil/ml.md`; code shape matches `train2_model.py` | **Not verified from stored output** |
| Deep learning (dense NN) | Accuracy 86%, Recall 80% | Exp. 5 | `docs_sahil/ml.md`; code shape matches `train_dl_model.py` | **Not verified from stored output** |
| **Final ensemble (6 classes, XGB+RF+LightGBM)** | **Accuracy 89.75%, Macro recall 81.58%, Micro recall 89.75%** | "Final" | `docs_sahil/ml.md`, repeated in `himanshu-docs/master_synthesis_document.md`; code shape matches `train_from_scratch.py` exactly (same 6-class drop-list, same 3 models) | **Experiment implementation found; result not independently verified from stored output** |
| Per-class recall (final model) | Normal 0.98, Generic 0.98, Recon 0.83, Fuzzers 0.80, DoS 0.66, Exploits 0.65 | "Final" | `docs_sahil/ml.md` | **Not verified from stored output** |
| Any operational metric (latency, throughput, FPR) | None reported | — | — | **No experiment found — targets only, in `05_experimental_plan_and_metrics.md`** |
| SHAP computation latency | None reported | — | — | **Not applicable — SHAP not implemented** |

No `experiments/` files, no CI logs, no notebook outputs exist to independently cross-check any of the above.

---

## 35. Missing Experiments

- Any evaluation on NSL-KDD or CICIDS2017 (both datasets are entirely absent from the repo).
- Cross-dataset generalization tests (train on X, test on Y) — specified in detail in `05_experimental_plan_and_metrics.md`, zero code found.
- Any stress/throughput/burst/24-hour soak test — specified in the same doc, zero code found.
- Any SHAP/LIME latency or quality measurement — not applicable since XAI isn't implemented.
- Any ablation study (e.g., value of feature selection, value of each ensemble member, value of SMOTE variant chosen) — the many separate training scripts amount to informal ablation attempts, but none save comparable, reproducible results side by side.
- Persisted, reproducible logging of any of the results in §34 (this is the most immediately actionable gap: simply saving `classification_report` output + a `metadata.json` per run would resolve most of the "not verified" markers above).

---

## 36. Possible Research Contributions

Being appropriately critical, per the user's explicit instruction that a feature is not automatically a contribution:

| Proposed contribution | Implementation evidence | Research question it could support | Experiment required | Baseline required | Metric required | Evidence currently available | Evidence still missing | Potential weakness |
|---|---|---|---|---|---|---|---|---|
| Soft-voting XGBoost+RF+LightGBM ensemble for UNSW-NB15 multi-class detection, with a documented "drop the 4 rarest classes" imbalance strategy | `train_from_scratch.py`, `docs_sahil/ml.md`'s 5-experiment trail | Does dropping severely under-represented classes improve macro recall more than oversampling them, for tree ensembles on UNSW-NB15? | Re-run and log all 5 documented experiments with saved metrics for a fair side-by-side comparison | Single-model baselines (already informally tried) | Accuracy, macro recall, per-class recall, confusion matrix | Code for all 5 variants exists | Saved, reproducible numeric results (currently only self-reported) | Ensemble-of-tree-models on UNSW-NB15 is a well-trodden combination in the cited literature itself (IEEE-04, Non-IEEE-08) — the *novelty* would rest specifically on the imbalance-handling comparison and honest reporting of the trade-offs, not on the ensemble choice itself |
| A working sandbox pipeline that replays a labeled dataset through a live-style serving loop (CSV → DB → subprocess bridge → dashboard) | `server.js`, `live_predictor_worker.py`, dashboard code | Can this specific low-effort architecture (no message broker, no persistent store) meaningfully approximate "real-time" demonstration for teaching/demo purposes, and where does it break down at scale? | Load-test the current loop (it isn't tested at all today); document its actual failure modes (single fixed dataset, unbounded alert loss on restart, etc.) | None — this would be a systems/engineering evaluation, not a comparison to prior work | Throughput, memory growth, alert-loss rate | The loop exists and can be instrumented | Any load/stress measurement at all | This is a systems-engineering observation about a student prototype, not a research contribution in the ML/security sense — would need to be framed carefully, if included at all |
| A documented planned-vs-actual architecture gap analysis (production microservice design vs. minimal sandbox) | `himanshu-docs/master_synthesis_document.md`, this audit | Not really a research question — more of a project-management/engineering-pedagogy observation | N/A | N/A | N/A | Already exists as narrative | N/A | Not a technical research contribution; useful as an honest "Implementation" section in a paper, not as a claimed novelty |
| SHAP/LIME operationalized in a *live* dashboard (as proposed) | None — 0% implemented | Would XAI integrated into a live loop measurably reduce analyst triage time or false-alert dismissal, vs. offline XAI? | Full implementation + a user study or at minimum a latency/consistency benchmark | An offline-XAI baseline (e.g., reproducing Mohale & Obagbuwa 2025's static SHAP approach) | SHAP computation latency, feature-overlap-with-domain-knowledge, (ideally) analyst-trust proxy | None | Everything — this is 100% unimplemented | Currently just a proposal, same as the uploaded reference paper's framework — cannot be claimed as an achieved contribution |
| SOAR-lite automated remediation with approval/rollback | None — 0% implemented (`service/automation/.gitkeep`) | Same caveat as above | Full implementation + safety/false-positive-blocking experiments | A "detection-only" baseline | Rollback correctness, false-block rate, time-to-remediate | None | Everything | Currently just a design; the uploaded IEEE paper itself already frames this exact idea as "a design recommendation... not an experimental implementation" — implementing it would be genuinely new relative to that paper, but nothing here does so yet |

**Bottom line:** the one piece of the project with actual technical substance behind it right now is the ML experimentation on UNSW-NB15 (§15/§34). Everything framed as "primary" and "secondary innovation" in the team's own documentation (XAI, SOAR-lite) is, as of this audit, unimplemented design work — which is fine as a contribution *if honestly framed as a proposed/future-work framework* (exactly as the uploaded IEEE literature-review paper already does), but cannot be presented as delivered, evaluated system functionality.

---

## 37. Preliminary Part 1 Scope (Foundation → ML/DL)

**Technical scope:** project framing, UNSW-NB15 dataset handling, preprocessing/encoding/feature-selection, the ensemble classifier (XGBoost+RF+LightGBM) and the separate deep-learning experiment, and the several imbalance-handling strategies tried.

**Modules included:** `data/`, `service/collector/mongoDB_csvCreate.py`, all of `service/models/src/*.py` + `service/models/train_model.py`, `docs_sahil/`.

**Research question that could be studied:** how does class-imbalance handling strategy (drop-rare vs. SMOTE-variants vs. multi-stage) affect macro recall for tree-ensemble NIDS classification on UNSW-NB15, and does that generalize to a deep model?

**Experiments that already exist (as code, unverified numerically):** all 5 in §34.
**Experiments that are missing:** saved/reproducible metrics for any of them; cross-dataset generalization; any hyperparameter-search documentation (hyperparameters appear hand-set, not tuned via a logged search).
**Dataset(s):** UNSW-NB15 only (real); NSL-KDD/CICIDS2017 are aspirational.
**Evaluation metrics available in code:** accuracy, precision/recall/F1 (macro, micro, weighted), confusion matrix, balanced accuracy.
**Possible figures/tables:** class-imbalance-strategy comparison table (if re-run and logged); confusion matrix for the final model; feature-importance bar chart; per-class recall bar chart.
**Possible research contribution:** an honestly-reported, reproducible comparison of imbalance-handling strategies for ensemble NIDS on UNSW-NB15 — modest but legitimate, *contingent on actually saving and re-verifying the numbers*, since right now none of them are independently checkable.

## 38. Preliminary Part 2 Scope (Post-ML/DL System)

**Technical scope:** the serving loop (Express + MongoDB + Python bridge), the React dashboard, and — separately and clearly labeled as *not implemented* — the proposed production architecture (FastAPI, Redis, PostgreSQL, SHAP/LIME, SOAR-lite, Docker, monitoring).

**Modules included:** `service/api/`, `service/dashboard/`, `service/automation/` (empty), `infra/` (empty), `tests/` (empty of actual tests), the relevant planning docs.

**Research question that could potentially be studied:** honestly, as it stands, there isn't yet a technical research question here that current code can answer — the only defensible framing is a systems/engineering description of the sandbox prototype plus a clearly-labeled proposed architecture (mirroring exactly what the uploaded IEEE paper already does at the conceptual level, but now grounded in a small working prototype instead of pure literature synthesis).

**Experiments that already exist:** none beyond "the loop runs."
**Experiments that are missing:** everything in §35 that relates to the system layer (throughput, latency, alert-loss, SHAP latency once implemented, SOAR safety testing once implemented).
**Datasets:** the same 1,000-row UNSW-NB15 sample, replayed.
**Evaluation metrics:** none currently measured (only targets exist in docs).
**Possible figures/tables:** an architecture diagram contrasting proposed vs. actual (this audit's §5/§6/§28 material, essentially); a sequence diagram of the actual polling loop.
**Possible research contribution:** currently thin. **Honest recommendation (see §39):** Part 2, as it stands, does not yet contain enough distinct, evaluated technical material to stand alone as a second paper's core contribution. It could support a paper if the team implements and measures at least one of {SHAP/LIME integration, SOAR-lite with safety evaluation, a real live-capture pipeline} before writing — otherwise it risks being a repackaging of the proposed-architecture material that's already covered by the uploaded reference paper.

---

## 39. Open Questions / Missing Information

1. Whether the repository's `.github/` directory contains any CI workflow — not conclusively confirmed either way from the retrieved top-level listing.
2. Whether the trained model artifacts (`.pkl`/`.h5` files) exist somewhere outside the repo (e.g., on a team member's machine or in a cloud bucket) that could be used to independently re-verify the reported 89.75%/81.58% figures.
3. Whether `docs_sahil/ml.md`'s dataset statistics (exact per-class counts) match the committed CSVs — not recomputed in this audit.
4. Whether `predict_pipeline.py`'s apparent missing feature-selection step (§33) is a genuine bug or whether it's simply dead/unused code that predates `train_from_scratch.py`'s feature selector being introduced.
5. Whether the `.github/workflows` CI claims in `documentation/03_implementation_plan.md` were ever actually created and later removed, or never created at all — the git history was not examined (only the current tree state), so this can't be distinguished.
6. What, if anything, is in `globalPrompt.txt` (gitignored, never seen) — likely not a project deliverable, but its existence and exclusion is worth confirming with the team.
7. Whether the "himanshusalve16" GitHub account is confirmed (vs. inferred) to belong to a co-author of the uploaded IEEE paper — see §1.

---

## 40. Repository Evidence Index

Key files consulted during this audit, by section relevance:

- `README.md`, `run_guide.md`, `requirements.txt`, `.gitignore` — top-level claims and config (§3–5)
- `documentation/01_project_overview.md` through `10_future_work_and_risks.md` — full planned design (§5–7, §33)
- `documentation/packet_pipeline_part1_overview.md` through `part4_dashboard_implementation.md`, `packet_pipeline_solutions.md`, `testing_using_mongodb.md` — the team's own beginner-oriented pipeline tutorials, including an explicit "not built yet" table (§11, §21)
- `himanshu-docs/master_synthesis_document.md` — team-authored planned-vs-actual audit and literature synthesis (§2, §15–18, §34, §36)
- `docs_sahil/method.md`, `docs_sahil/ml.md` — the ML experiment narrative and headline metrics (§15, §18, §34)
- `others/Project_Synopsis.md` — synopsis/pitch document with architecture, budget, timeline (§1–6)
- `others/installation_guide_and_cmds.txt`, `others/youtube_links.txt` — learning-resource notes, minimal relevance
- `service/api/src/server.js`, `service/api/package.json`, `service/api/.env.example` — backend implementation (§9, §20, §27)
- `service/collector/mongoDB_csvCreate.py` — data-sampling script (§11)
- `service/models/src/*.py` (9 files), `service/models/train_model.py` — all ML/DL implementation (§13–18, §33)
- `service/dashboard/src/App.jsx`, `src/components/*.jsx`, `src/index.css`, `src/main.jsx`, plus leftover `src/main.ts`/`counter.ts`/`style.css` — frontend implementation (§8)
- `service/dashboard/package.json` — confirms no Chart.js/D3/axios/TypeScript app logic (§5, §8)
- `data/UNSW_NB15_training-set.csv`, `data/UNSW_NB15_testing-set.csv` — dataset presence confirmed (not opened/parsed) (§12)
- Directory listings confirming emptiness of `service/automation/`, `service/preproc/`, `service/mobile/`, `infra/`, `notebooks/`, `experiments/`, `tests/` (besides the CSV fixture) — (§24, §14, §25, §26)
- `literature/literature survey/*.pdf`, `literature/research papers/*.pdf` (25 files) — presence confirmed, not opened (context only, §36)
- `project evaluation/*.pdf` (2 files) — presence confirmed, not opened

**Not opened in this audit (large binaries / out of scope for this pass):** `documentation/Flowchart.png`, `others/SNORT Tutorial.mp4`, `others/Synopsis points.png`, all 27 literature/evaluation PDFs, `service/dashboard/src/assets/*`. None of these were required to reach the conclusions above; they can be pulled in a follow-up pass if the diagrams or evaluation-committee feedback become relevant to the papers.
