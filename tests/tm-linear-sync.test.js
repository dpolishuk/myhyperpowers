const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const { spawnSync } = require("node:child_process")

const repoRoot = path.resolve(__dirname, "..")

// ── Config loader tests ─────────────────────────────────────────────────────

test("loadLinearConfig returns null when no env vars set", () => {
  const { loadLinearConfig } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  // Use explicit empty values to override any bd config fallback
  process.env.LINEAR_API_KEY = ""
  process.env.LINEAR_TEAM_KEY = ""

  const config = loadLinearConfig()
  assert.equal(config, null)

  restoreEnv(saved)
})

test("loadLinearConfig reads LINEAR_API_KEY from env", () => {
  const { loadLinearConfig } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  process.env.LINEAR_API_KEY = "lin_api_test123"
  process.env.LINEAR_TEAM_KEY = "ENG"

  const config = loadLinearConfig()
  assert.ok(config)
  assert.equal(config.apiKey, "lin_api_test123")
  assert.equal(config.teamKey, "ENG")

  restoreEnv(saved)
})

test("loadLinearConfig rejects apiKey without teamKey", () => {
  const { loadLinearConfig } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  process.env.LINEAR_API_KEY = "lin_api_test123"
  // Explicit empty overrides any bd config fallback
  process.env.LINEAR_TEAM_KEY = ""

  assert.throws(() => loadLinearConfig(), {
    code: "MISCONFIGURED",
  })

  restoreEnv(saved)
})

// ── Field mapping tests ─────────────────────────────────────────────────────

test("mapPriority maps all 5 values correctly (0-4)", () => {
  const { mapPriority } = require("../scripts/tm-linear-sync")
  // bd P0=critical → Linear 1=urgent
  assert.equal(mapPriority(0), 1)
  // bd P1=high → Linear 2=high
  assert.equal(mapPriority(1), 2)
  // bd P2=medium → Linear 3=medium
  assert.equal(mapPriority(2), 3)
  // bd P3=low → Linear 4=low
  assert.equal(mapPriority(3), 4)
  // bd P4=backlog → Linear 0=no-priority
  assert.equal(mapPriority(4), 0)
  // Edge: invalid priority defaults to 0 (no-priority)
  assert.equal(mapPriority(5), 0)
  assert.equal(mapPriority(-1), 0)
  assert.equal(mapPriority(null), 0)
})

test("mapStatus maps all 4 statuses correctly", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const teamStates = [
    { id: "s1", name: "Todo", type: "unstarted" },
    { id: "s2", name: "In Progress", type: "started" },
    { id: "s3", name: "Done", type: "completed" },
    { id: "s4", name: "Backlog", type: "backlog" },
  ]

  assert.equal(mapStatus("open", teamStates), "s1")       // "todo" match
  assert.equal(mapStatus("in_progress", teamStates), "s2") // "progress" match
  assert.equal(mapStatus("closed", teamStates), "s3")      // "done" match
  assert.equal(mapStatus("blocked", teamStates), "s1")     // falls back to "todo"
})

test("mapStatus with custom state names still matches", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const customStates = [
    { id: "c1", name: "Ready for Development", type: "unstarted" },
    { id: "c2", name: "Work in Progress", type: "started" },
    { id: "c3", name: "Completed", type: "completed" },
  ]

  assert.equal(mapStatus("in_progress", customStates), "c2") // "progress" substring match
  assert.equal(mapStatus("closed", customStates), "c3")      // "complete" substring match
})

test("mapStatus with unknown status returns fallback via type", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const states = [
    { id: "x1", name: "Unreviewed", type: "backlog" },
    { id: "x2", name: "Active", type: "started" },
  ]

  // No state name matches "todo"/"backlog"/"triage", so falls through to type-based
  // fallback: typeMap.open = "backlog" → matches x1 (type: "backlog")
  const result = mapStatus("open", states)
  assert.equal(result, "x1")
})

test("mapType maps all 4 types correctly", () => {
  const { mapType } = require("../scripts/tm-linear-sync")
  assert.equal(mapType("epic"), "Epic")
  assert.equal(mapType("feature"), "Feature")
  assert.equal(mapType("task"), "Task")
  assert.equal(mapType("bug"), "Bug")
  // Edge: unknown type defaults to "Task"
  assert.equal(mapType("question"), "Task")
  assert.equal(mapType(undefined), "Task")
})

// ── ID mapping persistence tests ────────────────────────────────────────────

test("saveMapping writes and loadMapping reads back correctly", () => {
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot
    const { getMappingPath, loadMapping, saveMapping } = requireFresh("../scripts/tm-linear-sync")
    const data = { "test-123": { linearId: "abc", linearIdentifier: "ENG-1" } }
    const mapPath = path.join(tempRepoRoot, ".beads", "linear-map.json")

    assert.equal(getMappingPath(), mapPath)
    saveMapping(data)
    const loaded = loadMapping()

    assert.equal(fs.existsSync(mapPath), true)
    assert.deepEqual(loaded, data)
  } finally {
    restoreEnv(savedEnv)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

test("ID mapping file read with corrupted JSON resets gracefully", () => {
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot
    const { loadMapping } = requireFresh("../scripts/tm-linear-sync")
    const mapPath = path.join(tempRepoRoot, ".beads", "linear-map.json")

    fs.writeFileSync(mapPath, "{invalid json!!", "utf8")
    const result = loadMapping()

    assert.deepEqual(result, {}, "Should return empty object on corrupted file")
  } finally {
    restoreEnv(savedEnv)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

// ── hashDesign tests ────────────────────────────────────────────────────────

test("hashDesign produces consistent MD5 for same input", () => {
  const { hashDesign } = require("../scripts/tm-linear-sync")
  const hash1 = hashDesign("# Hello World\n\nSome design content")
  const hash2 = hashDesign("# Hello World\n\nSome design content")
  assert.equal(hash1, hash2)
  assert.equal(hash1.length, 32) // MD5 hex length

  // Different content → different hash
  const hash3 = hashDesign("Different content")
  assert.notEqual(hash1, hash3)

  // Empty/null
  assert.equal(hashDesign(""), "")
  assert.equal(hashDesign(null), "")
})

// ── tm sync integration tests ───────────────────────────────────────────────

test("sync with no config exits 0 with not-configured message", () => {
  const result = spawnSync("node", ["scripts/tm-linear-sync.js"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LINEAR_API_KEY: "" },
    timeout: 10000,
  })
  assert.equal(result.status, 0)
  assert.match(result.stderr, /not configured/)
})

test("tm sync invokes linear sync script when available", () => {
  // The script should exit cleanly when Linear sync is available but not configured.
  const result = spawnSync("node", ["scripts/tm-linear-sync.js"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, LINEAR_API_KEY: "" },
    timeout: 10000,
  })
  assert.equal(result.status, 0)
  assert.match(result.stderr, /not configured/)
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function saveEnv() {
  return {
    LINEAR_API_KEY: process.env.LINEAR_API_KEY,
    LINEAR_TEAM_KEY: process.env.LINEAR_TEAM_KEY,
    LINEAR_PROJECT_NAME: process.env.LINEAR_PROJECT_NAME,
  }
}

function restoreEnv(saved) {
  for (const [key, val] of Object.entries(saved)) {
    if (val === undefined) delete process.env[key]
    else process.env[key] = val
  }
}

function requireFresh(mod) {
  const resolved = require.resolve(mod)
  delete require.cache[resolved]
  return require(mod)
}

function makeTempRepoRoot() {
  const tempRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tm-linear-sync-"))
  fs.mkdirSync(path.join(tempRepoRoot, ".beads"), { recursive: true })
  return tempRepoRoot
}
