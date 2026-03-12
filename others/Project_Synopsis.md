# Project Synopsis

---

## 1. Title of Project

**AI-Driven Intrusion Detection & Prevention System (IDPS) with Explainable Alerts and Automated Remediation**

---

## 2. Problem Statement

Network intrusions — ranging from port scans and brute-force attacks to sophisticated DDoS campaigns and zero-day exploits — continue to grow in volume and complexity. Traditional signature-based Intrusion Detection Systems (IDS) such as Snort and Suricata can only identify known attack patterns and fail to detect novel threats. Most machine-learning-based IDS prototypes remain academic: they are evaluated offline on static datasets, lack real-time alerting, provide no automated prevention response, and offer no explanation for why traffic was flagged as malicious.

There is a clear gap between research-grade ML detection models and production-ready, operator-friendly intrusion detection and prevention systems that can:

1. Detect both known and unknown network attacks in real time.
2. Explain detection decisions to human operators using Explainable AI, thereby reducing alert fatigue.
3. Take safe, automated prevention actions (blocking/quarantining malicious traffic) with rollback capability.
4. Provide a monitoring dashboard, multi-channel alerting, and a complete audit trail.

---

## 3. Aim of Project

The aim of this project is to design and develop a complete, end-to-end AI-driven Intrusion Detection and Prevention System (IDPS) that bridges the gap between academic ML-based detection research and real-world operational deployment. Specifically, the project aims to:

1. **Build a real-time detection pipeline** — Capture live network traffic, extract flow-level features, and classify traffic as benign or malicious using multiple ML/DL models (Random Forest, XGBoost, LSTM, Autoencoder).
2. **Integrate Explainable AI (XAI)** — Provide per-alert SHAP/LIME explanations rendered on an interactive dashboard, enabling security operators to understand *why* traffic was flagged.
3. **Implement automated remediation (SOAR-lite)** — Deploy a policy engine that maps detected threats to safe mitigation actions (e.g., iptables block, host quarantine) with human-approval gates and rollback capability.
4. **Develop a monitoring dashboard** — Create a React-based real-time dashboard with alert visualization, SHAP explanation charts, model performance metrics, and SOAR control panels.
5. **Evaluate rigorously** — Benchmark across three standard datasets (NSL-KDD, CICIDS2017, UNSW-NB15) with cross-dataset generalization tests, and report precision, recall, F1, AUC, FPR, and operational metrics.
6. **Ensure reproducibility and deployment readiness** — Containerize all services with Docker, provide CI/CD pipelines, and deliver comprehensive documentation.

---

## 4. Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI-DRIVEN IDPS — SYSTEM ARCHITECTURE                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  NETWORK     │    Mirror Port / TAP
  │  TRAFFIC     │─────────────────────────┐
  └──────────────┘                         │
                                           ▼
                               ┌───────────────────────┐
                               │   COLLECTOR MODULE     │
                               │  (tcpdump / Zeek)      │
                               │  Raw PCAP + Zeek Logs  │
                               └───────────┬───────────┘
                                           │
                                     Redis Queue
                                           │
                                           ▼
                               ┌───────────────────────┐
                               │  PREPROCESSOR MODULE   │
                               │  Feature Extraction    │
                               │  Encoding & Scaling    │
                               │  Common Flow Schema    │
                               └───────────┬───────────┘
                                           │
                                    Feature Vectors
                                           │
                                           ▼
                               ┌───────────────────────┐
                               │    ML ENGINE MODULE    │
                               │                       │
                               │  ┌─────┐ ┌─────────┐ │
                               │  │ RF  │ │ XGBoost │ │     Baseline Models
                               │  └─────┘ └─────────┘ │
                               │  ┌──────┐ ┌────────┐ │
                               │  │ LSTM │ │ Auto-  │ │     Advanced Models
                               │  │      │ │encoder │ │
                               │  └──────┘ └────────┘ │
                               │                       │
                               │  + SHAP/LIME Explainer│
                               └───────────┬───────────┘
                                           │
                                 Prediction + Explanation
                                           │
                          ┌────────────────┴─────────────────┐
                          │                                   │
                          ▼                                   ▼
              ┌───────────────────┐              ┌────────────────────────┐
              │  BACKEND API      │              │  SOAR-LITE / AUTOMATION│
              │  (FastAPI)        │              │  Policy Engine         │
              │                   │              │  iptables / Suricata   │
              │  REST + WebSocket │              │  Approval Gate         │
              │  JWT Auth         │              │  Rollback Manager      │
              │  Alert Storage    │◄────────────►│  Audit Logger          │
              └────────┬──────────┘              └────────────────────────┘
                       │
          ┌────────────┼─────────────┐
          │            │             │
          ▼            ▼             ▼
  ┌─────────────┐ ┌──────────┐ ┌──────────────┐
  │  DASHBOARD  │ │  EMAIL / │ │   MOBILE     │
  │  (React)    │ │  SLACK   │ │   PUSH       │
  │             │ │  ALERTS  │ │   NOTIFY     │
  │  - Alerts   │ └──────────┘ └──────────────┘
  │  - SHAP     │
  │  - Metrics  │
  │  - SOAR Ctl │
  └─────────────┘

              ┌─────────────────────────────────────┐
              │       INFRASTRUCTURE LAYER           │
              │  PostgreSQL │ Redis │ Docker Compose  │
              │  Prometheus │ Grafana │ Nginx (TLS)  │
              └─────────────────────────────────────┘

              ┌─────────────────────────────────────┐
              │          DATASETS (Training)         │
              │  NSL-KDD │ CICIDS2017 │ UNSW-NB15   │
              └─────────────────────────────────────┘
```

**Data Flow Summary:**

```
Network Traffic → Collector (PCAP/Zeek) → Redis → Preprocessor (Features)
→ ML Engine (Predict + SHAP Explain) → Backend API → Dashboard (Real-time)
                                                   → Email/Slack/Push Alerts
                                                   → SOAR-lite (Auto-response)
```

---

## 5. Description

The proposed system is an **AI-Driven Intrusion Detection and Prevention System (IDPS)** that provides end-to-end network security monitoring — from live traffic capture to automated threat remediation.

**How It Works:**

The system captures live network traffic via a mirror port or TAP using `tcpdump` and `Zeek`, producing structured flow logs. These raw logs are streamed through a Redis message queue to the Preprocessor module, which extracts ~40–80 flow-level features (packet counts, byte volumes, inter-arrival times, protocol flags, etc.), encodes categorical variables, and normalizes values using fitted scalers.

The feature vectors are then fed into the **ML Engine**, which hosts four trained detection models:
- **Random Forest** and **XGBoost** — classical ensemble models serving as robust baselines for tabular flow data.
- **LSTM** — a deep learning recurrent model that captures temporal dependencies across sequential network flows.
- **Autoencoder** — a semi-supervised anomaly detector trained only on benign traffic, flagging anomalies by high reconstruction error.

Each prediction is accompanied by a **SHAP/LIME explanation** — a ranked list of contributing features with visual force plots — making every alert interpretable to human operators.

The **Backend API** (FastAPI) orchestrates the detection pipeline, stores alerts with explanations in PostgreSQL, streams real-time alerts via WebSocket, and dispatches multi-channel notifications (Email, Slack, Mobile Push).

The **React Dashboard** presents a real-time monitoring interface with alert timelines, severity distributions, per-alert SHAP visualizations, model performance comparison charts, and SOAR-lite controls.

The **SOAR-lite Automation Engine** evaluates each alert against configurable policy rules and proposes remediation actions (e.g., block attacker IP via iptables, deploy Suricata detection rule, quarantine host). Actions require human approval for high-severity threats and include automatic rollback timers — ensuring safety. A demo mode simulates all actions without executing real network changes.

The entire system is containerized with **Docker Compose**, monitored by **Prometheus + Grafana**, and includes CI/CD pipelines via **GitHub Actions**.

---

## 6. Specification

### Hardware Specifications

| Component | Minimum Requirement | Recommended |
|-----------|-------------------|-------------|
| Processor | Intel i5 / AMD Ryzen 5 (4 cores) | Intel i7 / AMD Ryzen 7 (8 cores) |
| RAM | 8 GB | 16 GB |
| Storage | 20 GB free | 50 GB SSD (for datasets + Docker images) |
| Network | 1 Gbps NIC with mirror port / TAP support | Dedicated monitoring NIC |
| GPU (optional) | Not required | NVIDIA GPU with CUDA (for faster LSTM/Autoencoder training) |

### Software Specifications

| Category | Technology | Version |
|----------|-----------|---------|
| Operating System | Ubuntu Linux | 22.04 LTS |
| Programming Language | Python | 3.10+ |
| Frontend Language | TypeScript (React) | React 18, Node 20 LTS |
| Backend Framework | FastAPI + Uvicorn | Latest stable |
| Database | PostgreSQL | 15+ |
| Message Queue / Cache | Redis | 7+ |
| ML Libraries | scikit-learn, XGBoost, PyTorch, SHAP, LIME | Latest stable |
| Traffic Capture | tcpdump, tshark, Zeek | Zeek 6.x |
| IDS/IPS Engine | Suricata (for rule-based prevention) | 7.x |
| Containerization | Docker, Docker Compose | Docker 24+, Compose v2.20+ |
| Monitoring | Prometheus + Grafana | Latest stable |
| CI/CD | GitHub Actions | — |
| Version Control | Git, GitHub | Git 2.30+ |
| Model Tracking | MLflow | Latest stable |

### Datasets

| Dataset | Records | Classes | Year |
|---------|---------|---------|------|
| NSL-KDD | ~125K train, ~22K test | 5 (Normal, DoS, Probe, R2L, U2R) | 2009 |
| CICIDS2017 | ~2.8M flows | 15 (Benign + 14 attack types) | 2017 |
| UNSW-NB15 | ~2.5M records | 10 (Normal + 9 attack categories) | 2015 |

### Key Performance Targets

| Metric | Target |
|--------|--------|
| Detection accuracy | > 95% (binary), > 90% (multi-class) |
| False Positive Rate | < 1% |
| Inference latency | < 500ms per flow |
| Throughput | > 1000 flows/sec |
| Time to detect | < 2 seconds from flow arrival |
| Time to alert | < 5 seconds from detection |
| SHAP explanation time | < 5 sec (tree models), < 30 sec (LSTM) |
| Dashboard load time | < 3 seconds |

---

## 7. State Innovative Component in the Project

### Primary Innovation — Explainable Alerts with SHAP/LIME

Most existing ML-based IDS systems operate as "black boxes" — they flag traffic as malicious but provide no reasoning. Security operators, already overwhelmed by alert fatigue, cannot trust or prioritize alerts they don't understand.

**Our innovation:** We integrate model-agnostic explainability (SHAP and LIME) directly into the live detection pipeline so that **every alert** includes:
- A **ranked list of top contributing features** (e.g., "unusually high packet rate from source IP", "rare destination port 4444", "abnormal flow duration").
- A **visual SHAP force plot / waterfall chart** embedded in the alert detail view on the dashboard.
- A **confidence score** with calibration.

**Why it's novel:** While one surveyed paper ("Evaluating ML-based IDS with Explainable AI") applies SHAP offline to static evaluation results, **no surveyed paper integrates SHAP/LIME into a live, real-time IDS dashboard with interactive visualizations**. Our system operationalizes XAI — operators can click on any alert and immediately see *why* it was flagged, enabling faster triage and reduced false-positive fatigue.

### Secondary Innovation — SOAR-lite Automated Remediation Policy Engine

Current academic IDS systems focus exclusively on detection. Once an attack is flagged, the response is entirely manual.

**Our innovation:** A lightweight Security Orchestration, Automation, and Response (SOAR-lite) engine that:
- **Maps alerts to remediation actions** based on configurable policy rules (alert type + severity → action template).
- **Executes safe, automated responses**: blocking attacker IPs via iptables, deploying Suricata detection rules, or quarantining compromised hosts.
- **Includes human-approval gates**: high-severity actions require explicit operator approval through the dashboard.
- **Provides automatic rollback**: every action includes a rollback timer and can be reverted with one click.
- **Maintains an immutable audit log** in PostgreSQL for compliance and review.
- **Operates in demo mode by default**: all actions are logged but not executed, ensuring safety during development and demonstration.

**Why it's novel:** No surveyed paper implements automated remediation with approval gates and rollback in an IDS context. This bridges the gap between detection-only systems and full SOAR platforms, making the system not just an IDS but an IDPS.

---

## 8. Requirement of Component with Their Approximate Cost (Comparative Analysis)

To support college funding and scaling decisions, the estimated expenses are structured into two tiers: a **Budget Tier** for essential demonstration and a **Scaled Tier** for robust online production. 

*Note: All core software platforms (Ubuntu, Python, React, PostgreSQL, Docker, PyTorch, Suricata, etc.) and datasets are strictly open-source and free, which drastically reduces baseline costs.*

### Option A: Essential Demonstration Setup (Budget Tier)

This tier includes only the essential hardware and short-term cloud resources needed to build the prototype and run a successful, live demonstration for the college. 

| Component / Resource | Purpose | Approximate Cost (INR) |
|----------------------|---------|------------------------|
| **Existing Hardware & Software** | Laptops, open-source ML libraries, Datasets | ₹0 (Free) |
| **Managed Network Switch / TAP** | Hardware to mirror live network traffic securely without disrupting the lab | ₹2,000 – ₹5,000 (One-time) |
| **Basic Domain Name** | Required to host the dashboard securely (HTTPS) | ₹800 – ₹1,000 / year |
| **Short-Term Cloud VM (VPS)** | 4GB RAM instance to host the backend during the evaluation/demo weeks | ₹1,500 / month |
| | **Total Essential Cost (For Prototype)** | **₹4,300 – ₹7,500** |

### Option B: Production-Scale Cloud Deployment (Scaled Tier)

Standard PaaS free-tiers (e.g., Render/Heroku with 500MB RAM) **cannot** support this project. Generating real-time SHAP explainability and running deep learning (LSTM/Autoencoder) requires a minimum of 4GB-8GB RAM. Furthermore, network packet sniffing requires deep OS-level access via a dedicated Virtual Private Server (VPS). 

This tier represents the ongoing operational cost to run the IDPS system end-to-end on the cloud.

| Component / Resource | Purpose | Approximate Monthly Cost (INR) |
|----------------------|---------|--------------------------------|
| **Domain Name** (`.tech` or `.com`) | Accessing the Dashboard & API securely | ₹100 – ₹150 / month (₹1,200/year) |
| **Cloud Server (VPS)** | Hosting FastAPI, ML Models, Traffic Capture (e.g., 4 vCPUs, 8GB RAM on DigitalOcean/AWS/Linode) | ₹3,500 – ₹4,500 / month |
| **Managed Database / Redis** | Independent PostgreSQL & Redis instances to prevent OOM conflicts | ₹1,500 – ₹2,500 / month |
| **Block Storage (100 GB)** | Storing raw PCAP files, logs, and datasets safely | ₹800 – ₹1,000 / month |
| **Premium Alerting** | SendGrid/Twilio (Standard Tier) beyond 100 free emails | ₹1,200 / month |
| | **Total Estimated Cost (Cloud Scale)** | **₹7,100 – ₹9,650 / month** |

---

## 9. Give Month Wise Plan for the Execution of Project

| Month | Phase | Key Tasks | Deliverables |
|-------|-------|-----------|------------|
| **Month 1** | **Foundations & Dataset Setup** | Finalize project scope; set up GitHub repo with branch strategy and CI; configure dev environment (Ubuntu VM/WSL, Python, Node); download and inspect NSL-KDD, CICIDS2017, UNSW-NB15 datasets; implement dataset loaders; initial EDA notebook; scaffold FastAPI project; set up Docker skeleton (PostgreSQL, Redis); write project overview and architecture docs. | Repo skeleton, 3 datasets in common schema, EDA notebook, architecture documentation, dev environment reproducible. |
| **Month 2** | **Feature Engineering & Baseline Models** | Complete feature extraction pipeline (encoding, scaling); implement Random Forest and XGBoost models; train and evaluate on all 3 datasets; implement core API endpoints (alerts CRUD, JWT auth); scaffold React dashboard with routing; implement evaluation script; write experimental plan doc; set up Prometheus + Grafana monitoring. | Baseline models (RF, XGBoost) trained with evaluation report; API serves alerts; dashboard skeleton with mock data; monitoring stack running. |
| **Month 3** | **Advanced Models & Innovation Start** | Implement LSTM model for sequential detection; implement Autoencoder for anomaly detection; integrate SHAP/LIME explainability; design and implement SOAR-lite policy engine and action executor; dashboard: alert list with real API data, SHAP visualization component; full model comparison across all datasets; implement iptables action module (demo mode). | All 4 models trained and compared; SHAP integrated into pipeline; SOAR-lite with demo-mode actions; dashboard shows real alerts with SHAP. |
| **Month 4** | **Integration & End-to-End Pipeline** | Wire collector → preprocessor streaming (Redis); implement real-time inference service; WebSocket alert streaming; email + Slack alerting; SOAR-lite approval gate UI; end-to-end integration (detect → alert → SOAR → action); demo script (replay pcap → detect → alert → simulated block); Suricata rule deployment; alert detail page with SHAP; integration testing; write deployment and API docs. | End-to-end pipeline working: pcap replay → detection → dashboard alert with SHAP → notification → simulated block. Demo script ready. |
| **Month 5** | **Hardening, UI Polish & Evaluation** | Performance profiling (reduce inference latency); false positive analysis and threshold tuning; cross-dataset evaluation (train on X, test on Y); load/stress testing (throughput, burst, 24-hour); dashboard polish (responsive, error states); complete unit and integration tests (≥ 80% coverage); Grafana monitoring dashboards; write test plan and future work docs; generate final evaluation report with charts. | System optimized; cross-dataset evaluation complete; UI polished; ≥ 80% test coverage; all metrics finalized. |
| **Month 6** | **Finalize, Demo & Submission** | Finalize all 10 documentation files; verify all citations and references; clean up codebase; prepare presentation slides; record demo video/GIFs; final integration test and demo rehearsal; update README with setup instructions; tag release v1.0.0; peer review all docs and code; buffer week for remaining issues; final submission and presentation/viva. | All documentation complete, demo recorded, presentation delivered, repo tagged v1.0.0 and submitted. |

---

## 10. Reference Paper / Patent

### IEEE Research Papers

| Sr. No. | Paper Title | Relevance |
|---------|-------------|-----------|
| 1 | Random Forest Based Intrusion Detection System | RF as baseline IDS classifier; feature importance ranking |
| 2 | Real Time Network Intrusion Detection using Machine Learning Technique | Real-time detection pipeline architecture |
| 3 | Real-Time Intrusion Detection System Using Scapy With Hybrid Machine and Deep Learning Models and Smart Email Alerting | Hybrid ML+DL approach; email alerting |
| 4 | Ensemble Learning Approach for Flow-based Intrusion Detection System | Ensemble learning and flow-based feature extraction |
| 5 | Flow-based Intrusion Detection System for SDN | Flow feature definitions and SDN-context IDS |

### Non-IEEE Research Papers

| Sr. No. | Paper Title | Relevance |
|---------|-------------|-----------|
| 6 | A Survey on Intrusion Detection System in IoT Networks | IDS challenges in constrained environments |
| 7 | A Systematic Literature Study of Machine Learning Techniques Based Intrusion Detection | Comprehensive survey of ML techniques for IDS |
| 8 | Adaptive IDS Leveraging Dynamic Neural Models with Adversarial Learning for 5G/6G Networks | Adversarial robustness in IDS |
| 9 | Advancements in Machine Learning-Based Intrusion Detection in IoT | Recent ML advancements in IDS |
| 10 | AI Based IDS | General AI/ML approaches to intrusion detection |
| 11 | AI-Powered Intrusion Detection Systems: Enhancing Real-Time Network Threat Monitoring — A Systematic Review | Systematic review of real-time IDS approaches |
| 12 | AutoIDS: Autoencoder Based Intrusion Detection System | Autoencoder architecture for anomaly-based IDS |
| 13 | Autonomous Intrusion Detection System Using Ensemble of Advanced Learners | Multiple diverse learners for robust detection |
| 14 | Building an Efficient IDS Based on Feature Selection and Ensemble Classifier | Feature selection methodology for IDS |
| 15 | Deep Learning-based Intrusion Detection Systems | LSTM and deep learning for network IDS |
| 16 | Evaluating ML-based IDS with Explainable AI: Enhancing Transparency and Interpretability | SHAP and LIME for explaining IDS predictions (key inspiration for primary innovation) |
| 17 | Evaluation of Machine Learning Algorithms for IDS | Benchmark comparison methodology |
| 18 | IDS Based on Machine Learning Using Least Square SVM | SVM-based IDS approaches |
| 19 | Intrusion Detection Systems in IoT Based on ML: A State of the Art | State-of-the-art survey |
| 20 | Intrusion Detection Using Hybrid Random Forest and Attention Models and Explainable AI Visualization | RF + attention + XAI visualization |
| 21 | ML-Based IDS: Capabilities, Methodologies, and Open Research Challenges | Open challenges in ML-based IDS |
| 22 | Measurement — Sensors | Sensor-based measurement for network monitoring |
| 23 | Robust Anomaly Detection in Network Traffic | Anomaly detection methodology |
| 24 | Robust ML-based IDS Using Simple Statistical Techniques in Feature Selection | Statistical feature selection for IDS |
| 25 | SAFE: Self-Supervised Anomaly Detection Framework for Intrusion Detection | Self-supervised anomaly detection |

### Datasets Cited

| Dataset | Citation |
|---------|----------|
| NSL-KDD | M. Tavallaee et al., "A Detailed Analysis of the KDD CUP 99 Data Set," IEEE CISDA, 2009. |
| CICIDS2017 | I. Sharafaldin et al., "Toward Generating a New Intrusion Detection Dataset," ICISSP, 2018. |
| UNSW-NB15 | N. Moustafa and J. Slay, "UNSW-NB15: A Comprehensive Data Set for Network IDS," MilCIS, 2015. |

---
