import { test, expect } from "bun:test"
import { RalphDashboard, type RalphState } from "../.pi/extensions/xpowers/ralph-dashboard-tui"

function makeState(overrides: Partial<RalphState> = {}): RalphState {
  return {
    phase: "subagent",
    epicId: "bd-1",
    epicTitle: "Responsive dashboard work",
    currentTaskId: "bd-2",
    currentTaskTitle: "Fix Ralph hotkeys and mobile layout",
    subagentStatus: "running",
    subagentOutput: "Subagent is producing a very long status line that must not overflow narrow terminals",
    branchName: "feature/mobile-friendly-ralph-dashboard",
    gitProgress: "3 commits ahead with a very long message",
    unmetCriteria: 2,
    totalCriteria: 5,
    logs: [
      "Started Ralph execution with a log entry that is intentionally long enough to require truncation",
      "Dispatched implementation subagent",
    ],
    ...overrides,
  }
}

function expectAllLinesFit(lines: string[], width: number) {
  for (const line of lines) {
    // Strip ANSI escape sequences for a stable visible-length approximation in tests.
    const visible = line.replace(/\x1b\[[0-9;]*m/g, "")
    expect(visible.length).toBeLessThanOrEqual(width)
  }
}

test("q, escape, and ctrl-c hotkeys cancel Ralph dashboard", () => {
  for (const key of ["q", "\x1b", "\x03"]) {
    let cancelled = false
    const dashboard = new RalphDashboard(makeState(), () => { cancelled = true })

    const handled = dashboard.handleInput(key)

    expect(handled).toBe(true)
    expect(cancelled).toBe(true)
  }
})

test("Ralph dashboard renders as stacked single-column layout on narrow terminals", () => {
  const dashboard = new RalphDashboard(makeState())
  dashboard.tui = { terminal: { columns: 38, rows: 16 } }

  const lines = dashboard.render(38)
  const text = lines.join("\n")

  expect(text).toContain("Current Focus")
  expect(text).toContain("Epic Progress")
  expect(text).not.toContain("╭── Current Focus ────────────────────── ╭── Epic Progress")
  expectAllLinesFit(lines, 38)
  expect(lines.length).toBeLessThanOrEqual(16)
})

test("Ralph dashboard keeps two-column layout on wide terminals", () => {
  const dashboard = new RalphDashboard(makeState())
  dashboard.tui = { terminal: { columns: 100, rows: 30 } }

  const lines = dashboard.render(100)
  const text = lines.join("\n")

  expect(text).toContain("╭── Current Focus")
  expect(text).toContain("╭── Epic Progress")
  expect(text).toContain("╭── Current Focus ──────────────────────")
  expectAllLinesFit(lines, 100)
})
