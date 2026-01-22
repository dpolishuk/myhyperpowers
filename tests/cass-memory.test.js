const test = require("node:test")
const assert = require("node:assert/strict")

const {
  formatCassContext,
  normalizeLimits,
  parseCassContext,
} = require("../.opencode/cass-memory/format.cjs")

test("formatCassContext returns null for empty context", () => {
  const result = formatCassContext(null, normalizeLimits({}))
  assert.equal(result, null)
})

test("formatCassContext orders bullets by relevance score", () => {
  const context = {
    relevantBullets: [
      { id: "b-2", content: "Second", relevanceScore: 0.1, maturity: "candidate" },
      { id: "b-1", content: "First", relevanceScore: 0.9, maturity: "proven" },
    ],
  }

  const output = formatCassContext(context, normalizeLimits({ maxRules: 5 }))
  assert.ok(output)
  assert.ok(output.indexOf("b-1") < output.indexOf("b-2"))
})

test("formatCassContext truncates long output", () => {
  const context = {
    relevantBullets: [
      {
        id: "b-1",
        content: "x".repeat(200),
        relevanceScore: 1,
        maturity: "proven",
      },
    ],
  }

  const output = formatCassContext(context, normalizeLimits({ maxChars: 80 }))
  assert.ok(output)
  assert.ok(output.endsWith("(truncated)"))
})

test("parseCassContext rejects invalid json", () => {
  const result = parseCassContext("{bad json")
  assert.equal(result.ok, false)
})
