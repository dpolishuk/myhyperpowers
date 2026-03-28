# Hyperpowers for Pi

You have hyperpowers — structured workflows for software development.

## Available Commands

| Command | What It Does |
|---------|-------------|
| `/brainstorm` | Interactive design refinement before coding |
| `/write-plan` | Create detailed implementation plan |
| `/execute-plan` | Execute plan with review checkpoints |
| `/execute-ralph` | Execute entire epic autonomously |
| `/review-impl` | Verify implementation matches spec |
| `/recall` | Search long-term memory from previous sessions |
| `/refactor` | Refactor code safely with tests green |
| `/fix-bug` | Systematic bug fixing workflow |
| `/debug` | Debug with tools and agents |
| `/tdd` | Test-driven development cycle |
| `/analyze-tests` | Audit test quality |
| `/verify` | Verify before claiming complete |
| `/routing-settings` | Configure agent model routing |
| `/setup-models` | Configure Pi model providers (Anthropic, OpenAI, Ollama) |
| `/review-parallel` | Run 3 parallel review subagents (quality, implementation, simplification) |
| `/review-branch` | Review code in isolated subprocess (won't affect main session) |

## Subagent Tool

The `hyperpowers_subagent` tool delegates tasks to isolated Pi subprocesses:

```
Use the hyperpowers_subagent tool with task: "Review src/auth.ts for security issues"
```

The subagent runs with its own context, executes the task, and returns only the result. Use it for:
- Code reviews (isolated context)
- Test running (captures output without polluting main session)
- Research tasks (separate investigation)
- Parallel work (dispatch multiple subagents simultaneously)

## Core Principles

1. **Check for relevant skills before ANY task** — if a command exists for it, use it
2. **Brainstorm before coding** — design first, code second
3. **Verify before completion** — evidence over assertions
4. **Test-driven when possible** — RED, GREEN, REFACTOR

## Memory

If memsearch is installed, memories from previous sessions are automatically recalled on session start. Use `/recall` to search manually.
