import {
  Container,
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
  type Focusable,
} from "@mariozechner/pi-tui"
import type { StructuredTaskStatus } from "./task-runner"

interface DashboardTui {
  terminal?: { columns?: number; rows?: number }
  requestRender?: () => void
}

export interface LiveTaskState {
  id: string
  title: string
  status: "pending" | "running" | StructuredTaskStatus
  summary?: string
  effort?: string
  output?: string
}

export interface LiveExecutionState {
  title: string
  tasks: LiveTaskState[]
}

export class LiveExecutionDashboard extends Container implements Focusable {
  private state: LiveExecutionState
  public onCancel?: () => void
  private _focused = true
  public tui?: DashboardTui

  get focused(): boolean {
    return this._focused
  }
  set focused(value: boolean) {
    this._focused = value
  }

  constructor(initialState: LiveExecutionState, onCancel?: () => void) {
    super()
    this.state = initialState
    this.onCancel = onCancel
  }

  public updateTask(taskId: string, update: Partial<LiveTaskState>) {
    const taskIndex = this.state.tasks.findIndex(t => t.id === taskId)
    if (taskIndex !== -1) {
      this.state.tasks[taskIndex] = { ...this.state.tasks[taskIndex]!, ...update }
      this.invalidate()
    }
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "\x1b" || data === "q" || data === "Q") {
      this.onCancel?.()
      this.tui?.requestRender?.()
      return true
    }
    // Allow unhandled keys to fall through so Pi input stays responsive
    return false
  }

  render(width: number): string[] {
    const terminalColumns = this.tui?.terminal?.columns ?? width
    const renderWidth = Math.max(1, Math.min(width, terminalColumns))
    const termRows = Math.max(1, this.tui?.terminal?.rows || 24)
    const narrow = renderWidth < 80
    const innerWidth = Math.max(0, renderWidth - 2)
    const lines: string[] = []
    const push = (line = "") => lines.push(truncateToWidth(line, renderWidth))

    // ===== OUTER FRAME: TOP =====
    push(`╭${"─".repeat(innerWidth)}╮`)

    // ===== TITLE =====
    const titleText = ` 🚀 ${this.state.title} `
    const titleFit = truncateToWidth(titleText, innerWidth)
    const titlePad = "─".repeat(Math.max(0, innerWidth - visibleWidth(titleFit)))
    push(`│${titleFit}${titlePad}│`)

    push(`│${" ".repeat(innerWidth)}│`)

    // ===== PROGRESS =====
    const total = this.state.tasks.length
    const completed = this.state.tasks.filter(t => t.status !== "pending" && t.status !== "running").length
    const percent = total > 0 ? Math.floor((completed / total) * 100) : 0
    const barWidth = Math.max(1, Math.min(20, innerWidth - (narrow ? 19 : 28)))
    const filled = Math.floor((percent / 100) * barWidth)
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
    const progressText = narrow ? `[${bar}] ${completed}/${total} Tasks` : `[${bar}] ${percent}% Complete - ${completed}/${total} Tasks`
    const progressFit = truncateToWidth(progressText, innerWidth)
    const progressPad = " ".repeat(Math.max(0, innerWidth - visibleWidth(progressFit)))
    push(`│${progressFit}${progressPad}│`)

    push(`│${" ".repeat(innerWidth)}│`)

    // ===== TASK PANEL =====
    const panelWidth = innerWidth - 2
    const header = narrow ? "Tasks" : "Active Subagents"
    // Leave room for panel borders + help + bottom frame
    const panelContentMax = Math.max(1, termRows - lines.length - 5)
    const taskLines = this.buildTaskLines(narrow, panelWidth, panelContentMax)
    const taskBox = this.buildPanel(header, taskLines, panelWidth)
    for (const line of taskBox) push(`│ ${line} │`)

    // ===== HELP / FOOTER =====
    const helpLine = "[q / Esc / Ctrl+C] Cancel"
    const helpFit = truncateToWidth(` ${helpLine} `, innerWidth)
    const helpPad = " ".repeat(Math.max(0, innerWidth - visibleWidth(helpFit)))
    push(`│${helpFit}${helpPad}│`)

    // ===== OUTER FRAME: BOTTOM =====
    push(`╰${"─".repeat(innerWidth)}╯`)

    return lines.slice(0, termRows).map(line => truncateToWidth(line, renderWidth))
  }

  private buildPanel(title: string, content: string[], totalWidth: number): string[] {
    const innerWidth = Math.max(1, totalWidth - 2)
    const out: string[] = []

    const titleText = `── ${title} `
    const titleFit = truncateToWidth(titleText, innerWidth)
    const titlePad = "─".repeat(Math.max(0, innerWidth - visibleWidth(titleFit)))
    out.push(`╭${titleFit}${titlePad}╮`)

    for (const line of content) {
      const fit = truncateToWidth(line, innerWidth)
      const pad = " ".repeat(Math.max(0, innerWidth - visibleWidth(fit)))
      out.push(`│${fit}${pad}│`)
    }

    out.push(`╰${"─".repeat(innerWidth)}╯`)

    return out
  }

  private buildTaskLines(narrow: boolean, width: number, maxLines: number): string[] {
    const lines: string[] = []
    const total = this.state.tasks.length
    let renderedTasks = 0

    for (const task of this.state.tasks) {
      const rowCost = narrow ? 1 : (task.output || task.summary ? 2 : 1)
      if (lines.length + rowCost > maxLines) break

      let icon = "⏳"
      if (task.status === "running") icon = "🔄"
      else if (task.status === "PASS") icon = "✅"
      else if (task.status === "ISSUES_FOUND") icon = "⚠️ "
      else if (task.status === "FAIL") icon = "❌"

      let taskLine = narrow ? `${icon} ${task.id}: ${truncateToWidth(task.title, width - 6)}` : `${icon} Task ${task.id}: ${truncateToWidth(task.title, width - 12)}`
      if (task.status === "running" && task.effort) {
        taskLine += ` [thinking: ${task.effort}]`
      } else if (task.status !== "pending" && task.status !== "running") {
        taskLine += ` [${task.status}]`
      }
      lines.push(truncateToWidth(taskLine, width))
      renderedTasks++

      if (!narrow && task.output && lines.length < maxLines) {
        lines.push(truncateToWidth(`   └─ ${task.output}`, width))
      } else if (!narrow && task.summary && lines.length < maxLines) {
        lines.push(truncateToWidth(`   └─ ${task.summary}`, width))
      }
    }

    const hiddenTasks = total - renderedTasks
    if (hiddenTasks > 0) {
      lines.push(`... ${hiddenTasks} more tasks`)
    }

    return lines
  }
}
