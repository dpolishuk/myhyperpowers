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
| `/routing-settings` | Interactive TUI wizard to configure subagent type defaults and concrete agent overrides |
| `/setup-models` | Configure Pi model providers (Anthropic, OpenAI, Ollama) |
| `/review-parallel` | Run 3 parallel review subagents (quality, implementation, simplification) |
| `/review-branch` | Review code in isolated subprocess (won't affect main session) |
| `/configure-routing` | Alias for `/routing-settings` |

## Subagent Tool

The `hyperpowers_subagent` tool delegates tasks to isolated Pi subprocesses:

```
Use the hyperpowers_subagent tool with task: "Review src/auth.ts for security issues"
```

The subagent runs with its own context, executes the task, and returns only the result. Specify a `type` for abstract routing, add `agent` for a concrete override, or set `model` for a one-off explicit override:

```
hyperpowers_subagent(task: "Review code", type: "review")
hyperpowers_subagent(task: "Review auth.ts", type: "review", agent: "code-reviewer")
hyperpowers_subagent(task: "Analyze architecture", type: "validation", agent: "autonomous-reviewer")
hyperpowers_subagent(task: "Use a specific model just once", model: "anthropic/claude-opus-4-5", type: "review")
```

Routing precedence:
1. Explicit tool-call `model`
2. Concrete `agent` override
3. Abstract `type` override
4. Default route
5. Inherit current session model

Additional concrete agent names supported for routing overrides include:
- `review-quality`
- `review-implementation`
- `review-simplification`
- `review-testing`
- `review-documentation`
- `test-effectiveness-analyst`

Types: `review` (fast), `research` (balanced), `validation` (capable), `test-runner` (fast)

Configure models per type or concrete agent: `/routing-settings`

## Core Principles

1. **Check for relevant skills before ANY task** — if a command exists for it, use it
2. **Brainstorm before coding** — design first, code second
3. **Verify before completion** — evidence over assertions
4. **Test-driven when possible** — RED, GREEN, REFACTOR

## Memory

If memsearch is installed, memories from previous sessions are automatically recalled on session start. Use `/recall` to search manually.
