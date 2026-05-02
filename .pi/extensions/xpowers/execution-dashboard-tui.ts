import {
  Container,
  matchesKey,
  Key,
  truncateToWidth,
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

export class LiveExecutionDashboard extends Container {
  private state: LiveExecutionState
  private onCancel?: () => void
  public tui?: DashboardTui

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
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.()
      this.tui?.requestRender?.()
      return true
    }
    return true
  }

  render(width: number): string[] {
    const terminalColumns = this.tui?.terminal?.columns ?? width
    const renderWidth = Math.max(1, Math.min(width, terminalColumns))
    const termRows = Math.max(1, this.tui?.terminal?.rows || 24)
    const narrow = renderWidth < 80
    const lines: string[] = []
    const push = (line = "") => lines.push(truncateToWidth(line, renderWidth))

    const titleText = ` 🚀 ${this.state.title} `
    push(titleText)
    push("─".repeat(renderWidth))

    const total = this.state.tasks.length
    const completed = this.state.tasks.filter(t => t.status !== "pending" && t.status !== "running").length
    const percent = total > 0 ? Math.floor((completed / total) * 100) : 0
    const barWidth = Math.max(1, Math.min(20, renderWidth - (narrow ? 19 : 28)))
    const filled = Math.floor((percent / 100) * barWidth)
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
    push(narrow ? `[${bar}] ${completed}/${total} Tasks` : `[${bar}] ${percent}% Complete - ${completed}/${total} Tasks`)
    push("")
    push(narrow ? "Tasks:" : "Active Subagents:")

    const reservedRows = lines.length + 3
    const maxTaskRows = Math.max(0, termRows - reservedRows)
    let usedTaskRows = 0
    let renderedTasks = 0

    for (const task of this.state.tasks) {
      const rowCost = narrow ? 1 : (task.output || task.summary ? 2 : 1)
      if (usedTaskRows + rowCost > maxTaskRows) break

      let icon = "⏳"
      if (task.status === "running") icon = "🔄"
      else if (task.status === "PASS") icon = "✅"
      else if (task.status === "ISSUES_FOUND") icon = "⚠️ "
      else if (task.status === "FAIL") icon = "❌"

      let taskLine = narrow ? `${icon} ${task.id}: ${task.title}` : `${icon} Task ${task.id}: ${task.title}`
      if (task.status === "running" && task.effort) {
        taskLine += ` [thinking: ${task.effort}]`
      } else if (task.status !== "pending" && task.status !== "running") {
        taskLine += ` [${task.status}]`
      }
      push(taskLine)
      usedTaskRows++
      renderedTasks++

      if (!narrow && task.output && usedTaskRows < maxTaskRows) {
        push(`   └─ ${task.output}`)
        usedTaskRows++
      } else if (!narrow && task.summary && usedTaskRows < maxTaskRows) {
        push(`   └─ ${task.summary}`)
        usedTaskRows++
      }
    }

    const hiddenTasks = total - renderedTasks
    if (hiddenTasks > 0 && lines.length < termRows - 2) {
      push(`... ${hiddenTasks} more tasks`)
    }

    push("")
    push("[Ctrl+C / Esc] Cancel")

    return lines.slice(0, termRows).map(line => truncateToWidth(line, renderWidth))
  }
}
