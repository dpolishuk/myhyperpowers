#!/usr/bin/env bash
# Recall relevant memories from memsearch on session start.
# Runs memsearch search with the current project name as query context.
# Output is injected into the session as system context.

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

# Search for recent relevant memories (silent failure)
memories=$(memsearch search "recent work on ${project_name}" --top-k 5 --format compact 2>/dev/null || true)

if [[ -n "$memories" && "$memories" != "No results found"* ]]; then
  cat <<EOF
<context>
## Long-term Memory (memsearch)
The following memories from previous sessions may be relevant:

${memories}

Use these as background context. Do not repeat them unless asked.
</context>
EOF
fi
