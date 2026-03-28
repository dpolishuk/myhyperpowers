#!/usr/bin/env bash
# Recall relevant memories from memsearch on session start.
# Output JSON with hookSpecificOutput.additionalContext format.

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

# Search for recent relevant memories (5s timeout, silent failure)
# Use timeout if available (GNU), fall back to direct call (macOS)
if command -v timeout >/dev/null 2>&1; then
  memories=$(timeout 5 memsearch search "recent work on ${project_name}" --top-k 5 --format compact 2>/dev/null || true)
else
  memories=$(memsearch search "recent work on ${project_name}" --top-k 5 --format compact 2>/dev/null || true)
fi

if [[ -n "$memories" && "$memories" != "No results found"* ]]; then
  # Escape for JSON embedding (backslashes, quotes, tabs, carriage returns, control chars)
  escaped=$(echo "$memories" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/\t/\\t/g' | tr -d '\r' | tr -d '\000-\011\013-\037' | awk '{printf "%s\\n", $0}')

  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "## Long-term Memory (memsearch)\\nThe following memories from previous sessions may be relevant:\\n\\n${escaped}\\n\\nUse these as background context. Do not repeat them unless asked."
  }
}
EOF
fi
