# 10 — Future Work & Risks

## 1. Current Limitations

| Limitation | Impact | Mitigation in Current Scope |
|------------|--------|-----------------------------|
| **No encrypted payload analysis** | Cannot inspect HTTPS/TLS content; rely on flow metadata only | Use flow-level and header features which remain visible; many attacks detectable at this level |
| **Benchmark datasets only** | Models evaluated on synthetic/lab traffic, not live enterprise traffic | Use 3 diverse datasets + cross-dataset evaluation to improve generalization |
| **No host-based detection** | Cannot detect fileless malware, privilege escalation on hosts | Out of scope (NIDS focus); future integration with HIDS agents |
| **LSTM sequence modeling is simplistic** | Fixed-length flow windows may miss long-duration attacks | Tunable window size; future work: attention-based models |
| **Single-node deployment** | Not horizontally scalable for enterprise traffic volumes | Docker Compose sufficient for demo; future: Kubernetes with horizontal pod autoscaling |
| **Autoencoder threshold is static** | Fixed percentile threshold may not adapt to traffic drift | Monitor FPR over time; future: adaptive thresholding |
| **No concept drift detection** | Model performance may degrade as attack patterns evolve | Manual retraining; future: automated drift detection and retraining pipelines |

---

## 2. Future Extensions

### 2.1 Short-Term (Next 3–6 Months)

| Extension | Description | Effort |
|-----------|-------------|--------|
| **Transformer-based detector** | Replace LSTM with a Transformer encoder for flow sequences; potentially higher accuracy on complex patterns | Medium |
| **Federated learning** | Train models across distributed sensors without sharing raw data; privacy-preserving | High |
| **Adaptive thresholding** | Dynamically adjust anomaly detection thresholds based on recent traffic baseline | Low |
| **Model ensemble with voting** | Combine RF, XGBoost, LSTM, and Autoencoder predictions via weighted voting for robust detection | Medium |
| **Dashboard dark mode** | User-requested UI feature | Low |

### 2.2 Medium-Term (6–12 Months)

| Extension | Description | Effort |
|-----------|-------------|--------|
| **Adversarial robustness training** | Train models with adversarial examples (packet perturbations, evasion attacks) to improve robustness. Inspired by "Adaptive IDS Leveraging Dynamic Neural Models with Adversarial Learning for 5G/6G Networks" | High |
| **Host-based IDS integration** | Add agents on endpoints that report system calls, file access, process creation; correlate with NIDS alerts | High |
| **SIEM integration** | Export alerts to Splunk, QRadar, or Elastic SIEM via Syslog/CEF/STIX format | Medium |
| **Automated model retraining** | Detect concept drift via statistical tests; trigger retraining pipeline with operator-confirmed labels | Medium |
| **Honeypot integration** | Deploy low-interaction honeypots (e.g., Cowrie, Dionaea); correlate honeypot hits with network alerts to reduce false positives | Medium |
| **Kubernetes deployment** | Full K8s manifests with Helm charts, HPA, Ingress for production-scale deployment | Medium |

### 2.3 Long-Term (Research Directions)

| Direction | Description |
|-----------|-------------|
| **Zero-shot / few-shot attack detection** | Detect entirely new attack types with minimal or no labeled examples |
| **Graph-based detection** | Model network communications as a graph; detect anomalous subgraph patterns (e.g., lateral movement) |
| **eBPF/XDP packet processing** | Kernel-level packet processing for 10 Gbps+ wire-speed detection |
| **Multi-modal fusion** | Combine network telemetry with endpoint logs, DNS queries, and threat intelligence feeds |
| **Causal inference for explanations** | Move beyond correlation-based SHAP to causal explanations of attack behaviors |

---

## 3. Risk Register

### 3.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **High false positive rate** | Medium | High — erodes operator trust, causes alert fatigue | Use SHAP explainability to help operators filter FPs; tune thresholds on validation set; target FPR < 1% |
| **Model overfitting to benchmark data** | Medium | High — poor real-world performance | Cross-dataset evaluation; use 3 diverse datasets; regularization; careful feature selection |
| **Real-time latency too high** | Low | Medium — delayed detection | Profile and optimize hot paths; use batch prediction; consider model distillation (smaller model) |
| **Prevention automation causes disruption** | Low | Critical — blocks legitimate traffic | Demo mode by default; human approval for high-severity; auto-rollback timer; sandboxed testing |
| **SHAP computation too slow for LSTM** | Medium | Medium — delayed explanations | Use KernelSHAP with background sampling; cache explanations; compute async |
| **Dataset version mismatch** | Low | Medium — irreproducible results | SHA-256 checksums for all dataset files; pinned download URLs |
| **Dependency conflicts** | Medium | Low — blocked development | Pinned `requirements.txt`; Docker for isolation; CI checks |

### 3.2 Project Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Scope creep** | High | Medium — delays timeline | Strict scope in `01_project_overview.md`; monthly milestones; cut optional features if behind |
| **Team member unavailability** | Medium | Medium — delays tasks | Cross-training; documented code; no single point of failure on critical modules |
| **Timeline slippage** | Medium | High — incomplete submission | Buffer in Month 6 (Week 24); prioritize core pipeline over polish; track via monthly milestones |
| **Integration difficulties** | Medium | Medium — components don't work together | Integration tests from Month 4; Docker Compose for consistent environments; weekly integration check-ins |
| **Presentation/demo failure** | Low | High — poor impression despite good work | Rehearse demo multiple times; have recorded backup video; tested on demo machine before presentation |

### 3.3 Ethical / Legal Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Accidental PII exposure** | Low | High | No payload storage; IP anonymization; code review for data handling |
| **Prevention module misuse** | Low | High | Demo mode default; clear documentation; safety gates |
| **Dataset license violation** | Low | Medium | All datasets are publicly available for research; cite properly |
| **Plagiarism of paper ideas** | Low | High | Explicit attribution in `08_references_and_attributions.md`; clearly mark adapted vs. novel work |

---

## 4. Contingency Plans

### If We're Behind Schedule

| Month | Contingency |
|-------|-------------|
| Month 2 | Drop LSTM; focus on RF + XGBoost baselines | 
| Month 3 | Reduce SOAR-lite to logging-only (no iptables); focus on SHAP integration |
| Month 4 | Drop mobile notifications; simplify dashboard to essential pages only |
| Month 5 | Skip cross-dataset evaluation; evaluate on CICIDS2017 only |
| Month 6 | Prioritize documentation and demo over code polish |

### If a Key Technology Doesn't Work

| Problem | Fallback |
|---------|----------|
| Zeek setup fails | Use `tcpdump` + CICFlowMeter for flow generation |
| PyTorch LSTM too slow | Replace with 1D-CNN or stick with XGBoost (strongest baseline) |
| SHAP too slow on large models | Use LIME (faster per-instance) or TreeSHAP (fast for tree models only) |
| React dashboard scope too large | Use Grafana with custom panels + minimal React for SOAR controls |
| PostgreSQL setup issues | SQLite for development; migrate to PostgreSQL later |

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
