#!/usr/bin/env bash
# Save a session summary to memsearch when an OpenCode session completes.
# Called by opencode.json experimental.hook.session_completed.

set -euo pipefail

# Skip if memsearch is not installed
if ! command -v memsearch >/dev/null 2>&1; then
  exit 0
fi

# Get project name from git or directory
project_name=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  project_name=$(basename "$(git rev-parse --show-toplevel)" 2>/dev/null || echo "")
fi
if [[ -z "$project_name" ]]; then
  project_name=$(basename "$PWD")
fi

# Create memory entry
timestamp=$(date +"%Y-%m-%d %H:%M")
memory_dir="${HOME}/.memsearch/memory"
mkdir -p "$memory_dir"

# Use project-scoped filename to avoid mixing contexts
safe_project=$(echo "$project_name" | tr -cd 'a-zA-Z0-9_-')
memory_file="${memory_dir}/$(date +%Y-%m-%d)-${safe_project}.md"

{
  if [[ ! -f "$memory_file" ]]; then
    echo "# ${project_name} — $(date +%Y-%m-%d)"
    echo ""
  fi
  echo "## OpenCode Session ${timestamp}"
  echo ""
  echo "- Session completed in ${project_name}"
  echo ""
} >> "$memory_file"

# Index the new memory (async, best-effort)
memsearch index "$memory_file" >/dev/null 2>&1 &
disown 2>/dev/null || true
