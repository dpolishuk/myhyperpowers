const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")

const runHook = (hookPath, input) => {
  return execFileSync("python3", [path.join(repoRoot, hookPath)], {
    cwd: repoRoot,
    input: input ?? "",
    encoding: "utf8",
  })
}

const parseOutput = (stdout) => {
  if (!stdout || stdout.trim() === "") {
    return null
  }
  return JSON.parse(stdout)
}

const assertDeny = (stdout, message) => {
  const parsed = parseOutput(stdout)
  assert.ok(parsed, `${message}: stdout should not be empty`)
  const decision =
    parsed.permissionDecision || parsed.hookSpecificOutput?.permissionDecision
  assert.equal(
    decision,
    "deny",
    `${message}: expected permissionDecision=deny but got: ${stdout}`
  )
}

const assertAllow = (stdout, message) => {
  const parsed = parseOutput(stdout)
  assert.ok(parsed, `${message}: stdout should not be empty`)
  const decision =
    parsed.permissionDecision || parsed.hookSpecificOutput?.permissionDecision
  assert.equal(
    decision,
    "allow",
    `${message}: expected permissionDecision=allow but got: ${stdout}`
  )
}

const assertValidJson = (stdout, message) => {
  assert.ok(stdout && stdout.trim() !== "", `${message}: stdout should not be empty`)
  const parsed = JSON.parse(stdout)
  assert.ok(parsed !== null, `${message}: stdout should be valid parseable JSON`)
}

const hooks = [
  {
    name: "block-beads-direct-read",
    path: "hooks/block-beads-direct-read.py",
    blockedInput: JSON.stringify({
      tool_name: "Read",
      tool_input: { file_path: ".beads/issues.jsonl" },
    }),
    allowedInput: JSON.stringify({
      tool_name: "Read",
      tool_input: { file_path: "README.md" },
    }),
  },
  {
    name: "01-block-pre-commit-edits",
    path: "hooks/pre-tool-use/01-block-pre-commit-edits.py",
    blockedInput: JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: ".git/hooks/pre-commit" },
    }),
    allowedInput: JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: "README.md" },
    }),
  },
  {
    name: "02-block-bd-truncation",
    path: "hooks/post-tool-use/02-block-bd-truncation.py",
    blockedInput: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command: "tm create 'title' --design '[Remaining steps truncated]'",
      },
    }),
    allowedInput: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command: "tm create 'title' --design 'complete spec'",
      },
    }),
  },
  {
    name: "03-block-pre-commit-bash",
    path: "hooks/post-tool-use/03-block-pre-commit-bash.py",
    blockedInput: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command: "echo 'hello' > .git/hooks/pre-commit",
      },
    }),
    allowedInput: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command: "echo 'hello' > README.md",
      },
    }),
  },
  {
    name: "04-block-pre-existing-checks",
    path: "hooks/post-tool-use/04-block-pre-existing-checks.py",
    blockedInput: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command: "git checkout abc1234 && pytest",
      },
    }),
    allowedInput: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command: "pytest",
      },
    }),
  },
]

for (const hook of hooks) {
  test(`${hook.name}: returns deny for valid blocked input`, () => {
    const stdout = runHook(hook.path, hook.blockedInput)
    assertValidJson(stdout, hook.name)
    assertDeny(stdout, hook.name)
  })

  test(`${hook.name}: returns allow for valid allowed input`, () => {
    const stdout = runHook(hook.path, hook.allowedInput)
    assertValidJson(stdout, hook.name)
    assertAllow(stdout, hook.name)
  })

  test(`${hook.name}: returns deny for malformed JSON input`, () => {
    const stdout = runHook(hook.path, "{bad json")
    assertValidJson(stdout, hook.name)
    assertDeny(stdout, hook.name)
  })

  test(`${hook.name}: returns deny on empty stdin`, () => {
    const stdout = runHook(hook.path, "")
    assertValidJson(stdout, hook.name)
    assertDeny(stdout, hook.name)
  })

  test(`${hook.name}: stdout is valid parseable JSON`, () => {
    const stdout = runHook(hook.path, hook.blockedInput)
    assertValidJson(stdout, hook.name)
  })
}
