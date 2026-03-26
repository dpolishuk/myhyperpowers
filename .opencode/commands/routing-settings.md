---
description: Manage Hyperpowers OpenCode routing through a plugin-owned settings workflow
---

# Usage

```
/routing-settings
```

## What This Does

This command is the **primary settings-like UX** for Hyperpowers routing on OpenCode.
It provides a **plugin-owned settings workflow** over the shared routing backend.

## Workflow

### Interaction mode

Drive this command as a **question-panel wizard** using the same structured AskUserQuestion / QuestionTool-style interaction surface that OpenCode guided flows already use.

- Do **not** rely on freeform chat replies for the main decision flow when the question-panel surface is available.
- Ask one structured question at a time.
- Prefer concise multiple-choice options for action selection, group selection, workflow selection, and model selection.
- If the runtime does **not** expose the question-panel / QuestionTool surface, say so explicitly and stop instead of pretending a panel wizard is active.

### Step 1: Show current state as a table

Call `hyperpowers_agent_routing_config` with `action=get`. Render the result as a markdown table:

```
| Agent                      | Current Model               | Group        |
|----------------------------|-----------------------------|--------------|
| ralph                      | glm/glm-4.7                | orchestrator |
| test-runner                | glm/glm-4.5                | workers      |
| codebase-investigator      | glm/glm-4.5                | workers      |
| internet-researcher        | glm/glm-4.5                | workers      |
| autonomous-reviewer        | glm/glm-4.7                | reviewers    |
| code-reviewer              | glm/glm-4.7                | reviewers    |
| review-quality             | glm/glm-4.7                | reviewers    |
| ...                        | ...                         | ...          |
```

Also show:
- **Available models** from the `availableModels` field (live models discovered from `opencode models`, plus any already present in config)
- **Supported groups** from `agentGroups` (orchestrator, workers, reviewers)
- **Available presets** from `presets` (cost-optimized, quality-first)

After the main global-agent table, render a second section for current **workflow overrides** from `routing.workflowOverrides` so users can verify workflow-specific routing in the same settings flow.

If the backend response includes a `warning` about malformed `.opencode/hyperpowers-routing.json`, show that warning explicitly before presenting edit options.

If no routing config exists yet (`configMissing: true`), explicitly say this is a first-run/bootstrap flow and offer to create a recommended full multi-agent setup.

After showing the initial state, immediately open the first question-panel step asking what the user wants to change.

### Step 2: Present options

Ask the user through a question-panel step what they want to do:

1. **Set a single agent** — pick agent + model, use `action=set`
2. **Set a group** — pick group (orchestrator/workers/reviewers/all) + model, use `action=set-group`
3. **Apply a preset** — pick preset (cost-optimized/quality-first), use `action=apply-preset`
4. **Bootstrap recommended config** — pick strong model, optional fast model, and optional top-review model from `availableModels`, then use `action=bootstrap`
5. **Set a workflow override** — pick workflow + agent + model, use `action=set` with workflow
6. **Done** — exit without changes

When suggesting models, show the `availableModels` list from the snapshot so the user can pick from live-discovered models already available in their setup.

For the first end-to-end happy path, support at least:
- **Bootstrap recommended config** through question-panel steps
- or **Set a single agent** through question-panel steps

Every step in those flows should remain structured: action choice → target choice → model choice → confirmation.

For full action coverage, drive every supported action through question-panel driven steps:

- **Bootstrap recommended config** — question-panel driven sequence: scope → target → model/preset/workflow → confirmation
  - ask for bootstrap as the action choice
  - ask for strong model
  - ask for optional fast model
  - ask for optional top-review model
  - ask for final confirmation before `action=bootstrap`

- **Set a single agent** — question-panel driven single-agent edit sequence: scope → target → model/preset/workflow → confirmation
  - ask for the concrete agent
  - ask for the target model
  - ask for confirmation before `action=set`

- **Set a group** — question-panel driven group edit sequence: scope → target → model/preset/workflow → confirmation
  - ask for the group (`all`, `orchestrator`, `workers`, `reviewers`)
  - ask for the target model
  - ask for confirmation before `action=set-group`

- **Apply a preset** — question-panel driven preset application sequence: scope → target → model/preset/workflow → confirmation
  - ask for the preset name (`cost-optimized` or `quality-first`)
  - explain the preset effect
  - ask for confirmation before `action=apply-preset`

- **Set a workflow override** — question-panel driven workflow override edit sequence: scope → target → model/preset/workflow → confirmation
  - ask for the workflow name
  - ask for the concrete agent within that workflow
  - ask for the target model
  - ask for confirmation before workflow `action=set`

If any action path cannot yet be driven through the question-panel mechanism in the current runtime, say so explicitly instead of implying complete support.

### Step 3: Execute and summarize

After applying changes, call `action=get` again and re-render the table to show the updated state.

For the bootstrap path, summarize that the command wrote the canonical split-file routing contract:
- global agent mappings in `opencode.json`
- workflow overrides in `.opencode/hyperpowers-routing.json`

## Preset Descriptions

When presenting presets, explain them:

- **cost-optimized**: Workers (test-runner, investigators) use `small_model`, orchestrator and reviewers use `model`. Saves cost on high-volume agents.
- **quality-first**: All agents use `model`. Maximum quality everywhere.

Presets use the user's top-level `model` (strong) and `small_model` (fast) values. If `small_model` is not configured, all agents use `model`.

## Workflow Rules

- Always use `hyperpowers_agent_routing_config` for reads and writes.
- Never edit `opencode.json` directly from this command.
- Support global agent routing, group routing, presets, bootstrap, and workflow overrides.
- If the user decides not to change anything, report that no update was made.
- Reuse the backend tool's validation for unsupported agent/workflow/group/preset/model names.
- Keep the UX description plugin-owned and settings-like; do not describe it as a built-in preferences surface.

## Output Expectations

After a successful update, summarize:

- whether the change targeted a bootstrap, a single agent, a group, a preset, or a workflow override
- the exact agents updated and their new model values
- re-render the routing table to confirm
