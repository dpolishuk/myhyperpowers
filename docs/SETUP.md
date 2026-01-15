# GitHub Projects Setup Guide

This guide walks you through setting up GitHub Projects for your repository after migrating from bd/beads.

## Prerequisites

### 1. Install gh CLI

If not already installed:

```bash
# On macOS
brew install gh

# On Linux (check package manager for your distro)
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages" | sudo tee /etc/apt/sources.list.d/github-cli.list
sudo apt update
sudo apt install gh

# On Windows (use winget or scoop)
winget install GitHub.cli
```

### 2. Authenticate GitHub CLI with Project Scope

**Required:** `gh` must be authenticated with `project` scope to manage GitHub Projects.

```bash
# Authenticate with project scope
gh auth login -s project

# You'll be redirected to GitHub to authorize
# After authorization, verify scope
gh auth status
```

Expected output:
```
github.com
  ✓ Logged in as <your-username>
  ✓ Token: ghp_... (access to project scope)
  ✓ Git operations
  ✓ Gist: read
  ✓ Project: read, write, manage
```

**Critical:** Verify "Project: read, write, manage" appears in scope output. If missing, re-authenticate.

### 3. Install jq (for JSON parsing)

Required by hooks for parsing gh CLI output.

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Fedora/CentOS
sudo dnf install jq
```

## Setup Steps

### Step 1: Configure GitHub Project

Run the setup command:

```bash
/hyperpowers:set-gh-project
```

This will invoke the `selecting-gh-project` skill which will:

1. **Check your current repository:**
   - Reads repository info via `gh repo view`
   - Shows: "Current repository: owner/repo-name"

2. **List available GitHub Projects:**
   - Lists all projects for your organization/user
   - Shows project number and title for each

3. **Prompt you to choose:**
   ```
   Which GitHub Project should this repository use?
   
   Options:
   - "Project #1: Hyperpowers Development"
   - "Project #2: Bug Tracking"
   - "Project #3: Documentation"
   - "Create new project"
   - "Use saved default" (if project was configured before)
   ```

### Step 2: Choose Your Option

**Option A: Use Saved Default**
- If you've configured this repo before, choose "Use saved default"
- Skips project selection, uses cached configuration
- Fastest option for repeated use

**Option B: Select Existing Project**
- Choose the project number/title that matches your repo's work
- Example: If working on "hyperpowers" repo, select "Hyperpowers Development"
- Skill will configure that project for this repository

**Option C: Create New Project**
- Choose "Create new project" if no existing project fits
- You'll be prompted for project title
- Example: "hyperpowers-tasks" or "Project Name + Development"

### Step 3: Automatic Field Creation (New Projects Only)

If you choose "Create new project", the skill will:

1. **Create Status field** (SINGLE_SELECT):
   - Options: "To Do", "In Progress", "Blocked", "Done"
   - Used to track task state

2. **Create Priority field** (SINGLE_SELECT):
   - Options: "P0", "P1", "P2", "P3"
   - Used to prioritize work

3. **Create Epic field** (TEXT):
   - Links tasks to their parent epic
   - Stores epic item ID

4. **Extract and Cache Field/Option IDs:**
   - Uses `gh project field-list` to get field details
   - Parses with `jq` to extract IDs
   - Caches all IDs for fast subsequent operations

### Step 4: Configuration Saved

Skill saves configuration to:

```bash
hooks/context/gh-project.json
```

**File format:**
```json
{
  "repo": "withzombies/hyperpowers",
  "owner": "withzombies",
  "projectNumber": 1,
  "projectId": "PR_kwDOAIa5sc4...",
  "fields": {
    "Status": {
      "id": "PVCF...",
      "options": {
        "To Do": "PVCF_TODO...",
        "In Progress": "PVCF_INPROGRESS...",
        "Blocked": "PVCF_BLOCKED...",
        "Done": "PVCF_DONE..."
      }
    },
    "Priority": {
      "id": "PVCF...",
      "options": {
        "P0": "PVCF_P0...",
        "P1": "PVCF_P1...",
        "P2": "PVCF_P2...",
        "P3": "PVCF_P3..."
      }
    },
    "Epic": {
      "id": "PVCF..."
    }
  },
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

## Verification

After setup completes, verify configuration:

### 1. Check Configuration File

```bash
cat hooks/context/gh-project.json | jq '.'
```

Expected: Valid JSON with all required fields.

### 2. Test gh CLI Access

```bash
# List items in project
gh project item-list <PROJECT_NUMBER> --owner <OWNER> --format json | jq '.[0:3]'

# Should return array of items
# If empty: project has no items (normal for new project)
# If error: check authentication and project permissions
```

### 3. Verify Project Has Required Fields

```bash
# List fields in project
gh project field-list <PROJECT_NUMBER> --owner <OWNER> --format json | jq '.[].name'

# Should show:
# - Status
# - Priority
# - Epic

# If any missing: fields weren't created (contact support or re-run setup)
```

### 4. Test Skill Invocation

```bash
# Test that skills can read configuration
echo "Testing skill configuration..."

# Run a simple gh project command
gh project item-list <PROJECT_NUMBER> --owner <OWNER> --format json | jq 'length'

# If returns count: configuration works
# If error "project not found": configuration wrong
```

## Usage After Setup

### Create Epic and Tasks

```bash
# Use writing-gh-plans skill
/hyperpowers:write-gh-plan

# Answer prompts for epic title, summary, success criteria
# Break down into tasks (2-5 minutes each)
# Skills creates epic item + task items
# All tasks linked to epic via Epic field
```

### Execute Tasks

```bash
# Use executing-gh-plans skill
/hyperpowers:execute-gh-plan

# Shows ready tasks sorted by priority (P0 > P1 > P2 > P3)
# Choose automatic or interactive mode
# Updates task status: To Do → In Progress → Done
# Uses test-runner agent for verification
```

### Advanced Operations

```bash
# Use managing-gh-projects skill
/hyperpowers:manage-gh-projects

# Split large tasks mid-flight
# Merge duplicate tasks
# Change status/priority
# Archive completed epics
# Query metrics
# Handle cross-epic dependencies
```

### Refresh Configuration

```bash
# If project structure changes
/hyperpowers:refresh-gh-project

# Re-fetches field IDs and option IDs
# Updates hooks/context/gh-project.json
# All skills use updated IDs
```

## Troubleshooting

### Issue: "ERROR: No GitHub Project context found"

**Cause:** Configuration file doesn't exist.

**Solution:**
```bash
# Run setup again
/hyperpowers:set-gh-project
```

### Issue: gh auth doesn't include project scope

**Cause:** Authentication without `project` scope.

**Solution:**
```bash
# Re-authenticate with correct scope
gh auth login -s project

# Verify scope after login
gh auth status

# Look for: "Project: read, write, manage"
```

### Issue: "project not found" or "404 Not Found"

**Cause:** Wrong project number or insufficient permissions.

**Solution:**
```bash
# List available projects
gh project list --owner <OWNER> --format json | jq '.[] | {number, title}'

# Choose correct project number
# Re-run setup with correct project
/hyperpowers:set-gh-project
```

### Issue: Hooks blocking gh commands

**Cause:** Hooks not updated with new commands.

**Solution:**
```bash
# Check hooks.json
cat hooks/hooks.json | jq '.hooks.PreToolUse[].hooks[] | .command'

# Should include:
# - hooks/pre-tool-use/02-block-bd-cli.py
# - hooks/pre-tool-use/03-block-gh-truncation.py

# If missing: hooks not installed correctly
# Reinstall hyperpowers plugin
```

### Issue: "jq: command not found"

**Cause:** jq not installed or not in PATH.

**Solution:**
```bash
# Install jq (see Prerequisites section)
# Verify installation
jq --version

# Add to PATH if needed
export PATH=$PATH:/usr/local/bin:$PATH
```

## Common Workflows

### Workflow 1: New Feature Development

```bash
# 1. Brainstorm requirements
/hyperpowers:brainstorm

# 2. Create epic and tasks
/hyperpowers:write-gh-plan

# 3. Execute tasks
/hyperpowers:execute-gh-plan

# 4. Review implementation
/hyperpowers:review-implementation

# 5. Create PR
/hyperpowers:finishing-a-development-branch
```

### Workflow 2: Bug Fixing

```bash
# 1. Debug systematically (using debugging-with-tools skill)
# 2. Write failing test
# 3. Implement fix
# 4. Verify fix
# 5. Update task status to Done
```

### Workflow 3: Task Management

```bash
# View all tasks in epic
gh project item-list <PROJECT_NUMBER> --owner <OWNER> --format json | \
    jq --arg epic_id "$EPIC_ID" \
    '.[] | select(.fields[]?.text == $epic_id)'

# Change priority of urgent task
/hyperpowers:manage-gh-projects

# Split large task
/hyperpowers:manage-gh-projects

# Query velocity metrics
/hyperpowers:manage-gh-projects
```

## Migration Notes

If you previously used `bd` CLI, see `docs/MIGRATION-from-bd.md` for:
- Manual migration steps
- Status mapping
- Dependency handling
- Cleaning up old bd data

**Important:** After migration:
- Do NOT use `bd` commands (blocked by hooks)
- Do NOT read `.beads/issues.jsonl` (blocked by hooks)
- Use GitHub Projects as single source of truth

## Next Steps

After completing setup:

1. **Create your first epic:**
   ```bash
   /hyperpowers:write-gh-plan
   ```

2. **Start implementing:**
   ```bash
   /hyperpowers:execute-gh-plan
   ```

3. **Learn advanced operations:**
   - Read skills for details on splitting/merging tasks
   - Explore metrics capabilities

## Support

If you encounter issues:

1. **Check documentation:**
   - `docs/MIGRATION-from-bd.md` - Migration guide
   - `skills/selecting-gh-project/SKILL.md` - Setup skill details
   - `hooks/` - Hook documentation

2. **Verify prerequisites:**
   - `gh --version` - gh CLI version
   - `gh auth status` - Authentication status
   - `jq --version` - jq version

3. **Check configuration:**
   ```bash
   cat hooks/context/gh-project.json | jq '.'
   ```

4. **Test access:**
   ```bash
   gh project list --owner <OWNER> --format json | jq '.'
   ```

---

**You're ready to use GitHub Projects with Hyperpowers!** 🎉
