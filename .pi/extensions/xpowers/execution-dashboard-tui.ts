import {
  Container,
  Box,
  Text,
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui"
import type { StructuredTaskStatus } from "./task-runner"

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

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.()
    }
  }

  render(width: number): string[] {
    const lines: string[] = []
    
    // Header
    const titleText = ` 🚀 ${this.state.title} `
    lines.push(truncateToWidth(titleText, width))
    lines.push("─".repeat(Math.min(width, titleText.length)))
    
    // Progress
    const total = this.state.tasks.length
    const completed = this.state.tasks.filter(t => t.status !== "pending" && t.status !== "running").length
    const percent = total > 0 ? Math.floor((completed / total) * 100) : 0
    
    const barWidth = 20
    const filled = Math.floor((percent / 100) * barWidth)
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
    lines.push(`[${bar}] ${percent}% Complete - ${completed}/${total} Tasks`)
    lines.push("")
    
    // Tasks list
    lines.push("Active Subagents:")
    
    for (const task of this.state.tasks) {
      let icon = "⏳"
      if (task.status === "running") icon = "🔄"
      else if (task.status === "PASS") icon = "✅"
      else if (task.status === "ISSUES_FOUND") icon = "⚠️ "
      else if (task.status === "FAIL") icon = "❌"

      let taskLine = `${icon} Task ${task.id}: ${task.title}`
      if (task.status === "running" && task.effort) {
        taskLine += ` [thinking: ${task.effort}]`
      } else if (task.status !== "pending" && task.status !== "running") {
        taskLine += ` [${task.status}]`
      }
      
      lines.push(truncateToWidth(taskLine, width))
      
      if (task.output) {
        lines.push(truncateToWidth(`   └─ ${task.output}`, width))
      } else if (task.summary) {
        lines.push(truncateToWidth(`   └─ ${task.summary}`, width))
      }
    }
    
    lines.push("")
    lines.push("[Ctrl+C / Esc] Cancel")
    
    return lines
  }
}
