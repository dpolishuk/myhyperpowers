#!/usr/bin/env python3
"""
PostToolUse hook to block tm/bd create/update commands with truncation markers.

Prevents incomplete task specifications from being saved, which causes
confusion and incomplete implementation later.

Truncation markers include:
- [Remaining step groups truncated for length]
- [truncated]
- [... (more)]
- [etc.]
- [Omitted for brevity]
"""

import json
import sys
import re

# Truncation markers to detect
TRUNCATION_PATTERNS = [
    r'\[Remaining.*?truncated',
    r'\[truncated',
    r'\[\.\.\..*?\]',
    r'\[etc\.?\]',
    r'\[Omitted.*?\]',
    r'\[More.*?omitted\]',
    r'\[Full.*?not shown\]',
    r'\[Additional.*?omitted\]',
    r'\.\.\..*?\[',  # ... [something]
    r'\(truncated\)',
    r'\(abbreviated\)',
]


def check_for_truncation(text):
    """Check if text contains any truncation markers."""
    if not text:
        return None

    for pattern in TRUNCATION_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0)

    return None


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

        # Check if this is a tm/bd create, update, or edit command
        if not command or not re.search(r'\b(tm|bd)\s+(create|update|edit)\b', command):
            emit_allow()

        # Check for truncation markers
        truncation_marker = check_for_truncation(command)

        if truncation_marker:
            # Block the command and provide helpful feedback
            emit_deny(
                f"⚠️  TASK TRUNCATION DETECTED\n\n"
                f"Found truncation marker: {truncation_marker}\n\n"
                f"This task specification appears incomplete or truncated. "
                f"Saving incomplete specifications leads to confusion and incomplete implementations.\n\n"
                f"Please:\n"
                f"1. Expand the full implementation details\n"
                f"2. Include ALL step groups and tasks\n"
                f"3. Do not use truncation markers like '[Remaining steps truncated]'\n"
                f"4. Ensure every step has complete, actionable instructions\n\n"
                f"If the specification is too long:\n"
                f"- Break into smaller epics\n"
                f"- Use tm dependencies to link related tasks\n"
                f"- Focus on making each task independently complete\n\n"
                f"DO NOT truncate task specifications."
            )

        # Allow command if no truncation detected
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
        return
    except Exception as e:
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")
        return


if __name__ == "__main__":
    main()
