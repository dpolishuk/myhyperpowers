import { test, expect, beforeAll } from "bun:test"
import { visibleWidth } from "../.pi/extensions/xpowers/node_modules/@mariozechner/pi-tui"
import { BrainstormDashboard, type BrainstormState } from "../.pi/extensions/xpowers/brainstorm-tui"
import { LiveExecutionDashboard, type LiveExecutionState } from "../.pi/extensions/xpowers/execution-dashboard-tui"
import { RalphDashboard, type RalphState } from "../.pi/extensions/xpowers/ralph-dashboard-tui"

beforeAll(() => {
  try {
    const { initTheme } = require("../.pi/extensions/xpowers/node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/theme/theme.js")
    initTheme("dark")
  } catch {
    // theme init not available in test env — tests that need markdown will be skipped
  }
})

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

// iPhone 17 Termius realistic dimensions
const IPHONE_PORTRAIT = { columns: 38, rows: 28 }
const IPHONE_LANDSCAPE = { columns: 76, rows: 18 }
const IPHONE_KEYBOARD = { columns: 38, rows: 20 }

function ralphState(): RalphState {
  return {
    phase: "subagent",
    epicId: "bd-1",
    epicTitle: "Fix mobile dashboard layouts",
    currentTaskId: "bd-2",
    currentTaskTitle: "Test on iPhone 17 Termius",
    subagentStatus: "running",
    subagentOutput: "Running subagent...",
    branchName: "feature/iphone-dashboards",
    gitProgress: "2 commits ahead",
    unmetCriteria: 1,
    totalCriteria: 5,
    logs: ["Started Ralph execution", "Dispatched implementation subagent"],
  }
}

test("Ralph dashboard fits iPhone 17 portrait (38x28)", () => {
  const dashboard = new RalphDashboard(ralphState())
  dashboard.tui = { terminal: IPHONE_PORTRAIT }
  const lines = dashboard.render(IPHONE_PORTRAIT.columns)
  expectAllLinesFit(lines, IPHONE_PORTRAIT.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_PORTRAIT.rows)
  const text = lines.join("\n")
  expect(text).toContain("Ralph")
  expect(text).toContain("Phase")
  expect(text).toContain("Current Focus")
  expect(text).toContain("Epic Progress")
  expect(text).toContain("Hide Dashboard")
})

test("Ralph dashboard fits iPhone 17 landscape (76x18)", () => {
  const dashboard = new RalphDashboard(ralphState())
  dashboard.tui = { terminal: IPHONE_LANDSCAPE }
  const lines = dashboard.render(IPHONE_LANDSCAPE.columns)
  expectAllLinesFit(lines, IPHONE_LANDSCAPE.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_LANDSCAPE.rows)
  const text = lines.join("\n")
  expect(text).toContain("Ralph")
  expect(text).toContain("Current Focus")
  expect(text).toContain("Epic Progress")
})

test("Ralph dashboard fits iPhone 17 with keyboard open (38x20)", () => {
  const dashboard = new RalphDashboard(ralphState())
  dashboard.tui = { terminal: IPHONE_KEYBOARD }
  const lines = dashboard.render(IPHONE_KEYBOARD.columns)
  expectAllLinesFit(lines, IPHONE_KEYBOARD.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_KEYBOARD.rows)
})

test("Brainstorm dashboard fits iPhone 17 portrait (38x28)", () => {
  const dashboard = new BrainstormDashboard({
    requirements: ["Support iPhone 17 Termius terminals"],
    antiPatterns: [{ pattern: "Fixed desktop-only panes", reason: "mobile becomes unreadable" }],
    researchFindings: ["Pi TUI render(width) requires every line to fit"],
    openQuestions: ["What is narrow enough?"],
    history: [{ role: "agent", content: "Asked about responsive behavior" }],
    currentQuestion: {
      question: "How should narrow terminals render?",
      priority: "CRITICAL",
      options: [
        { label: "Adaptive single-column", description: "recommended for mobile" },
        { label: "Keep desktop panes" },
      ],
    },
  })
  dashboard.tui = { terminal: IPHONE_PORTRAIT }
  const lines = dashboard.render(IPHONE_PORTRAIT.columns)
  expectAllLinesFit(lines, IPHONE_PORTRAIT.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_PORTRAIT.rows)
  const text = lines.join("\n")
  expect(text).toContain("Brainstorming")
  expect(text).toContain("Current Question")
})

test("Brainstorm dashboard fits iPhone 17 landscape (76x18)", () => {
  const dashboard = new BrainstormDashboard({
    requirements: ["Support iPhone 17 Termius terminals"],
    antiPatterns: [{ pattern: "Fixed desktop-only panes", reason: "mobile becomes unreadable" }],
    researchFindings: ["Pi TUI render(width) requires every line to fit"],
    openQuestions: ["What is narrow enough?"],
    history: [{ role: "agent", content: "Asked about responsive behavior" }],
    currentQuestion: {
      question: "How should narrow terminals render?",
      priority: "CRITICAL",
      options: [
        { label: "Adaptive single-column", description: "recommended for mobile" },
        { label: "Keep desktop panes" },
      ],
    },
  })
  dashboard.tui = { terminal: IPHONE_LANDSCAPE }
  const lines = dashboard.render(IPHONE_LANDSCAPE.columns)
  expectAllLinesFit(lines, IPHONE_LANDSCAPE.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_LANDSCAPE.rows)
})

test("Execution dashboard fits iPhone 17 portrait (38x28)", () => {
  const dashboard = new LiveExecutionDashboard({
    title: "Parallel Review",
    tasks: [
      { id: "quality", title: "Review quality", status: "running", effort: "medium" },
      { id: "impl", title: "Review implementation", status: "pending" },
      { id: "simple", title: "Review simplification", status: "pending" },
    ],
  })
  dashboard.tui = { terminal: IPHONE_PORTRAIT }
  const lines = dashboard.render(IPHONE_PORTRAIT.columns)
  expectAllLinesFit(lines, IPHONE_PORTRAIT.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_PORTRAIT.rows)
  const text = lines.join("\n")
  expect(text).toContain("Parallel Review")
  expect(text).toContain("Tasks")
})

test("Execution dashboard fits iPhone 17 landscape (76x18)", () => {
  const dashboard = new LiveExecutionDashboard({
    title: "Parallel Review",
    tasks: [
      { id: "quality", title: "Review quality", status: "running", effort: "medium" },
      { id: "impl", title: "Review implementation", status: "pending" },
      { id: "simple", title: "Review simplification", status: "pending" },
    ],
  })
  dashboard.tui = { terminal: IPHONE_LANDSCAPE }
  const lines = dashboard.render(IPHONE_LANDSCAPE.columns)
  expectAllLinesFit(lines, IPHONE_LANDSCAPE.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_LANDSCAPE.rows)
})

test("Execution dashboard shows more-tasks indicator when tasks overflow on iPhone", () => {
  const dashboard = new LiveExecutionDashboard({
    title: "Parallel Review",
    tasks: Array.from({ length: 20 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: "Review lane with a verbose description",
      status: i === 0 ? "running" : "pending",
    })),
  })
  dashboard.tui = { terminal: IPHONE_KEYBOARD }
  const lines = dashboard.render(IPHONE_KEYBOARD.columns)
  expectAllLinesFit(lines, IPHONE_KEYBOARD.columns)
  expect(lines.length).toBeLessThanOrEqual(IPHONE_KEYBOARD.rows)
  const text = lines.join("\n")
  expect(text).toContain("more tasks")
})

// iPad Pro 13" (M4) and desktop display dimensions (from Perplexity research)
const IPAD_LANDSCAPE = { columns: 160, rows: 50 }
const IPAD_PORTRAIT = { columns: 100, rows: 80 }
const MACBOOK_13 = { columns: 240, rows: 90 }
const DESKTOP_24 = { columns: 380, rows: 100 }

function ralphStateManyLogs(): RalphState {
  return {
    phase: "subagent",
    epicId: "bd-1",
    epicTitle: "Fix mobile dashboard layouts with very long epic title that should still render correctly on all display sizes including desktop monitors",
    currentTaskId: "bd-2",
    currentTaskTitle: "Test on iPhone 17 Termius and iPad Pro and desktop displays",
    subagentStatus: "running",
    subagentOutput: "Subagent is producing output...",
    branchName: "feature/iphone-ipad-desktop-dashboards",
    gitProgress: "5 commits ahead",
    unmetCriteria: 2,
    totalCriteria: 8,
    logs: Array.from({ length: 30 }, (_, i) => `Log entry ${i + 1} with some content that simulates real execution logs`),
  }
}

test("Ralph dashboard fits iPad Pro 13-inch landscape (160x50)", () => {
  const dashboard = new RalphDashboard(ralphStateManyLogs())
  dashboard.tui = { terminal: IPAD_LANDSCAPE }
  const lines = dashboard.render(IPAD_LANDSCAPE.columns)
  expectAllLinesFit(lines, IPAD_LANDSCAPE.columns)
  expect(lines.length).toBeLessThanOrEqual(IPAD_LANDSCAPE.rows)
  const text = lines.join("\n")
  expect(text).toContain("Ralph")
  expect(text).toContain("Current Focus")
  expect(text).toContain("Epic Progress")
  expect(text).toContain("Execution Logs")
})

test("Ralph dashboard fits iPad Pro 13-inch portrait (100x80)", () => {
  const dashboard = new RalphDashboard(ralphStateManyLogs())
  dashboard.tui = { terminal: IPAD_PORTRAIT }
  const lines = dashboard.render(IPAD_PORTRAIT.columns)
  expectAllLinesFit(lines, IPAD_PORTRAIT.columns)
  expect(lines.length).toBeLessThanOrEqual(IPAD_PORTRAIT.rows)
})

test("Ralph dashboard fits MacBook Pro 13-inch (240x90)", () => {
  const dashboard = new RalphDashboard(ralphStateManyLogs())
  dashboard.tui = { terminal: MACBOOK_13 }
  const lines = dashboard.render(MACBOOK_13.columns)
  expectAllLinesFit(lines, MACBOOK_13.columns)
  expect(lines.length).toBeLessThanOrEqual(MACBOOK_13.rows)
})

test("Ralph dashboard fits desktop 24-inch 4K monitor (380x100)", () => {
  const dashboard = new RalphDashboard(ralphStateManyLogs())
  dashboard.tui = { terminal: DESKTOP_24 }
  const lines = dashboard.render(DESKTOP_24.columns)
  expectAllLinesFit(lines, DESKTOP_24.columns)
  expect(lines.length).toBeLessThanOrEqual(DESKTOP_24.rows)
})

test("Brainstorm dashboard uses two-column layout on iPad Pro landscape (160x50)", () => {
  const dashboard = new BrainstormDashboard({
    requirements: Array.from({ length: 10 }, (_, i) => `Requirement ${i + 1} for the mobile responsive dashboard feature`),
    antiPatterns: [{ pattern: "Fixed desktop-only panes", reason: "mobile becomes unreadable" }],
    researchFindings: ["Pi TUI render(width) requires every line to fit"],
    openQuestions: ["What is narrow enough?"],
    history: [{ role: "agent", content: "Asked about responsive behavior" }],
    currentQuestion: {
      question: "How should narrow terminals render?",
      priority: "CRITICAL",
      options: [
        { label: "Adaptive single-column", description: "recommended for mobile" },
        { label: "Keep desktop panes" },
      ],
    },
  })
  dashboard.tui = { terminal: IPAD_LANDSCAPE }
  const lines = dashboard.render(IPAD_LANDSCAPE.columns)
  expectAllLinesFit(lines, IPAD_LANDSCAPE.columns)
  expect(lines.length).toBeLessThanOrEqual(IPAD_LANDSCAPE.rows)
  const text = lines.join("\n")
  expect(text).toContain("Brainstorming")
  expect(text).toContain("Current Question")
  expect(text).toContain("Epic Preview")
})

test("Execution dashboard shows all tasks on large desktop (380x100)", () => {
  const dashboard = new LiveExecutionDashboard({
    title: "Parallel Review with many lanes",
    tasks: Array.from({ length: 20 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Review lane ${i + 1} with description`,
      status: i < 3 ? "running" : i < 8 ? "PASS" : "pending",
      effort: i < 3 ? "medium" : undefined,
    })),
  })
  dashboard.tui = { terminal: DESKTOP_24 }
  const lines = dashboard.render(DESKTOP_24.columns)
  expectAllLinesFit(lines, DESKTOP_24.columns)
  expect(lines.length).toBeLessThanOrEqual(DESKTOP_24.rows)
  const text = lines.join("\n")
  expect(text).toContain("Parallel Review")
  expect(text).toContain("Active Subagents")
})

test("All dashboards handle extreme width of 500 columns without overflow", () => {
  const dims = { columns: 500, rows: 100 }

  const ralph = new RalphDashboard(ralphStateManyLogs())
  ralph.tui = { terminal: dims }
  expectAllLinesFit(ralph.render(dims.columns), dims.columns)

  const brainstorm = new BrainstormDashboard({
    requirements: ["Test extreme width"],
    antiPatterns: [],
    researchFindings: [],
    openQuestions: [],
    history: [],
  })
  brainstorm.tui = { terminal: dims }
  expectAllLinesFit(brainstorm.render(dims.columns), dims.columns)

  const execution = new LiveExecutionDashboard({
    title: "Extreme width test",
    tasks: [{ id: "t1", title: "Task", status: "running" }],
  })
  execution.tui = { terminal: dims }
  expectAllLinesFit(execution.render(dims.columns), dims.columns)
})

// Regression tests for input handling (close/hide keys and key swallowing)
test("Ralph dashboard only consumes cancel keys and does not swallow normal input", () => {
  let cancelled = 0
  const dashboard = new RalphDashboard(ralphState(), () => { cancelled++ })

  // Non-cancel keys should fall through (return false)
  expect(dashboard.handleInput("x")).toBe(false)
  expect(dashboard.handleInput("a")).toBe(false)
  expect(dashboard.handleInput("1")).toBe(false)
  expect(cancelled).toBe(0)

  // Cancel keys should be consumed (return true) and trigger onCancel
  expect(dashboard.handleInput("q")).toBe(true)
  expect(cancelled).toBe(1)

  // Esc
  expect(dashboard.handleInput("\x1b")).toBe(true)
  expect(cancelled).toBe(2)

  // Ctrl+C
  expect(dashboard.handleInput("\x03")).toBe(true)
  expect(cancelled).toBe(3)
})

test("Live execution dashboard only consumes cancel keys and does not swallow normal input", () => {
  let cancelled = 0
  const dashboard = new LiveExecutionDashboard({
    title: "Parallel Review",
    tasks: [],
  }, () => { cancelled++ })

  // Non-cancel keys should fall through
  expect(dashboard.handleInput("x")).toBe(false)
  expect(dashboard.handleInput("a")).toBe(false)
  expect(cancelled).toBe(0)

  // Cancel keys should be consumed
  expect(dashboard.handleInput("q")).toBe(true)
  expect(cancelled).toBe(1)

  expect(dashboard.handleInput("\x1b")).toBe(true)
  expect(cancelled).toBe(2)

  expect(dashboard.handleInput("\x03")).toBe(true)
  expect(cancelled).toBe(3)
})

test("Brainstorm dashboard only consumes cancel keys when no question is active", () => {
  const dashboard = new BrainstormDashboard({
    requirements: ["Test input"],
    antiPatterns: [],
    researchFindings: [],
    openQuestions: [],
    history: [],
  })

  // No question active: cancel keys work, other keys fall through
  expect(dashboard.handleInput("x")).toBe(false)
  expect(dashboard.handleInput("q")).toBe(true)
  expect(dashboard.handleInput("\x1b")).toBe(true)
})

test("Brainstorm dashboard consumes arrow and enter keys when question is active", () => {
  let selected = -1
  const dashboard = new BrainstormDashboard({
    requirements: ["Test input"],
    antiPatterns: [],
    researchFindings: [],
    openQuestions: [],
    history: [],
    currentQuestion: {
      question: "Pick one",
      priority: "CRITICAL",
      options: [{ label: "A" }, { label: "B" }],
    },
  })
  dashboard.onOptionSelect = (index: number) => { selected = index }

  // Down navigation should be consumed and move selection to option 1
  expect(dashboard.handleInput("\x1b[B")).toBe(true) // arrow down

  // Enter should select option 1 and be consumed
  expect(dashboard.handleInput("\r")).toBe(true)
  expect(selected).toBe(1)
})
