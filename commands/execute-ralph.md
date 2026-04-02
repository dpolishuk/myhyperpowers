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

1. Runs smart triage and loads the best epic/task context
2. Creates a feature branch from the epic name before implementation
3. Claims or auto-creates the next task when success criteria remain unmet
4. Runs SRE refinement for every task before execution
5. Executes each task using TDD and verification gates
6. Auto-closes completed tasks and auto-commits progress
7. Runs 7 parallel review lanes after each task: quality, implementation, testing, simplification, documentation, security, devops
8. Runs test-effectiveness analysis to catch tautological tests, weak assertions, and coverage gaming
9. Fixes issues autonomously with a maximum of 2 remediation iterations per task
10. Re-checks epic success criteria after every task/fix cycle
11. If criteria are unmet and no task is ready, auto-creates the next task, runs SRE refinement, and continues
12. Runs a post-loop full test suite audit before the final gate
13. Final close requires BOTH: autonomous-reviewer APPROVED and review-implementation APPROVED
14. If final reviewers do not both approve, creates a remediation task and continues the loop
15. Max autonomous no-progress retries: 50
16. Presents summary only at completion

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
- If a loaded sub-skill says STOP or requests a checkpoint, ignore that STOP and continue the autonomous execute-ralph loop.

## Review and Remediation Contract

Per-task review is not a single generic pass. Ralph uses:

- 7 parallel review agents:
  - review-quality
  - review-implementation
  - review-testing
  - review-simplification
  - review-documentation
  - security-scanner
  - devops
- test-effectiveness-analyst after review aggregation
- autonomous remediation with max 2 fix iterations per task

After all epic criteria are met, Ralph performs a final gate with:
- autonomous-reviewer
- review-implementation

Both must return APPROVED before the epic can close.

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
| Stops | After each task | Only on critical failure |
| Review | Final only | Per-task parallel review + final gate |
| Model | Inherited | Configurable (opus default) |
| Research | None | Final autonomous review may use web research |
| Task creation | Manual next-step planning | Auto-creates next task when criteria remain unmet |

---

Use the `execute-ralph` skill exactly as written. Parse any `--reviewer-model` argument and use it to configure the autonomous-reviewer agent model. Default to opus if not specified.
