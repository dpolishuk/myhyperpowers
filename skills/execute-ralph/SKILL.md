---
name: execute-ralph
description: Execute entire bd epic autonomously without user interruption. Uses configurable model for continuous review (default opus). Researches unclear patterns via Perplexity/web search. Only stops on critical failures.
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

## Phase 0: Smart Triage & Health Check

### Step 0a: Get Smart Triage

```bash
bv -robot-triage 2>/dev/null
```

Parse JSON to understand:
- `triage.quick_ref.actionable_count` - How many items ready
- `triage.quick_ref.top_picks` - Best items by score
- `triage.blockers_to_clear` - High-impact blockers
- `triage.project_health.graph.has_cycles` - Dependency health

### Step 0b: Health Gate

**STOP if any:**
- `has_cycles: true` → Alert user about dependency cycles
- `actionable_count: 0` → Nothing to work on

### Step 0c: Load Top Pick Context

```bash
bv -robot-next 2>/dev/null  # Get optimal next task
```

Returns:
```json
{
  "id": "bd-xxx",
  "claim_command": "bd update bd-xxx --status=in_progress",
  "show_command": "bd show bd-xxx"
}
```

Run `show_command` to load full details. If type is "epic":
```bash
bd dep tree bd-xxx  # Understand task structure
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

For the next ready task, use smart triage:

```bash
bv -robot-next 2>/dev/null  # Get optimal next task with claim_command
```

Then claim and load:
```bash
bd update bd-N --status in_progress   # Use claim_command from robot-next
bd show bd-N                          # Load details
```

**Execute using TDD:**
- Use `test-driven-development` skill for implementation
- Use `test-runner` agent for verifications
- Complete ALL substeps before closing

```bash
bd close bd-N  # After implementation complete
```

**Update TodoWrite:**
```
- bd-2: [title] ✓
- bd-3: [title] (in progress)
- bd-4: [title] (pending)
```

→ Proceed to Phase 2

## Phase 2: Post-Task Review

Dispatch autonomous-reviewer with configured model:

```
Dispatch hyperpowers:autonomous-reviewer:
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

**Iteration tracking:**
```
- bd-N fix iteration: 1/2
```

**For each issue:**
1. Read the specific file:line reference
2. Apply the fix instruction exactly
3. Run tests via test-runner

**After fixes applied:**
- Re-dispatch autonomous-reviewer
- If PASS: continue to next task
- If still NEEDS_FIX and iteration < 2: repeat Phase 3
- If still NEEDS_FIX and iteration = 2: flag for user, continue to next task

**Flagging format:**
```
FLAGGED FOR USER REVIEW:
- Task: bd-N
- Issue: [description]
- Attempted fixes: 2 iterations
- Current state: [description]
- Recommendation: [what user should check]
```

## Phase 4: Task Loop

Repeat Phases 1-3 until:
- All tasks closed, OR
- Critical blocker encountered

**Critical blocker criteria:**
- Cannot compile after 2 fix iterations
- Test suite completely broken
- Epic anti-pattern unavoidable

If critical blocker: stop loop, proceed to summary with blocker documented.

## Phase 5: Comprehensive Final Review

After all tasks complete (or max tasks reached):

```
Dispatch hyperpowers:autonomous-reviewer:
"Epic Review for bd-1

This is the FINAL comprehensive review before closing the epic.

Epic: bd-1 - [title]
Completed Tasks: [list]

Verify ALL success criteria are met.
Verify NO anti-patterns were used.
Use web search to research any concerning patterns.

Success Criteria:
[list from epic]

Anti-Patterns (must not be present):
[list from epic]

Return: APPROVED or GAPS_FOUND with remediation tasks."
```

### If VERDICT: APPROVED

→ Proceed to Phase 6

### If VERDICT: GAPS_FOUND

Create remediation tasks:
```bash
bd create "Remediation: [gap description]" \
  --type task \
  --design "[from reviewer's remediation task description]"
bd dep add bd-NEW bd-1 --type parent-child
```

Execute remediation tasks (return to Phase 1).

**Safety limit:** Max 3 remediation rounds. If still gaps after 3 rounds, flag for user and complete.

## Phase 6: Completion

Close epic:
```bash
bd close bd-1
```

Present comprehensive summary:

```markdown
## Epic bd-1 Complete - Autonomous Execution

### Configuration
- Reviewer model: [opus/sonnet]
- Total tasks: N
- Fix iterations: M

### Tasks Executed
- bd-2: [title] ✓
- bd-3: [title] ✓ (1 fix iteration)
- bd-4: [title] ✓

### Review Summary
- Task reviews: X passed, Y needed fixes
- Final review: APPROVED
- Research queries: Z

### Issues Fixed Autonomously
1. [Issue in bd-3: description, fix applied]
2. [Issue in bd-5: description, fix applied]

### Flagged for User Review
- [Any items that couldn't be resolved]
- [Or "None - all issues resolved autonomously"]

### Next Steps
- [Any follow-up recommendations from final review]
- [Or "Epic complete, no further action needed"]
```

</the_process>

<critical_rules>

## Rules That Have No Exceptions

1. **Epic requirements are IMMUTABLE** - Never water down to make execution easier
2. **Max 2 fix iterations per task** - After 2, flag and continue
3. **Max 3 remediation rounds** - After 3, complete with flags
4. **Max 10 tasks per execution** - Safety limit to prevent runaway
5. **Always use test-runner** - Keep verbose output out of context
6. **Always dispatch reviewer** - Every task gets reviewed, no skipping

## What Triggers User Notification

Only these situations stop autonomous execution:
- Critical blocker (can't compile, tests completely broken)
- 10 task limit reached
- 3 remediation rounds exhausted

Everything else: fix autonomously and continue.

## Anti-Patterns for This Skill

- Skipping review "because task was simple"
- Skipping TDD "to save time"
- Ignoring reviewer feedback
- Continuing past critical blockers
- Not using web search when uncertain

</critical_rules>

<integration>

**This skill calls:**
- test-driven-development (for implementing each task)
- test-runner (for running tests without output pollution)
- autonomous-reviewer (for post-task and final reviews)

**This skill is called by:**
- User via `/hyperpowers:execute-ralph [--reviewer-model=opus|sonnet]`
- After writing-plans creates well-defined epic

**Comparison to execute-plans:**

| Aspect | execute-plans | execute-ralph |
|--------|---------------|---------------|
| Checkpoints | STOP after each task | No stops |
| User interaction | Required between tasks | Only on failure |
| Review timing | Final only | After each task + final |
| Reviewer model | Same as execution | Configurable (default opus) |
| Research | None | Perplexity/web during review |
| Best for | Uncertain requirements | Well-defined epics |

</integration>

<resources>

**bd command reference:**
- See [bd commands](../common-patterns/bd-commands.md)

**When stuck:**
- 2 fix iterations failed → Flag and continue, let user review later
- Critical blocker → Stop, document clearly, present summary
- Reviewer keeps finding issues → Check if epic requirements are realistic

</resources>
