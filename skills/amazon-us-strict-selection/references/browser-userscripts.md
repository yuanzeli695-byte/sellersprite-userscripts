# Browser And Userscript Operations

## Public Repository Pair

- Collector: `scripts/sellersprite-traffic-collector.user.js`, version 0.4.6.
- Integrated Runner: `scripts/sellersprite-integrated-runner.user.js`, version 0.3.8.
- Protocol: `1`.
- Collector Schema: `sellerSpriteTraffic/v1`.

A compatible external full-workflow project may retain versioned filenames such as `sellersprite_traffic_collector_v0.4.6.user.js` and `sellersprite_integrated_runner_v0.3.8.user.js`. Verify the metadata version and feature flags rather than assuming a filename proves compatibility.

Feature flags:

- `ENABLE_TIER2_1_ZERO_SHARE_DERIVATION` controls guarded 0% derivation.
- `ENABLE_TIER0_GRANULAR_TELEMETRY` controls the isolated granular timing sidecar.
- `ENABLE_P1_CUMULATIVE_TARGET_CONTROL` controls remaining-target and stop-after-current-row behavior.
- `ENABLE_TIER2_2_CONDITIONAL_RETRY` controls readiness-only retry.

The approved Runner retries at most once and only for explicit chart or tooltip readiness failures. Known low traffic, partial valid samples, ordinary exceptions, and ambiguous data do not qualify for retry.

Use Runner 0.3.7 with Collector 0.4.6, Git history, or a documented release artifact for rollback. The public Skill does not assume older rollback scripts exist in the working tree.

## Installation And Repository Validation

Install Collector before Runner from the Raw links in the repository README. Disable duplicate or older ScriptCat copies, then refresh a new Amazon product page.

Before claiming repository validation, run:

```powershell
npm test
```

Code validation does not prove live SellerSprite behavior. Report deterministic tests and live Chrome smoke as separate evidence.

## Formal Run Preconditions

- Use the user's existing logged-in Chrome session because SellerSprite requires authenticated extension state.
- Use `amazon.com` with an authorized US delivery location selected by the user.
- Disable Chrome automatic translation before collection.
- Confirm SellerSprite is logged in and traffic and price charts load.
- Keep exactly one Collector and one Integrated Runner enabled.
- Do not refresh, switch tabs, scroll unpredictably, or move the pointer while tooltip reading is active.
- Do not run a legacy Batch Runner and Integrated Runner at the same time.

## Runner Fields

Set:

- `batchName`: unique and traceable to the run/date, without sensitive data;
- `operator`: blank or a non-sensitive internal label;
- `targetQualified`: original final strict-qualified target;
- `remainingTargetAtStart`: optional browser stop budget computed from the latest offline replay;
- queue: one ASIN per line after history and local prefiltering.

After `Generate`, confirm the queue hash and counts. After `Start`, watch current ASIN, gate, rejected count, qualified count, retry status, and messages. Stop on CAPTCHA, login expiry, duplicate panels, an unexpected redirect, or parser errors.

At `done`, export combined JSON, enrichment JSON when present, gate/timing TSV, granular JSON/TSV, and control-event TSV before clearing anything.

## Live Deployment Smoke

After installing a new pair:

1. Refresh a fresh Amazon product page.
2. Verify one Collector panel and one Runner panel with expected versions.
3. Run a one-ASIN isolated batch that cannot contaminate a formal run.
4. Confirm final decision, retry decision, short-circuit behavior, telemetry versions, and strict-history impact.
5. Save raw Collector output, full Runner JSON, a structured summary, and a human-readable report.

## Failure Handling

- `Collector not found`: verify 0.4.6 is enabled, older Collectors are disabled, and refresh.
- Duplicate panels: stop; disable extra versions and refresh.
- CAPTCHA or login prompt: pause and ask the user to resolve it.
- `no_chart_loaded` or empty tooltip before readiness timeout: one conditional retry is allowed.
- Missing or ambiguous values after readiness: remain non-passing; never type values manually to force a pass.
- ASIN mismatch or redirect: audit and reject/review according to current acceptance rules; never silently attach the result to the requested ASIN.
