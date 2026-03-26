#!/usr/bin/env bash
# Hyperpowers status line script for Claude Code
# Displays active agent name and model in the bottom bar.
#
# Claude Code pipes JSON session data to stdin after each assistant message.
# This script extracts agent.name and model.display_name and formats them.
#
# Install: configured automatically by scripts/install.sh or manually via
#   /statusline in Claude Code

set -euo pipefail

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  echo "hyperpowers (jq not installed)"
  exit 0
fi

model=$(echo "$input" | jq -r '.model.display_name // .model.id // "unknown"')
agent=$(echo "$input" | jq -r '.agent.name // empty')
context_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')

parts=()

if [[ -n "$agent" ]]; then
  parts+=("\033[1;36m$agent\033[0m")
fi

parts+=("\033[1m$model\033[0m")

if [[ -n "$context_pct" ]]; then
  # Color context usage: green < 50%, yellow 50-80%, red > 80%
  pct_int=${context_pct%.*}
  if (( pct_int > 80 )); then
    parts+=("\033[1;31m${context_pct}%\033[0m ctx")
  elif (( pct_int > 50 )); then
    parts+=("\033[1;33m${context_pct}%\033[0m ctx")
  else
    parts+=("\033[0;32m${context_pct}%\033[0m ctx")
  fi
fi

if [[ -n "$cost" ]]; then
  parts+=("\$${cost}")
fi

# Join with separator
IFS=' | '
echo -e "${parts[*]}"
