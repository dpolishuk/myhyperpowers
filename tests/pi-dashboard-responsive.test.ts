import { test, expect } from "bun:test"
import { visibleWidth } from "../.pi/extensions/xpowers/node_modules/@mariozechner/pi-tui"
import { BrainstormDashboard, type BrainstormState } from "../.pi/extensions/xpowers/brainstorm-tui"
import { LiveExecutionDashboard, type LiveExecutionState } from "../.pi/extensions/xpowers/execution-dashboard-tui"

function expectAllLinesFit(lines: string[], width: number) {
  for (const line of lines) expect(visibleWidth(line)).toBeLessThanOrEqual(width)
}

test("Brainstorm dashboard collapses to readable single-column layout on narrow terminals", () => {
  const state: BrainstormState = {
    requirements: ["Support responsive dashboards on iPhone Termius terminals"],
    antiPatterns: [{ pattern: "Fixed desktop-only panes", reason: "mobile terminals become unreadable" }],
    researchFindings: ["Pi TUI render(width) requires every line to fit"],
    openQuestions: ["How narrow is narrow enough?"],
    history: [{ role: "agent", content: "Asked about responsive behavior" }],
    currentQuestion: {
      question: "How should narrow terminals render?",
      priority: "CRITICAL",
      options: [
        { label: "Adaptive single-column", description: "recommended for mobile" },
        { label: "Keep desktop panes" },
      ],
    },
  }
  const dashboard = new BrainstormDashboard(state)
  dashboard.tui = { terminal: { columns: 38, rows: 16 } }
  const lines = dashboard.render(38)
  const text = lines.join("\n")

  expect(text).toContain("Epic Preview")
  expect(text).toContain("Current Question")
  expectAllLinesFit(lines, 38)
})

test("Live execution dashboard uses compact progress and height cap on mobile terminals", () => {
  const state: LiveExecutionState = {
    title: "Parallel review with a very long title that should fit",
    tasks: Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index + 1}`,
      title: "Review lane with a verbose description that should not overflow",
      status: index === 0 ? "running" : "pending",
      summary: "Summary that should be shortened on small screens",
    })),
  }
  const dashboard = new LiveExecutionDashboard(state)
  dashboard.tui = { terminal: { columns: 36, rows: 14 } }
  const lines = dashboard.render(36)
  const text = lines.join("\n")

  expect(text).toContain("Tasks")
  expect(text).toContain("more tasks")
  expect(lines.length).toBeLessThanOrEqual(14)
  expectAllLinesFit(lines, 36)
})

test("Brainstorm narrow layout keeps current question visible when epic preview is long", () => {
  const dashboard = new BrainstormDashboard({
    requirements: Array.from({ length: 20 }, (_, i) => `Requirement ${i + 1} with enough text to consume rows`),
    antiPatterns: [{ pattern: "Hide the prompt", reason: "user cannot answer" }],
    researchFindings: [],
    openQuestions: [],
    history: [],
    currentQuestion: {
      question: "Which mobile layout should we use?",
      priority: "CRITICAL",
      options: [{ label: "Adaptive" }, { label: "Always compact" }],
    },
  })
  dashboard.tui = { terminal: { columns: 36, rows: 14 } }

  const text = dashboard.render(36).join("\n")

  expect(text).toContain("Current Question")
  expect(text).toContain("Which mobile layout")
  expect(text).toContain("Adaptive")
})

test("Pi dashboards respect terminal widths below twenty columns", () => {
  const brainstorm = new BrainstormDashboard({
    requirements: ["Very long requirement that must fit"],
    antiPatterns: [],
    researchFindings: [],
    openQuestions: [],
    history: [],
  })
  brainstorm.tui = { terminal: { columns: 12, rows: 8 } }
  expectAllLinesFit(brainstorm.render(12), 12)

  const execution = new LiveExecutionDashboard({
    title: "Very long live execution title",
    tasks: [{ id: "lane", title: "Very long task title", status: "running" }],
  })
  execution.tui = { terminal: { columns: 12, rows: 8 } }
  const executionLines = execution.render(12)
  expectAllLinesFit(executionLines, 12)
  expect(executionLines.length).toBeLessThanOrEqual(8)
})
