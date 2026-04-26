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

<when_to_use>
- When executing complex implementation tasks that require context isolation.
- When context drift or "agentic slop" is detected in the main session.
- When running autonomous loops (Ralph mode) where every step must be verifiable.
</when_to_use>

<quick_reference>

| Step | Action | Deliverable |
|------|--------|-------------|
| 1 | **Load Epic** | `tm show [epic-id]` (Immutable requirements) |
| 2 | **Load Task** | `tm show [task-id]` (Task design) |
| 3 | **Dispatch** | `invoke_agent` with Structured Prompt |
| 4 | **Verify** | SHA change (git) + Status check (tm) |
| 5 | **Review** | Single per-task review via `autonomous-reviewer` |

**Verification**: `tm show [task-id] --json` status == 'closed' + `git rev-parse HEAD` drift.  
**Review**: Run `mcp_agents_agent_autonomous_reviewer()` once per task after verification passes.
</quick_reference>

<the_process>
## 1. Requirement Loading
The orchestrator must first load the source of truth for the entire epic to ensure consistency across all tasks.
- Run `tm show [epic-id]` and capture the "DESIGN" section (Requirements).
- Run `tm show [task-id]` and capture the "DESIGN" section (Task Specification).
- Record the current git SHA: `PRE_SHA=$(git rev-parse HEAD)`.

## 2. Dispatch Construction
Construct a prompt that provides the subagent with everything it needs to work in isolation.

### Subagent Prompt Template (REQUIRED)
Role: Senior Implementation Engineer.
Context: You are working in a fresh, stateless environment. Your goal is to implement bd-[N] in the project root.
Project Root: [root path]

**Immutable Epic Requirements**:
<epic_contract>
[Insert requirements from tm show epic-id]
</epic_contract>

**Epic Summary (Current Progress)**:
<epic_summary>
[Insert summary of completed/remaining work]
</epic_summary>

**Task Specification (bd-[N])**:
<task_spec>
[Insert design from tm show task-id]
</task_spec>

**Mandatory Workflow (RED-GREEN-REFACTOR)**:
1. **RED**: Use `sre-task-refinement` on the task design BEFORE implementation. Write a failing test using the project's testing framework.
2. **GREEN**: Implement the minimal code required to pass the test. Use `test-runner` for all verifications.
3. **REFACTOR**: Improve code quality while ensuring tests remain green.
4. **Safety**: Adhere strictly to the project's anti-patterns and safety standards.

**Completion**:
1. Run all relevant tests via `test-runner` to verify the fix.
2. `git add [relevant files] && git commit -m 'Complete bd-[N]: [Task Title]'`
3. `tm close bd-[N]`
4. Provide a one-paragraph summary of your implementation and verification steps.

## 3. Execution
Run the subagent using the constructed prompt:
`invoke_agent(agent_name='generalist', prompt='[Constructed Prompt]')`

## 4. Verification
After the subagent returns, the orchestrator MUST perform independent verification:
1. **Status Check**: Run `tm show [task-id] --json`. If the status is not 'closed', the task was not completed. **FAILURE**.
2. **SHA Check**: Run `git rev-parse HEAD`. 
   - **For Implementation Tasks** (feature, bug, task, chore): If `POST_SHA == PRE_SHA`, the subagent failed to commit changes. **FAILURE**.
   - **For Analytical Tasks**: Accept success even if `POST_SHA == PRE_SHA` (no-op).
3. **Safety Gate**: If verification fails, the orchestrator MUST NOT move to the next task. It must report the failure details and stop.

## 5. Parallel Review Phase
Once the task is closed and verified, trigger independent review to ensure high standards:
- `mcp_agents_agent_autonomous_reviewer()`

If the review identifies critical issues or regressions, create a child remediation task under the epic:
`tm create "Remediation: [Review Findings]" --parent [epic-id]`
</the_process>

<examples>
<example>
<scenario>Successful implementation task execution</scenario>
<code>
Orchestrator: Record PRE_SHA=a1b2c3d
Orchestrator: Dispatch subagent to implement bd-2.
Subagent: [Red-Green-Refactor logic]
Subagent: Commit e5f6g7h "Complete bd-2"
Subagent: tm close bd-2
Orchestrator: Verify status=closed (PASS)
Orchestrator: Verify PRE_SHA != POST_SHA (PASS)
Orchestrator: Run autonomous-reviewer (PASS)
Next Task Ready.
</code>
</example>
</examples>

<critical_rules>
- ❌ NO implementing tasks in the main context.
- ❌ NO skipping SRE refinement inside the subagent.
- ❌ NO closing tasks without git commits (for implementation tasks).
- ❌ NO moving to the next task without verifying SHA drift and Status.
</critical_rules>

<verification_checklist>
- [ ] `tm show [task-id] --json` status is "closed".
- [ ] `git rev-parse HEAD` has changed (for implementation tasks).
- [ ] `mcp_agents_agent_autonomous_reviewer()` returned APPROVED.
</verification_checklist>

<integration>
This skill is used by `execute-ralph` and `executing-plans` to delegate work to subagents.
</integration>

<verification_logic>
```bash
# Before Dispatch
PRE_SHA=$(git rev-parse HEAD)

# After Dispatch
# 1. Status Check (Priority)
JSON_OUTPUT=$(tm show [task-id] --json)
STATUS=$(echo "$JSON_OUTPUT" | jq -r .status 2>/dev/null)
TASK_TYPE=$(echo "$JSON_OUTPUT" | jq -r .type 2>/dev/null)

if [ "$STATUS" != "closed" ]; then
  echo "FAILURE: Task status is '$STATUS', expected 'closed'."
  exit 1
fi

# 2. SHA Check (Enforce Drift for Implementation Tasks)
POST_SHA=$(git rev-parse HEAD)

if [ "$PRE_SHA" == "$POST_SHA" ]; then
  if [[ "$TASK_TYPE" =~ ^(feature|bug|task|chore)$ ]]; then
    echo "FAILURE: SHA drift not detected for implementation task type '$TASK_TYPE'."
    exit 1
  fi
  # Else: Accept success even if POST_SHA == PRE_SHA (Analytical Tasks)
fi
```
</verification_logic>
