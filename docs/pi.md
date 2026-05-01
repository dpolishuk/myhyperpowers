# Pi Support

XPowers includes first-class support for the Pi coding agent through the extension in:

- `.pi/extensions/xpowers/`

## What Pi support includes

- Slash commands for XPowers workflows
- `xpowers_subagent` for isolated Pi subprocess delegation
- A shared internal Pi task runner used by XPowers orchestration
- Model routing by subagent type and concrete agent
- Routed effort mapped to Pi thinking controls when configured
- True extension-side `/review-parallel` fan-out/fan-in
- Interactive Brainstorming TUI dashboard for `/brainstorm`
- Live Execution TUI dashboard for tracking `/review-parallel`
- Native Hooks pipeline mapping to repository `hooks.json`
- Native `tm` tools mapping to `tm` commands (`tm_ready`, `tm_create`, etc.)
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
- `/tm`

Compatibility alias:

- `/configure-routing` → alias for `/routing-settings`

## Internal orchestration core

XPowers now uses a shared internal task runner for Pi subprocess orchestration.

Current wave-1 execution modes supported by the runner are:
- `single` — used by `xpowers_subagent`
- `parallel` — used by `/review-parallel`
- `chain` — available in the shared runner for future workflows

The runner preserves the existing XPowers Pi contracts while centralizing:
- subprocess launch semantics
- fresh vs fork context handling
- cancellation propagation
- output limits
- structured/text result normalization

## Subagent tool

Use `xpowers_subagent` to delegate work to an isolated Pi subprocess.

By default, subagent execution is ephemeral (`pi --print --no-session`) so child runs do not persist their own Pi session history.

Examples:

```text
xpowers_subagent(task: "Review src/auth.ts for race conditions", type: "review")
xpowers_subagent(task: "Verify recent implementation matches requirements", agent: "review-implementation")
xpowers_subagent(task: "Run tests and summarize failures", agent: "test-runner")
xpowers_subagent(task: "Review this once with a stronger model", model: "anthropic/claude-opus-4-5", type: "validation")
xpowers_subagent(task: "Return machine-readable findings", type: "review", format: "structured")
```

Structured mode asks the subagent to return JSON only and parses that JSON before returning it to the caller. This improves machine readability, but it does not guarantee that the model's findings are semantically correct.

Top-level structured fields remain:
- `status`
- `summary`
- `findings`
- `nextAction`

Failure-path findings may also include additive metadata such as `type` and `source` when the helper knows more about the failure.

## Skill metadata

XPowers also parses optional advisory Pi skill frontmatter under `metadata.pi`.

Supported fields currently include:
- `subProcess`
- `subProcessContext`
- `model`
- `thinkingLevel`

Important: this metadata is currently **advisory**, not authoritative.
It is parsed and normalized for XPowers-native Pi behavior, but it does **not** override the routing decisions made through `/routing-settings`.

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
~/.pi/agent/extensions/xpowers/routing.json
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
~/.pi/agent/extensions/xpowers/routing.json
```

### No memories appear on session start

`memsearch` recall is opportunistic. If `memsearch` is not installed or returns no results, no memory context is injected.

### `/review-parallel` behaves differently than before

`/review-parallel` now performs real extension-managed fan-out/fan-in instead of returning prompt text telling the model to invoke parallel subagents itself. The command name and purpose are unchanged, but result aggregation is now deterministic.

## Ideas for Improvement

Here are several high-impact ideas to improve and expand the Pi integration:

### 1. Leverage "Chain" Execution Mode
The `task-runner.ts` mentions `chain` execution is "available in the shared runner for future workflows". 
- **Action**: Implement `/tdd` (Red-Green-Refactor) or `/execute-plan` as a fully headless chain sequence where each subagent passes its structured output state to the next without polluting the main session context, stopping only when human intervention is required.

### 2. Move `metadata.pi` from Advisory to Authoritative
Currently, the `metadata.pi` frontmatter in `SKILL.md` is parsed but remains advisory (routing config takes precedence).
- **Action**: Allow skills to define "strict" requirements (e.g., `requires: opus` or `minimumThinking: high`) that temporarily override local `/routing-settings` when a specific hyperpower mathematically requires a stronger model to succeed (like `sre-task-refinement`).

### 3. Advanced Context & Memory Management
- **Fork Session Pruning**: The task runner supports `fork` context mode. We could implement a feature that prunes or summarizes the fork's `.jsonl` seed before passing it to a subagent to save tokens and prevent context bloat.
- **TUI Memory Manager**: A slash command like `/memory` to view what `memsearch` has recalled, and manually pin/unpin memories for the current Pi session.

### 4. Skill Browser TUI
- **Action**: A TUI component to browse, search, and activate available XPowers skills interactively via `/skills`.
