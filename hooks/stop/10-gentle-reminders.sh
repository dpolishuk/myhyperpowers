#!/usr/bin/env bash
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT_DIR="$SCRIPT_DIR/../context"
UTILS_DIR="$SCRIPT_DIR/../utils"
LOG_FILE="$CONTEXT_DIR/edit-log.txt"
SESSION_START=$(date -d "1 hour ago" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -v-1H +"%Y-%m-%d %H:%M:%S")

# Source utilities (if they exist)
if [ -f "$UTILS_DIR/context-query.sh" ]; then
    source "$UTILS_DIR/context-query.sh"
else
    # Fallback if utilities missing
    get_session_files() {
        if [ -f "$LOG_FILE" ]; then
            awk -F '|' -v since="$SESSION_START" '$1 >= since {gsub(/^[ \t]+|[ \t]+$/, "", $4); print $4}' "$LOG_FILE" | sort -u
        fi
    }
fi

# Read response from stdin to check for completion claims
RESPONSE=""
if read -t 1 -r response_json 2>/dev/null; then
    RESPONSE=$(echo "$response_json" | jq -r '.text // ""' 2>/dev/null || echo "")
fi

# Get edited files in this session
EDITED_FILES=$(get_session_files "$SESSION_START" 2>/dev/null || echo "")
if [ -z "$EDITED_FILES" ]; then
    FILE_COUNT=0
else
    FILE_COUNT=$(echo "$EDITED_FILES" | wc -l | tr -d ' ')
fi

# Check patterns for appropriate reminders
SHOW_TDD_REMINDER=false
SHOW_VERIFY_REMINDER=false
SHOW_COMMIT_REMINDER=false
SHOW_TEST_RUNNER_REMINDER=false

# Check 1: Files edited but no test files?
if [ "$FILE_COUNT" -gt 0 ]; then
    # Check if source files edited
    if echo "$EDITED_FILES" | grep -qE '\.(ts|js|py|go|rs|java)$' 2>/dev/null; then
        # Check if NO test files edited
        if ! echo "$EDITED_FILES" | grep -qE '(test|spec)\.(ts|js|py|go|rs|java)$' 2>/dev/null; then
            SHOW_TDD_REMINDER=true
        fi
    fi

    # Check 2: Many files edited?
    if [ "$FILE_COUNT" -ge 3 ]; then
        SHOW_COMMIT_REMINDER=true
    fi
fi

# Check 3: User claiming completion? (only if files were edited)
if [ "$FILE_COUNT" -gt 0 ]; then
    if echo "$RESPONSE" | grep -iE '(done|complete|finished|ready|works)' >/dev/null 2>&1; then
        SHOW_VERIFY_REMINDER=true
    fi
fi

# Check 4: Did Claude run git commit with verbose output? (pre-commit hooks)
if echo "$RESPONSE" | grep -E '(Bash\(|`)(git commit|git add.*&&.*git commit)' >/dev/null 2>&1; then
    # Check if response seems verbose (mentions lots of output lines or ctrl+b to background)
    if echo "$RESPONSE" | grep -E '(\+[0-9]{2,}.*lines|ctrl\+b to run in background|timeout:.*[0-9]+m)' >/dev/null 2>&1; then
        SHOW_TEST_RUNNER_REMINDER=true
    fi
fi

# Display appropriate reminders (max 6 lines)
if [ "$SHOW_TDD_REMINDER" = true ] || [ "$SHOW_VERIFY_REMINDER" = true ] || [ "$SHOW_COMMIT_REMINDER" = true ] || [ "$SHOW_TEST_RUNNER_REMINDER" = true ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$SHOW_TDD_REMINDER" = true ]; then
        echo "💭 Remember: Write tests first (TDD)"
    fi

    if [ "$SHOW_VERIFY_REMINDER" = true ]; then
        echo "✅ Before claiming complete: Run tests"
    fi

    if [ "$SHOW_COMMIT_REMINDER" = true ]; then
        echo "💾 Consider: $FILE_COUNT files edited - use xpowers:test-runner agent"
    fi

    if [ "$SHOW_TEST_RUNNER_REMINDER" = true ]; then
        echo "🚀 Tip: Use xpowers:test-runner agent for commits to keep verbose hook output out of context"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

# Always return success (non-blocking)
exit 0
