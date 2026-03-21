from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


BASE_DIR = Path(__file__).resolve().parents[1]
EXPORT_DIR = BASE_DIR / "exports"
MODEL_DIR = BASE_DIR / "ml" / "models"
REPORT_DIR = BASE_DIR / "ml" / "reports"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def get_latest_csv():
    csv_files = sorted(
        EXPORT_DIR.glob("*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not csv_files:
        raise FileNotFoundError("No CSV files found in backend/exports")
    return csv_files[0]


def build_features(df):
    work = df.copy()

    if "label" not in work.columns:
        raise ValueError("Dataset does not contain label column")

    work["label"] = work["label"].astype(str).str.strip().str.lower()

    allowed = {"normal", "attack"}
    work = work[work["label"].isin(allowed)].copy()

    if work.empty:
        raise ValueError("No usable rows found after label filtering")

    work["target"] = work["label"].map({"normal": 0, "attack": 1})

    if "time" in work.columns:
        parsed_time = pd.to_datetime(work["time"], errors="coerce", utc=True)
        work["hour"] = parsed_time.dt.hour
        work["day_of_week"] = parsed_time.dt.dayofweek
        work["month"] = parsed_time.dt.month
    else:
        work["hour"] = np.nan
        work["day_of_week"] = np.nan
        work["month"] = np.nan

    categorical_candidates = [
        "event_type",
        "user_id",
        "user_key_id",
        "plugin_name",
        "plugin_outcome",
        "replay_evidence",
        "scenario",
        "kind",
        "seq",
    ]

    numeric_candidates = [
        "org_id",
        "handshake_id",
        "anomaly_score",
        "hour",
        "day_of_week",
        "month",
    ]

    for col in categorical_candidates:
        if col in work.columns:
            work[col] = work[col].where(pd.notna(work[col]), None).astype(object)

    for col in numeric_candidates:
        if col in work.columns:
            work[col] = pd.to_numeric(work[col], errors="coerce")

    drop_cols = ["label", "target", "time"]
    feature_cols = [c for c in work.columns if c not in drop_cols]

    X = work[feature_cols].copy()
    y = work["target"].copy()

    all_null_cols = [c for c in X.columns if X[c].isna().all()]
    if all_null_cols:
      X = X.drop(columns=all_null_cols)

    categorical_cols = [c for c in categorical_candidates if c in X.columns]
    numeric_cols = [c for c in numeric_candidates if c in X.columns]

    return X, y, categorical_cols, numeric_cols, work


def build_preprocessor(categorical_cols, numeric_cols):
    transformers = []

    if categorical_cols:
        transformers.append(
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_cols,
            )
        )

    if numeric_cols:
        transformers.append(
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                    ]
                ),
                numeric_cols,
            )
        )

    if not transformers:
        raise ValueError("No usable feature columns found")

    return ColumnTransformer(transformers=transformers)


def main():
    csv_path = get_latest_csv()
    print(f"[ml] using dataset: {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"[ml] loaded rows={len(df)} cols={len(df.columns)}")

    df = df.replace({pd.NA: np.nan})

    X, y, categorical_cols, numeric_cols, prepared_df = build_features(df)

    print(f"[ml] usable rows={len(prepared_df)}")
    print(f"[ml] label counts:\n{prepared_df['label'].value_counts(dropna=False)}")

    if y.nunique() < 2:
        raise ValueError("Training requires at least two classes in the target column")

    preprocessor = build_preprocessor(categorical_cols, numeric_cols)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)

    report_text = classification_report(
        y_test,
        y_pred,
        target_names=["normal", "attack"],
        zero_division=0,
    )

    metrics = {
        "dataset": str(csv_path),
        "rows_total": int(len(df)),
        "rows_used": int(len(prepared_df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "label_counts": {
            k: int(v) for k, v in prepared_df["label"].value_counts().to_dict().items()
        },
        "categorical_features": categorical_cols,
        "numeric_features": numeric_cols,
    }

    model_path = MODEL_DIR / "random_forest_baseline.joblib"
    metrics_path = REPORT_DIR / "random_forest_metrics.json"
    report_path = REPORT_DIR / "classification_report.txt"
    confusion_path = REPORT_DIR / "confusion_matrix.png"
    features_path = REPORT_DIR / "feature_importance.csv"

    joblib.dump(pipeline, model_path)

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    plt.figure(figsize=(6, 4))
    plt.imshow(cm, interpolation="nearest")
    plt.title("Confusion Matrix")
    plt.colorbar()
    tick_marks = [0, 1]
    plt.xticks(tick_marks, ["normal", "attack"])
    plt.yticks(tick_marks, ["normal", "attack"])
    plt.xlabel("Predicted")
    plt.ylabel("Actual")

    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, str(cm[i, j]), ha="center", va="center")

    plt.tight_layout()
    plt.savefig(confusion_path, dpi=150, bbox_inches="tight")
    plt.close()

    try:
        preprocessor_fitted = pipeline.named_steps["preprocessor"]
        model_fitted = pipeline.named_steps["model"]

        feature_names = preprocessor_fitted.get_feature_names_out()
        importances = model_fitted.feature_importances_

        fi_df = pd.DataFrame(
            {
                "feature": feature_names,
                "importance": importances,
            }
        ).sort_values("importance", ascending=False)

        fi_df.to_csv(features_path, index=False)
    except Exception as exc:
        print(f"[ml] feature importance export skipped: {exc}")

    print("[ml] training complete")
    print(f"[ml] model: {model_path}")
    print(f"[ml] metrics: {metrics_path}")
    print(f"[ml] report: {report_path}")
    print(f"[ml] confusion matrix: {confusion_path}")
    print(f"[ml] feature importance: {features_path}")
    print(
        f"[ml] accuracy={accuracy:.4f} precision={precision:.4f} "
        f"recall={recall:.4f} f1={f1:.4f}"
    )


if __name__ == "__main__":
    main()