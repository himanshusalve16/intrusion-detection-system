# 02 — Technology Stack & Architecture

## 1. Detailed Architecture

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              IDPS Platform                                  │
│                                                                             │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────────┐    │
│  │  Collector  │──▶│ Preprocessor│──▶│  ML Engine  │──▶│  Backend API   │   │
│  │  Service    │   │  Service    │   │  Service    │   │  (FastAPI)     │   │
│  └────────────┘   └────────────┘   └────────────┘   └───┬──────┬─────┘   │
│        ▲                                                  │      │         │
│        │                                          ┌───────┘      └──────┐  │
│   Network TAP                                     ▼                     ▼  │
│   / Mirror Port                          ┌──────────────┐   ┌──────────┐  │
│                                          │  Dashboard    │   │ Alerting │  │
│                                          │  (React +     │   │ Service  │  │
│                                          │   Chart.js)   │   │ (Email / │  │
│                                          └──────────────┘   │  Slack / │  │
│                                                             │  Push)   │  │
│                                                             └────┬─────┘  │
│                                                                  │        │
│                                                                  ▼        │
│                                                          ┌──────────────┐ │
│                                                          │ SOAR-lite    │ │
│                                                          │ Policy       │ │
│                                                          │ Engine       │ │
│                                                          └──────────────┘ │
│                                                                           │
│  ┌──────────────────────────┐   ┌──────────────────────────────────────┐  │
│  │  Prometheus + Grafana    │   │  PostgreSQL / MongoDB + Redis        │  │
│  │  (System Monitoring)     │   │  (Persistent Storage & Cache)        │  │
│  └──────────────────────────┘   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Diagram

```
Network Traffic
      │
      ▼
┌─────────────┐  raw pcap   ┌─────────────┐  flow CSV    ┌─────────────┐
│  tcpdump /   │────────────▶│  CICFlowMeter│────────────▶│  Feature     │
│  tshark /    │             │  / Custom     │             │  Selection & │
│  Zeek        │             │  Parser       │             │  Scaling     │
└─────────────┘             └─────────────┘              └──────┬──────┘
                                                                │
                                                    feature vectors (numpy)
                                                                │
                    ┌───────────────────────────────────────────┤
                    ▼                                           ▼
           ┌──────────────┐                          ┌──────────────┐
           │  Baseline     │                          │  Advanced     │
           │  Models       │                          │  Models       │
           │  (RF/XGBoost) │                          │  (LSTM/AE)    │
           └──────┬───────┘                          └──────┬───────┘
                  │                                         │
                  └──────────────┬──────────────────────────┘
                                 │  prediction + confidence
                                 ▼
                       ┌──────────────────┐
                       │  SHAP / LIME      │
                       │  Explainer        │
                       └────────┬─────────┘
                                │  explanation payload
                                ▼
                       ┌──────────────────┐
                       │  FastAPI Backend  │──▶ WebSocket ──▶ React Dashboard
                       │                  │──▶ REST API  ──▶ Mobile Client
                       │                  │──▶ Alert Bus ──▶ Email/Slack/Push
                       └────────┬─────────┘
                                │ trigger
                                ▼
                       ┌──────────────────┐
                       │  SOAR-lite        │
                       │  (Policy Engine)  │──▶ iptables (demo mode)
                       │                  │──▶ Suricata rule reload
                       │                  │──▶ Audit log
                       └──────────────────┘
```

---

## 2. Technology Stack

### 2.1 Summary Table

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **OS** | Ubuntu 22.04 LTS | Development & deployment host |
| **Data Collection** | `tcpdump`, `tshark`, Zeek (Bro) | Raw packet capture, flow generation |
| **Flow Generation** | CICFlowMeter, custom Python scripts | Convert pcap → bidirectional flow features |
| **Processing & ML** | Python 3.10+, Pandas, NumPy, scikit-learn, XGBoost, PyTorch | Feature engineering, classical ML, deep learning |
| **Explainability** | SHAP, LIME | Per-alert feature-importance explanations |
| **Notebooks** | Jupyter Lab | Exploratory analysis, prototyping |
| **Backend API** | FastAPI (Python), Uvicorn, Pydantic | REST + WebSocket API serving predictions/alerts |
| **Database** | PostgreSQL | Alert storage, user management, audit logs |
| **Cache / Queue** | Redis | Real-time alert pub/sub, model prediction cache |
| **Dashboard** | React 18, Chart.js, D3.js | Real-time monitoring UI with SHAP visualizations |
| **Alerting** | SMTP (SendGrid), Slack Webhook, Firebase Cloud Messaging | Multi-channel alert delivery |
| **Prevention** | iptables (via subprocess), NFQUEUE, Suricata rule API | Automated blocking/quarantine (demo mode) |
| **Containerization** | Docker, Docker Compose | Service isolation, reproducible builds |
| **Orchestration** | Docker Compose (dev), Kubernetes / K3s (optional prod) | Multi-container management |
| **CI/CD** | GitHub Actions | Automated testing, linting, Docker image building |
| **Monitoring** | Prometheus, Grafana | System and application metrics |
| **Logging** | Python `logging`, structured JSON logs | Centralized log collection |
| **Model Versioning** | MLflow (lightweight), Git LFS for model artifacts | Experiment tracking, model registry |
| **Version Control** | Git, GitHub | Source code and collaboration |

### 2.2 Detailed Choices & Rationale

**FastAPI over Flask/Django:**
- Async-native (important for real-time WebSocket streaming of alerts).
- Built-in OpenAPI/Swagger doc generation.
- Pydantic for request/response validation.
- Excellent performance (Uvicorn/ASGI).

**React + Chart.js / D3 over Grafana/Kibana:**
- Full control over SHAP visualization components.
- Custom alert interaction workflows (approve/rollback buttons).
- Better UX for the SOAR-lite approval gate.
- Grafana/Kibana are still used for system monitoring (Prometheus → Grafana) but not for the primary operator dashboard.

**PostgreSQL over MongoDB:**
- Structured alert schema with relational queries (join alerts with actions/rollbacks).
- ACID transactions for audit log integrity.
- JSON columns available for semi-structured SHAP payloads.

**Redis:**
- Real-time alert pub/sub (backend → dashboard WebSocket).
- Caching recent model predictions for deduplication.

---

## 3. Protocols & Telemetry Sources

| Protocol / Format | Usage |
|-------------------|-------|
| **PCAP** | Raw packet capture from network TAP via `tcpdump`/`tshark` |
| **Zeek Logs** | Structured conn.log, http.log, dns.log, ssl.log for flow-level features |
| **NetFlow v5/v9** (optional) | Router-exported flow summaries if available |
| **IPFIX** (optional) | Extended flow records from compatible switches |
| **CSV / Parquet** | Preprocessed feature files for training & batch inference |
| **JSON** | Alert payloads, SHAP explanations, API request/response |
| **WebSocket** | Real-time alert streaming from backend to dashboard |
| **HTTP/REST** | Dashboard ↔ API communication, Slack webhook |
| **SMTP** | Email alert delivery |

### Telemetry sources

1. **Network mirror port / TAP** — primary source of raw traffic.
2. **Zeek sensor** — generates structured logs from raw packets.
3. **Benchmark datasets** (NSL-KDD, CICIDS2017, UNSW-NB15) — for training and evaluation.
4. **Prometheus node exporter** — system metrics (CPU, memory, network I/O) of the IDPS host.

---

## 4. Data Retention & Storage

| Data Type | Storage | Retention |
|-----------|---------|-----------|
| Raw pcap files | Local disk (`/data/raw/`) | 7 days rolling (disk space dependent) |
| Preprocessed flow CSVs | Local disk (`/data/processed/`) | Indefinite (for reproducibility) |
| Trained models | `/src/models/saved/` + MLflow | All versions kept |
| Alerts | PostgreSQL `alerts` table | 90 days (configurable) |
| SHAP explanations | PostgreSQL JSON column on alerts | Same as alerts |
| Remediation audit log | PostgreSQL `remediation_log` table | Indefinite (compliance) |
| System metrics | Prometheus TSDB | 30 days (configurable) |
| Application logs | Structured JSON files → optional ELK | 30 days |

---

## 5. Security Assumptions

1. **Trusted sensor host:** The machine running the IDPS is assumed to be hardened (minimal services, updated, SSH key-only access).
2. **Network access:** The sensor can see all relevant traffic via a mirror port or TAP; it is not inline (fail-open).
3. **API authentication:** The FastAPI backend requires JWT authentication for all endpoints. Dashboard sessions are token-based.
4. **Prevention safety:** All blocking actions (iptables rules) are gated behind demo-mode flag. In demo mode, actions are logged but not executed.
5. **Data confidentiality:** Packet payloads are not stored beyond feature extraction. Only flow metadata persists.
6. **Internal communication:** Services communicate over a Docker bridge network (not exposed to external network). Inter-service traffic is plaintext within the Docker network; external-facing endpoints (dashboard, API) are behind HTTPS (nginx reverse proxy with TLS).
7. **No PII:** The system does not store personally identifiable information. IP addresses in alerts are internal/lab addresses.

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
