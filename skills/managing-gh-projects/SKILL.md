---
name: managing-gh-projects
description: Use for advanced GitHub Project operations - splitting tasks, merging duplicates, changing dependencies, archiving epics, querying metrics, retagging
---

<skill_overview>
Advanced GitHub Project operations for managing complex task structures; GitHub Project is single source of truth, keep it accurate.
</skill_overview>

<rigidity_level>
HIGH FREEDOM - These are operational patterns, not rigid workflows. Adapt operations to your specific situation while following core principles (keep project accurate, merge don't delete, document changes).
</rigidity_level>

<quick_reference>

| Operation | When | Key Commands |
|-----------|------|--------------|
| Split task | Task too large mid-flight | Create subtasks, set Epic field, mark parent Blocked |
| Merge duplicates | Found duplicate tasks | Combine designs, move deps, close duplicate with reference |
| Change status | Task status incorrect | `gh project item-edit --single-select-option-id` |
| Change priority | Task priority wrong | `gh project item-edit --single-select-option-id` |
| Archive epic | Epic complete, hide from views | `gh project item-edit --single-select-option-id $DONE_ID` |
| Query metrics | Need status/velocity data | `gh project item-list` + jq filters |
| Cross-epic deps | Task depends on other epic | Set Epic field, but also note other epic's tasks |
| Bulk updates | Multiple tasks need same change | Loop with careful review first |
| Recover mistakes | Wrong status/priority/epic | `gh project item-edit` to fix |

**Core principle:** Track all work in GitHub Project, update as you go, never batch updates.
</quick_reference>

<when_to_use>
Use this skill for **advanced** GitHub Project operations:
- Split task that's too large (discovered mid-implementation)
- Merge duplicate tasks
- Change status/priority after work started
- Archive completed epics (hide from views, keep history)
- Query GitHub Project for metrics (velocity, progress, bottlenecks)
- Manage cross-epic dependencies
- Bulk status/priority updates
- Recover from project mistakes

**For basic operations:** See writing-gh-plans and executing-gh-plans skills
</when_to_use>

<the_process>

## 1. Verify Project Context

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
STATUS_BLOCKED_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options.Blocked"')
STATUS_DONE_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options.Done"')

EPIC_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Epic.id')
PRIORITY_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.id')
```

**Ask user for operation:**
- Options: "Split task", "Merge tasks", "Change status", "Change priority", "Archive epic", "Query metrics", "Other"

## Operation 1: Splitting Tasks Mid-Flight

**When:** Task in-progress but turns out too large.

### Step 1: Read Current Task Details

```bash
TASK_ID="PRI_kwDOAIa5sc4_3A..."  # User provides task ID

TASK_DETAILS=$(gh project item-list \
    $PROJECT_NUMBER \
    --owner $OWNER \
    --format json | \
    jq --arg task_id "$TASK_ID" \
    '.[] | select(.id == $task_id)')

TASK_TITLE=$(echo "$TASK_DETAILS" | jq -r '.content')
TASK_BODY=$(echo "$TASK_DETAILS" | jq -r '.body')
TASK_EPIC=$(echo "$TASK_DETAILS" | jq -r '.fields[]? | select(.name == "Epic") | .text')
TASK_STATUS=$(echo "$TASK_DETAILS" | jq -r '.fields[]? | select(.name == "Status") | .options[]?.name')
```

### Step 2: Create Subtasks for Remaining Work

**Ask user:**
- "What are the remaining work items?"
- "Break down into subtasks..."

**Example subtask breakdown:**

```bash
# Original task: "Implement authentication" (already in progress)
# Already completed: Login form
# Remaining work gets split:

# Subtask 1: Auth API endpoints
SUBTASK1_BODY="## Background
Need login/logout API endpoints with JWT tokens.

## Success Criteria
- [ ] POST /api/login validates credentials, returns JWT
- [ ] POST /api/logout invalidates token
- [ ] Tests pass

## Implementation Steps
[Complete steps...]

## Epic
$TASK_EPIC"

gh project item-create $PROJECT_NUMBER --owner $OWNER \
    --title "Auth API endpoints" --body "$SUBTASK1_BODY" --format json

SUBTASK1_ID=$(echo $OUTPUT | jq -r '.id')

# Set Epic field to link to parent epic
gh project item-edit --id $SUBTASK1_ID \
    --field-id $EPIC_FIELD_ID --project-id $PROJECT_ID --text "$TASK_EPIC"

# Set Status and Priority
gh project item-edit --id $SUBTASK1_ID \
    --field-id $STATUS_FIELD_ID --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_TODO_ID

gh project item-edit --id $SUBTASK1_ID \
    --field-id $PRIORITY_FIELD_ID --project-id $PROJECT_ID \
    --single-select-option-id $PRIORITY_P1_ID

# Repeat for remaining subtasks...
```

### Step 3: Update Original Task and Mark as Blocked

```bash
UPDATED_BODY="$TASK_BODY

## Status
✓ Completed: Login form (in progress when split)
✗ Remaining work split into subtasks:
  - $SUBTASK1_ID: Auth API endpoints (do first)
  - $SUBTASK2_ID: Session management (depends on $SUBTASK1_ID)
  - $SUBTASK3_ID: Password hashing (do first)

## Success Criteria
- [x] Login form renders
- [ ] See subtasks for remaining criteria

## Dependencies
- Subtasks handle remaining work
"

# Update task body
gh project item-edit \
    --id $TASK_ID \
    --project-id $PROJECT_ID \
    --body "$UPDATED_BODY"

# Mark as Blocked
gh project item-edit \
    --id $TASK_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_BLOCKED_ID

echo "Task split. Original marked as Blocked, subtasks created."
```

### Step 4: Work on Subtasks in Order

```bash
# Ready tasks now shows subtasks
gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg epic_id "$TASK_EPIC" \
    '.[] | select(
        .fields[]?.name == "Status" and
        .fields[]?.options?.name == "To Do" and
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )'

# Work on subtasks via executing-gh-plans skill
```

---

## Operation 2: Merging Duplicate Tasks

**When:** Discovered two tasks are same thing.

### Step 1: Identify Duplicate Tasks

```bash
# User provides task IDs
TASK1_ID="PRI_kwDOAIa5sc4_3A..."
TASK2_ID="PRI_kwDOAIa5sc4_3B..."

# Get both task details
TASK1=$(gh project item-list ... | jq --arg id "$TASK1_ID" '.[] | select(.id == $id)')
TASK2=$(gh project item-list ... | jq --arg id "$TASK2_ID" '.[] | select(.id == $id)')

echo "Task 1: $(echo $TASK1 | jq -r '.content')"
echo "Task 2: $(echo $TASK2 | jq -r '.content')"
```

### Step 2: Choose Which to Keep

**Based on:**
- Which has more complete design?
- Which has more work done?
- Which has more dependencies?

**Example:** Keep TASK1

### Step 3: Merge Designs

```bash
# Read both bodies
BODY1=$(echo $TASK1 | jq -r '.body')
BODY2=$(echo $TASK2 | jq -r '.body')

# Combine into TASK1
MERGED_BODY="$BODY1

## Background
Originally tracked as $TASK1_ID and $TASK2_ID (now merged).

## Notes from $TASK2_ID
[Extract unique info from BODY2]

## Success Criteria
[Combined criteria from both]

## Dependencies
[All dependencies from both tasks]
"

gh project item-edit \
    --id $TASK1_ID \
    --project-id $PROJECT_ID \
    --body "$MERGED_BODY"

echo "Tasks merged. $TASK1_ID now contains combined information."
```

### Step 4: Move Dependencies (if any)

```bash
# Check if TASK2 has dependents
ALL_ITEMS=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json)

# Find items that mention TASK2_ID in body/body
DEPENDENTS=$(echo "$ALL_ITEMS" | \
    jq --arg task_id "$TASK2_ID" \
    '.[] | select(.body | contains($task_id))')

if [ "$DEPENDENTS" != "[]" ]; then
    echo "Updating dependent tasks..."

    echo "$DEPENDENTS" | jq -r '.[] | .id' | while read DEP_ID; do
        # Update body to reference TASK1_ID instead
        DEP_BODY=$(echo "$ALL_ITEMS" | jq --arg id "$DEP_ID" '.[] | select(.id == $id) | .body')
        UPDATED_BODY=$(echo "$DEP_BODY" | sed "s/$TASK2_ID/$TASK1_ID/g")

        gh project item-edit \
            --id $DEP_ID \
            --project-id $PROJECT_ID \
            --body "$UPDATED_BODY"

        echo "Updated dependency: $DEP_ID"
    done
fi
```

### Step 5: Close Duplicate with Reference

```bash
gh project item-edit \
    --id $TASK2_ID \
    --project-id $PROJECT_ID \
    --body "DUPLICATE: Merged into $TASK1_ID

This task was duplicate of $TASK1_ID. All work tracked there."

# Mark as Done
gh project item-edit \
    --id $TASK2_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_DONE_ID

echo "Duplicate $TASK2_ID marked as Done with reference to $TASK1_ID"
```

---

## Operation 3: Changing Status/Priority

**When:** Status or priority were wrong or requirements changed.

### Change Status

```bash
TASK_ID="PRI_kwDOAIa5sc4_3A..."
NEW_STATUS="In Progress"  # To Do, In Progress, Blocked, Done

# Get option ID for new status
STATUS_OPTION_ID=$(echo $PROJECT_CONFIG | \
    jq -r '.fields.Status.options["'"$NEW_STATUS"'"]')

gh project item-edit \
    --id $TASK_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_OPTION_ID

echo "Task $TASK_ID status updated to: $NEW_STATUS"
```

### Change Priority

```bash
NEW_PRIORITY="P2"  # P0, P1, P2, P3

PRIORITY_OPTION_ID=$(echo $PROJECT_CONFIG | \
    jq -r '.fields.Priority.options["'"$NEW_PRIORITY"'"]')

gh project item-edit \
    --id $TASK_ID \
    --field-id $PRIORITY_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $PRIORITY_OPTION_ID

echo "Task $TASK_ID priority updated to: $NEW_PRIORITY"
```

---

## Operation 4: Archiving Completed Epics

**When:** Epic complete, want to hide from default views but keep history.

```bash
EPIC_ID="PRI_kwDOAIa5sc4_2g..."

# Verify all tasks closed
ALL_EPIC_TASKS=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '.[] | select(
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )')

DONE_COUNT=$(echo "$ALL_EPIC_TASKS" | \
    jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "Done")] | length')

TODO_COUNT=$(echo "$ALL_EPIC_TASKS" | \
    jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "To Do")] | length')

echo "Epic tasks: Done=$DONE_COUNT, To Do=$TODO_COUNT"

if [ "$TODO_COUNT" = "0" ]; then
    # Archive epic
    COMPLETION_DATE=$(date -u +"%Y-%m-%d")

    EPIC_BODY=$(echo "$ALL_EPIC_TASKS" | \
        jq --arg epic_id "$EPIC_ID" \
        '.[] | select(.id == $epic_id) | .body')

    UPDATED_BODY="$EPIC_BODY

## Archived
Epic completed on $COMPLETION_DATE.
Archived to hide from default views.
All $DONE_COUNT tasks successfully completed."

    gh project item-edit \
        --id $EPIC_ID \
        --project-id $PROJECT_ID \
        --body "$UPDATED_BODY"

    gh project item-edit \
        --id $EPIC_ID \
        --field-id $STATUS_FIELD_ID \
        --project-id $PROJECT_ID \
        --single-select-option-id $STATUS_DONE_ID

    echo "Epic archived: $EPIC_ID"
else
    echo "Epic has $TODO_COUNT open tasks. Cannot archive."
fi
```

---

## Operation 5: Querying for Metrics

### Velocity

```bash
# Tasks closed this week (approximate via updatedAt)
WEEK_AGO=$(date -u -d '7 days ago' +"%Y-%m-%dT%H:%M:%SZ")

CLOSED_WEEK=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg week_ago "$WEEK_AGO" \
    '[.[] | select(
        .fields[]?.name == "Status" and
        .fields[]?.options?.name == "Done" and
        .updatedAt >= $week_ago
    )]')

echo "Tasks closed this week: $(echo $CLOSED_WEEK | jq 'length')"
```

### Blocked vs Ready

```bash
# Ready to work on (Status = To Do, Epic field set = this epic)
READY=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq '[.[] | select(
        .fields[]?.name == "Status" and
        .fields[]?.options?.name == "To Do"
    )]')

# Blocked (Status = Blocked)
BLOCKED=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq '[.[] | select(
        .fields[]?.name == "Status" and
        .fields[]?.options?.name == "Blocked"
    )]')

echo "Ready tasks: $(echo $READY | jq 'length')"
echo "Blocked tasks: $(echo $BLOCKED | jq 'length')"
```

### Epic Progress

```bash
EPIC_ID="PRI_kwDOAIa5sc4_2g..."

# Get all tasks in epic
EPIC_TASKS=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '[.[] | select(
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )]')

TOTAL=$(echo $EPIC_TASKS | jq 'length')
DONE=$(echo $EPIC_TASKS | \
    jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "Done")] | length')

PERCENTAGE=$(echo "scale=1; $DONE * 100 / $TOTAL" | bc)

echo "Epic progress: $DONE/$TOTAL ($PERCENTAGE%)"
```

---

## Operation 6: Cross-Epic Dependencies

**When:** Task in one epic depends on task in different epic.

```bash
TASK_ID="PRI_kwDOAIa5sc4_3A..."  # Task in Epic A
DEPENDENCY_ID="PRI_kwDOAIa5sc4_4B..."  # Task in Epic B

# Get epic ID for dependency
DEP_EPIC_ID=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg dep_id "$DEPENDENCY_ID" \
    '.[] | select(.id == $dep_id) | .fields[] | select(.name == "Epic") | .text')

TASK_BODY=$(gh project item-list ... | jq --arg id "$TASK_ID" '.[] | select(.id == $id) | .body')

UPDATED_BODY="$TASK_BODY

## Dependencies
- $DEPENDENCY_ID (from epic $DEP_EPIC_ID)

## Cross-Epic Dependency Note
This task depends on task in another epic. Ensure $DEP_EPIC_ID epic is completed or coordinate with that epic's work.
"

gh project item-edit \
    --id $TASK_ID \
    --project-id $PROJECT_ID \
    --body "$UPDATED_BODY"

echo "Updated task with cross-epic dependency reference"
```

---

## Operation 7: Bulk Status Updates

**When:** Need to update multiple tasks.

```bash
# Example: Mark all test tasks in epic as Done
EPIC_ID="PRI_kwDOAIa5sc4_2g..."

# Get tasks with "test" in title
TEST_TASKS=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '[.[] | select(
        .content | contains("test") and
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )]')

echo "Found $(echo $TEST_TASKS | jq 'length') test tasks to update"

# Review list
echo "$TEST_TASKS" | jq -r '.content'

# Ask for confirmation
# "Mark these tasks as Done?"

# Update each
echo "$TEST_TASKS" | jq -r '.id' | while read TASK_ID; do
    gh project item-edit \
        --id $TASK_ID \
        --field-id $STATUS_FIELD_ID \
        --project-id $PROJECT_ID \
        --single-select-option-id $STATUS_DONE_ID

    echo "Updated: $TASK_ID"
done

echo "Bulk update complete. Verify tasks:"
gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '[.[] | select(
        .content | contains("test") and
        .fields[]?.name == "Epic" and
        .fields[]?.text == $epic_id
    )] | .[] | "\(.content): \(.fields[]? | select(.name == "Status") | .options[]?.name)"'
```

---

## Operation 8: Recovering from Mistakes

### Wrong Status

```bash
TASK_ID="PRI_kwDOAIa5sc4_3A..."
NEW_STATUS="To Do"  # Was incorrectly set to Done

STATUS_OPTION_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options["'"$NEW_STATUS"'"]')

gh project item-edit \
    --id $TASK_ID \
    --field-id $STATUS_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $STATUS_OPTION_ID
```

### Wrong Priority

```bash
PRIORITY_OPTION_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.options."P2"')

gh project item-edit \
    --id $TASK_ID \
    --field-id $PRIORITY_FIELD_ID \
    --project-id $PROJECT_ID \
    --single-select-option-id $PRIORITY_OPTION_ID
```

### Wrong Epic Assignment

```bash
TASK_ID="PRI_kwDOAIa5sc4_3A..."
CORRECT_EPIC_ID="PRI_kwDOAIa5sc4_2g..."

gh project item-edit \
    --id $TASK_ID \
    --field-id $EPIC_FIELD_ID \
    --project-id $PROJECT_ID \
    --text "$CORRECT_EPIC_ID"
```

</the_process>

<examples>

<example>
<scenario>Split large task mid-implementation</scenario>

<code>
User: This task is too big, need to split it

Claude: Which task needs splitting?
User: PRI_kwDOAIa5sc4_3A (Implement authentication)

Claude: Task details:
- Title: Implement authentication
- Status: In Progress
- Epic: PRI_kwDOAIa5sc4_2g...

What are the remaining work items? Break into subtasks...

User: Remaining:
1. Auth API endpoints (login, logout)
2. Session management
3. Password hashing
4. JWT token generation

Claude: Creating subtasks...

Subtask 1: Auth API endpoints
gh project item-create ... -> PRI_kwDOAIa5sc4_3C...
Linked to epic: PRI_kwDOAIa5sc4_2g...
Status: To Do, Priority: P1

Subtask 2: Session management
gh project item-create ... -> PRI_kwDOAIa5sc4_3D...
Linked to epic: PRI_kwDOAIa5sc4_2g...
Status: To Do, Priority: P2

[Creating 3 more subtasks...]

Updating original task:
gh project item-edit ... --body "...split into subtasks..."
Marked as Blocked

Ready tasks now show:
- Password hashing (To Do, P0)
- Auth API endpoints (To Do, P1)
- [Original task: Implement authentication (Blocked)]
- Session management (To Do, P2)

Work on subtasks in order via /hyperpowers:execute-gh-plan
</code>

<why_it_succeeds>
- Original task marked as Blocked (not lost)
- Subtasks linked to same epic
- Clear dependencies between subtasks
- Work can continue on smaller, manageable chunks
- Audit trail preserved in original task body
</why_it_succeeds>
</example>

<example>
<scenario>Merge duplicate tasks</scenario>

<code>
User: Found duplicate tasks, need to merge

Claude: Which tasks are duplicates?
User: PRI_kwDOAIa5sc4_3A and PRI_kwDOAIa5sc4_3B

Claude: Task 1: "Add email validation"
Task 2: "Validate user email addresses"

Which task to keep? (more complete design, more work done, more dependencies)
User: Keep PRI_kwDOAIa5sc4_3A (more complete design)

Claude: Merging designs...

Task 1 body:
## Background
Validate email on user creation.

## Success Criteria
- [ ] Email validated on creation

Task 2 body (unique info):
## Background
Validate email on user creation AND update.

## Success Criteria
- [ ] Email validated on creation
- [ ] Email validated on update  ← Unique!

Merged body:
## Background
Validate email on user creation and update.

## Background
Originally tracked as PRI_kwDOAIa5sc4_3A and PRI_kwDOAIa5sc4_3B (now merged).

## Notes from PRI_kwDOAIa5sc4_3B
Need validation on update as well.

## Success Criteria
- [ ] Validate on creation (from task 1)
- [ ] Validate on update (from task 2)  ← Preserved!
- [ ] Tests for both cases

Updating task PRI_kwDOAIa5sc4_3A with merged body...

Checking for dependent tasks...
Found 1 dependent: PRI_kwDOAIa5sc4_5A references PRI_kwDOAIa5sc4_3B

Updating dependency reference from PRI_kwDOAIa5sc4_3B to PRI_kwDOAIa5sc4_3A...

Closing duplicate PRI_kwDOAIa5sc4_3B...
Body: "DUPLICATE: Merged into PRI_kwDOAIa5sc4_3A"
Marked as Done

Merge complete. All information preserved in PRI_kwDOAIa5sc4_3A.
</code>

<why_it_succeeds>
- All requirements from both tasks preserved
- Dependent task updated with correct reference
- Duplicate marked Done with clear reference
- No information lost
- GitHub Project remains accurate
</why_it_succeeds>
</example>

</examples>

<critical_rules>

## Rules That Have No Exceptions

1. **Keep GitHub Project accurate** → Single source of truth for all work
2. **Merge duplicates, don't just close** → Preserve information from both
3. **Split large tasks when discovered** → Not after struggling through
4. **Document all changes** → Update task bodies when status/deps change
5. **Update as you go** → Never batch updates "for later"
6. **Use correct option IDs** → Never guess, always use cached IDs

## Common Excuses

All of these mean: Stop. Follow the operation properly.

- "Task too complex to split" (Every task can be broken down)
- "Just close duplicate" (Merge first, preserve information)
- "Won't track this in project" (All work tracked, no exceptions)
- "Project is out of date, update later" (Later never comes, update now)
- "This dependency doesn't matter" (Dependencies prevent blocking, they matter)
- "Too much overhead to split" (More overhead to fail huge task)

</critical_rules>

<verification_checklist>

After advanced operations:

- [ ] GitHub Project still accurate (reflects reality)
- [ ] Dependencies correct (nothing blocked incorrectly)
- [ ] Duplicate information merged (not lost)
- [ ] Changes documented in task bodies
- [ ] Ready tasks are actually unblocked
- [ ] Metrics queries return sensible numbers
- [ ] No orphaned tasks (all part of epics)

**Can't check all boxes?** Review operation and fix issues.

</verification_checklist>

<integration>

**This skill covers:** Advanced GitHub Project operations

**For basic operations:**
- writing-gh-plans (creating epics and tasks)
- executing-gh-plans (working through tasks)

**Related skills:**
- verification-before-completion (before closing tasks/epics)
- debugging-with-tools (if operations fail)

**CRITICAL:** Use gh CLI commands, never access GitHub Projects via other means.
</integration>

<resources>

**Guidance for:**
- Task granularity and breakdown
- Status/priority guidelines
- Dependency management patterns

**When stuck:**
- Task seems unsplittable → Ask user how to break it down
- Duplicates complex → Merge designs carefully, don't rush
- Dependencies tangled → Analyze systematically, update one at a time
- Project out of sync → Stop everything, update project first

**Common query patterns for jq:**
```bash
# Filter by status
jq '[.[] | select(.fields[]?.name == "Status" and .fields[]?.options?.name == "Done")]'

# Count by status
jq '[.[] | .fields[] | select(.name == "Status") | .options[]?.name] | group_by(.) | map({status: .[0], count: length})'

# Filter by epic
jq --arg epic_id "$EPIC_ID" '[.[] | select(.fields[]?.text == $epic_id)]'
```

</resources>
