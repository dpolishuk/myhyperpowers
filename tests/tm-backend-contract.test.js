const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const fs = require("node:fs")

const repoRoot = path.resolve(__dirname, "..")
const tmPath = path.join(repoRoot, "scripts", "tm")
const backendRegistryPath = path.join(repoRoot, "scripts", "tm-backends.sh")

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8")
}

function readBackendsFromRegistry() {
  const result = spawnSync("bash", ["-lc", `source "${backendRegistryPath}" && tm_backend_ids`], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  })

  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim().split("\n").filter(Boolean)
}

test("tm backend registry is shell-readable and lists peer backends", () => {
  assert.equal(fs.existsSync(backendRegistryPath), true)
  assert.deepEqual(readBackendsFromRegistry(), ["bd", "br", "tk", "linear"])
})

test("tm help backend list stays aligned with backend registry", () => {
  const help = spawnSync(tmPath, ["--help"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  })

  assert.equal(help.status, 0, help.stderr)
  const expectedHelpLines = [
    ["bd", "Local beads task manager (default)"],
    ["br", "Local beads_rust task manager"],
    ["tk", "Ticket git-backed markdown task manager"],
    ["linear", "Linear-native backend option (not yet implemented)"],
  ]

  for (const [backend, description] of expectedHelpLines) {
    assert.equal(help.stdout.includes(`  ${backend}`), true)
    assert.equal(help.stdout.includes(description), true)
  }
})

test("README and QUICKSTART describe the same peer backend set and per-project backend model", () => {
  const readme = read("README.md")
  const quickstart = read("docs/QUICKSTART.md")

  assert.equal(readme.includes("one backend selected per project"), true)
  assert.equal(quickstart.includes("one backend selected per project"), true)

  for (const backend of ["bd", "br", "tk", "linear"]) {
    assert.equal(readme.includes(`\`${backend}\``), true)
    assert.equal(quickstart.includes(`\`${backend}\``), true)
  }
})
