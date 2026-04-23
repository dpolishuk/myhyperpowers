#!/usr/bin/env python3
"""
PreToolUse hook to block writes to secret and environment files.

Prevents accidental exposure or modification of sensitive files such as
.env files, private keys, and certificates.
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


def is_secret_file(file_path):
    """Check if a file path is a secret/sensitive file."""
    if not file_path:
        return False

    basename = os.path.basename(file_path)

    # Check for .env files (including .env.local, .env.production, etc.)
    if basename == ".env" or basename.startswith(".env."):
        return True

    # Check for common SSH private/public keys
    if basename in (
        "id_rsa", "id_rsa.pub",
        "id_ed25519", "id_ed25519.pub",
        "id_ecdsa", "id_ecdsa.pub",
        "id_dsa", "id_dsa.pub",
    ):
        return True

    # Check for certificates, keys and direnv
    if (
        basename.endswith((".key", ".pem", ".p12", ".pfx", ".crt"))
        or basename == ".envrc"
    ):
        return True

    return False


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
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            emit_deny("Hook received empty input. Blocking for safety.")

        if has_truncation_marker(raw_input):
            emit_deny("Hook input appears truncated. Blocking for safety.")

        input_data = json.loads(raw_input)
    except json.JSONDecodeError:
        emit_deny("Hook received malformed JSON input. Blocking for safety.")
    except Exception as e:  # noqa: BLE001 — fail-closed on any unexpected error
        emit_deny(f"Hook encountered an unexpected error during parsing: {e}. Blocking for safety.")

    if not isinstance(input_data, dict):
        emit_deny("Hook received non-object JSON. Blocking for safety.")
        return

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input")

    # Check all write-capable tools
    if tool_name not in ("Edit", "Write", "NotebookEdit"):
        emit_allow()

    if not isinstance(tool_input, dict):
        emit_deny("Hook received malformed tool input type. Blocking for safety.")

    # Check file paths across tool variants
    file_path = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("notebook_path")
    )

    if not file_path or not isinstance(file_path, str):
        emit_allow()

    if is_secret_file(file_path):
        emit_deny(
            f"🚫 SECRET FILE WRITE BLOCKED\n\n"
            f"Attempted to write: {file_path[:200]}{'...' if len(file_path) > 200 else ''}\n\n"
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
