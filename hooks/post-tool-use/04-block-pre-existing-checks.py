#!/usr/bin/env python3
"""
PostToolUse hook to block git checkout when checking for pre-existing errors.

When projects use pre-commit hooks that enforce passing tests, checking if
errors are "pre-existing" is unnecessary and wastes time. All test failures
and lint errors must be from current changes because pre-commit hooks prevent
commits with failures.

Known limitations:
- Legitimate branch checkouts (e.g., "git checkout main") may be blocked if
  combined with verification commands in the same Bash invocation. Run them
  as separate commands to avoid this.
"""

import json
import sys
import re

# Test and lint command patterns that might be run on previous commits
VERIFICATION_COMMANDS = [
    r'\bruff\b',
    r'\bpytest\b',
    r'\bmypy\b',
    r'\bflake8\b',
    r'\bblack\b',
    r'\bisort\b',
    r'\bcargo\s+test\b',
    r'\bcargo\s+clippy\b',
    r'\bnpm\s+test\b',
    r'\bnpm\s+run\s+test\b',
    r'\byarn\s+test\b',
    r'\bgo\s+test\b',
    r'\bmvn\s+test\b',
    r'\bgradle\s+test\b',
    r'\bpylint\b',
    r'\beslint\b',
    r'\btsc\b',  # TypeScript compiler
    r'\bpre-commit\s+run\b',
]


def is_checking_previous_commit(command):
    """
    Detect if command is checking out previous commits to run tests/lints.

    Patterns:
    - git stash && git checkout (common pattern for checking previous commits)
    - git checkout combined with verification commands (pytest, npm test, etc.)
    """
    # Check for git stash && git checkout pattern
    if re.search(r'git\s+stash.*?&&.*?git\s+checkout', command):
        return True

    # Only flag if git checkout is combined with verification commands
    has_verification = any(re.search(pattern, command) for pattern in VERIFICATION_COMMANDS)
    has_git_checkout = re.search(r'git\s+checkout', command)

    return has_verification and has_git_checkout


def emit_deny(reason):
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(output))
    sys.exit(0)


def emit_allow():
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
    sys.exit(0)


def main():
    # Read tool use event from stdin
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})

        # Only check Bash tool calls
        if tool_name != "Bash":
            emit_allow()

        command = tool_input.get("command", "")

        if not command:
            emit_allow()

        # Check if this looks like checking previous commits for errors
        if is_checking_previous_commit(command):
            # Block the command and provide helpful feedback
            emit_deny(
                "⚠️  CHECKING FOR PRE-EXISTING ERRORS IS UNNECESSARY\n\n"
                "Your project uses pre-commit hooks that enforce all tests pass before commits.\n"
                "Therefore, ALL test failures and errors are from your current changes.\n\n"
                "Do not check if errors were pre-existing. Pre-commit hooks guarantee they weren't.\n\n"
                "What you should do instead:\n"
                "1. Read the error messages from the current test run\n"
                "2. Fix the errors directly\n"
                "3. Run tests again to verify the fix\n\n"
                "Checking git history for errors is wasting time when pre-commit hooks enforce quality.\n\n"
                "Blocked command:\n"
                f"{command[:200]}"  # Show first 200 chars of command
            )

        # Allow command if not checking for pre-existing errors
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
        return
    except Exception as e:
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")
        return


if __name__ == "__main__":
    main()
