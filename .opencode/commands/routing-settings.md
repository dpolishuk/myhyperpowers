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

1. Inspect current routing state with `hyperpowers_agent_routing_config` using `action=get`
2. Ask whether the user wants to edit:
   - a global `agent.<agent>.model` mapping, or
   - a `workflowOverrides.<workflow>.<agent>.model` mapping
3. Confirm the concrete agent, optional workflow, and target model
4. Persist the change with `hyperpowers_agent_routing_config` using `action=set`
5. Summarize the exact updated path and value

## Workflow Rules

- Always use `hyperpowers_agent_routing_config` for reads and writes.
- Never edit `opencode.json` directly from this command.
- Support both global agent routing and workflow override routing.
- If the user decides not to change anything, report that no update was made.
- Reuse the backend tool's validation for unsupported agent/workflow names.
- Keep the UX description plugin-owned and settings-like; do not describe it as a built-in preferences surface.

## Output Expectations

After a successful update, summarize:

- whether the change targeted `agent.<agent>.model` or `workflowOverrides.<workflow>.<agent>.model`
- the exact concrete agent edited
- the new model value written through the shared routing backend
