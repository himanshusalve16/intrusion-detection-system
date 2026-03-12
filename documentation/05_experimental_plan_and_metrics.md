# 05 — Experimental Plan & Metrics

## 1. Datasets

### 1.1 Selected Datasets

| Dataset | Year | Records | Classes | Source |
|---------|------|---------|---------|--------|
| **NSL-KDD** | 2009 (cleaned KDD99) | ~125K train, ~22K test | 5 (Normal, DoS, Probe, R2L, U2R) | [UNB](https://www.unb.ca/cic/datasets/nsl.html) |
| **CICIDS2017** | 2017 | ~2.8M flows | 15 (Benign + 14 attack types) | [UNB](https://www.unb.ca/cic/datasets/ids-2017.html) |
| **UNSW-NB15** | 2015 | ~2.5M records | 10 (Normal + 9 attack categories) | [UNSW](https://research.unsw.edu.au/projects/unsw-nb15-dataset) |

### 1.2 Dataset Selection Rationale

* **NSL-KDD:** Industry-standard benchmark, widely used for comparability. Resolves duplicate issues in original KDD99. Small enough for quick iteration.
* **CICIDS2017:** Modern network traffic with realistic attack scenarios (brute force, DDoS, web attacks, infiltration, botnet). Provides bidirectional flow features via CICFlowMeter.
* **UNSW-NB15:** Contemporary dataset with 9 attack families. Provides both flow and packet-level features. Complements NSL-KDD with modern traffic patterns.

Using **three datasets** ensures we evaluate generalization and avoid overfitting to a single data distribution.

---

## 2. Preprocessing Steps

### 2.1 Common Pipeline

```
Raw dataset files (.csv / .arff)
      │
      ▼
┌─────────────────┐
│  Load & Parse    │  (dataset_loader.py — dataset-specific parsing)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Clean           │  • Remove duplicates
│                  │  • Handle inf/NaN (impute with median or drop)
│                  │  • Remove constant-value columns
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Map to Common   │  • Unify column names to common schema
│  Schema          │  • Map attack labels to unified taxonomy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Encode          │  • Label-encode categorical features (protocol, service, flag)
│                  │  • Binary-encode attack labels (benign=0, attack=1) for binary task
│                  │  • Multi-class label encoding for multi-class task
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Scale           │  • StandardScaler (zero mean, unit variance) — fitted on train split only
│                  │  • Scaler serialized (joblib) for inference consistency
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Split           │  • NSL-KDD: predefined train/test split
│                  │  • CICIDS2017 / UNSW-NB15: stratified 80/20 train/test
│                  │  • From train: 80/20 train/val for hyperparameter tuning
└─────────────────┘
```

### 2.2 Unified Label Taxonomy

| Unified Label | NSL-KDD | CICIDS2017 | UNSW-NB15 |
|---------------|---------|------------|-----------|
| Benign | normal | BENIGN | Normal |
| DoS | neptune, smurf, pod, teardrop, back, land | DoS Hulk, DoS Slowloris, DoS SlowHTTPTest, DoS GoldenEye | DoS |
| Probe / Reconnaissance | portsweep, ipsweep, nmap, satan | PortScan | Reconnaissance |
| Brute Force | — | FTP-Patator, SSH-Patator | — |
| Web Attack | — | Web Attack (Brute Force, XSS, SQL Injection) | Exploits |
| Botnet | — | Bot | Backdoor |
| Infiltration | — | Infiltration | Generic, Worms |
| R2L / Remote Access | guess_passwd, ftp_write, imap, phf, multihop, warezmaster, warezclient, spy | — | Shellcode |
| U2R / Privilege Escalation | buffer_overflow, loadmodule, rootkit, perl | — | — |
| Other | — | Heartbleed | Analysis, Fuzzers |

For **binary classification**: Benign = 0, All attacks = 1.
For **multi-class**: Use the unified labels above.

---

## 3. Model Architectures

### 3.1 Baseline Models

#### Random Forest (RF)
- **Why:** Strong performance on tabular data; handles class imbalance with class weights; inherently interpretable feature importances. Widely used baseline in IDS literature (cited in IEEE-01, among others).
- **Hyperparameters to tune:** `n_estimators` (100, 200, 500), `max_depth` (10, 20, None), `min_samples_split` (2, 5, 10), `class_weight` (balanced).
- **Library:** scikit-learn `RandomForestClassifier`.

#### XGBoost
- **Why:** Gradient boosting often outperforms RF on structured data; handles missing values natively; efficient training. Cited in multiple surveyed papers (e.g., "Building an Efficient IDS Based on Feature Selection and Ensemble Classifier").
- **Hyperparameters to tune:** `n_estimators` (100, 300, 500), `max_depth` (4, 6, 8), `learning_rate` (0.01, 0.1, 0.3), `subsample` (0.8, 1.0), `scale_pos_weight` (auto from class ratio).
- **Library:** `xgboost.XGBClassifier`.

### 3.2 Advanced Models

#### LSTM (Long Short-Term Memory)
- **Why:** Captures temporal dependencies in sequential flow data; effective for detecting attacks that manifest as sequences of flows (e.g., scanning, brute force). Referenced in "Deep Learning-based Intrusion Detection Systems".
- **Architecture:**
  ```
  Input (batch, seq_len, n_features)
    → LSTM(hidden=128, layers=2, dropout=0.3)
    → Dense(64, ReLU)
    → Dropout(0.3)
    → Dense(n_classes, Softmax)
  ```
- **Hyperparameters to tune:** `hidden_size` (64, 128, 256), `num_layers` (1, 2), `learning_rate` (1e-3, 1e-4), `batch_size` (64, 128), `seq_len` (5, 10, 20 flows).
- **Library:** PyTorch.

#### Autoencoder (Anomaly Detection)
- **Why:** Unsupervised/semi-supervised approach: trained on benign traffic only, flags anomalies by reconstruction error. Useful when labeled attack data is scarce. Inspired by "AutoIDS: Autoencoder Based Intrusion Detection System" and "SAFE: Self-Supervised Anomaly Detection Framework".
- **Architecture:**
  ```
  Input (n_features)
    → Dense(64, ReLU) → Dense(32, ReLU) → Dense(16, ReLU)    [Encoder]
    → Dense(32, ReLU) → Dense(64, ReLU) → Dense(n_features)   [Decoder]
  ```
  Anomaly score = MSE between input and reconstruction.
- **Hyperparameters to tune:** `latent_dim` (8, 16, 32), `learning_rate` (1e-3, 1e-4), `epochs` (50, 100), `threshold` (percentile-based: 95th, 99th of reconstruction error on validation benign data).
- **Library:** PyTorch.

### 3.3 Why These Models Over Others

| Considered | Decision | Reason |
|-----------|----------|--------|
| Logistic Regression | Included as a quick sanity-check baseline (not primary) | Too simple for complex attack patterns; useful only as a floor baseline |
| SVM | Not included | Slow on large datasets (CICIDS2017 has ~2.8M rows); RF/XGBoost dominate in benchmarks |
| CNN (1D) | Not included | Less natural fit for flow features than LSTM; adds complexity without clear benefit |
| Transformer | Not included (future work) | High complexity, requires careful handling of flow sequences; out of scope for 6-month timeline |
| GAN-based | Not included | Training instability; adversarial training addressed differently |

---

## 4. Evaluation Metrics

### 4.1 Detection Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Accuracy** | $\frac{TP + TN}{TP + TN + FP + FN}$ | Overall correctness (less meaningful with imbalanced data) |
| **Precision** | $\frac{TP}{TP + FP}$ | How many flagged alerts are real attacks |
| **Recall (Detection Rate)** | $\frac{TP}{TP + FN}$ | How many real attacks are caught |
| **F1-Score** | $\frac{2 \cdot P \cdot R}{P + R}$ | Harmonic mean of precision and recall |
| **ROC-AUC** | Area under ROC curve | Discrimination ability across thresholds |
| **False Positive Rate (FPR)** | $\frac{FP}{FP + TN}$ | Critical for operator trust; target < 1% |
| **Per-class F1** | F1 per attack category | Identify which attack types are hard to detect |
| **Confusion Matrix** | N×N matrix | Visual breakdown of misclassifications |

### 4.2 Operational Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| **Inference latency** | < 500ms per flow | Time `predict()` + `explain()` with `time.perf_counter()` |
| **Throughput** | > 1000 flows/sec | Batch inference benchmark |
| **Time to detect (TTD)** | < 2 seconds from flow arrival | End-to-end timestamp difference |
| **Time to alert** | < 5 seconds from detection | Detection → dashboard WebSocket + email |
| **CPU usage (model serving)** | < 50% single core | Prometheus metric during load test |
| **Memory usage (model serving)** | < 2 GB | Prometheus metric during load test |

### 4.3 Explainability Metrics

| Metric | Purpose |
|--------|---------|
| SHAP computation time per alert | Must be < 5 sec for tree models, < 30 sec for LSTM |
| Top-K feature overlap with domain knowledge | Sanity: do explanations match known attack indicators? |
| Explanation consistency | Same input → same SHAP output (determinism check) |

---

## 5. Cross-Validation Method

### 5.1 Within-Dataset Evaluation

* **NSL-KDD:** Use the predefined train/test split (KDDTrain+ / KDDTest+). For hyperparameter tuning, do 5-fold stratified CV on the training set.
* **CICIDS2017 / UNSW-NB15:** Stratified 80/20 train/test split. 5-fold stratified CV on the training portion for hyperparameter tuning.

### 5.2 Cross-Dataset Evaluation (Generalization)

To test generalization:

| Experiment | Train On | Test On | Purpose |
|------------|----------|---------|---------|
| Cross-1 | CICIDS2017 | UNSW-NB15 | Does model generalize across dataset distributions? |
| Cross-2 | UNSW-NB15 | CICIDS2017 | Reverse direction |
| Cross-3 | NSL-KDD | CICIDS2017 | Old → modern generalization |

Use the **unified label taxonomy** (binary: benign vs. attack) for cross-dataset experiments, since multi-class labels don't align perfectly.

---

## 6. Baseline Comparisons

All models will be compared on the same preprocessed data with fixed random seed (42).

### 6.1 Comparison Matrix

| Model | NSL-KDD | CICIDS2017 | UNSW-NB15 | Cross-dataset |
|-------|---------|------------|-----------|---------------|
| Logistic Regression (floor) | ✓ | ✓ | ✓ | — |
| Random Forest | ✓ | ✓ | ✓ | ✓ |
| XGBoost | ✓ | ✓ | ✓ | ✓ |
| LSTM | ✓ | ✓ | ✓ | ✓ |
| Autoencoder | ✓ | ✓ | ✓ | ✓ |

### 6.2 Expected Result Tables (to be filled during experiments)

**Binary Classification — [Dataset Name]**

| Model | Accuracy | Precision | Recall | F1 | AUC | FPR | Latency (ms) |
|-------|----------|-----------|--------|-----|-----|-----|---------------|
| Logistic Regression | — | — | — | — | — | — | — |
| Random Forest | — | — | — | — | — | — | — |
| XGBoost | — | — | — | — | — | — | — |
| LSTM | — | — | — | — | — | — | — |
| Autoencoder | — | — | — | — | — | — | — |

**Multi-Class — Per Attack Category F1 (example for CICIDS2017)**

| Model | DoS | Probe | Brute Force | Web Attack | Botnet | Infiltration |
|-------|-----|-------|-------------|------------|--------|-------------|
| Random Forest | — | — | — | — | — | — |
| XGBoost | — | — | — | — | — | — |
| LSTM | — | — | — | — | — | — |

---

## 7. Stress Tests

### 7.1 Throughput Test

* Replay CICIDS2017 dataset at accelerated speed through the full pipeline.
* Measure: flows processed per second, alert delivery latency, queue backlog.
* Pass criteria: > 1000 flows/sec sustained for 5 minutes without queue overflow.

### 7.2 Burst Test

* Send 10x normal flow rate for 30 seconds.
* Measure: system recovery time, whether alerts are dropped.
* Pass criteria: No alert loss; system recovers within 60 seconds.

### 7.3 Long-Running Test

* Run the full pipeline for 24 hours with continuous traffic replay.
* Measure: memory leaks (RSS should not grow unbounded), log rotation, DB size.
* Pass criteria: Memory stable within ±10%; no crashes.

---

## 8. Reproducibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| Fixed random seed | `seed=42` in all scripts (Python `random`, NumPy, PyTorch, scikit-learn) |
| Exact preprocessing | Serialized scaler + encoder (joblib); preprocessing scripts versioned |
| Hyperparameters logged | Stored in `experiments/{model}_{dataset}/config.json` |
| Training logs | Loss/metric per epoch stored in `experiments/{model}_{dataset}/training_log.csv` |
| Model artifacts | Saved as `.pt` (PyTorch) or `.joblib` (sklearn/xgboost) |
| Environment | `requirements.txt` with pinned versions; Dockerfile for exact reproduction |
| Dataset versions | SHA-256 hash of each dataset file stored in `data/checksums.sha256` |

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
