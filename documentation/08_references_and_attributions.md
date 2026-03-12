# 08 — References & Attributions

This document maps every idea, technique, and component to the source paper or resource that inspired it. All adaptations are explicitly noted.

---

## 1. Research Paper Attributions

### IEEE Papers (from `/literature/research papers/`)

#### IEEE-01: "Random Forest Based Intrusion Detection System"
- **Adapted:** Random Forest as a baseline classifier for IDS; feature importance ranking.
- **Our adaptation:** We use RF as one of our baseline models with the same feature-importance approach, but extend it with SHAP values for per-alert explanations (not done in the paper). We also apply RF across three datasets (paper used a single dataset).
- **Citation:** [Author(s)], "Random Forest Based Intrusion Detection System," IEEE, [Year].

#### IEEE-02: "Real Time Network Intrusion Detection using Machine Learning Technique"
- **Adapted:** Real-time detection pipeline concept — capture → process → classify → alert.
- **Our adaptation:** We implement a similar pipeline but add explainability (SHAP), automated remediation (SOAR-lite), and a production-grade dashboard. The paper focuses on detection accuracy only.
- **Citation:** [Author(s)], "Real Time Network Intrusion Detection using Machine Learning Technique," IEEE, [Year].

#### IEEE-03: "Real-Time Intrusion Detection System Using Scapy With Hybrid Machine and Deep Learning Models and Smart Email Alerting"
- **Adapted:** Email alerting upon intrusion detection; hybrid ML + DL approach.
- **Our adaptation:** We implement multi-channel alerting (email + Slack + push, not just email). We use a similar hybrid approach (classical ML + deep learning) but with different model architectures (XGBoost + LSTM vs. the paper's specific choices).
- **Citation:** [Author(s)], "Real-Time IDS Using Scapy With Hybrid ML/DL and Smart Email Alerting," IEEE, [Year].

#### IEEE-04: "Ensemble Learning Approach for Flow-based Intrusion Detection System"
- **Adapted:** Ensemble learning and flow-based feature extraction methodology.
- **Our adaptation:** We compare individual models (RF, XGBoost, LSTM, Autoencoder) rather than building a formal ensemble. XGBoost itself is an ensemble method. The flow-based feature extraction approach informed our `feature_extractor.py` design.
- **Citation:** [Author(s)], "Ensemble Learning Approach for Flow-based IDS," IEEE, [Year].

#### IEEE-05: "Flow-based Intrusion Detection System for SDN"
- **Adapted:** Flow feature definitions and SDN-context IDS considerations.
- **Our adaptation:** We use flow-based features but in a traditional network (not SDN). The flow feature schema from this paper informed our common flow format.
- **Citation:** [Author(s)], "Flow-based IDS for SDN," IEEE, [Year].

---

### Non-IEEE Papers (from `/literature/research papers/`)

#### "A survey on intrusion detection system in IoT networks"
- **Used for:** Literature context on IDS challenges in constrained environments.
- **Our use:** Background for `01_project_overview.md`; we focus on general network IDS, not IoT-specific.

#### "A systematic literature study of machine learning techniques based intrusion detection"
- **Used for:** Comprehensive survey of ML techniques for IDS.
- **Our use:** Informed our model selection rationale — why RF and XGBoost are strong baselines, and why LSTM is chosen for sequential patterns.

#### "Adaptive Intrusion Detection System Leveraging Dynamic Neural Models with Adversarial Learning for 5G/6G Networks"
- **Used for:** Understanding adversarial robustness in IDS context.
- **Our use:** We list adversarial-aware training as a future work extension (see `10_future_work_and_risks.md`). This is the only surveyed paper addressing adversarial attacks on the IDS itself.

#### "Advancements in Machine Learning-Based Intrusion Detection in IoT"
- **Used for:** Overview of recent ML advancements in IDS.
- **Our use:** Literature background; confirmed the gap in explainability and operational deployment that our project addresses.

#### "AI based IDS"
- **Used for:** General AI/ML approaches to intrusion detection.
- **Our use:** Motivated our choice of multiple model architectures and comparison methodology.

#### "AI-Powered Intrusion Detection Systems: Enhancing Real-Time Network Threat Monitoring — A Systematic Review"
- **Used for:** Systematic review of real-time IDS approaches.
- **Our use:** Validated our real-time pipeline architecture. Confirmed the gap we fill: most systems lack explainability and automated response.

#### "AutoIDS: Autoencoder Based Intrusion Detection System"
- **Adapted:** Autoencoder architecture for anomaly-based IDS.
- **Our adaptation:** We implement a similar autoencoder approach for unsupervised anomaly detection. We use a comparable encoder-decoder architecture but integrate it into our full pipeline with SHAP explainability for the autoencoder's decisions (using reconstruction error features).
- **Citation:** [Author(s)], "AutoIDS: Autoencoder Based Intrusion Detection System," [Venue], [Year].

#### "Autonomous Intrusion Detection System Using Ensemble of Advanced Learners"
- **Adapted:** Concept of using multiple diverse learners for robust detection.
- **Our adaptation:** We train multiple model types (RF, XGBoost, LSTM, Autoencoder) and compare them, with the option to select the best per scenario. We don't implement formal ensemble voting (future work).

#### "Building an Efficient IDS Based on Feature Selection and Ensemble Classifier"
- **Adapted:** Feature selection methodology for improving IDS efficiency.
- **Our adaptation:** We perform feature importance analysis (via SHAP) and can reduce feature sets for faster inference. The paper's feature selection approach informed our preprocessing pipeline design.

#### "Deep Learning-based Intrusion Detection Systems"
- **Adapted:** LSTM and deep learning architectures for network intrusion detection.
- **Our adaptation:** We implement an LSTM model for sequential flow analysis, inspired by the architectures described in this paper. We extend with explainability (SHAP over LSTM predictions).

#### "Evaluating machine learning-based intrusion detection systems with explainable AI: enhancing transparency and interpretability"
- **Adapted (key inspiration for primary innovation):** SHAP and LIME for explaining IDS predictions.
- **Our adaptation:** This paper evaluates explainability offline on static results. We integrate SHAP/LIME into a live system with real-time dashboard visualization. Our contribution: operationalizing XAI in IDS with interactive explanations, not just offline analysis.
- **Citation:** [Author(s)], "Evaluating ML-based IDS with Explainable AI," [Venue], [Year].

#### "Evaluation of Machine Learning Algorithms for IDS"
- **Used for:** Benchmark comparison methodology — evaluating multiple ML algorithms on standard datasets.
- **Our use:** Informed our experimental plan (multi-dataset, multi-model comparison matrix).

#### "Intrusion detection system based on machine learning using least square support vector machine"
- **Used for:** Context on SVM-based IDS approaches.
- **Our use:** We decided not to include SVM (slow on large datasets); referenced in our model selection rationale.

#### "Intrusion Detection Systems in IoT Based on Machine Learning: A state of the art"
- **Used for:** State-of-the-art survey.
- **Our use:** Background literature context.

#### "Intrusion Detection Using Hybrid Random Forest and Attention Models and Explainable AI Visualization"
- **Adapted:** Combining RF with attention mechanisms + XAI visualization.
- **Our adaptation:** We use RF as a standalone baseline and apply SHAP (not attention) for explainability. The concept of visualizing explanations in an IDS context validated our dashboard design approach.

#### "Machine Learning-Based Intrusion Detection Systems: Capabilities, Methodologies, and Open Research Challenges"
- **Used for:** Identification of open challenges in ML-based IDS.
- **Our use:** The "open challenges" listed (real-time operation, explainability, automated response) directly map to our project goals and innovation points.

#### "Measurement - sensors"
- **Used for:** Sensor-based measurement considerations for network monitoring.
- **Our use:** Informed our data collection architecture design.

#### "Robust Anomaly Detection in Network Traffic"
- **Adapted:** Anomaly detection methodology for network traffic.
- **Our adaptation:** Informed our autoencoder's anomaly scoring approach (reconstruction error as anomaly score).

#### "Robust machine learning based Intrusion detection system using simple statistical techniques in feature selection"
- **Adapted:** Statistical feature selection techniques.
- **Our adaptation:** We use statistical analysis in our EDA notebooks. SHAP-based feature importance complements statistical feature selection.

#### "SAFE: Self-Supervised Anomaly Detection Framework for Intrusion Detection"
- **Adapted:** Self-supervised learning for anomaly detection in IDS.
- **Our adaptation:** Our autoencoder approach is semi-supervised (trained on benign data). The self-supervised framing from SAFE informed our anomaly scoring design.
- **Citation:** [Author(s)], "SAFE: Self-Supervised Anomaly Detection Framework," [Venue], [Year].

---

## 2. Dataset Citations

| Dataset | Citation |
|---------|----------|
| **NSL-KDD** | M. Tavallaee, E. Bagheri, W. Lu, and A. A. Ghorbani, "A Detailed Analysis of the KDD CUP 99 Data Set," in *Proc. IEEE Symposium on Computational Intelligence for Security and Defense Applications (CISDA)*, 2009. |
| **CICIDS2017** | I. Sharafaldin, A. Habibi Lashkari, and A. A. Ghorbani, "Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization," in *Proc. 4th International Conference on Information Systems Security and Privacy (ICISSP)*, 2018. |
| **UNSW-NB15** | N. Moustafa and J. Slay, "UNSW-NB15: A Comprehensive Data Set for Network Intrusion Detection Systems," in *Proc. Military Communications and Information Systems Conference (MilCIS)*, 2015. |

---

## 3. Tool & Library Citations

| Tool / Library | Usage | Citation |
|---------------|-------|----------|
| scikit-learn | RF, preprocessing, metrics | Pedregosa et al., "Scikit-learn: Machine Learning in Python," JMLR, 2011. |
| XGBoost | Gradient boosting model | T. Chen and C. Guestrin, "XGBoost: A Scalable Tree Boosting System," KDD, 2016. |
| PyTorch | LSTM, Autoencoder training | Paszke et al., "PyTorch: An Imperative Style, High-Performance Deep Learning Library," NeurIPS, 2019. |
| SHAP | Explainability | S. M. Lundberg and S.-I. Lee, "A Unified Approach to Interpreting Model Predictions," NIPS, 2017. |
| LIME | Explainability | M. T. Ribeiro, S. Singh, and C. Guestrin, "Why Should I Trust You? Explaining the Predictions of Any Classifier," KDD, 2016. |
| FastAPI | Backend API framework | S. Ramírez, FastAPI, https://fastapi.tiangolo.com/ |
| React | Dashboard frontend | Meta Platforms, Inc., React, https://react.dev/ |
| Zeek (Bro) | Network traffic analysis | V. Paxson, "Bro: A System for Detecting Network Intruders in Real-Time," Computer Networks, 1999. |
| Suricata | IDS/IPS engine | Open Information Security Foundation, Suricata, https://suricata.io/ |
| CICFlowMeter | Flow feature extraction | Canadian Institute for Cybersecurity, CICFlowMeter, https://github.com/ahlashkari/CICFlowMeter |
| Docker | Containerization | Docker, Inc., https://www.docker.com/ |
| Prometheus | Monitoring | Cloud Native Computing Foundation, https://prometheus.io/ |
| Grafana | Visualization | Grafana Labs, https://grafana.com/ |
| MLflow | Experiment tracking | Databricks, MLflow, https://mlflow.org/ |

---

## 4. Summary: What Is Novel vs. Adapted

| Component | Status | Source |
|-----------|--------|--------|
| End-to-end real-time pipeline | **Adapted** — combined ideas from IEEE-02, IEEE-03 | Novel in integration completeness |
| Random Forest baseline | **Adapted** from IEEE-01, common in literature | Standard technique |
| XGBoost baseline | **Standard** — widely used | Common in literature |
| LSTM for flow sequences | **Adapted** from "Deep Learning-based IDS" | Applied to our pipeline |
| Autoencoder anomaly detection | **Adapted** from "AutoIDS" and "SAFE" | Semi-supervised framing |
| **SHAP/LIME dashboard explanations** | **Novel integration** — inspired by "Evaluating ML-based IDS with XAI" but operationalized in live dashboard | **Primary innovation** |
| **SOAR-lite policy engine** | **Novel** — not found in any surveyed paper | **Secondary innovation** |
| Multi-channel alerting | **Adapted** from IEEE-03 (email only) | Extended to Slack + push |
| iptables prevention | **Novel in IDS context** — common sysadmin tool, novel automation in this pipeline | Part of SOAR-lite |

---

> **Note:** Exact author names, venues, and years should be filled in after verifying each paper's metadata. The paper filenames in `/literature/research papers/` serve as identifiers until full bibliographic entries are completed.

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
