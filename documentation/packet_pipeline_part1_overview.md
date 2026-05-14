# Packet Pipeline Documentation — Part 1: The Big Picture

> **Audience:** Team members who are new to networking and intrusion detection.
> **Goal:** Understand the full end-to-end pipeline from live network traffic to ML prediction and dashboard monitoring.

---

## 1. What Are We Building and Why?

### The Problem in Simple Words

Every time a computer sends or receives data over a network, that data travels in small chunks called **packets**. A packet is just a tiny piece of information — like a single page of a long letter.

Now, imagine thousands of these packets flying across the network every second. Some of them are perfectly normal — loading a website, sending an email, streaming a video. But some of them might be **malicious** — someone trying to hack into a server, steal data, or crash a service.

Our job is to:
1. **Watch** all these packets in real time.
2. **Analyze** them to figure out which ones look suspicious.
3. **Alert** the security operator about anything dangerous.
4. Optionally, **block** the bad traffic automatically.

That's what an **Intrusion Detection and Prevention System (IDPS)** does.

### Where We Are Today (The Temporary Setup)

Right now, the project is using a **temporary test setup** that works like this:

```
CSV File (pre-recorded traffic data)
        ↓
MongoDB (stores the CSV rows)
        ↓
Express Server (reads one row every second, simulating live traffic)
        ↓
Python Worker (runs ML model predictions on each row)
        ↓
Sentinel Dashboard (shows alerts in the browser)
```

This is **not** real network traffic — it's simulated. The system reads from a database, not from a live network. This approach was useful for testing the ML models, but it is **not** the final goal.

### Where We Need To Go (The Real Pipeline)

The real system, as shown in the project flowchart, should work like this:

```
Live Network Traffic (actual packets on the wire)
        ↓
Collector Module (captures packets using tcpdump/tshark/Zeek)
        ↓
Redis Queue (fast data handoff)
        ↓
Preprocessor Module (extracts features, encodes, scales)
        ↓
ML Engine Module (ensemble of XGBoost + RF + LightGBM)
        ↓
Backend API (stores alerts, sends notifications)
        ↓
Dashboard (shows everything in real time) + SOAR-lite (automated response)
```

The key difference: **we go from reading fake data in a database to capturing real packets from the network**.

---

## 2. The Pipeline: Step by Step (Plain English)

Think of the pipeline as an assembly line in a factory. Each station has one job, and the product (network data) flows through each station in order.

### Station 1 — Network Traffic (The Source)

This is where everything begins. Your network produces traffic every time anyone does anything — browsing, downloading, uploading, pinging, etc.

To capture this traffic, we need access to it. There are two main ways:

| Method | What It Is | Simple Analogy |
|--------|-----------|----------------|
| **Mirror Port (SPAN)** | The network switch copies all traffic and sends a duplicate to your monitoring machine | Like having a security camera that records everything without interfering |
| **Network TAP** | A physical device plugged into the network cable that copies all data passing through | Like a wiretap on a phone line — it listens without interrupting the call |

**For our project:** We'll use a mirror port on a virtual or lab network. In testing, we can also replay recorded packet files (pcap files).

### Station 2 — Collector Module (The Catcher)

The Collector is like a fisherman with a net. It catches all the packets flowing through the network and saves them.

**Tools used:**
- **tcpdump** — A command-line tool that captures raw packets. Think of it as a basic packet catcher.
- **tshark** — The command-line version of Wireshark. More powerful, can decode packets.
- **Zeek (formerly Bro)** — The most important tool here. It doesn't just capture packets — it understands them. It generates structured logs like:
  - `conn.log` — Connection records (who talked to whom, how long, how many bytes)
  - `http.log` — HTTP request details
  - `dns.log` — DNS query records
  - `ssl.log` — TLS/SSL handshake information

**Why Zeek matters:** Raw packets are hard to feed directly into an ML model. Zeek converts raw packets into structured, tabular data (like a spreadsheet). This makes preprocessing much easier.

### Station 3 — Redis Queue (The Conveyor Belt)

Once the Collector produces flow records, it pushes them into a **Redis queue**.

**What is Redis?** Redis is an in-memory data store that works incredibly fast. Think of it as a high-speed conveyor belt that moves data from one station to the next without delay.

**Why use Redis?**
- The Collector produces data at its own speed.
- The Preprocessor consumes data at its own speed.
- Redis sits in between and makes sure nothing gets lost, even if one side is faster or slower than the other.

### Station 4 — Preprocessor Module (The Translator)

The Preprocessor takes the structured flow data from Redis and transforms it into numbers that the ML model can understand.

**What it does:**
1. **Feature Extraction** — Pulls out the important measurements from each flow record (bytes sent, duration, packet count, protocol type, etc.)
2. **Encoding** — Converts text-based features (like protocol names: "TCP", "UDP") into numbers (6, 17)
3. **Scaling** — Normalizes all numbers to a similar range so the ML model doesn't get confused by very large or very small values

**Output:** A single row of numbers called a **feature vector** — this is what the ML model actually reads.

### Station 5 — ML Engine Module (The Brain)

This is where the actual intrusion detection happens. The ML Engine receives feature vectors and uses a multi-model architecture to decide: **Is this traffic normal or is it an attack?**

According to our architecture, the ML engine consists of two tiers:
1. **Baseline Models (Machine Learning):** **Random Forest (RF)** and **XGBoost**. These are fast, robust, and highly accurate at classifying known attack patterns based on tabular flow data.
2. **Advanced Models (Deep Learning):** **LSTM** (Long Short-Term Memory) networks for analyzing the sequential nature of packets over time, and **Auto-encoders** for unsupervised anomaly detection (finding zero-day attacks that don't match any known pattern).

**Explainability (+ SHAP/LIME):** Alongside the prediction, the engine uses explainers like SHAP or LIME to provide the reasoning behind the decision.

**Output:** For each flow record:
- **Prediction** — The attack class (e.g., "DoS") or "Normal"
- **Confidence** — How sure the model is (e.g., 0.97 means 97% sure)
- **SHAP Explanation** — Why the model made this decision (which features mattered most)

### Station 6 — Backend API (The Control Center)

The Backend API is the central nervous system. It:
1. Receives predictions from the ML Engine
2. Stores alerts in the database (PostgreSQL)
3. Sends real-time alerts to the Dashboard via WebSocket
4. Triggers the Alerting Service (email, Slack, push notifications)
5. Interacts with the SOAR-lite Policy Engine for automated response

### Station 7 — Dashboard (The Screen)

The Dashboard is what the human operator sees. It's a React-based web application that shows:
- Live alert timeline
- Attack type distribution
- Confidence scores
- SHAP force plots (visual explanations of why traffic was flagged)
- SOAR controls (approve/rollback automated actions)

### Station 8 — SOAR-lite (The Automatic Guard)

SOAR stands for **Security Orchestration, Automation, and Response**.

This module can automatically respond to detected attacks:
- Block a malicious IP address using `iptables`
- Deploy new Suricata rules
- Quarantine a host
- All actions are logged and can be rolled back with one click

**Safety:** By default, it runs in **demo mode** — it logs what it _would_ do, without actually doing it.

---

## 3. Role of Each Component — Summary Table

| Component | Role | Simple Analogy |
|-----------|------|----------------|
| **Network TAP / Mirror Port** | Makes network traffic visible to our system | Security camera |
| **Collector (tcpdump/Zeek)** | Catches and records packets, produces structured logs | Fisherman with a net |
| **Redis** | Transfers data between components quickly and reliably | Conveyor belt |
| **Preprocessor** | Converts raw data into ML-ready numbers | Translator |
| **ML Engine (XGBoost+RF+LightGBM)** | Analyzes data and predicts if it's an attack | Brain / Detective |
| **SHAP Explainer** | Explains why a prediction was made | The detective's reasoning notes |
| **Backend API (FastAPI)** | Coordinates everything, stores alerts, sends notifications | Control room operator |
| **PostgreSQL** | Stores alerts, actions, audit logs permanently | Filing cabinet |
| **Dashboard (React)** | Displays everything visually for the human operator | Monitor screen |
| **SOAR-lite** | Automatically blocks/quarantines threats (with approval) | Automatic door lock |
| **Prometheus + Grafana** | Monitors system health (CPU, memory, latency) | Health check nurse |

---

## 4. How the Current Setup Maps to the Real Pipeline

Here's a clear mapping showing what we have now and what replaces it in the real system:

| Current (Temporary) | Real Pipeline | Status |
|---------------------|---------------|--------|
| CSV file as data source | Live network packets (tcpdump/Zeek) | ❌ Not built yet |
| MongoDB as stream source | Redis queue for real-time streaming | ❌ Not built yet |
| Express server reads one row/sec | Zeek produces continuous flow records | ❌ Not built yet |
| Python worker (stdin/stdout bridge) | Python preprocessor + ML module as services | 🟡 Partially exists |
| Ensemble ML model (XGBoost+RF+LightGBM) | Same ensemble model (no change needed) | ✅ Working |
| Sentinel React dashboard | Same dashboard (enhanced with SHAP visuals) | ✅ Working |
| No automated response | SOAR-lite Policy Engine | ❌ Not built yet |
| No system monitoring | Prometheus + Grafana | ❌ Not built yet |

**Key takeaway:** The ML models and the dashboard already work. What's missing is the **left side of the pipeline** — the parts that capture and process live network data.

---

## 5. Evaluating the Tools You Mentioned

You mentioned several tools (Snort, Barnyard, ELK Stack, Suricata, etc.). Let me evaluate each one honestly:

### Snort
**What it is:** A very popular open-source IDS. It uses rules (signatures) to detect known attacks.

**Our verdict:** We are **not** using Snort as our primary detection engine because our innovation is ML-based detection, not signature-based. However, Snort/Suricata could be used alongside our ML system as a complementary layer — catching known attacks while ML catches unknown ones.

### Suricata
**What it is:** A modern, multi-threaded alternative to Snort. Faster, supports more protocols.

**Our verdict:** Suricata is mentioned in our SOAR-lite module — not for detection, but for automated rule deployment (blocking). It's a good tool for the **prevention** part of IDPS. We could also use it as a supplementary signature-based detection layer.

### Barnyard2
**What it was:** A tool that read Snort's binary output (unified2 format) and stored it in databases.

**Our verdict:** **Skip this.** Barnyard2 is outdated and mostly abandoned. Modern Snort/Suricata can output directly to JSON, syslog, or Elasticsearch without needing Barnyard2.

### ELK Stack (Elasticsearch, Logstash, Kibana) vs. Custom Flowchart Approach

You might wonder: *Should we just use the ELK stack instead of building our custom architecture (the Flowchart approach)?*

| Tool | What It Does | Our Flowchart Equivalent |
|------|-------------|----------------------|
| **Elasticsearch** | Stores and searches log data at scale | PostgreSQL (alerts) + Redis (real-time queue) |
| **Logstash** | Ingests, transforms, and routes log data | Custom Python Preprocessor |
| **Kibana** | Visualizes data stored in Elasticsearch | React Dashboard (Sentinel) |

**Our verdict: The Flowchart Approach is much better for our goals.** 

Here is why we are **not** using the full ELK Stack:
1. **Custom ML Feature Engineering:** Logstash is great for parsing logs, but terrible for complex ML feature engineering (like calculating window-based features, packet rates, or running StandardScaler). Our Python Preprocessor is required for this.
2. **Explainable AI (SHAP):** Kibana is excellent for standard charts (pie charts, bar graphs), but it cannot easily render custom ML explainability graphics like D3.js SHAP force plots. Our React Dashboard gives us full control over the UI.
3. **SOAR & Automation Controls:** Kibana is a read-only visualization tool. It does not allow operators to click "Approve" or "Rollback" to trigger Python automation scripts (iptables/Suricata) like our custom React dashboard does.

**Conclusion:** ELK is built for *log search and aggregation*. Our custom Flowchart architecture is specifically built for *Real-Time ML Detection, Explainability, and Automated Response (SOAR)*.

### Better Modern Alternatives

| Your Idea | Better Alternative | Why |
|-----------|-------------------|-----|
| Snort for detection | Zeek + our ML models | ML catches unknown attacks; Zeek provides better structured data for ML |
| Barnyard for conversion | Zeek's native JSON logs | Zeek already outputs structured data — no conversion tool needed |
| Logstash for processing | Custom Python Preprocessor | We need ML-specific feature engineering that Logstash can't do |
| Kibana for frontend | Our React Dashboard (Sentinel) | We need custom SHAP visualizations and SOAR controls |
| Elasticsearch for storage | PostgreSQL + Redis | Better for structured alerts with relational queries |

---

## 6. The Recommended Architecture (Final)

Based on the flowchart and project goals, here is the recommended architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NETWORK SEGMENT                              │
│                                                                      │
│    Servers, Clients, IoT devices — all normal network traffic        │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │  Mirror Port / TAP
                             ▼
              ┌──────────────────────────┐
              │   COLLECTOR MODULE        │
              │   • tcpdump (raw pcap)    │
              │   • Zeek (structured logs)│
              └────────────┬─────────────┘
                           │  JSON flow records
                           ▼
              ┌──────────────────────────┐     ┌───────────────────────┐
              │   REDIS QUEUE             │     │ INFRASTRUCTURE LAYER  │
              │   Channel: flows:raw      │     │ • PostgreSQL & Redis  │
              └────────────┬─────────────┘     │ • Docker Compose      │
                           │                    │ • Prometheus & Grafana│
                           ▼                    │ • Nginx (TLS)         │
              ┌──────────────────────────┐     └───────────────────────┘
              │   PREPROCESSOR MODULE     │
              │   • Feature extraction    │
              │   • Encoding & Scaling    │
              │   • Common Flow Schema    │
              └────────────┬─────────────┘
                           │  feature vectors
                           ▼
              ┌──────────────────────────┐
              │   ML ENGINE MODULE        │
              │   ┌───────────────────┐  │
              │   │  Baseline Models  │  │
              │   │    RF | XGBoost   │  │
              │   ├───────────────────┤  │
              │   │  Advanced Models  │  │
              │   │ LSTM | Auto-encoder  │
              │   └─────────┬─────────┘  │
              │   + SHAP/LIME Explainer   │
              └────────────┬─────────────┘
                           │  prediction + explanation
                           ▼
              ┌──────────────────────────┐
              │   BACKEND API (FastAPI)   │
              │   • REST + WebSocket      │
              │   • JWT Auth              │
              │   • Alert Storage (PgSQL) │
              └─────┬──────────┬─────────┘
                    │          │
          ┌─────────┘          └──────────┐
          ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│   DASHBOARD       │          │   SOAR-LITE       │
│   (React)         │          │   Policy Engine    │
│   • Alerts & SHAP │          │   • iptables block │
│   • Metrics       │          │   • Suricata rules │
│   • SOAR Ctl      │          │   • Rollback/Audit │
└──────────────────┘          └──────────────────┘
          │
          ▼
┌──────────────────┐
│   NOTIFICATIONS   │
│   • Email/Slack   │
│   • Mobile Push   │
└──────────────────┘
```

---

## 7. What's Next?

This document gave you the big picture. The next parts will dive deeper:

- **[Part 2: Live Packet Capture & Collection](packet_pipeline_part2_capture.md)** — How packets are captured, what tools to install, how Zeek works, and how to set up the Collector module.
- **[Part 3: Preprocessing, Feature Engineering & ML Prediction](packet_pipeline_part3_processing_ml.md)** — How raw logs become feature vectors, how the ML ensemble works, and how predictions are produced.
- **[Part 4: Monitoring, Dashboard & Implementation Steps](packet_pipeline_part4_dashboard_implementation.md)** — How the dashboard works, how to set up monitoring, and a step-by-step implementation checklist to build the full pipeline.

---

*Document version: 1.0 — KodeMapper IDPS Project — Packet Pipeline Documentation (Part 1 of 4)*
