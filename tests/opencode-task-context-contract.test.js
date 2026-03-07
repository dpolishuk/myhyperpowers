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

test("OpenCode plugin source contains task-context-orchestrator", () => {
  const pluginDir = path.join(repoRoot, ".opencode", "plugins")
  const files = fs.readdirSync(pluginDir)

  assert.equal(files.includes("task-context-orchestrator.ts"), true)
})
