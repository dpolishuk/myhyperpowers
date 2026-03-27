#!/usr/bin/env bash
# Save a summary of the current session turn to memsearch.
# Runs asynchronously to not block session stop.

set -euo pipefail

# Skip if memsearch is not installed
if ! command -v memsearch >/dev/null 2>&1; then
  exit 0
fi

# Read the stop hook input (JSON with session context)
input=$(cat 2>/dev/null || true)

# Extract a summary from the stop context if available
summary=""
if command -v jq >/dev/null 2>&1 && [[ -n "$input" ]]; then
  summary=$(echo "$input" | jq -r '.stop_reason // .reason // empty' 2>/dev/null || true)
fi

# Get project context
project_name=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  project_name=$(basename "$(git rev-parse --show-toplevel)" 2>/dev/null || echo "")
fi
if [[ -z "$project_name" ]]; then
  project_name=$(basename "$PWD")
fi

# Create a memory entry with timestamp
timestamp=$(date +"%Y-%m-%d %H:%M")
memory_dir="${HOME}/.memsearch/memory"
mkdir -p "$memory_dir"

memory_file="${memory_dir}/$(date +%Y-%m-%d).md"

# Append session entry
{
  if [[ ! -f "$memory_file" ]]; then
    echo "# ${project_name} — $(date +%Y-%m-%d)"
    echo ""
  fi
  echo "## Session ${timestamp}"
  echo ""
  if [[ -n "$summary" ]]; then
    echo "- ${summary}"
  else
    echo "- Session completed in ${project_name}"
  fi
  echo ""
} >> "$memory_file"

# Index the new memory (async, best-effort)
memsearch index "$memory_file" >/dev/null 2>&1 &
disown 2>/dev/null || true
