#!/usr/bin/env python3
"""
PreToolUse hook to block destructive Bash commands.

Prevents dangerous operations that can destroy data, compromise security,
or disrupt the system.
"""

import json
import sys
import re

# Patterns for dangerous commands
DANGEROUS_PATTERNS = [
    # rm -rf / or rm -rf ~ (anchored to root or home)
    r'(?:^|[;|&])\s*rm\b(?=[^;|&]*\s-\S*[rRfF]\S*)(?=[^;|&]*(?:^|\s)(?:/(?:\s|$)|~(?:/|\s|$)|\$HOME(?:/|\s|$)))[^;|&]*',
    # git push --force (but not --force-with-lease)
    r'\bgit\s+push\s+.*--force(?!-with-lease)(?=\s|$)',
    r'\bgit\s+push\s+.*-f(?:\s|$)',
    # git reset --hard
    r'\bgit\s+reset\s+.*--hard\b',
    # sudo / su (anchored to command start/separators)
    r'(?:^|[;|&])\s*sudo\b',
    r'(?:^|[;|&])\s*su(?:\s|$)',
    # curl | bash / wget | bash
    r'\bcurl\b.*\|\s*\b(?:bash|sh|zsh)\b',
    r'\bwget\b.*\|\s*\b(?:bash|sh|zsh)\b',
    # docker system prune -f
    r'\bdocker\s+system\s+prune\b',
]

TRUNCATION_MARKERS = (
    "truncated",
    "\ufffd",  # Replacement character
    "…",
)


def has_truncation_marker(value):
    """Return True when hook input appears truncated."""
    return any(marker in value.lower() for marker in TRUNCATION_MARKERS)


def redact_command(command):
    """Redact common inline credential forms before emitting hook output."""
    if not command:
        return ""
    # Redact common credential patterns
    redacted = re.sub(
        r'(?i)((?:authorization:\s*bearer|api[_-]?key|token|password|secret)[=:\s]+)[^\s\'"`|&;]+',
        r'\1<redacted>',
        command,
    )
    # Redact URLs with auth
    redacted = re.sub(
        r'https?://[^:\s]+:[^@\s]+@',
        r'http://<user>:<password>@',
        redacted
    )
    return redacted


def is_dangerous(command):
    """Check if a bash command is dangerous."""
    if not command:
        return False

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
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

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input")

    # Only check Bash tool calls
    if tool_name != "Bash":
        emit_allow()

    if not isinstance(tool_input, dict):
        emit_deny("Hook received malformed Bash tool input. Blocking for safety.")

    command = tool_input.get("command")
    if not isinstance(command, str) or not command.strip():
        emit_deny("Hook received missing or non-string Bash command. Blocking for safety.")

    if is_dangerous(command):
        safe_command = redact_command(command)
        emit_deny(
            f"🚫 DANGEROUS BASH COMMAND BLOCKED\n\n"
            f"Command: {safe_command[:200]}{'...' if len(safe_command) > 200 else ''}\n\n"
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
