---
name: codex-skill-execute-ralph
description: "Use when the original skill 'execute-ralph' applies. Execute entire bd epic autonomously via subagent-per-task dispatch loop. Setup, dispatch subagent per task, end-of-epic review, branch completion."
---

<!-- Generated from skills/execute-ralph/SKILL.md -->

```mermaid
flowchart TD
    S([Start]) --> P0[Phase 0: Setup]
    P0 --> P1[Phase 1: Get Next Task]
    P1 --> P2[Phase 2: Dispatch Subagent]
    P2 -->|criteria unmet| P1
    P2 -->|all criteria met| P3[Phase 3: End-of-Epic Review]
    P3 -->|BOTH APPROVED| P4[Phase 4: Branch Completion]
    P3 -->|non-approval| P1
    P4 --> E([Done])
```

<skill_overview>
Execute a complete epic autonomously by dispatching one Agent subagent per task. Each subagent handles SRE refinement, TDD, test-runner, commit, and task closure in its own context. The main loop only tracks git log progress and epic criteria. End-of-epic: 3 specialized reviews (review-quality, security-scanner, test-effectiveness-analyst) in parallel, then dual final gate (autonomous-reviewer + review-implementation). Branch completion via finishing-a-development-branch.
</skill_overview>

<rigidity_level>
STRICT - Follow the four-phase loop exactly. Epic requirements are immutable. Never ask the user for confirmation.
</rigidity_level>

<quick_reference>

| Phase | Action | Outcome |
|-------|--------|---------|
| **0. Setup** | Triage, load epic, create branch, extract criteria | Ready |
| **1. Get Task** | Claim ready / resume in-progress / auto-create | Task identified |
| **2. Dispatch Subagent** | Agent tool runs task end-to-end, main checks git log | Task done or retried |
| **3. End-of-Epic Review** | 3 specialized reviews + final gate (both must APPROVED) | Epic validated or remediation |
| **4. Branch Completion** | finishing-a-development-branch | Epic closed |

</quick_reference>

<when_to_use>

**Use when:** Epic is well-defined, user trusts autonomous execution, tasks are implementation work.
**Do NOT use when:** Ambiguous requirements (use execute-plans), needs human oversight per task, exploratory work.

</when_to_use>

<the_process>

## Phase 0: Setup

```bash
bv -robot-triage 2>/dev/null        # fallback: tm ready + tm list
```
**Health gate:** If dependency cycles or zero actionable items, alert user and stop.

```bash
bv -robot-next 2>/dev/null           # load epic
tm show bd-EPIC                      # extract success criteria + anti-patterns
```

```bash
BRANCH_NAME=$(echo "[epic-title]" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
git checkout -b "feature/${BRANCH_NAME}"
```

Extract from epic: success criteria (immutable), anti-patterns (forbidden). Store in memory for loop.

---

## Phase 1: Get Next Task (loop entry)

```bash
tm list --status in_progress
tm ready
tm show bd-EPIC   # re-read criteria
```

**A) In-progress task exists** -- resume it (proceed to Phase 2).
**B) Ready task exists** -- claim it: `tm update bd-N --status in_progress`.
**C) If no ready or in-progress tasks exist and epic success criteria are still unmet** -- do not stop - create and execute the next task.

**Refinement Step**:
After task selection/creation, run SRE refinement to ensure the task design is robust:
`Use Skill tool: hyperpowers:sre-task-refinement`

### Auto-create next task from unmet criterion

```bash
tm create "Task: [criterion gap]" --type feature --priority 1 \
  --design "## Goal\n[Close unmet criterion]\n## Success Criteria\n- [ ] Gap closed"
tm dep add bd-NEW bd-EPIC --type parent-child
tm update bd-NEW --status in_progress
```

---

## Phase 2: Dispatch Subagent

Load full task context:
```bash
tm show bd-EPIC    # epic requirements
tm show bd-N       # task design
```

**Before dispatching**, record current HEAD:
```bash
PRE_SHA=$(git rev-parse HEAD)
```

**Launch Agent tool** using the canonical 'Dispatch Protocol' from `subagent-driven-development`.

### Subagent Prompt
Use the **Subagent Prompt Template** from `subagent-driven-development` skill, populating:
- **Immutable Epic Requirements**: from `tm show bd-EPIC` wrapped in `<epic_contract>` tags.
- **Task Specification (bd-N)**: from `tm show bd-N` wrapped in `<task_spec>` tags.
- **Mandatory Workflow**: Ensure `sre-task-refinement` and TDD are mandated.

**After Agent returns**, verify progress by status and SHA comparison:
```bash
POST_SHA=$(git rev-parse HEAD)
TASK_TYPE=$(tm show bd-N --json | jq -r .type)
STATUS=$(tm show bd-N --json | jq -r .status)
```
- **Success**:
  - Require `STATUS == "closed"`.
  - **Implementation Tasks** (feature, bug, task): MUST have `POST_SHA != PRE_SHA`.
  - **Analytical Tasks**: Accepted as success even if `POST_SHA == PRE_SHA` as long as status is `closed`.
  - If verified, proceed to **Parallel Review Phase**.
- **Retry (Not Closed)**: If `STATUS != "closed"`:
  - If subagent summary claims success, **retry once** with the same prompt.
  - If retry also fails, clean worktree (`git checkout .`), defer the task (`tm update bd-N --status deferred`), and return to Phase 1.
- **Failure (Closed but no SHA drift on implementation task)**:
  - If `STATUS == "closed"` and `POST_SHA == PRE_SHA` for an implementation task (feature/bug/task type), flag as hallucinated completion and STOP.

### Parallel Review Phase (Per Task)
Once verified, trigger the following review:
1. `mcp_agents_agent_autonomous_reviewer()`

**Remediation Path**:
If the review finds **Critical** or **High** issues:
- Create remediation task: `tm create "Remediation: [Findings]" --parent bd-EPIC`.
- Return to Phase 1.

**Criteria check:**
```bash
tm show bd-EPIC   # re-read success criteria
```
- All criteria met --> Phase 3.
- Criteria unmet --> Phase 1.
- Track max 50 no-progress remediation cycles. Escalate to user only after 50.

---

## Phase 3: End-of-Epic Review (post-loop)

Dispatch specialized reviews **in parallel** via Agent tool:

1. **review-quality** -- bugs, race conditions, error handling
2. **security-scanner** -- OWASP, secrets, CVEs
3. **test-effectiveness-analyst** -- tautological tests, coverage gaming

If any issues found, create remediation task and return to Phase 1 (max 2 end-of-epic review rounds; after 2 rounds with unresolved issues, flag for user and proceed to final gate).

**Final gate** -- dispatch in parallel:
- **autonomous-reviewer**: return APPROVED or GAPS_FOUND
- **review-implementation**: return PASS or ISSUES_FOUND

Only close epic when BOTH final reviewers approve.

### Verdict Normalization Matrix

- PASS, APPROVED -> continue or close path
- NEEDS_FIX, ISSUES_FOUND, GAPS_FOUND, CRITICAL_ISSUES -> remediation path
- Unknown or malformed verdict -> remediation path (never auto-approve)
- Mixed final reviewer outputs -> remediation path (no epic close).

Mixed final reviewer outputs are non-approval.
Do not close the epic unless both final reviewers return an approval verdict.
Unknown or malformed verdict must create a remediation task and continue the loop.

Non-approval --> create remediation task, return to Phase 1 (max 50 no-progress remediation cycles).

---

## Phase 4: Branch Completion

```
Use Skill tool: hyperpowers:finishing-a-development-branch
```

**Autonomous override:** When the skill presents integration options, auto-select **option 2 (Push and create Pull Request)** without waiting for user input. Ralph is autonomous — do not present options or wait.

Present summary: tasks completed, commits made, review results, any flagged items.

---

### Quality Gate Sequence (pre-commit-equivalent for this repo)

Run these verification commands and keep output as epic-closure evidence:
In guarded environments, direct .git/hooks/pre-commit execution may be blocked by safety guardrails.

- `node --test tests/execute-ralph-contract.test.js`
- `node --test tests/codex-*.test.js`
- `node --test tests/*.test.js`
- `node scripts/sync-codex-skills.js --check`

</the_process>
