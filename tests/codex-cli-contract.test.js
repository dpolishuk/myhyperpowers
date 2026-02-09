const test = require("node:test")
const assert = require("node:assert/strict")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")

test("sync-codex-skills CLI reports unknown options without stack traces", () => {
  const run = spawnSync("node", ["scripts/sync-codex-skills.js", "--bogus"], {
    cwd: repoRoot,
    encoding: "utf8",
  })

  assert.equal(run.status, 1)
  assert.equal(run.stderr.includes("sync-codex-skills: unknown option: --bogus"), true)
  assert.equal(run.stderr.includes("at Object."), false)
})

test("sync-codex-skills CLI reports runtime failures with concise diagnostics", () => {
  const nonexistentRoot = path.join(os.tmpdir(), `codex-no-root-${Date.now()}`)
  const run = spawnSync("node", ["scripts/sync-codex-skills.js", "--project-root", nonexistentRoot, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  })

  assert.equal(run.status, 1)
  assert.equal(run.stderr.startsWith("sync-codex-skills: "), true)
  assert.equal(run.stderr.includes("at syncCodexSkills"), false)
})
