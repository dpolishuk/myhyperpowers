import { test, expect, mock } from "bun:test"

import { buildParallelReviewRequests, runParallelReview } from "../.pi/extensions/hyperpowers/review-parallel"

test("buildParallelReviewRequests creates the three expected review lanes", () => {
  const requests = buildParallelReviewRequests()

  expect(requests.map((request) => request.lane)).toEqual([
    "quality",
    "implementation",
    "simplification",
  ])
  expect(requests.every((request) => request.params.format === "structured")).toBe(true)
  expect(requests[0]?.params.type).toBe("review")
  expect(requests[1]?.params.type).toBe("validation")
  expect(requests[2]?.params.type).toBe("review")
})

test("runParallelReview launches exactly three review jobs and aggregates deterministically", async () => {
  const execute = mock(async (params: any) => {
    if (params.task.includes("bugs, security issues")) {
      return { status: "PASS", summary: "No quality issues", findings: [] }
    }
    if (params.task.includes("stated goals")) {
      return { status: "ISSUES_FOUND", summary: "Missing one implementation detail", findings: [{ message: "gap" }] }
    }
    return { status: "PASS", summary: "No simplification issues", findings: [] }
  })

  const output = await runParallelReview({ cwd: "/tmp/project" }, execute)

  expect(execute).toHaveBeenCalledTimes(3)
  expect(output).toContain("Lane | Status | Summary")
  expect(output).toContain("quality | PASS | No quality issues")
  expect(output).toContain("implementation | ISSUES_FOUND | Missing one implementation detail")
  expect(output).toContain("simplification | PASS | No simplification issues")
})

test("runParallelReview reports lane failures without losing successful results", async () => {
  const execute = mock(async (params: any) => {
    if (params.task.includes("stated goals")) {
      throw new Error("pi subprocess crashed")
    }
    return { status: "PASS", summary: "ok", findings: [] }
  })

  const output = await runParallelReview({ cwd: "/tmp/project" }, execute)

  expect(output).toContain("quality | PASS | ok")
  expect(output).toContain("implementation | FAIL | pi subprocess crashed")
  expect(output).toContain("simplification | PASS | ok")
})

test("runParallelReview uses structured mode for all internal review requests", async () => {
  const execute = mock(async () => ({ status: "PASS", summary: "ok", findings: [] }))

  await runParallelReview({ cwd: "/tmp/project" }, execute)

  for (const call of execute.mock.calls) {
    expect(call[0]?.format).toBe("structured")
  }
})
