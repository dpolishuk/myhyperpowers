# Pi Support

Hyperpowers includes first-class support for the Pi coding agent through the extension in:

- `.pi/extensions/hyperpowers/`

## What Pi support includes

- Slash commands for Hyperpowers workflows
- `hyperpowers_subagent` for isolated Pi subprocess delegation
- A shared internal Pi task runner used by Hyperpowers orchestration
- Model routing by subagent type and concrete agent
- Routed effort mapped to Pi thinking controls when configured
- True extension-side `/review-parallel` fan-out/fan-in
- Advisory `metadata.pi` skill frontmatter parsing for future Pi-specific execution hints
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

## Internal orchestration core

Hyperpowers now uses a shared internal task runner for Pi subprocess orchestration.

Current wave-1 execution modes supported by the runner are:
- `single` — used by `hyperpowers_subagent`
- `parallel` — used by `/review-parallel`
- `chain` — available in the shared runner for future workflows

The runner preserves the existing Hyperpowers Pi contracts while centralizing:
- subprocess launch semantics
- fresh vs fork context handling
- cancellation propagation
- output limits
- structured/text result normalization

## Subagent tool

Use `hyperpowers_subagent` to delegate work to an isolated Pi subprocess.

By default, subagent execution is ephemeral (`pi --print --no-session`) so child runs do not persist their own Pi session history.

Examples:

```text
hyperpowers_subagent(task: "Review src/auth.ts for race conditions", type: "review")
hyperpowers_subagent(task: "Verify recent implementation matches requirements", agent: "review-implementation")
hyperpowers_subagent(task: "Run tests and summarize failures", agent: "test-runner")
hyperpowers_subagent(task: "Review this once with a stronger model", model: "anthropic/claude-opus-4-5", type: "validation")
hyperpowers_subagent(task: "Return machine-readable findings", type: "review", format: "structured")
```

Structured mode asks the subagent to return JSON only and parses that JSON before returning it to the caller. This improves machine readability, but it does not guarantee that the model's findings are semantically correct.

Top-level structured fields remain:
- `status`
- `summary`
- `findings`
- `nextAction`

Failure-path findings may also include additive metadata such as `type` and `source` when the helper knows more about the failure.

## Skill metadata

Hyperpowers also parses optional advisory Pi skill frontmatter under `metadata.pi`.

Supported fields currently include:
- `subProcess`
- `subProcessContext`
- `model`
- `thinkingLevel`

Important: this metadata is currently **advisory**, not authoritative.
It is parsed and normalized for Hyperpowers-native Pi behavior, but it does **not** override the routing decisions made through `/routing-settings`.

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

If routing also specifies `effort`, the extension maps that value to Pi's `--thinking` flag for the child subprocess.

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

If the reasoning intensity is wrong rather than the model itself, also inspect the routed `effort` value because it maps to Pi's `--thinking` flag.

### Routing wizard changes not applied

Inspect:

```text
~/.pi/agent/extensions/hyperpowers/routing.json
```

### No memories appear on session start

`memsearch` recall is opportunistic. If `memsearch` is not installed or returns no results, no memory context is injected.

### `/review-parallel` behaves differently than before

`/review-parallel` now performs real extension-managed fan-out/fan-in instead of returning prompt text telling the model to invoke parallel subagents itself. The command name and purpose are unchanged, but result aggregation is now deterministic.
