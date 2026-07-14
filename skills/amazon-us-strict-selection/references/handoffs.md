# Agent Handoff Contract

Use a compatible project's documented handoff directories. If none exist, ask where the receiving agent expects the file. Use a timestamped UTF-8 Markdown filename.

## Suggested Frontmatter

```yaml
---
from: codex
to: receiving-agent
priority: p1
requires_action: yes
tags: [tier, component, version, validation]
reply_to: optional_previous_filename.md
---
```

## Required Sections

1. Scope and explicit non-scope.
2. Files changed with actual paths.
3. Feature flags and new/rollback versions.
4. Hard-gate invariants preserved.
5. Test commands and measured results.
6. Paired evidence for B/C changes.
7. Live deployment smoke for browser changes.
8. Known residual risks or audit-only nuances.
9. Evidence artifact paths.
10. Exact questions or approval requested.
11. Statement that work stopped before the next unauthorized Tier.

Do not claim success from a summary alone. Cite raw JSON, TSV, fixture, test, preview, and acceptance artifacts that another agent can inspect.

## User-Facing Closeout

Report the operational result first: counts, pass/fail, versions, false-positive result, history impact, and artifact paths. Distinguish code validation, deterministic replay, and a real live Chrome smoke.
