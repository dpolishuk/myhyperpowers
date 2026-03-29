import { spawnSync, type SpawnSyncReturns } from "node:child_process"

export type PiSubagentFormat = "text" | "structured"

export const STRUCTURED_SUBAGENT_STATUSES = ["PASS", "ISSUES_FOUND", "FAIL"] as const
export type StructuredSubagentStatus = typeof STRUCTURED_SUBAGENT_STATUSES[number]

export interface StructuredSubagentOutput {
  status: StructuredSubagentStatus
  summary: string
  findings: unknown[]
  nextAction?: string
}

export interface ExecutePiSubagentParams {
  task: string
  model?: string | null
  cwd?: string
  format?: PiSubagentFormat
}

export type SpawnSyncLike = (
  command: string,
  args: string[],
  options: {
    encoding: "utf8"
    timeout: number
    maxBuffer: number
    cwd: string
  },
) => SpawnSyncReturns<string>

export function buildStructuredSubagentTask(task: string): string {
  return `${task}\n\nReturn valid JSON only. Do not include markdown fences, commentary, or prose outside the JSON object. Use exactly this shape:\n{\n  "status": "PASS|ISSUES_FOUND|FAIL",\n  "summary": "short summary",\n  "findings": [],\n  "nextAction": "optional next step"\n}`
}

export function parseStructuredSubagentOutput(output: string): StructuredSubagentOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    throw new Error("Structured subagent output was not valid JSON")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Structured subagent output must be a JSON object")
  }

  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.status !== "string") {
    throw new Error("Structured subagent output must include string field 'status'")
  }
  if (!STRUCTURED_SUBAGENT_STATUSES.includes(candidate.status as StructuredSubagentStatus)) {
    throw new Error("Structured subagent output field 'status' must be one of PASS, ISSUES_FOUND, FAIL")
  }
  if (typeof candidate.summary !== "string") {
    throw new Error("Structured subagent output must include string field 'summary'")
  }
  if (!Array.isArray(candidate.findings)) {
    throw new Error("Structured subagent output must include array field 'findings'")
  }
  if (candidate.nextAction !== undefined && typeof candidate.nextAction !== "string") {
    throw new Error("Structured subagent output field 'nextAction' must be a string when present")
  }

  return {
    status: candidate.status as StructuredSubagentStatus,
    summary: candidate.summary,
    findings: candidate.findings,
    nextAction: candidate.nextAction as string | undefined,
  }
}

export function buildPiSubagentArgs(task: string, model?: string | null): string[] {
  const args = ["--print"]
  if (model) {
    args.push("--model", model)
  }
  args.push("--", task)
  return args
}

export function executePiSubagent(
  params: ExecutePiSubagentParams,
  run: SpawnSyncLike = spawnSync,
) {
  const task = params.format === "structured"
    ? buildStructuredSubagentTask(params.task)
    : params.task
  const args = buildPiSubagentArgs(task, params.model)
  const cwd = params.cwd || process.cwd()
  const result = run("pi", args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 10,
    cwd,
  })

  const output = result.stdout?.trim() || ""
  const details = result.stderr?.trim() || output || "unknown error"
  if (result.status === null) {
    const signalInfo = result.signal ? `; signal: ${result.signal}` : ""
    const errorInfo = result.error?.message ? `; error: ${result.error.message}` : ""
    if (params.format === "structured") {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          status: "FAIL",
          summary: `Subagent failed (no exit status${signalInfo}${errorInfo})`,
          findings: [{ message: details }],
          nextAction: "Check Pi subprocess availability and runtime logs",
        }) }],
      }
    }
    return {
      content: [{ type: "text" as const, text: `Subagent failed (no exit status${signalInfo}${errorInfo}): ${details}` }],
    }
  }
  if (result.status !== 0) {
    if (params.format === "structured") {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          status: "FAIL",
          summary: `Subagent failed (exit ${result.status})`,
          findings: [{ message: details }],
          nextAction: "Inspect stderr/stdout details and retry once the subprocess issue is resolved",
        }) }],
      }
    }
    return {
      content: [{ type: "text" as const, text: `Subagent failed (exit ${result.status}): ${details}` }],
    }
  }

  if (params.format === "structured") {
    try {
      const parsed = parseStructuredSubagentOutput(output)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(parsed) }],
      }
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          status: "FAIL",
          summary: error?.message || "Structured subagent output was not valid JSON",
          findings: [{ message: output || "(empty output)" }],
          nextAction: "Retry with a clearer task or inspect the raw subagent output",
        }) }],
      }
    }
  }

  return {
    content: [{ type: "text" as const, text: output || "(subagent returned empty result)" }],
  }
}
