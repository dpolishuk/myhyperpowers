#!/usr/bin/env python3
"""
PreToolUse hook to block writes to secret and environment files.

Prevents accidental exposure or modification of sensitive files such as
.env files, private keys, and certificates.
"""

import json
import sys
import os

# Patterns for secret/sensitive file paths
SECRET_PATTERNS = [
    ".env",
    ".env.",
    ".pem",
    "id_rsa",
    "id_rsa.pub",
    ".key",
]


def is_secret_file(file_path):
    """Check if a file path is a secret/sensitive file."""
    if not file_path:
        return False

    basename = os.path.basename(file_path)
    name, _ = os.path.splitext(basename)

    # Check for .env files (including .env.local, .env.production, etc.)
    if basename == ".env" or basename.startswith(".env."):
        return True

    # Check for .pem files
    if basename.endswith(".pem"):
        return True

    # Check for id_rsa and id_rsa.pub
    if basename in ("id_rsa", "id_rsa.pub"):
        return True

    # Check for .key files
    if basename.endswith(".key"):
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

    # Only check Edit and Write tool calls
    if tool_name not in ("Edit", "Write"):
        emit_allow()

    # Check both file_path and path fields for robustness
    file_path = tool_input.get("file_path", "") or tool_input.get("path", "")

    if not file_path:
        emit_allow()

    if is_secret_file(file_path):
        emit_deny(
            f"🚫 SECRET FILE WRITE BLOCKED\n\n"
            f"Attempted to write: {file_path}\n\n"
            "Writing to secret or environment files is not allowed.\n\n"
            "Blocked file types include:\n"
            "- .env, .env.local, .env.* (environment files)\n"
            "- *.pem (certificates)\n"
            "- id_rsa, id_rsa.pub (SSH keys)\n"
            "- *.key (private keys)\n\n"
            "If you need to modify these files:\n"
            "1. Ask the user for explicit permission\n"
            "2. Use dedicated secret management tools\n"
            "3. Ensure sensitive values are never committed to version control"
        )

    emit_allow()


if __name__ == "__main__":
    main()
