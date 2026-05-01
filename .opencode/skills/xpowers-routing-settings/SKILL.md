---
name: xpowers-routing-settings
description: Interactive wizard to configure which AI model runs for each XPowers agent
---

# Routing Settings Wizard

This is the **primary settings-like UX** for XPowers routing on OpenCode.
It provides a **plugin-owned settings workflow** over the shared routing backend.

## Step 1: Show current state

Call `xpowers_agent_routing_config` with `action=get` NOW. Render the result as a markdown table:

```
| Agent                      | Current Model               | Group        |
|----------------------------|-----------------------------|--------------|
| ralph                      | (from snapshot)             | orchestrator |
| test-runner                | (from snapshot)             | workers      |
| codebase-investigator      | (from snapshot)             | workers      |
| internet-researcher        | (from snapshot)             | workers      |
| autonomous-reviewer        | (from snapshot)             | reviewers    |
| code-reviewer              | (from snapshot)             | reviewers    |
| review-quality             | (from snapshot)             | reviewers    |
| review-implementation      | (from snapshot)             | reviewers    |
| review-testing             | (from snapshot)             | reviewers    |
| review-simplification      | (from snapshot)             | reviewers    |
| review-documentation       | (from snapshot)             | reviewers    |
| test-effectiveness-analyst | (from snapshot)             | reviewers    |
```

Also show:
- **Available models** from the `availableModels` field
- **Available presets**: cost-optimized, quality-first

If the response includes a `warning`, show it explicitly.

If no routing config exists yet (`configMissing: true`), say this is a first-run and offer bootstrap.

After rendering, show workflow overrides from `routing.workflowOverrides` if any exist.

## Step 2: Ask what to change

Use AskUserQuestion (or the equivalent structured question tool) to ask one question at a time:

**First question — what action?**

Options:
1. **Set a single agent** — pick agent + model
2. **Set a group** — pick group (orchestrator/planners/workers/researchers/guards/reviewers/all) + model
3. **Apply a preset** — cost-optimized or quality-first
4. **Bootstrap recommended config** — full setup with strong/fast/top-review models
5. **Set a workflow override** — workflow + agent + model
6. **Done** — exit without changes

Then ask follow-up questions for the chosen action:

### Bootstrap flow
1. Ask: which strong model? (show `availableModels`)
2. Ask: which fast model? (optional, show `availableModels`)
3. Ask: which top-review model? (optional, show `availableModels`)
4. Call `action=bootstrap` with the chosen models

### Set single agent flow
1. Ask: which agent? (show the 16 agent names)
2. Ask: which model? (show `availableModels`)
3. Call `action=set` with agent + model

### Set group flow
1. Ask: which group? (orchestrator, planners, workers, researchers, guards, reviewers, all)
2. Ask: which model? (show `availableModels`)
3. Call `action=set-group` with group + model

### Apply preset flow
1. Ask: which preset? (cost-optimized = fast workers + strong others, quality-first = strong everywhere)
2. Call `action=apply-preset` with preset name

### Workflow override flow
1. Ask: which workflow? (show supported workflows from snapshot)
2. Ask: which agent? (show the 16 agent names)
3. Ask: which model? (show `availableModels`)
4. Call `action=set` with workflow + agent + model

## Step 3: Show result

After applying changes, call `action=get` again and re-render the table to confirm.

## Rules

- Always use `xpowers_agent_routing_config` for reads and writes
- Never edit `opencode.json` directly
- If user decides not to change anything, report no update made
- Show `availableModels` when asking for model selection
- Use structured questions, not freeform chat
