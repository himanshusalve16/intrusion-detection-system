# Packet Pipeline Documentation — Part 4: Monitoring, Dashboard & Implementation Steps

> **Prerequisite:** Read Parts [1](packet_pipeline_part1_overview.md), [2](packet_pipeline_part2_capture.md), and [3](packet_pipeline_part3_processing_ml.md) first.

---

## 1. How Alerts Flow to the Dashboard

Once the ML Engine produces a prediction that is NOT "Normal," an alert is born. Here's how it reaches the operator's screen:

```
ML Engine → "This is a DoS attack, 92% confidence"
     │
     ▼
Backend API (FastAPI)
     │
     ├──→ PostgreSQL: Store alert permanently (for history, audit, and search)
     │
     ├──→ Redis pub/sub (channel: alerts:new): Broadcast alert in real time
     │         │
     │         ▼
     │    WebSocket Server → pushes to all connected Dashboard browsers
     │
     ├──→ Alerting Service: Send email / Slack / push notification
     │
     └──→ SOAR-lite Policy Engine: Evaluate if automatic action is needed
```

### Why Two Paths (Database + Redis)?

- **PostgreSQL** is for **persistence** — the alert is saved forever (or until retention policy deletes it). You can search, filter, and analyze historical alerts.
- **Redis pub/sub** is for **real-time** — the alert appears on the dashboard instantly (< 1 second). Redis doesn't store data permanently; it just broadcasts it to whoever is listening.

---

## 2. The Dashboard — What It Shows

### 2.1 Current Dashboard (Sentinel)

The existing Sentinel dashboard (in `service/dashboard/`) already has:

| Component | What It Shows |
|-----------|---------------|
| **Header** | System name, connection status, live indicator |
| **Stats Widgets** | Total alerts, attack type breakdown, detection rate |
| **Alert Feed** | Scrolling list of recent alerts with type, confidence, timestamp |
| **Auto-Sync Toggle** | Enables/disables live polling from the API |

### 2.2 Planned Enhancements for the Full Pipeline

| Feature | Purpose | Technology |
|---------|---------|------------|
| **Alert Timeline Chart** | Visual time-series showing alert volume over time | Chart.js |
| **SHAP Force Plot** | Per-alert explanation showing which features caused the detection | D3.js |
| **Attack Distribution Pie/Bar** | Breakdown of attack types detected | Chart.js |
| **Confidence Histogram** | Distribution of confidence scores — helps identify uncertain detections | Chart.js |
| **SOAR Action Panel** | List of pending/executed automated actions with approve/rollback buttons | React components |
| **Live Connection Map** | Visualization of source→destination connections | D3.js force graph |
| **System Health Panel** | CPU, memory, packet rate of the IDPS host | Prometheus metrics |

### 2.3 WebSocket — Real-Time Updates

Instead of polling the API every second (current approach), the full pipeline will use **WebSocket** for true real-time:

```javascript
// Frontend: connect to WebSocket for live alerts
const ws = new WebSocket('ws://localhost:8000/ws/alerts');

ws.onmessage = (event) => {
    const alert = JSON.parse(event.data);
    // Add alert to the dashboard immediately
    addAlertToFeed(alert);
    updateStats(alert);
    if (alert.confidence >= 0.9) {
        playAlertSound();
        showHighPriorityBanner(alert);
    }
};
```

**Backend (FastAPI):**

```python
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

connected_clients = set()

@app.websocket("/ws/alerts")
async def alert_stream(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        connected_clients.discard(websocket)

async def broadcast_alert(alert: dict):
    """Send alert to all connected dashboard clients."""
    import json
    message = json.dumps(alert)
    for client in connected_clients.copy():
        try:
            await client.send_text(message)
        except:
            connected_clients.discard(client)
```

---

## 3. Monitoring the System Itself

The IDPS itself is a system that needs monitoring. If the Collector crashes or the ML Engine runs out of memory, we need to know.

### 3.1 Prometheus — Collecting Metrics

**Prometheus** scrapes metrics from your services at regular intervals and stores them as time-series data.

**Metrics we should expose:**

| Metric | Type | Meaning |
|--------|------|---------|
| `idps_flows_processed_total` | Counter | Total flow records processed |
| `idps_alerts_generated_total` | Counter | Total alerts created |
| `idps_prediction_latency_seconds` | Histogram | Time taken for each prediction |
| `idps_active_connections` | Gauge | Number of connections being tracked |
| `idps_model_memory_bytes` | Gauge | Memory used by loaded models |
| `idps_redis_queue_length` | Gauge | Number of flows waiting in Redis |

**Adding Prometheus to FastAPI:**

```python
from prometheus_client import Counter, Histogram, generate_latest
from fastapi.responses import Response

flows_processed = Counter('idps_flows_processed_total', 'Total flows processed')
alerts_generated = Counter('idps_alerts_generated_total', 'Total alerts generated')
prediction_latency = Histogram('idps_prediction_latency_seconds', 'Prediction latency')

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")
```

### 3.2 Grafana — Visualizing Metrics

**Grafana** connects to Prometheus and creates beautiful dashboards showing system health. Set up dashboards for:

1. **Pipeline Health** — Flows/sec processed, alerts/sec generated, Redis queue depth
2. **Model Performance** — Prediction latency, confidence distribution, attack type distribution
3. **System Resources** — CPU usage, memory usage, disk I/O, network I/O

### 3.3 DevOps & Infrastructure Layer (Docker Compose + Nginx)

To ensure the system is robust, secure, and production-ready, we deploy the entire stack using **Docker Compose**, orchestrated behind an **Nginx** reverse proxy.

```yaml
# Add to infra/docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    depends_on:
      - prometheus

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - api
      - dashboard
```

**Why Nginx?**
- Provides **TLS (SSL) termination**, encrypting traffic between the operator's browser and the dashboard.
- Acts as a reverse proxy, routing `/api/` traffic to FastAPI and `/` traffic to the React Dashboard.
- Load balances if we scale up the FastAPI backend.

**Prometheus config (prometheus.yml):**

```yaml
scrape_configs:
  - job_name: 'idps-api'
    scrape_interval: 5s
    static_configs:
      - targets: ['api:8000']
```

---

## 4. Temporary Dashboard vs. Production Dashboard

For now, the goal is a **temporary dashboard** that works for development and demo purposes. Here's the difference:

| Aspect | Temporary (Now) | Production (Later) |
|--------|-----------------|-------------------|
| Data source | MongoDB polling | WebSocket real-time stream |
| Authentication | None | JWT-based login |
| SHAP visualizations | Not implemented | D3.js force plots per alert |
| SOAR controls | Not implemented | Approve/rollback buttons |
| System monitoring | Not implemented | Prometheus + Grafana |
| Mobile alerts | Not implemented | Push notifications |
| Deployment | Local dev server | Docker containers + nginx |

**The temporary dashboard is already working and can be enhanced incrementally.**

---

## 5. Step-by-Step Implementation Checklist

This is the practical roadmap to move from the current temporary setup to the full pipeline.

### Phase 1 — Foundation (Weeks 1-2)

- [ ] **Set up Ubuntu 22.04 VM/machine** for the IDPS host
- [ ] **Install Zeek** following the instructions in Part 2
- [ ] **Install Redis** (`sudo apt install redis-server`)
- [ ] **Test Zeek** with a sample pcap file — verify conn.log is generated correctly
- [ ] **Write the Zeek Log Parser** that reads conn.log and pushes to Redis
- [ ] **Test Redis pub/sub** — publish a sample flow, subscribe and read it back

### Phase 2 — Preprocessor (Weeks 2-3)

- [ ] **Create the feature mapping table** (Zeek fields → UNSW-NB15 features)
- [ ] **Build the Feature Extractor** that converts Zeek records to feature dictionaries
- [ ] **Build the Connection Tracker** for window-based features
- [ ] **Integrate the saved encoders** (`final_encoders.pkl`) for categorical encoding
- [ ] **Integrate the saved feature selector** (`feature_selector.pkl`)
- [ ] **Test end-to-end**: Zeek pcap → Parser → Redis → Preprocessor → feature vector
- [ ] **Validate** that the feature vector shape matches what the trained models expect

### Phase 3 — ML Integration (Week 3)

- [ ] **Build the EnsemblePredictor class** that loads XGBoost + RF + LightGBM
- [ ] **Connect Preprocessor output to EnsemblePredictor** input
- [ ] **Test predictions** on known samples from the UNSW-NB15 test set — verify predictions match the training evaluation results
- [ ] **Add SHAP explanation** generation for each non-Normal prediction
- [ ] **Benchmark latency**: measure time from feature vector to prediction

### Phase 4 — Backend API Migration (Weeks 3-4)

- [ ] **Set up PostgreSQL** and create the alert tables (schema from `03_implementation_plan.md`)
- [ ] **Migrate from Express to FastAPI** (or keep Express as a gateway and add FastAPI alongside)
- [ ] **Create the /api/v1/detect endpoint** that receives alerts from the ML module
- [ ] **Create the WebSocket /ws/alerts endpoint** for real-time dashboard streaming
- [ ] **Connect Redis pub/sub** to the WebSocket broadcaster
- [ ] **Test**: Generate a flow → process → predict → store alert → see on API

### Phase 5 — Dashboard Enhancement (Week 4)

- [ ] **Switch dashboard from polling to WebSocket** for real-time updates
- [ ] **Add SHAP visualization component** (D3.js or a React SHAP library)
- [ ] **Add alert detail view** with feature breakdown and explanation
- [ ] **Add confidence threshold controls** (filter alerts by confidence level)
- [ ] **Test**: Full round-trip from Zeek to dashboard display

### Phase 6 — Monitoring & SOAR (Weeks 5-6)

- [ ] **Set up Prometheus** with the Docker Compose config above
- [ ] **Add /metrics endpoint** to the API
- [ ] **Set up Grafana** with pipeline health dashboard
- [ ] **Build the SOAR-lite Policy Engine** (demo mode)
- [ ] **Add approve/rollback buttons** to the dashboard
- [ ] **Integration test**: Full pipeline with monitoring, alerts, and SOAR actions

### Phase 7 — Live Network Testing (Week 6+)

- [ ] **Connect to a real network** (mirror port on lab switch or VM network)
- [ ] **Run Zeek on a live interface**
- [ ] **Observe full pipeline** in operation
- [ ] **Tune thresholds** based on real-world false positive rates
- [ ] **Document findings** and system performance

---

## 6. File Structure After Implementation

```
service/
├── collector/
│   ├── capture.py              # tcpdump wrapper for pcap archival
│   ├── zeek_runner.py          # Starts Zeek on a live interface
│   ├── zeek_log_parser.py      # Parses conn.log → Redis
│   ├── flow_streamer.py        # Continuous log watching service
│   └── config.py               # Interface, paths, rotation settings
│
├── preproc/
│   ├── feature_extractor.py    # Zeek → UNSW-NB15 feature mapping
│   ├── connection_tracker.py   # Window-based feature computation
│   ├── encoder.py              # Categorical encoding (loads saved encoders)
│   ├── scaler.py               # Feature scaling (loads saved scaler)
│   └── pipeline.py             # Orchestrates: extract → encode → scale → select
│
├── models/
│   ├── artifacts/              # Saved models and preprocessing artifacts
│   │   ├── final_xgb.pkl
│   │   ├── final_rf.pkl
│   │   ├── final_lgbm.pkl
│   │   ├── final_encoders.pkl
│   │   ├── final_labels.pkl
│   │   └── feature_selector.pkl
│   ├── src/
│   │   ├── ensemble_predictor.py   # Loads models, runs soft-vote ensemble
│   │   ├── explainer.py            # SHAP explanation generator
│   │   └── live_predictor_worker.py # (existing) stdin/stdout worker
│   └── train_model.py             # (existing) training script
│
├── api/
│   ├── src/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── routes/alerts.py    # Alert CRUD endpoints
│   │   ├── routes/detect.py    # Detection submission endpoint
│   │   ├── ws/alert_stream.py  # WebSocket real-time streaming
│   │   ├── services/detection.py  # Orchestration logic
│   │   └── db/models.py        # PostgreSQL ORM models
│   └── .env
│
├── dashboard/                  # Existing React dashboard (Sentinel)
│   └── src/
│       ├── App.jsx
│       ├── components/
│       └── hooks/useAlertStream.js  # NEW: WebSocket hook
│
└── automation/
    ├── policy_engine.py        # Maps alerts → actions
    ├── actions/iptables_action.py
    └── executor.py             # Runs actions in demo/live mode
```

---

## 7. Docker Compose — Full Pipeline

```yaml
# infra/docker-compose.yml
version: '3.8'

services:
  collector:
    build: ../service/collector
    network_mode: host          # Needs raw network access
    cap_add:
      - NET_RAW                 # Permission to capture packets
      - NET_ADMIN
    volumes:
      - ../data/raw:/data/raw   # Store pcap files
    depends_on:
      - redis

  preprocessor:
    build: ../service/preproc
    depends_on:
      - redis
    volumes:
      - ../service/models/artifacts:/app/artifacts  # Access to saved models

  ml-engine:
    build: ../service/models
    depends_on:
      - redis
    volumes:
      - ../service/models/artifacts:/app/artifacts

  api:
    build: ../service/api
    depends_on:
      - redis
      - postgres
    environment:
      - DATABASE_URL=postgresql://idps:password@postgres:5432/idps
      - REDIS_URL=redis://redis:6379

  dashboard:
    build: ../service/dashboard
    depends_on:
      - api

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../infra/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - api
      - dashboard

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=idps
      - POSTGRES_USER=idps
      - POSTGRES_PASSWORD=password
    volumes:
      - pgdata:/var/lib/postgresql/data

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    depends_on:
      - prometheus

volumes:
  pgdata:
```

---

## 8. What to Do Right Now — Practical Next Steps

Here's the priority order based on impact and difficulty:

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 **1** | Install Zeek on Ubuntu and test with pcap files | 1 day | Proves packet capture works |
| 🔴 **2** | Build Zeek Log Parser → Redis pipeline | 2 days | Connects capture to processing |
| 🔴 **3** | Build Feature Extractor with Zeek→UNSW-NB15 mapping | 3 days | Hardest part — makes ML possible |
| 🟡 **4** | Connect Feature Extractor to existing ML models | 1 day | Models already work, just need correct input |
| 🟡 **5** | Set up PostgreSQL and create alert tables | 1 day | Persistent alert storage |
| 🟡 **6** | Add WebSocket to dashboard | 1 day | Real-time display |
| 🟢 **7** | Add SHAP visualizations to dashboard | 2 days | Enhances explainability |
| 🟢 **8** | Set up Prometheus + Grafana | 1 day | System monitoring |
| 🟢 **9** | Build SOAR-lite demo mode | 2 days | Automated response capability |
| 🟢 **10** | Docker Compose for full pipeline | 2 days | One-command deployment |

**Total estimated effort: ~16 working days for a team of 4.**

---

## 9. Assumptions and Open Questions

| Item | Status | Notes |
|------|--------|-------|
| Ubuntu 22.04 is available | **Assumption** | Zeek and tcpdump work best on Linux |
| Network interface for capture | **Needs decision** | Which interface? Virtual or physical? |
| Redis is sufficient (vs. Kafka) | **Assumption** | Redis is simpler; Kafka is overkill unless >10K flows/sec |
| PostgreSQL over MongoDB for alerts | **Recommended** | Structured data with relational queries; MongoDB is fine too if team prefers |
| Window-based feature calculation | **Uncertain** | Exact window size needs experimentation (100s is a starting point) |
| Feature mapping completeness | **Needs validation** | Must verify every UNSW-NB15 feature can be derived from Zeek data |
| Model retraining on Zeek data | **May be needed** | If Zeek features don't match UNSW-NB15 exactly, models may need fine-tuning |

---

## 10. Glossary of Terms

| Term | Simple Meaning |
|------|---------------|
| **Packet** | A small piece of data sent over a network |
| **Flow** | A complete connection between two devices (a group of packets) |
| **PCAP** | A file format that stores captured packets |
| **Feature** | A measurable property used by the ML model to make decisions |
| **Feature Vector** | A row of numbers representing one flow, fed to the ML model |
| **Ensemble** | Multiple models working together and voting on the answer |
| **Soft Voting** | Averaging probability scores from multiple models |
| **SHAP** | A method to explain which features influenced a prediction |
| **BPF Filter** | A rule that tells the capture tool which packets to grab |
| **Mirror Port** | A switch feature that copies all traffic to a monitoring port |
| **TAP** | A physical device that copies network traffic passively |
| **Redis** | A fast in-memory data store used as a message queue |
| **WebSocket** | A protocol for real-time two-way communication between browser and server |
| **SOAR** | Security Orchestration, Automation, and Response |
| **Prometheus** | A tool that collects and stores system metrics over time |
| **Grafana** | A tool that creates visual dashboards from metrics |
| **Zeek** | A network analysis tool that converts packets into structured logs |
| **Suricata** | A signature-based IDS/IPS that detects known attack patterns |

---

## 11. Summary of All Four Parts

| Part | Title | Covers |
|------|-------|--------|
| [Part 1](packet_pipeline_part1_overview.md) | **The Big Picture** | What the pipeline is, how current setup compares to the real one, component roles, tool evaluation |
| [Part 2](packet_pipeline_part2_capture.md) | **Live Packet Capture** | Network access methods, tcpdump/tshark/Zeek, BPF filters, Collector module, test traffic generation |
| [Part 3](packet_pipeline_part3_processing_ml.md) | **Preprocessing & ML** | Feature extraction, encoding, scaling, window-based features, ensemble prediction, SHAP explanations |
| [Part 4](packet_pipeline_part4_dashboard_implementation.md) | **Dashboard & Implementation** | Alert flow, dashboard enhancements, monitoring (Prometheus/Grafana), Docker Compose, step-by-step checklist |

---

*Document version: 1.0 — KodeMapper IDPS Project — Packet Pipeline Documentation (Part 4 of 4)*
