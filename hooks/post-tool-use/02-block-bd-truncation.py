#!/usr/bin/env python3
"""
PostToolUse hook to block truncation markers in .bd command output
"""

import json
import sys

TRUNCATION_MARKERS = (
    "truncated",
    "\ufffd",  # Replacement character
    "…",
)


def has_truncation_marker(value):
    """Return True when hook input appears truncated."""
    return any(marker in value.lower() for marker in TRUNCATION_MARKERS)


def emit_deny(reason):
    """Emit a JSON deny decision and exit."""
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
    """Emit a JSON allow decision and exit."""
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "allow"}}))
    sys.exit(0)


def main():
    """Main hook entry point."""
    # Read tool use event from stdin
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            emit_deny("Hook received empty input. Blocking for safety.")

        if has_truncation_marker(raw_input):
            emit_deny("Hook input appears truncated. Blocking for safety.")

        input_data = json.loads(raw_input)

        if not isinstance(input_data, dict):
            emit_deny("Hook received non-object JSON. Blocking for safety.")

        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input")
        tool_output = input_data.get("tool_output", "")

        # Only check Bash tool calls
        if tool_name != "Bash":
            emit_allow()

        if not isinstance(tool_input, dict):
            emit_deny("Hook received malformed tool input type. Blocking for safety.")

        command = tool_input.get("command", "")
        if not isinstance(command, str):
             emit_deny("Hook received malformed command type. Blocking for safety.")

        # Check both bd and tm commands
        cmd_stripped = command.strip()
        if not (cmd_stripped.startswith("bd") or cmd_stripped.startswith("tm")):
            emit_allow()

        # Check for truncation markers in output
        if has_truncation_marker(str(tool_output)):
            # Block the result and provide helpful feedback
            emit_deny(
                "🚫 BEADS OUTPUT TRUNCATED\n\n"
                "The output of the 'bd' command appears to be truncated.\n\n"
                "Why this is blocked:\n"
                "- Truncated task lists lead to incomplete context\n"
                "- Important metadata or dependencies may be missing\n"
                "- Decisions made on partial data are risky\n\n"
                "To fix this:\n"
                "1. Narrow your search (e.g., use 'bd list --parent ID' instead of 'bd list')\n"
                "2. Use specific filters (e.g., '--status open')\n"
                "3. Request the full output using 'bd show ID' for individual items"
            )

        # Allow command if no truncation detected
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
    except Exception as e:  # noqa: BLE001 — fail-closed on any unexpected error
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")


if __name__ == "__main__":
    main()
