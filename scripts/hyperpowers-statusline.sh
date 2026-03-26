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

# Strip control characters from JSON string values to prevent terminal injection
sanitize() { tr -d '[:cntrl:]' <<< "$1"; }

model=$(sanitize "$(echo "$input" | jq -r '.model.display_name // .model.id // "unknown"')")
agent=$(sanitize "$(echo "$input" | jq -r '.agent.name // empty')")
context_pct=$(echo "$input" | jq -r '(.context_window.used_percentage // empty) | tonumber? // empty')
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')

ESC=$'\033'
parts=()

if [[ -n "$agent" ]]; then
  parts+=("${ESC}[1;36m${agent}${ESC}[0m")
fi

parts+=("${ESC}[1m${model}${ESC}[0m")

if [[ -n "$context_pct" ]]; then
  pct_int=${context_pct%.*}
  if [[ "$pct_int" =~ ^[0-9]+$ ]]; then
    if (( pct_int > 80 )); then
      parts+=("${ESC}[1;31m${context_pct}%${ESC}[0m ctx")
    elif (( pct_int > 50 )); then
      parts+=("${ESC}[1;33m${context_pct}%${ESC}[0m ctx")
    else
      parts+=("${ESC}[0;32m${context_pct}%${ESC}[0m ctx")
    fi
  fi
fi

if [[ -n "$cost" ]]; then
  parts+=("\$${cost}")
fi

IFS=' | '
printf '%s\n' "${parts[*]}"
