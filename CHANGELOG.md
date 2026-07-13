# Changelog

## Integrated Runner 0.3.7

- Added gate-profiled local strict-qualified history with queue auto-skip; rule/threshold changes invalidate stale history, and the public build has no preloaded business ASINs.
- Added the current-price gate of `$9.90-$50.00` before the stable/rising trend gate.
- Added current/min/max price fields and combined gate/timing telemetry with TSV copy actions.
- Added conditional Collector retry for readiness failures, limited to one retry.
- Preserved stable ScriptCat metadata, protocol/Schema/run-id validation, sanitized URLs, pause protection, and safe batch-picker DOM construction.
- Added a recheck path so legacy pass rows without a valid current price are not counted as new strict-qualified results.

## Traffic Collector 0.4.6

- Added Tier 0 gate/timing telemetry and `Copy Gate TSV` / `Copy Timing TSV` actions.
- Added guarded Tier 2.1 zero-share derivation only for explicit zero natural traffic over a positive total.
- Preserved `sellerSpriteTraffic/v1`, protocol `1`, run IDs, stale-result clearing, and no persistent result storage.
- Distinguished hard traffic rejection from readiness/error review in gate telemetry.

## Integrated Runner 0.3.4

- Added stable GitHub update and download metadata.
- Removed the personal default operator value.
- Replaced batch picker HTML interpolation with safe DOM option creation.
- Stabilized the script name so future version changes update in place.
- Replaced status-text polling with a versioned Collector run/result handshake.
- Removed automation query parameters from stored result URLs.
- Rejected Collector payloads unless both `decision=pass` and `pass70=true` agree with the metrics.
- Preserved a user pause across in-flight row updates and rechecked state before navigation.

## Traffic Collector 0.4.4

- Added stable GitHub update and download metadata.
- Added a runtime version constant so the panel and metadata stay aligned.
- Added versioned protocol, schema and run IDs for reliable Runner handoff.
- Published structured error results and cleared stale results before each run.
- Removed redundant Amazon `localStorage` persistence and sanitized result URLs.
- Scoped chart discovery and tooltip scanning to SellerSprite chart elements.
- Built chart events with the page's own event constructors.
- Counted only weeks with a parsed natural-share metric toward `weeksRead`.
