#!/usr/bin/env node
"use strict"

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { loadLinearConfig } = require("./tm-linear-sync-config")
const BD_LIST_MAX_BUFFER = 10 * 1024 * 1024
const MARKER_SEARCH_LIMIT = 10
const MAPPING_LOCK_TIMEOUT_MS = 10000
const MAPPING_LOCK_POLL_MS = 50

// ── Field mapping ───────────────────────────────────────────────────────────

function mapPriority(bdPriority) {
  // bd: P0=critical, P1=high, P2=medium, P3=low, P4=backlog
  // Linear: 0=no-priority, 1=urgent, 2=high, 3=medium, 4=low
  const bdToLinear = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 0 }
  if (bdPriority == null) return 0
  const p = Number(bdPriority)
  return Number.isInteger(p) && p >= 0 && p <= 4 ? bdToLinear[p] : 0
}

function mapType(bdType) {
  const types = { epic: "Epic", feature: "Feature", task: "Task", bug: "Bug" }
  return types[bdType] || "Task"
}

function mapStatus(bdStatus, teamStates) {
  if (bdStatus === "blocked") {
    const explicitBlocked = teamStates.find(s =>
      s.name.toLowerCase().includes("blocked")
    )
    return explicitBlocked ? explicitBlocked.id : null
  }

  const matchers = {
    open: ["todo", "backlog", "triage"],
    in_progress: ["progress", "started", "active"],
    closed: ["done", "complete", "closed"],
  }

  const candidates = matchers[bdStatus] || matchers.open
  for (const keyword of candidates) {
    const match = teamStates.find(s =>
      s.name.toLowerCase().includes(keyword)
    )
    if (match) return match.id
  }

  // Fallback: use first state of matching type
  const typeMap = {
    open: ["backlog", "unstarted"],
    in_progress: ["started"],
    closed: ["completed"],
  }

  for (const type of (typeMap[bdStatus] || ["backlog", "unstarted"])) {
    const typeMatch = teamStates.find(s => s.type === type)
    if (typeMatch) return typeMatch.id
  }

  return null
}

function hashDesign(design) {
  if (!design) return ""
  return crypto.createHash("md5").update(design).digest("hex")
}

// ── Repo root detection ─────────────────────────────────────────────────────

function findRepoRootFrom(startDir) {
  if (!startDir) return ""
  let dir = path.resolve(startDir)
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".beads"))) return dir
    dir = path.dirname(dir)
  }
  return ""
}

function findRepoRoot() {
  const envRoot = (process.env.TM_REPO_ROOT || "").trim()
  if (envRoot && fs.existsSync(path.join(envRoot, ".beads"))) {
    return envRoot
  }

  return findRepoRootFrom(process.cwd()) || findRepoRootFrom(__dirname) || process.cwd()
}

// ── ID mapping persistence ──────────────────────────────────────────────────

function getMappingPath() {
  return path.join(findRepoRoot(), ".beads", "linear-map.json")
}

function loadMapping() {
  const mappingPath = getMappingPath()
  try {
    if (fs.existsSync(mappingPath)) {
      const parsed = JSON.parse(fs.readFileSync(mappingPath, "utf8"))
      if (!parsed || Array.isArray(parsed) || Object.prototype.toString.call(parsed) !== "[object Object]") {
        console.error(`tm-sync: Warning: invalid mapping payload in ${mappingPath}, starting fresh.`)
        return {}
      }
      return parsed
    }
  } catch (err) {
    console.error(`tm-sync: Warning: corrupted ${mappingPath}, starting fresh.`)
  }
  return {}
}

function saveMapping(mapping) {
  const mappingPath = getMappingPath()
  const mappingDir = path.dirname(mappingPath)
  const tempPath = path.join(mappingDir, `linear-map.${process.pid}.${Date.now()}.tmp`)
  fs.mkdirSync(mappingDir, { recursive: true })
  try {
    fs.writeFileSync(tempPath, JSON.stringify(mapping, null, 2) + "\n", "utf8")
    fs.renameSync(tempPath, mappingPath)
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true })
    }
  }
}

// ── bd issue loading ────────────────────────────────────────────────────────

function loadBdIssues(spawn = spawnSync) {
  const repoRoot = findRepoRoot()
  const statuses = ["open", "in_progress", "closed", "blocked"]
  const issues = []

  for (const status of statuses) {
    const result = spawn("bd", ["list", "--json", "--status", status], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: BD_LIST_MAX_BUFFER,
    })
    if (result.error || result.status !== 0) {
      const detail = result.error ? result.error.message : (result.stderr || "").trim()
      throw new Error(`bd list --status ${status} failed (exit ${result.status}): ${detail}`)
    }
    if (result.stdout.trim()) {
      try {
        const parsed = JSON.parse(result.stdout)
        issues.push(...parsed)
      } catch {
        throw new Error(`bd list --status ${status} returned invalid JSON`)
      }
    }
  }

  return issues
}

function logSyncInfo(message, streams = process) {
  streams.stderr.write(`tm-sync: ${message}\n`)
}

function buildLastSyncedFields(issue, designHash) {
  return {
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    issueType: issue.issue_type,
    designHash,
  }
}

function createLabelResolver({ client, teamId }) {
  const labelCache = {}

  return async function getOrCreateLabel(labelName) {
    if (labelCache[labelName]) return labelCache[labelName]

    const existing = await client.issueLabels({
      first: 1,
      filter: { name: { eq: labelName }, team: { id: { eq: teamId } } },
    })
    if (existing.nodes.length > 0) {
      labelCache[labelName] = existing.nodes[0].id
      return existing.nodes[0].id
    }

    const payload = await client.createIssueLabel({
      name: labelName,
      teamId,
    })
    if (payload.success) {
      const label = await payload.issueLabel
      if (label) {
        labelCache[labelName] = label.id
        return label.id
      }
    }
    return null
  }
}

async function issueNeedsLabelRepair({ client, existing, labelName }) {
  if (!labelName || typeof client.issue !== "function") {
    return false
  }

  let currentIssue
  try {
    currentIssue = await client.issue(existing.linearId)
  } catch (err) {
    if (err.message && /not found|does not exist|404/i.test(err.message)) {
      return true
    }
    throw err
  }

  let labelsConnection = null
  if (currentIssue) {
    if (typeof currentIssue.labels === "function") {
      labelsConnection = await currentIssue.labels()
    } else if (currentIssue.labels && typeof currentIssue.labels.then === "function") {
      labelsConnection = await currentIssue.labels
    } else if (currentIssue.labels) {
      labelsConnection = currentIssue.labels
    }
  }

  const labels = Array.isArray(labelsConnection)
    ? labelsConnection
    : Array.isArray(labelsConnection?.nodes)
      ? labelsConnection.nodes
      : null

  if (!labels) {
    return false
  }

  const labelNames = labels
    .map(label => label && label.name)
    .filter(Boolean)

  return labelNames.length !== 1 || labelNames[0] !== labelName
}

async function findIssueByMarker({ client, teamId, bdId }) {
  const search = await client.issueSearch(`[bd:${bdId}]`, {
    first: MARKER_SEARCH_LIMIT,
    filter: { team: { id: { eq: teamId } } },
  })

  if (search.nodes.length === 0) {
    return null
  }

  if (search.nodes.length === 1) {
    return search.nodes[0]
  }

  throw new Error(`multiple Linear issues found for [bd:${bdId}]`)
}

async function linkIssueByMarkerSearch({ client, teamId, bdId, mapping }) {
  const found = await findIssueByMarker({ client, teamId, bdId })

  if (!found) {
    return null
  }
  const linked = {
    linearId: found.id,
    linearIdentifier: found.identifier,
    lastSyncedAt: new Date().toISOString(),
  }

  // Intentionally leave lastSyncedFields unset. On a fresh clone we do not know
  // whether the existing Linear issue still matches the local bd issue, so the
  // caller must run a real sync before treating the relinked issue as unchanged.
  mapping[bdId] = linked
  logSyncInfo(`Linked ${bdId} → ${found.identifier} (found by marker)`)
  return linked
}

async function reconcileExistingIssueByMarker(client, teamId, bdId, existing, mapping) {
  const found = await findIssueByMarker({ client, teamId, bdId })

  if (!found) {
    if (typeof client.issue === "function") {
      try {
        const currentIssue = await client.issue(existing.linearId)
        if (currentIssue && currentIssue.id === existing.linearId) {
          const { lastSyncedFields, ...relinkBase } = existing
          const refreshed = {
            ...relinkBase,
            lastSyncedAt: new Date().toISOString(),
          }
          mapping[bdId] = refreshed
          logSyncInfo(`Re-linked ${bdId} → ${existing.linearIdentifier} (marker restored on next sync)`) 
          return refreshed
        }
      } catch (err) {
        if (!err.message || !/not found|does not exist|404/i.test(err.message)) {
          throw err
        }
      }
    }

    console.error(`tm-sync: Linear issue ${existing.linearIdentifier} is missing, removing stale mapping for ${bdId}`)
    delete mapping[bdId]
    return null
  }

  if (found.id === existing.linearId) {
    return existing
  }

  const { lastSyncedFields, ...relinkBase } = existing
  const relinked = {
    ...relinkBase,
    linearId: found.id,
    linearIdentifier: found.identifier,
    lastSyncedAt: new Date().toISOString(),
  }
  mapping[bdId] = relinked
  logSyncInfo(`Re-linked ${bdId} → ${found.identifier} (found by marker)`)
  return relinked
}

async function prepareExistingIssueForSync({ client, teamId, bdId, issue, designHash, labelName, existing, mapping }) {
  let prev = existing ? existing.lastSyncedFields || {} : {}
  let forceLabelSync = false
  let skipUpdate = false

  if (existing) {
    existing = await reconcileExistingIssueByMarker(client, teamId, bdId, existing, mapping)
    if (!existing) {
      return { existing: null, prev: {}, forceLabelSync: false, skipUpdate: false }
    }

    prev = existing.lastSyncedFields || {}
    let changed = prev.title !== issue.title ||
      prev.status !== issue.status ||
      prev.priority !== issue.priority ||
      prev.issueType !== issue.issue_type ||
      prev.designHash !== designHash

    if (!changed) {
      // Recompute after reconciliation may have cleared lastSyncedFields
      prev = existing.lastSyncedFields || {}
      changed = prev.title !== issue.title ||
        prev.status !== issue.status ||
        prev.priority !== issue.priority ||
        prev.issueType !== issue.issue_type ||
        prev.designHash !== designHash
    }

    forceLabelSync = await issueNeedsLabelRepair({ client, existing, labelName })
    if (!changed && !forceLabelSync) {
      skipUpdate = true
    }

    prev = existing ? existing.lastSyncedFields || {} : {}
  }

  return { existing, prev, forceLabelSync, skipUpdate }
}

async function createLinearIssue({ client, teamId, issue, bdId, designText, designHash, priority, stateId, labelName, getOrCreateLabel, mapping }) {
  const issueLabel = issue.title || bdId
  const descWithMarker = `${designText}\n\n<!-- [bd:${bdId}] -->`.trim()
  const createParams = {
    teamId,
    title: issueLabel,
    description: descWithMarker,
    priority,
  }
  if (stateId) createParams.stateId = stateId

  let labelId
  try {
    labelId = await getOrCreateLabel(labelName)
  } catch (err) {
    console.error(`tm-sync: Label lookup failed for "${issueLabel}" (${labelName}): ${err.message}`)
    return { created: 0, updated: 0, errors: 1 }
  }
  if (!labelId) {
    console.error(`tm-sync: Failed to resolve required type label "${labelName}" for "${issueLabel}"`)
    return { created: 0, updated: 0, errors: 1 }
  }
  createParams.labelIds = [labelId]

  try {
    const payload = await client.createIssue(createParams)
    const linearIssue = await payload.issue
    if (linearIssue) {
      mapping[bdId] = {
        linearId: linearIssue.id,
        linearIdentifier: linearIssue.identifier,
        lastSyncedAt: new Date().toISOString(),
        lastSyncedFields: buildLastSyncedFields(issue, designHash),
      }
      return { created: 1, updated: 0, errors: 0 }
    }
  } catch (err) {
    console.error(`tm-sync: Failed to create "${issueLabel}": ${err.message}`)
    return { created: 0, updated: 0, errors: 1 }
  }

  console.error(`tm-sync: Failed to create "${issueLabel}": Linear did not return an issue object`)
  return { created: 0, updated: 0, errors: 1 }
}

async function syncExistingIssue({ client, issue, existing, bdId, designText, designHash, priority, stateId, labelName, prev, forceLabelSync = false, getOrCreateLabel, mapping, teamId }) {
  const issueLabel = issue.title || bdId
  const updateDescWithMarker = `${designText}\n\n<!-- [bd:${bdId}] -->`.trim()
  const updateParams = {
    title: issueLabel,
    description: updateDescWithMarker,
    priority,
  }
  if (stateId) updateParams.stateId = stateId

  if (forceLabelSync || prev.issueType !== issue.issue_type) {
    let labelId
    try {
      labelId = await getOrCreateLabel(labelName)
    } catch (err) {
      console.error(`tm-sync: Label lookup failed for "${issueLabel}" (${labelName}): ${err.message}`)
      return { created: 0, updated: 0, errors: 1 }
    }
    if (!labelId) {
      console.error(`tm-sync: Failed to resolve required type label "${labelName}" for "${issueLabel}"`)
      return { created: 0, updated: 0, errors: 1 }
    }
    updateParams.labelIds = [labelId]
  }

  try {
    await client.updateIssue(existing.linearId, updateParams)
    existing.lastSyncedAt = new Date().toISOString()
    existing.lastSyncedFields = buildLastSyncedFields(issue, designHash)
    return { created: 0, updated: 1, errors: 0 }
  } catch (err) {
    if (err.message && /not found|does not exist|404/i.test(err.message)) {
      let relinked
      try {
        relinked = await reconcileExistingIssueByMarker(client, teamId, bdId, existing, mapping)
      } catch (relinkErr) {
        console.error(`tm-sync: Failed to re-link stale mapping for "${issueLabel}": ${relinkErr.message}`)
        return { created: 0, updated: 0, errors: 1 }
      }
      if (relinked && relinked.linearId !== existing.linearId) {
        return syncExistingIssue({ client, issue, existing: relinked, bdId, designText, designHash, priority, stateId, labelName, prev, forceLabelSync, getOrCreateLabel, mapping, teamId })
      }
      if (relinked) {
        console.error(`tm-sync: Failed to update "${issueLabel}": stale mapping could not be refreshed safely`)
        return { created: 0, updated: 0, errors: 1 }
      }
      console.error(`tm-sync: Linear issue ${existing.linearIdentifier} was deleted, recreating ${bdId}`)
      return createLinearIssue({ client, teamId, issue, bdId, designText, designHash, priority, stateId, labelName, getOrCreateLabel, mapping })
    }

    console.error(`tm-sync: Failed to update "${issueLabel}": ${err.message}`)
    return { created: 0, updated: 0, errors: 1 }
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getMappingLockPath() {
  return `${getMappingPath()}.lock`
}

function readLockMetadata(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, "utf8").trim()
    if (!raw) return {}
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === "object" ? parsed : {}
    }
    const pid = Number(raw)
    return Number.isInteger(pid) ? { pid } : {}
  } catch {
    return {}
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    if (err && err.code === "ESRCH") {
      return false
    }
    return true
  }
}

async function acquireMappingLock({ timeoutMs = MAPPING_LOCK_TIMEOUT_MS, pollMs = MAPPING_LOCK_POLL_MS } = {}) {
  const lockPath = getMappingLockPath()
  const startedAt = Date.now()
  let token = null

  while (true) {
    try {
      token = JSON.stringify({ pid: process.pid, createdAt: Date.now() })
      fs.writeFileSync(lockPath, token, { flag: "wx" })
      return () => {
        try {
          if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, "utf8") === token) {
            fs.rmSync(lockPath, { force: true })
          }
        } catch {
          // best effort cleanup
        }
      }
    } catch (err) {
      if (err && err.code !== "EEXIST") {
        throw err
      }
      try {
        const stats = fs.statSync(lockPath)
        const metadata = readLockMetadata(lockPath)
        const ageMs = Date.now() - stats.mtimeMs
        const staleByPid = metadata.pid ? !isProcessAlive(metadata.pid) : false
        const staleByAge = ageMs >= timeoutMs && (!metadata.pid || staleByPid)

        if (staleByAge || staleByPid) {
          fs.rmSync(lockPath, { force: true })
          continue
        }
      } catch {
        // Ignore transient stat/remove races and retry normally.
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`timed out waiting for Linear mapping lock at ${lockPath}`)
      }
      await wait(pollMs)
    }
  }
}

async function syncIssuesToLinear({ client, teamId, teamStates, issues, mapping, getOrCreateLabel, saveMapping: persistMapping = saveMapping, log = logSyncInfo, sleep = wait, reportError = console.error }) {
  let created = 0
  let updated = 0
  let unchanged = 0
  let errors = 0

  for (const issue of issues) {
    const bdId = issue.id
    const designText = issue.design || issue.description || ""
    const designHash = hashDesign(designText)
    const stateId = mapStatus(issue.status, teamStates)
    const priority = mapPriority(issue.priority)
    const labelName = mapType(issue.issue_type)

    if (issue.status === "blocked" && !stateId) {
      reportError(`tm-sync: Cannot sync blocked issue "${issue.title || bdId}" without an explicit Blocked workflow state in Linear.`)
      errors++
      continue
    }

    let existing = mapping[bdId]

    if (!existing) {
      try {
        existing = await linkIssueByMarkerSearch({ client, teamId, bdId, mapping })
      } catch (err) {
        reportError(`tm-sync: Search failed for ${bdId}, skipping to avoid duplicate: ${err.message}`)
        errors++
        continue
      }
    }

    let prev = existing ? existing.lastSyncedFields || {} : {}
    let forceLabelSync = false

    if (existing) {
      try {
        const prepared = await prepareExistingIssueForSync({
          client,
          teamId,
          bdId,
          issue,
          designHash,
          labelName,
          existing,
          mapping,
        })
        existing = prepared.existing
        prev = prepared.prev
        forceLabelSync = prepared.forceLabelSync
        if (prepared.skipUpdate) {
          unchanged++
          continue
        }
      } catch (err) {
        reportError(`tm-sync: Failed to prepare sync for "${issue.title || bdId}": ${err.message}`)
        errors++
        continue
      }
    }

    if (!existing) {
      const result = await createLinearIssue({
        client,
        teamId,
        issue,
        bdId,
        designText,
        designHash,
        priority,
        stateId,
        labelName,
        getOrCreateLabel,
        mapping,
      })
      created += result.created
      updated += result.updated
      errors += result.errors

      if (created > 0 && created % 5 === 0) {
        await sleep(500)
      }
    } else {
      const result = await syncExistingIssue({
        client,
        issue,
        existing,
        bdId,
        designText,
        designHash,
        priority,
        stateId,
        labelName,
        prev,
        forceLabelSync,
        getOrCreateLabel,
        mapping,
        teamId,
      })
      created += result.created
      updated += result.updated
      errors += result.errors
    }
  }

  persistMapping(mapping)
  log(`Synced ${issues.length} issues (${created} created, ${updated} updated, ${unchanged} unchanged${errors > 0 ? `, ${errors} failed` : ""})`)

  return { created, updated, unchanged, errors }
}

async function runSyncBatch({ client, teamId, teamStates, issues, getOrCreateLabel, loadMapping: readMapping = loadMapping, saveMapping: persistMapping = saveMapping, log = logSyncInfo, sleep = wait, acquireLock = acquireMappingLock }) {
  const releaseMappingLock = await acquireLock()
  try {
    const mapping = readMapping()
    return await syncIssuesToLinear({
      client,
      teamId,
      teamStates,
      issues,
      mapping,
      getOrCreateLabel,
      saveMapping: persistMapping,
      log,
      sleep,
    })
  } finally {
    releaseMappingLock()
  }
}

// ── Sync engine ─────────────────────────────────────────────────────────────

async function syncToLinear() {
  const config = loadLinearConfig()
  if (!config) {
    console.error("tm-sync: Linear not configured, skipping.")
    return
  }

  // Dynamic import for ESM-only @linear/sdk
  const { LinearClient } = await import("@linear/sdk")
  const client = new LinearClient({ apiKey: config.apiKey })

  // Verify API key
  let viewer
  try {
    viewer = await client.viewer
  } catch (err) {
    console.error("tm-sync: Linear API key invalid or expired.")
    console.error(`  Error: ${err.message}`)
    process.exit(1)
  }
  logSyncInfo(`Authenticated as ${viewer.displayName || viewer.email}`)

  // Find team
  const teams = await client.teams({
    first: 1,
    filter: { key: { eq: config.teamKey } },
  })
  const team = teams.nodes[0]
  if (!team) {
    console.error(`tm-sync: Team "${config.teamKey}" not found in Linear.`)
    process.exit(1)
  }

  // Load workflow states for the team
  const statesResult = await client.workflowStates({
    filter: { team: { id: { eq: team.id } } },
    first: 100,
  })
  const teamStates = statesResult.nodes.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
  }))

  const getOrCreateLabel = createLabelResolver({ client, teamId: team.id })

  const issues = loadBdIssues()
  const result = await runSyncBatch({
    client,
    teamId: team.id,
    teamStates,
    issues,
    getOrCreateLabel,
  })

  const { errors } = result
  if (errors > 0) {
    process.exitCode = 1
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  syncToLinear().catch(err => {
    console.error(`tm-sync: ${err.message}`)
    process.exit(1)
  })
}

module.exports = { BD_LIST_MAX_BUFFER, findRepoRoot, getMappingPath, getMappingLockPath, loadBdIssues, logSyncInfo, mapPriority, mapStatus, mapType, hashDesign, loadMapping, saveMapping, findIssueByMarker, linkIssueByMarkerSearch, issueNeedsLabelRepair, reconcileExistingIssueByMarker, prepareExistingIssueForSync, syncExistingIssue, syncIssuesToLinear, acquireMappingLock, runSyncBatch, createLabelResolver, isProcessAlive }
