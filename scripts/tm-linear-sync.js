#!/usr/bin/env node
"use strict"

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { loadLinearConfig } = require("./tm-linear-sync-config")

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
    open: "backlog",
    in_progress: "started",
    closed: "completed",
    blocked: "unstarted",
  }
  const typeMatch = teamStates.find(s => s.type === (typeMap[bdStatus] || "backlog"))
  if (typeMatch) return typeMatch.id

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
      return JSON.parse(fs.readFileSync(mappingPath, "utf8"))
    }
  } catch (err) {
    console.error(`tm-sync: Warning: corrupted ${mappingPath}, starting fresh.`)
  }
  return {}
}

function saveMapping(mapping) {
  const mappingPath = getMappingPath()
  fs.mkdirSync(path.dirname(mappingPath), { recursive: true })
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + "\n", "utf8")
}

// ── bd issue loading ────────────────────────────────────────────────────────

function loadBdIssues() {
  const repoRoot = findRepoRoot()
  const statuses = ["open", "in_progress", "closed", "blocked"]
  const issues = []

  for (const status of statuses) {
    const result = spawnSync("bd", ["list", "--json", "--status", status], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10000,
    })
    if (result.status !== 0) {
      throw new Error(`bd list --status ${status} failed (exit ${result.status}): ${(result.stderr || "").trim()}`)
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

async function reconcileExistingIssueByMarker(client, teamId, bdId, existing, mapping) {
  const search = await client.issueSearch(`[bd:${bdId}]`, {
    first: 1,
    filter: { team: { id: { eq: teamId } } },
  })

  if (search.nodes.length === 0) {
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

  const found = search.nodes[0]
  if (found.id === existing.linearId) {
    return existing
  }

  const relinked = {
    ...existing,
    linearId: found.id,
    linearIdentifier: found.identifier,
    lastSyncedAt: new Date().toISOString(),
  }
  mapping[bdId] = relinked
  logSyncInfo(`Re-linked ${bdId} → ${found.identifier} (found by marker)`)
  return relinked
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
        const search = await client.issueSearch(`[bd:${bdId}]`, {
          first: 1,
          filter: { team: { id: { eq: team.id } } },
        })
        if (search.nodes.length > 0) {
          const found = search.nodes[0]
          existing = {
            linearId: found.id,
            linearIdentifier: found.identifier,
            lastSyncedAt: new Date().toISOString(),
            lastSyncedFields: {},
          }
          mapping[bdId] = existing
          logSyncInfo(`Linked ${bdId} → ${found.identifier} (found by marker)`)
        }
      } catch (err) {
        // Search failed — skip this issue to avoid creating duplicates
        console.error(`tm-sync: Search failed for ${bdId}, skipping to avoid duplicate: ${err.message}`)
        errors++
        continue
      }
    }

    let prev = existing ? existing.lastSyncedFields || {} : {}

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
          unchanged++
          continue
        }
      }

      prev = existing ? existing.lastSyncedFields || {} : {}
    }

    if (!existing) {
      // Create new issue in Linear (include bd ID marker for stable relinking)
      const descWithMarker = `${designText}\n\n<!-- [bd:${bdId}] -->`.trim()
      const createParams = {
        teamId: team.id,
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
            lastSyncedFields: {
              title: issue.title,
              status: issue.status,
              priority: issue.priority,
              issueType: issue.issue_type,
              designHash,
            },
          }
          created++
        }
      } catch (err) {
        console.error(`tm-sync: Failed to create "${issue.title}": ${err.message}`)
        errors++
      }

      // Rate limit protection
      if (created > 0 && created % 5 === 0) {
        await new Promise(r => setTimeout(r, 500))
      }
    } else {
      // Update existing issue (preserve bd ID marker for relinking)
      const updateDescWithMarker = `${designText}\n\n<!-- [bd:${bdId}] -->`.trim()
      const updateParams = {
        title: issue.title,
        description: updateDescWithMarker,
        priority,
      }
      if (stateId) updateParams.stateId = stateId

      // Update labels if issue type changed
      if (prev.issueType !== issue.issue_type) {
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
        existing.lastSyncedFields = {
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          issueType: issue.issue_type,
          designHash,
        }
        updated++
      } catch (err) {
        // If the Linear issue was deleted externally, remove stale mapping so next sync recreates it
        if (err.message && /not found|does not exist|404/i.test(err.message)) {
          console.error(`tm-sync: Linear issue ${existing.linearIdentifier} was deleted, removing mapping for ${bdId}`)
          delete mapping[bdId]
        } else {
          console.error(`tm-sync: Failed to update "${issue.title}": ${err.message}`)
        }
        errors++
      }
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

module.exports = { findRepoRoot, getMappingPath, logSyncInfo, mapPriority, mapStatus, mapType, hashDesign, loadMapping, saveMapping, reconcileExistingIssueByMarker }
