#!/usr/bin/env python3
"""
PreToolUse hook to block destructive Bash commands.

Prevents dangerous operations that can destroy data, compromise security,
or disrupt the system.
"""

import json
import sys
import re
import shlex

# Patterns for dangerous commands
DANGEROUS_PATTERNS = [
    # rm -rf / or rm -rf ~ (and variants)
    r'\brm\s+.*-\S*f\S*\s+.*(?:/|~|\$HOME)',
    r'\brm\s+.*(?:/|~|\$HOME)\s+.*-\S*f\S*',
    # git push --force
    r'\bgit\s+push\s+.*--force\b',
    r'\bgit\s+push\s+.*-f\b',
    # git reset --hard
    r'\bgit\s+reset\s+.*--hard\b',
    # sudo / su
    r'\bsudo\b',
    r'\bsu\s+-',
    r'^su\s*$',
    # curl | bash / wget | bash
    r'\bcurl\b.*\|\s*\b(?:bash|sh|zsh)\b',
    r'\bwget\b.*\|\s*\b(?:bash|sh|zsh)\b',
    # docker system prune -f
    r'\bdocker\s+system\s+prune\b',
]


def is_dangerous(command):
    """Check if a bash command is dangerous."""
    if not command:
        return False

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True

    return False


def emit_deny(reason):
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
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
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
        return
    except Exception as e:
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")
        return

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only check Bash tool calls
    if tool_name != "Bash":
        emit_allow()

    command = tool_input.get("command", "")

    if is_dangerous(command):
        emit_deny(
            f"🚫 DANGEROUS BASH COMMAND BLOCKED\n\n"
            f"Command: {command[:200]}{'...' if len(command) > 200 else ''}\n\n"
            "This command matches a known dangerous pattern.\n\n"
            "Blocked patterns include:\n"
            "- rm -rf /, rm -rf ~, or similar recursive deletions\n"
            "- git push --force (can overwrite remote history)\n"
            "- git reset --hard (can destroy uncommitted work)\n"
            "- sudo / su (privilege escalation)\n"
            "- curl | bash or wget | bash (arbitrary code execution)\n"
            "- docker system prune -f (destructive cleanup)\n\n"
            "If you believe this is safe, ask the user for explicit permission."
        )

    emit_allow()


if __name__ == "__main__":
    main()
