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

# Extract meaningful content from the stop payload
summary=""
if command -v jq >/dev/null 2>&1 && [[ -n "$input" ]]; then
  # Claude Code Stop hook provides { "text": "assistant's response" }
  raw_text=$(echo "$input" | jq -r '.text // empty' 2>/dev/null || true)
  if [[ -n "$raw_text" ]]; then
    # Take the first 500 chars as a summary
    summary="${raw_text:0:500}"
  fi
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

# Use project-scoped filename to avoid mixing contexts
safe_project=$(echo "$project_name" | tr -cd 'a-zA-Z0-9_-')
memory_file="${memory_dir}/$(date +%Y-%m-%d)-${safe_project}.md"

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
