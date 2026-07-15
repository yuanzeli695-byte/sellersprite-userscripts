# Progress

## 2026-07-15 - Task: Publish Runner 0.3.8 P1 controls and timing analyzer

### What was done

- Merged the completed Runner 0.3.8 P1 target-control and granular-telemetry work into the hardened public userscript while preserving the published gate, metadata, DOM-safety, URL-sanitization, history, and Collector-handshake behavior.
- Added cumulative remaining-target control, stop-after-current-row handling, pause/stop state merging, isolated granular sidecars, and control-event exports.
- Added a standard-library offline timing analyzer, fail-closed tests, public P1 documentation, configuration guidance, changelog notes, and package commands.
- Updated the installable `amazon-us-strict-selection` Skill and its preflight to require Runner 0.3.8 and the P1 feature flags in both public-userscript and compatible full-project modes.
- Removed a real business ASIN and personal operator name that an older validator had embedded as forbidden-test literals; public validation now enforces those boundaries with a generic ASIN-pattern assertion and an explicitly empty operator field.

### Testing

- `npm test` passed: userscript validation, core logic, Runner P1 baseline/security tests, Skill validation, and 10 Python analyzer tests.
- Public repository preflight passed in `userscripts` mode; the compatible full project passed in `full` mode with the expected workbook-package warning only.
- The analyzer successfully paired the real 371 timing/gate rows across six batches and reproduced the inferred residual `624,505 ms = 615,273 ms + 9,232 ms - 0 ms`.
- `node --check` passed for both userscripts and the changed JavaScript tests; `git diff --check` passed.
- A live Chrome/ScriptCat isolated one-ASIN smoke remains required before a formal run.

### Notes

- Changed: `CHANGELOG.md`
- Changed: `README.md`
- Changed: `docs/CONFIGURATION.md`
- Added: `docs/P1_TARGET_CONTROL_AND_GRANULAR_TELEMETRY.md`
- Changed: `package.json`
- Added: `scripts/analyze_timing.py`
- Changed: `scripts/sellersprite-integrated-runner.user.js`
- Changed: `skills/amazon-us-strict-selection/SKILL.md`
- Changed: `skills/amazon-us-strict-selection/references/browser-userscripts.md`
- Changed: `skills/amazon-us-strict-selection/references/engineering-governance.md`
- Changed: `skills/amazon-us-strict-selection/references/runbook.md`
- Changed: `skills/amazon-us-strict-selection/scripts/preflight.py`
- Added: `tests/test_analyze_timing.py`
- Added: `tools/runner-p1.test.mjs`
- Changed: `tools/validate-userscripts.mjs`
- Added: `progress.md`
- Rollback point: commit `3960d11` (Runner 0.3.7 + Collector 0.4.6).
