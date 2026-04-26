---
name: writing-plans
description: Use to expand bd tasks with detailed implementation steps - adds exact file paths, complete code, verification commands assuming zero context
---

<skill_overview>
Enhance bd tasks with comprehensive implementation details for engineers with zero codebase context. Expand checklists into explicit steps: which files, complete code examples, exact commands, verification steps. Every task must be a **Smallest Completable Independent Unit (SCIU)** that takes 2-5 minutes to implement and verify.
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - Follow task-by-task validation pattern, use codebase-investigator for verification.

Adapt implementation details to actual codebase state. Every task MUST be an SCIU. Use 'tm create' to break down large tasks.
</rigidity_level>

<quick_reference>

| Step | Action | Critical Rule |
|------|--------|---------------|
| **Identify Scope** | Single task, range, or full epic | No artificial limits |
| **Verify Codebase** | Use `codebase-investigator` agent | NEVER verify yourself, report discrepancies |
| **Draft SCIUs** | Write atomic (2-5 min) actions | One commit per task |
| **Decompose** | `tm create` for any task >8 hours | Link with parent-child deps |
| **Present to User** | Show COMPLETE expansion FIRST | Then ask for approval |
| **Update bd** | `tm update bd-N --design "..."` | Only after user approves |
| **Continue** | Move to next task automatically | NO asking permission between tasks |

**FORBIDDEN:** Placeholders like `[Full implementation steps as detailed above]`
**REQUIRED:** SCIU granularity, exact paths, real commands, tm-based breakdown

</quick_reference>

<when_to_use>
**Use after hyperpowers:sre-task-refinement or anytime tasks need more detail.**

Symptoms:
- bd tasks have implementation checklists but need expansion
- Task is too large (>8 hours) and needs decomposition into atoms
- Engineer needs step-by-step guide with zero context

</when_to_use>

<the_process>

## 1. Identify Tasks to Expand

**User specifies scope:**
- Single: "Expand bd-2"
- Range: "Expand bd-2 through bd-5"
- Epic: "Expand all tasks in bd-1"

**If epic:**
```bash
tm dep tree bd-1  # View complete dependency tree
```

**Create TodoWrite tracker:**
```
- [ ] bd-2: [Task Title]
- [ ] bd-3: [Task Title]
...
```

## 2. For EACH Task (Loop Until All Done)

### 2a. Mark In Progress and Read Current State

```bash
# Mark in TodoWrite: in_progress
tm show bd-3  # Read current task design
```

### 2b. Verify Codebase State

**CRITICAL: Use codebase-investigator agent, NEVER verify yourself.**

### 2c. Decomposition Protocol (MANDATORY)

If the task effort estimate is **>8 hours**, or if the checklist contains multiple unrelated components, you MUST break it down into SCIUs.

**SCIU Rule**: Every task must produce exactly one logical change that can be verified by a single test run and committed.

**Breakdown Steps:**
1. Create atomic subtasks:
```bash
tm create "SCIU 1: [Atomic Goal]" --type feature --priority 1 --design "..."
tm create "SCIU 2: [Atomic Goal]" --type feature --priority 1 --design "..."
```
2. Link to parent:
```bash
tm dep add bd-SCIU-1 bd-PARENT --type parent-child
tm dep add bd-SCIU-2 bd-PARENT --type parent-child
```
3. Update parent to 'Coordinator' role:
```bash
tm update bd-PARENT --design "## Goal
Coordinate implementation of [Component].

## SCIU Sequence
- [ ] bd-SCIU-1: [Atomic Goal]
- [ ] bd-SCIU-2: [Atomic Goal]"
```

### 2d. Draft Expanded Implementation Steps (The Handoff)

For each SCIU, provide the **Stateless Handoff**:

**Stateless Handoff Requirement**:
Every expanded task design MUST include a copy of the **Immutable Epic Requirements** and **Anti-patterns** to ensure the subagent has the complete contract.

**Step Granularity (2-5 minutes per step):**
1. Write the failing test (one step)
2. Run it to verify it fails (one step)
3. Implement minimal code to pass (one step)
4. Run tests to verify they pass (one step)
5. Commit (one step)

### 2e. Present COMPLETE Expansion to User

**Format:**
```markdown
**bd-[N]: [Task Title]**

**Stateless Handoff (Epic Contract):**
[Immutable Requirements and Anti-patterns from Epic]

**Implementation steps based on actual codebase state:**

### SCIU 1: [Atomic Goal]
**Files:**
- Modify: `exact/path/to/existing.py:123-145`

**Step 1: Write the failing test**
[Code]

**Step 2: Run test (Expected Failure)**
[Command]

[...]
```

## 3. After ALL Tasks Done

Offer execution choice:
"Ready to execute? I can use hyperpowers:executing-plans to implement iteratively."

</the_process>

<examples>
<example>
<scenario>Expanding a task for Stateless Dispatch (SCIU)</scenario>

<code>
**bd-2: Implement user login logic**

**Stateless Handoff (Epic Contract):**
- Users authenticate via Google OAuth2
- Tokens stored in httpOnly cookies (NOT localStorage)
- ❌ NO localStorage tokens (security)
- ❌ NO new user model (consistency)

**Implementation steps based on actual codebase state:**

### SCIU 1: Define OAuth strategy
**Files:**
- Create: `src/auth/strategies/google.ts`
- Modify: `src/auth/passport-config.ts`

**Step 1: Write the failing test**
```typescript
// tests/auth/google-strategy.test.ts
import { GoogleStrategy } from '../src/auth/strategies/google';
test('should verify strategy name', () => {
  const strategy = new GoogleStrategy();
  expect(strategy.name).toBe('google');
});
```

**Step 2: Run test (Expected Failure)**
```bash
node --test tests/auth/google-strategy.test.ts
# Expected: Cannot find module '../src/auth/strategies/google'
```

**Step 3: Implement minimal fix**
```typescript
// src/auth/strategies/google.ts
export class GoogleStrategy {
  name = 'google';
}
```

**Step 4: Verify test passes**
```bash
node --test tests/auth/google-strategy.test.ts
# Expected: 1 test passed
```

**Step 5: Commit**
```bash
git add src/auth/strategies/google.ts tests/auth/google-strategy.test.ts
git commit -m "Complete bd-2: Define OAuth strategy"
```
</code>
</example>
</examples>

<critical_rules>
...
## Rules That Have No Exceptions

1. **SCIU Mandate** → Every task must be a 2-5 minute implementation atom
2. **tm-First Breakdown** → Use `tm create` for any task >8 hours
3. **Stateless Handoff** → Every expanded task MUST include the full Epic Contract
4. **No placeholders or meta-references** → Write actual content
5. **Use codebase-investigator agent** → Never verify yourself

</critical_rules>

<verification_checklist>

Before marking each task complete in TodoWrite:
- [ ] Used codebase-investigator agent
- [ ] Task is an SCIU (or broken into SCIUs via tm create)
- [ ] Expansion includes the 'Stateless Handoff' (Epic Contract)
- [ ] User approved expansion

</verification_checklist>
