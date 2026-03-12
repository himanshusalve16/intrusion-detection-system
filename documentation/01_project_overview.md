# 01 — Project Overview

## Team

**Team Name:** KodeMapper (4 members)

| Member | Role |
|--------|------|
| A | Data Engineering & ML Pipeline Lead |
| B | Infrastructure, DevOps & Prevention Automation Lead |
| C | Backend API & Integration Lead |
| D | Frontend Dashboard, Alerting & Documentation Lead |

---

## 1. Problem Statement

Network intrusions — ranging from port scans and brute-force attacks to sophisticated DDoS campaigns and zero-day exploits — continue to grow in volume and complexity. Traditional signature-based Intrusion Detection Systems (IDS) such as Snort and Suricata can only identify known attack patterns and fail to detect novel threats. On the other hand, most machine-learning-based IDS prototypes remain academic: they are evaluated offline on static datasets, lack real-time alerting, provide no automated prevention response, and offer no explanation for why traffic was flagged as malicious.

There is a clear gap between research-grade ML detection models and production-ready, operator-friendly intrusion detection and **prevention** systems that:

1. Detect both known and unknown attacks in real time.
2. Explain detection decisions to human operators (reducing alert fatigue).
3. Take safe, automated prevention actions (blocking/quarantining) with rollback capability.
4. Provide a monitoring dashboard, multi-channel alerting, and an audit trail.

---

## 2. Motivation

* **Rising threat landscape:** Cyber-attacks cause billions of dollars in damage annually. Automated, intelligent defense is no longer optional.
* **Alert fatigue:** Security Operations Centers (SOCs) are overwhelmed by false positives. Explainable AI (XAI) can help operators triage alerts faster.
* **Prevention gap:** Detection alone is insufficient; organizations need automated, safe remediation.
* **Academic-to-production gap:** Most ML-IDS papers stop at offline accuracy metrics and never address deployment, latency, or operator usability.

---

## 3. Background

Intrusion Detection Systems are broadly classified as:

* **Signature-based (misuse detection):** Match traffic patterns against a database of known attack signatures. Fast but blind to novel attacks.
* **Anomaly-based:** Build a model of "normal" behavior and flag deviations. Better for unknown attacks but prone to high false positive rates.
* **Hybrid:** Combine both; this is the direction most modern research takes.

Machine learning — from classical models (Random Forest, XGBoost) to deep learning (LSTM, Autoencoders, Transformers) — has shown strong results on benchmark datasets like NSL-KDD, CICIDS2017, and UNSW-NB15. However, the transition from offline evaluation to real-time, explainable, and preventive systems remains under-explored.

---

## 4. Scope

### In scope

| Area | Description |
|------|-------------|
| Network-level intrusion detection | Flow-based and packet-header–based features |
| Multiple ML/DL models | Baselines (Random Forest, XGBoost) + advanced (LSTM, Autoencoder) |
| Explainable alerts (primary innovation) | Per-alert SHAP/LIME explanations rendered in the dashboard |
| Automated remediation / SOAR-lite (secondary innovation) | Rule-based policy engine that maps alerts to safe mitigation actions (iptables block/quarantine) with human-approval gate and rollback |
| Monitoring dashboard | Real-time visualization of alerts, metrics, model performance, and explanations |
| Multi-channel alerting | Email (SMTP), Slack webhook, push notifications |
| Benchmark evaluation | NSL-KDD, CICIDS2017, UNSW-NB15 |
| Deployment automation | Docker, docker-compose, deployment scripts |
| Documentation & reproducibility | All 10 documentation deliverables, scripts, and instructions |

### Out of scope

* Host-based intrusion detection (HIDS) — we focus on network-based (NIDS).
* Full production deployment on a live enterprise network (demo/sandbox mode only).
* Deep packet inspection of encrypted payloads (we rely on flow-level and header features).
* Mobile app as a standalone product (optional lightweight notification client only).
* Kernel-level packet processing (eBPF/XDP) — we use userspace tools.

---

## 5. Limitations in Prior Work

Based on our literature survey of ~25 papers (see `/literature/`):

| Limitation | Papers affected |
|------------|-----------------|
| Offline-only evaluation; no real-time pipeline | Most surveyed papers, e.g., "Random Forest Based IDS" (IEEE-01), "Evaluation of ML Algorithms for IDS" |
| No explainability — operators cannot interpret alerts | Majority of surveyed papers except "Evaluating ML-based IDS with Explainable AI" and "Intrusion Detection Using Hybrid RF and Attention Models and Explainable AI" |
| No automated prevention/response | Almost all surveyed papers focus purely on detection, not prevention |
| Single-dataset evaluation (no cross-dataset generalization) | Many papers evaluate on a single dataset only (e.g., only NSL-KDD) |
| No deployment/operationalization guidance | Common across the literature |
| No adversarial robustness testing | Only "Adaptive IDS Leveraging Dynamic Neural Models with Adversarial Learning for 5G/6G Networks" addresses this |

---

## 6. Our Novel Ideas

### Primary Innovation — Explainable Alerts with SHAP/LIME

We integrate model-agnostic explainability (SHAP and LIME) directly into the alert pipeline so that every alert displayed on the dashboard includes:

* A ranked list of the top contributing features (e.g., "high packet rate from source IP", "unusual destination port").
* A visual explanation (force plot / waterfall chart) embedded in the alert detail view.
* A confidence score with calibration.

**Why novel:** While a few papers (e.g., "Evaluating ML-based IDS with Explainable AI") explore XAI in IDS, none of our surveyed papers integrate explanations into a live, interactive dashboard with an end-to-end detection pipeline. Our contribution closes that gap.

### Secondary Innovation — Automated Remediation Policy Engine (SOAR-lite)

We build a lightweight Security Orchestration, Automation, and Response (SOAR) module that:

* Maps alert severity and type to predefined, safe remediation actions (e.g., block IP via iptables, quarantine host, rate-limit).
* Supports a **human-in-the-loop approval gate** for high-severity actions.
* Logs all actions immutably and supports **one-click rollback**.
* Runs in **safe/demo mode** by default — actions are simulated and logged, not executed, unless explicitly armed.

**Why novel:** None of the surveyed papers implement automated prevention with rollback and approval workflows. This bridges the gap from detection to actionable response.

---

## 7. Expected Impact

* **Faster threat response:** Automated detection + prevention reduces mean time to detect (MTTD) and mean time to respond (MTTR).
* **Reduced alert fatigue:** Explainable alerts help operators prioritize and trust the system.
* **Reproducible research artifact:** Open-source repo with documentation, scripts, and benchmark results that others can build on.
* **Demonstrable final-year project:** Live demo showing traffic capture → detection → explainable alert → automated (simulated) prevention.

---

## 8. Threat Model

### Assets

* Network infrastructure (routers, switches, servers) in the monitored segment.
* Data in transit (packets, flows).
* The IDPS system itself (dashboard, API, ML models).

### Threat actors

* External attackers: performing reconnaissance (port scans), brute-force, DDoS, exploitation.
* Internal threats: compromised hosts performing lateral movement or data exfiltration.

### Attack types covered

| Category | Examples |
|----------|----------|
| Reconnaissance | Port scan, ping sweep |
| Denial of Service | SYN flood, UDP flood, Slowloris |
| Brute Force | SSH brute force, HTTP login brute force |
| Exploitation | Web attacks (SQL injection, XSS via payloads in HTTP flow metadata) |
| Botnet / C2 | Beaconing, periodic communication patterns |
| Infiltration | Data exfiltration via DNS tunneling (if detectable at flow level) |

### Assumptions

* The IDPS sensor has access to a network tap or mirror port to capture traffic.
* Encrypted traffic analysis is limited to metadata/flow features (no payload decryption).
* The system runs in a trusted network segment; the IDPS host itself is hardened.

---

## 9. Ethical Considerations

* **Privacy:** All packet payloads are discarded after feature extraction. Only flow-level metadata is stored. Any real traffic used in testing is anonymized (IP addresses, MAC addresses). We do not store PII.
* **Responsible use:** The prevention/blocking module runs in **demo/safe mode** by default to prevent accidental disruption. Production-mode blocking requires explicit operator activation.
* **Dataset ethics:** We use publicly available, ethically collected benchmark datasets (NSL-KDD, CICIDS2017, UNSW-NB15). We cite all dataset creators.
* **No offensive use:** This system is defensive only. We do not develop or distribute attack tools.
* **Transparency:** All code, models, and results are documented and reproducible.

---

## 10. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NETWORK SEGMENT                               │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                       │
│   │  Server   │   │  Server   │   │  Clients  │                      │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘                       │
│        └───────────────┼───────────────┘                             │
│                        │  (mirror port / TAP)                        │
└────────────────────────┼─────────────────────────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │   Traffic Collector  │  (tcpdump / tshark / Zeek)
              │   src/collector      │
              └──────────┬──────────┘
                         │ raw pcap / flow logs
                         ▼
              ┌─────────────────────┐
              │   Preprocessor &     │  (feature extraction, labeling)
              │   Feature Extractor  │
              │   src/preproc        │
              └──────────┬──────────┘
                         │ feature vectors
                         ▼
              ┌─────────────────────┐
              │   ML/DL Detection    │  (RF, XGBoost, LSTM, Autoencoder)
              │   Engine             │
              │   src/models         │
              └──────────┬──────────┘
                         │ predictions + SHAP explanations
                         ▼
              ┌─────────────────────┐
              │   Backend API        │  (FastAPI)
              │   src/api            │
              └───┬────────────┬────┘
                  │            │
         ┌────────┘            └─────────┐
         ▼                               ▼
┌──────────────────┐          ┌─────────────────────┐
│  Dashboard (React)│          │  Alerting Service    │
│  src/dashboard    │          │  (Email/Slack/Push)  │
│  + SHAP visuals   │          └──────────┬──────────┘
└──────────────────┘                      │
                                          ▼
                               ┌─────────────────────┐
                               │  SOAR-lite Policy    │
                               │  Engine              │
                               │  src/automation      │
                               │  (iptables / Suricata│
                               │   rules, rollback)   │
                               └─────────────────────┘
                                          │
                               ┌─────────────────────┐
                               │  Monitoring &        │
                               │  Logging             │
                               │  (Prometheus+Grafana)│
                               └─────────────────────┘
```

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
