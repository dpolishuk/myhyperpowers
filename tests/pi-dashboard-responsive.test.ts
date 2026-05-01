import { test, expect } from "bun:test"
import { BrainstormDashboard, type BrainstormState } from "../.pi/extensions/xpowers/brainstorm-tui"
import { LiveExecutionDashboard, type LiveExecutionState } from "../.pi/extensions/xpowers/execution-dashboard-tui"

function visibleLength(line: string): number {
  return line.replace(/\x1b\[[0-9;]*m/g, "").length
}

function expectAllLinesFit(lines: string[], width: number) {
  for (const line of lines) expect(visibleLength(line)).toBeLessThanOrEqual(width)
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
  const lines = dashboard.render(38)
  const text = lines.join("\n")

  expect(text).toContain("Epic Preview")
  expect(text).toContain("Current Question")
  expect(text).not.toContain("│ Q:")
  expectAllLinesFit(lines, 38)
})

test("Live execution dashboard uses compact progress and height cap on mobile terminals", () => {
  const state: LiveExecutionState = {
    title: "Parallel review with a very long title that should fit",
    tasks: Array.from({ length: 8 }, (_, index) => ({
      id: `task-${index + 1}`,
      title: "Review lane with a verbose description that should not overflow",
      status: index === 0 ? "running" : "pending",
      summary: "Summary that should be shortened on small screens",
    })),
  }
  const dashboard = new LiveExecutionDashboard(state)
  dashboard.tui = { terminal: { columns: 36, rows: 12 } }
  const lines = dashboard.render(36)
  const text = lines.join("\n")

  expect(text).toContain("Tasks")
  expect(text).toContain("more tasks")
  expect(lines.length).toBeLessThanOrEqual(12)
  expectAllLinesFit(lines, 36)
})
