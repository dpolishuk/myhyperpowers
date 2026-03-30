import { executePiSubagentAsync, type ExecutePiSubagentParams, type StructuredSubagentOutput } from "./subagent"

export interface ParallelReviewParams extends ExecutePiSubagentParams {
  type: "review" | "validation"
  format: "structured"
}

export interface ParallelReviewRequest {
  lane: "quality" | "implementation" | "simplification"
  params: ParallelReviewParams
}

export interface ParallelReviewExecutionContext {
  cwd?: string
}

export type ParallelReviewExecutor = (params: ParallelReviewParams) => Promise<StructuredSubagentOutput>

export function buildParallelReviewRequests(cwd?: string): ParallelReviewRequest[] {
  return [
    {
      lane: "quality",
      params: {
        cwd,
        type: "review",
        format: "structured",
        task: "Review the recent code changes for bugs, security issues, and race conditions. Check git diff HEAD~1. Return PASS or ISSUES_FOUND with file:line references.",
      },
    },
    {
      lane: "implementation",
      params: {
        cwd,
        type: "validation",
        format: "structured",
        task: "Verify the recent changes achieve their stated goals. Check git log --oneline -5 for context. Return PASS or ISSUES_FOUND with missing items.",
      },
    },
    {
      lane: "simplification",
      params: {
        cwd,
        type: "review",
        format: "structured",
        task: "Check for over-engineering in recent changes. Look for unnecessary abstractions. Return PASS or ISSUES_FOUND with recommendations.",
      },
    },
  ]
}

async function defaultParallelReviewExecutor(params: ParallelReviewParams): Promise<StructuredSubagentOutput> {
  const result = await executePiSubagentAsync(params)
  return JSON.parse(result.content[0]?.text || "{}") as StructuredSubagentOutput
}

export async function runParallelReview(
  ctx: ParallelReviewExecutionContext,
  execute: ParallelReviewExecutor = defaultParallelReviewExecutor,
): Promise<string> {
  const requests = buildParallelReviewRequests(ctx.cwd)
  const results = await Promise.all(requests.map(async ({ lane, params }) => {
    try {
      const result = await execute(params)
      return {
        lane,
        status: result.status,
        summary: result.summary,
      }
    } catch (error: any) {
      return {
        lane,
        status: "FAIL",
        summary: error?.message || String(error),
      }
    }
  }))

  const lines = [
    "# Parallel Review",
    "",
    "Lane | Status | Summary",
    "--- | --- | ---",
    ...results.map((result) => `${result.lane} | ${result.status} | ${result.summary}`),
  ]

  return lines.join("\n")
}
