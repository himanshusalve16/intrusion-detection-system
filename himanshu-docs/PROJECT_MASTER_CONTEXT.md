# Project Master Context

**Repository audited:** `https://github.com/himanshusalve16/intrusion-detection-system` (public at time of audit)
**Audit date:** September 18, 2026 — **updated same day** after the team pushed a new commit adding a substantial deep-learning implementation.
**Method:** Direct retrieval of repository file tree and file contents via GitHub. Every file cited below was read in full unless marked otherwise. No file content in this document was inferred or guessed.
**Source-of-truth hierarchy applied throughout:** (1) source code, (2) config/schemas/saved reports/tests, (3) project documentation, (4) comments/TODOs, (5) the uploaded IEEE literature-review paper (context only).

> **Revision note:** This is a full update of the first-pass audit. The update was triggered by a new commit that adds a second-generation DL pipeline (PyTorch Lightning, Transformer/VAE architectures, versioned preprocessing artifacts, and — for the first time in this repo — genuinely saved, reproducible evaluation reports). Every section below reflects the repository as it now stands; nothing from the prior pass is carried over without re-verification. Where the update meaningfully changes a conclusion from the first pass, that is called out explicitly.

---

## 1. Project Identity

- **Project name (as used in repo):** KodeMapper — "AI-Driven Intrusion Detection & Prevention System (IDPS)" *(README.md, others/Project_Synopsis.md)*
- **Objective (as stated by the team):** an end-to-end AI-based Network Intrusion Detection and Prevention System that adds two things most academic ML-IDS work lacks — per-alert explainability (SHAP/LIME) and automated, human-gated remediation (a "SOAR-lite" policy engine). The README now also markets a "Hybrid Multi-Engine Detection" capability (ML baseline + DL Transformer + AE anomaly canary) — see §16 for how much of that is actually wired up.
- **Domain:** Network Intrusion Detection / Prevention (NIDS/NIPS), flow-based (not host-based, not deep packet inspection).
- **Problem being solved (as framed by the team):** signature IDS (Snort/Suricata) miss zero-day attacks; academic ML-IDS papers stop at offline accuracy numbers and give operators no explanation and no way to act.
- **Team:** "KodeMapper", a 4-member final-year team (documentation/01_project_overview.md lists anonymized roles A–D). The GitHub account owner's name and institution (Himanshu Salve, Dept. of Electronics Engineering, Shri Ramdeobaba College of Engineering and Management, Nagpur) match a co-author of the IEEE literature-review paper supplied alongside this repository, and the repo's `/literature` folder contains the same 25 source papers cited in that paper. **This connection is a reasonable inference from matching names/institution/citation set, not an independently confirmed fact.**
- **Target users / use case:** security operators in a lab/enterprise network segment; explicitly a demo/academic prototype, not production.
- **New in this commit:** `himanshu-docs/PROJECT_MASTER_CONTEXT.md` (55.9 KB) now exists in the repo. This is presumably the team's own copy of a prior version of this same audit document — it was not used as a source for this update (that would be circular); this update was built the same way as the first pass, straight from source code and stored artifacts.

---

## 2. Executive Project Overview

The picture from the first audit — an ambitious planned microservice architecture next to a much thinner working prototype — still holds at the system-integration layer (backend, dashboard, SOAR, deployment, testing). **What has materially changed is the ML/DL layer**, which has gone from "several exploratory scripts with unlogged console output" to a genuinely professional, versioned, reproducible pipeline:

- A proper `dl_pipeline` package (PyTorch Lightning) implementing five distinct architectures: `FlowLSTM` (BiLSTM+attention), `AnomalyAutoencoder` (dense AE), `LSTMAutoencoder` / `MemoryLSTMAutoencoderLightning` (sequence AEs with a memory-addressing mechanism), `TemporalTransformerClassifier` (a small Transformer encoder used for both the binary attack-gate and the multiclass stage), and `TemporalOneClassVAE` (a Transformer-based one-class VAE for anomaly scoring).
- A real, versioned (`_v1_20260612`) preprocessing pipeline: engineered features (byte/packet ratios, well-known-port flags), `OneHotEncoder` + `QuantileTransformer`, a chronological 70/15/15 split, and 10-step sliding-window sequence construction — with the fitted encoder/scaler/config/feature-list **actually committed** to `data/artifacts/`.
- Two trained models with **committed weights** (`.pt` and `.onnx`) and — critically — **committed, code-generated evaluation JSON reports**: a Stage-1 binary "attack gate" (test accuracy 97.55%) and a Stage-2 five-class attack classifier (test macro recall 79.48%). These are the first genuinely independently-verifiable numeric results anywhere in this repository (see §18).
- A written, honest experiment log (`experiments/lstm_training_journey.md`) documenting a real BiLSTM → BiLSTM+Attention+FocalLoss → Transformer progression, including a diagnosed and explained failure mode (a "double-weighting" class-imbalance bug), with numbers that match the committed JSON reports exactly.

**But the integration step that would make this reach the live dashboard is missing.** `service/api/src/server.js` now defaults to spawning `service/models/src/unified_predictor_worker.py` as its prediction backend — and **that file does not exist anywhere in the repository.** The only predictor script that does exist and still works, `live_predictor_worker.py`, is byte-for-byte unchanged from the previous commit and still only serves the original XGBoost+RF+LightGBM tree ensemble — it has no knowledge of the new DL/AE models. As committed, running the system with its own `.env.example` template (`PREDICTOR_SCRIPT=` blank) would make the Node server try to spawn a nonexistent Python script and fail to start the prediction bridge. See §3, §9, §16, and §33 for the full detail.

So the honest summary of this update is: **the DL modeling work is real, substantial, and — for the first time — independently verifiable from stored artifacts. The "hybrid multi-engine" live system the README now advertises is not yet wired together.**

---

## 3. Actual Implemented System

Two things now need to be described separately, because they no longer match.

**3a. What the server is built to do (per the new `server.js`):**
```
CSV/MongoDB row (UNSW-NB15 sample, unchanged sampling logic)
        │  (1s poll, or CSV-fallback mode — new USE_CSV_FALLBACK flag)
        ▼
Express server spawns service/models/src/unified_predictor_worker.py
        │  (stdin/stdout JSON bridge, now with a 120s startup timeout to
        │   allow for DL model loading, and a 30s per-prediction timeout)
        ▼
Expected response fields: prediction, confidence, ml_prediction, ml_confidence,
  dl_prediction, dl_confidence, dl_stage1_attack_prob, ae_anomaly_score,
  zero_day_flag, engine_agreement, verdict_source ("ml"/"dl"/"both")
        │
        ▼
Express tracks per-engine attribution stats (mlOnlyDetections, dlOnlyDetections,
  bothDetections, zeroDay count, attackBreakdown) and exposes them via two new
  endpoints: GET /stats and GET /metrics (the latter now genuinely reads and
  returns the real stored dl_stage1_binary_report_v1.0.json / dl_stage2_
  multiclass_report_v1.0.json / dl_stage1_binary_threshold_v1.0.json files)
```

**3b. What can actually run today:** `service/models/src/unified_predictor_worker.py` — the script `server.js` needs — **does not exist** (confirmed by a direct file lookup that returned "Path not found in repository"). `.env.example`'s `PREDICTOR_SCRIPT` is blank, so nothing overrides the missing default. This means the live serving loop, as committed, cannot currently start end-to-end. If an operator manually points `PREDICTOR_SCRIPT` at the still-present `live_predictor_worker.py`, the server *will* run — but only in the original Part-1 mode (tree ensemble only; every `dl_*`/`ae_*`/`zero_day_flag`/`verdict_source` field the new dashboard-facing state expects will simply be `undefined`).

The one-second CSV/MongoDB replay loop itself (§3 of the first pass) is otherwise unchanged: still a fixed 1,000-row UNSW-NB15 sample, still no live traffic.

---

## 4. Repository Structure

Reconstructed from a full recursive listing (binary files noted but not opened). **New since the first pass are marked `[NEW]`.**

```
/
├── README.md, run_guide.md, requirements.txt, .gitignore  (.gitignore now excludes
│                only final_rf.pkl by name, not the whole artifacts/ folder — see §17)
├── data/
│   ├── UNSW_NB15_training-set.csv, UNSW_NB15_testing-set.csv  (unchanged, committed)
│   └── artifacts/  [NEW] — 5 versioned preprocessing artifacts, all committed:
│       feature_list_unsw_v1_20260612.json, onehot_encoder_unsw_v1_20260612.pkl,
│       preprocessing_config_unsw_v1_20260612.json, scaler_unsw_v1_20260612.pkl,
│       split_indices_unsw_v1_20260612.json
├── documentation/  … same 10 core docs, plus [NEW]:
│   ├── dl_datasets_plan.md (41 KB), dl_datasets_walkthrough (3 KB, no extension),
│   └── dl_models_plan.md (28 KB)
├── experiments/  [NEW CONTENT] — no longer just .gitkeep:
│   └── lstm_training_journey.md — a genuine, dated experiment log (§18, §34)
├── himanshu-docs/
│   ├── master_synthesis_document.md  (unchanged)
│   └── PROJECT_MASTER_CONTEXT.md  [NEW] (55.9 KB — presumably the team's copy of a
│       prior audit pass; not used as a source for this update)
├── service/
│   ├── api/src/server.js  — grew from 10.8 KB to 17.3 KB; now expects a DL/AE-aware
│   │       predictor and exposes /stats and /metrics (§3, §9)
│   ├── models/
│   │   ├── artifacts/  — previously entirely gitignored; now mostly COMMITTED:
│   │   │   [NEW] dl_lstm_v1.0.{pt,onnx}, dl_stage1_binary_v1.0.{pt,onnx},
│   │   │   dl_stage1_binary_{report,threshold}_v1.0.json,
│   │   │   dl_stage2_multiclass_v1.0.{pt,onnx},
│   │   │   dl_stage2_multiclass_{report,config}_v1.0.json,
│   │   │   plus (already existed, still committed) feature_selector.pkl,
│   │   │   final_encoders.pkl, final_labels.pkl, final_lgbm.pkl, final_xgb.pkl.
│   │   │   final_rf.pkl is the one file still excluded (>100 MB GitHub limit).
│   │   └── src/  … same 9 Part-1 scripts, plus [NEW]:
│   │       dl_data_harmonize.py, dl_data_pipeline_unsw.py, dl_eda_cicids.py,
│   │       dl_eda_nslkdd.py, dl_eda_unsw.py, dl_generate_checksums.py,
│   │       eval_dl_lstm.py, eval_dl_stage1_binary.py, eval_dl_stage2_multiclass.py,
│   │       train_dl_lstm.py, train_dl_stage1_binary.py, train_dl_stage2_multiclass.py,
│   │       dl_pipeline/  [NEW package] __init__.py, dataset.py, evaluator.py,
│   │           lightning_modules.py (26.9 KB — the real model architectures), models.py, utils.py
│   │       **`unified_predictor_worker.py` is referenced by server.js and by
│   │       `experiments/lstm_training_journey.md` but does NOT exist in this
│   │       directory or anywhere else in the repository.**
│   └── preproc/  [NEW CONTENT] — no longer empty:
│       __init__.py, dl_preprocessor.py (a real, working live-inference preprocessor
│       class — see §14)
├── tests/  — unchanged, still just a CSV fixture, no test code
├── infra/, notebooks/, service/automation/, service/mobile/  — still empty (.gitkeep only)
```

Everything else (documentation set, literature, project evaluation PDFs, others/) is unchanged from the first pass.

---

## 5. Complete Technology Stack

| Layer | **Documented / Planned** | **Actually in the code** | Status |
|---|---|---|---|
| Backend API | FastAPI, JWT auth | Express 4 (Node.js), no auth | **MISMATCH** (unchanged) |
| Database | PostgreSQL | MongoDB (or, new: CSV-fallback bypassing DB entirely) | **MISMATCH** (unchanged) |
| ML baseline | XGBoost, RF, LightGBM | **Implemented and genuinely used** | **IMPLEMENTED** |
| DL engine | README: "Temporal Transformers for sequence modeling" | **Implemented**: `TemporalTransformerClassifier` (PyTorch Lightning), trained and evaluated for both a binary attack-gate and a 5-class attack classifier, with committed weights + committed evaluation reports | **IMPLEMENTED (training/eval side); not wired to the live server — see below** |
| Anomaly/zero-day engine | README: "AE Anomaly Canary (TemporalOneClassVAE)" | `TemporalOneClassVAE` class is fully implemented (encode/decode/anomaly-score/calibration methods) in `dl_pipeline/lightning_modules.py`, but **no trained weights, no threshold file, and no evaluation report for it exist anywhere in the repo** — `server.js` even has a `try/catch`-guarded load for a `dl_ae_threshold_v1.0.json` file that doesn't exist | **PARTIALLY IMPLEMENTED — architecture + training/scoring logic complete; never trained to completion (or never committed) and not evaluated** |
| DL preprocessing | — | **Implemented**: `QuantileTransformer` + `OneHotEncoder`, engineered ratio/port features, chronological split, sliding-window sequencing — code + fitted artifacts both committed | **IMPLEMENTED** |
| Live DL serving | README: unified hybrid engine | `unified_predictor_worker.py` — **file does not exist** | **NOT IMPLEMENTED (integration gap)** |
| Explainability | SHAP, LIME | Still no `shap`/`lime` import found anywhere, including in the new DL code | **NOT IMPLEMENTED** (unchanged) |
| SOAR-lite | iptables/Suricata automation | `service/automation/.gitkeep` only | **NOT IMPLEMENTED (0%)** (unchanged) |
| Multi-dataset (NSL-KDD, CICIDS2017) | Explicit, repeated | Real harmonization/EDA **code** now exists for both, but **no data files for either are committed**, and the new scripts expect a `data/raw/…` layout that doesn't match the repo's actual `data/…` layout (see §12) | **PARTIALLY IMPLEMENTED (code only, not runnable as committed)** — upgraded from "documented only" |
| Deployment, monitoring, tests | Docker/Compose, Prometheus/Grafana, pytest/Jest | Still nothing found | **NOT IMPLEMENTED** (unchanged) |

---

## 6. System Architecture

**Planned (unchanged):** the 7-component microservice pipeline from `documentation/02_tech_and_architecture.md`.

**Actual, as the new commit intends it:** the same Express + MongoDB/CSV replay loop as before, now fronting a "unified" Python predictor process meant to combine the tree ensemble, the Transformer classifiers, and the VAE anomaly scorer into one JSON response per sample, with attribution (`verdict_source`) and a zero-day flag surfaced to the dashboard's state layer. **This architecture is well-designed on paper and partially built in code (the preprocessor and the individual models all exist and work), but the one file that would actually assemble them into a running service (`unified_predictor_worker.py`) is missing.** The system as it can actually be started today still only exercises the Part-1 tree ensemble, exactly as in the first audit pass.

---

## 7. End-to-End Data Flow

**Planned (unchanged):** `Network Traffic → Mirror Port/TAP → Zeek/tcpdump → Redis → Feature Extraction → Ensemble+SHAP → FastAPI → Dashboard/Email-Slack/SOAR-lite`.

**Actual, offline/training side (new and real):** `UNSW-NB15 train+test CSVs → dl_data_pipeline_unsw.py (feature engineering, one-hot + quantile scaling, chronological 70/15/15 split, sliding-window sequencing) → data/artifacts/*.pkl,*.json (committed) + data/sequences/*.npy (NOT committed) → train_dl_stage1_binary.py / train_dl_stage2_multiclass.py (TemporalTransformerClassifier, PyTorch Lightning) → service/models/artifacts/dl_stage{1,2}_*.{pt,onnx,json} (committed)`.

**Actual, live-serving side (unchanged from first pass, because the new integration script is missing):** `CSV/MongoDB row → live_predictor_worker.py (XGBoost+RF+LightGBM average only) → in-memory alert array → dashboard polling`. The new DL/AE artifacts sit in the repository, fully trained and evaluated, but are not consumed by any script that the running server actually calls.

---

## 8. Frontend Implementation

**Unchanged from the first pass** — no dashboard files were modified in this commit. `App.jsx` and the 4 components still poll only `/health` and `/alerts`; they do not yet consume the new `/stats` or `/metrics` endpoints, and there is still no UI for per-engine attribution, zero-day flags, or anomaly scores, even though the backend state layer now tracks all of that. The unused Vite scaffold files (`main.ts`, `counter.ts`, `style.css`) are still present.

---

## 9. Backend Implementation

- **Framework:** Express 4, same as before, but `service/api/src/server.js` grew from ~330 to ~500 lines.
- **New endpoints:** `GET /stats` (per-engine detection counts, zero-day count, attack-type breakdown, engine-agreement rate) and `GET /metrics` (returns the real stored DL evaluation JSON files verbatim — a genuinely useful, honest feature, since it surfaces actual committed results rather than fabricating anything). Still no auth on any endpoint; CORS still wide open.
- **New config:** `USE_CSV_FALLBACK` (default `true` in the committed `.env.example`) lets the server run entirely off the CSV file, bypassing MongoDB. `PREDICTOR_SCRIPT` now defaults to `service/models/src/unified_predictor_worker.py` — **the missing file** (§3, §33).
- **`.env.example` now contains what reads as a real MongoDB Atlas connection string with an embedded username and password** (`mongodb+srv://admin:adminkapassword@cluster0.kgfpket.mongodb.net/`) in place of the earlier `<username>:<password>` placeholder. This is flagged as a security-hygiene item in §27 — it was not tested or connected to as part of this audit.
- The `PythonPredictorBridge` class is otherwise structurally unchanged, just with longer timeouts (120s startup, 30s per prediction) to accommodate DL model loading.

---

## 10. Database / Storage Implementation

Unchanged: MongoDB only, one collection, no persistence of alerts across restarts. The new `USE_CSV_FALLBACK` mode means MongoDB isn't even required to run the server now — a meaningful simplification, but it doesn't add any persistence (the CSV-fallback path holds rows in a plain in-memory array too).

---

## 11. Data Collection

Unchanged: no packet-capture code anywhere. Still a CSV-sampling script (`mongoDB_csvCreate.py`, essentially unchanged, 2912→2920 bytes) as the only "collection" mechanism.

---

## 12. Dataset Details

- **UNSW-NB15:** unchanged — both CSVs committed, now with a real, versioned, committed preprocessing pipeline output (`data/artifacts/*`, dated `20260612`) sitting alongside them.
- **NSL-KDD, CICIDS2017 — upgraded status from "documented only" to "code exists but not runnable as committed":**
  - `dl_eda_nslkdd.py` expects `data/raw/nslkdd/KDDTrain+.txt` and `KDDTest+.txt` — **neither file is present anywhere in the repository.**
  - `dl_data_harmonize.py` expects CICIDS2017 CSVs under `data/raw/cicids2017/*.csv` — **not present.** (`dl_eda_cicids.py` presumably has the same expectation; not opened in this pass.)
  - Both scripts, and `dl_data_pipeline_unsw.py` (which *does* have its source data committed), all read from a `data/raw/…` subdirectory — **but the repository's actual committed data sits directly under `data/…`, with no `raw/` subfolder.** So even the UNSW-only pipeline script, as committed, would fail on a fresh checkout with a file-not-found error unless someone manually creates `data/raw/` and copies the CSVs there. This is a concrete, verifiable path-convention mismatch between the new DL scripts and the actual repo layout.
  - **Net effect:** three datasets are now referenced by real processing code, but only one (UNSW-NB15) has committed data, and even that one requires a directory the repo doesn't have. Practically, only UNSW-NB15 is usable today.
- Class-distribution figures reported in `docs_sahil/ml.md` remain **not independently recomputed** from the raw CSV in this audit.

---

## 13. Data Preprocessing

**Two parallel, materially different preprocessing pipelines now coexist in this repo** — worth stating plainly since it's easy to conflate them:

1. **Part-1 (tree ensemble) pipeline** — unchanged from the first pass: per-script `LabelEncoder`, `SelectFromModel` feature selection (only in `train_from_scratch.py`), various SMOTE/SMOTENC/SMOTETomek balancing attempts, no persisted artifact versioning beyond the plain `.pkl` filenames.
2. **Part-2 (DL) pipeline, new this commit** — a single, versioned, artifact-committed pipeline (`dl_data_pipeline_unsw.py`): drops `srcip/dstip/id/sport/dsport/Ltime`, engineers `is_wellknown_sport`, `is_wellknown_dsport`, `bytes_ratio`, `pkts_ratio`, `pkt_size_avg`; one-hot encodes `proto/service/state`; scales numeric features with a `QuantileTransformer(output_distribution="normal")`; sorts by `Stime` for a **chronological** (not random) 70/15/15 train/val/test split; and builds 10-step sliding-window sequences (stride 1, label = last flow in the window) for the sequence models. A matching `DLPreprocessor` class (`service/preproc/dl_preprocessor.py`) replays exactly this logic at inference time from the committed artifacts — genuinely good practice, and it would work correctly if something called it.

These two pipelines produce **different feature representations** (different drop-lists, different encoders, different scalers) and are **not interchangeable** — the tree-ensemble artifacts and the DL artifacts each need their own matching preprocessor. `live_predictor_worker.py` (still running) only knows about pipeline #1; nothing currently running knows about pipeline #2 end-to-end except the training/eval scripts themselves.

---

## 14. Feature Engineering

Now genuinely present for the DL pipeline (see §13): derived ratio/port features plus the raw UNSW-NB15 feature set, one-hot expanded and quantile-scaled to a 198-dimensional input vector (confirmed by `input_size: 198` in the committed `dl_stage1_binary_threshold_v1.0.json`). This is a real step up from the first pass, where no custom feature engineering existed at all. The elaborate window-based `ConnectionTracker` concept from `documentation/packet_pipeline_part3_processing_ml.md` is still pseudocode-only — the *sequencing* that exists now (10-flow sliding windows over already-i.i.d. dataset rows) is not the same thing as the *live, per-connection temporal windowing* described in that planning document; it operates on dataset row order, not on real per-flow arrival time.

---

## 15. Machine Learning Implementation (Part 1 — tree ensemble)

Unchanged from the first pass — see the original 9-script inventory (train_binary_model.py, train_stage1_binary.py, train2_model.py, train_stage2_major.py, train_combined_model.py, train_model.py, train_from_scratch.py, train_dl_model.py, ensemble_model.py). `train_from_scratch.py`'s artifacts (`final_xgb.pkl`, `final_rf.pkl` [excluded from git by size], `final_lgbm.pkl`, `feature_selector.pkl`, `final_encoders.pkl`, `final_labels.pkl`) are still what `live_predictor_worker.py` actually serves. The self-reported 89.75%/81.58% figures from `docs_sahil/ml.md` are **still not backed by any stored log or report file** — that conclusion from the first pass is unchanged.

---

## 16. Deep Learning Implementation (Part 2 — new this commit)

This is the section that changed the most. Full architecture inventory, all read directly from `service/models/src/dl_pipeline/{models.py,lightning_modules.py}`:

| Class | Type | Purpose | Trained artifact committed? | Evaluation report committed? |
|---|---|---|---|---|
| `FlowLSTM` (models.py) | BiLSTM + attention, plain PyTorch `nn.Module` | Early multiclass classifier (see "Version 1.0/1.1" in the training journey) | Ambiguous — `dl_lstm_v1.0.pt/.onnx` exist but which architecture they correspond to (this class, or `LSTMAutoencoder` below) was not disambiguated by opening `train_dl_lstm.py` in this pass | No dedicated report JSON found for `dl_lstm_v1.0` |
| `AnomalyAutoencoder` (models.py) | Plain dense autoencoder | Early anomaly-detection baseline | No artifact found under this name | No |
| `LSTMAutoencoder` / `MemoryLSTMAutoencoderLightning` (lightning_modules.py) | Sequence autoencoders, the latter with a discrete memory-addressing module | Anomaly/zero-day detection candidates | No matching artifact found | No |
| **`TemporalTransformerClassifier`** (lightning_modules.py) | Transformer encoder (2 layers, 4 heads, d_model=128) + CLS-token classification head, focal loss | **Used for both the Stage-1 binary attack gate and the Stage-2 5-class attack classifier** (confirmed by both training scripts and by `experiments/lstm_training_journey.md`, "Version 1.2") | **Yes** — `dl_stage1_binary_v1.0.{pt,onnx}`, `dl_stage2_multiclass_v1.0.{pt,onnx}` | **Yes** — `dl_stage1_binary_report_v1.0.json`, `dl_stage2_multiclass_report_v1.0.json`, plus threshold/config JSONs |
| **`TemporalOneClassVAE`** (lightning_modules.py) | Transformer-encoder one-class VAE with latent-center loss, KL warmup, and a custom multi-component calibrated anomaly score (reconstruction MSE + latent-center distance + KL surprise) | The README's "AE Anomaly Canary" for zero-day detection | **No** — no `.pt`/`.onnx` file for this class exists anywhere | **No** — and `server.js`'s attempted load of `dl_ae_threshold_v1.0.json` fails silently (caught) because the file doesn't exist |

**What this means concretely:**
- The production model that the team actually finished, evaluated, and shipped as artifacts is the **`TemporalTransformerClassifier`**, used in a two-stage cascade: Stage 1 decides Normal-vs-Attack; Stage 2 (trained only on the attack subset, per the training journey's "Data subsetting: trained exclusively on attack sequences") classifies which of 5 attack families it is.
- The **VAE anomaly canary** (the specific novelty the README highlights for zero-day detection) is fully coded — its training step, its calibrated multi-component anomaly score, its latent-center initialization routine — but there's no evidence it was ever trained to a finished, saved state. It should currently be described as **designed and implemented at the class level, not trained or evaluated.**
- The **LSTM path (`FlowLSTM`, `LSTMAutoencoder`) is explicitly described in the team's own experiment log as superseded** by the Transformer approach ("Why We Transitioned to Temporal Transformers in Production" — three stated architectural reasons: multi-step correlation via self-attention, parallelizable training, and avoidance of vanishing/exploding gradients). The `dl_lstm_v1.0.{pt,onnx}` artifact is most plausibly a checkpoint from that superseded LSTM line, kept for the record rather than for serving.

**Training journey / iteration record** (`experiments/lstm_training_journey.md`), summarized and cross-checked against the stored JSON:
- **v1.0 (BiLSTM baseline):** 82.14% accuracy, 0.7425 macro F1, but Exploits recall only 36.34% and Analysis/Backdoor recall 0.00% — diagnosed as a "double-weighting" bug from combining a `WeightedRandomSampler` *and* inverse-frequency `CrossEntropyLoss` weights simultaneously.
- **v1.1 (BiLSTM + Attention + LayerNorm + Focal Loss, sampler removed):** 82.65% accuracy, 0.7462 macro F1; Exploits recall improved only marginally to 38.97% — diagnosed as a feature-representation limitation, not a training-recipe problem.
- **v1.2 (`TemporalTransformerClassifier`, attack-only subset, focal loss γ=1.5):** validation macro recall 80.40%, test macro recall 79.48% — a clear, documented improvement, and **this is the version whose numbers are independently verifiable** in the committed `dl_stage2_multiclass_report_v1.0.json` (test macro recall in the stored file: 0.7948411442216059 — an exact match to the narrative document to 4 decimal places, strong internal consistency between the two).

---

## 17. Model Training

- **Reproducibility has improved but is still incomplete.** The DL training scripts (`train_dl_stage1_binary.py`, `train_dl_stage2_multiclass.py`) are self-contained, deterministic (`set_seed(42)`), and — unlike the Part-1 scripts — **actually write their results to disk** (model weights, ONNX export, threshold JSON, evaluation-report JSON) rather than only printing to console. This is a genuine quality improvement.
- However, they depend on an intermediate artifact directory, `data/sequences/*.npy` (e.g. `lstm_train_w10_v1_20260612.npy`), which is **not committed to the repository** (most likely gitignored or simply too large/never pushed). Regenerating it requires running `dl_data_pipeline_unsw.py` first — which itself expects source CSVs under `data/raw/…`, a directory that does not exist in the committed repo (§12). **So, as committed, a fresh clone cannot currently reproduce the DL training run end-to-end without first manually restructuring the `data/` directory.** The trained outputs (weights + reports) are committed and can be inspected/used as-is, which is a real improvement over Part 1 — but full pipeline reproducibility is still blocked by this path mismatch.
- `.gitignore` now excludes only `final_rf.pkl` by name (too large for GitHub's 100 MB limit), not the whole `artifacts/` directory — a deliberate, sensible change from the first pass's blanket exclusion, and the direct reason real evaluation reports are now inspectable at all.

---

## 18. Model Evaluation

This section now needs to distinguish two tiers of evidence quality that did not both exist in the first pass:

**Tier A — Independently verified (new):** the Stage-1 binary and Stage-2 multiclass `TemporalTransformerClassifier` results are backed by committed JSON files generated directly by the training scripts' own evaluation code (`classification_report`, `confusion_matrix`, computed with `sklearn`, dumped with `json.dump`). Key numbers, read directly from the stored files:

| Model | Split | Accuracy | Notes |
|---|---|---|---|
| Stage-1 binary attack gate | Test | **97.55%** | Normal recall 93.43%, Attack recall 99.97%, Attack precision 96.28%, Attack F1 98.09% |
| Stage-1 binary attack gate | Validation | 97.29% | threshold-tuned at attack-probability ≥ 0.2185 (chosen to keep Normal recall ≥ 90% while maximizing attack recall + F1) |
| Stage-2 multiclass (5 attack families, argmax) | Test | **77.74%** | Macro recall 79.48%, macro F1 74.78%; per-class recall: DoS 88.18%, Exploits 41.25%, Fuzzers 87.90%, Generic 96.97%, Reconnaissance 83.13% |
| Stage-2 multiclass (thresholded, conf. ≥ 0.45) | Test | 76.63% | Adds an "Attack-Unclassified" bucket for low-confidence predictions; coverage 96.7% |

**Exploits remains the weak point of the whole DL line** — recall stuck around 41% across every architecture tried (BiLSTM, BiLSTM+Attention+FocalLoss, Transformer), with the training journal explicitly attributing most Exploits misclassifications to confusion with DoS, and concluding this is a feature-representation limit rather than something more training would fix.

**Tier B — Still not verified (unchanged from first pass):** the Part-1 tree-ensemble headline figures (89.75% accuracy / 81.58% macro recall) remain sourced only from `docs_sahil/ml.md`'s narrative, with no stored log or report file backing them.

No committed evaluation artifact exists for the VAE anomaly canary (§16) or for `FlowLSTM`/`LSTMAutoencoder` specifically — only the superseded-by-narrative numbers in the training journey document for the pre-Transformer LSTM versions (Tier A-adjacent: numbers are documented with enough detail to be plausible and internally consistent, but there is no raw JSON/log file for the LSTM versions the way there is for the final Transformer versions).

---

## 19. Post-ML/DL System Implementation

Unchanged in substance: everything after "a model produces a label" is still the same thin Express/MongoDB/React stack. What's new is that the Express layer now has richer *intent* (per-engine attribution, zero-day flagging, a `/metrics` endpoint that surfaces real evaluation data) — but that intent cannot currently be fulfilled because of the missing `unified_predictor_worker.py` (§3, §9).

---

## 20. APIs and Services

Now 6 endpoints instead of 4: `GET /health`, `GET /alerts`, `POST /poll-once`, `GET /config`, plus **new** `GET /stats` and `GET /metrics`. `/metrics` is worth calling out positively: it reads and returns the real committed JSON evaluation files rather than fabricating anything — a genuinely honest way to surface real results through an API. Still no auth, no WebSocket, no `/actions`, `/models`, `/detect`, or Prometheus-format `/metrics` (the new `/metrics` returns JSON, not the Prometheus text format `05_experimental_plan_and_metrics.md` specifies).

---

## 21. Real-Time / Streaming Components

Unchanged: still a 1-second poll loop over a static dataset, no Redis, no queue.

---

## 22. Explainability / XAI

**Still not implemented.** No `shap` or `lime` import appears anywhere in the new DL code either (`dl_pipeline/`, `eval_dl_*.py`, `train_dl_*.py` — none import either package). The new `TemporalOneClassVAE`'s multi-component anomaly score (reconstruction error, latent-center distance, KL surprise, individually calibrated and weighted) is a genuinely interpretable *design* in the sense that its three components have distinct meanings — but this is not SHAP/LIME, is not surfaced anywhere to an operator, and the model itself was never finished/trained (§16). Explainability remains **PLANNED / DOCUMENTED ONLY**.

---

## 23. Alerting / Monitoring

Unchanged: console logging + in-memory array only, richer now in content (engine source, anomaly score, zero-day flag are all logged to console per the updated `pollOnce()`), but still no email/Slack/push, no Prometheus/Grafana.

---

## 24. Automated Response / Prevention

**Still 0% implemented.** `service/automation/` still contains only `.gitkeep`. Unaffected by this commit.

---

## 25. Deployment

**Still not implemented.** `infra/` still contains only `.gitkeep`. Unaffected by this commit.

---

## 26. Testing

**Still not implemented.** `tests/` still contains only the CSV fixture. None of the new DL code has any test coverage either — no `pytest` file validates, e.g., that `DLPreprocessor.transform()` produces the same feature count the models expect, which would have been a cheap, high-value regression test given how many moving parts (encoder, scaler, feature list, model input_size) now have to stay in lockstep.

---

## 27. Security

Unchanged core findings (no auth, open CORS), plus one **new** item: `service/api/.env.example` now contains what reads as a live-looking MongoDB Atlas connection string with an embedded username and password, in place of the earlier `<username>:<password>` placeholder pattern. **This audit did not attempt to connect to it or otherwise verify whether it is a real, currently-valid credential** — but committing a filled-in connection string to a template file that's meant to be copied (`run_guide.md`: `cp .env.example .env`) is a practice worth the team double-checking and, if it is real, rotating immediately regardless.

---

## 28. Documentation vs. Actual Implementation

All rows from the first-pass table still apply unless noted. New/changed rows:

| Feature / Component | Documentation Claims | Repository Evidence | Status | Evidence |
|---|---|---|---|---|
| "Hybrid Multi-Engine Detection" (README) | ML + DL Transformer + AE canary running together | Transformer models trained/evaluated; AE canary coded but untrained; **no script exists to combine them for serving** | **DOC/CODE MISMATCH** | `unified_predictor_worker.py` not found; `live_predictor_worker.py` unchanged |
| DL Transformer classifier | "for sequence modeling" | **Implemented, trained, evaluated, artifacts committed** | **IMPLEMENTED** | `dl_pipeline/lightning_modules.py`, `dl_stage{1,2}_*` artifacts |
| AE Anomaly Canary / TemporalOneClassVAE | "for zero-day detection" | Class implemented; no trained weights, threshold, or report exist | **PARTIALLY IMPLEMENTED** | class in `lightning_modules.py`; absent from `artifacts/` |
| Multi-dataset (NSL-KDD, CICIDS2017) | Explicit, repeated | Harmonization/EDA code now exists for both, but no data files committed and a `data/raw/` path mismatch blocks even the UNSW-only script from running as-is | **PARTIALLY IMPLEMENTED (code only)** — upgraded from "documented only" | `dl_data_harmonize.py`, `dl_eda_nslkdd.py`, `dl_data_pipeline_unsw.py` |
| Reproducible evaluation results | Implied throughout | **Now genuinely true for the two DL stage models** — first real, independently-checkable numeric evidence in this repository | **IMPLEMENTED (for these two models specifically)** | `dl_stage1_binary_report_v1.0.json`, `dl_stage2_multiclass_report_v1.0.json` |

---

## 29. Implemented Features

All items from the first pass, plus:
- A versioned, artifact-committed DL preprocessing pipeline (feature engineering, one-hot encoding, quantile scaling, chronological split, sliding-window sequencing) with a matching live-inference preprocessor class.
- A trained, evaluated, artifact-committed two-stage `TemporalTransformerClassifier` cascade (binary attack gate → 5-class attack classifier), including a tuned decision threshold and ONNX export for portability.
- A genuinely reproducible evaluation trail for that model: three architecture iterations, each with stated hyperparameters and results, culminating in stored JSON reports that match the narrative document's numbers exactly.
- Two new, functioning API endpoints (`/stats`, `/metrics`) that expose real, stored evaluation data rather than mock data.

## 30. Partially Implemented Features

Updated:
- **The DL/AE anomaly-detection line** — a sophisticated, well-designed `TemporalOneClassVAE` exists in code but has no trained artifact or evaluation evidence.
- **Multi-dataset support** — real processing code for NSL-KDD and CICIDS2017 exists but cannot run against the committed repository (no data, path mismatch).
- **The "unified" live serving path** — designed for in `server.js`, but the integration script that would realize it is absent.
- (Unchanged) dashboard completeness, `requirements.txt` staleness (still doesn't list `torch`, `lightning`, `onnx`, or `tensorflow`, all of which the new/old DL scripts import).

## 31. Planned but Unimplemented Features

Unchanged list from the first pass (SHAP/LIME, SOAR-lite, live packet capture, Redis, PostgreSQL, FastAPI, JWT auth, WebSocket streaming, multi-channel alerting, Docker/Compose/K8s, Prometheus/Grafana, automated tests, mobile client, CI/CD), **plus, newly identified as unimplemented despite being coded:** the VAE anomaly canary's trained/evaluated state, and the unified DL+ML serving integration.

## 32. Unverified Features

Unchanged for the Part-1 ML figures (89.75%/81.58%). **Newly resolved from "unverified" to "verified"**: the Stage-1 and Stage-2 DL model metrics (§18, Tier A). **Newly added as unverified:** which specific architecture (`FlowLSTM` vs. `LSTMAutoencoder`) the committed `dl_lstm_v1.0.pt/.onnx` files actually correspond to — not disambiguated in this pass without opening `train_dl_lstm.py` line-by-line.

## 33. Current Limitations

All Confirmed limitations (A) from the first pass still apply. **New, concretely observed this pass:**
- **`unified_predictor_worker.py`, the default and only documented live-serving entry point for the new hybrid engine, does not exist anywhere in the repository.** As committed, the server cannot start its prediction bridge without manual intervention (pointing `PREDICTOR_SCRIPT` back at the old `live_predictor_worker.py`, which then silently serves none of the new DL functionality the dashboard's state layer expects).
- **Path-convention mismatch:** the new DL data scripts (`dl_data_pipeline_unsw.py`, `dl_data_harmonize.py`, `dl_eda_nslkdd.py`) all expect source data under `data/raw/…`; the repository's actual committed data lives directly under `data/…`. Even the one dataset that *is* committed (UNSW-NB15) can't be reprocessed by the new pipeline without first restructuring the `data/` folder.
- **Intermediate artifacts not committed:** the sequence arrays (`data/sequences/*.npy`) that the DL training scripts depend on are not in the repo, so the DL training run — unlike its *outputs* — is not currently reproducible from a fresh clone.
- **`.env.example` contains what looks like a real, filled-in database credential** rather than a placeholder (§27).
- **`requirements.txt` is more stale than before**: it still lists only `pandas, numpy, matplotlib, seaborn, scikit-learn, xgboost, imbalanced-learn, lightgbm` — it now additionally omits `torch`, `lightning` (PyTorch Lightning), and `onnx`, all of which are hard imports in the new, real, working DL scripts.
- **No test coverage was added alongside a significant new subsystem** — same gap as Part 1, now larger in scope.

## 34. Existing Experiments and Results

All rows from the first-pass table (§34) still apply as before (Part-1 ML, still self-reported/unverified). **New rows, Tier A verified:**

| Result | Value | Experiment | Source File | Verified? |
|---|---|---|---|---|
| DL Stage-1 binary attack gate | Test accuracy 97.55%, Attack recall 99.97%, Normal recall 93.43% | `TemporalTransformerClassifier`, v1.2 line | `service/models/artifacts/dl_stage1_binary_report_v1.0.json` (code-generated) | **Verified — stored, code-generated report** |
| DL Stage-2 multiclass (5 attack families) | Test accuracy 77.74%, macro recall 79.48%, macro F1 74.78% | `TemporalTransformerClassifier`, trained on attack-only subset | `service/models/artifacts/dl_stage2_multiclass_report_v1.0.json` (code-generated); cross-matches `experiments/lstm_training_journey.md` to 4 decimal places | **Verified — stored, code-generated report, internally cross-consistent** |
| DL LSTM v1.0 (BiLSTM baseline) | Accuracy 82.14%, macro F1 0.7425, Exploits recall 36.34%, Analysis/Backdoor recall 0.00% | `FlowLSTM` (or `LSTMAutoencoder`) | `experiments/lstm_training_journey.md` (narrative only — no JSON report for this version) | **Documented in detail, not independently verified from a stored raw report** |
| DL LSTM v1.1 (+Attention, +Focal Loss) | Accuracy 82.65%, macro F1 0.7462, Exploits recall 38.97% | same | `experiments/lstm_training_journey.md` | **Documented in detail, not independently verified from a stored raw report** |
| VAE anomaly canary | None reported | `TemporalOneClassVAE` | — | **No experiment run/reported — class exists, never trained to a saved state** |

---

## 35. Missing Experiments

Unchanged from the first pass (no NSL-KDD/CICIDS2017 evaluation, no cross-dataset generalization test, no throughput/latency/stress test, no ablation study with saved comparable outputs — though the LSTM→Transformer progression is an informal, well-documented exception to that last point). **Newly missing, specific to this commit:** any evaluation of the VAE anomaly canary at all; any end-to-end test of the "hybrid" verdict-fusion logic (`verdict_source`, `engine_agreement`) that `server.js` is now built to track, since nothing currently produces those fields.

## 36. Possible Research Contributions

The first pass's table (§36) still applies to the SHAP/LIME and SOAR-lite proposals (still 0% implemented — same weakness noted there). **This update meaningfully strengthens one row and adds a new one:**

| Proposed contribution | Implementation evidence | Research question | Experiment required | Evidence available | Evidence missing | Potential weakness |
|---|---|---|---|---|---|---|
| **Documented architecture progression for multiclass NIDS: BiLSTM → BiLSTM+Attention+Focal-Loss → Transformer, with a diagnosed imbalance-handling failure mode ("double-weighting" bug)** | `experiments/lstm_training_journey.md` + matching stored JSON reports for the final version | Does self-attention over flow sequences resolve specific class-confusion patterns (here, Exploits↔DoS) that recurrent architectures and loss-reweighting tricks cannot? | Already substantially run — needs one more pass: log the LSTM versions' raw outputs the same way the Transformer version's were logged, for a fully apples-to-apples comparison | Strong — three real, described, numerically-consistent iterations | Raw stored reports for the two LSTM versions (currently narrative-only) | The underlying comparison (LSTM vs. Transformer on tabular/flow data) is well-trodden in the broader ML literature; the specific contribution here would be the honest failure-mode diagnosis (the double-weighting bug) and the finding that Exploits↔DoS confusion persists across architecture changes and is likely a feature-representation ceiling, not a modeling ceiling — that's a legitimate, specific, reportable finding |
| Two-stage cascade (binary attack-gate → attack-family classifier) as an alternative to single-shot multiclass classification | `train_dl_stage1_binary.py`, `train_dl_stage2_multiclass.py`, both evaluation reports | Does gating detection into a high-recall binary stage before a specialized multiclass stage improve minority-class recall versus a single end-to-end classifier? | A direct comparison against a single-stage Transformer classifier trained on all 6 classes at once (not currently in the repo) | Both stages individually evaluated and strong (97.6% / 77.7%) | The single-stage comparison baseline | Legitimate systems-design question, modest scope, but honestly answerable with the evidence already in this repo plus one more training run |
| SHAP/LIME operationalized in a live dashboard | Still none | (unchanged from first pass) | Full implementation | None | Everything | (unchanged) |
| SOAR-lite automated remediation | Still none | (unchanged from first pass) | Full implementation | None | Everything | (unchanged) |

**Updated bottom line:** Part 1's honest research core (§36 of the first pass) was "modest but real ensemble/imbalance-handling comparisons, contingent on saving real numbers." **That contingency is now partly met** — the DL side of the project has exactly the kind of saved, reproducible, iteratively-documented evidence a paper needs, for the Transformer classifier specifically. If the team does the same for the Part-1 tree-ensemble comparisons (just persist the `classification_report` output that the scripts already compute), Part 1 would have a genuinely defensible, fully-verifiable technical core.

---

## 37. Preliminary Part 1 Scope (Foundation → ML/DL)

**Materially strengthened by this update.** In addition to everything in the first pass (§37), Part 1 can now legitimately include:
- The DL data pipeline (feature engineering, encoding, chronological split, sequencing) as a described, artifact-backed method.
- The two-stage `TemporalTransformerClassifier` cascade as a second, independently-verified model family alongside the tree ensemble.
- The documented architecture-iteration story (LSTM → LSTM+Attention+Focal → Transformer) as a legitimate ablation narrative, with the caveat that only the final iteration has a stored raw report (§34).

**Possible figures/tables (new):** confusion matrices for Stage-1 and Stage-2 DL models (both already available as raw arrays in the stored JSON — directly plottable, no re-computation needed); a bar chart of per-class recall across all three LSTM/Transformer iterations; a comparison table of the tree ensemble vs. the DL cascade on the same 6-class task (would require running the tree ensemble on the DL pipeline's identical chronological split for a fair comparison — not currently done, since the two pipelines use different splits/feature sets).

**Honest gap to close before writing:** the tree-ensemble numbers (Tier B, §18) and the DL numbers (Tier A, §18) are not currently comparable on equal footing — different preprocessing, different (random vs. chronological) splits, and only one side has a stored raw report. A paper claiming to compare "ML baseline vs. DL" needs both run under matching conditions with both sets of results saved.

## 38. Preliminary Part 2 Scope (Post-ML/DL System)

Largely unchanged from the first pass's conclusion — the system-integration layer (server, dashboard, alerting, SOAR, deployment) is still too thin to be a standalone paper's technical core. **One addition:** the "hybrid multi-engine verdict fusion" concept (`verdict_source`, `engine_agreement`, `zero_day_flag` fields already scaffolded in `server.js`'s state) is a legitimate systems-design idea — combining a fast supervised gate, a slower multiclass specialist, and an unsupervised anomaly canary, with disagreement tracked explicitly — but as of this audit **none of it runs**, because the file that would compute those fields doesn't exist. If the team writes `unified_predictor_worker.py` and evaluates the fusion logic (e.g., does `engine_agreement` correlate with prediction correctness? does the VAE catch anything the classifiers miss?), that would be a genuinely new, evaluable contribution for Part 2 — but it does not exist yet.

## 39. Open Questions / Missing Information

All items from the first pass (§39) still open. **New questions from this commit:**

1. Is `unified_predictor_worker.py` simply an uncommitted local file the team forgot to `git add`, or does it not exist yet at all? (The presence of the exact filename in both `server.js`'s default config and in `experiments/lstm_training_journey.md`'s prose — "our deployed live engine (`unified_predictor_worker.py`)" — suggests it exists locally on someone's machine and was described as already working, but simply wasn't pushed.)
2. Is the `data/raw/` vs `data/` path mismatch (§12) intentional (e.g., the team runs these scripts against a different local data layout than what's committed) or an oversight?
3. Which specific class (`FlowLSTM` or `LSTMAutoencoder`) do the committed `dl_lstm_v1.0.pt`/`.onnx` files correspond to, and which training script (`train_dl_lstm.py`) produced them? Not disambiguated in this pass.
4. Was the `TemporalOneClassVAE` ever trained, even without the artifact being committed? Worth asking the team directly rather than assuming from absence-of-evidence.
5. Is the MongoDB connection string now in `.env.example` (§27) a real, currently-valid credential? Should be checked and rotated by the team regardless, out of caution.
6. What is `data/UNSW` (a 0-byte file, oddly named, present since the first pass) — still unexplained.

## 40. Repository Evidence Index

All files listed in the first pass (§40) remain valid evidence and were not re-read in this update unless explicitly cited above. **New files consulted in this update:**

- `README.md`, `run_guide.md`, `service/api/.env.example` — re-read in full (§5, §9, §27)
- `service/api/src/server.js` — re-read in full, confirmed missing predictor dependency (§3, §9, §20)
- `experiments/lstm_training_journey.md` — read in full (§16, §18, §34, §36)
- `service/models/artifacts/dl_stage1_binary_report_v1.0.json`, `dl_stage1_binary_threshold_v1.0.json`, `dl_stage2_multiclass_report_v1.0.json` — read in full, cross-verified against each other and against the training journey document (§18, §34)
- `service/models/src/dl_pipeline/__init__.py`, `models.py`, `lightning_modules.py`, `dataset.py`, `evaluator.py`, `utils.py` — read in full (§16)
- `service/models/src/dl_data_pipeline_unsw.py`, `dl_data_harmonize.py`, `dl_eda_nslkdd.py` — read in full (§12, §13, §14)
- `service/models/src/train_dl_stage1_binary.py` — read in full (§16, §17, §18)
- `service/preproc/dl_preprocessor.py` — read in full (§13, §14)
- Attempted direct read of `service/models/src/unified_predictor_worker.py` — confirmed **not present** ("Path not found in repository") (§3, §9, §33)

**Present but not opened in this update pass** (noted for a possible follow-up): `documentation/dl_datasets_plan.md` (41 KB), `documentation/dl_models_plan.md` (28 KB), `documentation/dl_datasets_walkthrough`, `service/models/src/dl_eda_cicids.py`, `dl_eda_unsw.py`, `dl_generate_checksums.py`, `train_dl_lstm.py`, `train_dl_stage2_multiclass.py`, `eval_dl_lstm.py`, `eval_dl_stage1_binary.py`, `eval_dl_stage2_multiclass.py`, `service/models/artifacts/dl_stage2_multiclass_config_v1.0.json`, `data/artifacts/{feature_list,preprocessing_config}_unsw_v1_20260612.json`, `himanshu-docs/PROJECT_MASTER_CONTEXT.md`. None of these were required to reach the conclusions above; the `dl_datasets_plan.md`/`dl_models_plan.md` pair in particular would be worth a follow-up pass before finalizing Part 2's scope, since they may contain the team's own account of what `unified_predictor_worker.py` was meant to do.
