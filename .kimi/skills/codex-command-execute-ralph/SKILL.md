---
name: codex-command-execute-ralph
description: Use when task intent matches command 'execute-ralph'. Do not use for unrelated workflows.
---

# Codex Command Wrapper

This skill wraps the source file `commands/execute-ralph.md` for Codex Skills compatibility.

## Usage

- Use this skill when the request matches the intent of `commands/execute-ralph.md`.
- Follow the source instructions exactly.
- Do not use this skill for unrelated tasks.

## Source Content

```markdown
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
2. Executes each task using TDD
3. Reviews each task with autonomous-reviewer (uses web search)
4. Fixes issues autonomously (max 2 iterations per task)
5. Runs comprehensive final review
6. Presents summary only at completion

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

## Comparison

| | execute-plan | execute-ralph |
|---|---|---|
| Stops | After each task | Only on failure |
| Review | Final only | Each task + final |
| Model | Inherited | Configurable (opus default) |
| Research | None | Web search during review |

---

Use the `execute-ralph` skill exactly as written. Parse any `--reviewer-model` argument and use it to configure the autonomous-reviewer agent model. Default to opus if not specified.
```
