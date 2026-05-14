# Packet Pipeline Documentation — Part 3: Preprocessing, Feature Engineering & ML Prediction

> **Prerequisite:** Read [Part 1 (Overview)](packet_pipeline_part1_overview.md) and [Part 2 (Capture)](packet_pipeline_part2_capture.md) first.

---

## 1. Where We Are in the Pipeline

```
Collector (Zeek) → Redis Queue → [YOU ARE HERE: Preprocessor → ML Engine] → Backend API → Dashboard
```

At this point, raw flow records (from Zeek's conn.log) are sitting in the Redis queue as JSON objects. Now we need to:
1. **Read** each flow record from Redis
2. **Extract** the right features from it
3. **Transform** those features into numbers the ML model understands
4. **Feed** the feature vector to the ensemble model
5. **Get** a prediction (Normal or attack type) with confidence score

---

## 2. What Is a Feature? (Beginner Explanation)

A **feature** is a single measurable property of a network connection that helps the ML model make decisions.

Think of it like a doctor diagnosing a patient:
- **Temperature** = 39°C → might indicate fever
- **Heart rate** = 120 bpm → might indicate stress
- **Blood pressure** = 180/90 → might indicate hypertension

For network traffic, features are things like:
- **Duration** = 0.001 seconds → suspiciously short connection (possible scan)
- **Source bytes** = 50,000,000 → large data transfer (possible exfiltration)
- **Packet count** = 10,000 → packet flood (possible DoS attack)

The ML model looks at all these features together and decides: "This pattern looks like a DoS attack" or "This looks normal."

---

## 3. Feature Mapping: Zeek conn.log → Dataset Features (Generalization)

Our models are currently trained on the **UNSW-NB15** dataset, but the pipeline is designed to be generalized for other datasets like **CICIDS2017** or **NSL-KDD**. Because each dataset uses different feature names, and Zeek's `conn.log` has its own naming convention, we need a **mapping table**.

Here is an example of how Zeek maps to UNSW-NB15 and CICIDS2017:

| Zeek conn.log Field | UNSW-NB15 Mapping | CICIDS2017 Mapping | Meaning |
|--------------------|-------------------|--------------------|---------|
| `duration` | `dur` | `Flow Duration` | Connection duration |
| `proto` | `proto` | `Protocol` | Protocol (tcp, udp, icmp) |
| `orig_bytes` | `sbytes` | `Total Length of Fwd Packets`| Bytes sent by source |
| `resp_bytes` | `dbytes` | `Total Length of Bwd Packets`| Bytes sent by dest |
| `orig_ip_bytes` * | `sttl` | `Fwd Header Length` | Derived from IP headers |
| _calculated_ | `rate` | `Flow Packets/s` | Total packets / duration |
| `conn_state` | `ct_state_ttl` | `FIN Flag Count` (derived)| Connection state / flags |

> **Note:** Some features (marked with *) require additional computation. Furthermore, both UNSW-NB15 and CICIDS2017 rely heavily on **window-based features** (e.g., counting connections over a time window). These require a **connection tracker** that remembers recent connections.

Whenever you swap the ML model to one trained on a different dataset, you simply update the mapping dictionary in the Preprocessor to output the correct feature names.

---

## 4. The Preprocessor Module — Step by Step

### Step 1 — Read from Redis

```python
"""
Listen for new flow records on the Redis channel and process them.
"""
import json
import redis
import numpy as np

r = redis.Redis(host='localhost', port=6379, decode_responses=True)
pubsub = r.pubsub()
pubsub.subscribe('flows:raw')

for message in pubsub.listen():
    if message['type'] == 'message':
        flow_record = json.loads(message['data'])
        # flow_record is now a Python dictionary with Zeek fields
        process_flow(flow_record)
```

### Step 2 — Feature Extraction

```python
def extract_features(flow: dict) -> dict:
    """
    Convert a Zeek conn.log record into UNSW-NB15-compatible features.
    """
    duration = float(flow.get('duration', 0) or 0)
    orig_bytes = int(flow.get('orig_bytes', 0) or 0)
    resp_bytes = int(flow.get('resp_bytes', 0) or 0)
    orig_pkts = int(flow.get('orig_pkts', 0) or 0)
    resp_pkts = int(flow.get('resp_pkts', 0) or 0)
    
    total_pkts = orig_pkts + resp_pkts
    
    features = {
        'dur': duration,
        'proto': flow.get('proto', 'tcp'),
        'service': flow.get('service', '-'),
        'state': flow.get('conn_state', 'OTH'),
        'sbytes': orig_bytes,
        'dbytes': resp_bytes,
        'spkts': orig_pkts,
        'dpkts': resp_pkts,
        'rate': total_pkts / duration if duration > 0 else 0,
        'sload': (orig_bytes * 8) / duration if duration > 0 else 0,
        'dload': (resp_bytes * 8) / duration if duration > 0 else 0,
        # ... additional features
    }
    return features
```

### Step 3 — Categorical Encoding

Some features are text (like "tcp", "http", "S0"). ML models only understand numbers. We convert text to numbers using **Label Encoding** — the same encoder that was used during training.

```python
import pickle

# Load the encoder saved during model training
with open('service/models/artifacts/final_encoders.pkl', 'rb') as f:
    encoders = pickle.load(f)

def encode_categoricals(features: dict) -> dict:
    """Convert text features to numbers using the saved label encoders."""
    categorical_cols = ['proto', 'service', 'state']
    
    for col in categorical_cols:
        if col in encoders:
            value = features[col]
            try:
                features[col] = encoders[col].transform([value])[0]
            except ValueError:
                # Unknown category not seen during training
                features[col] = -1  # Mark as unknown
    
    return features
```

### Step 4 — Feature Selection

Not all 49 features from UNSW-NB15 are useful. During training, a **feature selector** was fitted to identify the most important features. We use the same selector during inference.

```python
# Load the feature selector saved during training
with open('service/models/artifacts/feature_selector.pkl', 'rb') as f:
    feature_selector = pickle.load(f)

def select_features(feature_array: np.ndarray) -> np.ndarray:
    """Keep only the features that the model was trained on."""
    return feature_selector.transform(feature_array)
```

### Step 5 — Scaling

Numbers need to be on a similar scale. If "bytes" ranges from 0 to 10,000,000 but "duration" ranges from 0 to 5, the model might be biased toward the larger numbers. **Scaling** fixes this.

**StandardScaler** transforms each feature so it has mean = 0 and standard deviation = 1.

```python
# The scaler was fitted during training — we load the same one
# (This is part of the saved pipeline, not separately saved in current setup)
def scale_features(feature_array: np.ndarray) -> np.ndarray:
    """Normalize feature values using the training-time scaler."""
    # In our current setup, scaling is embedded in the preprocessing pipeline
    return scaler.transform(feature_array)
```

---

## 5. Window-Based Features — The Tricky Part

Some features in UNSW-NB15 are **window-based** — they count events over a recent time window. Examples:

| Feature | Meaning |
|---------|---------|
| `ct_srv_src` | Number of connections from same source to same service in last N seconds |
| `ct_dst_src_ltm` | Number of connections from same source to same destination in last N seconds |
| `ct_src_dport_ltm` | Number of connections from same source to same destination port in last N seconds |

These are NOT available from a single Zeek log entry. They require a **connection tracker** — a component that remembers recent connections and can count them.

### How to Implement a Connection Tracker

```python
from collections import defaultdict
import time

class ConnectionTracker:
    """
    Tracks recent connections to compute window-based features.
    Uses a sliding window approach.
    """
    def __init__(self, window_seconds=100):
        self.window = window_seconds
        self.connections = []  # List of (timestamp, src_ip, dst_ip, dst_port, service)
    
    def add_connection(self, ts, src_ip, dst_ip, dst_port, service):
        """Record a new connection."""
        self.connections.append((ts, src_ip, dst_ip, dst_port, service))
        self._cleanup(ts)
    
    def _cleanup(self, current_time):
        """Remove connections older than the window."""
        cutoff = current_time - self.window
        self.connections = [(t, s, d, p, sv) for t, s, d, p, sv in self.connections if t > cutoff]
    
    def get_window_features(self, ts, src_ip, dst_ip, dst_port, service):
        """Count connections in the recent window."""
        self._cleanup(ts)
        
        ct_srv_src = sum(1 for t, s, d, p, sv in self.connections if s == src_ip and sv == service)
        ct_dst_src_ltm = sum(1 for t, s, d, p, sv in self.connections if s == src_ip and d == dst_ip)
        ct_src_dport_ltm = sum(1 for t, s, d, p, sv in self.connections if s == src_ip and p == dst_port)
        
        return {
            'ct_srv_src': ct_srv_src,
            'ct_dst_src_ltm': ct_dst_src_ltm,
            'ct_src_dport_ltm': ct_src_dport_ltm,
        }
```

> **Important:** This is the hardest part of the preprocessing pipeline. Getting window-based features right is critical because they are among the top-ranked features for attack detection (especially Reconnaissance and Exploits).

---

## 6. The ML Engine — How Prediction Works

### 6.1 The Dual-Tier Architecture

According to the project flowchart, our ML Engine leverages a powerful combination of **Baseline Models** and **Advanced Deep Learning Models** to ensure both high accuracy on known attacks and the ability to detect zero-day anomalies.

```
Feature Vector (e.g., 42 scaled numbers)
        │
        ├─→ [ Tier 1: Baseline Models ]
        │     ├──→ Random Forest (RF)
        │     └──→ XGBoost
        │     (Excellent at classifying known attack signatures)
        │
        └─→ [ Tier 2: Advanced Models ]
              ├──→ LSTM (Long Short-Term Memory)
              │    (Analyzes sequential packet flows over time)
              └──→ Auto-encoder
                   (Unsupervised learning — detects zero-day anomalies by measuring reconstruction error)
        │
        ▼
   Ensemble Decision Logic (Soft Voting / Thresholding)
        │
        ▼
   Final Prediction + Confidence Score
```

**How they work together:**
1. The **Baseline Models (RF, XGBoost)** act as the primary classifiers. If an attack matches patterns seen in the training data (like DoS, Fuzzers, Generic), they flag it with high confidence.
2. The **Auto-encoder** acts as a safety net. Even if RF/XGBoost think traffic is "Normal," if the Auto-encoder reconstruction error is extremely high, it flags the traffic as a **Zero-Day Anomaly**.
3. The **LSTM** model is specifically used for attacks that unfold over long sequences of packets, where context from previous packets is necessary.

### 6.2 The Prediction Pipeline (Conceptual)

```python
import numpy as np

class MLEngine:
    """Orchestrates Baseline and Advanced Deep Learning models."""
    
    def __init__(self, artifacts_dir='service/models/artifacts'):
        # Load Baseline
        self.rf = load_model(f'{artifacts_dir}/rf.pkl')
        self.xgb = load_model(f'{artifacts_dir}/xgb.pkl')
        
        # Load Deep Learning
        self.lstm = load_dl_model(f'{artifacts_dir}/lstm.h5')
        self.autoencoder = load_dl_model(f'{artifacts_dir}/autoencoder.h5')
    
    def predict(self, feature_vector: np.ndarray, sequence_data: np.ndarray) -> dict:
        """Run multi-model prediction."""
        
        # 1. Baseline Predictions (Classifiers)
        prob_rf = self.rf.predict_proba(feature_vector)
        prob_xgb = self.xgb.predict_proba(feature_vector)
        
        # 2. Sequential Prediction (LSTM)
        prob_lstm = self.lstm.predict(sequence_data)
        
        # 3. Anomaly Detection (Auto-encoder)
        reconstruction = self.autoencoder.predict(feature_vector)
        anomaly_score = calculate_mse(feature_vector, reconstruction)
        is_zero_day = anomaly_score > ANOMALY_THRESHOLD
        
        # 4. Ensemble Logic
        final_class, confidence = ensemble_vote(prob_rf, prob_xgb, prob_lstm)
        
        if final_class == "Normal" and is_zero_day:
            final_class = "Unknown Anomaly"
            confidence = min(anomaly_score / MAX_SCORE, 0.99)
            
        return {
            'prediction': final_class,
            'confidence': float(confidence),
            'anomaly_score': float(anomaly_score)
        }
```

### 6.3 Model Performance Recap

| Attack Type | Recall | What It Means |
|-------------|--------|---------------|
| Normal | 0.98 | 98% of normal traffic correctly identified |
| Generic | 0.98 | 98% of crypto attacks caught |
| Reconnaissance | 0.83 | 83% of scanning attacks caught |
| Fuzzers | 0.80 | 80% of fuzzing attacks caught |
| DoS | 0.66 | 66% of denial-of-service caught |
| Exploits | 0.65 | 65% of exploitation attempts caught |

**Overall accuracy: 89.7%** — comparable to published research papers.

### 6.4 SHAP & LIME Explanations — Why Did the Model Flag This?

To prevent "black-box" decision making, our engine uses **SHAP** (SHapley Additive exPlanations) and **LIME** (Local Interpretable Model-agnostic Explanations). These tell you which features pushed the prediction toward "attack" and which pushed it toward "normal."

```python
import shap

def explain_prediction(model, feature_vector, feature_names):
    """Generate SHAP explanation for a single prediction."""
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(feature_vector.reshape(1, -1))
    
    # Top 5 features that contributed most to this prediction
    top_features = sorted(
        zip(feature_names, shap_values[0]),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:5]
    
    return {
        'top_features': [{'name': name, 'impact': float(val)} for name, val in top_features],
        'shap_values': shap_values.tolist()
    }
```

**Example output:**
```json
{
  "prediction": "DoS",
  "confidence": 0.92,
  "explanation": {
    "top_features": [
      {"name": "sbytes", "impact": 0.45},
      {"name": "rate", "impact": 0.32},
      {"name": "spkts", "impact": 0.28},
      {"name": "sttl", "impact": -0.15},
      {"name": "dur", "impact": 0.12}
    ]
  }
}
```

This means: "The model flagged this as DoS mainly because the source sent an abnormally high number of bytes (sbytes) at a very high rate."

---

## 7. The Complete Processing Flow (Code-Level)

```python
"""
Full processing pipeline: Redis → Preprocess → Predict → API
"""
import json, redis, requests

# Initialize components
tracker = ConnectionTracker(window_seconds=100)
predictor = EnsemblePredictor('service/models/artifacts')
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def process_flow(flow_json: str):
    flow = json.loads(flow_json)
    
    # Step 1: Extract features from Zeek record
    features = extract_features(flow)
    
    # Step 2: Compute window-based features
    ts = float(flow.get('ts', 0))
    window_feats = tracker.get_window_features(
        ts, flow.get('id.orig_h'), flow.get('id.resp_h'),
        int(flow.get('id.resp_p', 0)), flow.get('service', '-')
    )
    features.update(window_feats)
    tracker.add_connection(ts, flow.get('id.orig_h'), flow.get('id.resp_h'),
                           int(flow.get('id.resp_p', 0)), flow.get('service', '-'))
    
    # Step 3: Encode categorical features
    features = encode_categoricals(features)
    
    # Step 4: Convert to numpy array in correct column order
    feature_vector = np.array([features[col] for col in EXPECTED_COLUMNS])
    
    # Step 5: Select features + scale
    feature_vector = select_features(feature_vector.reshape(1, -1))
    
    # Step 6: Predict
    result = predictor.predict(feature_vector)
    
    # Step 7: If attack detected, send alert to API
    if result['prediction'] != 'Normal':
        alert = {
            'src_ip': flow.get('id.orig_h'),
            'dst_ip': flow.get('id.resp_h'),
            'src_port': flow.get('id.orig_p'),
            'dst_port': flow.get('id.resp_p'),
            'attack_type': result['prediction'],
            'confidence': result['confidence'],
            'timestamp': flow.get('ts')
        }
        # Send to Backend API
        requests.post('http://localhost:8000/api/v1/detect', json=alert)
        # Also publish to Redis for real-time dashboard
        r.publish('alerts:new', json.dumps(alert))

# Main loop: listen for flows from Redis
pubsub = r.pubsub()
pubsub.subscribe('flows:raw')
for message in pubsub.listen():
    if message['type'] == 'message':
        process_flow(message['data'])
```

---

## 8. Challenges and How to Handle Them

| Challenge | Impact | Solution |
|-----------|--------|----------|
| Zeek feature names don't match UNSW-NB15 | Model gets wrong inputs → garbage predictions | Build a careful mapping table (Section 3) |
| Window-based features need memory | Without them, Recon/Exploit detection drops | Connection Tracker class (Section 5) |
| Unknown categorical values at inference | LabelEncoder crashes on unseen values | Use try/except, map unknowns to -1 |
| Scaler not matching training data | Feature distributions shift → poor accuracy | Always use the same scaler saved during training |
| High throughput (>1000 flows/sec) | Python processing becomes a bottleneck | Use batching, process N flows at once instead of one by one |
| Model loading time | Models are large, slow to load | Load once at startup, keep in memory |

---

## 9. Performance Targets

| Metric | Target | Reason |
|--------|--------|--------|
| Flow-to-prediction latency | < 2 seconds | Real-time detection requirement |
| Throughput | ≥ 500 flows/second | Typical small-to-medium network |
| Model memory | < 2 GB | Reasonable for a monitoring server |
| False positive rate | < 10% | Avoid alert fatigue |
| Attack detection rate (recall) | > 80% macro average | Current model achieves 81.5% |

---

**Next:** [Part 4 — Monitoring, Dashboard & Implementation Steps](packet_pipeline_part4_dashboard_implementation.md)

---

*Document version: 1.0 — KodeMapper IDPS Project — Packet Pipeline Documentation (Part 3 of 4)*
