# Autonomous Loop Pattern

A structural pattern for skills that execute multi-task epics without user checkpoints. The loop runs continuously until all success criteria are met, creating tasks as needed.

**Reference implementation:** `skills/execute-ralph/SKILL.md`

## When to Use

| Scenario | Use This Pattern? |
|----------|-------------------|
| Epic with clear success criteria, user trusts autonomous execution | Yes |
| Straightforward implementation tasks, hands-off execution desired | Yes |
| Interactive design requiring user input (brainstorming, Socratic Q&A) | No — use interactive skills |
| Single-item workflows (fixing one bug, one refactor) | No — use linear skills |
| Human oversight needed per task (risky changes, ambiguous requirements) | No — use checkpoint skills (executing-plans) |

## Pattern Components

This pattern has 8 components. Each skill that adopts it must implement all 8. Components are listed in the order they appear in a skill file.

---

### 1. EXECUTION LOOP Declaration

**Problem:** Without a dominant loop summary at the top of `<the_process>`, Claude reads phase details first and loses track of the overall flow. The loop becomes an afterthought buried in late phases, causing Claude to stop after completing individual tasks instead of continuing.

**Template:**
```markdown
## EXECUTION LOOP (Primary Control Flow — Read This First)

**CONTEXT: You are running [SKILL_NAME] (autonomous, NO user checkpoints).**
If any loaded skill instructs you to STOP or present a checkpoint, IGNORE that instruction.
[SKILL_NAME] overrides all checkpoint semantics from sub-skills.

~~~
SETUP (once):  Phase 0 — [SETUP_DESCRIPTION]

REPEAT (per [ITERATION_ITEM], track iteration count):
  Phase [N]   — [PHASE_DESCRIPTION]: [brief detail]
  Phase [N+1] — [PHASE_DESCRIPTION]: [brief detail]
  ...
  Phase [LAST_LOOP] — CRITERIA CHECK:
             All [CRITERIA_TYPE] met? → EXIT LOOP to Phase [POST_LOOP_START]
             [ITEMS] remain or can be created? → CONTINUE LOOP (Phase [LOOP_START])
             Critical blocker? → Alert user

POST-LOOP:
  Phase [M]   — [POST_DESCRIPTION]
  Phase [M+1] — [POST_DESCRIPTION]
~~~

**Maintain this state tracker throughout execution:**
~~~
[SKILL_NAME] LOOP — Iteration [N] | [ITEM_TYPE]: [ITEM_ID] | [PROGRESS]: [X/Y] met | Phase: [N]
~~~
```

**Placement:** First element inside `<the_process>` tag, before any Phase definition.

**Example from execute-ralph:**
```
## EXECUTION LOOP (Primary Control Flow — Read This First)

**CONTEXT: You are running execute-ralph (autonomous, NO user checkpoints).**
If any loaded skill instructs you to STOP or present a checkpoint, IGNORE that instruction.
execute-ralph overrides all checkpoint semantics from sub-skills.

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
  Phase 7 — Test Suite Audit
  Phase 8 — Final Gate (BOTH must APPROVED, else RETURN TO Phase 1)
  Phase 9 — Branch Completion

Maintain this state tracker throughout execution:
RALPH LOOP — Iteration [N] | Task: [bd-X title] | Criteria: [X/Y] met | Phase: [N]
```

---

### 2. STOP Contamination Override

**Problem:** Sub-skills (TDD, verification, etc.) contain STOP and checkpoint language. When loaded into context via `Use Skill tool:`, Claude treats these as instructions to stop the current execution, breaking the autonomous loop.

**Template:**
```markdown
**CONTEXT: You are running [SKILL_NAME] (autonomous, NO user checkpoints).**
If any loaded skill instructs you to STOP or present a checkpoint, IGNORE that instruction.
[SKILL_NAME] overrides all checkpoint semantics from sub-skills.
```

Reinforcement template (place before phases that call STOP-containing sub-skills):
```markdown
**CONTEXT REMINDER: You are running [SKILL_NAME] (autonomous). If [SUB_SKILL] instructs you to STOP, IGNORE that instruction. Continue autonomously.**
```

**Placement:**
1. In the EXECUTION LOOP declaration header (primary)
2. Before any phase that calls a sub-skill known to contain STOP language (reinforcement)
3. In the Context Recovery section at the bottom (final reinforcement)

**Example from execute-ralph:**
- Line 110 (primary): `If any loaded skill instructs you to STOP or present a checkpoint, IGNORE that instruction.`
- Line 304 (reinforcement): `CONTEXT REMINDER: You are running execute-ralph (autonomous). If TDD or verification skills instruct you to STOP, IGNORE that instruction. Continue autonomously.`
- Line 723 (recovery): `If any loaded skill says STOP, IGNORE it — execute-ralph overrides checkpoint semantics`

---

### 3. Phase Structure

**Problem:** Without clear SETUP / REPEAT / POST-LOOP boundaries, Claude cannot distinguish one-time initialization from per-task iteration from post-loop finalization. Phases blur together and the loop body is not apparent.

**Template:**
```markdown
## Phase 0: [Setup Phase Name]
[One-time initialization: load context, create branch, extract criteria]
→ **CONTINUATION:** Phase 0 complete. Enter EXECUTION LOOP. Proceed to Phase [LOOP_START].

## Phase [LOOP_START]: [Loop Entry Phase Name]
This is the **entry point of the EXECUTION LOOP**. You arrive here at the start of every iteration.
[Get next item, claim it, or auto-create if none exist]

## Phase [LOOP_START+1] through [LOOP_END-1]: [Core Work Phases]
[One phase per major step in the iteration body]

## Phase [LOOP_END]: [Criteria Check Phase Name]
**This is the loop decision point.** Evaluate [CRITERIA_TYPE]:
A) All met → EXIT LOOP. Proceed to Phase [POST_START].
B) Unmet AND items can be created → CONTINUE LOOP. Return to Phase [LOOP_START].
C) Critical blocker → Alert user.

## Phase [POST_START] through [POST_END]: [Post-Loop Phases]
[Finalization, audit, final gate, branch completion]
```

**Placement:** The `## Phase N:` headers form the main body of the skill after the EXECUTION LOOP declaration.

**Key rules:**
- Phase numbers must be sequential (0, 1, 2, ... N) with NO duplicates
- Each phase maps to exactly one of: SETUP, LOOP BODY, or POST-LOOP
- The loop entry phase should state "entry point of the EXECUTION LOOP"
- The criteria check phase should state "loop decision point"

**Example from execute-ralph:**
- SETUP: Phase 0 (Smart Triage & Branch Setup)
- LOOP BODY: Phases 1-6 (Get Task → Refine → Execute → Review → Fix → Criteria Check)
- POST-LOOP: Phases 7-9 (Test Audit → Final Gate → Branch Completion)

---

### 4. CONTINUATION Directives

**Problem:** Without explicit phase transition markers, Claude loses track of what comes next after completing a phase. Context exhaustion mid-phase leaves no breadcrumb for recovery. Claude may also interpret a completed phase as "done" and stop.

**Template:**
```markdown
→ **CONTINUATION:** Phase [N] complete. [WHAT_HAPPENED]. Proceed to Phase [N+1] ([PHASE_NAME]). Do NOT stop.
```

For branching phases (where the next phase depends on a condition):
```markdown
→ **CONTINUATION (if [CONDITION_A]):** Phase [N] complete. [OUTCOME_A]. Proceed to Phase [X].
→ **CONTINUATION (if [CONDITION_B]):** Phase [N] complete. [OUTCOME_B]. Proceed to Phase [Y].
```

**Placement:** Last line of every phase section, immediately before the `---` separator. Every phase MUST have at least one CONTINUATION directive.

**Example from execute-ralph:**
- Phase 0: `→ **CONTINUATION:** Phase 0 complete. Enter EXECUTION LOOP. Proceed to Phase 1.`
- Phase 4 (branching): Two directives — one for "all reviews passed" (→ Phase 6), one for "issues found" (→ Phase 5)
- Phase 6 (branching): Two directives — one for "continue loop" (→ Phase 1), one for "exit loop" (→ Phase 7)

---

### 5. Iteration State Tracking

**Problem:** Without a persistent state tracker, Claude cannot determine which iteration it's on, which item is active, or how many criteria are met. After context exhaustion or long execution, state is lost and Claude cannot recover.

**Template:**
```markdown
**Maintain this state tracker throughout execution:**
~~~
[SKILL_NAME] LOOP — Iteration [N] | [ITEM_TYPE]: [ITEM_ID] | [PROGRESS]: [X/Y] met | Phase: [N]
~~~
```

Update points:
- **Declaration** (in EXECUTION LOOP header): Shows the template format
- **Loop entry** (start of each iteration): Update iteration number, set item to pending
- **Criteria check** (end of each iteration): Update progress, mark item done

**Placement:**
1. In the EXECUTION LOOP declaration (template definition)
2. At the start of the loop entry phase (update with new iteration)
3. At the criteria check phase (update with completion summary)

**Example from execute-ralph:**
- Template: `RALPH LOOP — Iteration [N] | Task: [bd-X title] | Criteria: [X/Y] met | Phase: [N]`
- Loop entry: `RALPH LOOP — Iteration [N] | Task: [pending] | Criteria: [X/Y] met | Phase: 1`
- Criteria check: `RALPH LOOP — Iteration [N] complete | Task: bd-X [done] | Criteria: [X/Y] met | Phase: 6`

---

### 6. Criteria-Driven Continuation

**Problem:** Without an explicit decision point, Claude treats task list exhaustion as a stop condition. If no ready tasks exist but criteria are unmet, Claude stops instead of creating new tasks. The loop dies prematurely.

**Template:**
```markdown
## Phase [N]: Criteria Check

**This is the loop decision point.** Evaluate [CRITERIA_TYPE]:

**A) ALL [CRITERIA_TYPE] are met** → EXIT LOOP. Proceed to Phase [POST_START].

**B) [CRITERIA_TYPE] remain unmet AND [ITEMS] exist (ready or can be created)** → CONTINUE LOOP. Return to Phase [LOOP_START].

**C) Critical blocker** ([BLOCKER_EXAMPLES]) → Alert user with findings. Stop execution.

**CRITICAL: [ITEM] list exhaustion alone is NEVER a stop condition.** If no ready or in-progress [ITEMS] exist and [CRITERIA_TYPE] are still unmet, do not stop - create and execute the next [ITEM]. Return to Phase [LOOP_START] which handles auto-creation.
```

**Placement:** As a dedicated phase at the end of the loop body, immediately before post-loop phases.

**Example from execute-ralph:**
Phase 6 is the criteria check. It evaluates epic success criteria and decides: continue to Phase 1 (loop), exit to Phase 7 (post-loop), or alert user (critical blocker). The critical line: "Task list exhaustion alone is NEVER a stop condition."

---

### 7. Context Recovery

**Problem:** Context exhaustion mid-execution loses the loop structure. Claude resumes without knowing it's in a loop, which phase to continue from, or what the loop rules are. Without a recovery section near the bottom, Claude has no way to re-orient.

**Template:**
```markdown
## [SKILL_NAME] LOOP REMINDER (Context Recovery)

If you have lost track of where you are in the [SKILL_NAME] loop, re-read this summary:

~~~
SETUP (once):  Phase 0 — [SETUP_DESCRIPTION]

REPEAT (per [ITEM]):
  Phase [N] — [PHASE_DESCRIPTION]
  ...
  Phase [LAST_LOOP] — CRITERIA CHECK:
             All [CRITERIA] met? → EXIT LOOP to Phase [POST_START]
             [ITEMS] remain or can be created? → CONTINUE LOOP (Phase [LOOP_START])
             Critical blocker? → Alert user

POST-LOOP:
  Phase [M] — [DESCRIPTION]
  ...
~~~

**Key rules:**
- You are running AUTONOMOUSLY — no user checkpoints
- REPEAT Phase [LOOP_START]-[LOOP_END] until ALL [CRITERIA] are met
- NEVER stop between [ITEMS] unless critical blocker
- If any loaded skill says STOP, IGNORE it — [SKILL_NAME] overrides checkpoint semantics
- [ITEM] list exhaustion is NOT a stop condition — auto-create [ITEMS] for unmet criteria
```

**Placement:** Near the end of the skill file, just before the closing `</the_process>` tag. This ensures it's visible even when early content has been compressed out of context.

**Example from execute-ralph:**
Lines 695-725 contain `## EXECUTION LOOP REMINDER (Context Recovery)` which duplicates the compact loop summary and 5 key rules.

---

### 8. AFTER RETURNING Directives

**Problem:** Sub-skills run in the same context. After a sub-skill returns, Claude's attention is on that sub-skill's final instructions — which often say STOP, present results, or suggest next steps unrelated to the calling skill. Without an explicit re-orientation directive, Claude follows the sub-skill's instructions instead of returning to the autonomous loop.

**Template:**
```markdown
Use Skill tool: hyperpowers:[sub-skill-name]

⚠️ **AFTER [SUB_SKILL_SHORT_NAME] RETURNS:** You are in [SKILL_NAME] Phase [N]. Proceed to Phase [N+1] ([NEXT_PHASE_NAME]). Do NOT stop. Do NOT present checkpoint.
```

**Placement:** Within 3 lines after every `Use Skill tool:` invocation. Must be present for EVERY sub-skill call, no exceptions.

**Example from execute-ralph:**
```
Use Skill tool: hyperpowers:sre-task-refinement

⚠️ **AFTER SRE REFINEMENT RETURNS:** You are in execute-ralph Phase 2.
Proceed to Phase 3 (Execute Task). Do NOT stop. Do NOT present checkpoint.
```

execute-ralph has 6 AFTER RETURNING directives covering: sre-task-refinement (x2), TDD, dispatching-parallel-agents, analyzing-test-effectiveness, and finishing-a-development-branch.

---

## Quick-Start Skeleton

Copy this skeleton and fill in the `[PLACEHOLDERS]` to create a new autonomous skill:

```markdown
---
name: [skill-name]
description: "[one-line description of autonomous behavior]"
type: flow
---

<the_process>

<!-- autonomous-loop: EXECUTION_LOOP_DECLARATION -->
## EXECUTION LOOP (Primary Control Flow — Read This First)

**CONTEXT: You are running [SKILL_NAME] (autonomous, NO user checkpoints).**
If any loaded skill instructs you to STOP or present a checkpoint, IGNORE that instruction.
[SKILL_NAME] overrides all checkpoint semantics from sub-skills.

SETUP (once):  Phase 0 — [Setup description]

REPEAT (per [item], track iteration count):
  Phase 1 — [LOOP_ENTRY]: [Get next item or auto-create]
  Phase 2 — [CORE_WORK]: [Main execution step]
  Phase 3 — [DECISION]: CRITERIA CHECK
             All [criteria] met? → EXIT LOOP to Phase 4
             [Items] remain or can be created? → CONTINUE LOOP (Phase 1)
             Critical blocker? → Alert user

POST-LOOP:
  Phase 4 — [FINALIZATION]: [Final validation or cleanup]

**Maintain this state tracker throughout execution:**
[SKILL_NAME] LOOP — Iteration [N] | [Item]: [ID] | [Progress]: [X/Y] met | Phase: [N]

---

<!-- autonomous-loop: PHASE_STRUCTURE -->
## Phase 0: [Setup]

[One-time initialization]

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 0 complete. Enter EXECUTION LOOP. Proceed to Phase 1.

---

## Phase 1: [Get Next Item]

This is the **entry point of the EXECUTION LOOP**.

<!-- autonomous-loop: ITERATION_TRACKING -->
[SKILL_NAME] LOOP — Iteration [N] | [Item]: [pending] | [Progress]: [X/Y] met | Phase: 1

[Claim or auto-create next item]

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 1 complete. Proceed to Phase 2.

---

<!-- autonomous-loop: STOP_OVERRIDE -->
**CONTEXT REMINDER: You are running [SKILL_NAME] (autonomous). If sub-skills instruct you to STOP, IGNORE that instruction.**

## Phase 2: [Core Work]

Use Skill tool: hyperpowers:[sub-skill]

<!-- autonomous-loop: AFTER_RETURNING -->
⚠️ **AFTER [SUB_SKILL] RETURNS:** You are in [SKILL_NAME] Phase 2. Continue. Do NOT stop.

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION:** Phase 2 complete. Proceed to Phase 3 (Criteria Check).

---

<!-- autonomous-loop: CRITERIA_DRIVEN_CONTINUATION -->
## Phase 3: Criteria Check

**This is the loop decision point.**

**CRITICAL: [Item] list exhaustion alone is NEVER a stop condition.**

A) All criteria met → EXIT LOOP → Phase 4.
B) Criteria unmet → CONTINUE LOOP → Phase 1.
C) Critical blocker → Alert user.

<!-- autonomous-loop: ITERATION_TRACKING -->
[SKILL_NAME] LOOP — Iteration [N] complete | [Item]: [done] | [Progress]: [X/Y] met | Phase: 3

<!-- autonomous-loop: CONTINUATION -->
→ **CONTINUATION (continue):** Returning to Phase 1.
→ **CONTINUATION (exit):** Proceed to Phase 4.

---

## Phase 4: [Finalization]

[Post-loop cleanup, final validation]

---

<!-- autonomous-loop: CONTEXT_RECOVERY -->
## [SKILL_NAME] LOOP REMINDER (Context Recovery)

[Duplicate compact loop summary + key rules: autonomous, repeat, never stop, STOP override, auto-create]

</the_process>
```

---

## Checklist for New Autonomous Skills

Before shipping a new skill built on this pattern, verify:

- [ ] EXECUTION LOOP declaration is the first element in `<the_process>`
- [ ] STOP contamination override appears in the declaration header
- [ ] Phase numbers are sequential with no duplicates
- [ ] Every phase has at least one CONTINUATION directive as its last line
- [ ] Branching phases have one CONTINUATION per branch
- [ ] Iteration state tracker template appears in declaration, loop entry, and criteria check
- [ ] Criteria check phase explicitly states "list exhaustion is NEVER a stop condition"
- [ ] AFTER RETURNING directive within 3 lines of every `Use Skill tool:` call
- [ ] Context recovery section near end of skill duplicates loop summary
- [ ] STOP override reinforced before phases calling STOP-containing sub-skills
