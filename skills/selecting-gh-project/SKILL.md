---
name: selecting-gh-project
description: Use to configure GitHub Project for repository - select existing project or create new, cache field/option IDs
---

<skill_overview>
Configure GitHub Project as single source of truth for tasks and epics in this repository. Caches project configuration locally for fast access to field and option IDs.
</skill_overview>

<rigidity_level>
RIGID PROCESS - Follow exact steps for gh commands and JSON parsing. No shortcuts on ID retrieval.
</rigidity_level>

<quick_reference>

| Step | Action | Command |
|------|--------|---------|
| Check context | Read gh-project.json | `cat hooks/context/gh-project.json` |
| Get repo | Extract owner/name | `gh repo view --json nameWithOwner` |
| List projects | Show available | `gh project list --owner $OWNER --format json` |
| Create project | New project setup | `gh project create --owner $OWNER --title "$TITLE" --format json` |
| Get project ID | Extract GraphQL ID | `gh project view $NUMBER --owner $OWNER --format json` |
| Create fields | Status/Priority/Epic | `gh project field-create` commands |
| Get field IDs | Extract from list | `gh project field-list --format json` |
| Cache config | Write JSON | Save to hooks/context/gh-project.json |

**Required scopes:** `gh auth` must include `project` scope
**Required jq:** All JSON parsing uses jq for field/option ID extraction
</quick_reference>

<when_to_use>
Use this skill when:
- Setting up GitHub Projects for first time in repository
- Changing which GitHub Project to use for this repository
- Refreshing cached field/option IDs after project structure changes
- User requests /hyperpowers:set-gh-project or /hyperpowers:refresh-gh-project

Run automatically if other gh-project skills find missing or invalid context file.
</when_to_use>

<the_process>

## 1. Check for Existing Project Context

**First, check if context file exists:**

```bash
if [ -f "hooks/context/gh-project.json" ]; then
    echo "Found existing project context:"
    cat hooks/context/gh-project.json | jq '.'
else
    echo "No project context found."
fi
```

**If context exists and is valid:**
- Ask user: "Use saved project: $REPO → Project #$PROJECT_NUMBER ($TITLE)?"
- Options:
  - "Yes, use saved"
  - "Select different project"
  - "Create new project"
  - "Refresh project IDs"

**If context missing or invalid:**
- Proceed to Step 2 (get repo info)

## 2. Get Current Repository Information

**Extract owner and repo name:**

```bash
REPO_INFO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
# Example output: withzombies/hyperpowers

OWNER=$(echo $REPO_INFO | cut -d'/' -f1)
REPO=$(echo $REPO_INFO | cut -d'/' -f2)

echo "Current repository: $REPO_INFO"
echo "Owner: $OWNER"
echo "Repo: $REPO"
```

**Store for use in gh commands:**
- All gh project commands need `--owner $OWNER`
- Project selection/filtering uses owner

## 3. List Available Projects

**Show existing projects for this owner:**

```bash
PROJECTS=$(gh project list --owner $OWNER --format json)
echo "$PROJECTS" | jq '.[] | {number, title, closed}'
```

**Example output:**
```json
{
  "number": 1,
  "title": "Hyperpowers Development",
  "closed": false
}
{
  "number": 2,
  "title": "Bug Tracking",
  "closed": false
}
```

**Ask user:**
- "Which GitHub Project should this repository use?"
- Options:
  - "Project #1: Hyperpowers Development"
  - "Project #2: Bug Tracking"
  - "Create new project"

**If user selects existing project:**
- Store PROJECT_NUMBER from selection
- Proceed to Step 5 (get project details)

**If user wants to create new:**
- Proceed to Step 4 (create new project)

## 4. Create New GitHub Project (if needed)

**Ask for project title:**
- "Enter title for new GitHub Project:"
- User provides title (or use repo name as default)

**Create the project:**

```bash
PROJECT_TITLE="${TITLE:-$REPO Development}"

PROJECT_OUTPUT=$(gh project create \
  --owner $OWNER \
  --title "$PROJECT_TITLE" \
  --format json)

PROJECT_NUMBER=$(echo $PROJECT_OUTPUT | jq -r '.number')
echo "Created project #$PROJECT_NUMBER: $PROJECT_TITLE"
```

**Proceed to Step 5 to configure fields.**

## 5. Get Project ID (GraphQL ID)

**CRITICAL: gh project item-edit requires GraphQL ID, not project number.**

```bash
PROJECT_DETAILS=$(gh project view $PROJECT_NUMBER --owner $OWNER --format json)

# Extract GraphQL ID from JSON
PROJECT_ID=$(echo $PROJECT_DETAILS | jq -r '.id')

echo "Project Number: $PROJECT_NUMBER"
echo "Project GraphQL ID: $PROJECT_ID"
```

**Store both:**
- PROJECT_NUMBER - used for `gh project item-create`, `gh project field-list`
- PROJECT_ID - used for `gh project item-edit`, `gh project field-create`

## 6. Create Required Fields (for new projects only)

**Check if fields already exist:**

```bash
EXISTING_FIELDS=$(gh project field-list $PROJECT_NUMBER --owner $OWNER --format json)
echo "$EXISTING_FIELDS" | jq '.[] | .name'
```

**Create Status field (SINGLE_SELECT):**

```bash
if ! echo "$EXISTING_FIELDS" | jq -e '.[] | select(.name == "Status")' > /dev/null; then
    echo "Creating Status field..."

    gh project field-create $PROJECT_NUMBER \
        --owner $OWNER \
        --name "Status" \
        --data-type "SINGLE_SELECT" \
        --single-select-options "To Do,In Progress,Blocked,Done"

    echo "Status field created with options: To Do, In Progress, Blocked, Done"
else
    echo "Status field already exists"
fi
```

**Create Priority field (SINGLE_SELECT):**

```bash
if ! echo "$EXISTING_FIELDS" | jq -e '.[] | select(.name == "Priority")' > /dev/null; then
    echo "Creating Priority field..."

    gh project field-create $PROJECT_NUMBER \
        --owner $OWNER \
        --name "Priority" \
        --data-type "SINGLE_SELECT" \
        --single-select-options "P0,P1,P2,P3"

    echo "Priority field created with options: P0, P1, P2, P3"
else
    echo "Priority field already exists"
fi
```

**Create Epic field (TEXT):**

```bash
if ! echo "$EXISTING_FIELDS" | jq -e '.[] | select(.name == "Epic")' > /dev/null; then
    echo "Creating Epic field..."

    gh project field-create $PROJECT_NUMBER \
        --owner $OWNER \
        --name "Epic" \
        --data-type "TEXT"

    echo "Epic field created (TEXT type)"
else
    echo "Epic field already exists"
fi
```

## 7. Retrieve Field IDs and Option IDs

**CRITICAL: All field operations require specific IDs, not names.**

```bash
# Get updated field list with options
FIELDS=$(gh project field-list $PROJECT_NUMBER --owner $OWNER --format json)

# Extract Status field ID and option IDs
STATUS_FIELD_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Status") | .id')

STATUS_TODO_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Status") | .options[] | select(.name == "To Do") | .id')
STATUS_INPROGRESS_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id')
STATUS_BLOCKED_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Status") | .options[] | select(.name == "Blocked") | .id')
STATUS_DONE_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Status") | .options[] | select(.name == "Done") | .id')

# Extract Priority field ID and option IDs
PRIORITY_FIELD_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Priority") | .id')

PRIORITY_P0_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Priority") | .options[] | select(.name == "P0") | .id')
PRIORITY_P1_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Priority") | .options[] | select(.name == "P1") | .id')
PRIORITY_P2_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Priority") | .options[] | select(.name == "P2") | .id')
PRIORITY_P3_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Priority") | .options[] | select(.name == "P3") | .id')

# Extract Epic field ID
EPIC_FIELD_ID=$(echo "$FIELDS" | jq -r '.[] | select(.name == "Epic") | .id')

echo "Retrieved all field and option IDs"
```

**Verify IDs were retrieved:**

```bash
if [ -z "$STATUS_FIELD_ID" ] || [ -z "$PRIORITY_FIELD_ID" ] || [ -z "$EPIC_FIELD_ID" ]; then
    echo "ERROR: Failed to retrieve required field IDs"
    echo "Status field ID: $STATUS_FIELD_ID"
    echo "Priority field ID: $PRIORITY_FIELD_ID"
    echo "Epic field ID: $EPIC_FIELD_ID"
    exit 1
fi
```

## 8. Cache Project Configuration

**Create JSON configuration file:**

```bash
UPDATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > hooks/context/gh-project.json <<EOF
{
  "repo": "$REPO_INFO",
  "owner": "$OWNER",
  "projectNumber": $PROJECT_NUMBER,
  "projectId": "$PROJECT_ID",
  "fields": {
    "Status": {
      "id": "$STATUS_FIELD_ID",
      "options": {
        "To Do": "$STATUS_TODO_ID",
        "In Progress": "$STATUS_INPROGRESS_ID",
        "Blocked": "$STATUS_BLOCKED_ID",
        "Done": "$STATUS_DONE_ID"
      }
    },
    "Priority": {
      "id": "$PRIORITY_FIELD_ID",
      "options": {
        "P0": "$PRIORITY_P0_ID",
        "P1": "$PRIORITY_P1_ID",
        "P2": "$PRIORITY_P2_ID",
        "P3": "$PRIORITY_P3_ID"
      }
    },
    "Epic": {
      "id": "$EPIC_FIELD_ID"
    }
  },
  "updatedAt": "$UPDATED_AT"
}
EOF

echo "Project configuration cached to hooks/context/gh-project.json"
```

**Verify file was created:**

```bash
cat hooks/context/gh-project.json | jq '.'
```

## 9. Override/Reset Operations

**If user wants to override project:**
- Ask for new project selection (Steps 2-5)
- Overwrite existing gh-project.json (Step 8)

**If user wants to reset:**
- Delete hooks/context/gh-project.json
- Re-run from Step 1

**If user wants to refresh IDs:**
- Run Steps 5-8 with existing PROJECT_NUMBER
- Updates updatedAt timestamp and IDs
- Project number and owner remain unchanged

</the_process>

<examples>

<example>
<scenario>First-time setup for repository</scenario>

<code>
User: /hyperpowers:set-gh-project

Claude: Checking for existing project context...
No project context found.

Getting repository information...
Current repository: withzombies/hyperpowers
Owner: withzombies
Repo: hyperpowers

Listing available projects...
#1: Hyperpowers Development
#2: Bug Tracking
#3: Documentation

Which GitHub Project should this repository use?
Options: "#1: Hyperpowers Development", "#2: Bug Tracking", "#3: Documentation", "Create new project"

User: "#1: Hyperpowers Development"

Claude: Getting project details...
Project Number: 1
Project GraphQL ID: PR_kwDOAIa5sc4...

Retrieving field and option IDs...
Status field found
Priority field found
Epic field found

All IDs retrieved successfully.
Project configuration cached to hooks/context/gh-project.json

Configuration saved:
{
  "repo": "withzombies/hyperpowers",
  "owner": "withzombies",
  "projectNumber": 1,
  "projectId": "PR_kwDOAIa5sc4...",
  "fields": {...},
  "updatedAt": "2025-01-15T10:30:00Z"
}

Ready to use GitHub Projects for task management.
</code>

<why_it_succeeds>
- Caches all required IDs for fast access
- No need to query gh for every item creation
- Single source of truth in JSON file
- Easy to refresh when project structure changes
</why_it_succeeds>
</example>

<example>
<scenario>Creating new project with required fields</scenario>

<code>
User: Create a new project called "Feature Tracker"

Claude: Creating GitHub Project...
Title: Feature Tracker
Owner: withzombies

gh project create --owner withzombies --title "Feature Tracker" --format json
Created project #3: Feature Tracker

Creating Status field...
gh project field-create 3 --owner withzombies --name "Status" --data-type "SINGLE_SELECT" --single-select-options "To Do,In Progress,Blocked,Done"
Status field created with options: To Do, In Progress, Blocked, Done

Creating Priority field...
gh project field-create 3 --owner withzombies --name "Priority" --data-type "SINGLE_SELECT" --single-select-options "P0,P1,P2,P3"
Priority field created with options: P0, P1, P2, P3

Creating Epic field...
gh project field-create 3 --owner withzombies --name "Epic" --data-type "TEXT"
Epic field created (TEXT type)

Retrieving field IDs...
All IDs retrieved successfully.

Configuration cached to hooks/context/gh-project.json
</code>

<why_it_succeeds>
- Creates required fields with correct data types
- Retrieves IDs immediately after creation
- Caches configuration for fast subsequent access
- Project ready for epic and task creation
</why_it_succeeds>
</example>

<example>
<scenario>Refreshing project IDs after field changes</scenario>

<code>
User: /hyperpowers:refresh-gh-project

Claude: Found existing project context:
{
  "repo": "withzombies/hyperpowers",
  "owner": "withzombies",
  "projectNumber": 1,
  ...
}

Use saved project: withzombies/hyperpowers → Project #1 (Hyperpowers Development)?
Options: "Yes, use saved", "Select different project", "Create new project", "Refresh project IDs"

User: "Refresh project IDs"

Claude: Getting updated project details...
Project ID: PR_kwDOAIa5sc4...

Retrieving updated field IDs...
Status field ID and options retrieved
Priority field ID and options retrieved
Epic field ID retrieved

Configuration updated in hooks/context/gh-project.json
UpdatedAt: 2025-01-15T11:45:00Z
</code>

<why_it_succeeds>
- Updates IDs without changing project selection
- Captures field structure changes (new options, renamed fields)
- Updates timestamp for tracking
- Maintains consistent configuration
</why_it_succeeds>
</example>

</examples>

<critical_rules>

## Rules That Have No Exceptions

1. **Always cache field/option IDs** → Never query gh for every operation
2. **Use GraphQL ID for item-edit** → Never use project number
3. **Verify IDs retrieved successfully** → Fail fast if ID retrieval fails
4. **Create required fields** → Status (SINGLE_SELECT), Priority (SINGLE_SELECT), Epic (TEXT)
5. **Check for existing context** → Prompt user before overwriting
6. **Store repo and owner** → All gh commands require these

## Common Excuses

All of these mean: STOP. Follow the skill properly.

- "I can query fields dynamically" (Slows down all operations, use cache)
- "User can provide IDs manually" (Prone to errors, let gh fetch correctly)
- "Skip field creation, will create manually" (Breaks other skills that depend on fields)
- "Use project number for item-edit" (Wrong command, requires GraphQL ID)
- "Don't need to cache, it's fast enough" (Every gh call is slow, cache matters)

</critical_rules>

<verification_checklist>

After completing skill execution:

- [ ] hooks/context/gh-project.json exists
- [ ] All required fields present in JSON (repo, owner, projectNumber, projectId)
- [ ] Status field ID and 4 option IDs cached
- [ ] Priority field ID and 4 option IDs cached
- [ ] Epic field ID cached
- [ ] UpdatedAt timestamp set correctly
- [ ] JSON is valid (passes jq '.')
- [ ] User confirmed project selection
- [ ] gh auth has project scope (no 401 errors)

Before finishing:

- [ ] Project context verified with `cat hooks/context/gh-project.json | jq '.'`
- [ ] Test gh command with cached IDs works
- [ ] User knows how to override or refresh project

</verification_checklist>

<integration>

**This skill is called by:**
- User via `/hyperpowers:set-gh-project` command
- Other gh-project skills automatically when context missing/invalid
- `/hyperpowers:refresh-gh-project` command

**This skill calls:**
- No other skills (standalone setup)

**Prerequisites:**
- `gh` CLI installed and authenticated
- `gh auth` includes `project` scope
- `jq` installed for JSON parsing
- Internet access for GitHub API

**Data stored:**
- hooks/context/gh-project.json - cached project configuration

**Related skills:**
- writing-gh-plans - uses cached configuration for epic/task creation
- executing-gh-plans - uses cached configuration for status updates
- managing-gh-projects - uses cached configuration for field updates

</integration>

<resources>

**gh CLI documentation:**
- https://cli.github.com/manual/gh_project
- https://cli.github.com/manual/gh_project_create
- https://cli.github.com/manual/gh_project_field_create
- https://cli.github.com/manual/gh_project_field_list
- https://cli.github.com/manual/gh_project_view

**jq documentation:**
- https://stedolan.github.io/jq/manual/

**When stuck:**
- 401 Unauthorized error → Run `gh auth login -s project`
- Field not found → Check field name matches exactly (case-sensitive)
- jq parse error → Check JSON output format from gh command
- Empty field list → Project may not be accessible, check permissions

</resources>
