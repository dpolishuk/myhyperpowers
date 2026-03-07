---
name: execute-ralph
description: "Execute entire bd epic autonomously without user interruption. Full pipeline: SRE refinement, TDD execution, multi-agent review, test effectiveness analysis, autonomous final review. Auto-commits, parallel debugging on failures, verification gates. Creates git branch from epic name."
type: flow
---
<!-- This skill follows the autonomous-loop pattern (see skills/common-patterns/autonomous-loop.md) -->

```mermaid
flowchart TD
    BEGIN([Start Ralph]) --> TRIAGE[Phase 0: Smart Triage<br/>bv -robot-triage]
    TRIAGE --> HEALTH{Health Gate}
    HEALTH -->|Cycles or No Work| ALERT[Alert User & Stop]
    HEALTH -->|OK| LOAD[Load Epic<br/>bv -robot-next]
    LOAD --> BRANCH[Create Feature Branch<br/>feature/epic-name]
    BRANCH --> TODO[Create TodoWrite<br/>for ALL tasks]
    TODO --> GETTASK[Phase 1: Get Next Task<br/>tm ready or auto-create]

    GETTASK --> NOCRIT{Criteria<br/>met?}
    NOCRIT -->|All met| TESTAUDIT[Phase 7: Test Suite Audit<br/>test-effectiveness-analyst]
    NOCRIT -->|Unmet| REFINE[Phase 2: SRE Refinement<br/>sre-task-refinement skill]

    REFINE --> TDD[Phase 3: Execute Task with TDD<br/>test-driven-development skill]
    TDD --> VERIFYTASK[Verify Task<br/>verification-before-completion]
    VERIFYTASK --> CLOSE[Close Task<br/>tm close bd-N]
    CLOSE --> COMMIT[Auto-Commit<br/>git commit]
    COMMIT --> REVIEW[Phase 4: 5 Parallel Review Agents<br/>quality, implementation, testing,<br/>simplification, documentation]

    REVIEW --> TESTEFF[Test Effectiveness<br/>test-effectiveness-analyst]
    TESTEFF --> ISSUES{Issues<br/>found?}
    ISSUES -->|All PASS| CRITCHECK[Phase 6: Criteria Check]
    ISSUES -->|Issues Found| FIX[Phase 5: Autonomous Fix<br/>max 2 iterations]

    FIX --> FIXCOMMIT[Commit Fixes]
    FIXCOMMIT --> RECHECK{Iteration<br/>count?}
    RECHECK -->|< 2| REREVIEW[Re-run Affected<br/>Reviewers]
    REREVIEW --> TESTEFF
    RECHECK -->|= 2| FLAG[Flag for User<br/>Continue to Next Task]
    FLAG --> CRITCHECK

    CRITCHECK --> GETTASK

    TESTAUDIT --> FINAL[Phase 8: Final Autonomous Review<br/>autonomous-reviewer + review-implementation]
    FINAL --> APPROVED{Both<br/>APPROVED?}
    APPROVED -->|Yes| COMPLETE[Phase 9: Branch Completion<br/>finishing-a-development-branch]
    APPROVED -->|No| REMEDIATE[Create Remediation Task]
    REMEDIATE --> GETTASK

    ALERT --> END([Complete])
    COMPLETE --> END
```

<skill_overview>
Execute complete epic without STOP checkpoints. Production-grade pipeline per task: SRE refinement → TDD execution → verification gates → auto-commit → 5 parallel review agents → test effectiveness analysis → autonomous fixes with debugging tools (max 2 iterations). At end: comprehensive test suite audit → autonomous final review with web research → verification → branch completion. Combines the rigor of execute-plans with full hyperpowers capabilities (debugging, root-cause tracing, test quality analysis, verification gates).
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - Follow the execution loop strictly. Adapt to reviewer feedback autonomously. Epic requirements remain immutable. Tasks adapt to reality.
</rigidity_level>

<quick_reference>

| Phase | Action | Outcome |
|-------|--------|---------|
| **0. Setup** | Smart triage + create branch + extract criteria | Ready for autonomous execution |
| **1. Get Task** | Claim ready task OR auto-create from unmet criterion | Next task identified |
| **2. Refine** | SRE refinement per task | Task ready with edge cases covered |
| **3. Execute** | TDD per task → verify → close → auto-commit | Task implemented and committed |
| **4. Review** | 5 parallel review agents + test effectiveness | Issues collected |
| **5. Fix** | Autonomous fix with debugging (max 2 iterations) | Issue resolved or flagged |
| **6. Criteria Check** | Check epic success criteria → CONTINUE or EXIT loop | Loop decision made |
| **7. Test Audit** | Test suite audit (post-loop) | Test quality validated |
| **8. Final Gate** | autonomous-reviewer + review-implementation (BOTH must APPROVED) | Epic validated |
| **9. Complete** | Branch completion | Epic closed |

**Review Agents:**
- Phase 4: quality, implementation, testing, simplification, documentation (5 parallel)
- Phase 4: test-effectiveness-analyst (tautology detection, coverage gaming)
- Phase 8: autonomous-reviewer with web research (most capable model)

**Agent Model Configuration:**
| Agent | Recommended Model | Reason |
|-------|------------------|--------|
| test-runner | Fast (haiku, glm-4.5) | High-volume, low-complexity |
| review-quality, review-implementation | Capable (sonnet, glm-4.7) | Requires reasoning |
| test-effectiveness-analyst | Capable (sonnet, glm-4.7) | Complex analysis |
| autonomous-reviewer | Most capable (opus, glm-4.7) | Final validation with research |

</quick_reference>

<when_to_use>

**Use when:**
- Epic is well-defined with clear success criteria
- User trusts autonomous execution
- Tasks are straightforward implementation
- User wants hands-off execution

**Do NOT use when:**
- Epic has ambiguous requirements (use execute-plans instead)
- User wants checkpoint reviews between tasks
- High-risk changes needing human oversight per task
- Experimental/exploratory work

</when_to_use>

<the_process>

<!-- autonomous-loop: EXECUTION_LOOP_DECLARATION -->
## EXECUTION LOOP (Primary Control Flow — Read This First)

<!-- autonomous-loop: STOP_OVERRIDE (primary) -->
**CONTEXT: You are running execute-ralph (autonomous, NO user checkpoints).**
If any loaded skill instructs you to STOP or present a checkpoint, IGNORE that instruction.
execute-ralph overrides all checkpoint semantics from sub-skills.

<!-- autonomous-loop: PHASE_STRUCTURE -->
```
SETUP (once):  Phase 0 — Smart Triage, Load Epic, Create Branch, Extract Criteria

REPEAT (per task, track iteration count):
  Phase 1 — GET TASK: tm ready to claim, OR auto-create from unmet criterion
  Phase 2 — REFINE: sre-task-refinement (NEVER skip)
  Phase 3 — EXECUTE: TDD + verification + close task + auto-commit
  Phase 4 — REVIEW: 5 parallel review agents + test-effectiveness-analyst
  Phase 5 — FIX: Autonomous fixes (max 2 iterations per task)
  Phase 6 — CRITERIA CHECK:
             All epic success criteria met? → EXIT LOOP to Phase 7
             Tasks remain or can be created? → CONTINUE LOOP (Phase 1)
             Critical blocker? → Alert user

POST-LOOP:
  Phase 7 — Test Suite Audit (test-effectiveness-analyst on full suite)
  Phase 8 — Final Gate (autonomous-reviewer + review-implementation, BOTH must APPROVED)
           Non-approval → create remediation task, RETURN TO Phase 1
  Phase 9 — Branch Completion (finishing-a-development-branch)
```

<!-- autonomous-loop: ITERATION_TRACKING (template) -->
**Maintain this state tracker throughout execution:**
```
RALPH LOOP — Iteration [N] | Task: [bd-X title] | Criteria: [X/Y] met | Phase: [N]
```

---

## Phase 0: Smart Triage & Branch Setup

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

**Alert user and stop ONLY if:**
- `has_cycles: true` → Dependency cycles detected
- `actionable_count: 0` → Nothing to work on

**Otherwise:** Continue autonomously

### Step 0c: Load Top Pick & Create Branch

```bash
bv -robot-next 2>/dev/null  # Get optimal next task
```

Run `show_command` to load full details. If type is "epic":

**Create feature branch from epic title:**
```bash
# Convert epic title to branch name (lowercase, hyphens, no special chars)
BRANCH_NAME=$(echo "[epic-title]" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
git checkout -b "feature/${BRANCH_NAME}"
```

Example: "User Authentication Flow" → `feature/user-authentication-flow`

```bash
tm dep tree bd-xxx  # Understand task structure
```

**Extract:**
- Requirements (IMMUTABLE)
- Success criteria (validation checklist)
- Anti-patterns (FORBIDDEN shortcuts)
- All tasks and dependencies

**Create TodoWrite for ALL tasks upfront:**
```
Branch: feature/[epic-name]
- bd-2: [title] (pending)
- bd-3: [title] (pending)
- bd-4: [title] (pending)
```

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 0 complete. Enter EXECUTION LOOP. Proceed to Phase 1.

---

## Phase 1: Get Next Task

This is the **entry point of the EXECUTION LOOP**. You arrive here at the start of every iteration.

<!-- autonomous-loop: ITERATION_TRACKING (loop entry) -->
**Update state tracker:**
```
RALPH LOOP — Iteration [N] | Task: [pending] | Criteria: [X/Y] met | Phase: 1
```

**Query active work:**
```bash
tm list --status in_progress
tm ready
tm show bd-1  # Re-read epic criteria
```

**Three cases:**

**A) In-progress task exists** → Continue it (skip to Phase 2 or Phase 3 as appropriate).

**B) Ready task exists** → Claim and proceed:
```bash
bv -robot-next 2>/dev/null  # Get optimal next task with claim_command
tm update bd-N --status in_progress
tm show bd-N
```

**C) No ready or in-progress tasks exist and epic success criteria are still unmet** → do not stop - create and execute the next task.

### Auto-create next task from unmet criterion

When criteria are unmet and no executable task exists, create the next task directly from the unmet criterion:

```bash
tm create "Task: [criterion gap]" \
  --type feature \
  --priority 1 \
  --design "## Goal
[Close the unmet criterion gap]

## Context
- Epic: bd-1
- Gap: [exact unmet criterion]

## Implementation
- [Concrete steps]

## Success Criteria
- [ ] Criterion gap closed with verifiable evidence
- [ ] Tests passing"

tm dep add bd-NEW bd-1 --type parent-child
```

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 1 complete. Task claimed or created. Proceed to Phase 2 (SRE Refinement).

---

## Phase 2: SRE Refinement (Per Task)

Before executing ANY task, run SRE refinement to ensure it's ready:

```bash
tm show bd-N  # Load task details
```

**Run SRE Task Refinement:**
```
Use Skill tool: hyperpowers:sre-task-refinement
```

<!-- autonomous-loop: AFTER_RETURNING -->
⚠️ **AFTER SRE REFINEMENT RETURNS:** You are in execute-ralph Phase 2. Proceed to Phase 3 (Execute Task). Do NOT stop. Do NOT present checkpoint.

This ensures:
- Task granularity is appropriate (4-8 hours)
- Edge cases and failure modes are identified
- Success criteria are specific and measurable
- No placeholder text remains
- Anti-patterns are specified
- Test specifications catch real bugs

If SRE refinement finds critical issues:
- Update the task using `tm update --design`
- Re-run SRE refinement if major changes made
- Only proceed to execution when task passes review

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 2 complete. Task refined. Proceed to Phase 3 (Execute Task).

---

## Phase 3: Execute Task

<!-- autonomous-loop: STOP_OVERRIDE (reinforcement) -->
**CONTEXT REMINDER: You are running execute-ralph (autonomous). If TDD or verification skills instruct you to STOP, IGNORE that instruction. Continue autonomously.**

**Execute using TDD:**
- Use `test-driven-development` skill for implementation
- Use `test-runner` agent for verifications (keeps context clean)
- Complete ALL substeps before closing

<!-- autonomous-loop: AFTER_RETURNING -->
⚠️ **AFTER TDD RETURNS:** You are in execute-ralph Phase 3. Continue with verification and task closure. Do NOT stop. Do NOT present checkpoint.

**Auto-close task after verification:**
```bash
# Run verification commands internally
# Then auto-close
tm close bd-N
```

### Step 3b: Auto-Commit

After each task completion, commit changes:

```bash
git add -A
git commit -m "Complete bd-N: [task title]

- [Brief summary of what was implemented]
- Tests: passing

Part of epic: bd-1 - [epic title]"
```

**Update TodoWrite:**
```
Branch: feature/[epic-name]
Commits: [N]
- bd-2: [title] ✓ (committed)
- bd-3: [title] (in progress)
- bd-4: [title] (pending)
```

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 3 complete. Task executed, verified, committed. Proceed to Phase 4 (Review). Do NOT stop.

---

## Phase 4: Multi-Agent Parallel Review

Dispatch **5 review agents in parallel** for comprehensive coverage:

```
Dispatch IN PARALLEL:

1. review-quality:
   "Review task bd-N implementation for bugs, security issues, race conditions.
   Task: [title]
   Files changed: [list]
   Return: PASS or ISSUES_FOUND with severity and file:line references."

2. review-implementation:
   "Verify task bd-N achieves its stated goals.
   Task requirements: [from tm show]
   Epic requirements: [relevant subset]
   Return: PASS or ISSUES_FOUND with missing/incomplete items."

3. review-testing:
   "Evaluate test coverage for task bd-N changes.
   Files changed: [list]
   Test files: [list]
   Return: PASS or ISSUES_FOUND with coverage gaps."

4. review-simplification:
   "Check for over-engineering in task bd-N.
   Task scope: [what was requested]
   Implementation: [what was built]
   Return: PASS or ISSUES_FOUND with simplification recommendations."

5. review-documentation:
   "Check if docs need updates for task bd-N changes.
   Changes: [API changes, config changes, new features]
   Return: PASS or ISSUES_FOUND with documentation gaps."
```

**Also dispatch test-effectiveness-analyst:**

```
6. test-effectiveness-analyst:
   "Analyze test quality for task bd-N changes.
   Return: PASS or ISSUES_FOUND with tautological tests, weak assertions, missing coverage."
```

### Collecting Results

Wait for all 6 agents. Aggregate issues:

```
Review Results for bd-N:
- Quality: PASS
- Implementation: PASS
- Testing: ISSUES_FOUND (1 MAJOR)
- Simplification: PASS
- Documentation: ISSUES_FOUND (1 MINOR)
- Test Effectiveness: PASS

Issues to Address:
1. [MAJOR/testing] No test for error case in handler.ts:45
2. [MINOR/docs] New env var not documented in README
```

### If All PASS

<!-- autonomous-loop: CONTINUATION (branch: all pass) -->
→ **CONTINUATION:** Phase 4 complete. All reviews passed. Skip Phase 5, proceed to Phase 6 (Criteria Check).

### If Any ISSUES_FOUND

<!-- autonomous-loop: CONTINUATION (branch: issues found) -->
→ **CONTINUATION:** Phase 4 complete. Issues found. Proceed to Phase 5 (Autonomous Fix).

---

## Phase 5: Autonomous Fix (Max 2 Iterations)

**If issues found, fix autonomously without user interaction:**

**Iteration tracking:**
```
- bd-N fix iteration: 1/2
```

**Prioritize fixes by severity:**
1. CRITICAL issues first
2. MAJOR issues second
3. MINOR issues (best effort)
4. Test effectiveness issues (tautologies, weak assertions)

**For complex fixes (3+ independent issues):**
```
Use Skill tool: hyperpowers:dispatching-parallel-agents
```

<!-- autonomous-loop: AFTER_RETURNING -->
⚠️ **AFTER PARALLEL AGENTS RETURN:** You are in execute-ralph Phase 5. Continue with fix verification. Do NOT stop. Do NOT present checkpoint.

Dispatch agents in parallel (one per independent domain):
- Each agent fixes one issue category
- Must verify independence first
- Wait for all agents, check conflicts
- Run full test suite before continuing

**For each issue:**
1. Read the specific file:line reference
2. Apply the fix instruction exactly
3. Run tests via test-runner

**After fixes applied:**
```bash
git add -A
git commit -m "Fix review issues for bd-N (iteration 1)

- [List of issues fixed]"
```

**Re-run affected reviewers AND test-effectiveness-analyst:**
- If testing issue fixed → re-run review-testing + test-effectiveness-analyst
- If quality issue fixed → re-run review-quality
- etc.

**Outcomes:**
- If all PASS: proceed to Phase 6 (Criteria Check)
- If still ISSUES_FOUND and iteration < 2: repeat Phase 5
- If still ISSUES_FOUND and iteration = 2: flag for user, proceed to Phase 6

**Flagging format:**
```
FLAGGED FOR USER REVIEW:
- Task: bd-N
- Unfixed Issues:
  1. [MAJOR/testing] description
  2. [MINOR/docs] description
- Attempted fixes: 2 iterations
- Recommendation: [what user should check]
```

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 5 complete. Fixes applied. Proceed to Phase 6 (Criteria Check).

---

<!-- autonomous-loop: CRITERIA_DRIVEN_CONTINUATION -->
## Phase 6: Criteria Check

**This is the loop decision point.** Evaluate epic success criteria:

```bash
tm show bd-1  # Re-read epic success criteria
```

<!-- autonomous-loop: ITERATION_TRACKING (criteria check) -->
**Update state tracker:**
```
RALPH LOOP — Iteration [N] complete | Task: bd-X [done] | Criteria: [X/Y] met | Phase: 6
```

**Decision:**

**A) ALL epic success criteria are met** → EXIT LOOP. Proceed to Phase 7 (Test Suite Audit).

**B) Criteria remain unmet AND tasks exist (ready or can be created)** → CONTINUE LOOP. Return to Phase 1 (Get Next Task).

**C) Critical blocker** (cannot compile after 2 fix iterations, test suite completely broken, epic anti-pattern unavoidable, debugging tools cannot identify root cause) → Alert user with findings. Stop execution.

**CRITICAL: Task list exhaustion alone is NEVER a stop condition.** If no ready or in-progress tasks exist and epic success criteria are still unmet, do not stop - create and execute the next task. Return to Phase 1 which handles auto-creation.

<!-- autonomous-loop: CONTINUATION (branch: continue loop) -->
→ **CONTINUATION (if continuing loop):** Phase 6 complete. Criteria unmet. CONTINUE LOOP — returning to Phase 1 (Get Next Task). Iteration [N+1] starting.

<!-- autonomous-loop: CONTINUATION (branch: exit loop) -->
→ **CONTINUATION (if exiting loop):** Phase 6 complete. All criteria met. EXIT LOOP — proceeding to Phase 7 (Test Suite Audit).

---

## Phase 7: Test Suite Audit

After all tasks complete and criteria met, run comprehensive test effectiveness audit:

```
Use Skill tool: hyperpowers:analyzing-test-effectiveness
```

<!-- autonomous-loop: AFTER_RETURNING -->
⚠️ **AFTER TEST AUDIT RETURNS:** You are in execute-ralph Phase 7. Proceed to Phase 8 (Final Gate). Do NOT stop. Do NOT present checkpoint.

**This will:**
- Inventory all tests in the codebase
- Read production code before categorizing
- Identify RED tests (tautological, mock-testing, line hitters)
- Identify YELLOW tests (weak assertions, coverage gaming)
- Assess GREEN tests (meaningful, catch real bugs)
- Find missing corner cases
- Create bd epic with improvement tasks if needed

**Purpose:** Establish baseline test quality for the epic.

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 7 complete. Test audit done. Proceed to Phase 8 (Final Gate).

---

## Phase 8: Final Autonomous Review Gate

After epic criteria are apparently met, run dual final approval gate:

```
Dispatch IN PARALLEL:

1. autonomous-reviewer:
   "FINAL REVIEW for epic bd-1.
   Validate all integrated work and run web-backed checks where uncertain.
   Return: APPROVED or GAPS_FOUND with concrete remediation tasks."

2. review-implementation:
   "FINAL REVIEW for epic bd-1.
   Epic requirements: [full list]
   Completed tasks: [list]

   Verify:
   - ALL success criteria are actually met
   - No requirements were lost between tasks
   - Integration is complete

   Return: APPROVED or GAPS_FOUND with missing requirements."
```

Only close epic when BOTH final reviewers approve.

### Verdict Normalization Matrix

- PASS, APPROVED -> continue or close path
- NEEDS_FIX, ISSUES_FOUND, GAPS_FOUND, CRITICAL_ISSUES -> remediation path
- Unknown or malformed verdict -> remediation path (never auto-approve)
- Mixed final reviewer outputs -> remediation path (no epic close).

Mixed final reviewer outputs are non-approval.
Do not close the epic unless both final reviewers return APPROVED.
Unknown or malformed verdict must create a remediation task and continue the loop.

### Quality Gate Sequence (pre-commit-equivalent for this repo)

Run these verification commands and keep output as epic-closure evidence:
In guarded environments, direct .git/hooks/pre-commit execution may be blocked by safety guardrails.

- `node --test tests/execute-ralph-contract.test.js`
- `node --test tests/codex-*.test.js`
- `node --test tests/*.test.js`
- `node scripts/sync-codex-skills.js --check`

### If Both APPROVED

<!-- autonomous-loop: CONTINUATION (branch: approved) -->
→ **CONTINUATION:** Phase 8 complete. Both reviewers APPROVED. Proceed to Phase 9 (Branch Completion).

### If Any Non-Approval (GAPS_FOUND, NEEDS_FIX, CRITICAL_ISSUES)

Create remediation tasks:
```bash
tm create "Remediation: [issue description]" \
  --type task \
  --design "[fix instructions from reviewer]"
tm dep add bd-NEW bd-1 --type parent-child
```

Execute remediation tasks — **RETURN TO Phase 1** (Get Next Task).

Track no-progress rounds (same unresolved findings with no material diff):

- Keep generating alternative remediation tasks and continue autonomously.
- Escalate to user only after max 50 no-progress remediation cycles.

<!-- autonomous-loop: CONTINUATION (branch: non-approval) -->
→ **CONTINUATION (if non-approval):** Phase 8 complete. Non-approval received. RETURN TO Phase 1 — creating remediation task and continuing loop.

---

## Phase 9: Branch Completion

**Use finishing-a-development-branch skill:**

```
Use Skill tool: hyperpowers:finishing-a-development-branch
```

<!-- autonomous-loop: AFTER_RETURNING -->
⚠️ **AFTER BRANCH COMPLETION RETURNS:** You are in execute-ralph Phase 9. Present final summary. Epic is complete.

**This skill:**
1. Closes bd epic: `tm close bd-1`
2. Verifies tests pass
3. Determines base branch
4. Executes merge/PR automatically (or presents options if ambiguous)
5. Cleans up worktree

**NO WAITING** - Execute completion autonomously unless merge conflicts detected.

Present summary:

```markdown
## Epic bd-1 Complete - Autonomous Execution

### Branch
`feature/[epic-name]` - Ready for PR

### Statistics
- Total tasks: N
- Total commits: M
- Fix iterations: X
- Review agents invoked: Y (5 standard + test-effectiveness-analyst per task)
- Tests audited: Z (test effectiveness analysis)
- Debug sessions: W (debugging-with-tools invocations)
- Tautological tests caught: T
- Root causes traced: R (via root-cause-tracing)

### Tasks Executed
- bd-2: [title] ✓
- bd-3: [title] ✓ (1 fix iteration)
- bd-4: [title] ✓

### Review Summary
**Per-Task Reviews (5 agents + test-effectiveness-analyst each):**
- bd-2: All PASS (5 agents + test quality PASS)
- bd-3: 3 issues found (2 standard + 1 tautological test), fixed in 1 iteration
- bd-4: All PASS (5 agents + test quality PASS)

**Test Effectiveness Audit:**
- RED tests removed: N
- YELLOW tests strengthened: M
- GREEN tests verified: X
- Missing corner cases added: Y

**Final Review (autonomous-reviewer with web research):**
- Status: APPROVED
- Security scan: No vulnerabilities found
- Architecture: Coherent
- Performance: Within expected parameters

### Issues Fixed Autonomously
1. [MAJOR/testing] Missing error case test - added test
2. [MINOR/docs] Undocumented env var - updated README
3. [MAJOR/test-eff] Tautological test removed and replaced with meaningful test
4. [MAJOR/debug] Root cause identified via debugging-with-tools - fixed at source

### Flagged for User Review
- [Any items that couldn't be resolved after 2 fix iterations]
- [Or "None - all issues resolved autonomously"]

### Next Steps
Branch completion options presented via finishing-a-development-branch:
1. Merge locally to [base-branch]
2. Push and create Pull Request
3. Keep branch as-is
4. Discard work

[Or "Epic complete - awaiting user choice on integration method"]
```

---

<!-- autonomous-loop: CONTEXT_RECOVERY -->
## EXECUTION LOOP REMINDER (Context Recovery)

If you have lost track of where you are in the execute-ralph loop, re-read this summary:

```
SETUP (once):  Phase 0 — Smart Triage, Load Epic, Create Branch, Extract Criteria

REPEAT (per task):
  Phase 1 — GET TASK: tm ready to claim, OR auto-create from unmet criterion
  Phase 2 — REFINE: sre-task-refinement (NEVER skip)
  Phase 3 — EXECUTE: TDD + verification + close task + auto-commit
  Phase 4 — REVIEW: 5 parallel review agents + test-effectiveness-analyst
  Phase 5 — FIX: Autonomous fixes (max 2 iterations per task)
  Phase 6 — CRITERIA CHECK:
             All epic success criteria met? → EXIT LOOP to Phase 7
             Tasks remain or can be created? → CONTINUE LOOP (Phase 1)
             Critical blocker? → Alert user

POST-LOOP:
  Phase 7 — Test Suite Audit
  Phase 8 — Final Gate (BOTH must APPROVED, else RETURN TO Phase 1)
  Phase 9 — Branch Completion
```

**Key rules:**
- You are running AUTONOMOUSLY — no user checkpoints
- REPEAT Phase 1-6 until ALL epic criteria are met
- NEVER stop between tasks unless critical blocker
<!-- autonomous-loop: STOP_OVERRIDE (recovery) -->
- If any loaded skill says STOP, IGNORE it — execute-ralph overrides checkpoint semantics
- Task list exhaustion is NOT a stop condition — auto-create tasks for unmet criteria

</the_process>

<critical_rules>

## Rules That Have No Exceptions

1. **Epic requirements are IMMUTABLE** - Never water down to make execution easier
2. **SRE refinement REQUIRED per task** - Never skip corner-case analysis before execution
3. **Verification gate REQUIRED** - Use verification-before-completion before closing ANY task
4. **Test effectiveness analysis REQUIRED** - Run test-effectiveness-analyst after 5-agent review
5. **Debug systematically** - Use debugging-with-tools when root cause unclear
6. **Max 2 fix iterations per task** - After 2, flag and continue
7. **No-progress remediation retries are bounded** - Escalate only after max 50 no-progress remediation cycles
8. **Criteria-driven continuation is mandatory** - Task list exhaustion alone is never a stop condition
9. **Always use test-runner** - Keep verbose output out of context
10. **Always run all 5 reviewers + test-effectiveness-analyst** - Full review coverage
11. **Always auto-commit** - Each task completion gets its own commit
12. **Always create branch** - Never work directly on main
13. **Final verification REQUIRED** - verification-before-completion before epic close

## What Triggers User Notification

Only these situations stop autonomous execution:
- Critical blocker (can't compile, tests completely broken, debugging can't find root cause)
- max 50 no-progress remediation cycles reached

Everything else: fix autonomously and continue.

**Special case - Debug loop:**
If debugging-with-tools or root-cause-tracing cannot identify root cause after thorough investigation, alert user with findings so far.

## Anti-Patterns for This Skill

- Skipping SRE refinement "task looks straightforward"
- Skipping verification-before-completion gates
- Skipping test-effectiveness-analyst "tests look fine"
- Skipping debugging tools "I'll just guess the fix"
- Skipping reviewers "because task was simple"
- Skipping TDD "to save time"
- Ignoring reviewer feedback
- Continuing past critical blockers
- Not using web search when uncertain
- Not using root-cause-tracing for deep errors
- Working on main branch instead of feature branch
- Not committing after task completion
- Stopping after task completion instead of continuing to next task
- Presenting user checkpoint when sub-skill says STOP

</critical_rules>

<integration>

**This skill calls:**
- sre-task-refinement (REQUIRED before executing each task)
- test-driven-development (for implementing each task)
- verification-before-completion (REQUIRED gates)
- test-runner (for running tests without output pollution)
- review-quality (parallel reviewer)
- review-implementation (parallel reviewer)
- review-testing (parallel reviewer)
- review-simplification (parallel reviewer)
- review-documentation (parallel reviewer)
- test-effectiveness-analyst (tautology/coverage gaming detection)
- debugging-with-tools (systematic debugging)
- root-cause-tracing (deep error tracing)
- dispatching-parallel-agents (for 3+ independent fixes)
- analyzing-test-effectiveness (final test suite audit)
- autonomous-reviewer (final review with web research)
- finishing-a-development-branch (branch completion)

**This skill is called by:**
- User via `/hyperpowers:execute-ralph`
- After writing-plans creates well-defined epic

**Comparison to execute-plans:**

| Aspect | execute-plans | execute-ralph |
|--------|---------------|---------------|
| Checkpoints | STOP after each task | No stops |
| SRE Refinement | Per new task | **Per every task** |
| Verification gates | Per task | **Per task + final gate** |
| Debug tools | On failure | **Systematic debugging** |
| Test effectiveness | Not included | **Per task + final audit** |
| Parallel fixes | Not included | **For 3+ independent issues** |
| Final review | review-implementation | **autonomous-reviewer + web** |
| Branch completion | Manual | **finishing-a-development-branch** |
| User interaction | Required between tasks | Only on failure |
| Review | Final only | 5 agents + test-effectiveness per task |
| Git workflow | Manual | Auto-branch + auto-commit |
| Best for | Uncertain requirements | Well-defined epics with full hyperpowers pipeline |

**Comparison to ralphex:**

| Aspect | ralphex | execute-ralph |
|--------|---------|---------------|
| Multi-agent review | Yes 5 parallel | Yes 5 + test-effectiveness-analyst |
| Test quality analysis | No | **Yes - per task + final audit** |
| Debug tools integration | No | **Yes - debugging-with-tools** |
| Root cause tracing | No | **Yes - root-cause-tracing** |
| Verification gates | No | **Yes - verification-before-completion** |
| Parallel fix dispatch | No | **Yes - dispatching-parallel-agents** |
| Autonomous reviewer | No | **Yes - with web research** |
| Branch completion | Basic | **finishing-a-development-branch** |
| Git branch | Yes Auto | Yes Auto |
| Auto-commit | Yes | Yes |
| Final review | Yes 2 agents | Yes autonomous-reviewer |
| Smart triage | No | Yes bv robot-* |
| bd integration | No | Yes Full |
| Web dashboard | Yes | No CLI only |

</integration>

<resources>

**bd command reference:**
- See [bd commands](../common-patterns/bd-commands.md)

**Review agents:**
- review-quality: bugs, security, race conditions
- review-implementation: requirements verification
- review-testing: test coverage and quality
- review-simplification: over-engineering detection
- review-documentation: docs update needs

**When stuck:**
- 2 fix iterations failed → Flag and continue, let user review later
- Critical blocker → Stop, document clearly, present summary
- Reviewers keep finding issues → Check if epic requirements are realistic

</resources>
