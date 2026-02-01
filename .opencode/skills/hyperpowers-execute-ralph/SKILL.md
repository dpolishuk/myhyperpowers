---
name: hyperpowers-execute-ralph
description: Execute entire bd epic autonomously without user interruption. Uses configurable model for continuous review (default opus). Researches unclear patterns via web search. Only stops on critical failures.
---

<skill_overview>
Execute complete epic without STOP checkpoints. After each task: dispatch autonomous-reviewer for validation. If issues found: fix autonomously (max 2 iterations). At end: comprehensive epic review. Only presents summary when all tasks complete or on critical failure.
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - Follow the execution loop strictly. Adapt to reviewer feedback autonomously. Epic requirements remain immutable. Tasks adapt to reality.
</rigidity_level>

<quick_reference>

| Phase | Action | Outcome |
|-------|--------|---------|
| **0. Load** | `bd show bd-1`, `bd dep tree bd-1` | Epic context loaded |
| **1. Execute** | TDD per task, test-runner verification | Task implemented |
| **2. Review** | Dispatch autonomous-reviewer | PASS or NEEDS_FIX |
| **3. Fix** | If NEEDS_FIX: fix, re-review (max 2x) | Issue resolved or flagged |
| **4. Loop** | Repeat 1-3 for all tasks | All tasks done |
| **5. Final** | Comprehensive epic review | APPROVED or GAPS_FOUND |
| **6. Complete** | Present summary | User sees results |

**Configuration:**
- `--reviewer-model=opus` (default) | `sonnet` | Model for autonomous-reviewer

</quick_reference>

<when_to_use>

**Use when:**
- Epic is well-defined with clear success criteria
- User trusts autonomous execution
- Tasks are straightforward implementation
- User wants hands-off execution

**Do NOT use when:**
- Epic has ambiguous requirements (use execute-plans instead)
- User wants checkpoint reviews
- High-risk changes needing human oversight
- Experimental/exploratory work

</when_to_use>

<the_process>

## Phase 0: Load Epic Context

```bash
bd list --type epic --status open  # Find epic
bd show bd-1                       # Load requirements
bd dep tree bd-1                   # Understand task structure
```

**Extract:**
- Requirements (IMMUTABLE)
- Success criteria (validation checklist)
- Anti-patterns (FORBIDDEN shortcuts)
- All tasks and dependencies

**Create TodoWrite for ALL tasks upfront:**
```
- bd-2: [title] (pending)
- bd-3: [title] (pending)
- bd-4: [title] (pending)
```

## Phase 1: Execute Task

For the next ready task:

```bash
bd ready                              # Find next ready task
bd update bd-N --status in_progress   # Claim it
bd show bd-N                          # Load details
```

**Execute using TDD:**
- Use `hyperpowers-test-driven-development` skill for implementation
- Use `test-runner` agent for verifications
- Complete ALL substeps before closing

```bash
bd close bd-N  # After implementation complete
```

→ Proceed to Phase 2

## Phase 2: Post-Task Review

Dispatch autonomous-reviewer with configured model:

```
Dispatch autonomous-reviewer:
"Task Review for bd-N

Epic: bd-1 - [epic title]
Task: bd-N - [task title]

Review this task implementation against epic requirements.
Use web search to research any unclear patterns or best practices.

Epic Success Criteria:
[list from epic]

Epic Anti-Patterns (FORBIDDEN):
[list from epic]

Return: PASS or NEEDS_FIX with specific issues and fix instructions."
```

### If VERDICT: PASS

Log review result, continue to next task (Phase 1).

### If VERDICT: NEEDS_FIX

→ Proceed to Phase 3

## Phase 3: Autonomous Fix (Max 2 Iterations)

**For each issue:**
1. Read the specific file:line reference
2. Apply the fix instruction exactly
3. Run tests via test-runner

**After fixes applied:**
- Re-dispatch autonomous-reviewer
- If PASS: continue to next task
- If still NEEDS_FIX and iteration < 2: repeat Phase 3
- If still NEEDS_FIX and iteration = 2: flag for user, continue

**Flagging format:**
```
FLAGGED FOR USER REVIEW:
- Task: bd-N
- Issue: [description]
- Attempted fixes: 2 iterations
- Current state: [description]
```

## Phase 4: Task Loop

Repeat Phases 1-3 until all tasks closed or critical blocker.

**Critical blocker criteria:**
- Cannot compile after 2 fix iterations
- Test suite completely broken
- Epic anti-pattern unavoidable

## Phase 5: Comprehensive Final Review

After all tasks complete:

```
Dispatch autonomous-reviewer:
"Epic Review for bd-1

This is the FINAL comprehensive review.

Epic: bd-1 - [title]
Completed Tasks: [list]

Verify ALL success criteria are met.
Verify NO anti-patterns were used.
Use web search to research any concerning patterns.

Return: APPROVED or GAPS_FOUND with remediation tasks."
```

### If VERDICT: APPROVED

→ Phase 6

### If VERDICT: GAPS_FOUND

Create remediation tasks, execute them, re-review (max 3 rounds).

## Phase 6: Completion

```bash
bd close bd-1
```

Present summary:

```markdown
## Epic bd-1 Complete - Autonomous Execution

### Configuration
- Reviewer model: [opus/sonnet]
- Total tasks: N

### Tasks Executed
- bd-2: [title] ✓
- bd-3: [title] ✓ (1 fix iteration)

### Review Summary
- Task reviews: X passed, Y needed fixes
- Final review: APPROVED

### Issues Fixed Autonomously
1. [description]

### Flagged for User Review
- [items or "None"]
```

</the_process>

<critical_rules>

1. **Epic requirements are IMMUTABLE**
2. **Max 2 fix iterations per task**
3. **Max 3 remediation rounds**
4. **Max 10 tasks per execution**
5. **Always use test-runner**
6. **Always dispatch reviewer**

</critical_rules>

<integration>

**This skill calls:**
- hyperpowers-test-driven-development
- test-runner agent
- autonomous-reviewer agent

**Comparison to execute-plans:**

| Aspect | execute-plans | execute-ralph |
|--------|---------------|---------------|
| Checkpoints | STOP after each task | No stops |
| User interaction | Required between tasks | Only on failure |
| Reviewer model | Same as execution | Configurable |

</integration>
