#!/usr/bin/env python3
"""
PreToolUse Hook: Block GitHub Project truncation

Blocks gh project item-create/item-edit with truncated descriptions.
Prevents same issue that affected bd tasks.
"""

import sys
import json
import re

TRUNCATION_PATTERNS = [
    r'\[.*truncat.*\]',      # [truncated], [Remaining ... truncated]
    r'\[\s*\.\s*\]',           # [...], [ . ]
    r'\[Omitted.*\]',         # [Omitted], [Omitted for brevity]
    r'\[Remaining.*\]',        # [Remaining steps truncated]
    r'\(truncated\)',          # (truncated)
    r'\(abbreviated\)',        # (abbreviated)
    r'\[etc\.\]',              # [etc.]
]


def contains_truncation_markers(text):
    """Check if text contains any truncation markers"""
    if not text:
        return False

    text_lower = text.lower()

    for pattern in TRUNCATION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True, pattern

    return False, None


def should_block_gh_command(tool_name, tool_input):
    """Check if tool call is gh project item-create/item-edit with truncation"""
    if tool_name != "Bash":
        return (False, None)

    command = tool_input.get("command", "")
    if not command:
        return (False, None)

    # Only block gh project item-create and item-edit
    if not (re.search(r'gh\s+project\s+item-(create|edit)', command)):
        return (False, None)

    # Extract the body/description part of the command
    # Look for --body flag or direct body argument
    body_match = re.search(r'--body\s+[\'"]?([^\s\'"]+)', command)
    if not body_match:
        # Try to find body in the raw command string
        # gh project item-create accepts body as a positional argument after flags
        # Look for quoted strings or multi-line content
        body_match = re.search(r'[\'"]([^\s\'"]+)[\'"]', command)

    if not body_match:
        return (False, None)

    body_text = body_match.group(1) if body_match else ""

    # Check for truncation markers
    has_truncation, pattern = contains_truncation_markers(body_text)

    if has_truncation:
        return (True, pattern)

    return (False, None)


def main():
    # Read hook input from stdin
    input_data = json.load(sys.stdin)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    result = should_block_gh_command(tool_name, tool_input)
    should_block = result[0] if isinstance(result, tuple) else False
    pattern = result[1] if isinstance(result, tuple) and len(result) > 1 else None

    if should_block:
        error_message = """❌ Truncated description detected in gh project command.

Cannot create/update items with truncated descriptions.
Truncated items lead to incomplete implementations.

Action required:
1. Write complete description (all steps, all code examples)
2. Avoid placeholders like [truncated], [...], [etc.], (truncated)
3. Include all implementation details (exact file paths, complete code)

Skills that generate complete specifications:
- hyperpowers:writing-gh-plans (creates epic/task details)
- hyperpowers:executing-gh-plans (works through tasks)

Rewrite command with full description."""

        # Return blocking decision
        output = {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "errorMessage": error_message
            }
        }

        print(json.dumps(output))
        sys.exit(0)

    # Allow operation
    print(json.dumps({}))
    sys.exit(0)

    if should_block:
        error_message = f"""❌ Truncated description detected in gh project command.

Found truncation pattern: {pattern}

Cannot create/update items with truncated descriptions.
Truncated items lead to incomplete implementations.

Action required:
1. Write the complete description (all steps, all code examples)
2. Avoid placeholders like [truncated], [...], [etc.], (truncated)
3. Include all implementation details (exact file paths, complete code)

Skills that generate complete specifications:
- hyperpowers:writing-gh-plans (creates epic/task details)
- hyperpowers:executing-gh-plans (works through tasks)

Rewrite command with full description."""

        # Return blocking decision
        output = {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "errorMessage": error_message
            }
        }

        print(json.dumps(output))
        sys.exit(0)

    # Allow operation
    print(json.dumps({}))
    sys.exit(0)


if __name__ == "__main__":
    main()
