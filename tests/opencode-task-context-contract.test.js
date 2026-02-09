const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

test("OpenCode install docs define task-context orchestrator as active workflow", () => {
  const installDoc = fs.readFileSync(path.join(repoRoot, ".opencode", "INSTALL.md"), "utf8")

  assert.equal(installDoc.includes("task-context-orchestrator.ts"), true)
  assert.equal(installDoc.includes("Active Task Context Workflow"), true)
  assert.equal(installDoc.includes("not the active default"), true)
})

test("OpenCode installer keeps task-context plugin in remove/copy/symlink paths", () => {
  const installer = fs.readFileSync(path.join(repoRoot, "scripts", "install-opencode-plugin.sh"), "utf8")
  const matches = installer.match(/task-context-orchestrator\.ts/g) || []

  assert.equal(matches.length >= 3, true)
})
