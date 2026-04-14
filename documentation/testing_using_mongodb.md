# Testing IDS Using MongoDB (Beginner Guide)

## 1. What This Setup Does

This test setup simulates live traffic by reading one record every 1 second from MongoDB, sending it to the primary model pipeline (from train_from_scratch.py artifacts), and showing alerts in a live React dashboard when the prediction is not Normal.

You now have:

- Express test server in `service/api`
- MongoDB collection loader from CSV
- Python prediction worker that loads trained artifacts
- Rebalanced live test CSV (80% Normal, 20% Attack)
- **Sentinel React Dashboard** in `service/dashboard` (Live UI)

---

## 2. Files Added/Updated

### API side (Backend)

- service/api/package.json
- service/api/package-lock.json
- service/api/.env.example
- service/api/src/server.js

### Dashboard side (Frontend)

- service/dashboard/src/App.jsx
- service/dashboard/src/index.css
- service/dashboard/src/components/ (Header, StatsWidget, etc.)

### Model bridge

- service/models/src/live_predictor_worker.py

### Dataset generator

- service/collector/mongoDB_csvCreate.py

### Test data

- tests/live_test_dataset.csv

---

## 3. End-to-End Data Flow

1. CSV generator creates tests/live_test_dataset.csv with desired class balance.
2. Express server connects to MongoDB database IDPS.
3. Server truncates collection live_test_dataset when RELOAD_CSV=true.
4. Server loads CSV rows into MongoDB with internal _sampleIndex.
5. Every 1 second, server reads one row by _sampleIndex.
6. Row is sent to Python worker through stdin (JSON).
7. Python worker preprocesses row and runs ensemble prediction using artifacts from service/models/artifacts.
8. If prediction is not Normal, server prints an alert with label and confidence.
9. If prediction is Normal, no alert is printed.

---

## 4. Why Alerts Were Too Many Earlier

Earlier, the live dataset had too many attack records. That naturally produced many alerts.

Fixes applied:

- Dataset ratio updated from attack-heavy to 80% Normal, 20% Attack.
- Poll loop lock added to prevent overlapping polling calls and duplicate alerts.

---

## 5. Class Balance Logic Used

Total test samples: 1000

- Normal: 800 (80%)
- Attack total: 200 (20%)

Attack 200 is split as:

- Generic: 50
- DoS: 50
- Fuzzers: 50
- Other attacks (Exploits + Reconnaissance etc.): 50

This gives realistic traffic where benign events dominate.

---

## 6. Confidence Meaning (Very Important)

Confidence in logs is the model's probability score for the predicted class.

Example:

- prediction=Exploits, confidence=0.97 means model is highly sure.
- prediction=DoS, confidence=0.52 means model is uncertain.

In this pipeline, confidence comes from soft-voting ensemble probability:

- XGBoost predict_proba
- RandomForest predict_proba
- LightGBM predict_proba
- Average of three probabilities
- Highest probability class is chosen

### Practical significance

- High confidence: usually stronger evidence.
- Low confidence: ambiguous sample, good candidate for manual review.
- You can later add threshold rules (for example, alert only if confidence >= 0.70).

---

## 7. Setup Steps (Run from Repo Root)

## Step A: Install API dependencies

```powershell
Set-Location "service/api"
npm install
```

## Step B: Configure environment

Create service/api/.env and set values:

```env
PORT=3001
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=IDPS
MONGODB_COLLECTION=live_test_dataset
CSV_PATH=
POLL_INTERVAL_MS=1000
PYTHON_CMD=python
PREDICTOR_SCRIPT=
RELOAD_CSV=false
```

Notes:

- Leave CSV_PATH blank to use default tests/live_test_dataset.csv.
- Leave PREDICTOR_SCRIPT blank to use default service/models/src/live_predictor_worker.py.

## Step C: Generate balanced test CSV (80:20)

```powershell
Set-Location "../.."
python .\service\collector\mongoDB_csvCreate.py
```

## Step D: Force MongoDB reload from CSV (truncate + insert)

```powershell
Set-Location "service/api"
$env:RELOAD_CSV='true'
npm start
```

After first successful load, stop server and run normal mode:

```powershell
$env:RELOAD_CSV='false'
npm start
```

## Step E: Start the Sentinel Dashboard (UI)

Open a **new** terminal window (so your API keeps running) and run:

```powershell
Set-Location "service/dashboard"
npm install
npm run dev
```

Visit **http://localhost:5173** in your browser to view the live threat telemetry!

---

## 8. API Endpoints for Quick Check

- GET /health
- GET /alerts
- POST /poll-once
- GET /config

Examples:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3001/health"
Invoke-RestMethod -Uri "http://127.0.0.1:3001/alerts"
Invoke-RestMethod -Uri "http://127.0.0.1:3001/poll-once" -Method Post
```

---

## 9. Common Troubleshooting

## Server starts but no alerts

- Dataset may have long Normal stretches.
- Call /poll-once multiple times.

## Too many alerts

- Verify CSV ratio by checking tests/live_test_dataset.csv distribution.
- Confirm RELOAD_CSV=true was used once to refresh MongoDB.

## MongoDB connection error

- Check MONGODB_URI.
- Ensure cluster allows your current IP.
- Ensure DB user/password is correct.

## Python model error

- Ensure artifacts exist in service/models/artifacts:
  - final_xgb.pkl
  - final_rf.pkl
  - final_lgbm.pkl
  - feature_selector.pkl
  - final_encoders.pkl
  - final_labels.pkl

---

## 10. Architecture Summary

Express server = orchestrator

- Handles MongoDB polling and API routes
- Sends each sample to Python worker

Python worker = model executor

- Loads trained models one time at startup
- Preprocesses each row
- Returns prediction + confidence

MongoDB = live stream source

- Stores CSV rows as test traffic stream
- _sampleIndex controls sequential playback

React Dashboard = User Interface

- Connects to API endpoints
- Displays glowing alerts and real-time stats visually

---

## 11. Suggested Next Improvement

Add confidence thresholding:

- Warning if confidence < 0.70
- High-priority alert if confidence >= 0.90

This reduces noisy alerts and improves operator trust.
