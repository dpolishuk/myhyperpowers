#!/usr/bin/env python3
"""
PreToolUse hook to block direct reads of .beads/issues.jsonl

The tm/bd CLI provides the correct interface for interacting with tasks.
Direct file access bypasses validation and often fails due to file size.
"""

import json
import sys


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
    # Read tool input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
        return

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Check for file_path in Read tool
    file_path = tool_input.get("file_path", "")

    # Check for path in Grep tool
    grep_path = tool_input.get("path", "")

    # Combine paths to check
    paths_to_check = [file_path, grep_path]

    # Check if any path contains .beads/issues.jsonl
    for path in paths_to_check:
        if path and ".beads/issues.jsonl" in path:
            emit_deny(
                "Direct access to .beads/issues.jsonl is not allowed. "
                "Use tm CLI commands instead: tm show, tm list, tm ready, tm dep tree, etc. "
                "The tm CLI provides the correct interface for reading task specifications."
            )

    # Allow all other reads
    emit_allow()


if __name__ == "__main__":
    main()
