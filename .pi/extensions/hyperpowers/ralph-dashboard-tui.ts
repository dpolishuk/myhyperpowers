import {
  Container,
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui"

export type RalphPhase = 
  | "setup" 
  | "get_task" 
  | "subagent" 
  | "review" 
  | "completion"
  | "done"

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

export class RalphDashboard extends Container {
  private state: RalphState
  private onCancel?: () => void

  public tui?: any

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
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "q") {
      this.onCancel?.()
      return true
    }
    return true
  }

  render(width: number): string[] {
    const lines: string[] = []

    // 1. Header
    const epicStr = this.state.epicId ? `[${this.state.epicId}] ${this.state.epicTitle || ""}` : "Loading Epic..."
    const header = ` 🤖 Ralph Autonomous Execution ── ${epicStr} `
    lines.push(truncateToWidth(header, width))
    lines.push("─".repeat(Math.min(width, visibleWidth(header))))
    lines.push("")
    
    // 2. Phase Tracker
    const phases = [
      { id: "setup", label: "Setup" },
      { id: "get_task", label: "Get Task" },
      { id: "subagent", label: "Subagent" },
      { id: "review", label: "Review" },
      { id: "completion", label: "Completion" },
      { id: "done", label: "Done" },
    ]

    const phaseLabels = phases.map(p => {
      if (this.state.phase === p.id) return `\x1b[7m ${p.label} \x1b[27m`
      return ` ${p.label} `
    })
    lines.push(` 📍 Phase:  ${phaseLabels.join(" ➞ ")}`)
    lines.push("")

    // 3. Two-column Layout: Current Target vs Epic Status
    const leftWidth = Math.floor(width * 0.55)
    const rightWidth = Math.max(1, width - leftWidth - 1)

    const leftLines: string[] = []
    const rightLines: string[] = []

    // Left: Current Action / Subagent
    leftLines.push("╭── Current Focus ──────────────────────")
    if (this.state.currentTaskId) {
      leftLines.push(`│ Task: ${this.state.currentTaskId} - ${this.state.currentTaskTitle || ""}`)
      
      let statusIcon = "⏳"
      if (this.state.subagentStatus === "running") statusIcon = "🔄"
      else if (this.state.subagentStatus === "pass") statusIcon = "✅"
      else if (this.state.subagentStatus === "fail") statusIcon = "❌"
      else if (this.state.subagentStatus === "issues_found") statusIcon = "⚠️ "

      leftLines.push(`│ Subagent: ${statusIcon} ${this.state.subagentStatus || "pending"}`)
      if (this.state.subagentOutput) {
        leftLines.push(`│ Output: ${this.state.subagentOutput}`)
      }
    } else {
      leftLines.push("│ Task: Identifying next work item...")
    }

    leftLines.push("│")
    if (this.state.branchName) {
      leftLines.push(`│ Branch: 🌿 ${this.state.branchName}`)
      if (this.state.gitProgress) {
        leftLines.push(`│ Commits: ${this.state.gitProgress}`)
      }
    } else {
      leftLines.push(`│ Branch: pending...`)
    }

    // Right: Epic Progress
    rightLines.push("╭── Epic Progress ──────────────────────")
    if (this.state.totalCriteria > 0) {
      const total = Math.max(0, this.state.totalCriteria)
      const unmet = Math.min(Math.max(0, this.state.unmetCriteria), total)
      const met = total - unmet
      const percent = total === 0 ? 0 : Math.floor((met / total) * 100)
      const barWidth = 20
      const filled = Math.max(0, Math.min(barWidth, Math.floor((percent / 100) * barWidth)))
      const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
      rightLines.push(`│ Criteria: [${bar}] ${percent}%`)
      rightLines.push(`│ Completed: ${met}/${total}`)
    } else {
      rightLines.push("│ Criteria: Parsing...")
    }

    const fit = (text: string, w: number) => {
      const t = truncateToWidth(text, Math.max(1, w))
      return `${t}${" ".repeat(Math.max(0, w - visibleWidth(t)))}`
    }

    // Merge columns
    const maxCols = Math.max(leftLines.length, rightLines.length)
    for (let i = 0; i < maxCols; i++) {
      const l = fit(leftLines[i] || "│", leftWidth)
      const r = truncateToWidth(rightLines[i] || "│", Math.max(1, rightWidth))
      lines.push(truncateToWidth(`${l} ${r}`, width))
    }
    lines.push("")

    // 4. Logs
    lines.push("── Execution Logs ──")
    
    // We want to leave space for the bottom help text (2 lines) and account for lines already used.
    // If terminal object exists, we can dynamically size the log area.
    const termRows = this.tui?.terminal?.rows || 24
    const bottomReserved = 2
    const currentLinesCount = lines.length
    
    // Calculate how many logs we can fit, minimum 5
    const maxLogLines = Math.max(5, termRows - currentLinesCount - bottomReserved)
    const displayLogs = this.state.logs.slice(-maxLogLines)
    
    if (displayLogs.length === 0) {
      lines.push(" Waiting for logs...")
      // pad out remaining lines to prevent flickering height
      const toPad = maxLogLines - 1
      for(let i=0; i < toPad; i++) lines.push("")
    } else {
      for (const log of displayLogs) {
        lines.push(truncateToWidth(` > ${log}`, width))
      }
      // pad out remaining lines if fewer than maxLogLines
      const toPad = maxLogLines - displayLogs.length
      for(let i=0; i < toPad; i++) lines.push("")
    }

    lines.push("")
    lines.push("[q / Esc / Ctrl+C] Cancel Execution")

    return lines
  }
}
