# 03 — Implementation Plan

## 1. Module Breakdown

The system is organized into the following modules, each mapped to a directory under `src/`.

| Module | Directory | Language | Description |
|--------|-----------|----------|-------------|
| Collector | `src/collector/` | Python | Captures raw network traffic (pcap) and Zeek logs; streams to preprocessor |
| Preprocessor | `src/preproc/` | Python | Extracts flow features, scales/encodes, produces feature vectors |
| ML Engine | `src/models/` | Python | Trains, evaluates, and serves ML/DL models; generates SHAP explanations |
| Backend API | `src/api/` | Python (FastAPI) | REST + WebSocket API; orchestrates detection pipeline; manages alerts |
| Dashboard | `src/dashboard/` | TypeScript (React) | Real-time monitoring UI with SHAP visualizations and SOAR controls |
| Mobile Client | `src/mobile/` | React Native (optional) | Push notification receiver for alerts |
| Automation / SOAR-lite | `src/automation/` | Python + Bash | Policy engine for automated remediation (iptables, Suricata rules) |

Supporting directories:

| Directory | Purpose |
|-----------|---------|
| `data/` | Raw pcap, processed CSVs, dataset downloads |
| `notebooks/` | Jupyter notebooks for EDA, prototyping, and result visualization |
| `infra/` | Dockerfiles, docker-compose.yml, K8s manifests, nginx configs |
| `experiments/` | Training logs, metrics CSVs, MLflow artifacts |
| `tests/` | Unit and integration tests |

---

## 2. Module Details

### 2.1 Collector (`src/collector/`)

**Purpose:** Capture network traffic and produce structured logs.

**Main files:**

| File | Description |
|------|-------------|
| `capture.py` | Wrapper around `tcpdump`/`tshark` to capture pcap files in rotating fashion |
| `zeek_runner.py` | Starts Zeek in live or offline mode, reads conn.log/http.log/dns.log |
| `flow_streamer.py` | Reads Zeek logs or CICFlowMeter output, pushes to Redis queue for preprocessor |
| `config.py` | Interface name, capture filter (BPF), rotation settings, output paths |

**Key classes/functions:**

```python
class PacketCapture:
    def start(self, interface: str, bpf_filter: str, output_dir: str) -> None
    def stop(self) -> None
    def rotate(self, max_size_mb: int, max_files: int) -> None

class ZeekLogParser:
    def parse_conn_log(self, path: str) -> pd.DataFrame
    def parse_http_log(self, path: str) -> pd.DataFrame
    def stream_to_redis(self, redis_client, channel: str) -> None
```

**Acceptance criteria:**
- [ ] Captures pcap from a specified interface with BPF filter.
- [ ] Parses Zeek conn.log into a pandas DataFrame with correct dtypes.
- [ ] Streams parsed flow records to Redis within 2 seconds of log write.
- [ ] Handles log rotation without data loss.

---

### 2.2 Preprocessor (`src/preproc/`)

**Purpose:** Transform raw flow data into ML-ready feature vectors.

**Main files:**

| File | Description |
|------|-------------|
| `feature_extractor.py` | Computes flow-level features (duration, packet count, byte count, protocol flags, inter-arrival times, etc.) |
| `encoder.py` | Label encoding for categorical features (protocol, service, flag) |
| `scaler.py` | Fit/transform StandardScaler or MinMaxScaler; serialized for inference |
| `pipeline.py` | Orchestrates extraction → encoding → scaling; supports batch and streaming modes |
| `dataset_loader.py` | Loads and standardizes NSL-KDD, CICIDS2017, UNSW-NB15 into common schema |

**Key classes/functions:**

```python
class FeatureExtractor:
    def extract(self, raw_df: pd.DataFrame) -> pd.DataFrame
    # Returns DataFrame with ~40-80 flow features

class PreprocessingPipeline:
    def fit(self, train_df: pd.DataFrame) -> None
    def transform(self, df: pd.DataFrame) -> np.ndarray
    def save(self, path: str) -> None
    def load(self, path: str) -> None

def load_nslkdd(path: str) -> Tuple[pd.DataFrame, pd.Series]
def load_cicids2017(path: str) -> Tuple[pd.DataFrame, pd.Series]
def load_unswnb15(path: str) -> Tuple[pd.DataFrame, pd.Series]
```

**Data schema (common flow format):**

```
flow_id         : str       # unique flow identifier
src_ip          : str       # source IP (anonymized in storage)
dst_ip          : str       # destination IP
src_port        : int
dst_port        : int
protocol        : int       # TCP=6, UDP=17, ICMP=1
timestamp       : datetime
duration        : float     # seconds
total_fwd_pkts  : int
total_bwd_pkts  : int
total_fwd_bytes : int
total_bwd_bytes : int
fwd_pkt_len_mean: float
bwd_pkt_len_mean: float
flow_iat_mean   : float     # inter-arrival time
flow_iat_std    : float
fwd_psh_flags   : int
syn_flag_count  : int
rst_flag_count  : int
ack_flag_count  : int
...                         # ~40-80 features total
label           : str       # BENIGN, DoS, Probe, R2L, U2R, etc.
```

**Acceptance criteria:**
- [ ] Produces identical feature vectors for the same input data (deterministic).
- [ ] Handles missing values (NaN imputation or drop with logging).
- [ ] Scaler can be saved/loaded for inference consistency.
- [ ] Dataset loaders produce common schema from all 3 benchmark datasets.

---

### 2.3 ML Engine (`src/models/`)

**Purpose:** Train, evaluate, and serve detection models; produce SHAP explanations.

**Main files:**

| File | Description |
|------|-------------|
| `train.py` | Training script — model selection, hyperparameter search, cross-validation |
| `evaluate.py` | Evaluation: metrics computation, confusion matrix, per-class report |
| `models/random_forest.py` | RF wrapper (scikit-learn) |
| `models/xgboost_model.py` | XGBoost wrapper |
| `models/lstm_model.py` | LSTM model (PyTorch) for sequential flow data |
| `models/autoencoder.py` | Autoencoder for anomaly detection (PyTorch) |
| `explain.py` | SHAP/LIME explanation generator |
| `predict.py` | Inference module: load model + scaler, predict on new data, return explanation |
| `config.py` | Hyperparameters, model paths, random seeds |

**Key classes/functions:**

```python
class BaseDetector(ABC):
    def train(self, X_train, y_train, **kwargs) -> None
    def predict(self, X: np.ndarray) -> np.ndarray
    def predict_proba(self, X: np.ndarray) -> np.ndarray
    def save(self, path: str) -> None
    def load(self, path: str) -> None

class RandomForestDetector(BaseDetector): ...
class XGBoostDetector(BaseDetector): ...
class LSTMDetector(BaseDetector): ...
class AutoencoderDetector(BaseDetector): ...

class Explainer:
    def __init__(self, model: BaseDetector, method: str = "shap")
    def explain(self, X: np.ndarray) -> dict
    # Returns: {"feature_importances": [...], "shap_values": [...], "plot_data": {...}}

def run_training(config: dict) -> dict:
    """End-to-end: load data → preprocess → train → evaluate → save model + metrics."""

def run_inference(model_path: str, scaler_path: str, input_data: np.ndarray) -> dict:
    """Load model, predict, explain, return structured result."""
```

**Model training pipeline (CLI):**

```bash
python -m src.models.train \
    --dataset cicids2017 \
    --model xgboost \
    --output experiments/xgboost_cicids2017/ \
    --seed 42 \
    --cv-folds 5
```

**Acceptance criteria:**
- [ ] All 4 model types train without error on all 3 datasets.
- [ ] Evaluation script produces precision, recall, F1, AUC, confusion matrix, per-class report.
- [ ] SHAP explanations generate in < 5 seconds per sample (for tree models).
- [ ] Models save/load correctly and produce identical predictions after reload.
- [ ] Fixed random seed produces reproducible results.

---

### 2.4 Backend API (`src/api/`)

**Purpose:** Serve REST endpoints and WebSocket streams for the dashboard and external integrations.

**Main files:**

| File | Description |
|------|-------------|
| `main.py` | FastAPI app entry point, middleware, CORS |
| `routes/alerts.py` | GET/POST alerts, alert detail with SHAP explanation |
| `routes/models.py` | Model status, switch active model, retrain trigger |
| `routes/actions.py` | SOAR-lite: list actions, approve, rollback |
| `routes/auth.py` | JWT login, token refresh |
| `routes/metrics.py` | System metrics, model performance stats |
| `ws/alert_stream.py` | WebSocket endpoint streaming real-time alerts |
| `services/detection.py` | Orchestrates: receive flow → predict → explain → store alert → notify |
| `services/alerting.py` | Email/Slack/Push notification dispatch |
| `models/schemas.py` | Pydantic models for request/response validation |
| `db/database.py` | SQLAlchemy/asyncpg PostgreSQL connection |
| `db/models.py` | ORM models: Alert, Action, User |
| `config.py` | Environment-based configuration (dotenv) |

**Key API endpoints (see `07_api_and_user_manual.md` for full spec):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Authenticate user, return JWT |
| GET | `/api/v1/alerts` | List alerts (paginated, filterable) |
| GET | `/api/v1/alerts/{id}` | Alert detail + SHAP explanation |
| POST | `/api/v1/alerts/{id}/acknowledge` | Mark alert as acknowledged |
| GET | `/api/v1/actions` | List pending/executed remediation actions |
| POST | `/api/v1/actions/{id}/approve` | Approve a pending remediation action |
| POST | `/api/v1/actions/{id}/rollback` | Rollback an executed action |
| GET | `/api/v1/models/status` | Active model info and performance |
| POST | `/api/v1/detect` | Submit flow data for on-demand detection |
| WS | `/ws/alerts` | Real-time alert stream |

**Acceptance criteria:**
- [ ] All endpoints return correct HTTP status codes and Pydantic-validated responses.
- [ ] JWT authentication enforced on all non-public endpoints.
- [ ] WebSocket streams alerts within 1 second of detection.
- [ ] Alert creation stores SHAP explanation payload in PostgreSQL.
- [ ] Alerting service sends email/Slack notification within 5 seconds.

---

### 2.5 Dashboard (`src/dashboard/`)

**Purpose:** Real-time monitoring, alert inspection with SHAP visuals, and SOAR-lite control panel.

**Main files/components:**

| File/Component | Description |
|----------------|-------------|
| `src/App.tsx` | Main app layout, routing |
| `src/pages/Dashboard.tsx` | Overview: alert count, severity distribution, timeline chart |
| `src/pages/Alerts.tsx` | Alert list with filters (severity, type, time range) |
| `src/pages/AlertDetail.tsx` | Single alert: metadata, SHAP force plot, feature table |
| `src/pages/Models.tsx` | Model performance comparison charts |
| `src/pages/Actions.tsx` | SOAR-lite: pending actions, approve/rollback buttons |
| `src/pages/Settings.tsx` | User prefs, notification settings, demo mode toggle |
| `src/components/ShapChart.tsx` | D3-based SHAP waterfall/force plot component |
| `src/components/AlertTimeline.tsx` | Chart.js time-series of alerts |
| `src/hooks/useAlertStream.ts` | WebSocket hook for real-time alerts |
| `src/services/api.ts` | Axios-based API client with JWT interceptor |

**Acceptance criteria:**
- [ ] Dashboard loads in < 3 seconds.
- [ ] Real-time alerts appear within 2 seconds via WebSocket.
- [ ] SHAP force plot renders correctly for each alert.
- [ ] Approve/rollback actions work end-to-end.
- [ ] Responsive design (desktop + tablet).

---

### 2.6 Automation / SOAR-lite (`src/automation/`)

**Purpose:** Map alerts to safe remediation actions; execute in demo or live mode.

**Main files:**

| File | Description |
|------|-------------|
| `policy_engine.py` | Maps alert type + severity to action templates |
| `actions/iptables_action.py` | Add/remove iptables rules to block/unblock IPs |
| `actions/suricata_action.py` | Deploy/remove Suricata detection rules |
| `actions/quarantine_action.py` | Isolate host by restricting its network access |
| `executor.py` | Executes actions (real or simulated based on demo mode flag) |
| `rollback.py` | Reverts the last N actions for a given alert/IP |
| `audit_log.py` | Writes immutable audit records to PostgreSQL |
| `config.py` | Demo mode flag, action templates, approval settings |

**Key classes:**

```python
class PolicyEngine:
    def evaluate(self, alert: Alert) -> Optional[RemediationAction]

class ActionExecutor:
    def __init__(self, demo_mode: bool = True)
    def execute(self, action: RemediationAction) -> ActionResult
    def rollback(self, action_id: str) -> ActionResult

@dataclass
class RemediationAction:
    action_type: str          # "block_ip", "quarantine_host", "rate_limit", "suricata_rule"
    target: str               # IP address or host identifier
    alert_id: str
    severity: str
    requires_approval: bool   # True for high-severity actions
    command: str              # Actual command (e.g., "iptables -A INPUT -s X -j DROP")
    rollback_command: str     # Reverse command (e.g., "iptables -D INPUT -s X -j DROP")
```

**Acceptance criteria:**
- [ ] In demo mode, actions are logged but NOT executed on the system.
- [ ] In live mode, iptables rules are applied and verifiable.
- [ ] Rollback restores previous state (verified via `iptables -L`).
- [ ] All actions recorded in audit log with timestamp, operator, and outcome.
- [ ] High-severity actions require human approval before execution.

---

## 3. Data Schemas

### 3.1 PostgreSQL Tables

```sql
-- Alerts table
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id         VARCHAR(64),
    src_ip          VARCHAR(45),
    dst_ip          VARCHAR(45),
    src_port        INTEGER,
    dst_port        INTEGER,
    protocol        INTEGER,
    attack_type     VARCHAR(64),
    severity        VARCHAR(16),     -- low, medium, high, critical
    confidence      FLOAT,
    model_name      VARCHAR(64),
    shap_explanation JSONB,          -- SHAP values and feature importances
    status          VARCHAR(16) DEFAULT 'open',  -- open, acknowledged, resolved
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Remediation actions table
CREATE TABLE remediation_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID REFERENCES alerts(id),
    action_type     VARCHAR(32),
    target          VARCHAR(128),
    command         TEXT,
    rollback_command TEXT,
    status          VARCHAR(16) DEFAULT 'pending',  -- pending, approved, executed, rolled_back, failed
    demo_mode       BOOLEAN DEFAULT TRUE,
    approved_by     VARCHAR(64),
    executed_at     TIMESTAMP,
    rolled_back_at  TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(256) NOT NULL,
    role            VARCHAR(16) DEFAULT 'operator',  -- admin, operator, viewer
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    action_id       UUID REFERENCES remediation_actions(id),
    event_type      VARCHAR(32),   -- action_created, approved, executed, rolled_back
    details         JSONB,
    performed_by    VARCHAR(64),
    timestamp       TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Redis Channels

| Channel | Payload | Purpose |
|---------|---------|---------|
| `flows:raw` | JSON flow record | Collector → Preprocessor |
| `alerts:new` | JSON alert object | Backend → Dashboard (WebSocket bridge) |
| `actions:pending` | JSON action object | Policy Engine → Dashboard |

---

## 4. CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.10" }
      - run: pip install ruff
      - run: ruff check src/ tests/

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: idps_test }
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.10" }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest tests/ -v --cov=src --cov-report=xml

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build

  dashboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: cd src/dashboard && npm ci && npm run lint && npm test && npm run build
```

---

## 5. Containerization

Each service has its own Dockerfile in `infra/`:

| Service | Dockerfile | Base Image |
|---------|-----------|------------|
| API + ML Engine | `infra/Dockerfile.api` | `python:3.10-slim` |
| Collector | `infra/Dockerfile.collector` | `python:3.10-slim` + tcpdump + zeek |
| Dashboard | `infra/Dockerfile.dashboard` | `node:20-alpine` (build) → `nginx:alpine` (serve) |
| Automation | `infra/Dockerfile.automation` | `python:3.10-slim` + iptables |

Orchestrated via `infra/docker-compose.yml` (see `06_deployment_and_ops.md`).

---

## 6. Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `scripts/download_datasets.sh` | `data/` | Downloads NSL-KDD, CICIDS2017, UNSW-NB15 |
| `scripts/setup_dev.sh` | root | Installs Python deps, Node deps, creates .env |
| `scripts/train_all.sh` | root | Runs training for all model × dataset combinations |
| `scripts/seed_db.sh` | root | Creates DB tables and seeds test data |

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
