# Testing Guide

This document covers how to run tests across the different components of Hyperpowers.

## Node.js Built-in Test Runner

The primary test suite uses Node.js's built-in test runner (`node --test`).

```bash
node --test tests/*.test.js
```

This runs all contract, integration, and hook safety tests in the `tests/` directory. These tests validate:
- Skill and agent structure contracts
- Codex wrapper sync integrity
- Hook blocking behavior
- Install script correctness
- Task-management (`tm`) backend contracts

## Bun Tests

Some tests require Bun (for TypeScript support and OpenCode plugin validation):

```bash
bun test tests/pi-agent-routing.test.ts tests/install-script.test.js tests/pi-smoke.test.ts
```

These cover Pi extension integration and OpenCode-specific install paths.

## Gemini Extension Tests

The Gemini extension has its own test suite in `.gemini-extension/tests/`:

```bash
node --test .gemini-extension/tests/*.test.js
```

These tests validate the extension manifest, MCP server behavior, and Linear backend integration. They run with the Node.js built-in runner and do not require Python dependencies in the test environment.

## Hook Testing Methodology

Hooks that run as standalone processes (Python and Bash hooks) are tested via stdin/stdout JSON piping. The test harness constructs a JSON payload matching the hook's expected input format, pipes it to the hook process, and validates the JSON response.

### Python Hooks

Python hooks read JSON from stdin and write JSON to stdout. The test harness verifies:
1. **Blocked input returns deny** — For known dangerous operations, the hook returns `"permissionDecision": "deny"` inside `hookSpecificOutput`.
2. **Allowed input returns allow** — For safe operations, the hook returns `"permissionDecision": "allow"` inside `hookSpecificOutput`.
3. **Malformed JSON returns deny** — Security hooks fail-closed on parse errors.
4. **Empty stdin returns deny** — Missing input is treated as a parse error.
5. **Stdout is valid JSON** — Every response must be parseable.

Example test pattern (from `tests/hooks-safety.test.js`):

```javascript
const { execFileSync } = require("child_process")
const test = require("node:test")
const assert = require("node:assert/strict")

test("hook returns deny for valid blocked input", () => {
  const input = JSON.stringify({ 
    tool_name: "Read", 
    tool_input: { file_path: ".beads/issues.jsonl" } 
  })
  const result = execFileSync("python3", ["hooks/block-beads-direct-read.py"], {
    input,
    encoding: "utf-8",
    timeout: 5000,
  })
  const parsed = JSON.parse(result)
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny")
})
```

### Bash Hooks

Bash hooks (e.g., `hooks/session-start.sh`) are tested by invoking them directly and asserting on stdout. Where a hook expects environment variables or filesystem state, the test creates temporary directories or exports variables before invocation.

### Integration Tests

The `hooks/test/integration-test.sh` script runs end-to-end hook validation. It can be executed manually:

```bash
bash hooks/test/integration-test.sh
```

## Codex Wrapper Sync Validation

After modifying any skill, agent, or command, regenerate and verify Codex wrappers:

```bash
# Regenerate wrappers
node scripts/sync-codex-skills.js --write

# Verify no drift (CI-enforced)
node scripts/sync-codex-skills.js --check
```

The `--check` mode ensures all generated wrappers match their canonical sources exactly.

## Security Audit

Run an npm audit before pushing changes:

```bash
npm audit --audit-level=moderate
```

This is enforced in CI to prevent the introduction of known vulnerabilities.
