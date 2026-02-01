---
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
2. Executes each task using TDD
3. Reviews each task with autonomous-reviewer (uses web search)
4. Fixes issues autonomously (max 2 iterations per task)
5. Runs comprehensive final review
6. Presents summary only at completion

## When to Use

- Well-defined epic with clear success criteria
- Straightforward implementation tasks
- You trust autonomous execution

## When NOT to Use

- Ambiguous requirements → use `/hyperpowers:execute-plan` instead
- High-risk changes needing human oversight
- You want to review between tasks

---

Use the `hyperpowers-execute-ralph` skill exactly as written. Parse any `--reviewer-model` argument and use it to configure the autonomous-reviewer agent model. Default to opus if not specified.
