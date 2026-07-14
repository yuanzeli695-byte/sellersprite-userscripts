#!/usr/bin/env python3
"""Read-only integrity preflight for Amazon US strict-selection projects."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


APPROVED_RULES: dict[str, Any] = {
    "priceMinUsd": 9.9,
    "priceMaxUsd": 50.0,
    "minRating": 4.0,
    "maxReviews": 100,
    "reviewsTolerance": 15,
    "launchAgeMaxDays": 90,
    "variationsMax": 25,
    "monthlySalesIdealMin": 50,
    "monthlySalesIdealMax": 300,
    "monthlySalesHardMax": 1500,
    "trafficNaturalMinPct": 70,
    "trafficRecent4AvgMinPct": 70,
    "trafficRecent4MinMinPct": 70,
    "trafficWeeksReadMin": 3,
    "asinMismatchPolicy": "review",
    "imageEmbedRequired": True,
    "dimensionsRequired": True,
    "priceTrendRequired": True,
    "allowedPriceTrendClasses": ["stable", "rising"],
    "translationMode": "manual",
}

ALLOWED_DYNAMIC_RULE_KEYS = {"runDate"}
EXCLUSION_TOP_LEVEL_KEYS = {"hardExclusions", "reviewFlags", "brandScrutiny"}
PIPELINE_TOP_LEVEL_KEYS = {
    "targetN",
    "maxAttemptTotal",
    "maxAttemptPerBatch",
    "candidateSources",
    "cache",
    "sellersprite",
    "images",
    "output",
}

APPROVED_SCRIPTS: dict[str, dict[str, Any]] = {
    "collector": {
        "version": "0.4.6",
        "flag": "ENABLE_TIER2_1_ZERO_SHARE_DERIVATION",
        "candidates": [
            "scripts/sellersprite-traffic-collector.user.js",
            "scripts/sellersprite_traffic_collector_v0.4.6.user.js",
        ],
    },
    "runner": {
        "version": "0.3.7",
        "flag": "ENABLE_TIER2_2_CONDITIONAL_RETRY",
        "candidates": [
            "scripts/sellersprite-integrated-runner.user.js",
            "scripts/sellersprite_integrated_runner_v0.3.7.user.js",
        ],
    },
}

OPTIONAL_ROLLBACK_SCRIPTS = {
    "collector": "scripts/sellersprite_traffic_collector_v0.4.5.user.js",
    "runner": "scripts/sellersprite_integrated_runner_v0.3.6.user.js",
}

USERSCRIPT_REPO_REQUIRED_FILES = [
    "README.md",
    "docs/CONFIGURATION.md",
    "package.json",
    "scripts/sellersprite-traffic-collector.user.js",
    "scripts/sellersprite-integrated-runner.user.js",
    "tools/validate-userscripts.mjs",
    "tools/core-logic.test.mjs",
]

FULL_PROJECT_REQUIRED_FILES = [
    "README.md",
    "PIPELINE_RUNBOOK.md",
    "config/rules.json",
    "config/exclusions.json",
    "config/pipeline.json",
    "history/strict_qualified_asins.json",
    "scripts/candidate_tsv_to_json.py",
    "scripts/prepare_strict_candidate_pool.py",
    "scripts/download_candidate_images.py",
    "scripts/replay_existing_batch.py",
    "scripts/build_replay_workbooks.mjs",
    "scripts/acceptance_checker.py",
    "scripts/filter_engine.py",
    "scripts/qualified_pool_manager.py",
    "scripts/state_store.py",
    "scripts/strict_history.py",
    "tests/test_sellersprite_traffic_collector_v046.mjs",
    "tests/test_sellersprite_integrated_runner_v037.mjs",
]

RUN_FILES = [
    "run_summary.json",
    "final_candidates_data.json",
    "rejected_audit_data.json",
    "workbook_build_report.json",
    "acceptance_report.md",
]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def is_userscript_repo(path: Path) -> bool:
    return (
        (path / "package.json").is_file()
        and (path / "scripts" / "sellersprite-traffic-collector.user.js").is_file()
        and (path / "scripts" / "sellersprite-integrated-runner.user.js").is_file()
    )


def is_full_project(path: Path) -> bool:
    return (
        (path / "config" / "rules.json").is_file()
        and (path / "scripts" / "replay_existing_batch.py").is_file()
        and (path / "scripts" / "acceptance_checker.py").is_file()
    )


def matching_mode(path: Path, requested_mode: str) -> str | None:
    if requested_mode in ("auto", "full") and is_full_project(path):
        return "full"
    if requested_mode in ("auto", "userscripts") and is_userscript_repo(path):
        return "userscripts"
    return None


def discover_root(explicit: str | None, requested_mode: str) -> tuple[Path, str]:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    else:
        for variable in ("AMAZON_SELECTION_ROOT", "AMAZON_PRODUCTS_ROOT"):
            value = os.environ.get(variable)
            if value:
                candidates.append(Path(value).expanduser())
        cwd = Path.cwd()
        candidates.extend([cwd, *cwd.parents])

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        mode = matching_mode(resolved, requested_mode)
        if mode:
            return resolved, mode

    target = explicit or "the current directory, its parents, or AMAZON_SELECTION_ROOT"
    raise FileNotFoundError(
        f"compatible Amazon selection project not found at {target}; "
        "pass --project-root and choose --mode userscripts or --mode full"
    )


def userscript_version(path: Path) -> str | None:
    match = re.search(
        r"^\s*//\s*@version\s+([^\s]+)",
        path.read_text(encoding="utf-8-sig"),
        re.MULTILINE,
    )
    return match.group(1) if match else None


def userscript_flag_enabled(path: Path, flag: str) -> bool:
    text = path.read_text(encoding="utf-8-sig")
    pattern = rf"^\s*(?:(?:var|let|const)\s+)?{re.escape(flag)}\s*=\s*(true|false)\s*;"
    assignments = re.findall(pattern, text, re.MULTILINE)
    return assignments == ["true"]


def find_script(root: Path, candidates: list[str]) -> tuple[Path, str] | tuple[None, None]:
    for relative in candidates:
        path = root / relative
        if path.is_file():
            return path, relative
    return None, None


def history_count(payload: Any) -> int | None:
    if not isinstance(payload, dict):
        return None
    if isinstance(payload.get("count"), int):
        return payload["count"]
    if isinstance(payload.get("asins"), list):
        return len(payload["asins"])
    return None


def compare_rules(actual: dict[str, Any]) -> list[dict[str, Any]]:
    drift = []
    for key, expected in APPROVED_RULES.items():
        value = actual.get(key, "<missing>")
        if value != expected:
            drift.append({"key": key, "expected": expected, "actual": value})
    for key in sorted(set(actual) - set(APPROVED_RULES) - ALLOWED_DYNAMIC_RULE_KEYS):
        drift.append({"key": key, "expected": "<unsupported>", "actual": actual[key]})
    run_date = actual.get("runDate")
    if run_date is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(run_date)):
        drift.append({"key": "runDate", "expected": "YYYY-MM-DD", "actual": run_date})
    return drift


def validate_full_config(parsed_json: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    exclusions = parsed_json.get("config/exclusions.json")
    if not isinstance(exclusions, dict):
        errors.append("config/exclusions.json must be a JSON object")
    else:
        unknown = sorted(set(exclusions) - EXCLUSION_TOP_LEVEL_KEYS)
        if unknown:
            errors.append(f"config/exclusions.json has unsupported top-level keys: {', '.join(unknown)}")
        for key in ("hardExclusions", "reviewFlags", "brandScrutiny"):
            value = exclusions.get(key)
            if not isinstance(value, (dict, list)) or not value:
                errors.append(f"config/exclusions.json requires a nonempty {key}")

    pipeline = parsed_json.get("config/pipeline.json")
    if not isinstance(pipeline, dict):
        errors.append("config/pipeline.json must be a JSON object")
    else:
        unknown = sorted(set(pipeline) - PIPELINE_TOP_LEVEL_KEYS)
        if unknown:
            errors.append(f"config/pipeline.json has unsupported top-level keys: {', '.join(unknown)}")
        for key in ("candidateSources", "cache", "sellersprite", "images", "output"):
            value = pipeline.get(key)
            if not isinstance(value, (dict, list)) or not value:
                errors.append(f"config/pipeline.json requires a nonempty {key}")
        if not isinstance(pipeline.get("targetN"), int) or pipeline["targetN"] <= 0:
            errors.append("config/pipeline.json targetN must be a positive integer")
    return errors


def validate_full_runtime() -> list[str]:
    errors: list[str] = []
    if importlib.util.find_spec("PIL") is None:
        errors.append("Python dependency Pillow is required for full-mode image processing")

    node = shutil.which("node")
    if not node:
        errors.append("Node.js 20 or newer is required for full-mode workbook rendering")
    else:
        try:
            version = subprocess.run(
                [node, "--version"],
                check=True,
                capture_output=True,
                text=True,
                timeout=10,
            ).stdout.strip()
            match = re.match(r"v?(\d+)", version)
            if not match or int(match.group(1)) < 20:
                errors.append(f"Node.js 20 or newer is required; found {version or 'unknown'}")
        except Exception as exc:
            errors.append(f"could not verify Node.js version: {exc}")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root")
    parser.add_argument("--mode", choices=("auto", "userscripts", "full"), default="auto")
    parser.add_argument("--run-dir", help="Optionally verify a completed full-mode run bundle")
    parser.add_argument("--json-out", type=Path, help="Optionally save the JSON report")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    errors: list[str] = []
    warnings: list[str] = []

    try:
        root, mode = discover_root(args.project_root, args.mode)
    except Exception as exc:
        report = {
            "schemaVersion": "amazonStrictSelectionPreflight/v2",
            "ok": False,
            "mode": None,
            "errors": [str(exc)],
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2

    required_files = (
        USERSCRIPT_REPO_REQUIRED_FILES if mode == "userscripts" else FULL_PROJECT_REQUIRED_FILES
    )
    missing = [relative for relative in required_files if not (root / relative).is_file()]
    errors.extend(f"missing required file: {relative}" for relative in missing)

    script_report: dict[str, Any] = {}
    for role, definition in APPROVED_SCRIPTS.items():
        path, relative = find_script(root, definition["candidates"])
        actual_version = userscript_version(path) if path else None
        flag_enabled = bool(path and userscript_flag_enabled(path, definition["flag"]))
        role_ok = actual_version == definition["version"] and flag_enabled
        script_report[role] = {
            "path": str(path) if path else None,
            "relativePath": relative,
            "expectedVersion": definition["version"],
            "actualVersion": actual_version,
            "requiredFlag": definition["flag"],
            "requiredFlagEnabled": flag_enabled,
            "ok": role_ok,
        }
        if not path:
            errors.append(f"{role} script not found in compatible locations")
        elif actual_version != definition["version"]:
            errors.append(
                f"{role} version mismatch: expected {definition['version']}, got {actual_version}"
            )
        if path and not flag_enabled:
            errors.append(f"{role} approved feature flag is not enabled: {definition['flag']}")

    parsed_json: dict[str, Any] = {}
    rule_drift: list[dict[str, Any]] = []
    strict_history_count = None
    if mode == "full":
        for relative in (
            "config/rules.json",
            "config/exclusions.json",
            "config/pipeline.json",
            "history/strict_qualified_asins.json",
        ):
            path = root / relative
            if not path.is_file():
                continue
            try:
                parsed_json[relative] = load_json(path)
            except Exception as exc:
                errors.append(f"invalid JSON {relative}: {exc}")

        rules = parsed_json.get("config/rules.json")
        if isinstance(rules, dict):
            rule_drift = compare_rules(rules)
        elif (root / "config" / "rules.json").is_file():
            errors.append("config/rules.json must be a JSON object")
        if rule_drift:
            errors.append(
                "approved hard-rule baseline drift detected; obtain explicit authorization before changing it"
            )

        errors.extend(validate_full_config(parsed_json))
        errors.extend(validate_full_runtime())

        history_payload = parsed_json.get("history/strict_qualified_asins.json")
        strict_history_count = history_count(history_payload)
        if strict_history_count is None and (
            root / "history" / "strict_qualified_asins.json"
        ).is_file():
            errors.append("strict history count could not be determined")

        for role, relative in OPTIONAL_ROLLBACK_SCRIPTS.items():
            if not (root / relative).is_file():
                warnings.append(
                    f"optional {role} rollback script was not found; use a documented Git release or commit"
                )
        warnings.append(
            "project-specific workbook packages are not resolved by this generic preflight; "
            "verify them with the compatible project's documented build command"
        )

    run_report = None
    if args.run_dir:
        if mode != "full":
            errors.append("--run-dir is only valid in full mode")
        else:
            run_dir = Path(args.run_dir).expanduser()
            if not run_dir.is_absolute():
                run_dir = root / run_dir
            run_dir = run_dir.resolve()
            missing_run_files = [name for name in RUN_FILES if not (run_dir / name).is_file()]
            run_report = {
                "path": str(run_dir),
                "missingFiles": missing_run_files,
                "ok": not missing_run_files,
            }
            errors.extend(f"run bundle missing: {name}" for name in missing_run_files)

    report = {
        "schemaVersion": "amazonStrictSelectionPreflight/v2",
        "ok": not errors,
        "mode": mode,
        "projectRoot": str(root),
        "requiredFilesMissing": missing,
        "approvedRuleDrift": rule_drift,
        "userscripts": script_report,
        "strictQualifiedHistoryCount": strict_history_count,
        "runBundle": run_report,
        "warnings": warnings,
        "errors": errors,
    }

    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered + "\n", encoding="utf-8")
    return 0 if report["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
