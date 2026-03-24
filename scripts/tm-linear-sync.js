#!/usr/bin/env node
"use strict"

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { loadLinearConfig } = require("./tm-linear-sync-config")
const BD_LIST_MAX_BUFFER = 10 * 1024 * 1024
const MARKER_SEARCH_LIMIT = 10

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
  const matchers = {
    open: ["todo", "backlog", "triage"],
    in_progress: ["progress", "started", "active"],
    closed: ["done", "complete", "closed"],
    blocked: ["blocked", "todo", "backlog"],
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
    blocked: ["unstarted", "backlog"],
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

  return !labels.some(label => label && label.name === labelName)
}

async function findIssueByMarker({ client, teamId, bdId, existingLinearId }) {
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

  if (existingLinearId) {
    const currentMatch = search.nodes.find(node => node.id === existingLinearId)
    if (currentMatch) {
      return currentMatch
    }
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
  const found = await findIssueByMarker({ client, teamId, bdId, existingLinearId: existing.linearId })

  if (!found) {
    if (typeof client.issue === "function") {
      try {
        const currentIssue = await client.issue(existing.linearId)
        if (currentIssue && currentIssue.id === existing.linearId) {
          return existing
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

async function createLinearIssue({ client, teamId, issue, bdId, designText, designHash, priority, stateId, labelName, getOrCreateLabel, mapping }) {
  const descWithMarker = `${designText}\n\n<!-- [bd:${bdId}] -->`.trim()
  const createParams = {
    teamId,
    title: issue.title || bdId,
    description: descWithMarker,
    priority,
  }
  if (stateId) createParams.stateId = stateId

  try {
    const labelId = await getOrCreateLabel(labelName)
    if (labelId) createParams.labelIds = [labelId]
  } catch (err) {
    console.error(`tm-sync: Label lookup failed for "${labelName}": ${err.message}`)
  }

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
    console.error(`tm-sync: Failed to create "${issue.title}": ${err.message}`)
    return { created: 0, updated: 0, errors: 1 }
  }

  console.error(`tm-sync: Failed to create "${issue.title}": Linear did not return an issue object`)
  return { created: 0, updated: 0, errors: 1 }
}

async function syncExistingIssue({ client, issue, existing, bdId, designText, designHash, priority, stateId, labelName, prev, forceLabelSync = false, getOrCreateLabel, mapping, teamId }) {
  const updateDescWithMarker = `${designText}\n\n<!-- [bd:${bdId}] -->`.trim()
  const updateParams = {
    title: issue.title,
    description: updateDescWithMarker,
    priority,
  }
  if (stateId) updateParams.stateId = stateId

  if (forceLabelSync || prev.issueType !== issue.issue_type) {
    try {
      const labelId = await getOrCreateLabel(labelName)
      if (labelId) updateParams.labelIds = [labelId]
    } catch (err) {
      console.error(`tm-sync: Label lookup failed for "${labelName}": ${err.message}`)
    }
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
        console.error(`tm-sync: Failed to re-link stale mapping for "${issue.title}": ${relinkErr.message}`)
        return { created: 0, updated: 0, errors: 1 }
      }
      if (relinked && relinked.linearId !== existing.linearId) {
        return syncExistingIssue({ client, issue, existing: relinked, bdId, designText, designHash, priority, stateId, labelName, prev, forceLabelSync, getOrCreateLabel, mapping, teamId })
      }
      if (relinked) {
        console.error(`tm-sync: Failed to update "${issue.title}": stale mapping could not be refreshed safely`)
        return { created: 0, updated: 0, errors: 1 }
      }
      console.error(`tm-sync: Linear issue ${existing.linearIdentifier} was deleted, recreating ${bdId}`)
      return createLinearIssue({ client, teamId, issue, bdId, designText, designHash, priority, stateId, labelName, getOrCreateLabel, mapping })
    }

    console.error(`tm-sync: Failed to update "${issue.title}": ${err.message}`)
    return { created: 0, updated: 0, errors: 1 }
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

  // Find or create labels for issue types
  const labelCache = {}
  async function getOrCreateLabel(labelName) {
    if (labelCache[labelName]) return labelCache[labelName]

    const existing = await client.issueLabels({
      first: 1,
      filter: { name: { eq: labelName }, team: { id: { eq: team.id } } },
    })
    if (existing.nodes.length > 0) {
      labelCache[labelName] = existing.nodes[0].id
      return existing.nodes[0].id
    }

    // Try workspace-level labels
    const workspace = await client.issueLabels({
      first: 1,
      filter: { name: { eq: labelName } },
    })
    if (workspace.nodes.length > 0) {
      labelCache[labelName] = workspace.nodes[0].id
      return workspace.nodes[0].id
    }

    // Create the label
    const payload = await client.createIssueLabel({
      name: labelName,
      teamId: team.id,
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

  // Load mapping and bd issues
  const mapping = loadMapping()
  const issues = loadBdIssues()

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

    let existing = mapping[bdId]

    // If no local mapping, search Linear by bd ID marker to avoid duplicates (e.g. fresh clone)
    if (!existing) {
      try {
        existing = await linkIssueByMarkerSearch({ client, teamId: team.id, bdId, mapping })
      } catch (err) {
        // Search failed — skip this issue to avoid creating duplicates
        console.error(`tm-sync: Search failed for ${bdId}, skipping to avoid duplicate: ${err.message}`)
        errors++
        continue
      }
    }

    let prev = existing ? existing.lastSyncedFields || {} : {}
    let forceLabelSync = false

    if (existing) {
      const changed = prev.title !== issue.title ||
        prev.status !== issue.status ||
        prev.priority !== issue.priority ||
        prev.issueType !== issue.issue_type ||
        prev.designHash !== designHash

      if (!changed) {
        try {
          existing = await reconcileExistingIssueByMarker(client, team.id, bdId, existing, mapping)
        } catch (err) {
          console.error(`tm-sync: Failed to validate unchanged issue "${issue.title}": ${err.message}`)
          errors++
          continue
        }

        if (existing) {
          try {
            forceLabelSync = await issueNeedsLabelRepair({ client, existing, labelName })
          } catch (err) {
            console.error(`tm-sync: Failed to inspect labels for unchanged issue "${issue.title}": ${err.message}`)
            errors++
            continue
          }

          if (!forceLabelSync) {
            unchanged++
            continue
          }
        }
      }

      prev = existing ? existing.lastSyncedFields || {} : {}
    }

    if (!existing) {
      const result = await createLinearIssue({
        client,
        teamId: team.id,
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

      // Rate limit protection
      if (created > 0 && created % 5 === 0) {
        await new Promise(r => setTimeout(r, 500))
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
        teamId: team.id,
      })
      created += result.created
      updated += result.updated
      errors += result.errors
    }
  }

  saveMapping(mapping)
  logSyncInfo(`Synced ${issues.length} issues (${created} created, ${updated} updated, ${unchanged} unchanged${errors > 0 ? `, ${errors} failed` : ""})`)
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

module.exports = { BD_LIST_MAX_BUFFER, findRepoRoot, getMappingPath, loadBdIssues, logSyncInfo, mapPriority, mapStatus, mapType, hashDesign, loadMapping, saveMapping, linkIssueByMarkerSearch, issueNeedsLabelRepair, reconcileExistingIssueByMarker, syncExistingIssue }
