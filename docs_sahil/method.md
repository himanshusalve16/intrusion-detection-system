
---

# Machine Learning Methodology

## Multi-Model Network Intrusion Detection Training Pipeline

---

# 1. Introduction

This document describes the **Machine Learning Methodology** used for building a **Multi-Attack Network Intrusion Detection System**.

The objective is to design a **scalable ML training architecture** capable of detecting **multiple attack types using a single trained model**.

The methodology includes:

* Dataset integration
* Data preprocessing
* Feature engineering
* Multi-model training
* Model evaluation
* Model selection
* Deployment pipeline

---

# 2. Problem Definition

## Objective

Develop a **Multi-Class Network Intrusion Detection System** capable of detecting:

* DoS
* Exploits
* Reconnaissance
* Worms
* Backdoor
* Fuzzers
* Shellcode
* Generic

This is a **Supervised Multi-Class Classification Problem**

---

# 3. Dataset Description

## Dataset Used

Primary Dataset:

**UNSW-NB15**

Dataset Characteristics:

* Network traffic dataset
* Multi-attack classification
* 49 features
* Multi-class labels

---

# 4. Dataset Features

Features categorized into:

## Basic Network Features

* srcip
* dstip
* sport
* dsport
* proto

These describe:

* Network communication
* Protocol behavior

---

## Traffic Features

* sbytes
* dbytes
* dur
* rate

These describe:

* Traffic volume
* Communication duration

---

## Flow Features

* spkts
* dpkts
* sload
* dload

These describe:

* Packet flow behavior

---

# 5. Target Variables

Binary Label

```
label
```

* 0 → Benign
* 1 → Attack

Multi-Class Label

```
attack_cat
```

Attack Categories:

* DoS
* Exploits
* Reconnaissance
* Worms
* Backdoor
* Fuzzers
* Shellcode
* Generic

---

# 6. Machine Learning Pipeline

## Training Pipeline Architecture

```
Dataset
 ↓
Preprocessing
 ↓
Feature Engineering
 ↓
Multi-Model Training
 ↓
Evaluation
 ↓
Model Selection
 ↓
Final Model
```

---

# 7. Data Preprocessing

Data preprocessing includes:

## Step 1 — Data Cleaning

* Remove missing values
* Remove duplicates

---

## Step 2 — Feature Selection

Remove unnecessary features:

* srcip
* dstip

These do not contribute to prediction.

---

## Step 3 — Categorical Encoding

Categorical features:

* proto
* service
* state

Encoding method:

* Label Encoding
* One-Hot Encoding

---

## Step 4 — Feature Scaling

Normalize numerical features:

* rate
* sbytes
* dbytes
* dur

Scaling method:

* StandardScaler
* MinMaxScaler

---

# 8. Feature Engineering

Feature engineering improves detection accuracy.

Important Features:

* rate
* sbytes
* dbytes
* spkts
* dpkts

These features help detect:

* DoS attacks
* Recon attacks
* Exploit attacks

---

# 9. Model Selection

Multiple models are used for comparison.

## Decision Tree

Purpose:

* Baseline model

Advantages:

* Easy to interpret
* Fast training

---

## Random Forest

Purpose:

* Main detection model

Advantages:

* High accuracy
* Robust performance

---

## XGBoost

Purpose:

* Advanced model

Advantages:

* High performance
* Handles complex patterns

---

# 10. Multi-Model Training

Multiple models are trained simultaneously.

```
Dataset
 ↓
Decision Tree
Random Forest
XGBoost
 ↓
Compare Results
```

---

# 11. Training Strategy

## Train-Test Split

Dataset divided into:

* 80% Training
* 20% Testing

---

## Training Steps

1. Load dataset
2. Split features and labels
3. Train models
4. Evaluate models

---

# 12. Model Evaluation

Evaluation Metrics

* Accuracy
* Precision
* Recall
* F1 Score
* Confusion Matrix

---

# 13. Model Comparison

Example Results

| Model         | Accuracy |
| ------------- | -------- |
| Decision Tree | 91%      |
| Random Forest | 96%      |
| XGBoost       | 97%      |

Best Model Selected:

* Random Forest / XGBoost

---

# 14. Multi-Attack Detection

Single model detects multiple attacks.

```
Input Traffic
 ↓
Trained Model
 ↓
Attack Prediction
```

Example:

```
Attack Type: DoS
Confidence: 96%
```

---

# 15. Feature Importance

Important features:

* rate
* sbytes
* dbytes
* dur
* ct_srv_src

These features improve detection accuracy.

---

# 16. Model Saving

Best model saved using:

* Pickle
* Joblib

Pipeline:

```
Train Model
 ↓
Save Model
 ↓
Load Model
 ↓
Prediction
```

---

# 17. Prediction Pipeline

```
New Data
 ↓
Preprocessing
 ↓
Trained Model
 ↓
Prediction
```

---

# 18. Experiment Tracking

Track:

* Model accuracy
* Training time
* Feature importance

Example:

| Model | Accuracy | Time |
| ----- | -------- | ---- |
| DT    | 91%      | 2s   |
| RF    | 96%      | 5s   |
| XGB   | 97%      | 8s   |

---

# 19. Future Improvements

Future enhancements:

* Deep learning integration
* Hybrid detection system
* Real-time intrusion detection
* Signature-based integration

---

# 20. Final Architecture

```
Network Traffic
      ↓
ML Pipeline
      ↓
Multi-Attack Detection
```

---

# 21. Expected Output

Example Output

```
Attack Type: Reconnaissance
Confidence: 95%
System Decision: Attack Detected
```

---

# 22. Conclusion

This methodology provides:

* Multi-attack detection
* Multi-model training
* Research-level ML pipeline
* Scalable intrusion detection system

This forms the **Machine Learning Core Architecture** of the project.

---

