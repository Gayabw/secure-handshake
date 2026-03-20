#!/usr/bin/env python3
"""
Bootstrap validation for Secure Handshake exported evidence.

This script is read-only and independent from the backend.
It loads an exported dataset from backend/exports, computes bootstrap
estimates for security validation metrics, and prints 95% confidence intervals.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


DEFAULT_BOOTSTRAP_ITERATIONS = 1000
DEFAULT_CONFIDENCE_LEVEL = 0.95
DEFAULT_RANDOM_SEED = 42


@dataclass
class MetricResult:
    name: str
    mean: Optional[float]
    ci_lower: Optional[float]
    ci_upper: Optional[float]
    sample_size: int
    unit: str
    notes: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bootstrap validation for Secure Handshake exported dataset"
    )
    parser.add_argument(
        "--exports-dir",
        default="backend/exports",
        help="Directory containing exported evidence files",
    )
    parser.add_argument(
        "--input-file",
        default=None,
        help="Optional explicit file path to a CSV or JSONL export",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=DEFAULT_BOOTSTRAP_ITERATIONS,
        help="Number of bootstrap resampling iterations",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_RANDOM_SEED,
        help="Random seed for reproducibility",
    )
    parser.add_argument(
        "--output-json",
        default=None,
        help="Optional path to save validation results as JSON",
    )
    return parser.parse_args()


def normalize_column_name(name: str) -> str:
    return (
        str(name)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
    )


def normalize_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip().lower()


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def find_candidate_files(exports_dir: Path) -> List[Path]:
    candidates: List[Path] = []
    candidates.extend(exports_dir.glob("*.csv"))
    candidates.extend(exports_dir.glob("*.jsonl"))
    return sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)


def choose_input_file(exports_dir: Path, explicit_file: Optional[str]) -> Path:
    if explicit_file:
        path = Path(explicit_file)
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")
        return path

    if not exports_dir.exists():
        raise FileNotFoundError(f"Exports directory not found: {exports_dir}")

    candidates = find_candidate_files(exports_dir)
    if not candidates:
        raise FileNotFoundError(f"No CSV or JSONL exports found in: {exports_dir}")

    return candidates[0]


def load_dataset(file_path: Path) -> pd.DataFrame:
    suffix = file_path.suffix.lower()

    if suffix == ".csv":
        df = pd.read_csv(file_path)
    elif suffix == ".jsonl":
        df = pd.read_json(file_path, lines=True)
    else:
        raise ValueError(f"Unsupported file type: {suffix}. Use CSV or JSONL.")

    if df.empty:
        raise ValueError("Loaded dataset is empty")

    df.columns = [normalize_column_name(c) for c in df.columns]
    return df


def first_existing_column(df: pd.DataFrame, candidates: Iterable[str]) -> Optional[str]:
    for column in candidates:
        if column in df.columns:
            return column
    return None


def infer_event_type_column(df: pd.DataFrame) -> Optional[str]:
    return first_existing_column(df, ["event_type", "type", "event", "category"])


def infer_outcome_column(df: pd.DataFrame) -> Optional[str]:
    return first_existing_column(df, ["outcome", "status", "result", "decision", "action"])


def infer_processing_time_column(df: pd.DataFrame) -> Optional[str]:
    return first_existing_column(
        df,
        [
            "processing_time_ms",
            "duration_ms",
            "latency_ms",
            "elapsed_ms",
            "handshake_time_ms",
            "response_time_ms",
        ],
    )


def infer_alert_flag_column(df: pd.DataFrame) -> Optional[str]:
    return first_existing_column(
        df,
        ["alert_generated", "alert_triggered", "has_alert", "is_alert", "alert_flag"],
    )


def coerce_numeric_column(df: pd.DataFrame, column: Optional[str]) -> pd.Series:
    if not column:
        return pd.Series(np.nan, index=df.index, dtype=float)
    return pd.to_numeric(df[column], errors="coerce")


def coerce_bool_series(series: pd.Series) -> pd.Series:
    true_values = {"1", "true", "yes", "y", "blocked", "detected", "generated"}
    false_values = {"0", "false", "no", "n"}

    def convert(value: object) -> Optional[bool]:
        if pd.isna(value):
            return None
        if isinstance(value, bool):
            return value
        text = normalize_text(value)
        if text in true_values:
            return True
        if text in false_values:
            return False
        return None

    return series.map(convert)


def is_handshake_event(event_text: str) -> bool:
    handshake_terms = [
        "handshake",
        "secure_handshake",
        "handshake_request",
        "handshake_verification",
        "handshake_completed",
        "node_auth",
        "node_authentication",
    ]
    return any(term in event_text for term in handshake_terms)


def is_handshake_success(outcome_text: str) -> bool:
    success_terms = [
        "success",
        "successful",
        "verified",
        "accepted",
        "approved",
        "completed",
        "allowed",
        "passed",
        "ok",
    ]
    return outcome_text in success_terms or any(term in outcome_text for term in success_terms)


def is_replay_event(event_text: str, outcome_text: str) -> bool:
    replay_terms = [
        "replay",
        "replay_attack",
        "replay_attempt",
        "replay_detected",
        "replay_blocked",
    ]
    return any(term in event_text for term in replay_terms) or "replay" in outcome_text


def is_replay_blocked(outcome_text: str) -> bool:
    blocked_terms = [
        "blocked",
        "rejected",
        "denied",
        "detected",
        "prevented",
        "409",
        "conflict",
    ]
    return outcome_text in blocked_terms or any(term in outcome_text for term in blocked_terms)


def has_alert_generated(event_text: str, outcome_text: str, alert_value: object) -> bool:
    if isinstance(alert_value, bool) and alert_value is True:
        return True

    alert_text = normalize_text(alert_value)
    if alert_text in {"true", "1", "yes", "generated"}:
        return True

    return "alert" in event_text or "alert" in outcome_text


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()

    event_col = infer_event_type_column(prepared)
    outcome_col = infer_outcome_column(prepared)
    duration_col = infer_processing_time_column(prepared)
    alert_flag_col = infer_alert_flag_column(prepared)

    prepared["__event_type_norm"] = (
        prepared[event_col].map(normalize_text) if event_col else ""
    )
    prepared["__outcome_norm"] = (
        prepared[outcome_col].map(normalize_text) if outcome_col else ""
    )

    prepared["__processing_time_ms"] = coerce_numeric_column(prepared, duration_col)

    if alert_flag_col:
        prepared["__alert_flag"] = coerce_bool_series(prepared[alert_flag_col])
    else:
        prepared["__alert_flag"] = None

    prepared["__is_handshake_event"] = prepared["__event_type_norm"].map(is_handshake_event)
    prepared["__is_handshake_success"] = prepared["__outcome_norm"].map(is_handshake_success)
    prepared["__is_replay_event"] = prepared.apply(
        lambda row: is_replay_event(row["__event_type_norm"], row["__outcome_norm"]),
        axis=1,
    )
    prepared["__is_replay_blocked"] = prepared["__outcome_norm"].map(is_replay_blocked)
    prepared["__has_alert"] = prepared.apply(
        lambda row: has_alert_generated(
            row["__event_type_norm"],
            row["__outcome_norm"],
            row["__alert_flag"],
        ),
        axis=1,
    )

    return prepared


def percentile_interval(values: np.ndarray, confidence: float) -> Tuple[float, float]:
    alpha = 1.0 - confidence
    lower = np.percentile(values, 100.0 * (alpha / 2.0))
    upper = np.percentile(values, 100.0 * (1.0 - alpha / 2.0))
    return float(lower), float(upper)


def bootstrap_statistic(
    values: np.ndarray,
    statistic_fn: Callable[[np.ndarray], float],
    iterations: int,
    confidence: float,
    rng: np.random.Generator,
) -> Tuple[float, float, float]:
    if len(values) == 0:
        raise ValueError("Bootstrap input array is empty")

    estimates = np.empty(iterations, dtype=float)
    sample_size = len(values)

    for i in range(iterations):
        resample = rng.choice(values, size=sample_size, replace=True)
        estimates[i] = statistic_fn(resample)

    mean_estimate = float(np.mean(estimates))
    ci_lower, ci_upper = percentile_interval(estimates, confidence)
    return mean_estimate, ci_lower, ci_upper


def metric_binary_rate(
    series: pd.Series,
    name: str,
    iterations: int,
    confidence: float,
    rng: np.random.Generator,
    notes: str = "",
) -> MetricResult:
    values = series.dropna().astype(int).to_numpy(dtype=int)

    if len(values) == 0:
        return MetricResult(name, None, None, None, 0, "rate", notes or "No eligible rows")

    mean_value, ci_lower, ci_upper = bootstrap_statistic(
        values=values,
        statistic_fn=lambda x: float(np.mean(x)),
        iterations=iterations,
        confidence=confidence,
        rng=rng,
    )

    return MetricResult(name, mean_value, ci_lower, ci_upper, len(values), "rate", notes)


def metric_numeric_mean(
    series: pd.Series,
    name: str,
    iterations: int,
    confidence: float,
    rng: np.random.Generator,
    unit: str = "ms",
    notes: str = "",
) -> MetricResult:
    values = pd.to_numeric(series, errors="coerce").dropna().to_numpy(dtype=float)

    if len(values) == 0:
        return MetricResult(name, None, None, None, 0, unit, notes or "No eligible rows")

    mean_value, ci_lower, ci_upper = bootstrap_statistic(
        values=values,
        statistic_fn=lambda x: float(np.mean(x)),
        iterations=iterations,
        confidence=confidence,
        rng=rng,
    )

    return MetricResult(name, mean_value, ci_lower, ci_upper, len(values), unit, notes)


def compute_metrics(
    df: pd.DataFrame,
    iterations: int,
    confidence: float,
    seed: int,
) -> List[MetricResult]:
    rng = np.random.default_rng(seed)
    results: List[MetricResult] = []

    handshake_df = df[df["__is_handshake_event"]].copy()
    replay_df = df[df["__is_replay_event"]].copy()

    results.append(
        metric_binary_rate(
            series=handshake_df["__is_handshake_success"],
            name="Handshake Success Rate",
            iterations=iterations,
            confidence=confidence,
            rng=rng,
            notes="Estimated from handshake-related exported events",
        )
    )

    results.append(
        metric_binary_rate(
            series=replay_df["__is_replay_blocked"],
            name="Replay Attack Detection Rate",
            iterations=iterations,
            confidence=confidence,
            rng=rng,
            notes="Estimated from replay-related exported events",
        )
    )

    if handshake_df["__processing_time_ms"].notna().any():
        results.append(
            metric_numeric_mean(
                series=handshake_df["__processing_time_ms"],
                name="Average Handshake Processing Time",
                iterations=iterations,
                confidence=confidence,
                rng=rng,
                unit="ms",
                notes="Estimated from exported duration field",
            )
        )

    suspicious_df = df[df["__is_replay_event"] | (~df["__is_handshake_success"])].copy()
    if not suspicious_df.empty:
        results.append(
            metric_binary_rate(
                series=suspicious_df["__has_alert"],
                name="Alert Generation Consistency",
                iterations=iterations,
                confidence=confidence,
                rng=rng,
                notes="Estimated over suspicious or blocked events",
            )
        )

    return results


def preview_dataset(df: pd.DataFrame) -> None:
    print_section("DATASET SUMMARY")
    print(f"Rows: {len(df)}")
    print(f"Columns: {len(df.columns)}")
    print("\nColumns:")
    for column in df.columns:
        print(f"  - {column}")

    print_section("INFERRED SIGNAL SUMMARY")
    print(f"Handshake events: {int(df['__is_handshake_event'].sum())}")
    print(f"Handshake successes: {int(df['__is_handshake_success'].sum())}")
    print(f"Replay events: {int(df['__is_replay_event'].sum())}")
    print(f"Replay blocked: {int(df['__is_replay_blocked'].sum())}")
    print(f"Alerts generated: {int(df['__has_alert'].sum())}")
    print(f"Rows with processing time: {int(df['__processing_time_ms'].notna().sum())}")


def format_metric_result(result: MetricResult) -> str:
    if result.mean is None:
        return (
            f"{result.name}:\n"
            f"  Sample Size: {result.sample_size}\n"
            f"  Status: Not enough eligible data\n"
            f"  Notes: {result.notes}"
        )

    if result.unit == "rate":
        return (
            f"{result.name}:\n"
            f"  Sample Size: {result.sample_size}\n"
            f"  Mean: {result.mean:.4f}\n"
            f"  95% CI: [{result.ci_lower:.4f}, {result.ci_upper:.4f}]\n"
            f"  Notes: {result.notes}"
        )

    return (
        f"{result.name}:\n"
        f"  Sample Size: {result.sample_size}\n"
        f"  Mean: {result.mean:.3f} {result.unit}\n"
        f"  95% CI: [{result.ci_lower:.3f}, {result.ci_upper:.3f}] {result.unit}\n"
        f"  Notes: {result.notes}"
    )


def save_results_json(
    results: List[MetricResult],
    output_path: Path,
    dataset_path: Path,
    iterations: int,
    confidence: float,
    seed: int,
) -> None:
    payload = {
        "dataset_file": str(dataset_path),
        "bootstrap_iterations": iterations,
        "confidence_level": confidence,
        "random_seed": seed,
        "metrics": [
            {
                "name": r.name,
                "mean": r.mean,
                "ci_lower": r.ci_lower,
                "ci_upper": r.ci_upper,
                "sample_size": r.sample_size,
                "unit": r.unit,
                "notes": r.notes,
            }
            for r in results
        ],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def main() -> None:
    args = parse_args()

    exports_dir = Path(args.exports_dir)
    dataset_path = choose_input_file(exports_dir, args.input_file)

    print_section("BOOTSTRAP VALIDATION")
    print(f"Dataset file: {dataset_path}")
    print(f"Bootstrap iterations: {args.iterations}")
    print(f"Confidence level: {int(DEFAULT_CONFIDENCE_LEVEL * 100)}%")
    print(f"Random seed: {args.seed}")

    df = load_dataset(dataset_path)
    df = prepare_dataframe(df)

    preview_dataset(df)

    results = compute_metrics(
        df=df,
        iterations=args.iterations,
        confidence=DEFAULT_CONFIDENCE_LEVEL,
        seed=args.seed,
    )

    print_section("VALIDATION RESULTS")
    for result in results:
        print(format_metric_result(result))
        print()

    if args.output_json:
        output_path = Path(args.output_json)
        save_results_json(
            results=results,
            output_path=output_path,
            dataset_path=dataset_path,
            iterations=args.iterations,
            confidence=DEFAULT_CONFIDENCE_LEVEL,
            seed=args.seed,
        )
        print_section("OUTPUT")
        print(f"Saved results JSON: {output_path}")


if __name__ == "__main__":
    main()