const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")
const hookPath = path.join(repoRoot, "hooks", "user-prompt-submit", "20-cass-context.js")
const contextPath = path.join(repoRoot, "hooks", "context", "cass-context.json")
const errorPath = path.join(repoRoot, "hooks", "context", "cass-errors.log")

const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "cass-hook-"))

const writeStub = (dir, script) => {
  const filePath = path.join(dir, "cm")
  fs.writeFileSync(filePath, script, { mode: 0o755 })
  return filePath
}

const runHook = (stubDir, input) => {
  const stdout = execFileSync("node", [hookPath], {
    cwd: repoRoot,
    env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}` },
    input: JSON.stringify({ text: input }),
  })
  return stdout.toString("utf8")
}

const cleanupHookArtifacts = () => {
  fs.rmSync(contextPath, { force: true })
  fs.rmSync(errorPath, { force: true })
}

test("hook_injects_additional_context", () => {
  const tempDir = createTempDir()
  const payload = JSON.stringify({
    success: true,
    data: {
      relevantBullets: [
        {
          id: "b-1",
          content: "Use hooks for prompt context",
          relevanceScore: 1,
          maturity: "proven",
        },
      ],
      antiPatterns: [],
    },
  })
  const script = `#!/bin/sh\nprintf '%s' '${payload}'\n`

  try {
    writeStub(tempDir, script)
    const output = runHook(tempDir, "hook test")
    const parsed = JSON.parse(output)

    assert.ok(parsed.additionalContext)
    assert.ok(parsed.additionalContext.includes("Cass Memory (rules)"))
    assert.ok(parsed.additionalContext.includes("b-1"))
  } finally {
    cleanupHookArtifacts()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test("hook_returns_empty_on_cm_failure", () => {
  const tempDir = createTempDir()
  const script = "#!/bin/sh\nexit 1\n"

  try {
    writeStub(tempDir, script)
    const output = runHook(tempDir, "hook test")
    const parsed = JSON.parse(output)

    assert.deepEqual(parsed, {})
  } finally {
    cleanupHookArtifacts()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
