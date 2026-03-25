# bd Command Reference

> **Note:** `tm` is the recommended interface for task management. It routes to `bd` by default
> and will support additional backends (e.g., Linear) in the future. All commands below
> use `tm` (e.g., `tm ready`, `tm show bd-3`). The `bd` equivalents still work directly.

Common bd commands used across multiple skills. Reference this instead of duplicating.

## Reading Issues

```bash
# Show single issue with full design
tm show bd-3

# List all open issues
tm list --status open

# List closed issues
tm list --status closed

# Show dependency tree for an epic
tm dep tree bd-1

# Find tasks ready to work on (no blocking dependencies)
tm ready

# List tasks in a specific epic
tm list --parent bd-1
```

## Creating Issues

```bash
# Create epic
tm create "Epic: Feature Name" \
  --type epic \
  --priority [0-4] \
  --design "## Goal
[Epic description]

## Success Criteria
- [ ] All phases complete
..."

# Create feature/phase
tm create "Phase 1: Phase Name" \
  --type feature \
  --priority [0-4] \
  --design "[Phase design]"

# Create task
tm create "Task Name" \
  --type task \
  --priority [0-4] \
  --design "[Task design]"
```

## Updating Issues

```bash
# Update issue design (detailed description)
tm update bd-3 --design "$(cat <<'EOF'
[Complete updated design]
EOF
)"
```

**IMPORTANT**: Use `--design` for the full detailed description, NOT `--description` (which is title only).

## Managing Status

```bash
# Start working on task
tm update bd-3 --status in_progress

# Complete task
tm close bd-3

# Reopen task
tm update bd-3 --status open
```

**Common Mistakes:**
```bash
# ❌ WRONG - tm status shows database overview, doesn't change status
tm status bd-3 --status in_progress

# ✅ CORRECT - use tm update to change status
tm update bd-3 --status in_progress

# ❌ WRONG - using hyphens in status values
tm update bd-3 --status in-progress

# ✅ CORRECT - use underscores in status values
tm update bd-3 --status in_progress

# ❌ WRONG - 'done' is not a valid status
tm update bd-3 --status done

# ✅ CORRECT - use tm close to complete
tm close bd-3
```

**Valid status values:** `open`, `in_progress`, `blocked`, `closed`

## Managing Dependencies

```bash
# Add blocking dependency (LATER depends on EARLIER)
# Syntax: tm dep add <dependent> <dependency>
tm dep add bd-3 bd-2  # bd-3 depends on bd-2 (do bd-2 first)

# Add parent-child relationship
# Syntax: tm dep add <child> <parent> --type parent-child
tm dep add bd-3 bd-1 --type parent-child  # bd-3 is child of bd-1

# View dependency tree
tm dep tree bd-1
```

## Commit Message Format

Reference bd task IDs in commits (use hyperpowers:test-runner agent):

```bash
# Use test-runner agent to avoid pre-commit hook pollution
Dispatch hyperpowers:test-runner agent: "Run: git add <files> && git commit -m 'feat(bd-3): implement feature

Implements step 1 of bd-3: Task Name
'"
```

## Common Queries

```bash
# Check if all tasks in epic are closed
tm list --status open --parent bd-1
# Output: [empty] = all closed

# See what's blocking current work
tm ready  # Shows only unblocked tasks

# Find all in-progress work
tm list --status in_progress
```
