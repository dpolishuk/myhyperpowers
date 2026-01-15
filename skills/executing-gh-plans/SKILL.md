---
name: executing-gh-plans
description: Use to execute GitHub Project tasks iteratively - mark in-progress, work through tasks, update status to Done, close epic when complete
---

<skill_overview>
Execute implementation tasks from GitHub Project epics continuously, updating task status from "To Do" → "In Progress" → "Done". Works through tasks prioritized by priority.
</skill_overview>

<rigidity_level>
RIGID PROCESS - Follow task-by-task execution pattern, update status in GitHub Project after each completion.

No shortcuts on status updates. Always reflect actual state in project.
</rigidity_level>

<quick_reference>

| Step | Action | Command |
|------|--------|---------|
| Load context | Project config | Load gh-project.json |
| List ready | Find To Do tasks | `gh project item-list --format json \| jq filter` |
| Select task | Pick by priority | Show ready tasks, user or agent selects |
| Update status | Mark In Progress | `gh project item-edit --single-select-option-id $IN_PROGRESS_ID` |
| Execute task | Follow implementation | Read task body, complete steps |
| Verify | Run tests | test-runner agent for verification |
| Update status | Mark Done | `gh project item-edit --single-select-option-id $DONE_ID` |
| Check epic | All tasks Done? | List tasks in epic, check status |
| Close epic | Mark Done | `gh project item-edit --single-select-option-id $DONE_ID` |

**Priority order for task selection:**
- P0 tasks first (critical path)
- Then P1 (high importance)
- Then P2 (medium)
- Finally P3 (low priority)

**Status transitions:**
- "To Do" → "In Progress" (when starting work)
- "In Progress" → "Done" (when completed)
- Can also use "Blocked" if dependencies fail
</quick_reference>

<when_to_use>
Use this skill when:
- Have written implementation plan with tasks in GitHub Project
- Ready to start implementing features
- Want to work through tasks systematically with status tracking
- User requests /hyperpowers:execute-gh-plan

**Prerequisites:**
- Project context must be set (hooks/context/gh-project.json exists)
- Epic must exist in project with linked tasks
- All tasks should have Status set to "To Do" initially

**Related skills:**
- writing-gh-plans (creates epics and tasks before execution)
- verification-before-completion (required before marking tasks done)
- test-driven-development (followed during implementation)
</when_to_use>

<the_process>

## 1. Verify Project Context and Epic Selection

**Load project configuration:**

```bash
if [ ! -f "hooks/context/gh-project.json" ]; then
    echo "ERROR: No GitHub Project context found."
    echo "Run /hyperpowers:set-gh-project to configure project."
    exit 1
fi

PROJECT_CONFIG=$(cat hooks/context/gh-project.json)

OWNER=$(echo $PROJECT_CONFIG | jq -r '.owner')
PROJECT_NUMBER=$(echo $PROJECT_CONFIG | jq -r '.projectNumber')
PROJECT_ID=$(echo $PROJECT_CONFIG | jq -r '.projectId')

STATUS_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.id')
STATUS_TODO_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options."To Do"')
STATUS_INPROGRESS_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options."In Progress"')
STATUS_DONE_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options.Done"')

EPIC_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Epic.id')
PRIORITY_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.id')

echo "Using project: $OWNER #$PROJECT_NUMBER"
```

**List available epics:**

```bash
# Get all items with Epic field not set (these are epics)
EPICS=$(gh project item-list \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --format json)

# Filter for epics (items without Epic field set)
EPICS_LIST=$(echo "$EPICS" | \
    jq '.[] | select(.fields[]?.name != "Epic" or .fields[]?.text == null or .fields[]?.text == "")')

echo "$EPICS_LIST" | jq -r '.content + " (ID: " + .id + ")"'
```

**Ask user to select epic:**
- "Which epic should I execute?"
- Options: Show all open epics

**Store selected epic ID:**
```bash
EPIC_ID="PRI_kwDOAIa5sc4_2g..."  # User selection
```

## 2. List Ready Tasks

**Get all tasks linked to epic with status "To Do":**

```bash
ALL_ITEMS=$(gh project item-list \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --format json)

# Filter: Status = To Do, Epic field = this epic
READY_TASKS=$(echo "$ALL_ITEMS" | \
    jq --arg epic_id "$EPIC_ID" \
    '.[] | select(
        .fields[]?.name == "Status" and
        .fields[]?.options?.name == "To Do" and
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )')

# Sort by priority (P0 > P1 > P2 > P3)
PRIORITY_ORDER='{"P0": 1, "P1": 2, "P2": 3, "P3": 4}'

READY_TASKS_SORTED=$(echo "$READY_TASKS" | \
    jq --argjson order "$PRIORITY_ORDER" \
    'sort_by(.fields[]?.name == "Priority" | .fields[]?.options?.name | $order[.])')

echo "Ready tasks in epic:"
echo "$READY_TASKS_SORTED" | jq -r '"\(.content) (Priority: \(.fields[]?.name == "Priority" | .fields[]?.options?.name // "None"))"'
```

**If no tasks ready:**
```bash
if [ -z "$READY_TASKS_SORTED" ] || [ "$READY_TASKS_SORTED" = "[]" ]; then
    echo "No tasks ready in this epic."
    echo "Check:"
    echo "  - Are all tasks marked as Done?"
    echo "  - Are tasks blocked on dependencies?"
    exit 0
fi
```

**Ask user for execution mode:**
- Options:
  - "Automatic - I'll work through tasks continuously"
  - "Interactive - Select task for me each time"
  - "Show me the ready tasks first"

## 3. For Each Task: Execute Loop

### 3a. Select Task

**Automatic mode:**
- Pick highest priority task (P0 first)
- Continue automatically

**Interactive mode:**
- Show ready tasks with priorities
- User selects which task to work on

### 3b. Mark Task In Progress

```bash
TASK_ID="PRI_kwDOAIa5sc4_3A..."  # Selected task
TASK_TITLE=$(echo "$ALL_ITEMS" | jq --arg task_id "$TASK_ID" -r '.[] | select(.id == $task_id) | .content')

echo "Starting task: $TASK_TITLE ($TASK_ID)"

# Update status to In Progress
gh project item-edit \
    --id $TASK_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_INPROGRESS_ID

echo "Task status updated to: In Progress"
```

### 3c. Read Task Details

**Fetch task body from GitHub Project:**

```bash
TASK_DETAILS=$(echo "$ALL_ITEMS" | jq --arg task_id "$TASK_ID" '.[] | select(.id == $task_id)')

TASK_BODY=$(echo "$TASK_DETAILS" | jq -r '.body')

echo "Task implementation steps:"
echo "$TASK_BODY"
```

### 3d. Execute Task Implementation

**Follow the task's implementation steps exactly:**

1. **Read success criteria** from task body
2. **Follow implementation steps** one by one
3. **Write/edit files** as specified
4. **Run verification commands** from task steps
5. **Test locally** before claiming complete

**Follow TDD if task requires:**
- Write test first
- Verify it fails
- Implement minimal code to pass
- Run tests to verify
- Refactor while green

**Example execution flow:**

```bash
# From task body: "Install jsonwebtoken package"
# Step 1: Run npm install
npm install jsonwebtoken @types/jsonwebtoken --save

# From task body: "Verify installation"
# Step 2: Check package.json
cat package.json | grep jsonwebtoken

# From task body: "Write login service"
# Step 3: Create file
mkdir -p src/services
cat > src/services/login.ts <<'EOF'
import jwt from 'jsonwebtoken';

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

export function verifyToken(token: string): any {
  return jwt.verify(token, process.env.JWT_SECRET);
}
EOF

# Continue through all steps...
```

**Track progress in TodoWrite:**

```bash
- [ ] Install jsonwebtoken package (completed)
- [ ] Verify installation (completed)
- [ ] Write login service (in progress)
- [ ] Write tests (pending)
```

### 3e. Verify Implementation

**CRITICAL: Before marking task as Done, verify completion.**

**Use test-runner agent for verification:**

```bash
# Use Task tool to dispatch test-runner agent
Task(
    subagent_type="hyperpowers:test-runner",
    prompt="Verify task completion: $TASK_TITLE

Run the following verification commands and report results:

1. npm test (or project's test command)
2. npm run lint (or project's lint command)
3. npm run build (if applicable)

Report:
- Which commands passed
- Which commands failed (with complete output)
- Exit codes for each command"
)
```

**Wait for agent results:**

**If all verification passes:**
- Proceed to mark task Done

**If any verification fails:**
- Do NOT mark task Done
- Fix the issue
- Re-run verification
- Use test-runner agent again

### 3f. Mark Task Done

**After verification passes:**

```bash
gh project item-edit \
    --id $TASK_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_DONE_ID

echo "Task marked as Done: $TASK_TITLE"
```

**Update TodoWrite:**
```bash
- [ ] All steps completed
```

### 3g. Continue to Next Task

**Check if more tasks ready:**

```bash
# Re-fetch ready tasks (some may have been unblocked)
READY_TASKS=$(gh project item-list \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '.[] | select(
        .fields[]?.name == "Status" and
        .fields[]?.options?.name == "To Do" and
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )'

if [ "$READY_TASKS" != "[]" ]; then
    # Continue to next task
    echo "Continuing to next ready task..."
    # Return to Step 3a
else
    echo "All tasks in epic completed!"
    # Proceed to Step 4
fi
```

## 4. Verify Epic Completion

**Check all tasks in epic:**

```bash
# Get all tasks linked to this epic
ALL_EPIC_TASKS=$(gh project item-list \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '.[] | select(
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )'

# Count tasks by status
TASK_COUNT=$(echo "$ALL_EPIC_TASKS" | jq 'length')
DONE_COUNT=$(echo "$ALL_EPIC_TASKS" | \
    jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "Done")] | length')
TODO_COUNT=$(echo "$ALL_EPIC_TASKS" | \
    jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "To Do")] | length')
INPROGRESS_COUNT=$(echo "$ALL_EPIC_TASKS" | \
    jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "In Progress")] | length')

echo "Epic Status:"
echo "  Total tasks: $TASK_COUNT"
echo "  Done: $DONE_COUNT"
echo "  To Do: $TODO_COUNT"
echo "  In Progress: $INPROGRESS_COUNT"
```

**If all tasks are Done:**

```bash
if [ "$DONE_COUNT" = "$TASK_COUNT" ] && [ "$INPROGRESS_COUNT" = "0" ]; then
    echo "Epic is complete! All tasks marked as Done."
    # Proceed to Step 5
else
    echo "Epic has remaining work. Use /hyperpowers:execute-gh-plan to continue."
    exit 0
fi
```

## 5. Close Epic

**Mark epic as Done:**

```bash
gh project item-edit \
    --id $EPIC_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_DONE_ID

echo "Epic marked as Done: $EPIC_ID"
```

**Update epic body with completion date:**

```bash
COMPLETION_DATE=$(date -u +"%Y-%m-%d")

# Get current epic body
EPIC_BODY=$(echo "$EPICS" | jq --arg epic_id "$EPIC_ID" -r '.[] | select(.id == $epic_id) | .body')

# Append completion note
UPDATED_BODY="$EPIC_BODY

## Completion
Epic completed on $COMPLETION_DATE.
All tasks successfully implemented and verified."

gh project item-edit \
    --id $EPIC_ID \
    --project-id $PROJECT_ID \
    --body "$UPDATED_BODY"

echo "Epic body updated with completion date"
```

## 6. Offer Next Steps

**After epic completion, offer:**
- "Ready to create PR for this epic?"
- "Ready to start work on another epic?"
- "Ready to run full verification before PR?"

**If user wants to create PR:**
- Use `finishing-a-development-branch` skill
- Creates PR, handles cleanup

**If user wants to verify:**
- Use `verification-before-completion` skill
- Runs full test suite, linters, builds

</the_process>

<examples>

<example>
<scenario>Executing tasks in automatic mode</scenario>

<code>
User: /hyperpowers:execute-gh-plan

Claude: Verifying project context...
Using project: withzombies/hyperpowers #1

Available epics:
- Epic: User Authentication (ID: PRI_kwDOAIa5sc4_2g...)
- Epic: Database Migration (ID: PRI_kwDOAIa5sc4_4g...)

Which epic should I execute?
User: Epic: User Authentication

Claude: Listing ready tasks in epic...
Ready tasks (sorted by priority):
1. Install JWT dependencies (Priority: P0)
2. Create User model (Priority: P0)
3. Create session model (Priority: P1)
4. POST /api/login endpoint (Priority: P1)
5. POST /api/logout endpoint (Priority: P2)
6. JWT validation middleware (Priority: P2)
...

Execution mode: "Automatic - I'll work through tasks continuously" or "Interactive - Select task each time"

User: Automatic

Claude: Starting task: Install JWT dependencies (PRI_kwDOAIa5sc4_3A...)

Task status updated to: In Progress

Task implementation steps:
## Background
Need JWT library for token generation and validation.

## Success Criteria
- [ ] jsonwebtoken installed
- [ ] npm install succeeds

## Implementation Steps

### Step 1: Install jsonwebtoken
\`\`\`bash
npm install jsonwebtoken @types/jsonwebtoken --save
\`\`\`

[Executing step 1...]
npm install jsonwebtoken @types/jsonwebtoken --save
added 2 packages in 3s

[Step 1 complete]
[Step 2: Verify installation...]
cat package.json | grep jsonwebtoken
"jsonwebtoken": "^9.0.0"

[All steps complete]

Verifying task completion...

[Dispatching test-runner agent...]

Agent results:
✓ npm test passed (47 tests, 0 failed)
✓ npm run lint passed (no errors)
✓ npm run build passed (built successfully)

Task marked as Done: Install JWT dependencies

Continuing to next ready task...

Starting task: Create User model (PRI_kwDOAIa5sc4_3B...)
Task status updated to: In Progress

[Continue through all tasks...]

All tasks in epic completed!

Epic Status:
  Total tasks: 11
  Done: 11
  To Do: 0
  In Progress: 0

Epic is complete! All tasks marked as Done.

Epic marked as Done: PRI_kwDOAIa5sc4_2g...
Epic body updated with completion date.

Next steps?
- Ready to create PR for this epic?
- Ready to start work on another epic?
- Ready to run full verification before PR?
</code>

<why_it_succeeds>
- Tasks worked in priority order (P0 first)
- Status updated in GitHub Project after each completion
- Verification before marking Done prevents incomplete work
- Automatic mode reduces user interaction overhead
- Epic closed when all tasks complete
</why_it_succeeds>
</example>

<example>
<scenario>Task verification fails, fixes issue</scenario>

<code>
User: /hyperpowers:execute-gh-plan

Claude: Starting task: POST /api/login endpoint (PRI_kwDOAIa5sc4_3D...)
Task status updated to: In Progress

[Implementation steps executed...]

Verifying task completion...

[Dispatching test-runner agent...]

Agent results:
✗ npm test failed (3 tests failed)
✓ npm run lint passed (no errors)
✓ npm run build passed

Test failures:
FAIL src/api/auth.test.ts:23: POST /api/login should return 200 on valid credentials
  Expected status 200, got 500

FAIL src/api/auth.test.ts:45: POST /api/login should return JWT token
  Expected token in response, got undefined

FAIL src/api/auth.test.ts:67: POST /api/login should return 401 on invalid credentials
  Expected status 401, got 200

Task NOT marked as Done. Fixing issues...

Investigating failure:
Looking at auth endpoint implementation...
Found issue: Missing password comparison logic

Fix:
Added password comparison with bcrypt:

// Before (broken):
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const token = generateToken(user.id);
    res.json({ token });
  }
});

// After (fixed):
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.passwordHash)) {
    const token = generateToken(user.id);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

Re-running verification...

[Dispatching test-runner agent...]

Agent results:
✓ npm test passed (47 tests, 0 failed)
✓ npm run lint passed (no errors)
✓ npm run build passed (built successfully)

Task marked as Done: POST /api/login endpoint
</code>

<why_it_succeeds>
- Task not marked Done until verification passes
- Investigates root cause of test failures
- Fixes implementation before marking complete
- Re-verifies after fix
- Ensures working code before moving to next task
</why_it_succeeds>
</example>

</examples>

<critical_rules>

## Rules That Have No Exceptions

1. **Always update status in GitHub Project** → Never skip status updates
   - To Do → In Progress (when starting)
   - In Progress → Done (when complete)
   - Never leave tasks in inconsistent state

2. **Verify before marking Done** → Never claim completion without evidence
   - Use test-runner agent for verification
   - Fix failures before marking Done
   - Re-verify after fixes

3. **Follow priority order** → P0 > P1 > P2 > P3
   - Critical path tasks first
   - No skipping to easier tasks
   - Respect dependencies

4. **Use TodoWrite for tracking** → Never lose track of progress
   - Mark steps complete as executed
   - Track which task is active
   - Clear when task completes

5. **Close epic when complete** → Don't leave hanging epics
   - All tasks Done? Close epic
   - Update epic body with completion date
   - Don't manually verify epic status

## Common Excuses

All of these mean: Stop, follow the skill properly.

- "Tests might fail, but implementation is done" (No, fix tests first)
- "I'll mark as Done and come back later" (No, verification required now)
- "Priority doesn't matter" (Yes it does, critical path first)
- "Status update isn't necessary" (Yes it is, GitHub Project is source of truth)
- "Can skip verification" (No, verification prevents bugs)

</critical_rules>

<verification_checklist>

After marking each task Done:

- [ ] Task implementation completed (all steps executed)
- [ ] Verification run via test-runner agent
- [ ] All verification commands passed (tests, lint, build)
- [ ] Task status updated to Done in GitHub Project
- [ ] TodoWrite task marked completed

Before closing epic:

- [ ] All tasks in epic marked Done
- [ ] No tasks in "To Do" or "In Progress" status
- [ ] Epic status updated to Done
- [ ] Epic body updated with completion date
- [ ] Full verification run (optional, via /hyperpowers:review-implementation)

Before finishing session:

- [ ] TodoWrite list cleared or completed
- [ ] GitHub Project reflects all work completed
- [ ] User offered next steps (PR, new epic, verification)

</verification_checklist>

<integration>

**This skill calls:**
- test-runner agent (REQUIRED for task verification)
- verification-before-completion (optional, for full epic verification)
- finishing-a-development-branch (optional, for PR creation)
- selecting-gh-project (if context missing/invalid)

**This skill is called by:**
- User via `/hyperpowers:execute-gh-plan` command
- After writing-gh-plans creates epic with tasks
- User wants to continue work on existing epic

**Prerequisites:**
- hooks/context/gh-project.json must exist
- Epic must exist in GitHub Project with linked tasks
- gh auth with project scope

**Agents used:**
- hyperpowers:test-runner (run tests/lints/builds without context pollution)

**Related skills:**
- writing-gh-plans (creates epics and tasks this skill executes)
- managing-gh-projects (modifies tasks/epics during execution)
- verification-before-completion (required before marking tasks/epics complete)

</integration>

<resources>

**Task execution guidance:**
- test-driven-development skill (follow TDD during implementation)
- debugging-with-tools skill (if tests fail, debug before marking Done)

**When stuck:**
- Task verification fails → Use debugging-with-tools to investigate
- Multiple tasks blocking → Use managing-gh-projects to check dependencies
- Status update fails → Check gh auth, run /hyperpowers:refresh-gh-project
- No tasks ready → Check if epic is complete or dependencies blocking

**Verification commands (typical):**
```bash
npm test              # Node.js
pytest               # Python
cargo test            # Rust
go test ./...         # Go
npm run lint         # Linters
npm run build        # Build verification
```

</resources>
