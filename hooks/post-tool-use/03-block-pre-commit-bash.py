#!/usr/bin/env python3
"""
PostToolUse hook to block Bash commands that modify .git/hooks/pre-commit

Catches sneaky modifications through sed, redirection, chmod, mv, cp, etc.
"""

import json
import sys
import re

# Patterns that indicate pre-commit hook modification
PRECOMMIT_MODIFICATION_PATTERNS = [
    # Exact file path matches (anchored by word boundaries or shell-relevant chars)
    r'(?:^|[\s"\'`|&;])\.git/hooks/pre-commit(?:$|[\s"\'`|&;])',
    r'(?:^|[\s"\'`|&;])\.git\\hooks\\pre-commit(?:$|[\s"\'`|&;])',

    # Redirection (anchored)
    r'[012]?>>?\s*\.git/hooks/pre-commit(?:$|[\s"\'`|&;])',

    # sed/awk/perl (targeted)
    r'(?:sed|awk|perl)\b.*-i.*\bpre-commit\b',
    r'(?:sed|awk|perl)\b.*\bpre-commit\b.*[012]?>',

    # Moving/copying (targeted)
    r'\b(?:mv|cp)\b.*\s+\.git/hooks/pre-commit(?:$|[\s"\'`|&;])',

    # chmod (targeted)
    r'\bchmod\b.*\s+\.git/hooks/pre-commit(?:$|[\s"\'`|&;])',

    # echo/cat redirection (targeted)
    r'(?:echo|cat)\b.*[012]?>>?\s*\.git/hooks/pre-commit(?:$|[\s"\'`|&;])',

    # tee (targeted)
    r'\btee\b.*\s+\.git/hooks/pre-commit(?:$|[\s"\'`|&;])',

    # cat heredoc
    r'\bcat\b.*\s*<<.*\bpre-commit\b',
]


def check_precommit_modification(command):
    """Check if command modifies pre-commit hook."""
    if not command:
        return None

    for pattern in PRECOMMIT_MODIFICATION_PATTERNS:
        match = re.search(pattern, command, re.IGNORECASE)
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

        # Check for pre-commit modification
        modification_pattern = check_precommit_modification(command)

        if modification_pattern:
            # Block the command and provide helpful feedback
            emit_deny(
                f"🚫 PRE-COMMIT HOOK MODIFICATION BLOCKED\n\n"
                f"Detected modification attempt via: {modification_pattern}\n"
                f"Command: {command[:200]}{'...' if len(command) > 200 else ''}\n\n"
                "Git hooks should not be modified directly by Claude.\n\n"
                "Why this is blocked:\n"
                "- Pre-commit hooks enforce critical quality standards\n"
                "- Direct modifications bypass code review\n"
                "- Changes can break CI/CD pipelines\n"
                "- Hook modifications should be version controlled\n\n"
                "If you need to modify hooks:\n"
                "1. Edit the source hook template in version control\n"
                "2. Use proper tooling (husky, pre-commit framework, etc.)\n"
                "3. Document changes and get them reviewed\n"
                "4. Never bypass hooks with --no-verify\n\n"
                "If the hook is causing issues:\n"
                "- Fix the underlying problem the hook detected\n"
                "- Ask the user for permission to modify hooks\n"
                "- Use the test-runner agent to handle verbose hook output\n\n"
                "Common mistake: Trying to disable hooks instead of fixing issues."
            )

        # Allow command if no pre-commit modification detected
        emit_allow()
    except json.JSONDecodeError:
        emit_deny("Hook received malformed or empty input. Blocking for safety.")
    except Exception as e:
        emit_deny(f"Hook encountered an unexpected error: {e}. Blocking for safety.")


if __name__ == "__main__":
    main()
