# Migration from bd/beads to GitHub Projects

This document describes how to migrate task management from `bd` CLI and `.beads` directory to GitHub Projects using the `gh project` CLI.

**Important:** This migration is a one-time operation. After migration, GitHub Projects becomes the single source of truth. The bd CLI and `.beads` directory should not be used for ongoing work.

## Overview

**Old system (deprecated):**
- `bd` CLI - Command-line tool for task management
- `.beads/issues.jsonl` - JSON file storing task data

**New system:**
- `gh project` CLI - GitHub CLI for Project management
- GitHub Projects - Web-based project boards with fields, status, and priorities

**Key differences:**
| Aspect | bd/beads | GitHub Projects |
|---------|-----------|-----------------|
| Storage | `.beads/issues.jsonl` | GitHub Projects (cloud) |
| Epics | Separate type | Items without Epic field set |
| Tasks | Linked to epics | Items with Epic field set |
| Status | Built-in states | Custom SINGLE_SELECT field |
| Priority | P0-P4 labels | Custom SINGLE_SELECT field |
| CLI access | `bd` commands | `gh project` commands |

## Prerequisites

Before migrating, ensure you have:

1. **gh CLI installed**
   ```bash
   gh --version  # Should show version
   ```

2. **gh authenticated with project scope**
   ```bash
   gh auth status  # Should show "project" in scopes
   ```

   If missing scope:
   ```bash
   gh auth login -s project
   ```

3. **jq installed** (for JSON processing)
   ```bash
   jq --version  # Should show version
   ```

4. **GitHub Project created** (see setup below)

## Migration Steps

### Step 1: Read Existing bd Data

**If `.beads/issues.jsonl` exists:**

```bash
if [ -f ".beads/issues.jsonl" ]; then
    # Read all issues
    cat .beads/issues.jsonl

    # Or parse with jq if needed
    cat .beads/issues.jsonl | jq -s '.'
fi
```

**Expected format:**
Each line is a JSON object with fields:
- `id`: bd task ID (e.g., "bd-1")
- `title`: Task title
- `body`: Full task description
- `type`: "epic" or "task"
- `status`: "open", "in-progress", "done"
- `priority`: "P0", "P1", "P2", "P3"
- `dependencies`: Array of dependent task IDs

### Step 2: Create GitHub Project

**If you don't have a project yet:**

1. Run `/hyperpowers:set-gh-project` to configure project
2. Select or create a project
3. Ensure required fields exist:
   - Status (SINGLE_SELECT): To Do, In Progress, Blocked, Done
   - Priority (SINGLE_SELECT): P0, P1, P2, P3
   - Epic (TEXT)

The `selecting-gh-project` skill will create these fields automatically.

### Step 3: Map bd Status to GitHub Project Status

| bd Status | GitHub Project Status | Option Name |
|-----------|----------------------|-------------|
| open | Ready | "To Do" |
| in-progress | Working | "In Progress" |
| done | Completed | "Done" |
| blocked | Blocked | "Blocked" |

**Note:** bd doesn't have a blocked status, but GitHub Projects does. Use "Blocked" for tasks that are waiting on dependencies.

### Step 4: Manual Migration (One-time)

**Option A: Manual migration via gh CLI**

For each epic in bd:

1. **Create Epic Item:**
   ```bash
   # Get project config
   PROJECT_CONFIG=$(cat hooks/context/gh-project.json)
   PROJECT_NUMBER=$(echo $PROJECT_CONFIG | jq -r '.projectNumber')
   OWNER=$(echo $PROJECT_CONFIG | jq -r '.owner')
   PROJECT_ID=$(echo $PROJECT_CONFIG | jq -r '.projectId')

   # Create epic (items WITHOUT Epic field set are epics)
   EPIC_BODY="## Summary
   [Epic title from bd]

   ## Success Criteria
   [Convert from bd success criteria]

   ## Related Tasks
   [Will be populated as tasks are created]
   "

   gh project item-create \
       $PROJECT_NUMBER \
       --owner $OWNER \
       --title "$EPIC_TITLE" \
       --body "$EPIC_BODY" \
       --format json > epic.json

   # Extract epic item ID
   EPIC_ITEM_ID=$(cat epic.json | jq -r '.id')
   ```

2. **For each task in epic:**
   ```bash
   # Create task item
   TASK_BODY="## Background
   [Task body from bd]

   ## Success Criteria
   [Convert from bd success criteria]

   ## Implementation Steps
   [Convert from bd implementation steps]

   ## Epic
   $EPIC_ITEM_ID
   "

   gh project item-create \
       $PROJECT_NUMBER \
       --owner $OWNER \
       --title "$TASK_TITLE" \
       --body "$TASK_BODY" \
       --format json > task.json

   TASK_ITEM_ID=$(cat task.json | jq -r '.id')

   # Set Epic field
   EPIC_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Epic.id')
   gh project item-edit \
       --id $TASK_ITEM_ID \
       --field-id $EPIC_FIELD_ID \
       --project-id $PROJECT_ID \
       --text "$EPIC_ITEM_ID"

   # Set Status based on mapping
   STATUS_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.id')
   if [ "$BD_STATUS" = "open" ]; then
       STATUS_OPTION_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options."To Do"')
   elif [ "$BD_STATUS" = "in-progress" ]; then
       STATUS_OPTION_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options."In Progress"')
   elif [ "$BD_STATUS" = "done" ]; then
       STATUS_OPTION_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Status.options.Done"')
   fi

   gh project item-edit \
       --id $TASK_ITEM_ID \
       --field-id $STATUS_FIELD_ID \
       --project-id $PROJECT_ID \
       --single-select-option-id $STATUS_OPTION_ID

   # Set Priority
   PRIORITY_FIELD_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.id')
   PRIORITY_OPTION_ID=$(echo $PROJECT_CONFIG | jq -r '.fields.Priority.options["'"$BD_PRIORITY"'"]')

   gh project item-edit \
       --id $TASK_ITEM_ID \
       --field-id $PRIORITY_FIELD_ID \
       --project-id $PROJECT_ID \
       --single-select-option-id $PRIORITY_OPTION_ID
   ```

3. **Handle dependencies:**

   bd stores dependencies as task IDs. In GitHub Projects:
   - Dependencies are implicit via Status (blocked tasks depend on completed tasks)
   - Cross-epic dependencies: Note in task body which epic's task is needed

   **For same-epic dependencies:**
   ```bash
   # When migrating tasks with dependencies, order matters:
   # 1. Migrate tasks with NO dependencies first (Status = "To Do")
   # 2. Then migrate dependent tasks (can start as "Blocked")
   # 3. When dependency completes, update dependent to "To Do"
   ```

   **For cross-epic dependencies:**
   Add to task body:
   ```markdown
   ## Dependencies
   - TASK_ID from OTHER_EPIC (requires that epic to complete first)
   ```

**Option B: Migration Script (Optional, for advanced users)**

Create a script `migrate-bd-to-gh.sh`:

```bash
#!/bin/bash

PROJECT_CONFIG="hooks/context/gh-project.json"
BEADS_FILE=".beads/issues.jsonl"

if [ ! -f "$PROJECT_CONFIG" ]; then
    echo "ERROR: Project configuration not found."
    echo "Run /hyperpowers:set-gh-project first."
    exit 1
fi

if [ ! -f "$BEADS_FILE" ]; then
    echo "No .beads/issues.jsonl file found. Nothing to migrate."
    exit 0
fi

# Load configuration
OWNER=$(jq -r '.owner' "$PROJECT_CONFIG")
PROJECT_NUMBER=$(jq -r '.projectNumber' "$PROJECT_CONFIG")
PROJECT_ID=$(jq -r '.projectId' "$PROJECT_CONFIG")
STATUS_FIELD_ID=$(jq -r '.fields.Status.id' "$PROJECT_CONFIG")
EPIC_FIELD_ID=$(jq -r '.fields.Epic.id' "$PROJECT_CONFIG")
PRIORITY_FIELD_ID=$(jq -r '.fields.Priority.id' "$PROJECT_CONFIG")

# Read all issues
jq -s '.' "$BEADS_FILE" | while read -r ISSUE; do
    ID=$(echo $ISSUE | jq -r '.id')
    TITLE=$(echo $ISSUE | jq -r '.title')
    BODY=$(echo $ISSUE | jq -r '.body')
    TYPE=$(echo $ISSUE | jq -r '.type')
    STATUS=$(echo $ISSUE | jq -r '.status')
    PRIORITY=$(echo $ISSUE | jq -r '.priority')

    echo "Migrating: $TITLE ($ID)..."

    if [ "$TYPE" = "epic" ]; then
        # Create epic (no Epic field)
        ITEM_OUTPUT=$(gh project item-create \
            $PROJECT_NUMBER \
            --owner $OWNER \
            --title "$TITLE" \
            --body "$BODY" \
            --format json)

        ITEM_ID=$(echo $ITEM_OUTPUT | jq -r '.id')
        echo "  Created epic: $ITEM_ID"

    else
        # Create task
        ITEM_OUTPUT=$(gh project item-create \
            $PROJECT_NUMBER \
            --owner $OWNER \
            --title "$TITLE" \
            --body "$BODY" \
            --format json)

        TASK_ID=$(echo $ITEM_OUTPUT | jq -r '.id')
        echo "  Created task: $TASK_ID"

        # Set Epic field (extract from parent epic's ID)
        # Need to find parent epic ID
        PARENT_ID=$(echo $ISSUE | jq -r '.parent // ""')
        if [ -n "$PARENT_ID" ]; then
            # Get parent epic's GitHub Project item ID
            # This requires tracking during migration
            echo "  Note: Set Epic field to $PARENT_ID's mapped ID"
        fi

        # Set Status
        case $STATUS in
            open)
                STATUS_OPT=$(jq -r '.fields.Status.options."To Do"' "$PROJECT_CONFIG")
                ;;
            in-progress)
                STATUS_OPT=$(jq -r '.fields.Status.options."In Progress"' "$PROJECT_CONFIG")
                ;;
            done)
                STATUS_OPT=$(jq -r '.fields.Status.options.Done"' "$PROJECT_CONFIG")
                ;;
        esac

        gh project item-edit \
            --id $TASK_ID \
            --field-id $STATUS_FIELD_ID \
            --project-id $PROJECT_ID \
            --single-select-option-id $STATUS_OPT

        echo "  Set status: $STATUS"

        # Set Priority
        PRIORITY_OPT=$(jq -r --arg p "$PRIORITY" '.fields.Priority.options[$p]' "$PROJECT_CONFIG")

        gh project item-edit \
            --id $TASK_ID \
            --field-id $PRIORITY_FIELD_ID \
            --project-id $PROJECT_ID \
            --single-select-option-id $PRIORITY_OPT

        echo "  Set priority: $PRIORITY"
    fi
done

echo "Migration complete!"
echo "Note: Review all migrated items in GitHub Project for accuracy."
```

Run the script:
```bash
chmod +x migrate-bd-to-gh.sh
./migrate-bd-to-gh.sh
```

### Step 5: Post-Migration Verification

**After migration, verify:**

1. **All epics migrated:**
   ```bash
   # In GitHub Projects, epics are items without Epic field set
   gh project item-list <PROJECT_NUMBER> --owner $OWNER --format json | \
       jq '[.[] | select(.fields[]?.name != "Epic" or .fields[]?.text == null or .fields[]?.text == "")]'
   ```

2. **All tasks linked to epics:**
   ```bash
   gh project item-list <PROJECT_NUMBER> --owner $OWNER --format json | \
       jq '[.[] | select(.fields[]?.name == "Epic" and .fields[]?.text != null)]'
   ```

3. **Verify task count matches bd:**
   - Count: Number of tasks in .beads/issues.jsonl
   - Count: Number of tasks migrated to GitHub Projects
   - Should match (or close if not migrating some items)

4. **Test workflow:**
   - Run `/hyperpowers:write-gh-plan` for new epics
   - Run `/hyperpowers:execute-gh-plan` to work through tasks
   - Verify Status/Priority fields work correctly

## Handling Dependencies After Migration

**bd dependencies** are represented differently in GitHub Projects:

**Implicit dependencies via Status:**
- Tasks with no incomplete dependencies: Status = "To Do" (ready to work on)
- Tasks waiting on dependencies: Status = "Blocked"

**To migrate dependencies:**
1. Create tasks in dependency order
2. Set dependent tasks to "Blocked" initially
3. When dependency completes (Status → "Done"), update dependent to "To Do"

**Example:**
```
bd-1: Install dependencies (epic root)
  bd-2: Create API (depends on bd-1)
  bd-3: Create tests (depends on bd-2)

Migration:
1. Create gh item for bd-1, Status = "In Progress"
2. Create gh item for bd-2, Status = "Blocked" (waiting on bd-1)
3. Create gh item for bd-3, Status = "Blocked" (waiting on bd-2)
4. When bd-1 completes:
   - Update bd-1 to "Done"
   - Update bd-2 to "To Do" (no longer blocked)
5. When bd-2 completes:
   - Update bd-2 to "Done"
   - Update bd-3 to "To Do"
```

## Legacy bd Commands

**After migration, bd commands are deprecated. Use GitHub Projects equivalents:**

| bd Command | GitHub Project Equivalent |
|------------|------------------------|
| `bd list --type epic` | `gh project item-list` + jq filter |
| `bd show bd-1` | `gh project item-list` + jq filter by ID |
| `bd ready` | `gh project item-list` + jq filter Status="To Do" |
| `bd create ...` | `gh project item-create` + `gh project item-edit` |
| `bd status bd-1 --status done` | `gh project item-edit --single-select-option-id` |
| `bd dep add bd-2 bd-1` | Set Status="Blocked", mention dependency in body |
| `bd dep tree bd-1` | `gh project item-list` + jq filter by Epic field |

## Cleaning Up

**After successful migration:**

1. **Archive bd data (don't delete immediately):**
   ```bash
   mv .beads .beads.backup-$(date +%Y%m%d)
   echo "Archived .beads to .beads.backup-$(date +%Y%m%d)"
   ```

2. **Stop using bd CLI:**
   - Uninstall bd if desired
   - Remove bd from PATH
   - Note: Hooks will still block bd commands (for safety)

3. **Update documentation:**
   - Remove bd commands from any project documentation
   - Update workflows to use GitHub Projects

## Troubleshooting

**Issue: gh project item-edit fails with "field not found"**

Cause: Field ID incorrect or field doesn't exist.

Solution:
```bash
# List all fields in project
gh project field-list <PROJECT_NUMBER> --owner $OWNER --format json | jq '.[] | {name, id}'

# Update hooks/context/gh-project.json with correct IDs
# Or run /hyperpowers:refresh-gh-project
```

**Issue: Tasks not showing in epic view**

Cause: Epic field not set correctly or filter wrong.

Solution:
```bash
# Verify Epic field is set
gh project item-list <PROJECT_NUMBER> --owner $OWNER --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '.[] | select(.fields[]?.text == $epic_id)'
```

**Issue: Status/Priority not applying**

Cause: Option ID incorrect.

Solution:
```bash
# List all options for field
gh project field-list <PROJECT_NUMBER> --owner $OWNER --format json | \
    jq '.[] | select(.name == "Status") | .options[] | {name, id}'

# Verify option ID matches in hooks/context/gh-project.json
```

## Best Practices

1. **Map statuses accurately:**
   - Don't change status semantics during migration
   - Preserve the intended meaning (open=ready, in-progress=working)

2. **Preserve dependencies:**
   - Migrate in order to respect blocking relationships
   - Use "Blocked" status for tasks waiting on dependencies

3. **Test before committing:**
   - Verify a sample of migrated tasks
   - Check Status/Priority fields work
   - Confirm Epic field links tasks correctly

4. **Keep backup:**
   - Don't delete .beads immediately
   - Archive with date stamp
   - Verify GitHub Project data before removing bd

5. **Document the migration:**
   - Record mapping of bd IDs to GitHub Project IDs
   - Note any changes made during migration
   - Document any issues encountered

## Summary

**Migration checklist:**
- [ ] GitHub Project created and configured
- [ ] Required fields exist (Status, Priority, Epic)
- [ ] All epics migrated to GitHub Projects
- [ ] All tasks migrated to GitHub Projects
- [ ] Tasks linked to epics via Epic field
- [ ] Status mapped correctly (open→To Do, in-progress→In Progress, done→Done)
- [ ] Priority mapped correctly (P0-P3)
- [ ] Dependencies preserved (via Status or body notes)
- [ ] Verification complete (test GitHub Project workflow)
- [ ] .beads archived (not deleted)
- [ ] Documentation updated

**After migration:**
- Use `/hyperpowers:write-gh-plan` for new epics
- Use `/hyperpowers:execute-gh-plan` to work through tasks
- Use `/hyperpowers:manage-gh-projects` for advanced operations
- bd CLI no longer needed
- `.beads` no longer needed

**Support:**
- See `skills/selecting-gh-project/SKILL.md` for project setup
- See `skills/writing-gh-plans/SKILL.md` for creating epics/tasks
- See `skills/executing-gh-plans/SKILL.md` for executing tasks
- See `skills/managing-gh-projects/SKILL.md` for advanced operations
