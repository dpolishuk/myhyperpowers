import { test, expect } from "bun:test"

function buildOuterCatchResult(params: { format?: "text" | "structured" }, err: any) {
  if (params.format === "structured") {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        status: "FAIL",
        summary: err?.message || "Subagent failed unexpectedly",
        findings: [{
          message: err?.message || String(err),
          type: "tool-error",
          source: "hyperpowers-subagent-tool",
        }],
        nextAction: "Inspect routing resolution and subagent runtime state before retrying",
      }) }],
    }
  }

  return {
    content: [{ type: "text" as const, text: `Subagent failed: ${err.message || String(err)}` }],
  }
}

test("structured outer catch path preserves JSON contract", () => {
  const result = buildOuterCatchResult({ format: "structured" }, new Error("routing blew up"))
  const parsed = JSON.parse(result.content[0].text)

  expect(parsed.status).toBe("FAIL")
  expect(parsed.summary).toContain("routing blew up")
  expect(parsed.findings[0]).toMatchObject({
    message: "routing blew up",
    type: "tool-error",
    source: "hyperpowers-subagent-tool",
  })
})

test("text outer catch path remains plain text", () => {
  const result = buildOuterCatchResult({ format: "text" }, new Error("routing blew up"))
  expect(result.content[0].text).toContain("Subagent failed: routing blew up")
})
