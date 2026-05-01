#!/usr/bin/env bash
set -e

check_dependencies() {
  local missing=()
  command -v jq >/dev/null 2>&1 || missing+=("jq")

  if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: Missing required dependencies: ${missing[*]}" >&2
    return 1
  fi
  return 0
}

check_dependencies || exit 1

# Get priority emoji for visual distinction
get_priority_emoji() {
  local priority="$1"
  case "$priority" in
    "critical") echo "🔴" ;;
    "high") echo "⭐" ;;
    "medium") echo "📌" ;;
    "low") echo "💡" ;;
    *) echo "•" ;;
  esac
}

# Format skill activation reminder
# Usage: format_skill_reminder <rules_path> <skill_name1> [<skill_name2> ...]
format_skill_reminder() {
  local rules_path="$1"
  shift
  local skills=("$@")

  if [ ${#skills[@]} -eq 0 ]; then
    return 0
  fi

  echo "⚠️  SKILL ACTIVATION REMINDER"
  echo ""
  echo "The following skills may apply to your current task:"
  echo ""

  for skill in "${skills[@]}"; do
    local priority=$(jq -r --arg skill "$skill" '.[$skill].priority // "medium"' "$rules_path")
    local emoji=$(get_priority_emoji "$priority")
    local skill_type=$(jq -r --arg skill "$skill" '.[$skill].type // "workflow"' "$rules_path")

    echo "$emoji  $skill ($skill_type, $priority priority)"
  done

  echo ""
  echo "📖 Use the Skill tool to activate: Skill command=\"xpowers:$skill\""
  echo ""
}

# Format gentle reminders for common workflow steps
format_gentle_reminder() {
  local reminder_type="$1"

  case "$reminder_type" in
    "tdd")
      cat <<'EOF'
💭 Remember: Test-Driven Development (TDD)

Before writing implementation code:
1. RED: Write the test first, watch it fail
2. GREEN: Write minimal code to pass
3. REFACTOR: Clean up while keeping tests green

Why? The failure proves your test actually tests something!
EOF
      ;;

    "verification")
      cat <<'EOF'
✅ Before claiming work is complete:

1. Run verification commands (tests, lints, builds)
2. Capture output as evidence
3. Only claim success if verification passes

Evidence before assertions, always.
EOF
      ;;

    "testing-anti-patterns")
      cat <<'EOF'
⚠️  Common Testing Anti-Patterns:

• Testing mock behavior instead of real behavior
• Adding test-only methods to production code
• Mocking without understanding dependencies

Test the real thing, not the test double!
EOF
      ;;

    *)
      echo "Unknown reminder type: $reminder_type"
      return 1
      ;;
  esac
}
