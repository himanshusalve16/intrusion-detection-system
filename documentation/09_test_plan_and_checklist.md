# 09 — Test Plan & Checklist

## 1. Testing Strategy

| Level | Scope | Tools | Owner |
|-------|-------|-------|-------|
| **Unit Tests** | Individual functions and classes | pytest, pytest-cov | All developers |
| **Integration Tests** | Module interactions (API ↔ DB, model ↔ API) | pytest, httpx (async), Docker | C (Backend) |
| **Dataset Tests** | Data loading, preprocessing correctness | pytest, pandas assertions | A (Data/ML) |
| **Model Tests** | Training, inference, reproducibility | pytest, PyTorch test utils | A (Data/ML) |
| **API Tests** | Endpoint correctness, auth, validation | pytest, httpx, FastAPI TestClient | C (Backend) |
| **Frontend Tests** | Component rendering, interactions | Jest, React Testing Library | D (Frontend) |
| **End-to-End Tests** | Full pipeline (capture → alert → dashboard) | Playwright or Cypress, Docker Compose | B (Infra) |
| **Performance Tests** | Throughput, latency, resource usage | locust, custom scripts, Prometheus | B (Infra) |
| **Security Tests** | Auth bypass, injection, CORS | Manual + OWASP ZAP | C + B |

**Coverage target:** ≥ 80% line coverage for `src/` (excluding dashboard frontend).

---

## 2. Unit Tests

### 2.1 Collector (`tests/unit/test_collector/`)

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| COL-01 | `ZeekLogParser.parse_conn_log` with valid conn.log | Returns DataFrame with correct columns and dtypes |
| COL-02 | `ZeekLogParser.parse_conn_log` with empty file | Returns empty DataFrame with correct schema |
| COL-03 | `ZeekLogParser.parse_conn_log` with malformed lines | Skips malformed lines, logs warning, returns valid rows |
| COL-04 | `PacketCapture.rotate` triggers at max size | New pcap file created, old file preserved |
| COL-05 | `flow_streamer` publishes to Redis channel | Redis receives JSON message with correct schema |

### 2.2 Preprocessor (`tests/unit/test_preproc/`)

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| PRE-01 | `FeatureExtractor.extract` on known input | Output matches expected feature values (pre-computed) |
| PRE-02 | `FeatureExtractor.extract` with NaN values | NaN handled (imputed or dropped with log) |
| PRE-03 | `FeatureExtractor.extract` with all-zero row | No crash; returns valid (possibly zero) features |
| PRE-04 | `PreprocessingPipeline.fit` then `transform` | Scaled values have ~0 mean, ~1 std on train data |
| PRE-05 | `PreprocessingPipeline.save` and `load` roundtrip | Loaded pipeline produces identical output to original |
| PRE-06 | `load_nslkdd` returns correct shape and label set | Shape matches expected, labels ∈ {normal, DoS, Probe, R2L, U2R} |
| PRE-07 | `load_cicids2017` returns correct shape | Shape matches expected dataset dimensions |
| PRE-08 | `load_unswnb15` returns correct shape | Shape matches expected dataset dimensions |
| PRE-09 | Common schema columns present after any loader | All loaders produce DataFrames with same column names |

### 2.3 Models (`tests/unit/test_models/`)

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| MOD-01 | `RandomForestDetector.train` on small sample | Model trains without error, `predict` returns valid labels |
| MOD-02 | `RandomForestDetector.predict_proba` output shape | Shape = (n_samples, n_classes), values in [0, 1] |
| MOD-03 | `XGBoostDetector.train` on small sample | Model trains without error |
| MOD-04 | Model `save` / `load` roundtrip (RF) | Loaded model produces identical predictions |
| MOD-05 | Model `save` / `load` roundtrip (XGBoost) | Loaded model produces identical predictions |
| MOD-06 | `LSTMDetector.train` on small sequential sample | Loss decreases over 5 epochs |
| MOD-07 | `AutoencoderDetector.train` on benign data | Reconstruction error on benign < on attack |
| MOD-08 | `Explainer.explain` (SHAP) on RF prediction | Returns dict with `shap_values`, `feature_importances` |
| MOD-09 | `Explainer.explain` (LIME) on XGBoost prediction | Returns dict with feature explanations |
| MOD-10 | Fixed seed reproducibility | Same seed + data → identical model weights and predictions |

### 2.4 Automation / SOAR-lite (`tests/unit/test_automation/`)

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| AUT-01 | `PolicyEngine.evaluate` with high-severity DoS alert | Returns `RemediationAction` with `block_ip` type |
| AUT-02 | `PolicyEngine.evaluate` with low-severity probe alert | Returns action with `log_only` type or None |
| AUT-03 | `ActionExecutor.execute` in demo mode | Action logged, command NOT executed, status = "executed (simulated)" |
| AUT-04 | `ActionExecutor.execute` in live mode | iptables command executed (test in sandboxed namespace) |
| AUT-05 | `ActionExecutor.rollback` after execute | Rollback command executed, action status = "rolled_back" |
| AUT-06 | High-severity action requires approval before execution | `execute` raises error if action not approved |
| AUT-07 | Audit log entry created on action execution | Audit log table has new row with correct event_type |

---

## 3. Integration Tests

### 3.1 API Integration (`tests/integration/test_api/`)

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| API-01 | POST `/auth/login` with valid credentials | 200, returns JWT token |
| API-02 | POST `/auth/login` with invalid credentials | 401, error message |
| API-03 | GET `/alerts` without token | 401 Unauthorized |
| API-04 | GET `/alerts` with valid token | 200, returns paginated alerts |
| API-05 | GET `/alerts?severity=high` | Returns only high-severity alerts |
| API-06 | GET `/alerts/{id}` with valid ID | 200, includes `shap_explanation` field |
| API-07 | GET `/alerts/{id}` with invalid ID | 404 Not Found |
| API-08 | POST `/alerts/{id}/acknowledge` | Alert status changes to "acknowledged" |
| API-09 | POST `/detect` with flow data | Returns prediction + SHAP explanation |
| API-10 | POST `/actions/{id}/approve` as admin | Action status changes, audit log created |
| API-11 | POST `/actions/{id}/approve` as viewer | 403 Forbidden |
| API-12 | POST `/actions/{id}/rollback` | Action rolled back, audit log created |
| API-13 | WebSocket `/ws/alerts` receives new alerts | Client receives alert within 2 seconds of creation |

### 3.2 Pipeline Integration (`tests/integration/test_pipeline/`)

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| PIP-01 | Flow record → Redis → Preprocessor → Features | Feature vector matches expected output |
| PIP-02 | Feature vector → Model → Prediction + SHAP | Valid prediction with explanation |
| PIP-03 | Detection → Alert stored in PostgreSQL | Alert row created with all fields |
| PIP-04 | Alert creation → WebSocket notification | Dashboard client receives alert event |
| PIP-05 | Alert → Policy Engine → Action created | Remediation action created with correct type |
| PIP-06 | Action approval → Execution (demo mode) | Action simulated, audit log written |

---

## 4. Dataset Test Cases

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| DAT-01 | NSL-KDD file integrity (SHA-256 checksum) | Matches stored checksum |
| DAT-02 | CICIDS2017 file integrity | Matches stored checksum |
| DAT-03 | UNSW-NB15 file integrity | Matches stored checksum |
| DAT-04 | NSL-KDD class distribution matches known values | Normal: ~67K, DoS: ~45K, Probe: ~11K, R2L: ~995, U2R: ~52 |
| DAT-05 | CICIDS2017 has no all-NaN rows after preprocessing | Zero all-NaN rows |
| DAT-06 | UNSW-NB15 label mapping produces expected categories | 10 categories (incl. Normal) |
| DAT-07 | Common schema output identical for same data re-processed | Deterministic output |

---

## 5. False Positive Handling

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| FP-01 | Model on purely benign traffic (CICIDS2017 benign subset) | FPR < 1% |
| FP-02 | Threshold adjustment reduces FPR | Higher threshold → lower FPR, lower recall (verify tradeoff) |
| FP-03 | SHAP explanation on false positive | Top features should NOT show strong attack indicators |
| FP-04 | Operator acknowledges FP → training feedback logged | Feedback record stored for potential retraining |

---

## 6. Performance / Load Tests

### 6.1 Inference Throughput (`tests/performance/`)

| Test ID | Test Case | Pass Criteria |
|---------|-----------|---------------|
| PERF-01 | Batch inference: 10,000 flows through RF | > 5,000 flows/sec |
| PERF-02 | Batch inference: 10,000 flows through XGBoost | > 3,000 flows/sec |
| PERF-03 | Batch inference: 10,000 flows through LSTM | > 500 flows/sec |
| PERF-04 | Single-flow inference + SHAP (RF) | < 200ms |
| PERF-05 | Single-flow inference + SHAP (XGBoost) | < 500ms |

### 6.2 API Load Test

| Test ID | Test Case | Pass Criteria |
|---------|-----------|---------------|
| PERF-06 | 100 concurrent `GET /alerts` requests | p99 response time < 500ms |
| PERF-07 | 50 concurrent `POST /detect` requests | p99 response time < 2s |
| PERF-08 | WebSocket: 20 concurrent clients | All receive alerts within 2s |

### 6.3 System Resource Test

| Test ID | Test Case | Pass Criteria |
|---------|-----------|---------------|
| PERF-09 | Full pipeline running for 1 hour | CPU < 80%, Memory < 4 GB (API container) |
| PERF-10 | Redis queue under load (5000 flows/sec) | Queue depth stable (not growing unbounded) |
| PERF-11 | PostgreSQL under alert storm (100 alerts/min) | Insert latency < 50ms |

---

## 7. Security Tests

| Test ID | Test Case | Expected Result |
|---------|-----------|-----------------|
| SEC-01 | Access API without JWT | 401 on all protected endpoints |
| SEC-02 | Access admin endpoint with viewer token | 403 Forbidden |
| SEC-03 | SQL injection in alert filter parameters | No SQL error; parameterized queries prevent injection |
| SEC-04 | XSS payload in alert source IP field | Escaped in dashboard; no script execution |
| SEC-05 | CORS: request from unauthorized origin | Rejected by CORS policy |
| SEC-06 | JWT with expired token | 401 Unauthorized |
| SEC-07 | JWT with tampered payload | 401 Unauthorized |
| SEC-08 | Rate limiting on `/auth/login` | Returns 429 after 10 failed attempts in 1 minute |

---

## 8. Test Execution

### Running Tests

```bash
# All unit tests
pytest tests/unit/ -v --cov=src --cov-report=html

# Integration tests (requires Docker services running)
docker compose up -d postgres redis
pytest tests/integration/ -v

# Performance tests
pytest tests/performance/ -v --benchmark-only

# Frontend tests
cd src/dashboard && npm test

# End-to-end
docker compose up -d
pytest tests/e2e/ -v
```

### CI Integration

Tests run automatically on every push/PR via GitHub Actions (see `03_implementation_plan.md`, CI/CD section).

---

## 9. Pre-Submission Checklist

- [ ] All unit tests pass (`pytest tests/unit/`)
- [ ] All integration tests pass (`pytest tests/integration/`)
- [ ] Code coverage ≥ 80%
- [ ] No critical security test failures
- [ ] Performance targets met (throughput, latency)
- [ ] FPR < 1% on benign traffic
- [ ] Docker Compose builds and starts clean from scratch
- [ ] Demo script runs successfully end-to-end
- [ ] All 10 documentation files complete and reviewed
- [ ] README.md has setup instructions
- [ ] No hardcoded credentials in codebase (`.env` used)
- [ ] `.gitignore` excludes data files, model artifacts, `.env`
- [ ] Datasets downloadable via provided script
- [ ] Fixed random seed produces reproducible results
- [ ] All references and attributions complete in `08_references_and_attributions.md`

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
