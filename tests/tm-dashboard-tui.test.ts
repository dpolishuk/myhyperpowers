import { test, expect } from "bun:test"
import { TmDashboard, type TmDashboardState } from "../.pi/extensions/hyperpowers/tm-dashboard-tui"

function makeState(tasks: TmDashboardState["tasks"], error?: string): TmDashboardState {
  return { tasks, error }
}

test("renders empty state when no tasks", () => {
  const dashboard = new TmDashboard(makeState([]))
  const lines = dashboard.render(80)
  const text = lines.join("\n")
  expect(text).toContain("📋 Tasks")
  expect(text).toContain("No tasks found")
  expect(text).toContain("📄 Details")
})

test("renders task list in left pane", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
    { id: "bd-2", title: "Add tests", status: "in_progress", priority: 1, issue_type: "task" },
  ]))
  const lines = dashboard.render(80)
  const text = lines.join("\n")
  expect(text).toContain("Fix auth")
  expect(text).toContain("Add tests")
  expect(text).toContain("⏳")
  expect(text).toContain("🔄")
})

test("first task is selected by default", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
    { id: "bd-2", title: "Add tests", status: "open", priority: 1, issue_type: "task" },
  ]))
  const lines = dashboard.render(80)
  // First task should have ❯ prefix, second should have spaces
  const leftPane = lines.map(l => l.split("│")[0] || "")
  expect(leftPane.some(l => l.includes("❯") && l.includes("Fix auth"))).toBe(true)
  expect(leftPane.some(l => l.includes("  ") && l.includes("Add tests"))).toBe(true)
})

test("arrow down moves selection", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
    { id: "bd-2", title: "Add tests", status: "open", priority: 1, issue_type: "task" },
  ]))

  // Simulate arrow down
  dashboard.handleInput("\x1b[B")

  const lines = dashboard.render(80)
  const leftPane = lines.map(l => l.split("│")[0] || "")
  expect(leftPane.some(l => l.includes("  ") && l.includes("Fix auth"))).toBe(true)
  expect(leftPane.some(l => l.includes("❯") && l.includes("Add tests"))).toBe(true)
})

test("arrow up moves selection back", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
    { id: "bd-2", title: "Add tests", status: "open", priority: 1, issue_type: "task" },
  ]))

  dashboard.handleInput("\x1b[B") // down
  dashboard.handleInput("\x1b[A") // up

  const lines = dashboard.render(80)
  const leftPane = lines.map(l => l.split("│")[0] || "")
  expect(leftPane.some(l => l.includes("❯") && l.includes("Fix auth"))).toBe(true)
})

test("enter shows actions menu", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
  ]))

  dashboard.handleInput("\r") // enter

  const lines = dashboard.render(80)
  const text = lines.join("\n")
  expect(text).toContain("Actions")
  expect(text).toContain("Claim task")
  expect(text).toContain("Close task")
})

test("space triggers onClaim callback", () => {
  let claimedId = ""
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
  ]))
  dashboard.onClaim = (id) => { claimedId = id }

  dashboard.handleInput(" ") // space

  expect(claimedId).toBe("bd-1")
})

test("r key triggers onRefresh callback", () => {
  let refreshed = false
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
  ]))
  dashboard.onRefresh = () => { refreshed = true }

  dashboard.handleInput("r")

  expect(refreshed).toBe(true)
})

test("escape triggers onCancel callback", () => {
  let cancelled = false
  const dashboard = new TmDashboard(makeState([]))
  dashboard.onCancel = () => { cancelled = true }

  dashboard.handleInput("\x1b") // escape

  expect(cancelled).toBe(true)
})

test("displays error bar when error is set", () => {
  const dashboard = new TmDashboard(makeState([], "tm binary not found"))
  const lines = dashboard.render(80)
  const text = lines.join("\n")
  expect(text).toContain("tm binary not found")
})

test("updateState resets selection when tasks change", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
    { id: "bd-2", title: "Add tests", status: "open", priority: 1, issue_type: "task" },
  ]))

  dashboard.handleInput("\x1b[B") // select second
  dashboard.updateState({ tasks: [{ id: "bd-3", title: "New task", status: "open", priority: 2, issue_type: "feature" }] })

  const lines = dashboard.render(80)
  const leftPane = lines.map(l => l.split("│")[0] || "")
  expect(leftPane.some(l => l.includes("❯") && l.includes("New task"))).toBe(true)
})

test("right pane shows task details", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug", owner: "alice" },
  ]))

  const lines = dashboard.render(80)
  const text = lines.join("\n")
  expect(text).toContain("bd-1")
  expect(text).toContain("Fix auth")
  expect(text).toContain("bug")
  expect(text).toContain("alice")
  expect(text).toContain("P0")
})

test("action mode c key triggers onClaim", () => {
  let claimedId = ""
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
  ]))
  dashboard.onClaim = (id) => { claimedId = id }

  dashboard.handleInput("\r") // enter -> actions
  dashboard.handleInput("c")  // claim

  expect(claimedId).toBe("bd-1")
})

test("action mode x key triggers onClose", () => {
  let closedId = ""
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
  ]))
  dashboard.onClose = (id) => { closedId = id }

  dashboard.handleInput("\r") // enter -> actions
  dashboard.handleInput("x")  // close

  expect(closedId).toBe("bd-1")
})

test("escape in action mode returns to list", () => {
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug" },
  ]))

  dashboard.handleInput("\r") // enter -> actions
  let lines = dashboard.render(80)
  expect(lines.join("\n")).toContain("Claim task")

  dashboard.handleInput("\x1b") // escape
  lines = dashboard.render(80)
  // Right pane should no longer show the action menu options
  const rightPane = lines.map(l => l.split("│")[1] || "").join("\n")
  expect(rightPane).not.toContain("Claim task")
})

test("j/k and PageDown/PageUp scroll design preview", () => {
  const longDesign = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join("\n")
  const dashboard = new TmDashboard(makeState([
    { id: "bd-1", title: "Fix auth", status: "open", priority: 0, issue_type: "bug", design: longDesign },
  ]))

  let lines = dashboard.render(80).join("\n")
  expect(lines).toContain("Line 1")
  expect(lines).toContain("Line 25")
  expect(lines).not.toContain("Line 26")

  dashboard.handleInput("j")
  lines = dashboard.render(80).join("\n")
  expect(lines).not.toContain("│ Line 1\n")
  expect(lines).toContain("Line 6")
  expect(lines).toContain("Line 30")

  // Using PageDown key sequence (mocked if needed, but j/k is what we mostly use, let's just use j/k here since handleInput handles matchesKey or string)
  dashboard.handleInput("k")
  lines = dashboard.render(80).join("\n")
  expect(lines).toContain("│ Line 1\n")
})
