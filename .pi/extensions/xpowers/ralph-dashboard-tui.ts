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
  public onCancel?: () => void
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
    const innerWidth = renderWidth - 2
    const lines: string[] = []
    const push = (line = "") => lines.push(truncateToWidth(line, renderWidth))

    push(`╭${"─".repeat(innerWidth)}╮`)

    const epicStr = this.state.epicId ? `[${this.state.epicId}] ${this.state.epicTitle || ""}` : "Loading Epic..."
    const title = narrow ? ` 🤖 Ralph ── ${epicStr} ` : ` 🤖 Ralph Autonomous Execution ── ${epicStr} `
    const titleFit = truncateToWidth(title, innerWidth)
    const titlePad = "─".repeat(Math.max(0, innerWidth - visibleWidth(titleFit)))
    push(`│${titleFit}${titlePad}│`)

    push(`│${" ".repeat(innerWidth)}│`)
    const phaseStr = this.renderPhase(narrow)
    const phaseFit = truncateToWidth(phaseStr, innerWidth - 2)
    const phasePad = " ".repeat(Math.max(0, innerWidth - 2 - visibleWidth(phaseFit)))
    push(`│ ${phaseFit}${phasePad} │`)
    push(`│${" ".repeat(innerWidth)}│`)

    const statusIcon = this.statusIcon()
    const focusContent = this.buildFocusContent(statusIcon, narrow)
    const progressContent = this.buildProgressContent(narrow ? innerWidth - 2 : Math.max(1, Math.floor((innerWidth - 3) * 0.45)))

    if (narrow) {
      const panelWidth = innerWidth - 2
      const focusBox = this.buildPanel("Current Focus", focusContent, panelWidth)
      for (const line of focusBox) push(`│ ${line} │`)
      push(`│${" ".repeat(innerWidth)}│`)
      const progressBox = this.buildPanel("Epic Progress", progressContent, panelWidth)
      for (const line of progressBox) push(`│ ${line} │`)
    } else {
      const gap = 1
      const available = innerWidth - 2
      const leftPanelWidth = Math.floor((available - gap) * 0.55)
      const rightPanelWidth = available - gap - leftPanelWidth

      const focusBox = this.buildPanel("Current Focus", focusContent, leftPanelWidth)
      const progressBox = this.buildPanel("Epic Progress", progressContent, rightPanelWidth)

      const maxRows = Math.max(focusBox.length, progressBox.length)
      for (let i = 0; i < maxRows; i++) {
        const l = focusBox[i] || " ".repeat(leftPanelWidth)
        const r = progressBox[i] || " ".repeat(rightPanelWidth)
        push(`│ ${l}${" ".repeat(gap)}${r} │`)
      }
    }

    push(`│${" ".repeat(innerWidth)}│`)

    const helpLine = "[q / Esc / Ctrl+C] Hide Dashboard"
    const reservedRows = 4
    const usedRows = lines.length
    const availableLogRows = Math.max(0, termRows - usedRows - reservedRows)

    const logPanelWidth = innerWidth - 2
    const logContent: string[] = []
    if (availableLogRows > 0) {
      if (this.state.logs.length === 0) {
        logContent.push(" Waiting for logs...")
      } else {
        const maxLogLines = Math.min(availableLogRows, this.state.logs.length)
        for (const log of this.state.logs.slice(-maxLogLines)) {
          logContent.push(`> ${log}`)
        }
      }
    }

    const logBox = this.buildPanel("Execution Logs", logContent, logPanelWidth)
    for (const line of logBox) push(`│ ${line} │`)

    push(`│${" ".repeat(innerWidth)}│`)

    const helpFit = truncateToWidth(` ${helpLine} `, innerWidth)
    const helpPad = " ".repeat(Math.max(0, innerWidth - visibleWidth(helpFit)))
    push(`│${helpFit}${helpPad}│`)

    push(`╰${"─".repeat(innerWidth)}╯`)

    return lines.slice(0, termRows).map(line => truncateToWidth(line, renderWidth))
  }

  private renderPhase(narrow: boolean): string {
    const phases = [
      { id: "setup", label: "Setup" },
      { id: "get_task", label: "Task" },
      { id: "subagent", label: "Agent" },
      { id: "review", label: "Review" },
      { id: "completion", label: "Finish" },
      { id: "done", label: "Done" },
    ]

    if (narrow) {
      const current = phases.find(p => p.id === this.state.phase)?.label || this.state.phase
      return `📍 Phase: ${current}`
    }

    const labels = phases.map(p => {
      if (this.state.phase === p.id) return `\x1b[7m ${p.label} \x1b[27m`
      return ` ${p.label} `
    })
    return `📍 Phase:  ${labels.join(" ➞ ")}`
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

  private buildFocusContent(statusIcon: string, compact: boolean): string[] {
    const lines: string[] = []
    if (this.state.currentTaskId) {
      lines.push(`Task: ${this.state.currentTaskId} - ${this.state.currentTaskTitle || ""}`)
      lines.push(`Agent: ${statusIcon} ${this.state.subagentStatus || "pending"}`)
      if (this.state.subagentOutput && !compact) {
        lines.push(`Output: ${this.state.subagentOutput}`)
      }
    } else {
      lines.push("Task: Identifying next work item...")
    }

    const branch = this.state.branchName ? `🌿 ${this.state.branchName}` : "pending..."
    lines.push(`Branch: ${branch}`)
    if (this.state.gitProgress && !compact) {
      lines.push(`Commits: ${this.state.gitProgress}`)
    }
    return lines
  }

  private buildProgressContent(width: number): string[] {
    const lines: string[] = []
    if (this.state.totalCriteria > 0) {
      const total = Math.max(0, this.state.totalCriteria)
      const unmet = Math.min(Math.max(0, this.state.unmetCriteria), total)
      const met = total - unmet
      const percent = total === 0 ? 0 : Math.floor((met / total) * 100)
      const barWidth = Math.max(1, Math.min(20, width - 22))
      const filled = Math.max(0, Math.min(barWidth, Math.floor((percent / 100) * barWidth)))
      const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
      lines.push(`Criteria: [${bar}] ${percent}%`)
      lines.push(`Completed: ${met}/${total}`)
    } else {
      lines.push("Criteria: Parsing...")
    }
    return lines
  }

  private statusIcon(): string {
    if (this.state.subagentStatus === "running") return "🔄"
    if (this.state.subagentStatus === "pass") return "✅"
    if (this.state.subagentStatus === "fail") return "❌"
    if (this.state.subagentStatus === "issues_found") return "⚠️ "
    return "⏳"
  }
}
