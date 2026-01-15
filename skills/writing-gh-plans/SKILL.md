---
name: writing-gh-plans
description: Use to create GitHub Project epic (plan) and linked tasks - detailed implementation steps, TDD where applicable
---

<skill_overview>
Create comprehensive implementation plans as GitHub Project epics with child tasks. Expands requirements into bite-sized (2-5 minute) steps with exact file paths, complete code examples, verification commands.
</skill_overview>

<rigidity_level>
MEDIUM FREEDOM - Follow task-by-task validation pattern, use codebase-investigator for verification.

Adapt implementation details to actual codebase state. Never use placeholders or meta-references.
</rigidity_level>

<quick_reference>

| Step | Action | Key Commands |
|------|--------|--------------|
| Verify context | Check project config | Load gh-project.json, fail if missing |
| Create epic | GitHub Project item | `gh project item-create --title "Epic: ..."` |
| Extract epic ID | From JSON response | Parse epic item ID from creation output |
| For each task | Create + link | `gh project item-create`, then `gh project item-edit` for fields |
| Set Epic field | Link to parent | `--field-id $EPIC_FIELD_ID --text "$EPIC_ITEM_ID"` |
| Set Status | Initial state | `--single-select-option-id $STATUS_TODO_ID` |
| Set Priority | Based on effort | `--single-select-option-id $PRIORITY_X_ID` |
| Verify creation | List items | `gh project item-list --format json | jq` |

**Task body format:**
- Background (what, why)
- Success Criteria (checkbox list)
- Implementation Steps (complete code, exact paths)
- Dependencies (other tasks)

**Epic body format:**
- Summary (high-level goal)
- Success Criteria (overall epic completion)
- Related Tasks (auto-generated)
</quick_reference>

<when_to_use>
Use this skill after brainstorming or sre-task-refinement when:
- Have spec or requirements for multi-step feature
- Need to create detailed implementation plan
- Want to break down work into trackable tasks
- Converting existing bd epic to GitHub Project

**Prerequisites:**
- Project context must be set (hooks/context/gh-project.json exists)
- Run `/hyperpowers:set-gh-project` first if needed
</when_to_use>

<the_process>

## 1. Verify Project Context

**Check for existing configuration:**

```bash
if [ ! -f "hooks/context/gh-project.json" ]; then
    echo "ERROR: No GitHub Project context found."
    echo "Run /hyperpowers:set-gh-project to configure project."
    exit 1
fi

# Load configuration
PROJECT_CONFIG=$(cat hooks/context/gh-project.json)

OWNER=$(echo $PROJECT_CONFIG | jq -r '.owner')
PROJECT_NUMBER=$(echo $PROJECT_CONFIG | jq -r '.projectNumber')
PROJECT_ID=$(echo $PROJECT_CONFIG | jq -r '.projectId')

EPIC_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Epic.id')
STATUS_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.id')
STATUS_TODO_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options."To Do"')

echo "Using project: $OWNER #$PROJECT_NUMBER"
echo "Project ID: $PROJECT_ID"
```

**Fail fast if context invalid:**

```bash
if [ -z "$PROJECT_ID" ] || [ -z "$EPIC_FIELD_ID" ]; then
    echo "ERROR: Invalid project configuration."
    echo "Run /hyperpowers:refresh-gh-project to update configuration."
    exit 1
fi
```

## 2. Create Epic Item

**Ask user for epic details:**
- Title: "What is the epic title?"
- Summary: "What is the high-level goal?"
- Success criteria: "What defines epic completion?"

**Create epic in GitHub Project:**

```bash
EPIC_TITLE="Epic: User Authentication"
EPIC_BODY="## Summary
Implement secure user authentication with JWT tokens.

## Success Criteria
- [ ] Users can login with email/password
- [ ] JWT tokens generated on successful login
- [ ] Tokens validated on protected routes
- [ ] Session management handles expiration
- [ ] All tests pass

## Related Tasks
(Will be populated as tasks are created)
"

EPIC_OUTPUT=$(gh project item-create \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --title "$EPIC_TITLE" \
    --body "$EPIC_BODY" \
    --format json)

# Extract epic item ID from response
EPIC_ITEM_ID=$(echo $EPIC_OUTPUT | jq -r '.id')

echo "Created epic: $EPIC_ITEM_ID"
```

**Verify epic creation:**

```bash
if [ -z "$EPIC_ITEM_ID" ] || [ "$EPIC_ITEM_ID" = "null" ]; then
    echo "ERROR: Failed to create epic item."
    echo "Response: $EPIC_OUTPUT"
    exit 1
fi
```

## 3. Define Task Structure

**For implementation, create tasks in logical groups:**

**Common task categories:**
- Setup/Configuration (dependencies, environment)
- Database (models, migrations)
- API (endpoints, routes)
- Frontend (components, forms, state)
- Testing (unit tests, integration tests)
- Documentation (README, API docs)

**Example task breakdown for authentication:**
1. Setup: Install JWT dependencies
2. Database: Create User model with password hash
3. Database: Create session model
4. API: POST /api/login endpoint
5. API: POST /api/logout endpoint
6. API: Token validation middleware
7. Frontend: Login form component
8. Frontend: Logout button
9. Testing: Unit tests for auth service
10. Testing: Integration tests for login endpoint
11. Testing: Integration tests for logout endpoint

## 4. For Each Task: Create and Link

### 4a. Mark Task In Progress

```bash
# In TodoWrite: Mark current task as in_progress
```

### 4b. Verify Codebase State

**CRITICAL: Use codebase-investigator agent, NEVER verify yourself.**

**Provide agent with task assumptions:**
```
Task: "Install JWT dependencies"

Assumptions:
- Project is Node.js with npm
- package.json exists in project root
- Currently not using any JWT library

Verify:
1. Does package.json exist?
2. What is currently installed?
3. Any auth-related packages?
4. Project uses TypeScript or JavaScript?

Report what exists vs what task expects.
```

**Based on investigator report:**
- ✓ Confirmed assumptions → Use in implementation
- ✗ Incorrect assumptions → Adjust task to match reality
- + Found additional → Document and incorporate

### 4c. Draft Task Implementation Steps

**Bite-sized granularity (2-5 minutes per step):**

For new features (follow test-driven-development):
1. Write the failing test (one step)
2. Run it to verify it fails (one step)
3. Implement minimal code to pass (one step)
4. Run tests to verify they pass (one step)
5. Commit (one step)

**Include in each step:**
- Exact file path
- Complete code example (not pseudo-code)
- Exact command to run
- Expected output

### 4d. Create Task Item in GitHub Project

**Task title format:**
- Specific, action-oriented
- "Add login form validation" (not "Form work")
- "Create JWT middleware" (not "Auth setup")
- "Write login endpoint tests" (not "Testing")

**Task body format:**

```bash
TASK_TITLE="Install JWT dependencies"

TASK_BODY="## Background
Need JWT library for token generation and validation.
Currently project has no auth dependencies.

## Success Criteria
- [ ] jsonwebtoken installed
- [ ] Added to package.json
- [ ] npm install succeeds

## Implementation Steps

### Step 1: Install jsonwebtoken package
\`\`\`bash
npm install jsonwebtoken --save
\`\`\`

**Expected output:**
```
added 1 package in 2s
```

### Step 2: Verify installation
\`\`\`bash
cat package.json | grep jsonwebtoken
\`\`\`

**Expected output:**
\`\`\`json
\"jsonwebtoken\": \"^9.0.0\"
\`\`\`

## Dependencies
- None (first task)

## Epic
$EPIC_ITEM_ID
"

# Create task WITHOUT Epic field initially
TASK_OUTPUT=$(gh project item-create \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --title "$TASK_TITLE" \
    --body "$TASK_BODY" \
    --format json)

# Extract task item ID
TASK_ITEM_ID=$(echo $TASK_OUTPUT | jq -r '.id')

echo "Created task: $TASK_ITEM_ID - $TASK_TITLE"
```

### 4e. Link Task to Epic

**Set Epic field to link task:**

```bash
gh project item-edit \
    --id $TASK_ITEM_ID \
    --field-id $EPIC_FIELD_ID \
    --project-id $PROJECT_ID \
    --text "$EPIC_ITEM_ID"

echo "Linked task to epic: $EPIC_ITEM_ID"
```

### 4f. Set Initial Status and Priority

**Set Status to "To Do":**

```bash
gh project item-edit \
    --id $TASK_ITEM_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_TODO_ID
```

**Set Priority (based on task effort/risk):**

```bash
# Load priority option IDs from config
PRIORITY_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.id')
PRIORITY_P1_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.options.P1')

# Example: Set P1 for important task
gh project item-edit \
    --id $TASK_ITEM_ID \
    --field-id $PRIORITY_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $PRIORITY_P1_ID
```

**Priority guidelines:**
- P0: Critical, must complete for epic to work
- P1: High, important for feature completion
- P2: Medium, nice to have but not blocking
- P3: Low, can defer or skip

### 4g. Present COMPLETE Task to User

**CRITICAL: Show the full task BEFORE asking for approval.**

**Format:**
```markdown
**Task: Install JWT dependencies**

**From epic:**
- Epic: User Authentication ($EPIC_ITEM_ID)
- Goal: Implement secure user authentication

**Codebase verification findings:**
- ✓ Confirmed: package.json exists, Node.js project
- ✗ Incorrect: Expected empty dependencies, actually found bcrypt
- + Found: Project uses TypeScript

**Task body:**

## Background
Need JWT library for token generation and validation.
Currently project has bcrypt for password hashing, needs JWT for tokens.

## Success Criteria
- [ ] jsonwebtoken installed
- [ ] Added to package.json
- [ ] npm install succeeds
- [ ] TypeScript types installed (@types/jsonwebtoken)

## Implementation Steps

### Step 1: Install jsonwebtoken with TypeScript types
\`\`\`bash
npm install jsonwebtoken @types/jsonwebtoken --save
\`\`\`

**Expected output:**
```
added 2 packages in 3s
```

### Step 2: Verify installation in package.json
\`\`\`bash
cat package.json | grep -A1 -B1 "jsonwebtoken"
\`\`\`

**Expected output:**
\`\`\`json
"dependencies": {
  "jsonwebtoken": "^9.0.0"
},
"devDependencies": {
  "@types/jsonwebtoken": "^9.0.0"
}
\`\`\`

## Dependencies
- None (first task)

## Epic
$EPIC_ITEM_ID
```

**THEN ask for approval:**
"Is this task ready to create in GitHub Project?"

- "Yes - create task and continue to next"
- "Needs revision"
- "Other"
```

### 4h. If Approved: Create Task and Continue

```bash
# Create task (Steps 4d-4f)
gh project item-create ...
gh project item-edit --field-id Epic ...
gh project item-edit --field-id Status ...
gh project item-edit --field-id Priority ...

# Mark completed in TodoWrite
# IMMEDIATELY continue to next task (NO asking permission)
```

### 4i. If Needs Revision: Iterate

- Keep as in_progress in TodoWrite
- Revise based on feedback
- Present again (Step 4g)

## 5. Update Epic with Task List

**After all tasks created, update epic body:**

```bash
# Get all tasks for this epic
TASKS=$(gh project item-list \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --format json)

# Filter tasks where Epic field matches this epic
EPIC_TASKS=$(echo "$TASKS" | \
    jq --arg epic_id "$EPIC_ITEM_ID" \
    '.[] | select(.fields[]?.id == $epic_id or .fields[]?.name == "Epic" and .fields[]?.text == $epic_id)')

# Format task list
TASK_LIST=$(echo "$EPIC_TASKS" | jq -r '.[] | "- " + .content')

# Update epic body
EPIC_BODY="## Summary
Implement secure user authentication with JWT tokens.

## Success Criteria
- [ ] Users can login with email/password
- [ ] JWT tokens generated on successful login
- [ ] Tokens validated on protected routes
- [ ] Session management handles expiration
- [ ] All tests pass

## Related Tasks
$TASK_LIST"

# Update epic item
gh project item-edit \
    --id $EPIC_ITEM_ID \
    --project-id $PROJECT_ID \
    --body "$EPIC_BODY"

echo "Epic updated with task list"
```

## 6. Complete

```bash
echo "Epic created: $EPIC_ITEM_ID"
echo "Tasks created and linked to epic."
echo "Ready to execute plan with /hyperpowers:execute-gh-plan"

# Show epic details
gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg epic_id "$EPIC_ITEM_ID" \
    '.[] | select(.id == $epic_id)'
```

**Offer execution:**
"Ready to execute tasks? Use /hyperpowers:execute-gh-plan to work through implementation."

</the_process>

<examples>

<example>
<scenario>Creating epic with multiple tasks</scenario>

<code>
User: /hyperpowers:write-gh-plan

Claude: Verifying project context...
Using project: withzombies/hyperpowers #1
Project ID: PR_kwDOAIa5sc4...

Creating epic...
Title: Epic: User Authentication
Summary: Implement secure user authentication with JWT tokens

gh project item-create 1 --owner withzombies --title "Epic: User Authentication" --body "..." --format json
Created epic: PRI_kwDOAIa5sc4_2g...

Epic item ID: PRI_kwDOAIa5sc4_2g...

Defining tasks...
Total tasks: 11
- Setup: Install JWT dependencies
- Database: Create User model
- Database: Create session model
- API: POST /api/login
- API: POST /api/logout
- ...

Creating task 1: Install JWT dependencies...
Codebase investigation:
- ✓ Confirmed: package.json exists
- + Found: Project uses TypeScript
- + Found: bcrypt already installed

Task body adjusted for TypeScript:
## Background
Need JWT library for token generation.
Project has bcrypt for passwords, needs JWT for tokens.

## Success Criteria
- [ ] jsonwebtoken installed
- [ ] TypeScript types installed
- [ ] npm install succeeds

## Implementation Steps

### Step 1: Install jsonwebtoken with types
\`\`\`bash
npm install jsonwebtoken @types/jsonwebtoken --save
\`\`\`

...

Is this task ready to create?

User: Yes - create task and continue to next

Claude: Creating task in GitHub Project...
gh project item-create 1 --owner withzombies --title "Install JWT dependencies" --body "..." --format json
Task item ID: PRI_kwDOAIa5sc4_3A...

Linking to epic...
gh project item-edit --id PRI_kwDOAIa5sc4_3A... --field-id ... --text "PRI_kwDOAIa5sc4_2g..."
Linked.

Setting status: To Do
Setting priority: P1

Task created: Install JWT dependencies

Creating task 2: Create User model...
...
[Continues for all 11 tasks]

All tasks created and linked to epic.

Updating epic with task list...
gh project item-edit --id PRI_kwDOAIa5sc4_2g... --body "..."
Epic updated.

Epic created with 11 tasks.
Ready to execute: /hyperpowers:execute-gh-plan
</code>

<why_it_succeeds>
- All tasks have complete implementation details
- No placeholders or meta-references
- Tasks linked to epic via Epic field
- Status and priority set correctly
- Epic body shows complete task list
- Ready for execution with zero context
</why_it_succeeds>
</example>

<example>
<scenario>Task uses placeholder instead of actual steps</scenario>

<code>
User: /hyperpowers:write-gh-plan

Claude: Creating task: Add login form

Task body:
## Background
User needs to login.

## Success Criteria
- [ ] Login form works

## Implementation Steps
[Full implementation steps as detailed above]
[Complete code examples will be added here]
[See success criteria for what to implement]

Is this task ready to create?

User: No - placeholders detected

Claude: Correct. Let me write actual implementation steps.

Revised task body:
## Background
User needs to login with email and password.
Project uses React with TypeScript.

## Success Criteria
- [ ] Login form renders email field
- [ ] Login form renders password field
- [ ] Submit button triggers login API call
- [ ] Error messages display on failure

## Implementation Steps

### Step 1: Create login form component
\`\`\`tsx
// src/components/LoginForm.tsx
import React, { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Call login API
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
\`\`\`

### Step 2: Add LoginForm to App component
\`\`\`tsx
// src/App.tsx
import { LoginForm } from './components/LoginForm';

export default function App() {
  return (
    <div>
      <h1>Welcome</h1>
      <LoginForm />
    </div>
  );
}
\`\`\`

...

Is this task ready to create?

User: Yes - create task and continue

Claude: Task created with complete code.
</code>

<why_it_succeeds>
- No placeholders or meta-references
- Complete, executable code provided
- Exact file paths
- Can be implemented without context
</why_it_succeeds>
</example>

</examples>

<critical_rules>

## Rules That Have No Exceptions

1. **No placeholders or meta-references** → Write actual content
   - ❌ FORBIDDEN: `[Full implementation steps as detailed above]`
   - ✅ REQUIRED: Complete code, exact paths, real commands

2. **Use codebase-investigator agent** → Never verify yourself
   - Agent gets task assumptions
   - Agent reports discrepancies
   - You adjust plan to match reality

3. **Present COMPLETE task before asking** → User must SEE before approving
   - Show full task in message text
   - Then ask for approval
   - Never ask without showing first

4. **Link tasks to epic** → Always set Epic field
   - Epic field ID from cached config
   - Epic item ID from creation response
   - Include epic ID in task body for reference

5. **Set status and priority** → Never leave items unset
   - Status: "To Do" for all new tasks
   - Priority: Based on effort/risk (P0-P3)

6. **Continue automatically between tasks** → Don't ask permission
   - TodoWrite list IS your plan
   - Execute it completely
   - Only ask: (a) task validation, (b) final execution choice

## Common Excuses

All of these mean: Stop, write actual content:

- "I'll add the details later"
- "The implementation is obvious from the goal"
- "See above for the steps"
- "User can figure out the code"
- "Task is self-explanatory"

</critical_rules>

<verification_checklist>

Before marking each task complete in TodoWrite:
- [ ] Used codebase-investigator agent (not manual verification)
- [ ] Presented COMPLETE task to user (showed full text)
- [ ] User approved task (via question)
- [ ] Created task in GitHub Project
- [ ] Linked task to epic via Epic field
- [ ] Set status to "To Do"
- [ ] Set priority (P0-P3)
- [ ] No placeholders or meta-references in task body

Before finishing all tasks:
- [ ] All tasks in TodoWrite marked completed
- [ ] All tasks created in GitHub Project
- [ ] All tasks linked to epic
- [ ] Epic body updated with task list
- [ ] Complete code examples in all steps
- [ ] Exact file paths and commands throughout

</verification_checklist>

<integration>

**This skill calls:**
- codebase-investigator agent (REQUIRED for each task verification)
- selecting-gh-project (if context missing/invalid)

**This skill is called by:**
- User via `/hyperpowers:write-gh-plan` command
- After brainstorming creates epic concept
- After sre-task-refinement refines requirements

**Prerequisites:**
- hooks/context/gh-project.json must exist
- Run `/hyperpowers:set-gh-project` first
- gh auth with project scope

**Agents used:**
- hyperpowers:codebase-investigator (verify assumptions, report discrepancies)

**Related skills:**
- executing-gh-plans (implements tasks created by this skill)
- managing-gh-projects (modifies tasks/epics created by this skill)

</integration>

<resources>

**Guidance for task breakdown:**
- Test-driven-development skill (follow TDD for new features)
- resources/task-examples.md (if exists in codebase)

**When stuck:**
- Unsure about file structure → Use codebase-investigator
- Don't know priority guidelines → P0: critical path, P1: important, P2: nice to have, P3: defer
- Tempted to write placeholder → Stop, write actual content
- Want to ask permission → Check: Is this task validation or final choice? If neither, don't ask

**Epic body format:**
```markdown
## Summary
[High-level goal - 2-3 sentences]

## Success Criteria
- [ ] [Specific, measurable outcome]
- [ ] [Another outcome]
- [ ] [Final outcome]

## Related Tasks
- [Generated automatically from task list]
```

**Task body format:**
```markdown
## Background
[What, why, context]

## Success Criteria
- [ ] [Specific outcome]
- [ ] [Another outcome]

## Implementation Steps

### Step N: [Action]
[Complete code, exact paths, commands]

## Dependencies
- [Task IDs this depends on]

## Epic
[EPIC_ITEM_ID]
```

</resources>
