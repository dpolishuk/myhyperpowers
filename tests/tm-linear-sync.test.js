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

test("loadConfigValue returns null when env/config are missing and backend lookup is disabled", () => {
  const { loadConfigValue } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  delete process.env.LINEAR_API_KEY
  delete process.env.TM_REPO_ROOT
  process.env.TM_BACKEND = "linear"

  try {
    assert.equal(loadConfigValue("LINEAR_API_KEY", "linear.api-key"), null)
  } finally {
    restoreEnv(saved)
  }
})

test("loadConfigValue reads from project config without bd in PATH", () => {
  const { loadConfigValue } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    delete process.env.LINEAR_API_KEY
    process.env.TM_REPO_ROOT = tempRepoRoot
    fs.writeFileSync(path.join(tempRepoRoot, ".beads", "config.yaml"), "linear.api-key: cfg_key\n")

    assert.equal(loadConfigValue("LINEAR_API_KEY", "linear.api-key"), "cfg_key")
  } finally {
    restoreEnv(saved)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

test("loadConfigValue strips inline YAML comments from quoted values", () => {
  const { loadConfigValue } = requireFresh("../scripts/tm-linear-sync-config")
  const saved = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    delete process.env.LINEAR_API_KEY
    process.env.TM_BACKEND = "linear"
    process.env.TM_REPO_ROOT = tempRepoRoot
    fs.writeFileSync(path.join(tempRepoRoot, ".beads", "config.yaml"), "linear.api-key: 'cfg_key' # note\n")

    assert.equal(loadConfigValue("LINEAR_API_KEY", "linear.api-key"), "cfg_key")
  } finally {
    restoreEnv(saved)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

test("loadConfigValue falls back to backend config when project config is missing", () => {
  const childProcess = require("node:child_process")
  const originalSpawnSync = childProcess.spawnSync
  const calls = []
  const saved = saveEnv()

  childProcess.spawnSync = (command, args, options) => {
    calls.push({ command, args, options })
    return { status: 0, stdout: "backend_cfg_value\n", stderr: "" }
  }

  try {
    delete process.env.LINEAR_API_KEY
    delete process.env.TM_REPO_ROOT
    process.env.TM_BACKEND = "bd"

    const { loadConfigValue } = requireFresh("../scripts/tm-linear-sync-config")
    assert.equal(loadConfigValue("LINEAR_API_KEY", "linear.api-key"), "backend_cfg_value")
    assert.equal(calls.length, 1)
    assert.equal(calls[0].command, "bd")
    assert.deepEqual(calls[0].args, ["config", "get", "linear.api-key"])
  } finally {
    childProcess.spawnSync = originalSpawnSync
    restoreEnv(saved)
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
  assert.equal(mapStatus("blocked", teamStates), null)     // requires explicit blocked state
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

test("mapStatus open falls back to unstarted when no backlog state exists", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const states = [
    { id: "u1", name: "Planned", type: "unstarted" },
    { id: "s1", name: "Doing", type: "started" },
  ]

  assert.equal(mapStatus("open", states), "u1")
})

test("mapStatus blocked returns null when team has no explicit blocked workflow state", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const states = [
    { id: "u1", name: "Todo", type: "unstarted" },
    { id: "s1", name: "In Progress", type: "started" },
    { id: "c1", name: "Done", type: "completed" },
  ]

  assert.equal(mapStatus("blocked", states), null)
})

test("mapStatus blocked prefers an explicit blocked workflow state when available", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const states = [
    { id: "u1", name: "Todo", type: "unstarted" },
    { id: "b1", name: "Blocked", type: "unstarted" },
    { id: "c1", name: "Done", type: "completed" },
  ]

  assert.equal(mapStatus("blocked", states), "b1")
})

test("mapStatus blocked matches custom blocked state names case-insensitively", () => {
  const { mapStatus } = require("../scripts/tm-linear-sync")
  const states = [
    { id: "b1", name: "Temporarily BLOCKED - Vendor", type: "unstarted" },
  ]

  assert.equal(mapStatus("blocked", states), "b1")
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

test("saveMapping writes via temp file and atomic rename", () => {
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()
  const fsModule = require("node:fs")
  const originalWriteFileSync = fsModule.writeFileSync
  const originalRenameSync = fsModule.renameSync
  const calls = []

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot

    fsModule.writeFileSync = (filePath, ...rest) => {
      calls.push({ op: "write", filePath })
      return originalWriteFileSync(filePath, ...rest)
    }
    fsModule.renameSync = (from, to) => {
      calls.push({ op: "rename", from, to })
      return originalRenameSync(from, to)
    }

    const { getMappingPath, saveMapping } = requireFresh("../scripts/tm-linear-sync")
    const mapPath = getMappingPath()
    saveMapping({ "bd-atomic": { linearId: "lin-1" } })

    assert.equal(calls[0].op, "write")
    assert.notEqual(calls[0].filePath, mapPath)
    assert.equal(calls[1].op, "rename")
    assert.equal(calls[1].to, mapPath)
    assert.equal(fs.existsSync(calls[1].from), false)
  } finally {
    fsModule.writeFileSync = originalWriteFileSync
    fsModule.renameSync = originalRenameSync
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

test("loadMapping rejects non-object JSON payloads", () => {
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot
    const { loadMapping } = requireFresh("../scripts/tm-linear-sync")
    const mapPath = path.join(tempRepoRoot, ".beads", "linear-map.json")

    fs.writeFileSync(mapPath, "[]", "utf8")
    assert.deepEqual(loadMapping(), {})

    fs.writeFileSync(mapPath, "null", "utf8")
    assert.deepEqual(loadMapping(), {})
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
        first: 10,
        filter: { team: { id: { eq: "team-1" } } },
      })
      return { nodes: [] }
    },
  }

  const result = await reconcileExistingIssueByMarker(client, "team-1", "bd-1", mapping["bd-1"], mapping)

  assert.equal(result, null)
  assert.deepEqual(mapping, {})
})

test("reconcileExistingIssueByMarker clears synced fields when issue still exists without marker so marker is restored", async () => {
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
  assert.equal("lastSyncedFields" in result, false)
  assert.equal("lastSyncedFields" in mapping["bd-keep"], false)
})

test("reconcileExistingIssueByMarker clears stale synced fields when marker finds replacement issue", async () => {
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
  assert.equal("lastSyncedFields" in result, false)
  assert.equal("lastSyncedFields" in mapping["bd-2"], false)
  assert.equal(mapping["bd-2"].linearId, "lin-new")
})

test("reconcileExistingIssueByMarker rejects ambiguous replacement matches", async () => {
  const { reconcileExistingIssueByMarker } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-dup": {
      linearId: "lin-stale",
      linearIdentifier: "ENG-old",
      lastSyncedFields: { title: "Task" },
    },
  }

  await assert.rejects(
    () => reconcileExistingIssueByMarker(
      {
        issueSearch: async () => ({
          nodes: [
            { id: "lin-1", identifier: "ENG-1" },
            { id: "lin-2", identifier: "ENG-2" },
          ],
        }),
      },
      "team-1",
      "bd-dup",
      mapping["bd-dup"],
      mapping
    ),
    /multiple Linear issues found for \[bd:bd-dup\]/
  )
})

test("findIssueByMarker rejects ambiguous matches even when one matches existingLinearId", async () => {
  const { findIssueByMarker } = requireFresh("../scripts/tm-linear-sync")

  await assert.rejects(
    () => findIssueByMarker({
      client: {
        issueSearch: async () => ({
          nodes: [
            { id: "lin-current", identifier: "ENG-10" },
            { id: "lin-duplicate", identifier: "ENG-11" },
          ],
        }),
      },
      teamId: "team-1",
      bdId: "bd-ambiguous",
      existingLinearId: "lin-current",
    }),
    /multiple Linear issues found for \[bd:bd-ambiguous\]/
  )
})

test("linkIssueByMarkerSearch leaves lastSyncedFields unset so fresh relinks are re-synced", async () => {
  const { linkIssueByMarkerSearch } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {}

  const linked = await linkIssueByMarkerSearch({
    client: {
      issueSearch: async query => {
        assert.equal(query, "[bd:bd-fresh]")
        return { nodes: [{ id: "lin-fresh", identifier: "ENG-55" }] }
      },
    },
    teamId: "team-1",
    bdId: "bd-fresh",
    mapping,
  })

  assert.equal(linked.linearId, "lin-fresh")
  assert.equal(linked.linearIdentifier, "ENG-55")
  assert.equal("lastSyncedFields" in linked, false)
  assert.equal("lastSyncedFields" in mapping["bd-fresh"], false)
})

test("linkIssueByMarkerSearch rejects ambiguous duplicate marker matches", async () => {
  const { linkIssueByMarkerSearch } = requireFresh("../scripts/tm-linear-sync")

  await assert.rejects(
    () => linkIssueByMarkerSearch({
      client: {
        issueSearch: async () => ({
          nodes: [
            { id: "lin-1", identifier: "ENG-1" },
            { id: "lin-2", identifier: "ENG-2" },
          ],
        }),
      },
      teamId: "team-1",
      bdId: "bd-dup",
      mapping: {},
    }),
    /multiple Linear issues found for \[bd:bd-dup\]/
  )
})

test("issueNeedsLabelRepair detects missing type label on unchanged issue", async () => {
  const { issueNeedsLabelRepair } = requireFresh("../scripts/tm-linear-sync")

  const needsRepair = await issueNeedsLabelRepair({
    client: {
      issue: async id => {
        assert.equal(id, "lin-55")
        return {
          labels: async () => ({ nodes: [{ name: "Bug" }] }),
        }
      },
    },
    existing: { linearId: "lin-55" },
    labelName: "Task",
  })

  assert.equal(needsRepair, true)
})

test("issueNeedsLabelRepair detects extra stale owned type labels on unchanged issue", async () => {
  const { issueNeedsLabelRepair } = requireFresh("../scripts/tm-linear-sync")

  const needsRepair = await issueNeedsLabelRepair({
    client: {
      issue: async () => ({
        labels: async () => ({ nodes: [{ name: "Task" }, { name: "Bug" }] }),
      }),
    },
    existing: { linearId: "lin-stale-labels" },
    labelName: "Task",
  })

  assert.equal(needsRepair, true)
})

test("issueNeedsLabelRepair accepts direct label arrays and only passes exact owned label set", async () => {
  const { issueNeedsLabelRepair } = requireFresh("../scripts/tm-linear-sync")

  const exactOwned = await issueNeedsLabelRepair({
    client: {
      issue: async () => ({
        labels: [{ name: "Task" }],
      }),
    },
    existing: { linearId: "lin-direct-labels" },
    labelName: "Task",
  })

  const extraLabel = await issueNeedsLabelRepair({
    client: {
      issue: async () => ({
        labels: [{ name: "Task" }, { name: "Customer" }],
      }),
    },
    existing: { linearId: "lin-direct-extra" },
    labelName: "Task",
  })

  assert.equal(exactOwned, false)
  assert.equal(extraLabel, true)
})

test("prepareExistingIssueForSync forces label repair even when other fields changed", async () => {
  const { prepareExistingIssueForSync } = requireFresh("../scripts/tm-linear-sync")
  const existing = {
    linearId: "lin-55",
    linearIdentifier: "ENG-55",
    lastSyncedFields: {
      title: "Old title",
      status: "open",
      priority: 2,
      issueType: "task",
      designHash: "old-hash",
    },
  }
  const issue = {
    id: "bd-55",
    title: "New title",
    status: "open",
    priority: 2,
    issue_type: "task",
  }

  const prepared = await prepareExistingIssueForSync({
    client: {
      issueSearch: async () => ({
        nodes: [{ id: "lin-55", identifier: "ENG-55" }],
      }),
      issue: async id => {
        assert.equal(id, "lin-55")
        return {
          labels: async () => ({ nodes: [{ name: "Bug" }] }),
        }
      },
    },
    teamId: "team-1",
    bdId: "bd-55",
    issue,
    designHash: "new-hash",
    labelName: "Task",
    existing,
    mapping: { "bd-55": existing },
  })

  assert.equal(prepared.existing.linearId, "lin-55")
  assert.equal(prepared.forceLabelSync, true)
  assert.deepEqual(prepared.prev, existing.lastSyncedFields)
  assert.equal(prepared.skipUpdate, false)
})

test("prepareExistingIssueForSync recomputes changed after relink clears lastSyncedFields", async () => {
  const { prepareExistingIssueForSync } = requireFresh("../scripts/tm-linear-sync")
  const existing = {
    linearId: "lin-stale",
    linearIdentifier: "ENG-stale",
    lastSyncedFields: {
      title: "Same title",
      status: "open",
      priority: 2,
      issueType: "task",
      designHash: "same-hash",
    },
  }
  const issue = {
    id: "bd-relink-changed",
    title: "Same title",
    status: "open",
    priority: 2,
    issue_type: "task",
  }
  const mapping = { "bd-relink-changed": existing }

  const prepared = await prepareExistingIssueForSync({
    client: {
      issueSearch: async () => ({
        nodes: [{ id: "lin-replacement", identifier: "ENG-new" }],
      }),
      issue: async () => ({
        labels: async () => ({ nodes: [{ name: "Task" }] }),
      }),
    },
    teamId: "team-1",
    bdId: "bd-relink-changed",
    issue,
    designHash: "same-hash",
    labelName: "Task",
    existing,
    mapping,
  })

  // After relink, lastSyncedFields is cleared, so prev is empty and everything
  // should be considered "changed" — skipUpdate must be false even though the
  // label is already present and original fields matched.
  assert.equal(prepared.skipUpdate, false)
  assert.equal(prepared.existing.linearId, "lin-replacement")
  assert.deepEqual(prepared.prev, {})
})

test("prepareExistingIssueForSync relinks moved marker before applying changed-field updates", async () => {
  const { prepareExistingIssueForSync } = requireFresh("../scripts/tm-linear-sync")
  const existing = {
    linearId: "lin-stale",
    linearIdentifier: "ENG-stale",
    lastSyncedFields: {
      title: "Old title",
      status: "open",
      priority: 2,
      issueType: "task",
      designHash: "same-hash",
    },
  }
  const mapping = { "bd-moved": existing }
  const issue = {
    id: "bd-moved",
    title: "New title",
    status: "open",
    priority: 2,
    issue_type: "task",
  }

  const prepared = await prepareExistingIssueForSync({
    client: {
      issueSearch: async () => ({
        nodes: [{ id: "lin-current", identifier: "ENG-44" }],
      }),
      issue: async () => ({
        labels: async () => ({ nodes: [{ name: "Task" }] }),
      }),
    },
    teamId: "team-1",
    bdId: "bd-moved",
    issue,
    designHash: "same-hash",
    labelName: "Task",
    existing,
    mapping,
  })

  assert.equal(prepared.existing.linearId, "lin-current")
  assert.equal(mapping["bd-moved"].linearId, "lin-current")
  assert.equal(prepared.skipUpdate, false)
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
    getOrCreateLabel: async () => "label-task",
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

test("syncExistingIssue treats relink search failures as per-issue errors", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-search-fail": {
      linearId: "lin-stale",
      linearIdentifier: "ENG-13",
      lastSyncedFields: { issueType: "task" },
    },
  }
  const issue = {
    id: "bd-search-fail",
    title: "Search failure",
    status: "open",
    priority: 2,
    issue_type: "task",
  }

  const result = await syncExistingIssue({
    client: {
      updateIssue: async () => {
        throw new Error("404 not found")
      },
      issueSearch: async () => {
        throw new Error("linear search timeout")
      },
    },
    issue,
    existing: mapping["bd-search-fail"],
    bdId: "bd-search-fail",
    designText: "design",
    designHash: "hash-search",
    priority: 3,
    stateId: "state-1",
    labelName: "Task",
    prev: mapping["bd-search-fail"].lastSyncedFields,
    getOrCreateLabel: async () => null,
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 0, errors: 1 })
  assert.equal(mapping["bd-search-fail"].linearId, "lin-stale")
})

test("syncExistingIssue can force label repair even when issue type is unchanged", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const updateCalls = []

  const result = await syncExistingIssue({
    client: {
      updateIssue: async (id, params) => {
        updateCalls.push({ id, params })
      },
    },
    issue: {
      id: "bd-label-fix",
      title: "Repair label",
      status: "open",
      priority: 2,
      issue_type: "task",
    },
    existing: {
      linearId: "lin-label-fix",
      linearIdentifier: "ENG-88",
      lastSyncedFields: { issueType: "task" },
    },
    bdId: "bd-label-fix",
    designText: "design",
    designHash: "hash-label-fix",
    priority: 3,
    stateId: "state-1",
    labelName: "Task",
    prev: { issueType: "task" },
    forceLabelSync: true,
    getOrCreateLabel: async () => "label-1",
    mapping: {},
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 1, errors: 0 })
  assert.deepEqual(updateCalls, [{
    id: "lin-label-fix",
    params: {
      title: "Repair label",
      description: "design\n\n<!-- [bd:bd-label-fix] -->",
      priority: 3,
      stateId: "state-1",
      labelIds: ["label-1"],
    },
  }])
})

test("syncExistingIssue preserves forceLabelSync when retrying after relink", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const updateCalls = []
  const mapping = {
    "bd-force-relink": {
      linearId: "lin-stale",
      linearIdentifier: "ENG-90",
      lastSyncedFields: { issueType: "task" },
    },
  }

  const result = await syncExistingIssue({
    client: {
      updateIssue: async (id, params) => {
        updateCalls.push({ id, params })
        if (id === "lin-stale") throw new Error("404 not found")
      },
      issueSearch: async () => ({ nodes: [{ id: "lin-fixed", identifier: "ENG-91" }] }),
    },
    issue: {
      id: "bd-force-relink",
      title: "Repair relinked label",
      status: "open",
      priority: 2,
      issue_type: "task",
    },
    existing: mapping["bd-force-relink"],
    bdId: "bd-force-relink",
    designText: "design",
    designHash: "hash-force-relink",
    priority: 3,
    stateId: "state-1",
    labelName: "Task",
    prev: { issueType: "task" },
    forceLabelSync: true,
    getOrCreateLabel: async () => "label-1",
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 1, errors: 0 })
  assert.deepEqual(updateCalls, [
    {
      id: "lin-stale",
      params: {
        title: "Repair relinked label",
        description: "design\n\n<!-- [bd:bd-force-relink] -->",
        priority: 3,
        stateId: "state-1",
        labelIds: ["label-1"],
      },
    },
    {
      id: "lin-fixed",
      params: {
        title: "Repair relinked label",
        description: "design\n\n<!-- [bd:bd-force-relink] -->",
        priority: 3,
        stateId: "state-1",
        labelIds: ["label-1"],
      },
    },
  ])
})

test("syncExistingIssue reports rate-limit failures as deterministic per-issue errors", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-rate-limit": {
      linearId: "lin-rate-limit",
      linearIdentifier: "ENG-429",
      lastSyncedAt: "2026-03-29T00:00:00.000Z",
      lastSyncedFields: { issueType: "task" },
    },
  }
  const originalEntry = JSON.parse(JSON.stringify(mapping["bd-rate-limit"]))

  const result = await syncExistingIssue({
    client: {
      updateIssue: async () => {
        throw new Error("Rate limit exceeded")
      },
    },
    issue: {
      id: "bd-rate-limit",
      title: "Rate limited",
      status: "open",
      priority: 2,
      issue_type: "task",
    },
    existing: mapping["bd-rate-limit"],
    bdId: "bd-rate-limit",
    designText: "design",
    designHash: "hash-rate-limit",
    priority: 3,
    stateId: "state-1",
    labelName: "Task",
    prev: { issueType: "task" },
    getOrCreateLabel: async () => null,
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 0, errors: 1 })
  assert.deepEqual(mapping["bd-rate-limit"], originalEntry)
})

test("syncExistingIssue uses a single owned type label set when syncing labels", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const updateCalls = []

  await syncExistingIssue({
    client: {
      updateIssue: async (id, params) => {
        updateCalls.push({ id, params })
      },
    },
    issue: {
      id: "bd-owned-labels",
      title: "Owned labels",
      status: "open",
      priority: 2,
      issue_type: "bug",
    },
    existing: {
      linearId: "lin-owned-labels",
      linearIdentifier: "ENG-120",
      lastSyncedFields: { issueType: "task" },
    },
    bdId: "bd-owned-labels",
    designText: "design",
    designHash: "hash-owned-labels",
    priority: 3,
    stateId: "state-1",
    labelName: "Bug",
    prev: { issueType: "task" },
    getOrCreateLabel: async () => "label-bug",
    mapping: {},
    teamId: "team-1",
  })

  assert.deepEqual(updateCalls, [{
    id: "lin-owned-labels",
    params: {
      title: "Owned labels",
      description: "design\n\n<!-- [bd:bd-owned-labels] -->",
      priority: 3,
      stateId: "state-1",
      labelIds: ["label-bug"],
    },
  }])
})

test("syncExistingIssue treats label lookup failure as a per-issue error", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-label-error": {
      linearId: "lin-label-error",
      linearIdentifier: "ENG-130",
      lastSyncedFields: { issueType: "task" },
    },
  }
  const originalEntry = JSON.parse(JSON.stringify(mapping["bd-label-error"]))

  const result = await syncExistingIssue({
    client: {
      updateIssue: async () => {
        throw new Error("should not update without required label")
      },
    },
    issue: {
      id: "bd-label-error",
      title: "Label lookup error",
      status: "open",
      priority: 2,
      issue_type: "bug",
    },
    existing: mapping["bd-label-error"],
    bdId: "bd-label-error",
    designText: "design",
    designHash: "hash-label-error",
    priority: 3,
    stateId: "state-1",
    labelName: "Bug",
    prev: { issueType: "task" },
    getOrCreateLabel: async () => null,
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 0, errors: 1 })
  assert.deepEqual(mapping["bd-label-error"], originalEntry)
})

test("syncExistingIssue treats thrown label lookup failure as a per-issue error", async () => {
  const { syncExistingIssue } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-label-throw": {
      linearId: "lin-label-throw",
      linearIdentifier: "ENG-131",
      lastSyncedFields: { issueType: "task" },
    },
  }
  const originalEntry = JSON.parse(JSON.stringify(mapping["bd-label-throw"]))

  const result = await syncExistingIssue({
    client: {
      updateIssue: async () => {
        throw new Error("should not update when label lookup throws")
      },
    },
    issue: {
      id: "bd-label-throw",
      title: "Label lookup throw",
      status: "open",
      priority: 2,
      issue_type: "bug",
    },
    existing: mapping["bd-label-throw"],
    bdId: "bd-label-throw",
    designText: "design",
    designHash: "hash-label-throw",
    priority: 3,
    stateId: "state-1",
    labelName: "Bug",
    prev: { issueType: "task" },
    getOrCreateLabel: async () => {
      throw new Error("lookup boom")
    },
    mapping,
    teamId: "team-1",
  })

  assert.deepEqual(result, { created: 0, updated: 0, errors: 1 })
  assert.deepEqual(mapping["bd-label-throw"], originalEntry)
})

test("syncIssuesToLinear continues after per-issue failures and records failed summary", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {}
  const savedMappings = []
  const logMessages = []
  const sleepCalls = []

  const result = await syncIssuesToLinear({
    client: {
      issueSearch: async () => ({ nodes: [] }),
      createIssue: async params => {
        if (params.title === "Will fail") {
          throw new Error("Rate limit exceeded")
        }
        return { issue: Promise.resolve({ id: `lin-${params.title}`, identifier: `ENG-${params.title}` }) }
      },
      issueLabels: async () => ({ nodes: [] }),
      createIssueLabel: async ({ name }) => ({ success: true, issueLabel: Promise.resolve({ id: `label-${name}` }) }),
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-ok-1", title: "One", status: "open", priority: 2, issue_type: "task", design: "A" },
      { id: "bd-fail", title: "Will fail", status: "open", priority: 2, issue_type: "task", design: "B" },
      { id: "bd-ok-2", title: "Two", status: "open", priority: 2, issue_type: "bug", design: "C" },
    ],
    mapping,
    getOrCreateLabel: async labelName => `label-${labelName}`,
    saveMapping: next => savedMappings.push(JSON.parse(JSON.stringify(next))),
    log: message => logMessages.push(message),
    sleep: async ms => sleepCalls.push(ms),
  })

  assert.deepEqual(result, { created: 2, updated: 0, unchanged: 0, errors: 1 })
  assert.equal(mapping["bd-ok-1"].linearIdentifier, "ENG-One")
  assert.equal(mapping["bd-ok-2"].linearIdentifier, "ENG-Two")
  assert.equal("bd-fail" in mapping, false)
  assert.equal(savedMappings.length, 1)
  assert.match(logMessages.at(-1), /2 created, 0 updated, 0 unchanged, 1 failed/)
  assert.deepEqual(sleepCalls, [])
})

test("syncIssuesToLinear continues when an existing issue update fails mid-batch", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-existing": {
      linearId: "lin-existing",
      linearIdentifier: "ENG-150",
      lastSyncedFields: {
        title: "Existing",
        status: "open",
        priority: 2,
        issueType: "task",
        designHash: "old-hash",
      },
    },
  }

  const result = await syncIssuesToLinear({
    client: {
      issueSearch: async query => query === "[bd:bd-new]" ? { nodes: [] } : { nodes: [{ id: "lin-existing", identifier: "ENG-150" }] },
      issue: async () => ({ labels: async () => ({ nodes: [{ name: "Task" }] }) }),
      updateIssue: async () => {
        throw new Error("Rate limit exceeded")
      },
      createIssue: async params => ({ issue: Promise.resolve({ id: "lin-new", identifier: `ENG-${params.title}` }) }),
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-existing", title: "Existing updated", status: "open", priority: 2, issue_type: "task", design: "Updated" },
      { id: "bd-new", title: "New issue", status: "open", priority: 2, issue_type: "task", design: "New" },
    ],
    mapping,
    getOrCreateLabel: async () => "label-task",
    saveMapping: () => {},
    log: () => {},
    sleep: async () => {},
  })

  assert.deepEqual(result, { created: 1, updated: 0, unchanged: 0, errors: 1 })
  assert.equal(mapping["bd-existing"].linearId, "lin-existing")
  assert.equal(mapping["bd-new"].linearId, "lin-new")
})

test("syncIssuesToLinear recreates an issue in the same batch after stale mapping removal", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const mapping = {
    "bd-stale": {
      linearId: "lin-stale",
      linearIdentifier: "ENG-180",
      lastSyncedFields: {
        title: "Stale title",
        status: "open",
        priority: 2,
        issueType: "task",
        designHash: "hash-stale",
      },
    },
  }

  const result = await syncIssuesToLinear({
    client: {
      issueSearch: async query => query === "[bd:bd-stale]" ? { nodes: [] } : { nodes: [] },
      issue: async () => {
        throw new Error("404 not found")
      },
      createIssue: async params => ({ issue: Promise.resolve({ id: "lin-recreated", identifier: `ENG-${params.title}` }) }),
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-stale", title: "Stale recreated", status: "open", priority: 2, issue_type: "task", design: "Recreated" },
    ],
    mapping,
    getOrCreateLabel: async () => "label-task",
    saveMapping: () => {},
    log: () => {},
    sleep: async () => {},
  })

  assert.deepEqual(result, { created: 1, updated: 0, unchanged: 0, errors: 0 })
  assert.equal(mapping["bd-stale"].linearId, "lin-recreated")
})

test("syncIssuesToLinear rejects creating blocked issues when no explicit blocked state exists", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const createCalls = []

  const result = await syncIssuesToLinear({
    client: {
      issueSearch: async () => ({ nodes: [] }),
      createIssue: async params => {
        createCalls.push(params)
        return { issue: Promise.resolve({ id: "lin-blocked", identifier: "ENG-160" }) }
      },
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-blocked", title: "Blocked issue", status: "blocked", priority: 2, issue_type: "task", design: "Blocked" },
    ],
    mapping: {},
    getOrCreateLabel: async () => "label-task",
    saveMapping: () => {},
    log: () => {},
    sleep: async () => {},
  })

  assert.deepEqual(result, { created: 0, updated: 0, unchanged: 0, errors: 1 })
  assert.deepEqual(createCalls, [])
})

test("syncIssuesToLinear fails create-path sync when required type label cannot be resolved", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const createCalls = []

  const result = await syncIssuesToLinear({
    client: {
      issueSearch: async () => ({ nodes: [] }),
      createIssue: async params => {
        createCalls.push(params)
        return { issue: Promise.resolve({ id: "lin-create-fail", identifier: "ENG-170" }) }
      },
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-create-fail", title: "Create fail", status: "open", priority: 2, issue_type: "task", design: "Create" },
    ],
    mapping: {},
    getOrCreateLabel: async () => null,
    saveMapping: () => {},
    log: () => {},
    sleep: async () => {},
  })

  assert.deepEqual(result, { created: 0, updated: 0, unchanged: 0, errors: 1 })
  assert.deepEqual(createCalls, [])
})

test("syncIssuesToLinear fails create-path sync when type label lookup throws", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const createCalls = []

  const result = await syncIssuesToLinear({
    client: {
      issueSearch: async () => ({ nodes: [] }),
      createIssue: async params => {
        createCalls.push(params)
        return { issue: Promise.resolve({ id: "lin-create-throw", identifier: "ENG-171" }) }
      },
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-create-throw", title: "Create throw", status: "open", priority: 2, issue_type: "task", design: "Create" },
    ],
    mapping: {},
    getOrCreateLabel: async () => {
      throw new Error("label lookup failed")
    },
    saveMapping: () => {},
    log: () => {},
    sleep: async () => {},
  })

  assert.deepEqual(result, { created: 0, updated: 0, unchanged: 0, errors: 1 })
  assert.deepEqual(createCalls, [])
})

test("acquireMappingLock removes stale lock files before proceeding", async () => {
  const { acquireMappingLock, getMappingLockPath } = requireFresh("../scripts/tm-linear-sync")
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot
    const lockPath = getMappingLockPath()
    const staleCreatedAt = Date.now() - 60_000
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999, createdAt: staleCreatedAt }), "utf8")
    const oldTime = new Date(Date.now() - 60_000)
    fs.utimesSync(lockPath, oldTime, oldTime)

    const release = await acquireMappingLock({ timeoutMs: 100, pollMs: 1 })
    const currentLock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
    assert.equal(fs.existsSync(lockPath), true)
    assert.equal(currentLock.pid, process.pid)
    assert.notEqual(currentLock.createdAt, staleCreatedAt)
    release()
    assert.equal(fs.existsSync(lockPath), false)
  } finally {
    restoreEnv(savedEnv)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

test("acquireMappingLock ignores active lock held by current live process", async () => {
  const { acquireMappingLock, getMappingLockPath } = requireFresh("../scripts/tm-linear-sync")
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot
    const lockPath = getMappingLockPath()
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: Date.now() - 60_000 }), "utf8")
    const oldTime = new Date(Date.now() - 60_000)
    fs.utimesSync(lockPath, oldTime, oldTime)

    await assert.rejects(
      () => acquireMappingLock({ timeoutMs: 25, pollMs: 5 }),
      /timed out waiting for Linear mapping lock/
    )
  } finally {
    restoreEnv(savedEnv)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

test("runSyncBatch acquires and releases the mapping lock around sync work", async () => {
  const { runSyncBatch } = requireFresh("../scripts/tm-linear-sync")
  const calls = []

  const result = await runSyncBatch({
    client: {
      issueSearch: async () => ({ nodes: [] }),
      createIssue: async params => ({ issue: Promise.resolve({ id: `lin-${params.title}`, identifier: `ENG-${params.title}` }) }),
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: [
      { id: "bd-lock", title: "Locked", status: "open", priority: 2, issue_type: "task", design: "Lock" },
    ],
    getOrCreateLabel: async () => "label-task",
    loadMapping: () => {
      calls.push("load")
      return {}
    },
    saveMapping: () => calls.push("save"),
    log: () => calls.push("log"),
    sleep: async () => {},
    acquireLock: async () => {
      calls.push("acquire")
      return () => calls.push("release")
    },
  })

  assert.deepEqual(result, { created: 1, updated: 0, unchanged: 0, errors: 0 })
  assert.deepEqual(calls, ["acquire", "load", "save", "log", "release"])
})

test("runSyncBatch releases the mapping lock when sync work throws", async () => {
  const { runSyncBatch } = requireFresh("../scripts/tm-linear-sync")
  const calls = []

  await assert.rejects(
    () => runSyncBatch({
      client: {
        issueSearch: async () => ({ nodes: [] }),
        createIssue: async params => ({ issue: Promise.resolve({ id: `lin-${params.title}`, identifier: `ENG-${params.title}` }) }),
      },
      teamId: "team-1",
      teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
      issues: [
        { id: "bd-lock-fail", title: "Locked fail", status: "open", priority: 2, issue_type: "task", design: "Lock" },
      ],
      getOrCreateLabel: async () => "label-task",
      loadMapping: () => {
        calls.push("load")
        return {}
      },
      saveMapping: () => {
        calls.push("save")
        throw new Error("save failed")
      },
      log: () => calls.push("log"),
      sleep: async () => {},
      acquireLock: async () => {
        calls.push("acquire")
        return () => calls.push("release")
      },
    }),
    /save failed/
  )

  assert.deepEqual(calls, ["acquire", "load", "save", "release"])
})

test("createLabelResolver creates a team-scoped label when no team label exists", async () => {
  const { createLabelResolver } = requireFresh("../scripts/tm-linear-sync")
  const calls = []
  const resolveLabel = createLabelResolver({
    client: {
      issueLabels: async options => {
        calls.push({ type: "query", options })
        return { nodes: [] }
      },
      createIssueLabel: async options => {
        calls.push({ type: "create", options })
        return { success: true, issueLabel: Promise.resolve({ id: "label-task" }) }
      },
    },
    teamId: "team-1",
  })

  const labelId = await resolveLabel("Task")

  assert.equal(labelId, "label-task")
  assert.deepEqual(calls, [
    {
      type: "query",
      options: { first: 1, filter: { name: { eq: "Task" }, team: { id: { eq: "team-1" } } } },
    },
    {
      type: "create",
      options: { name: "Task", teamId: "team-1" },
    },
  ])
})

test("createLabelResolver reuses an existing team-scoped label without creating a duplicate", async () => {
  const { createLabelResolver } = requireFresh("../scripts/tm-linear-sync")
  const calls = []
  const resolveLabel = createLabelResolver({
    client: {
      issueLabels: async options => {
        calls.push({ type: "query", options })
        return { nodes: [{ id: "label-existing", name: "Task" }] }
      },
      createIssueLabel: async options => {
        calls.push({ type: "create", options })
        return { success: true, issueLabel: Promise.resolve({ id: "label-created" }) }
      },
    },
    teamId: "team-1",
  })

  const labelId = await resolveLabel("Task")

  assert.equal(labelId, "label-existing")
  assert.deepEqual(calls, [{
    type: "query",
    options: { first: 1, filter: { name: { eq: "Task" }, team: { id: { eq: "team-1" } } } },
  }])
})

test("createLabelResolver caches repeated resolutions to avoid duplicate queries and creates", async () => {
  const { createLabelResolver } = requireFresh("../scripts/tm-linear-sync")
  const calls = []
  const resolveLabel = createLabelResolver({
    client: {
      issueLabels: async options => {
        calls.push({ type: "query", options })
        return { nodes: [] }
      },
      createIssueLabel: async options => {
        calls.push({ type: "create", options })
        return { success: true, issueLabel: Promise.resolve({ id: "label-task" }) }
      },
    },
    teamId: "team-1",
  })

  const first = await resolveLabel("Task")
  const second = await resolveLabel("Task")

  assert.equal(first, "label-task")
  assert.equal(second, "label-task")
  assert.deepEqual(calls, [
    {
      type: "query",
      options: { first: 1, filter: { name: { eq: "Task" }, team: { id: { eq: "team-1" } } } },
    },
    {
      type: "create",
      options: { name: "Task", teamId: "team-1" },
    },
  ])
})

test("acquireMappingLock removes stale lock files with malformed metadata", async () => {
  const { acquireMappingLock, getMappingLockPath } = requireFresh("../scripts/tm-linear-sync")
  const savedEnv = saveEnv()
  const tempRepoRoot = makeTempRepoRoot()

  try {
    process.env.TM_REPO_ROOT = tempRepoRoot
    const lockPath = getMappingLockPath()
    fs.writeFileSync(lockPath, "not-json", "utf8")
    const oldTime = new Date(Date.now() - 60_000)
    fs.utimesSync(lockPath, oldTime, oldTime)

    const release = await acquireMappingLock({ timeoutMs: 100, pollMs: 1 })
    const currentLock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
    assert.equal(currentLock.pid, process.pid)
    release()
    assert.equal(fs.existsSync(lockPath), false)
  } finally {
    restoreEnv(savedEnv)
    fs.rmSync(tempRepoRoot, { recursive: true, force: true })
  }
})

test("syncIssuesToLinear throttles after every five created issues", async () => {
  const { syncIssuesToLinear } = requireFresh("../scripts/tm-linear-sync")
  const sleepCalls = []

  await syncIssuesToLinear({
    client: {
      issueSearch: async () => ({ nodes: [] }),
      createIssue: async params => ({ issue: Promise.resolve({ id: `lin-${params.title}`, identifier: `ENG-${params.title}` }) }),
    },
    teamId: "team-1",
    teamStates: [{ id: "todo-1", name: "Todo", type: "unstarted" }],
    issues: Array.from({ length: 6 }, (_, index) => ({
      id: `bd-${index + 1}`,
      title: `Issue-${index + 1}`,
      status: "open",
      priority: 2,
      issue_type: "task",
      design: `Design ${index + 1}`,
    })),
    mapping: {},
    getOrCreateLabel: async () => "label-task",
    saveMapping: () => {},
    log: () => {},
    sleep: async ms => sleepCalls.push(ms),
  })

  assert.deepEqual(sleepCalls, [500])
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function saveEnv() {
  return {
    LINEAR_API_KEY: process.env.LINEAR_API_KEY,
    LINEAR_TEAM_KEY: process.env.LINEAR_TEAM_KEY,
    LINEAR_PROJECT_NAME: process.env.LINEAR_PROJECT_NAME,
    TM_REPO_ROOT: process.env.TM_REPO_ROOT,
    TM_BACKEND: process.env.TM_BACKEND,
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
