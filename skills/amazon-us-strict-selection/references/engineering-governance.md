# Engineering And Change Governance

## Non-Negotiable Boundary

Ask one question before merging a change: can it allow an ASIN that fails any A-F hard gate into the final workbook? If yes or uncertain, do not merge it.

Optimization may change which candidates are evaluated, their order, how quickly evidence becomes ready, or whether a known reject is skipped. It may not change final acceptance authority or fabricate evidence.

## Change Classes

### A: Ordering Or Documentation

Examples: query procedure, reorder-only ranking, audit fields.

Require deterministic tests proving the accepted/rejected multiset is unchanged. Ranking can reorder but cannot add, remove, pass, or reject candidates.

### B: Reader, Retry, Cache, Or Browser Timing

Examples: tooltip parsing, DOM readiness, conditional retry, data cache.

Require a versioned flag, fixtures, old/new paired validation on at least 30 real ASINs, 100% final gate-outcome agreement, zero false positives, and a live deployment smoke. Any mismatch may only be more conservative.

### C: Parallelism Or Focus-Sensitive Changes

Examples: multiple Chrome profiles, background preloading, concurrency.

Require the B-class evidence plus explicit rate-limit, CAPTCHA, focus, isolation, and rollback tests. Start at low concurrency. Partial or failed reads remain non-passing.

## Tier Order And Stop Points

Proceed in this order and stop for confirmation after each completed Tier:

1. Tier 0 observability.
2. Tier 1 source reduction and reorder-only ranking.
3. Tier 2 reader readiness and conditional retry.
4. Tier 3 downward-only reject/cache reuse.
5. Tier 4 parallelism and secondary throughput work.

Documented baseline:

- Tier 0 complete.
- Tier 1.1 procedure and Tier 1.2 reorder-only ranking complete.
- Tier 1.3 proxy-field implementation is not authorized without real source fields.
- Tier 2.1 guarded-zero parsing and Tier 2.2 conditional retry are represented by Collector 0.4.6 and Runner 0.3.7.
- Tier 2.3 preloading is paused.
- Do not begin later Tiers merely because earlier code exists.

## Required Change Package

Every change must include:

- actual file discovery before editing;
- feature flag and version identifier;
- unchanged hard-threshold proof;
- focused unit/fixture tests;
- class-appropriate comparison evidence;
- audit fields for skip/retry/failure behavior;
- documented rollback to a previous release, tag, commit, or retained artifact;
- deployment instructions and smoke evidence when browser code changes;
- a progress entry and handoff when the project requires them;
- a stop for user confirmation before the next Tier.

## Cache Rules

Cache may:

- skip a recently rejected ASIN;
- lower candidate priority;
- avoid re-reading evidence when deciding whether an ASIN is worth another browser visit.

Cache may not:

- mark an ASIN qualified;
- populate missing current evidence in a final row;
- bypass current acceptance revalidation;
- prevent TTL expiry from permitting later re-collection.

Any ASIN entering the final workbook must pass current acceptance with current evidence.

## Verification

Run relevant Python and JavaScript tests from the real project root. For userscript changes, include `node --check`, targeted userscript tests, full repository regression tests, paired replay when applicable, and a live smoke. Preserve raw evidence files rather than reporting conclusions only.
