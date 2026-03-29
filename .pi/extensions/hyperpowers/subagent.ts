import { spawnSync, type SpawnSyncReturns } from "node:child_process"

export interface ExecutePiSubagentParams {
  task: string
  model?: string | null
  cwd?: string
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
  const args = buildPiSubagentArgs(params.task, params.model)
  const cwd = params.cwd || process.cwd()
  const result = run("pi", args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 10,
    cwd,
  })

  const output = result.stdout?.trim() || ""
  if (result.status !== 0) {
    return {
      content: [{ type: "text" as const, text: `Subagent failed (exit ${result.status}): ${result.stderr?.trim() || output || "unknown error"}` }],
    }
  }

  return {
    content: [{ type: "text" as const, text: output || "(subagent returned empty result)" }],
  }
}
