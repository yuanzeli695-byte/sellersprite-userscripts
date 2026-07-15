---
name: amazon-us-strict-selection
description: Run, audit, or improve a fail-closed Amazon US product-selection workflow using SellerSprite, the paired Traffic Collector and Integrated Runner userscripts, and an optional compatible workbook pipeline. Use for installing or operating this repository's userscripts, validating SellerSprite batches, enforcing hard A-F gates, deduplicating strict-qualified history, delivering Chinese Excel workbooks with embedded images, reviewing pipeline changes, or preparing agent handoffs. Never weaken or bypass a hard gate.
---

# Amazon US Strict Selection

## Operating Contract

Treat current, genuinely collected evidence and the compatible project's acceptance layer as the only release authority.

- Fail closed. Missing, ambiguous, stale, timed-out, redirected, CAPTCHA-blocked, or unreadable evidence cannot pass.
- Allow false negatives; forbid false positives.
- Apply hard exclusions before commercial metrics and stop at the first failed hard gate.
- Use cache and history only to skip or lower priority. Never use either one to grant a pass.
- Put only strict-qualified rows in the final workbook. Keep rejects, reviews, skips, and exceptions in audit outputs.
- Never estimate missing values, rewrite source data, substitute parent sales for child sales, or mark an unevaluated gate as passed.
- Do not change A-F thresholds, gate order, or tolerance settings without separate explicit authorization.
- Keep behavior changes behind a versioned feature flag with a tested rollback path.

## Identify The Operating Mode

Use one of these modes:

1. `userscripts`: this repository or another compatible repository containing the stable Collector and Runner files. Use it for installation, configuration, metadata, protocol, tests, or live browser verification.
2. `full`: a compatible external selection project containing `config/rules.json`, candidate preparation, replay, image, workbook, and acceptance scripts. Use it for formal A-F selection and workbook delivery.

Installing this Skill does not install Chrome, ScriptCat, SellerSprite, or the optional full workbook pipeline.

Resolve `<skill-dir>` from the directory containing this `SKILL.md`; never assume a username or fixed home path. Locate the real project root, then run:

```powershell
python "<skill-dir>/scripts/preflight.py" --project-root "<project-root>" --mode auto
```

Stop on a nonzero exit. Do not invent missing paths, files, values, or evidence.

## Select The Work Path

1. For userscript installation, configuration, paired validation, or browser use, read [browser-userscripts.md](references/browser-userscripts.md). Run the repository's `npm test` before claiming code validation.
2. For a new full selection batch, read [hard-gates.md](references/hard-gates.md), [runbook.md](references/runbook.md), [browser-userscripts.md](references/browser-userscripts.md), and [workbook-delivery.md](references/workbook-delivery.md).
3. For workbook generation or acceptance only, read [hard-gates.md](references/hard-gates.md) and [workbook-delivery.md](references/workbook-delivery.md).
4. For Collector, Runner, parser, cache, ranking, or pipeline changes, read [engineering-governance.md](references/engineering-governance.md) before editing.
5. For deployment or live browser verification, read [browser-userscripts.md](references/browser-userscripts.md) and [engineering-governance.md](references/engineering-governance.md).
6. For an agent transfer or approval request, use [handoffs.md](references/handoffs.md).

## Execute The Full-Workflow State Machine

Use this state machine only in `full` mode. Move forward only when the current state has evidence:

1. `DISCOVERED`: the real project root and inputs exist.
2. `PREFLIGHT_OK`: configurations, history, scripts, and the approved version pair validate.
3. `CANDIDATES_NORMALIZED`: source rows retain provenance and required raw fields.
4. `PREFILTERED`: history dedupe and available A/B/F checks ran; rejected rows are audited and never enter Chrome.
5. `IMAGES_CACHED`: every queued row has a downloadable main image or is removed.
6. `BROWSER_COLLECTED`: one Collector and one Runner produced current traffic, dimensions, price, and telemetry evidence.
7. `REPLAYED`: all batches were replayed through the current A-F acceptance logic.
8. `WORKBOOK_BUILT`: final and rejected-audit workbooks were generated from separate datasets.
9. `ACCEPTED`: the compatible project's acceptance checker returned exit code 0 and the workbook preview was visually inspected.
10. `DELIVERED`: artifact paths, counts, versions, evidence, and residual risks were reported.

Never jump from browser output directly to delivery. Runner results are evidence, not the final release authority.

## Preserve Gate Ownership

- Query filters and local prefilter reduce browser work but cannot grant acceptance.
- Collector owns traffic-reading evidence, not complete product acceptance.
- Integrated Runner short-circuits traffic, dimensions, and price collection, but does not fully evaluate A, B, or F.
- A compatible replay/filter layer performs final rule evaluation.
- A workbook renderer must render already-qualified and audit datasets; it must not decide eligibility.
- A compatible acceptance checker is the final machine gate for workbook delivery.

## Use The Logged-In Browser Deliberately

Use the user's existing Chrome session when SellerSprite authentication or ScriptCat scripts are required. Keep Amazon set to an authorized US delivery location for formal US-market runs, disable automatic translation, and avoid tab switching or pointer movement while tooltip collection is active.

Ask the user to resolve CAPTCHA, expired login, or SellerSprite access blocks. Treat unresolved browser failures as rejection or incomplete evidence, never as pass.

## Produce An Auditable Bundle

For every formal full-mode run, preserve at least:

- candidate source files and normalization report;
- selected queue plus prefilter rejection audit;
- downloaded image files and image report;
- Runner combined batch JSON plus gate, timing, granular, and control-event logs;
- run summary, final-candidate data, and rejected-audit data;
- final workbook, rejected-audit workbook, previews, build report, and acceptance report;
- implementation or deployment handoff when code or userscript versions changed.

## Stop And Escalate

Stop rather than improvising when:

- an input file, required field, source URL, image, dimension, price trend, or traffic metric is missing;
- the active browser versions cannot be verified;
- a final row appears in rejected audit or strict history;
- machine or visual acceptance fails;
- a requested optimization could allow an otherwise failing ASIN into the final workbook;
- a new Tier or threshold change lacks explicit approval.

Tier 2.3 preloading remains unapproved in the documented baseline. Do not implement or enable it without a separate feature flag, paired evidence, deployment smoke, and user confirmation.
