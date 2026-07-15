# P1 Target Control And Granular Telemetry

## Scope

Runner `0.3.8` adds two observation/coordination features while keeping the Collector at `0.4.6`:

- an optional externally supplied cumulative remaining target;
- a `Stop after current row` action that lets an in-flight row finish;
- a granular telemetry sidecar for navigation, Collector handshakes, persistence, panel rendering, and control events.

Runner `qualifiedCount`, `browserPassesThisBatch`, `remainingTargetAfterBrowser`, and every sidecar field remain browser evidence only. In a compatible full workflow, final release authority remains its replay and acceptance layers.

## Target control

The existing `targetQualified` field remains the requested final target for the run. For a later browser batch, the operator may enter `remainingTargetAtStart`, computed from the latest offline replay of the same run:

```text
remainingTargetAtStart = requested final target - offline replay qualified count
```

When present, Runner uses that snapshot only as a queue-stop budget. It stores:

- `requestedFinalTargetAtStart`;
- `remainingTargetAtStart`;
- `browserPassesThisBatch`;
- `remainingTargetAfterBrowser` (observation only);
- `targetControlVersion`;
- `stopAfterCurrentRowRequested`, `stopAction`, and `stopReason`.

The snapshot is not automatically changed by Runner. Recompute it after offline replay before generating the next batch. A zero remaining target does not generate a browser batch. An invalid or oversized remaining target fails closed.

Use the same frozen run baseline when calculating the snapshot. The current replay/history synchronization behavior is unchanged in P1, so repeatedly replaying a partial run against a history ledger already updated by that unfinished run can self-skip prior rows. This change does not silently alter that history contract.

`Stop after current row` is separate from `Pause`: it does not cancel Collector work or create a partial result. The current row is saved first, then the batch ends with `operator_stop_after_current_row`.
Before every in-flight stage save, Runner merges the latest persisted stop/pause fields so a button click made during an asynchronous Collector or chart wait cannot be overwritten by an older state snapshot.
If the operator pauses an in-flight row and then requests a stop, Runner lets that row finish and closes the batch after saving it; it does not end the batch early or leave the completed stop request stranded in `paused` state.

## Granular sidecar

With `ENABLE_TIER0_GRANULAR_TELEMETRY=true`, Runner stores `sellerSpriteGranularTelemetry/v1` under its local sidecar key and exposes separate copy buttons for granular JSON, granular TSV, and control-event TSV. The legacy `sellerSpriteTelemetry/v1`, gate TSV, timing TSV, and combined JSON structures remain unchanged apart from the additive target-control fields.

Missing or stale sidecars are reported as missing; no zero or inferred timing is inserted. Sidecar writes never call `saveBatch` or alter gate decisions.

Granular writes and cleanup are best-effort: storage quota or permission errors are isolated from Runner state saves, navigation, stop handling, and gate evaluation. Sidecars are tied to the batch creation timestamp, and regenerating the same deterministic queue hash starts a fresh sidecar instead of reusing prior rows or control events.

The sidecar records navigation intent and page timing snapshots, observed Collector button/tab/chart/status events, every Collector attempt including retry attempts, existing Collector internal timing fields, state persistence and panel-render timings, fixed delay observations, and pause/resume/recovery/error events.

The public repository's versioned Collector protocol/schema/run-id handshake, tooltip scan order, and readiness-only retry policy are deliberately unchanged. Reader timing or handshake changes remain separate Class B experiments and require paired validation before modification.

## Offline timing analysis

Run the standard-library analyzer against a completed run:

```powershell
python scripts\analyze_timing.py runs\RUN_ID --format both
```

The analyzer strictly pairs `timing_log_*.tsv` with `gate_log_*.tsv` by `(batchName, queueHash, asin)`. It fails closed on missing columns, duplicate/orphan rows, malformed timestamps, negative durations, or unexplained blank stage values.

It reports both observed wall time (first `startedAt` to last `finishedAt`) and inferred wall time including each batch's first `detailPageMs`. It separately reports stage totals, row-clock overhead, intra-batch unattributed gaps, and inter-batch gaps because `detailPageMs` spans navigation and adjacent-row transitions rather than being a pure isolated stage.

In the audited 371-row case study, the inferred wall-minus-stage residual was exactly `624,505 ms = 615,273 ms unattributed intra-batch gap + 9,232 ms row-clock overhead - 0 ms detail outside the inferred boundary`. The legacy TSV cannot prove whether the 615,273 ms came from panel rendering, JSON serialization, storage writes, fixed delays, or another inter-row activity. Runner `0.3.8` records those candidate components separately so later runs can attribute them from evidence.

The generated JSON and Markdown contain the absolute `runDir`, source-file paths, batch names, queue hashes, and outcome aggregates. Review and redact those fields before posting a report to a public Issue.

## Rollback and smoke

Rollback is to Runner `0.3.7` with Collector `0.4.6`. No history or acceptance rollback is required. Automated syntax, unit, baseline-hash, analyzer, and preflight validation has passed. A live Chrome/ScriptCat one-ASIN smoke is still required before a formal run:

1. verify exactly one Collector `0.4.6` and one Runner `0.3.8` panel;
2. run one isolated ASIN that cannot contaminate a formal target;
3. confirm legacy gate/timing output is unchanged in meaning and granular fields are populated;
4. confirm a forged sidecar cannot affect replay or acceptance;
5. preserve the raw JSON, sidecar exports, and smoke report.

No timeout, tooltip-scan, DOM-attribute-handshake, preloading, hidden-tab, or concurrent-page optimization is included in this P1 change.
