import { spawnSync, type SpawnSyncReturns } from "node:child_process"

export type PiSubagentFormat = "text" | "structured"
export type PiThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

export const STRUCTURED_SUBAGENT_STATUSES = ["PASS", "ISSUES_FOUND", "FAIL"] as const
export const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const
export const HYPERPOWERS_SUBAGENT_DEPTH_ENV = "HYPERPOWERS_SUBAGENT_DEPTH"
export const MAX_HYPERPOWERS_SUBAGENT_DEPTH = 1
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
  effort?: string
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
    env: NodeJS.ProcessEnv
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

export function normalizeThinkingLevel(effort?: string): PiThinkingLevel | undefined {
  if (!effort) return undefined
  return PI_THINKING_LEVELS.includes(effort as PiThinkingLevel)
    ? effort as PiThinkingLevel
    : undefined
}

export function parseSubagentDepth(value?: string): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function buildFailureResult(format: PiSubagentFormat | undefined, summary: string, details: string, nextAction: string) {
  if (format === "structured") {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        status: "FAIL",
        summary,
        findings: [{ message: details }],
        nextAction,
      }) }],
    }
  }

  return {
    content: [{ type: "text" as const, text: `${summary}: ${details}` }],
  }
}

export function buildPiSubagentArgs(task: string, model?: string | null, thinking?: string): string[] {
  const args = ["--print", "--no-session"]
  if (model) {
    args.push("--model", model)
  }
  const normalizedThinking = normalizeThinkingLevel(thinking)
  if (normalizedThinking) {
    args.push("--thinking", normalizedThinking)
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
  const args = buildPiSubagentArgs(task, params.model, params.effort)
  const cwd = params.cwd || process.cwd()
  const currentDepth = parseSubagentDepth(process.env[HYPERPOWERS_SUBAGENT_DEPTH_ENV])
  if (currentDepth >= MAX_HYPERPOWERS_SUBAGENT_DEPTH) {
    return buildFailureResult(
      params.format,
      `Subagent failed (maximum subagent recursion depth ${MAX_HYPERPOWERS_SUBAGENT_DEPTH} reached)`,
      "Refusing to launch nested Pi subprocesses beyond the supported recursion limit",
      "Run the remaining review or investigation steps in the current session instead of spawning another subagent",
    )
  }

  const result = run("pi", args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 10,
    cwd,
    env: {
      ...process.env,
      [HYPERPOWERS_SUBAGENT_DEPTH_ENV]: String(currentDepth + 1),
    },
  })

  const output = result.stdout?.trim() || ""
  const details = result.stderr?.trim() || output || "unknown error"
  if (result.status === null) {
    const signalInfo = result.signal ? `; signal: ${result.signal}` : ""
    const errorInfo = result.error?.message ? `; error: ${result.error.message}` : ""
    return buildFailureResult(
      params.format,
      `Subagent failed (no exit status${signalInfo}${errorInfo})`,
      details,
      "Check Pi subprocess availability and runtime logs",
    )
  }
  if (result.status !== 0) {
    return buildFailureResult(
      params.format,
      `Subagent failed (exit ${result.status})`,
      details,
      "Inspect stderr/stdout details and retry once the subprocess issue is resolved",
    )
  }

  if (params.format === "structured") {
    try {
      const parsed = parseStructuredSubagentOutput(output)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(parsed) }],
      }
    } catch (error: any) {
      return buildFailureResult(
        params.format,
        error?.message || "Structured subagent output was not valid JSON",
        output || "(empty output)",
        "Retry with a clearer task or inspect the raw subagent output",
      )
    }
  }

  return {
    content: [{ type: "text" as const, text: output || "(subagent returned empty result)" }],
  }
}
