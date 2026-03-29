# Pi Support

Hyperpowers includes first-class support for the Pi coding agent through the extension in:

- `.pi/extensions/hyperpowers/`

## What Pi support includes

- Slash commands for Hyperpowers workflows
- `hyperpowers_subagent` for isolated Pi subprocess delegation
- Model routing by subagent type and concrete agent
- Interactive routing configuration through `/routing-settings`
- Session-start memory recall via `memsearch` when available

## Pi commands

Primary Pi commands:

- `/brainstorm`
- `/write-plan`
- `/execute-plan`
- `/execute-ralph`
- `/review-impl`
- `/recall`
- `/refactor`
- `/fix-bug`
- `/debug`
- `/tdd`
- `/analyze-tests`
- `/verify`
- `/routing-settings`
- `/setup-models`
- `/review-parallel`
- `/review-branch`

Compatibility alias:

- `/configure-routing` → alias for `/routing-settings`

## Subagent tool

Use `hyperpowers_subagent` to delegate work to an isolated Pi subprocess.

Examples:

```text
hyperpowers_subagent(task: "Review src/auth.ts for race conditions", type: "review")
hyperpowers_subagent(task: "Verify recent implementation matches requirements", agent: "review-implementation")
hyperpowers_subagent(task: "Run tests and summarize failures", agent: "test-runner")
hyperpowers_subagent(task: "Review this once with a stronger model", model: "anthropic/claude-opus-4-5", type: "validation")
```

## Supported concrete agents for routing

- `code-reviewer`
- `autonomous-reviewer`
- `review-quality`
- `review-implementation`
- `review-simplification`
- `review-testing`
- `review-documentation`
- `test-effectiveness-analyst`
- `codebase-investigator`
- `internet-researcher`
- `test-runner`

## Routing precedence

Routing resolves in this order:

1. Explicit `model`
2. Concrete `agent` override
3. Abstract `type` override
4. Default route
5. Inherit session model

## Configure routing

Use:

```text
/routing-settings
```

This opens the Pi-native TUI wizard for configuring:

- subagent type defaults
- concrete agent overrides
- routing presets

The config file lives at:

```text
~/.pi/agent/extensions/hyperpowers/routing.json
```

## Custom models

Pi discovers built-in provider models and custom models from:

```text
~/.pi/agent/models.json
```

## Troubleshooting

### `pi` command not found

Make sure Pi is installed and available on your `PATH`.

### Subagent runs with the wrong model

Check, in order:

- explicit `model` in the tool call
- concrete `agent` override
- subagent `type` override
- default route

### Routing wizard changes not applied

Inspect:

```text
~/.pi/agent/extensions/hyperpowers/routing.json
```

### No memories appear on session start

`memsearch` recall is opportunistic. If `memsearch` is not installed or returns no results, no memory context is injected.
