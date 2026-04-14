import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


warnings.filterwarnings(
    "ignore",
    message="X has feature names, but SelectFromModel was fitted without feature names",
)
warnings.filterwarnings(
    "ignore",
    message="X does not have valid feature names, but LGBMClassifier was fitted with feature names",
)


ROOT = Path(__file__).resolve().parents[3]
MODEL_DIR = ROOT / "service" / "models" / "artifacts"

DROP_COLUMNS = [
    "_id",
    "_sampleIndex",
    "srcip",
    "dstip",
    "id",
    "Stime",
    "Ltime",
    "attack_cat",
    "label",
]


class LivePredictor:
    def __init__(self):
        self.xgb = joblib.load(MODEL_DIR / "final_xgb.pkl")
        self.rf = joblib.load(MODEL_DIR / "final_rf.pkl")
        self.lgbm = joblib.load(MODEL_DIR / "final_lgbm.pkl")

        self.selector = joblib.load(MODEL_DIR / "feature_selector.pkl")
        self.encoders = joblib.load(MODEL_DIR / "final_encoders.pkl")
        self.label_encoder = joblib.load(MODEL_DIR / "final_labels.pkl")

        self.feature_columns = list(getattr(self.selector, "feature_names_in_", []))
        self.categorical_columns = set(self.encoders.keys())

    def _preprocess(self, sample):
        features = pd.DataFrame([sample]).drop(columns=DROP_COLUMNS, errors="ignore")

        if self.feature_columns:
            for column in self.feature_columns:
                if column not in features.columns:
                    features[column] = 0
            features = features[self.feature_columns]

        for column, encoder in self.encoders.items():
            if column in features.columns:
                class_map = {value: index for index, value in enumerate(encoder.classes_)}
                features[column] = features[column].astype(str).map(
                    lambda value: class_map.get(value, 0)
                )

        for column in features.columns:
            if column not in self.categorical_columns:
                features[column] = pd.to_numeric(features[column], errors="coerce").fillna(0)

        return self.selector.transform(features.to_numpy())

    def predict(self, sample):
        transformed = self._preprocess(sample)

        probabilities = (
            self.xgb.predict_proba(transformed)
            + self.rf.predict_proba(transformed)
            + self.lgbm.predict_proba(transformed)
        ) / 3

        predicted_index = int(np.argmax(probabilities, axis=1)[0])
        confidence = float(np.max(probabilities, axis=1)[0])
        label = self.label_encoder.inverse_transform([predicted_index])[0]

        return label, confidence


def write_message(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def main():
    predictor = LivePredictor()
    write_message({"type": "ready"})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None

        try:
            request = json.loads(line)
            request_id = request.get("requestId")
            sample = request.get("sample", {})

            prediction, confidence = predictor.predict(sample)

            write_message(
                {
                    "requestId": request_id,
                    "prediction": prediction,
                    "confidence": confidence,
                }
            )
        except Exception as exc:
            write_message({"requestId": request_id, "error": str(exc)})


if __name__ == "__main__":
    main()
