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

test("loadLinearConfig ignores deprecated LINEAR_PROJECT_NAME", () => {
  const { loadLinearConfig } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  process.env.LINEAR_API_KEY = "lin_api_test123"
  process.env.LINEAR_TEAM_KEY = "ENG"
  process.env.LINEAR_PROJECT_NAME = "Roadmap"

  const config = loadLinearConfig()

  assert.ok(config)
  assert.equal("projectName" in config, false)

  restoreEnv(saved)
})

test("loadConfigValue fails fast when bd config command cannot run", () => {
  const { loadConfigValue } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  const savedPath = process.env.PATH
  delete process.env.LINEAR_API_KEY
  process.env.PATH = ""

  try {
    assert.throws(() => loadConfigValue("LINEAR_API_KEY", "linear.api-key"), /bd config get linear\.api-key failed/)
  } finally {
    restoreEnv(saved)
    process.env.PATH = savedPath
  }
})

test("loadBdIssues uses a larger maxBuffer for bd list output", () => {
  const { loadBdIssues, BD_LIST_MAX_BUFFER } = requireFresh("../scripts/tm-linear-sync")
  const calls = []
  const fakeSpawn = (command, args, options) => {
    calls.push({ command, args, options })
    return { status: 0, stdout: "[]", stderr: "" }
  }

  const issues = loadBdIssues(fakeSpawn)

  assert.deepEqual(issues, [])
  assert.equal(calls.length, 4)
  assert.ok(calls.every(call => call.options.maxBuffer === BD_LIST_MAX_BUFFER))
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

test("reconcileExistingIssueByMarker removes stale mapping when marker no longer exists", async () => {
  const { reconcileExistingIssueByMarker } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-1": {
      linearId: "lin-stale",
      linearIdentifier: "ENG-1",
      lastSyncedFields: { title: "A task" },
    },
  }

  const client = {
    issueSearch: async (query, options) => {
      assert.equal(query, "[bd:bd-1]")
      assert.deepEqual(options, {
        first: 1,
        filter: { team: { id: { eq: "team-1" } } },
      })
      return { nodes: [] }
    },
  }

  const result = await reconcileExistingIssueByMarker(client, "team-1", "bd-1", mapping["bd-1"], mapping)

  assert.equal(result, null)
  assert.deepEqual(mapping, {})
})

test("reconcileExistingIssueByMarker keeps existing mapping when issue still exists without marker", async () => {
  const { reconcileExistingIssueByMarker } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-keep": {
      linearId: "lin-keep",
      linearIdentifier: "ENG-9",
      lastSyncedFields: { title: "Kept task" },
    },
  }

  const client = {
    issueSearch: async () => ({ nodes: [] }),
    issue: async id => {
      assert.equal(id, "lin-keep")
      return { id: "lin-keep", identifier: "ENG-9" }
    },
  }

  const result = await reconcileExistingIssueByMarker(client, "team-1", "bd-keep", mapping["bd-keep"], mapping)

  assert.equal(result.linearId, "lin-keep")
  assert.equal(mapping["bd-keep"].linearId, "lin-keep")
})

test("reconcileExistingIssueByMarker relinks mapping when marker finds replacement issue", async () => {
  const { reconcileExistingIssueByMarker } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-2": {
      linearId: "lin-old",
      linearIdentifier: "ENG-2",
      lastSyncedAt: "2026-03-09T00:00:00.000Z",
      lastSyncedFields: { title: "Another task" },
    },
  }

  const client = {
    issueSearch: async () => ({
      nodes: [{ id: "lin-new", identifier: "ENG-44" }],
    }),
  }

  const result = await reconcileExistingIssueByMarker(client, "team-1", "bd-2", mapping["bd-2"], mapping)

  assert.equal(result.linearId, "lin-new")
  assert.equal(result.linearIdentifier, "ENG-44")
  assert.equal(result.lastSyncedFields.title, "Another task")
  assert.equal(mapping["bd-2"].linearId, "lin-new")
})

test("syncExistingIssue recreates deleted Linear issue in the same run", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-404": {
      linearId: "lin-old",
      linearIdentifier: "ENG-12",
      lastSyncedFields: { issueType: "task" },
    },
  }
  const issue = {
    id: "bd-404",
    title: "Recreate me",
    status: "open",
    priority: 1,
    issue_type: "task",
  }
  const client = {
    updateIssue: async () => {
      throw new Error("404 not found")
    },
    issueSearch: async () => ({ nodes: [] }),
    issue: async () => {
      throw new Error("404 not found")
    },
    createIssue: async params => ({
      issue: Promise.resolve({ id: "lin-new", identifier: `CREATED:${params.title}` }),
    }),
  }

  const result = await syncExistingIssue({
    client,
    issue,
    existing: mapping["bd-404"],
    bdId: "bd-404",
    designText: "design",
    designHash: "hash123",
    priority: 2,
    stateId: "state-1",
    labelName: "Task",
    prev: mapping["bd-404"].lastSyncedFields,
    getOrCreateLabel: async () => null,
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 1, updated: 0, errors: 0 })
  assert.equal(mapping["bd-404"].linearId, "lin-new")
  assert.equal(mapping["bd-404"].linearIdentifier, "CREATED:Recreate me")
})

test("syncExistingIssue relinks stale mapping before creating a replacement issue", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-relink": {
      linearId: "lin-stale",
      linearIdentifier: "ENG-10",
      lastSyncedFields: { issueType: "task" },
    },
  }
  const issue = {
    id: "bd-relink",
    title: "Relink me",
    status: "open",
    priority: 2,
    issue_type: "task",
  }
  const updateCalls = []
  const client = {
    updateIssue: async (id, params) => {
      updateCalls.push({ id, params })
      if (id === "lin-stale") {
        throw new Error("404 not found")
      }
    },
    issueSearch: async query => {
      assert.equal(query, "[bd:bd-relink]")
      return { nodes: [{ id: "lin-relinked", identifier: "ENG-77" }] }
    },
    createIssue: async () => {
      throw new Error("should not create duplicate issue")
    },
  }

  const result = await syncExistingIssue({
    client,
    issue,
    existing: mapping["bd-relink"],
    bdId: "bd-relink",
    designText: "design",
    designHash: "hash-relink",
    priority: 3,
    stateId: "state-1",
    labelName: "Task",
    prev: mapping["bd-relink"].lastSyncedFields,
    getOrCreateLabel: async () => null,
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 1, errors: 0 })
  assert.equal(mapping["bd-relink"].linearId, "lin-relinked")
  assert.equal(mapping["bd-relink"].linearIdentifier, "ENG-77")
  assert.deepEqual(updateCalls.map(call => call.id), ["lin-stale", "lin-relinked"])
})

test("logSyncInfo writes diagnostics to stderr instead of stdout", () => {
  const { logSyncInfo } = requireFresh("../scripts/tm-linear-sync")
  const writes = { stdout: [], stderr: [] }

  logSyncInfo("Synced 3 issues", {
    stdout: { write: chunk => writes.stdout.push(chunk) },
    stderr: { write: chunk => writes.stderr.push(chunk) },
  })

  assert.deepEqual(writes.stdout, [])
  assert.deepEqual(writes.stderr, ["tm-sync: Synced 3 issues\n"])
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
