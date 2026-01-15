---
name: gh-projects
description: Use when setting up or operating GitHub Projects for a repo with gh CLI, including search, item syncing, and field updates.
---

# gh-projects

## Overview
Use a hybrid workflow for GitHub Projects: `gh project` for day-to-day CLI operations, GitHub UI for views/workflows, and `gh api graphql` for v2 field updates that the CLI doesn’t cover. Prefer Projects v2; use classic Projects only as a fallback.

## When to Use
- Creating a repo-owned GitHub Project for issues/PR tracking
- Replacing `bd`-style task tracking with GitHub Projects
- Automating project sync via auto-add rules or Actions

**Not for:** one-off personal tracking, or repos already mandated to use `bd`.

## Quick Reference

| Goal | Command(s) |
| --- | --- |
| Create v2 project | `gh project create --v2 --owner <OWNER> --title "<TITLE>"` |
| List projects | `gh project list --owner <OWNER>` |
| View project | `gh project view <NUMBER> --owner <OWNER>` |
| Link repo | `gh project link <NUMBER> --owner <OWNER> --repo <OWNER>/<REPO>` |
| List fields | `gh project field-list <NUMBER> --owner <OWNER>` |
| Add item | `gh project item-add <NUMBER> --owner <OWNER> --url <ISSUE_OR_PR_URL>` |
| Create draft | `gh project item-create <NUMBER> --owner <OWNER> --title "..." --body "..."` |
| Edit field | `gh project item-edit --id <ITEM_ID> --project-id <PROJECT_ID> --field-id <FIELD_ID> --text "..."` |
| Search issues | `gh search issues "repo:OWNER/REPO label:bug state:open"` |

## Setup (Repo-Owned Project v2)

### 1) Prereqs
- `gh auth login` with `project` scope
- `gh repo view --json nameWithOwner` to confirm owner/repo

### 2) Create the project
- Prefer CLI:
  ```bash
  gh project create --v2 --owner <OWNER> --title "<PROJECT_TITLE>"
  gh project link <NUMBER> --owner <OWNER> --repo <OWNER>/<REPO>
  ```
- If CLI is blocked or the repo needs explicit linking, use UI:
  `https://github.com/<owner>/<repo>/projects` → New project (v2)

### 3) Standard fields (bd mapping)
Create these fields (v2):
- **Status** (single-select): `Todo`, `In Progress`, `Blocked`, `Done`
- **Type** (single-select): `Epic`, `Task`, `Bug`, `Chore`
- **Priority** (single-select): `P0`, `P1`, `P2`, `P3`
- **Epic** (text)
- **Size** (number)

Use `gh project field-create` where possible; otherwise use GraphQL (see below). Always record `fieldId` and option IDs.

### 4) Views (UI only)
- **Board** grouped by `Status`
- **Table** with filters for `state:open` and `assignee:@me`

### 5) Auto-add rules (UI preferred)
- Project → Workflows → Auto-add items
- Use search query: `repo:OWNER/REPO state:open label:task`

## Daily Operations

### Search
```bash
gh search issues "repo:OWNER/REPO label:bug state:open"
gh pr list --search "is:pr state:open review-requested:@me"
```

### Add items
```bash
gh project item-add <NUMBER> --owner <OWNER> --url "https://github.com/<OWNER>/<REPO>/issues/123"
gh project item-create <NUMBER> --owner <OWNER> --title "Epic: ..." --body "..."
```

### Update fields (CLI first)
```bash
gh project item-edit --id <ITEM_ID> --project-id <PROJECT_ID> --field-id <FIELD_ID> --single-select-option-id <OPTION_ID>
```
Use `--text`, `--number`, or `--iteration-id` for other field types. If you need to script bulk updates or already have GraphQL IDs, use GraphQL:

```bash
# Update single-select field (Status/Type/Priority)
gh api graphql -f query='
mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){
  updateProjectV2ItemFieldValue(input:{
    projectId:$projectId,
    itemId:$itemId,
    fieldId:$fieldId,
    value:{ singleSelectOptionId:$optionId }
  }){ projectV2Item { id } }
}' -f projectId=PROJECT_ID -f itemId=ITEM_ID -f fieldId=FIELD_ID -f optionId=OPTION_ID
```

## Sync & Automation

### Built-in workflows (recommended)
Use Project Workflows (UI) to auto-add items matching a search query and set Status on add.

### GitHub Actions (optional)
```yaml
name: Sync issues/prs to project
on:
  issues:
    types: [opened, labeled, unlabeled]
  pull_request:
    types: [opened, labeled, unlabeled]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v0.5.0
        with:
          project-url: https://github.com/<owner>/<repo>/projects/<number>
          github-token: ${{ secrets.GITHUB_TOKEN }}
          labeled: task,bug,epic
```

## Classic Projects (Fallback)
If v2 is unavailable, use classic Projects:
- `gh project create` (no `--v2`)
- Columns replace fields; status is represented by column name
- Views and workflows are UI-only

## Common Mistakes
- Creating an org/user project instead of a repo-owned project
- Skipping field option IDs and guessing values for single-select fields
- Assuming views/workflows can be fully managed via CLI
- Using Type options that don’t match `Epic/Task/Bug/Chore`

## Integration
- Use **superpowers:brainstorming** for project workflow changes.
- Use **superpowers:writing-plans** to plan a full migration from `bd`.
- Use **superpowers:verification-before-completion** before claiming setup is complete.
