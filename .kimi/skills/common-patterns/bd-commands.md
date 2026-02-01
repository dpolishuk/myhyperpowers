# bd Command Reference

Common bd commands used across multiple skills. Reference this instead of duplicating.

## Reading Issues

```bash
# Show single issue with full design
bd show bd-3

# List all open issues
bd list --status open

# List closed issues
bd list --status closed

# Show dependency tree for an epic
bd dep tree bd-1

# Find tasks ready to work on (no blocking dependencies)
bd ready

# List tasks in a specific epic
bd list --parent bd-1
```

## Creating Issues

```bash
# Create epic
bd create "Epic: Feature Name" \
  --type epic \
  --priority [0-4] \
  --design "## Goal
[Epic description]

## Success Criteria
- [ ] All phases complete
..."

# Create feature/phase
bd create "Phase 1: Phase Name" \
  --type feature \
  --priority [0-4] \
  --design "[Phase design]"

# Create task
bd create "Task Name" \
  --type task \
  --priority [0-4] \
  --design "[Task design]"
```

## Updating Issues

```bash
# Update issue design (detailed description)
bd update bd-3 --design "$(cat <<'EOF'
[Complete updated design]
EOF
)"
```

**IMPORTANT**: Use `--design` for the full detailed description, NOT `--description` (which is title only).

## Managing Status

```bash
# Start working on task
bd update bd-3 --status in_progress

# Complete task
bd close bd-3

# Reopen task
bd update bd-3 --status open
```

**Common Mistakes:**
```bash
# ❌ WRONG - bd status shows database overview, doesn't change status
bd status bd-3 --status in_progress

# ✅ CORRECT - use bd update to change status
bd update bd-3 --status in_progress

# ❌ WRONG - using hyphens in status values
bd update bd-3 --status in-progress

# ✅ CORRECT - use underscores in status values
bd update bd-3 --status in_progress

# ❌ WRONG - 'done' is not a valid status
bd update bd-3 --status done

# ✅ CORRECT - use bd close to complete
bd close bd-3
```

**Valid status values:** `open`, `in_progress`, `blocked`, `closed`

## Managing Dependencies

```bash
# Add blocking dependency (LATER depends on EARLIER)
# Syntax: bd dep add <dependent> <dependency>
bd dep add bd-3 bd-2  # bd-3 depends on bd-2 (do bd-2 first)

# Add parent-child relationship
# Syntax: bd dep add <child> <parent> --type parent-child
bd dep add bd-3 bd-1 --type parent-child  # bd-3 is child of bd-1

# View dependency tree
bd dep tree bd-1
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
bd list --status open --parent bd-1
# Output: [empty] = all closed

# See what's blocking current work
bd ready  # Shows only unblocked tasks

# Find all in-progress work
bd list --status in_progress
```
