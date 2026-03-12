# 06 — Deployment & Operations

## 1. Deployment Overview

The IDPS platform is deployed as a set of Docker containers orchestrated by Docker Compose (development/demo) or Kubernetes/K3s (optional production).

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                              │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ collector │  │   api    │  │dashboard │  │   automation     │   │
│  │  :8001    │  │  :8000   │  │  :3000   │  │   (internal)     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ postgres │  │  redis   │  │prometheus│  │    grafana       │   │
│  │  :5432   │  │  :6379   │  │  :9090   │  │    :3001         │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      nginx (reverse proxy)                    │  │
│  │                      :80 / :443                               │  │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| Ubuntu | 22.04 LTS |
| Docker | 24.0+ |
| Docker Compose | v2.20+ |
| Git | 2.30+ |
| Python (for local dev) | 3.10+ |
| Node.js (for local dev) | 20 LTS |
| Available RAM | 8 GB (16 GB recommended) |
| Available Disk | 20 GB (50 GB if storing datasets locally) |

---

## 3. Deployment Steps

### 3.1 Clone & Configure

```bash
# Clone the repository
git clone https://github.com/<org>/idps-project.git
cd idps-project

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

**`.env` file contents:**

```env
# Database
POSTGRES_USER=idps
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=idps
DATABASE_URL=postgresql://idps:<password>@postgres:5432/idps

# Redis
REDIS_URL=redis://redis:6379/0

# API
JWT_SECRET=<random-256-bit-hex>
API_HOST=0.0.0.0
API_PORT=8000
DEMO_MODE=true

# Alerting
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
ALERT_EMAIL_TO=team@example.com

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# Collector
CAPTURE_INTERFACE=eth0
BPF_FILTER=tcp or udp

# Model
ACTIVE_MODEL=xgboost
MODEL_PATH=/app/models/saved/xgboost_cicids2017.joblib
SCALER_PATH=/app/models/saved/scaler_cicids2017.joblib
```

### 3.2 Build & Start

```bash
# Build all Docker images
docker compose build

# Start all services
docker compose up -d

# Verify all containers are running
docker compose ps

# Check logs
docker compose logs -f api
```

### 3.3 Initialize Database

```bash
# Run database migrations
docker compose exec api python -m src.api.db.migrate

# Seed initial admin user
docker compose exec api python -m src.api.db.seed
```

### 3.4 Download Datasets (for training/evaluation)

```bash
# On host or inside container
bash data/scripts/download_datasets.sh
```

---

## 4. Docker Configurations

### 4.1 `infra/docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  api:
    build:
      context: ..
      dockerfile: infra/Dockerfile.api
    env_file: ../.env
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - model_artifacts:/app/models/saved
    restart: unless-stopped

  collector:
    build:
      context: ..
      dockerfile: infra/Dockerfile.collector
    env_file: ../.env
    network_mode: host          # Needs host network for packet capture
    cap_add:
      - NET_ADMIN
      - NET_RAW
    volumes:
      - pcap_data:/app/data/raw
    depends_on:
      - redis
    restart: unless-stopped

  dashboard:
    build:
      context: ..
      dockerfile: infra/Dockerfile.dashboard
    ports:
      - "3000:80"
    depends_on:
      - api
    restart: unless-stopped

  automation:
    build:
      context: ..
      dockerfile: infra/Dockerfile.automation
    env_file: ../.env
    cap_add:
      - NET_ADMIN               # Required for iptables (live mode only)
    depends_on:
      - api
      - redis
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:v2.48.0
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prom_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:10.2.0
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api
      - dashboard
      - grafana

volumes:
  pgdata:
  prom_data:
  grafana_data:
  model_artifacts:
  pcap_data:
```

### 4.2 Sample Dockerfile — API (`infra/Dockerfile.api`)

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY src/ src/
COPY experiments/ experiments/

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4.3 Sample Dockerfile — Dashboard (`infra/Dockerfile.dashboard`)

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY src/dashboard/package*.json ./
RUN npm ci
COPY src/dashboard/ .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY infra/nginx-dashboard.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 5. Monitoring & Alerting

### 5.1 Prometheus Configuration (`infra/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "api"
    static_configs:
      - targets: ["api:8000"]
    metrics_path: /metrics

  - job_name: "node"
    static_configs:
      - targets: ["localhost:9100"]    # node_exporter on host

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
```

### 5.2 Key Grafana Dashboards

| Dashboard | Panels |
|-----------|--------|
| **System Health** | CPU %, Memory %, Disk I/O, Network I/O |
| **IDPS Pipeline** | Flows/sec processed, detection latency histogram, queue depth |
| **Model Performance** | Alert rate, FPR over time, confidence distribution |
| **Alert Overview** | Alerts/hour by severity, top attacked IPs, attack type distribution |

### 5.3 Alerting Rules (Prometheus Alertmanager)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| HighCPU | CPU > 90% for 5 min | warning | Slack notification |
| HighMemory | Memory > 90% for 5 min | warning | Slack notification |
| APIDown | API health check failed for 1 min | critical | Email + Slack |
| QueueBacklog | Redis queue depth > 10000 | warning | Slack notification |
| HighAlertRate | > 100 alerts/min for 5 min | warning | Slack + email |
| ModelInferenceLatency | p99 latency > 2s for 5 min | warning | Slack notification |

---

## 6. Rollback Plan

### 6.1 Application Rollback

```bash
# Tag current version before deploying
docker compose exec api cat /app/VERSION  # Note current version

# Roll back to previous image
docker compose pull api  # or specify previous tag
docker compose up -d api

# If DB migration needs reversal
docker compose exec api python -m src.api.db.rollback --steps 1
```

### 6.2 Model Rollback

```bash
# Models are versioned in experiments/ directory
# Switch active model via API or env var

# Via API (requires admin JWT)
curl -X POST http://localhost:8000/api/v1/models/activate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"model_name": "random_forest", "model_path": "/app/models/saved/rf_cicids2017.joblib"}'

# Or update .env and restart
ACTIVE_MODEL=random_forest
MODEL_PATH=/app/models/saved/rf_cicids2017.joblib
docker compose restart api
```

### 6.3 Prevention Action Rollback

See `src/automation/rollback.py`. Each remediation action stores its rollback command. Rollback can be triggered:

1. **Via dashboard:** Click "Rollback" button on the action in Actions page.
2. **Via API:** `POST /api/v1/actions/{id}/rollback`.
3. **Via CLI:** `python -m src.automation.rollback --action-id <uuid>`.

---

## 7. Prevention Automation — Safe Operation

### 7.1 Demo Mode (Default)

When `DEMO_MODE=true` (default):

* All remediation actions are **simulated**: the command is logged but NOT executed.
* The audit log records `{"executed": false, "reason": "demo_mode"}`.
* Dashboard shows actions with a "SIMULATED" badge.
* This is the safe default for all demonstrations and testing.

### 7.2 Live Mode

When `DEMO_MODE=false` (only for isolated lab/sandbox):

* **Low-severity actions** (rate-limit, log-only) execute automatically.
* **Medium-severity actions** (temporary block for 5 min) execute automatically with auto-rollback timer.
* **High-severity actions** (permanent block, host quarantine) require **human approval** via dashboard or API before execution.

### 7.3 iptables Integration

```bash
# Block an IP (executed by automation service)
iptables -A INPUT -s <attacker_ip> -j DROP

# Rollback: remove the block
iptables -D INPUT -s <attacker_ip> -j DROP

# Rate-limit an IP
iptables -A INPUT -s <attacker_ip> -m limit --limit 10/min -j ACCEPT
iptables -A INPUT -s <attacker_ip> -j DROP
```

The automation container has `CAP_NET_ADMIN` capability but operates on a **sandboxed network namespace** in the demo environment to prevent affecting the host.

### 7.4 Suricata Integration (Optional)

```bash
# Deploy a custom Suricata rule
echo 'drop tcp $EXTERNAL_NET any -> $HOME_NET any (msg:"IDPS: Block attacker"; \
  flow:to_server; sid:9000001; rev:1;)' >> /etc/suricata/rules/idps-custom.rules

# Reload Suricata rules without restart
suricatasc -c reload-rules
```

---

## 8. Maintenance

### 8.1 Log Rotation

* Application logs: rotated daily, kept for 30 days (configured via Python `logging.handlers.RotatingFileHandler`).
* Pcap files: rotated by size (100 MB), kept for 7 days.
* PostgreSQL: alerts older than 90 days archived via cron job.

### 8.2 Backup

```bash
# Database backup (daily cron)
docker compose exec postgres pg_dump -U idps idps | gzip > backup/idps_$(date +%Y%m%d).sql.gz

# Model artifacts (versioned in git / MLflow)
# Prometheus data: volume backup
```

### 8.3 Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose build
docker compose up -d

# Run any new migrations
docker compose exec api python -m src.api.db.migrate
```

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
