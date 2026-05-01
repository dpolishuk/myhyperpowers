import { executePiSubagentAsync, type ExecutePiSubagentParams, type StructuredSubagentOutput } from "./subagent"
import { executePiTasksParallel } from "./task-runner"

export interface ResolvedParallelReviewRoute {
  model?: string | null
  effort?: string
}

export interface ParallelReviewParams extends ExecutePiSubagentParams {
  type: "review" | "validation"
  agent: "review-quality" | "review-implementation" | "review-simplification"
  format: "structured"
}

export interface ParallelReviewRequest {
  lane: "quality" | "implementation" | "simplification"
  params: ParallelReviewParams
}

export interface ParallelReviewExecutionContext {
  cwd?: string
  resolveRoute?: (params: Pick<ParallelReviewParams, "type" | "agent">) => ResolvedParallelReviewRoute
  uiCtx?: any
}

export type ParallelReviewExecutor = (params: ParallelReviewParams) => Promise<StructuredSubagentOutput>

export function buildParallelReviewRequests(cwd?: string): ParallelReviewRequest[] {
  return [
    {
      lane: "quality",
      params: {
        cwd,
        type: "review",
        agent: "review-quality",
        format: "structured",
        task: "Review the recent code changes for bugs, security issues, and race conditions. Check git diff HEAD~1. Return PASS or ISSUES_FOUND with file:line references.",
      },
    },
    {
      lane: "implementation",
      params: {
        cwd,
        type: "validation",
        agent: "review-implementation",
        format: "structured",
        task: "Verify the recent changes achieve their stated goals. Check git log --oneline -5 for context. Return PASS or ISSUES_FOUND with missing items.",
      },
    },
    {
      lane: "simplification",
      params: {
        cwd,
        type: "review",
        agent: "review-simplification",
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

function applyResolvedRoute(
  request: ParallelReviewRequest,
  resolveRoute?: (params: Pick<ParallelReviewParams, "type" | "agent">) => ResolvedParallelReviewRoute,
): ParallelReviewRequest {
  if (!resolveRoute) return request
  const resolved = resolveRoute({ type: request.params.type, agent: request.params.agent })
  return {
    lane: request.lane,
    params: {
      ...request.params,
      model: resolved.model ?? undefined,
      effort: resolved.effort,
    },
  }
}

export async function runParallelReview(
  ctx: ParallelReviewExecutionContext,
  execute: ParallelReviewExecutor = defaultParallelReviewExecutor,
): Promise<string> {
  const requests = buildParallelReviewRequests(ctx.cwd).map((request) => applyResolvedRoute(request, ctx.resolveRoute))
  
  let dashboard: any = null
  let handle: any = null
  const controller = new AbortController()

  if (ctx.uiCtx?.ui?.custom) {
    const { LiveExecutionDashboard } = await import("./execution-dashboard-tui.js")
    const initialState = {
      title: "Parallel Review",
      tasks: requests.map(req => ({
        id: req.lane,
        title: `Review ${req.lane}`,
        status: "pending" as const,
        effort: req.params.effort
      }))
    }
    dashboard = new LiveExecutionDashboard(initialState, () => {
      // Abort execution when user cancels
      controller.abort()
    })
    // Launch dashboard and save handle
    handle = ctx.uiCtx.ui.custom(
      (_tui: any, _theme: any, _keybindings: any, _done: (v: unknown) => void) => dashboard,
      { overlay: true }
    )
  }

  let results: any[] = []
  try {
    results = await executePiTasksParallel(requests, async ({ lane, params }) => {
      try {
        if (dashboard && handle) {
          dashboard.updateTask(lane, { status: "running" })
          handle.requestRender()
        }
        const result = await execute(params)
        if (dashboard && handle) {
          dashboard.updateTask(lane, { status: result.status, summary: result.summary })
          handle.requestRender()
        }
        return {
          lane,
          status: result.status,
          summary: result.summary,
        }
      } catch (error: any) {
        const summary = error?.message || String(error)
        if (dashboard && handle) {
          dashboard.updateTask(lane, { status: "FAIL", summary })
          handle.requestRender()
        }
        return {
          lane,
          status: "FAIL",
          summary,
        }
      }
    }, { maxConcurrency: 3, signal: controller.signal })
  } finally {
    handle?.close()
  }

  const lines = [
    "# Parallel Review",
    "",
    "Lane | Status | Summary",
    "--- | --- | ---",
    ...results.map((result) => `${result.lane} | ${result.status} | ${result.summary}`),
  ]

  return lines.join("\n")
}
