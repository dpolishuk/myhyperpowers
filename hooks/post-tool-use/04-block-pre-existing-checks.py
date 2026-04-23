#!/usr/bin/env python3
"""
PostToolUse hook to block git checkouts without verification
"""

import json
import sys
import re

# Patterns that require verification after checkout
CHECKOUT_PATTERNS = [
    r'\bgit\s+checkout\b',
    r'\bgit\s+switch\b',
]

# Patterns that indicate a verification or cleanup step follow
VERIFICATION_PATTERNS = [
    r'node\s+--test',
    r'npm\s+test',
    r'npm\s+run\s+test',
    r'bun\s+test',
    r'pytest',
    r'go\s+test',
    r'cargo\s+test',
    r'npm\s+run\s+lint',
    r'npm\s+ci',
    r'npm\s+install',
    r'bun\s+install',
]

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

        # Only check Bash tool calls
        if tool_name != "Bash":
            emit_allow()

        if not isinstance(tool_input, dict):
            emit_deny("Hook received malformed tool input type. Blocking for safety.")

        command = tool_input.get("command", "")

        # Check if this is a checkout/switch command
        is_checkout = any(re.search(p, command, re.IGNORECASE) for p in CHECKOUT_PATTERNS)

        if is_checkout:
            # Check if command includes a verification or cleanup step (via && or ;)
            has_verification = any(re.search(p, command, re.IGNORECASE) for p in VERIFICATION_PATTERNS)

            # If it's a bare checkout without verification, block it
            if not has_verification:
                # Exception: checking out a single file/branch is allowed ONLY if it's the entire command
                # git checkout path/to/file.ts
                if re.fullmatch(r'\s*git\s+(?:checkout|switch)\s+[\w./-]+\s*', command, re.IGNORECASE):
                    emit_allow()

                # Exception: checking out a specific SHA or branch without moving worktree state
                # is allowed if followed by a new session, but here we enforce the pattern
                # "git checkout branch && npm ci && node --test"

                emit_deny(
                    "🚫 UNVERIFIED WORKTREE CHANGE BLOCKED\n\n"
                    f"Command: {command[:200]}{'...' if len(command) > 200 else ''}\n\n"
                    "Git checkouts and switches must be followed by verification steps.\n\n"
                    "Why this is blocked:\n"
                    "- Switching branches changes the underlying codebase state\n"
                    "- Dependencies, environment variables, or build artifacts may become stale\n"
                    "- Running code after a checkout without 'npm ci' or 'test' is dangerous\n\n"
                    "To fix this, combine checkout with verification:\n"
                    "Example: git checkout main && npm ci && node --test tests/verify.test.js\n"
                    "Example: git switch feature && npm run test:ci-local"
                )

        # Allow command if not checking for pre-existing errors
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
    except Exception as e:  # noqa: BLE001 — fail-closed on any unexpected error
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")


if __name__ == "__main__":
    main()
