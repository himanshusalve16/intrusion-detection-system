# 07 — API Specification & User Manual

## Part A — Backend API Specification

### Base URL

```
http://localhost:8000/api/v1
```

### Authentication

All endpoints (except `/auth/login`) require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens expire after 24 hours. Use `/auth/refresh` to obtain a new token.

---

### 1. Authentication

#### POST `/auth/login`

Authenticate and receive a JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "role": "admin"
  }
}
```

**Response (401):**
```json
{
  "detail": "Invalid username or password"
}
```

#### POST `/auth/refresh`

Refresh an expiring token.

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

---

### 2. Alerts

#### GET `/alerts`

List alerts with pagination and filters.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page (max 100) |
| `severity` | string | — | Filter: `low`, `medium`, `high`, `critical` |
| `attack_type` | string | — | Filter by attack category |
| `status` | string | — | Filter: `open`, `acknowledged`, `resolved` |
| `start_date` | ISO datetime | — | Alerts after this timestamp |
| `end_date` | ISO datetime | — | Alerts before this timestamp |
| `sort` | string | `-created_at` | Sort field (prefix `-` for desc) |

**Response (200):**
```json
{
  "total": 1523,
  "page": 1,
  "per_page": 20,
  "alerts": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "flow_id": "flow_20240115_001234",
      "src_ip": "192.168.1.105",
      "dst_ip": "10.0.0.50",
      "src_port": 54321,
      "dst_port": 22,
      "protocol": 6,
      "attack_type": "Brute Force",
      "severity": "high",
      "confidence": 0.94,
      "model_name": "xgboost",
      "status": "open",
      "created_at": "2024-01-15T14:32:10Z"
    }
  ]
}
```

#### GET `/alerts/{id}`

Get alert detail including SHAP explanation.

**Response (200):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "flow_id": "flow_20240115_001234",
  "src_ip": "192.168.1.105",
  "dst_ip": "10.0.0.50",
  "src_port": 54321,
  "dst_port": 22,
  "protocol": 6,
  "attack_type": "Brute Force",
  "severity": "high",
  "confidence": 0.94,
  "model_name": "xgboost",
  "status": "open",
  "created_at": "2024-01-15T14:32:10Z",
  "shap_explanation": {
    "base_value": 0.12,
    "predicted_value": 0.94,
    "top_features": [
      {"feature": "dst_port", "value": 22, "shap_value": 0.35, "direction": "attack"},
      {"feature": "flow_iat_mean", "value": 0.002, "shap_value": 0.22, "direction": "attack"},
      {"feature": "syn_flag_count", "value": 150, "shap_value": 0.15, "direction": "attack"},
      {"feature": "total_fwd_pkts", "value": 2000, "shap_value": 0.08, "direction": "attack"},
      {"feature": "fwd_pkt_len_mean", "value": 52, "shap_value": 0.02, "direction": "attack"}
    ],
    "all_shap_values": [0.35, 0.22, 0.15, 0.08, 0.02, -0.01, ...],
    "feature_names": ["dst_port", "flow_iat_mean", "syn_flag_count", ...]
  },
  "remediation_actions": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "action_type": "block_ip",
      "target": "192.168.1.105",
      "status": "pending",
      "requires_approval": true
    }
  ]
}
```

#### POST `/alerts/{id}/acknowledge`

Mark an alert as acknowledged by the current user.

**Response (200):**
```json
{
  "id": "a1b2c3d4-...",
  "status": "acknowledged",
  "acknowledged_by": "admin",
  "acknowledged_at": "2024-01-15T15:00:00Z"
}
```

#### POST `/alerts/{id}/resolve`

Mark an alert as resolved.

**Response (200):**
```json
{
  "id": "a1b2c3d4-...",
  "status": "resolved",
  "resolved_by": "admin",
  "resolved_at": "2024-01-15T16:00:00Z"
}
```

---

### 3. Remediation Actions (SOAR-lite)

#### GET `/actions`

List remediation actions.

**Query parameters:** `status` (pending, approved, executed, rolled_back, failed), `page`, `per_page`.

**Response (200):**
```json
{
  "total": 45,
  "actions": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "alert_id": "a1b2c3d4-...",
      "action_type": "block_ip",
      "target": "192.168.1.105",
      "severity": "high",
      "status": "pending",
      "requires_approval": true,
      "demo_mode": true,
      "created_at": "2024-01-15T14:32:11Z"
    }
  ]
}
```

#### POST `/actions/{id}/approve`

Approve a pending high-severity action.

**Response (200):**
```json
{
  "id": "b2c3d4e5-...",
  "status": "approved",
  "approved_by": "admin",
  "executed_at": "2024-01-15T15:05:00Z",
  "result": "SIMULATED — demo mode active. Command: iptables -A INPUT -s 192.168.1.105 -j DROP"
}
```

#### POST `/actions/{id}/rollback`

Rollback an executed or approved action.

**Response (200):**
```json
{
  "id": "b2c3d4e5-...",
  "status": "rolled_back",
  "rolled_back_at": "2024-01-15T15:10:00Z",
  "result": "SIMULATED — demo mode active. Rollback command: iptables -D INPUT -s 192.168.1.105 -j DROP"
}
```

---

### 4. Models

#### GET `/models/status`

Get information about the active detection model.

**Response (200):**
```json
{
  "active_model": "xgboost",
  "model_path": "/app/models/saved/xgboost_cicids2017.joblib",
  "loaded_at": "2024-01-15T00:00:00Z",
  "performance": {
    "dataset": "cicids2017",
    "accuracy": 0.9945,
    "precision": 0.9932,
    "recall": 0.9961,
    "f1": 0.9946,
    "auc": 0.9988
  },
  "inference_stats": {
    "total_predictions": 15234,
    "avg_latency_ms": 12.5,
    "p99_latency_ms": 45.2
  }
}
```

#### POST `/models/activate`

Switch the active model (admin only).

**Request:**
```json
{
  "model_name": "random_forest",
  "model_path": "/app/models/saved/rf_cicids2017.joblib"
}
```

**Response (200):**
```json
{
  "status": "activated",
  "model_name": "random_forest",
  "loaded_at": "2024-01-15T15:20:00Z"
}
```

---

### 5. Detection (On-Demand)

#### POST `/detect`

Submit flow data for on-demand detection (useful for testing).

**Request:**
```json
{
  "flows": [
    {
      "src_ip": "192.168.1.200",
      "dst_ip": "10.0.0.50",
      "src_port": 44123,
      "dst_port": 80,
      "protocol": 6,
      "duration": 0.5,
      "total_fwd_pkts": 10,
      "total_bwd_pkts": 8,
      "total_fwd_bytes": 520,
      "total_bwd_bytes": 4200,
      "fwd_pkt_len_mean": 52.0,
      "bwd_pkt_len_mean": 525.0,
      "flow_iat_mean": 0.05,
      "flow_iat_std": 0.02,
      "syn_flag_count": 1,
      "rst_flag_count": 0,
      "ack_flag_count": 8
    }
  ]
}
```

**Response (200):**
```json
{
  "results": [
    {
      "prediction": "BENIGN",
      "confidence": 0.97,
      "attack_probability": 0.03,
      "model_name": "xgboost",
      "shap_top_features": [
        {"feature": "flow_iat_mean", "shap_value": -0.15, "direction": "benign"},
        {"feature": "total_fwd_pkts", "shap_value": -0.08, "direction": "benign"}
      ]
    }
  ]
}
```

---

### 6. Metrics

#### GET `/metrics`

Prometheus-format metrics endpoint for scraping.

Returns standard Prometheus text format with:
- `idps_alerts_total{severity, attack_type}`
- `idps_detection_latency_seconds{model}`
- `idps_flows_processed_total`
- `idps_actions_total{type, status}`

---

### 7. WebSocket — Real-Time Alert Stream

#### WS `/ws/alerts`

Connect with JWT token as query parameter: `ws://localhost:8000/ws/alerts?token=<jwt>`.

**Server pushes:**
```json
{
  "event": "new_alert",
  "data": {
    "id": "a1b2c3d4-...",
    "attack_type": "DoS",
    "severity": "critical",
    "confidence": 0.98,
    "src_ip": "10.0.0.200",
    "dst_ip": "10.0.0.50",
    "model_name": "xgboost",
    "created_at": "2024-01-15T14:32:10Z"
  }
}
```

---

## Part B — User Manual

### 1. Dashboard Overview

The dashboard is accessible at `http://localhost:3000` (or the configured domain).

#### 1.1 Login

1. Navigate to the dashboard URL.
2. Enter your username and password.
3. Click **Login**. You will be redirected to the Overview page.

#### 1.2 Overview Page

The overview page shows:

- **Alert summary cards:** Total alerts (last 24h), broken down by severity (low/medium/high/critical).
- **Alert timeline chart:** Alerts per hour over the last 24 hours (Chart.js line chart).
- **Attack type distribution:** Pie/donut chart of attack categories.
- **Top attacked targets:** Table of destination IPs with highest alert count.
- **System status:** Model name, uptime, flows processed, average latency.

#### 1.3 Alerts Page

- **Alert table** with columns: Time, Source IP, Destination IP, Attack Type, Severity, Confidence, Status.
- **Filters:** Severity dropdown, attack type dropdown, date range picker, status tabs (Open / Acknowledged / Resolved).
- **Sort:** Click column headers to sort.
- **Click a row** to open the Alert Detail page.

#### 1.4 Alert Detail Page

- **Alert metadata:** All flow fields, timestamps, model used.
- **SHAP Explanation panel:**
  - **Waterfall chart:** Shows how each feature pushed the prediction from the base value toward the final prediction.
  - **Feature importance table:** Ranked list of top contributing features with their values and SHAP contributions.
  - **Interpretation text:** Auto-generated summary, e.g., "This flow was flagged as Brute Force (94% confidence) primarily because of: high SYN flag count (150), low inter-arrival time (0.002s), targeting SSH port (22)."
- **Actions:**
  - **Acknowledge** button — marks alert as reviewed.
  - **Resolve** button — marks alert as handled.
  - **View pending actions** — shows any SOAR-lite actions triggered by this alert.

#### 1.5 Actions Page (SOAR-lite)

- **Pending actions** tab: Actions awaiting approval. Each shows target IP, action type, severity.
  - **Approve** button: Executes the action (or simulates in demo mode).
  - **Reject** button: Dismisses the action.
- **Executed actions** tab: Completed actions with timestamps.
  - **Rollback** button: Reverses the action.
- **Rolled back** tab: History of rolled-back actions.
- **Demo mode indicator:** Banner at top showing "DEMO MODE — actions are simulated".

#### 1.6 Models Page

- **Active model** card: Name, dataset, performance metrics (precision, recall, F1, AUC).
- **Comparison table:** Side-by-side metrics for all trained models.
- **Switch model** button (admin only): Select a different model to activate.

#### 1.7 Settings Page

- **Notification preferences:** Enable/disable email, Slack, push.
- **Demo mode toggle** (admin only): Switch between demo and live mode.
- **Change password.**

---

### 2. Mobile Notifications

If configured, the system sends push notifications via Firebase Cloud Messaging to a lightweight React Native app (optional).

**Notification content:**
```
🚨 CRITICAL Alert
Brute Force detected
Source: 192.168.1.105 → 10.0.0.50:22
Confidence: 94%
Tap to view in dashboard
```

---

### 3. Demo Script

This script demonstrates the full IDPS pipeline end-to-end.

#### Prerequisites
- All Docker containers running (`docker compose up -d`)
- NSL-KDD or CICIDS2017 test data available in `data/`
- Dashboard accessible at `http://localhost:3000`

#### Steps

1. **Open dashboard** in a browser. Log in as `admin`.

2. **Start traffic replay** (in a terminal):
   ```bash
   # Replay a pcap file containing attack traffic
   docker compose exec collector python -m src.collector.replay \
     --pcap data/raw/sample_attack.pcap \
     --speed 1x
   ```

3. **Watch the dashboard:**
   - Alerts appear in real time on the Overview page.
   - Alert count and timeline chart update live.

4. **Inspect an alert:**
   - Click on a high-severity alert.
   - View the SHAP waterfall chart showing why the model flagged this traffic.
   - Read the top contributing features.

5. **Review a pending action:**
   - Navigate to the Actions page.
   - See the SOAR-lite engine has proposed blocking the source IP.
   - Click **Approve** (in demo mode, this is simulated).

6. **Check email/Slack:**
   - Verify that alert notifications were delivered.

7. **Rollback an action:**
   - On the Actions page, click **Rollback** on the approved action.
   - Verify the rollback is logged.

8. **Compare models:**
   - Navigate to Models page.
   - View performance comparison across models and datasets.

---

### 4. Wireframes

#### 4.1 Overview Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] KodeMapper IDPS          [user ▼] [Settings ⚙]  │
├────────┬────────┬────────┬───────────────────────────────┤
│  Nav   │                                                 │
│        │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  Over- │  │Critical│ │  High  │ │ Medium │ │  Low   │  │
│  view  │  │   12   │ │   45   │ │  120   │ │  340   │  │
│        │  └────────┘ └────────┘ └────────┘ └────────┘  │
│  Alerts│                                                 │
│        │  ┌─────────────────────────────────────────┐   │
│  Alert │  │  Alert Timeline (24h line chart)         │   │
│  Detail│  │                                          │   │
│        │  └─────────────────────────────────────────┘   │
│  Actions│                                                │
│        │  ┌──────────────────┐ ┌────────────────────┐   │
│  Models│  │ Attack Type Pie  │ │ Top Targets Table  │   │
│        │  │                  │ │ IP     | Count      │   │
│  Settin│  │                  │ │ 10.0.0.50  | 42    │   │
│        │  └──────────────────┘ └────────────────────┘   │
└────────┴─────────────────────────────────────────────────┘
```

#### 4.2 Alert Detail with SHAP

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Alerts                                        │
│                                                          │
│  Alert: Brute Force — HIGH (94%)         [Acknowledge]   │
│  ──────────────────────────────────────                  │
│  Source: 192.168.1.105:54321                             │
│  Destination: 10.0.0.50:22 (TCP)                         │
│  Time: 2024-01-15 14:32:10 UTC                           │
│  Model: XGBoost                                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SHAP Waterfall Chart                              │  │
│  │                                                    │  │
│  │  base (0.12) ──────────────────── predicted (0.94) │  │
│  │  ████████ dst_port=22         +0.35                │  │
│  │  ██████ flow_iat_mean=0.002   +0.22                │  │
│  │  █████ syn_flag_count=150     +0.15                │  │
│  │  ███ total_fwd_pkts=2000      +0.08                │  │
│  │  █ fwd_pkt_len_mean=52        +0.02                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Interpretation: Flagged as Brute Force primarily due    │
│  to targeting SSH (port 22) with very rapid connection   │
│  attempts (low inter-arrival time) and high SYN count.   │
│                                                          │
│  Pending Action: Block 192.168.1.105   [Approve][Reject] │
└─────────────────────────────────────────────────────────┘
```

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
