# Strict Selection Runbook

## 1. Locate And Inspect

Use the actual project root. Run the Skill preflight first. In `userscripts` mode, read the repository README and configuration guide and run `npm test`. In `full` mode, also read the compatible project's pipeline runbook, configuration, and recent progress notes when present.

Synchronize strict-qualified history before preparing a new full-mode queue using the compatible project's documented history command. Historical strict-qualified ASINs must be skipped before Chrome and must not count toward the new target.

## 2. Prepare Candidate Sources

Use the compatible project's approved SellerSprite query preset and exact hard values. Do not widen the search range.

Preserve raw values and source-page provenance. TSV import is a normalization and history-dedupe adapter only; it does not prove commercial eligibility.

If the compatible project provides `prepare_strict_candidate_pool.py`, use its documented arguments and inspect the rejected set, queue summary, history skip count, required-field completeness, and selected ASIN count before opening Chrome.

Ranking may reorder only rows that already passed the same prefilter. Prove that the candidate multiset is unchanged. A rollback option may restore legacy ordering but must not bypass filters.

## 3. Cache Main Images

Use the compatible project's image downloader before browser collection. Remove or repair failed image rows before final delivery. An image URL alone is not sufficient.

## 4. Collect In Chrome

Follow [browser-userscripts.md](browser-userscripts.md). Set `targetQualified` to the requested final strict-qualified count, not the queue length. Supply a queue larger than the target and let the Runner stop at `target_reached`.

Export and save:

- combined batch JSON;
- enrichment JSON when applicable;
- gate log TSV;
- timing log TSV.
- granular timing JSON/TSV and control-event TSV when Runner 0.3.8 telemetry is enabled.

Do not run a formal US batch with Amazon set to a non-US delivery location.

## 5. Replay One Or More Batches

Use the compatible project's replay command. Pair each batch JSON with the exact candidate JSON that produced it, preserve pair order, and replay all pairs into one run when multiple batches are needed.

If the target is not met, add new candidates and another batch pair. Never promote rejected or review rows to make up the count.

## 6. Build And Accept

Install or load the dependencies documented by the compatible project. Run its authoritative workbook renderer and acceptance checker. Exit code 0 is required.

Read the acceptance report and visually inspect generated previews before delivery. Do not substitute spreadsheet formulas or manual row edits for the acceptance layer.

## 7. Close The Run

Report target, qualified count, rejected count, attempts, stop reason, batch versions, history skips, image count, acceptance result, artifact paths, and unresolved risks. Update strict history only from genuinely delivered strict-qualified output.
