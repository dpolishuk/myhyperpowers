import {
  Container,
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
  type Focusable,
} from "@mariozechner/pi-tui"

export type RalphPhase = 
  | "setup" 
  | "get_task" 
  | "subagent" 
  | "review" 
  | "completion"
  | "done"

interface DashboardTui {
  terminal?: { columns?: number; rows?: number }
  requestRender?: () => void
}

export interface RalphState {
  phase: RalphPhase
  epicId?: string
  epicTitle?: string
  currentTaskId?: string
  currentTaskTitle?: string
  subagentStatus?: "pending" | "running" | "pass" | "fail" | "issues_found"
  subagentOutput?: string
  branchName?: string
  gitProgress?: string
  unmetCriteria: number
  totalCriteria: number
  logs: string[]
}

export class RalphDashboard extends Container implements Focusable {
  private state: RalphState
  private onCancel?: () => void
  private _focused = true

  public tui?: DashboardTui

  get focused(): boolean {
    return this._focused
  }

  set focused(value: boolean) {
    this._focused = value
  }

  constructor(initialState: RalphState, onCancel?: () => void) {
    super()
    this.state = initialState
    this.onCancel = onCancel
  }

  public updateState(newState: Partial<RalphState>) {
    this.state = { ...this.state, ...newState }
    this.requestInvalidate()
  }

  public addLog(message: string) {
    this.state.logs.push(message)
    // Keep max 50 logs
    if (this.state.logs.length > 50) {
      this.state.logs.shift()
    }
    this.requestInvalidate()
  }

  private invalidateScheduled = false

  private requestInvalidate() {
    if (this.invalidateScheduled) return
    this.invalidateScheduled = true
    queueMicrotask(() => {
      this.invalidateScheduled = false
      this.invalidate()
    })
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, Key.escape) || data === "\x1b" || matchesKey(data, Key.ctrl("c")) || data === "\x03" || data === "q" || data === "Q") {
      this.onCancel?.()
      this.tui?.requestRender?.()
      return true
    }

    // Do not swallow normal keyboard input. The dashboard is informational;
    // if it has focus unexpectedly, unhandled keys must be allowed to fall
    // through so Pi's main input remains responsive.
    return false
  }

  render(width: number): string[] {
    const terminalColumns = this.tui?.terminal?.columns ?? width
    const renderWidth = Math.max(1, Math.min(width, terminalColumns))
    const termRows = Math.max(1, this.tui?.terminal?.rows || 24)
    const narrow = renderWidth < 80
    const lines: string[] = []
    const push = (line = "") => lines.push(truncateToWidth(line, renderWidth))

    const epicStr = this.state.epicId ? `[${this.state.epicId}] ${this.state.epicTitle || ""}` : "Loading Epic..."
    const title = narrow ? ` 🤖 Ralph ── ${epicStr} ` : ` 🤖 Ralph Autonomous Execution ── ${epicStr} `
    push(title)
    push("─".repeat(renderWidth))
    push()

    const phases = [
      { id: "setup", label: narrow ? "Setup" : "Setup" },
      { id: "get_task", label: narrow ? "Task" : "Get Task" },
      { id: "subagent", label: narrow ? "Agent" : "Subagent" },
      { id: "review", label: narrow ? "Review" : "Review" },
      { id: "completion", label: narrow ? "Finish" : "Completion" },
      { id: "done", label: narrow ? "Done" : "Done" },
    ]

    const currentPhase = phases.find(p => p.id === this.state.phase)?.label || this.state.phase
    if (narrow) {
      push(` 📍 Phase: ${currentPhase}`)
    } else {
      const phaseLabels = phases.map(p => {
        if (this.state.phase === p.id) return `\x1b[7m ${p.label} \x1b[27m`
        return ` ${p.label} `
      })
      push(` 📍 Phase:  ${phaseLabels.join(" ➞ ")}`)
    }
    push()

    const statusIcon = this.statusIcon()
    const focusLines = this.buildFocusLines(statusIcon, narrow)
    const progressLines = this.buildProgressLines(narrow ? renderWidth : Math.max(1, Math.floor(renderWidth * 0.45)))

    if (narrow) {
      for (const line of focusLines.slice(0, 5)) push(line)
      push()
      for (const line of progressLines) push(line)
    } else {
      const leftWidth = Math.floor(renderWidth * 0.55)
      const rightWidth = Math.max(1, renderWidth - leftWidth - 1)
      const fit = (text: string, w: number) => {
        const t = truncateToWidth(text, Math.max(1, w))
        return `${t}${" ".repeat(Math.max(0, w - visibleWidth(t)))}`
      }
      const maxCols = Math.max(focusLines.length, progressLines.length)
      for (let i = 0; i < maxCols; i++) {
        const l = fit(focusLines[i] || "│", leftWidth)
        const r = truncateToWidth(progressLines[i] || "│", Math.max(1, rightWidth))
        push(`${l} ${r}`)
      }
    }
    push()

    push("── Execution Logs ──")

    const helpLine = "[q / Esc / Ctrl+C] Hide Dashboard"
    const reservedForHelp = 2
    const remainingRows = Math.max(0, termRows - lines.length - reservedForHelp)
    const maxLogLines = narrow ? Math.min(remainingRows, 3) : remainingRows
    const displayLogs = maxLogLines > 0 ? this.state.logs.slice(-maxLogLines) : []

    if (displayLogs.length === 0 && maxLogLines > 0) {
      push(" Waiting for logs...")
    } else {
      for (const log of displayLogs) push(` > ${log}`)
    }

    push()
    push(helpLine)

    return lines.slice(0, termRows).map(line => truncateToWidth(line, renderWidth))
  }

  private statusIcon(): string {
    if (this.state.subagentStatus === "running") return "🔄"
    if (this.state.subagentStatus === "pass") return "✅"
    if (this.state.subagentStatus === "fail") return "❌"
    if (this.state.subagentStatus === "issues_found") return "⚠️ "
    return "⏳"
  }

  private buildFocusLines(statusIcon: string, compact: boolean): string[] {
    const lines: string[] = [compact ? "╭─ Current Focus" : "╭── Current Focus ──────────────────────"]
    if (this.state.currentTaskId) {
      lines.push(`│ Task: ${this.state.currentTaskId} - ${this.state.currentTaskTitle || ""}`)
      lines.push(`│ Agent: ${statusIcon} ${this.state.subagentStatus || "pending"}`)
      if (this.state.subagentOutput && !compact) {
        lines.push(`│ Output: ${this.state.subagentOutput}`)
      }
    } else {
      lines.push("│ Task: Identifying next work item...")
    }

    const branch = this.state.branchName ? `🌿 ${this.state.branchName}` : "pending..."
    lines.push(`│ Branch: ${branch}`)
    if (this.state.gitProgress && !compact) lines.push(`│ Commits: ${this.state.gitProgress}`)
    return lines
  }

  private buildProgressLines(width: number): string[] {
    const lines: string[] = [width < 40 ? "╭─ Epic Progress" : "╭── Epic Progress ──────────────────────"]
    if (this.state.totalCriteria > 0) {
      const total = Math.max(0, this.state.totalCriteria)
      const unmet = Math.min(Math.max(0, this.state.unmetCriteria), total)
      const met = total - unmet
      const percent = total === 0 ? 0 : Math.floor((met / total) * 100)
      const barWidth = Math.max(1, Math.min(20, width - 22))
      const filled = Math.max(0, Math.min(barWidth, Math.floor((percent / 100) * barWidth)))
      const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
      lines.push(`│ Criteria: [${bar}] ${percent}%`)
      lines.push(`│ Completed: ${met}/${total}`)
    } else {
      lines.push("│ Criteria: Parsing...")
    }
    return lines
  }
}
