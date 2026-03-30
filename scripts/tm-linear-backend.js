const { loadLinearConfig } = require("./tm-linear-sync-config")
const { mapStatus } = require("./tm-linear-sync")

const TM_LINEAR_BACKEND_VERSION = "0.1.0"

function mapLinearStateToTmStatus(state) {
  const name = (state?.name || "").toLowerCase()
  if (name.includes("blocked")) return "blocked"
  if (name.includes("cancel")) return "closed"

  switch (state?.type) {
    case "started":
      return "in_progress"
    case "completed":
    case "canceled":
      return "closed"
    default:
      return "open"
  }
}

function normalizeTmStatusForLinear(status) {
  if (status === "ready") return "open"
  return status
}

async function resolveLinearContextWithSdk() {
  const config = loadLinearConfig()
  if (!config) {
    throw new Error("Linear backend requires LINEAR_API_KEY and LINEAR_TEAM_KEY.")
  }

  const { LinearClient } = await import("@linear/sdk")
  const client = new LinearClient({ apiKey: config.apiKey })
  await client.viewer

  const teams = await client.teams({
    first: 1,
    filter: { key: { eq: config.teamKey } },
  })
  const team = teams.nodes[0]
  if (!team) {
    throw new Error(`Team "${config.teamKey}" not found in Linear.`)
  }

  const statesResult = await client.workflowStates({
    filter: { team: { id: { eq: team.id } } },
    first: 100,
  })
  const teamStates = statesResult.nodes.map(state => ({ id: state.id, name: state.name, type: state.type }))

  return {
    team,
    teamStates,
    issue: (...args) => client.issue(...args),
    issues: args => client.issues(args),
    issueSearch: (...args) => client.issueSearch(...args),
    updateIssue: (...args) => client.updateIssue(...args),
  }
}

async function listIssues(context, statusFilter, parentRef = null) {
  const filter = { team: { id: { eq: context.team?.id } } }

  if (parentRef) {
    const parentIssue = await findIssueByRef(context, parentRef)
    filter.parent = { id: { eq: parentIssue.id } }
  }

  const nodes = await listAllIssues(context, filter)

  const rows = []
  for (const issue of nodes) {
    const tmStatus = mapLinearStateToTmStatus(await resolveIssueState(issue))
    if (statusFilter === "ready" && tmStatus !== "open") continue
    if (statusFilter && statusFilter !== "ready" && tmStatus !== statusFilter) continue
    rows.push(`${issue.identifier} ${issue.title}`)
  }

  return rows.join("\n")
}

async function listAllIssues(context, filter) {
  const nodes = []
  let after = null

  while (true) {
    const result = await context.issues({
      first: 100,
      ...(after ? { after } : {}),
      filter,
    })

    nodes.push(...(result.nodes || []))

    if (!result.pageInfo?.hasNextPage) return nodes
    after = result.pageInfo.endCursor
  }
}

async function findIssueByRef(context, ref) {
  if (!looksLikeLinearIdentifier(ref) && typeof context.issue === "function") {
    const directIssue = await context.issue(ref)
    if (directIssue?.id === ref || directIssue?.identifier === ref) {
      const issueTeamId = await resolveIssueTeamId(directIssue)
      if (context.team?.id && (!issueTeamId || issueTeamId !== context.team.id)) {
        throw new Error(`Linear issue "${ref}" not found.`)
      }

      return directIssue
    }
  }

  const nodes = await searchAllIssuesByRef(context, ref)
  const exactMatches = nodes.filter(issue => issue.identifier === ref || issue.id === ref)
  if (exactMatches.length === 1) return exactMatches[0]
  if (exactMatches.length > 1) {
    throw new Error(`Multiple Linear issues matched "${ref}".`)
  }
  if (nodes.length === 0) {
    throw new Error(`Linear issue "${ref}" not found.`)
  }
  throw new Error(`No exact Linear issue matched "${ref}".`)
}

async function resolveIssueTeamId(issue) {
  if (issue?.teamId) return issue.teamId

  try {
    const team = typeof issue?.team === "function" ? await issue.team() : await issue?.team
    return team?.id || null
  } catch {
    return null
  }
}

async function resolveIssueState(issue) {
  try {
    return typeof issue?.state === "function" ? await issue.state() : await issue?.state
  } catch {
    return undefined
  }
}

async function searchAllIssuesByRef(context, ref) {
  const nodes = []
  let after = null

  while (true) {
    const result = await context.issueSearch(ref, {
      first: 10,
      ...(after ? { after } : {}),
      filter: { team: { id: { eq: context.team?.id } } },
    })

    nodes.push(...(result.nodes || []))

    if (!result.pageInfo?.hasNextPage) return nodes
    after = result.pageInfo.endCursor
  }
}

function looksLikeLinearIdentifier(ref) {
  return /^[A-Z][A-Z0-9_]*(?:-[A-Z0-9_]+)*-\d+$/.test(ref)
}

async function renderIssueDetails(issue) {
  const labelsResult = typeof issue.labels === "function" ? await issue.labels() : issue.labels
  const labels = labelsResult?.nodes?.map(label => label.name).join(", ") || ""
  const state = await resolveIssueState(issue)
  const lines = [
    `${issue.identifier}: ${issue.title}`,
    `Status: ${mapLinearStateToTmStatus(state)}`,
  ]
  if (labels) lines.push(`Labels: ${labels}`)
  if (issue.description) lines.push("", issue.description)
  return lines.join("\n")
}

function parseArgValue(args, flag) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) {
      const nextArg = args[index + 1]
      if (!nextArg || nextArg.startsWith("--")) return null
      return nextArg
    }
  }
  return null
}

function hasArgFlag(args, flag) {
  return args.includes(flag)
}

function parseStatusArg(args) {
  return parseArgValue(args, "--status")
}

function parseParentArg(args) {
  return parseArgValue(args, "--parent")
}

function isSupportedTmStatus(status) {
  return ["open", "ready", "in_progress", "closed", "blocked"].includes(status)
}

function requireIssueRef(command, ref) {
  if (!ref) throw new Error(`Missing issue ref for ${command}.`)
}

async function runLinearBackendCommand(argv, { resolveContext = resolveLinearContextWithSdk } = {}) {
  const [command, ...args] = argv

  if (!command || command === "--help" || command === "-h") {
    return {
      exitCode: 0,
      stdout: [
        `tm linear backend (v${TM_LINEAR_BACKEND_VERSION})`,
        "",
        "Supported commands:",
        "  ready",
        "  list [--status <status>] [--parent <parent-ref>]",
        "  show <LINEAR-KEY>",
        "  update <LINEAR-KEY> --status <status>",
        "  close <LINEAR-KEY>",
      ].join("\n"),
      stderr: "",
    }
  }

  if (command === "--version" || command === "-v") {
    return { exitCode: 0, stdout: `tm linear backend ${TM_LINEAR_BACKEND_VERSION}`, stderr: "" }
  }

  if (!["ready", "list", "show", "update", "close"].includes(command)) {
    return { exitCode: 1, stdout: "", stderr: `tm: linear backend command "${command}" is not yet implemented.` }
  }

  if (command === "list") {
    const statusArg = parseStatusArg(args)
    if (hasArgFlag(args, "--status") && statusArg === null) {
      return { exitCode: 1, stdout: "", stderr: "tm: Missing value for --status." }
    }
    if (statusArg && !isSupportedTmStatus(statusArg)) {
      return { exitCode: 1, stdout: "", stderr: `tm: Unsupported tm status "${statusArg}" for linear backend.` }
    }
    if (hasArgFlag(args, "--parent") && parseParentArg(args) === null) {
      return { exitCode: 1, stdout: "", stderr: "tm: Missing value for --parent." }
    }
  }

  if (command === "show" || command === "update" || command === "close") {
    const issueRef = args[0] && !args[0].startsWith("--") ? args[0] : null
    if (!issueRef) {
      return { exitCode: 1, stdout: "", stderr: `tm: Missing issue ref for ${command}.` }
    }
  }

  if (command === "update") {
    const statusArg = parseStatusArg(args)
    if (hasArgFlag(args, "--status") && statusArg === null) {
      return { exitCode: 1, stdout: "", stderr: "tm: Missing value for --status." }
    }
    if (statusArg && !isSupportedTmStatus(statusArg)) {
      return { exitCode: 1, stdout: "", stderr: `tm: Unsupported tm status "${statusArg}" for linear backend.` }
    }
  }

  try {
    const context = await resolveContext()

    if (command === "ready") {
      return { exitCode: 0, stdout: await listIssues(context, "ready"), stderr: "" }
    }

    if (command === "list") {
      return {
        exitCode: 0,
        stdout: await listIssues(context, parseStatusArg(args), parseParentArg(args)),
        stderr: "",
      }
    }

    if (command === "show") {
      requireIssueRef(command, args[0])
      const issue = await findIssueByRef(context, args[0])
      return { exitCode: 0, stdout: await renderIssueDetails(issue), stderr: "" }
    }

    if (command === "update") {
      requireIssueRef(command, args[0])
      const issue = await findIssueByRef(context, args[0])
      const nextStatus = parseStatusArg(args)
      if (!nextStatus || !isSupportedTmStatus(nextStatus)) {
        throw new Error(`Unsupported tm status "${nextStatus || ""}" for linear backend.`)
      }
      const stateId = mapStatus(normalizeTmStatusForLinear(nextStatus), context.teamStates)
      if (!stateId) {
        throw new Error(`No matching Linear workflow state found for tm status "${nextStatus}".`)
      }
      await context.updateIssue(issue.id, { stateId })
      return { exitCode: 0, stdout: `${issue.identifier} -> ${nextStatus}`, stderr: "" }
    }

    if (command === "close") {
      requireIssueRef(command, args[0])
      const issue = await findIssueByRef(context, args[0])
      const stateId = mapStatus("closed", context.teamStates)
      if (!stateId) {
        throw new Error("No matching Linear completed state found.")
      }
      await context.updateIssue(issue.id, { stateId })
      return { exitCode: 0, stdout: `${issue.identifier} -> closed`, stderr: "" }
    }

  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: `tm: ${error.message}` }
  }
}

if (require.main === module) {
  runLinearBackendCommand(process.argv.slice(2)).then(result => {
    if (result.stdout) process.stdout.write(`${result.stdout}\n`)
    if (result.stderr) process.stderr.write(`${result.stderr}\n`)
    process.exit(result.exitCode)
  })
}

module.exports = {
  mapLinearStateToTmStatus,
  runLinearBackendCommand,
}
