#!/usr/bin/env python3
"""
PreToolUse hook to block direct reads of .beads/issues.jsonl

The tm/bd CLI provides the correct interface for interacting with tasks.
Direct file access bypasses validation and often fails due to file size.
"""

import json
import sys
import os

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
            "hookEventName": "PreToolUse",
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
    # Read tool input from stdin
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            emit_deny("Hook received empty input. Blocking for safety.")

        if has_truncation_marker(raw_input):
            emit_deny("Hook input appears truncated. Blocking for safety.")

        input_data = json.loads(raw_input)

        # Defensive: ensure parsed JSON is a dict before calling .get()
        if not isinstance(input_data, dict):
            emit_deny("Hook received non-object JSON. Blocking for safety.")

        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input")

        # Only check if tool_input is a dict
        if not isinstance(tool_input, dict):
            # For non-read tools, we can allow if they don't have tool_input (though they usually do)
            # But for safety, if it's supposed to be a tool call, tool_input should be a dict.
            # Let's check if it's missing entirely.
            if tool_input is None:
                tool_input = {}
            else:
                emit_deny("Hook received malformed tool input type. Blocking for safety.")

        # Check for file_path in Read tool
        file_path = tool_input.get("file_path", "")

        # Check for path in Grep tool
        grep_path = tool_input.get("path", "")

        # Combine paths to check
        paths_to_check = [file_path, grep_path]

        # Check if any path contains .beads/issues.jsonl
        for path in paths_to_check:
            if path and isinstance(path, str):
                normalized_path = os.path.normpath(path).replace("\\", "/")
                if ".beads/issues.jsonl" in normalized_path:
                    emit_deny(
                        "Direct access to .beads/issues.jsonl is not allowed.\n\n"
                        "Use tm CLI commands instead: tm show, tm list, tm ready, tm dep tree, etc.\n"
                        "The tm CLI provides the correct interface for reading task specifications."
                    )

        # Allow all other reads
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed JSON input. Blocking for safety.")
    except Exception as e:  # noqa: BLE001 — fail-closed on any unexpected error
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")


if __name__ == "__main__":
    main()
