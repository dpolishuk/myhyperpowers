---
name: execute-ralph
description: Execute entire epic autonomously with continuous review. No user checkpoints.
---

# Usage

```
/hyperpowers:execute-ralph [--reviewer-model=opus|sonnet]
```

## Arguments

- `--reviewer-model`: Model for autonomous-reviewer (optional)
  - `opus` (default): Highest capability, thorough review
  - `sonnet`: Faster, balanced quality

## What This Does

Executes a complete bd epic without stopping for user review:

1. Loads epic and all tasks
2. Executes each task using TDD and verification gates
3. Re-checks epic success criteria after every task
4. If criteria are unmet and no task is ready, auto-creates the next task, runs SRE refinement, and continues
5. Reviews and fixes issues autonomously in a sequential loop
6. Final close requires BOTH: autonomous-reviewer APPROVED and review-implementation APPROVED
7. Max autonomous no-progress retries: 50
8. Presents summary only at completion

## When to Use

- Well-defined epic with clear success criteria
- Straightforward implementation tasks
- You trust autonomous execution
- You want hands-off operation

## When NOT to Use

- Ambiguous requirements → use `/hyperpowers:execute-plan` instead
- High-risk changes needing human oversight
- Experimental/exploratory work
- You want to review between tasks

## Contract Guardrails

- Do not delegate to `/hyperpowers:execute-plan` checkpoint semantics unless the ambiguity gate is explicitly triggered.
- Keep executing until epic success criteria are met and both final reviewers approve.

## Verdict Normalization Matrix

- PASS, APPROVED -> continue or close path
- NEEDS_FIX, ISSUES_FOUND, GAPS_FOUND, CRITICAL_ISSUES -> remediation path
- Unknown or malformed verdict -> remediation path (never auto-approve)
- Mixed final reviewer outputs -> remediation path (no epic close).

## Quality Gate Sequence (pre-commit-equivalent for this repo)

Run these verification commands as evidence before claiming epic success criteria are met:
In guarded environments, direct .git/hooks/pre-commit execution may be blocked by safety guardrails.

- `node --test tests/execute-ralph-contract.test.js`
- `node --test tests/codex-*.test.js`
- `node --test tests/*.test.js`
- `node scripts/sync-codex-skills.js --check`

## Comparison

| | execute-plan | execute-ralph |
|---|---|---|
| Stops | After each task | Only on failure |
| Review | Final only | Each task + final |
| Model | Inherited | Configurable (opus default) |
| Research | None | Web search during review |

---

Use the `execute-ralph` skill exactly as written. Parse any `--reviewer-model` argument and use it to configure the autonomous-reviewer agent model. Default to opus if not specified.
