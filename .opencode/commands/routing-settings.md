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

### Step 1: Show current state as a table

Call `hyperpowers_agent_routing_config` with `action=get`. Render the result as a markdown table:

```
| Agent                      | Current Model               | Group        |
|----------------------------|-----------------------------|--------------|
| ralph                      | glm/glm-4.7                | orchestrator |
| test-runner                | glm/glm-4.5                | worker       |
| codebase-investigator      | glm/glm-4.5                | worker       |
| internet-researcher        | glm/glm-4.5                | worker       |
| autonomous-reviewer        | glm/glm-4.7                | reviewer     |
| code-reviewer              | glm/glm-4.7                | reviewer     |
| review-quality             | glm/glm-4.7                | reviewer     |
| ...                        | ...                         | ...          |
```

Also show:
- **Available models** from the `availableModels` field (models detected from user's config)
- **Supported groups** from `agentGroups` (orchestrator, workers, reviewers)
- **Available presets** from `presets` (cost-optimized, quality-first, balanced)

### Step 2: Present options

Ask the user what they want to do:

1. **Set a single agent** — pick agent + model, use `action=set`
2. **Set a group** — pick group (orchestrator/workers/reviewers/all) + model, use `action=set-group`
3. **Apply a preset** — pick preset (cost-optimized/quality-first), use `action=apply-preset`
4. **Set a workflow override** — pick workflow + agent + model, use `action=set` with workflow
5. **Done** — exit without changes

When suggesting models, show the `availableModels` list from the snapshot so the user can pick from models already configured in their setup.

### Step 3: Execute and summarize

After applying changes, call `action=get` again and re-render the table to show the updated state.

## Preset Descriptions

When presenting presets, explain them:

- **cost-optimized**: Workers (test-runner, investigators) use `small_model`, orchestrator and reviewers use `model`. Saves cost on high-volume agents.
- **quality-first**: All agents use `model`. Maximum quality everywhere.

Presets use the user's top-level `model` (strong) and `small_model` (fast) values. If `small_model` is not configured, all agents use `model`.

## Workflow Rules

- Always use `hyperpowers_agent_routing_config` for reads and writes.
- Never edit `opencode.json` directly from this command.
- Support global agent routing, group routing, presets, and workflow overrides.
- If the user decides not to change anything, report that no update was made.
- Reuse the backend tool's validation for unsupported agent/workflow/group/preset names.
- Keep the UX description plugin-owned and settings-like; do not describe it as a built-in preferences surface.

## Output Expectations

After a successful update, summarize:

- whether the change targeted a single agent, a group, a preset, or a workflow override
- the exact agents updated and their new model values
- re-render the routing table to confirm
