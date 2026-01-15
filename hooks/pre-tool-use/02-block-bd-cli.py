#!/usr/bin/env python3
"""
PreToolUse Hook: Block bd CLI commands

Blocks any attempt to run bd CLI commands.
GitHub Projects is now the single source of truth for task management.
"""

import sys
import json
import re

def should_block_bd_command(tool_name, tool_input):
    """Check if tool call is attempting to use bd CLI"""
    if tool_name != "Bash":
        return False

    command = tool_input.get("command", "")
    if not command:
        return False

    # Block commands starting with 'bd ' or 'bd '
    if re.match(r'^\s*bd\s', command):
        return True

    return False


def main():
    # Read hook input from stdin
    input_data = json.load(sys.stdin)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if should_block_bd_command(tool_name, tool_input):
        error_message = """❌ bd CLI is deprecated in Hyperpowers.

GitHub Projects is now the single source of truth for task management.

Use GitHub Projects commands instead:
- /hyperpowers:set-gh-project - Configure GitHub Project
- /hyperpowers:write-gh-plan - Create epic and tasks
- /hyperpowers:execute-gh-plan - Execute tasks
- /hyperpowers:manage-gh-projects - Advanced operations

See docs for migration from bd to GitHub Projects."""

        # Return blocking decision
        output = {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "errorMessage": error_message
            }
        }

        print(json.dumps(output))
        sys.exit(0)

    # Allow operation
    print(json.dumps({}))
    sys.exit(0)


if __name__ == "__main__":
    main()
