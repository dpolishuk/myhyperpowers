#!/usr/bin/env python3
"""
PreToolUse hook to block edits to .git/hooks/pre-commit
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

        # Only check Edit and Write tool calls
        if tool_name not in ("Edit", "Write"):
            emit_allow()

        if not isinstance(tool_input, dict):
            emit_deny("Hook received malformed tool input type. Blocking for safety.")

        file_path = tool_input.get("file_path", "") or tool_input.get("path", "")

        # Block direct edits to pre-commit hook
        if file_path and (".git/hooks/pre-commit" in file_path or ".git\\hooks\\pre-commit" in file_path):
            emit_deny(
                "🚫 PRE-COMMIT HOOK MODIFICATION BLOCKED\n\n"
                f"Attempted to edit: {file_path}\n\n"
                "Git hooks should not be edited directly by Claude.\n\n"
                "Why this is blocked:\n"
                "- Pre-commit hooks enforce critical quality standards\n"
                "- Direct edits bypass code review and template updates\n"
                "- Hook modifications should be managed via version controlled templates\n\n"
                "If you need to modify hooks:\n"
                "1. Edit the source hook template in version control\n"
                "2. Use proper tooling (husky, pre-commit framework, etc.)\n"
                "3. Document changes and get them reviewed\n\n"
                "If the hook is causing issues:\n"
                "- Fix the underlying problem the hook detected\n"
                "- Ask the user for permission to modify hooks\n"
                "- Document why the modification is necessary"
            )

        # Allow all other edits
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
    except Exception as e:  # noqa: BLE001 — fail-closed on any unexpected error
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")


if __name__ == "__main__":
    main()
