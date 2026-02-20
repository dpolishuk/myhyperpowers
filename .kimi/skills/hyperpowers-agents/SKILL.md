---
name: hyperpowers-agents
description: Use when you want to spawn a specialized subagent using the standard Hyperpowers agent prompts (test-runner, code-reviewer, codebase-investigator, internet-researcher, test-effectiveness-analyst).
---

<skill_overview>
Provides a catalog of Hyperpowers agent prompts and a consistent way to launch them via Codex subagents.
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - Follow the selection and launch steps, but adapt prompts to the task.
</rigidity_level>

<when_to_use>
Use when:
- You want a dedicated subagent to run tests or commits without cluttering the main context
- You need a focused code review or test effectiveness analysis
- You need a short, bounded investigation of the codebase
- You want to offload a self-contained task and keep the main thread clean
</when_to_use>

<the_process>
## 1. Pick the right agent

Use this mapping:
- `test-runner` → `references/test-runner.md` → agent_type `worker`
- `code-reviewer` → `references/code-reviewer.md` → agent_type `worker`
- `codebase-investigator` → `references/codebase-investigator.md` → agent_type `explorer`
- `internet-researcher` → `references/internet-researcher.md` → agent_type `worker`
- `test-effectiveness-analyst` → `references/test-effectiveness-analyst.md` → agent_type `worker`

## 2. Read the prompt file

Open the relevant reference file and reuse the exact prompt text.

## 3. Spawn the agent

Use `spawn_agent` and pass the full prompt plus the specific task.

Example:
```json
{
  "tool": "functions.spawn_agent",
  "parameters": {
    "agent_type": "worker",
    "message": "[PASTE prompt from references/test-runner.md]\n\nTask: Run `pytest tests/` and return summary + failures only."
  }
}
```

## 4. Parallel dispatch (if needed)

If you need multiple agents at once, dispatch them in a single `multi_tool_use.parallel` call so they run concurrently.

## 5. Integrate results

Wait for all agents to complete, then integrate their summaries into the main work. Resolve conflicts manually before making final changes.
</the_process>
