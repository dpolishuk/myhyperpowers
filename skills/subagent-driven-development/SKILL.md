---
name: subagent-driven-development
description: Use to define the canonical 'Dispatch Protocol' for stateless orchestration via fresh subagents.
---

<skill_overview>
Stateless dispatch prevents context drift and hallucination by isolating each task execution in a fresh subagent with zero history. This ensures that every task is implemented against the immutable requirements of the epic and the specific design of the task, rather than being influenced by the accumulation of previous turns or unrelated context. This protocol is the standard for autonomous execution in Hyperpowers.
</skill_overview>

<rigidity_level>
STRICT - Follow the 5-step verification process exactly. Never skip SHA drift checks for implementation tasks.
</rigidity_level>

<quick_reference>

| Step | Action | Deliverable |
|------|--------|-------------|
| 1 | **Load Context** | `tm show [epic-id]` + `tm show [task-id]` |
| 2 | **Record State** | `PRE_SHA=$(git rev-parse HEAD)` |
| 3 | **Dispatch** | `invoke_agent` with Stateless Handoff |
| 4 | **Verify** | SHA change (git) + Status check (tm) |
| 5 | **Soft Gate** | Remediation prompt if no-drift on feature task |

**Verification**: `tm show [task-id] --json` status == 'closed' + `git rev-parse HEAD` drift.
</quick_reference>

<when_to_use>
- Implementing complex features or bug fixes.
- Running multi-task epics autonomously (Ralph mode).
- Executing tasks that involve 3+ file changes.
- When context drift or token exhaustion is detected in the main session.
</when_to_use>

<the_process>
## 1. Requirement Loading
The orchestrator must first load the source of truth for the entire epic and the specific task.
- Run `tm show [epic-id]` and capture the "DESIGN" section (Requirements).
- Run `tm show [task-id]` and capture the "DESIGN" section (Task Specification).
- Record the current git SHA: `PRE_SHA=$(git rev-parse HEAD)`.

## 2. Dispatch Construction
Construct a prompt that provides the subagent with everything it needs to work in isolation.

### Stateless Handoff Template (REQUIRED)
Role: Senior Implementation Engineer.
Context: You are working in a fresh, stateless environment. Your goal is to implement bd-[N] in the project root.
Project Root: [root path]

**Immutable Epic Requirements**:
<epic_contract>
[Insert requirements from tm show epic-id]
</epic_contract>

**Epic Summary (Current Progress)**:
<epic_summary>
[Insert summary of completed/remaining tasks]
</epic_summary>

**Task Specification (bd-[N])**:
<task_spec>
[Insert design from tm show task-id]
</task_spec>

**Mandatory Workflow (RED-GREEN-REFACTOR)**:
1. **RED**: Use `sre-task-refinement` on the task design BEFORE implementation. Write a failing test.
2. **GREEN**: Implement the minimal code required to pass the test. Use `test-runner` for all verifications.
3. **REFACTOR**: Improve code quality while ensuring tests remain green.

**Completion**:
1. Run all relevant tests via `test-runner`.
2. `git add [relevant files] && git commit -m 'Complete bd-[N]: [Task Title]'`
3. `tm close bd-[N]`
4. Provide a one-paragraph summary of implementation and verification steps.

## 3. Execution
Run the subagent using the constructed prompt:
`invoke_agent(agent_name='generalist', prompt='[Constructed Prompt]')`

## 4. Verification & Soft Gate
After the subagent returns, the orchestrator MUST perform independent verification:

```bash
POST_SHA=$(git rev-parse HEAD)
JSON_OUTPUT=$(tm show [task-id] --json)
STATUS=$(echo "$JSON_OUTPUT" | jq -r .status 2>/dev/null)
TASK_TYPE=$(echo "$JSON_OUTPUT" | jq -r .type 2>/dev/null)

if [ "$STATUS" != "closed" ]; then
  if [ "$POST_SHA" != "$PRE_SHA" ]; then
    echo "TURN LIMIT HIT: Subagent made commits but didn't close task. Resume."
  else
    echo "FAILURE: Task not closed and no changes detected."
  fi
  exit 1
fi

if [ "$PRE_SHA" == "$POST_SHA" ] && [[ "$TASK_TYPE" =~ ^(feature|bug|task|chore)$ ]]; then
  echo "SOFT GATE TRIGGERED: Hallucinated completion detected."
  # Trigger Soft Gate Remediation Prompt:
  # "Warning: Task marked 'closed' but no Git SHA drift detected. Did you forget to commit? If this was a no-op, please confirm. Otherwise, re-verify and commit."
fi
```

## 5. Parallel Review Phase
Once verified, trigger review:
- `mcp_agents_agent_autonomous_reviewer()`
</the_process>

<examples>
<example>
<scenario>Successful implementation with SHA drift</scenario>
<code>
Orchestrator: Record PRE_SHA=a1b2c3d
Orchestrator: Dispatch subagent for feature bd-2.
Subagent: [TDD logic + Commit + Close]
Orchestrator: POST_SHA=e5f6g7h (DRIFT DETECTED)
Orchestrator: STATUS=closed (SUCCESS)
</code>
</example>
</examples>

<critical_rules>
- ❌ NO implementing tasks in the main context.
- ❌ NO skipping status/SHA verification.
- ❌ NO auto-closing tasks if subagent fails (FAIL-CLOSED).
- ❌ NO relying on subagent summaries for proof.
</critical_rules>

<verification_checklist>
- [ ] \`SKILL.md\` includes \`<epic_contract>\`, \`<epic_summary>\`, and \`<task_spec>\` tags.
- [ ] Verification logic explicitly checks for SHA drift using \`git rev-parse HEAD\`.
- [ ] Remediation prompt is defined for no-drift implementation tasks.
</verification_checklist>

<integration>
This skill is used by \`execute-ralph\` and \`executing-plans\` to delegate work to subagents.
</integration>
