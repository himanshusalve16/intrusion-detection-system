# 04 — Monthly Schedule (6 Months)

> **Team:** 4 members — A (Data & ML), B (Infrastructure & DevOps), C (Backend & Integration), D (Frontend & Documentation)
>
> Each month ends with a **demo commit** and a review meeting.

---

## Month 1 — Foundations & Dataset Setup

**Goal:** Establish the project foundation — repo, environment, datasets, and initial documentation.

| Week | Task | Owner | Deliverable |
|------|------|-------|-------------|
| 1 | Finalize project scope and write `01_project_overview.md` | D | Approved overview document |
| 1 | Set up GitHub repo, branch strategy (main/dev/feature), CI skeleton | B | Repo with CI passing |
| 1 | Set up development environment (Ubuntu VM/WSL, Python venv, Node) | B | `scripts/setup_dev.sh` |
| 2 | Download and inspect NSL-KDD, CICIDS2017, UNSW-NB15 datasets | A | `data/` populated, `scripts/download_datasets.sh` |
| 2 | Write `02_tech_and_architecture.md` with architecture diagrams | D + C | Architecture doc |
| 2 | Set up Docker + docker-compose skeleton (postgres, redis) | B | `infra/docker-compose.yml` |
| 3 | Implement dataset loaders (`dataset_loader.py`) for all 3 datasets | A | Common schema DataFrames loading |
| 3 | Initial EDA notebook — class distributions, feature statistics | A | `notebooks/01_eda.ipynb` |
| 3 | Scaffold FastAPI project structure (`src/api/`) | C | API skeleton with health check |
| 4 | Write `03_implementation_plan.md` and `04_monthly_schedule_6months.md` | D | Implementation docs |
| 4 | Begin feature extraction (`feature_extractor.py`) | A | Initial feature pipeline |
| 4 | Set up Zeek in dev environment, test pcap parsing | B | Zeek parsing confirmed |

**Month 1 milestone:** Repo skeleton complete, all 3 datasets loaded into common schema, EDA notebook, architecture docs, dev environment reproducible.

---

## Month 2 — Feature Engineering & Baseline Models

**Goal:** Complete feature pipeline, train baseline models, first evaluation results, and dashboard skeleton.

| Week | Task | Owner | Deliverable |
|------|------|-------|-------------|
| 5 | Complete feature extraction pipeline (encoding, scaling) | A | `src/preproc/` complete |
| 5 | Implement `BaseDetector` interface and Random Forest model | A | `src/models/random_forest.py` |
| 5 | Set up PostgreSQL schema, ORM models | C | DB tables created |
| 6 | Train Random Forest on all 3 datasets, collect metrics | A | Experiment results in `experiments/` |
| 6 | Implement XGBoost model, train and evaluate | A | `src/models/xgboost_model.py` |
| 6 | Implement core API endpoints: alerts CRUD, auth (JWT) | C | API endpoints passing tests |
| 6 | Scaffold React dashboard (CRA/Vite), routing, layout | D | Dashboard skeleton |
| 7 | Implement evaluation script (precision, recall, F1, AUC, confusion matrix) | A | `src/models/evaluate.py` |
| 7 | First comparison notebook: RF vs XGBoost across datasets | A | `notebooks/02_baseline_comparison.ipynb` |
| 7 | Dashboard: overview page with mock data (alert counts, charts) | D | Dashboard overview page |
| 8 | Write `05_experimental_plan_and_metrics.md` | D + A | Experimental plan doc |
| 8 | API integration: connect alert creation to DB | C | Alerts stored in PostgreSQL |
| 8 | Set up Prometheus + Grafana for system monitoring | B | Monitoring stack running |

**Month 2 milestone:** Baseline models (RF, XGBoost) trained on 3 datasets with evaluation report; API serves alerts; dashboard skeleton renders mock data; monitoring stack running.

---

## Month 3 — Advanced Models & Innovation Start

**Goal:** Implement advanced ML models, start SHAP explainability integration, and begin SOAR-lite policy engine.

| Week | Task | Owner | Deliverable |
|------|------|-------|-------------|
| 9 | Implement LSTM model for sequential flow detection | A | `src/models/lstm_model.py` |
| 9 | Implement Autoencoder for anomaly detection | A | `src/models/autoencoder.py` |
| 9 | Begin SHAP/LIME integration (`explain.py`) | A | SHAP explanations for RF/XGBoost |
| 9 | Design SOAR-lite policy rules (alert type → action mapping) | C + B | Policy specification doc |
| 10 | Train LSTM and Autoencoder, hyperparameter tuning | A | Training logs, best models |
| 10 | Implement SOAR-lite `PolicyEngine` and `ActionExecutor` | C | `src/automation/policy_engine.py`, `executor.py` |
| 10 | Dashboard: alert list page with real API data | D | Functional alert list |
| 11 | Full model comparison notebook (all 4 models × 3 datasets) | A | `notebooks/03_full_comparison.ipynb` |
| 11 | Implement iptables action module (demo mode) | B | `src/automation/actions/iptables_action.py` |
| 11 | Dashboard: SHAP visualization component (force plot / waterfall) | D | `ShapChart.tsx` component |
| 12 | Integrate SHAP into prediction pipeline (predict → explain → store) | A + C | Explanations stored in alert DB |
| 12 | API: SOAR-lite endpoints (list/approve/rollback actions) | C | Action API endpoints |
| 12 | Begin `08_references_and_attributions.md` | D | Draft references doc |

**Month 3 milestone:** All 4 models trained and compared; SHAP explanations integrated into pipeline; SOAR-lite policy engine with demo-mode iptables actions; dashboard shows real alerts with SHAP.

---

## Month 4 — Integration & End-to-End Pipeline

**Goal:** Wire all components together into a working end-to-end pipeline: capture → detect → alert → prevent.

| Week | Task | Owner | Deliverable |
|------|------|-------|-------------|
| 13 | Implement collector → preprocessor streaming (Redis queue) | B + A | Live flow ingestion pipeline |
| 13 | Implement real-time inference service (model serving) | A + C | Detection service running |
| 13 | WebSocket alert streaming (backend → dashboard) | C + D | Real-time alerts in UI |
| 14 | Implement email + Slack alerting service | C | Email/Slack notifications working |
| 14 | SOAR-lite: approval gate UI (approve/rollback buttons in dashboard) | D | Functional SOAR controls |
| 14 | Integration: detection → alert → SOAR policy evaluation → action | C + B | End-to-end flow |
| 15 | Demo script: replay pcap → system detects → alerts → simulated block | B + C | Demo script working |
| 15 | Suricata rule deployment action (optional) | B | `src/automation/actions/suricata_action.py` |
| 15 | Dashboard: alert detail page with full SHAP explanation | D | Alert detail page |
| 16 | Integration testing — full pipeline end-to-end | All | All tests passing |
| 16 | Write `06_deployment_and_ops.md` | B + D | Deployment doc |
| 16 | Write `07_api_and_user_manual.md` | C + D | API spec and manual |

**Month 4 milestone:** End-to-end pipeline working in sandbox: pcap replay → detection → alert on dashboard with SHAP → email/Slack notification → simulated iptables block. Demo script ready.

---

## Month 5 — Hardening, UI Polish & Evaluation

**Goal:** Optimize performance, reduce false positives, polish UI, and complete cross-dataset evaluation.

| Week | Task | Owner | Deliverable |
|------|------|-------|-------------|
| 17 | Performance profiling — reduce inference latency | A + C | Latency < 500ms per flow |
| 17 | False positive analysis and threshold tuning | A | Improved FPR metrics |
| 17 | Dashboard: model comparison page with charts | D | Models page |
| 18 | Cross-dataset evaluation (train on X, test on Y) | A | Generalization analysis |
| 18 | Load/stress testing — measure throughput (flows/sec) | B | Performance report |
| 18 | Dashboard polish: responsive design, error states, loading states | D | Polished UI |
| 19 | Write `09_test_plan_and_checklist.md` | C + D | Test plan doc |
| 19 | Complete unit and integration tests (≥ 80% coverage) | All | Tests passing with coverage report |
| 19 | System monitoring dashboards in Grafana | B | Grafana dashboards |
| 20 | Write `10_future_work_and_risks.md` | D | Future work doc |
| 20 | Finalize `05_experimental_plan_and_metrics.md` with actual results | A + D | Updated experimental doc |
| 20 | Generate evaluation report with all charts/tables | A | Final evaluation notebook |

**Month 5 milestone:** System hardened and optimized; cross-dataset evaluation complete; UI polished; test coverage ≥ 80%; all evaluation charts and metrics finalized.

---

## Month 6 — Finalize, Demo & Submission

**Goal:** Complete all documentation, prepare presentation, record demo, submit.

| Week | Task | Owner | Deliverable |
|------|------|-------|-------------|
| 21 | Finalize all 10 documentation files | D (with input from all) | Complete docs |
| 21 | Finalize `08_references_and_attributions.md` — verify all citations | D | Complete references |
| 21 | Clean up code — remove debug code, add essential comments | All | Clean codebase |
| 22 | Prepare presentation slides | D | Slide deck |
| 22 | Record demo video / GIFs of system in action | B + D | Demo recording |
| 22 | Final integration test — full rehearsal of demo | All | Demo rehearsed |
| 23 | Final README.md update with setup instructions | B | Complete README |
| 23 | Tag release `v1.0.0`, ensure Docker images build clean | B | Tagged release |
| 23 | Peer review all docs and code | All | Review complete |
| 24 | Buffer week: fix any remaining issues | All | All issues resolved |
| 24 | Submit final repo and documentation | D | Submission |
| 24 | Presentation / viva | All | Presented |

**Month 6 milestone:** All documentation complete, demo recorded, presentation delivered, repo tagged and submitted.

---

## Summary Gantt View

```
Month:     1           2           3           4           5           6
          ┌───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐
Infra     │███████████│░░░░░░░░░░░│           │           │     ░░░░░░│░░░        │
Data/ML   │  ████████ │███████████│███████████│██████     │███████████│           │
API       │         ░░│███████████│███████████│███████████│     ░░░░░░│           │
Dashboard │           │    ███████│███████████│███████████│███████████│░░░        │
SOAR-lite │           │           │   ████████│███████████│    ░░░░░░░│           │
Docs      │████  ████ │       ████│          █│      █████│██████████ │███████████│
Testing   │           │           │           │        ███│███████████│   ░░░     │
          └───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘

Legend: █ = primary focus   ░ = secondary / maintenance
```

---

*Document version: 1.0 — Created as part of the KodeMapper IDPS project.*
