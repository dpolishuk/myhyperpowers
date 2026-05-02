import {
  Container,
  Markdown,
  matchesKey,
  Key,
  type Focusable,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui"
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent"

interface DashboardTui {
  terminal?: { columns?: number; rows?: number }
  requestRender?: () => void
}

export interface BrainstormState {
  requirements: string[]
  antiPatterns: { pattern: string; reason: string }[]
  researchFindings: string[]
  openQuestions: string[]
  history: { role: "agent" | "user"; content: string }[]
  currentQuestion?: {
    question: string
    options: { label: string; description?: string }[]
    priority: string
  }
}

export class BrainstormDashboard extends Container implements Focusable {
  private state: BrainstormState
  private selectedOption = 0
  private _focused = true

  public onOptionSelect?: (index: number) => void
  public onCancel?: () => void
  public tui?: DashboardTui

  get focused(): boolean {
    return this._focused
  }
  set focused(value: boolean) {
    this._focused = value
  }

  constructor(initialState: BrainstormState) {
    super()
    this.state = initialState
  }

  public updateState(newState: Partial<BrainstormState>) {
    const prevQuestion = this.state.currentQuestion?.question
    this.state = { ...this.state, ...newState }
    if (this.state.currentQuestion?.question !== prevQuestion) {
      this.selectedOption = 0 // reset selection only when the question changes
    }
    this.invalidate()
  }

  handleInput(data: string): boolean {
    // Cancel shortcuts always work
    if (matchesKey(data, Key.escape) || data === "\x1b" || data === "q" || data === "Q") {
      this.onCancel?.()
      this.tui?.requestRender?.()
      return true
    }

    if (!this.state.currentQuestion) {
      // No question active: don't swallow unrelated input
      return false
    }

    const optionsCount = this.state.currentQuestion.options.length
    if (matchesKey(data, Key.up) && this.selectedOption > 0) {
      this.selectedOption--
      this.invalidate()
      this.tui?.requestRender?.()
    } else if (matchesKey(data, Key.down) && this.selectedOption < optionsCount - 1) {
      this.selectedOption++
      this.invalidate()
      this.tui?.requestRender?.()
    } else if (matchesKey(data, Key.enter)) {
      this.onOptionSelect?.(this.selectedOption)
      this.tui?.requestRender?.()
    }
    return true
  }

  render(width: number): string[] {
    const terminalColumns = this.tui?.terminal?.columns ?? width
    const renderWidth = Math.max(1, Math.min(width, terminalColumns))
    const termRows = Math.max(1, this.tui?.terminal?.rows || 24)
    const narrow = renderWidth < 80
    const innerWidth = renderWidth - 2

    const lines: string[] = []
    const push = (line = "") => lines.push(truncateToWidth(line, renderWidth))

    // ===== OUTER FRAME: TOP =====
    push(`╭${"─".repeat(innerWidth)}╮`)

    // ===== TITLE =====
    const titleText = " 🧠 Brainstorming "
    const titleFit = truncateToWidth(titleText, innerWidth)
    const titlePad = "─".repeat(Math.max(0, innerWidth - visibleWidth(titleFit)))
    push(`│${titleFit}${titlePad}│`)

    // ===== BODY =====
    const reservedForBottom = 3 // help + bottom border + padding
    const bodyMaxRows = Math.max(1, termRows - lines.length - reservedForBottom)
    const bodyWidth = innerWidth - 2
    const bodyLines = narrow
      ? this.renderNarrowBody(bodyWidth, bodyMaxRows)
      : this.renderWideBody(bodyWidth, bodyMaxRows)

    for (const line of bodyLines) push(`│ ${line} │`)

    // ===== HELP / FOOTER =====
    const helpLine = this.state.currentQuestion
      ? "[↑↓] Select  [Enter] Confirm  [q/Esc] Cancel"
      : "[q / Esc] Close"
    const helpFit = truncateToWidth(` ${helpLine} `, innerWidth)
    const helpPad = " ".repeat(Math.max(0, innerWidth - visibleWidth(helpFit)))
    push(`│${helpFit}${helpPad}│`)

    // ===== OUTER FRAME: BOTTOM =====
    push(`╰${"─".repeat(innerWidth)}╯`)

    return lines.slice(0, termRows).map(line => truncateToWidth(line, renderWidth))
  }

  private renderNarrowBody(width: number, maxRows: number): string[] {
    const out: string[] = []
    const questionLines = this.renderQuestionPane(width)
    const epicLines = this.renderPlainEpic(width)

    // Show question first (priority), then epic preview
    out.push(...questionLines)
    if (out.length + epicLines.length + 1 <= maxRows) {
      out.push("")
      out.push(...epicLines)
    } else if (out.length < maxRows) {
      out.push("")
      out.push(...epicLines.slice(0, maxRows - out.length))
    }

    return out.map(line => truncateToWidth(line, width)).slice(0, maxRows)
  }

  private renderWideBody(width: number, maxRows: number): string[] {
    const leftWidth = Math.floor(width * 0.5)
    const rightWidth = width - leftWidth - 1

    const leftLines = this.renderEpicMarkdown(leftWidth)
    const rightLines = this.renderQuestionPane(rightWidth)

    const maxLines = Math.max(leftLines.length, rightLines.length)
    const out: string[] = []
    for (let i = 0; i < maxLines; i++) {
      const l = truncateToWidth(leftLines[i] || "", leftWidth)
      const r = truncateToWidth(rightLines[i] || "", rightWidth)
      const lLen = visibleWidth(l)
      const lPad = " ".repeat(Math.max(0, leftWidth - lLen))
      out.push(truncateToWidth(`${l}${lPad}│${r}`, width))
    }

    return out.slice(0, maxRows)
  }

  private renderEpicMarkdown(width: number): string[] {
    const mdTheme = getMarkdownTheme()
    const md = new Markdown(this.buildEpicMarkdown(), 0, 0, mdTheme)
    return md.render(Math.max(1, width - 2))
  }

  private buildEpicMarkdown(): string {
    let epicMd = "# Epic Preview\n\n"
    if (this.state.requirements.length > 0) {
      epicMd += "## Requirements (IMMUTABLE)\n"
      this.state.requirements.forEach((req) => (epicMd += `- ${req}\n`))
      epicMd += "\n"
    }
    if (this.state.antiPatterns.length > 0) {
      epicMd += "## Anti-Patterns (FORBIDDEN)\n"
      this.state.antiPatterns.forEach((ap) => (epicMd += `- ❌ ${ap.pattern} (${ap.reason})\n`))
      epicMd += "\n"
    }
    if (this.state.researchFindings.length > 0) {
      epicMd += "## Research Findings\n"
      this.state.researchFindings.forEach((rf) => (epicMd += `- ${rf}\n`))
      epicMd += "\n"
    }
    if (this.state.openQuestions.length > 0) {
      epicMd += "## Open Questions\n"
      this.state.openQuestions.forEach((oq) => (epicMd += `- ${oq}\n`))
      epicMd += "\n"
    }
    return epicMd
  }

  private renderPlainEpic(width: number): string[] {
    const lines: string[] = ["# Epic Preview"]
    const addSection = (title: string, items: string[]) => {
      if (items.length === 0) return
      lines.push(`## ${title}`)
      for (const item of items) lines.push(truncateToWidth(`- ${item}`, width))
    }
    addSection("Requirements", this.state.requirements)
    addSection("Anti-Patterns", this.state.antiPatterns.map(ap => `❌ ${ap.pattern} (${ap.reason})`))
    addSection("Research", this.state.researchFindings)
    addSection("Open Questions", this.state.openQuestions)
    return lines.map(line => truncateToWidth(line, width))
  }

  private renderQuestionPane(width: number): string[] {
    const rightLines: string[] = []
    rightLines.push("--- Q&A History ---")
    const historySlice = this.state.history.slice(-10)
    for (const msg of historySlice) {
      const prefix = msg.role === "agent" ? "🤖 " : "👤 "
      rightLines.push(truncateToWidth(prefix + msg.content, width))
    }
    rightLines.push("")

    if (this.state.currentQuestion) {
      rightLines.push("--- Current Question ---")
      rightLines.push(truncateToWidth(`Q: ${this.state.currentQuestion.question}`, width))
      rightLines.push(truncateToWidth(`Priority: ${this.state.currentQuestion.priority}`, width))
      rightLines.push("")
      this.state.currentQuestion.options.forEach((opt, i) => {
        const prefix = i === this.selectedOption ? "❯ " : "  "
        let text = prefix + opt.label
        if (opt.description) text += ` - ${opt.description}`
        rightLines.push(truncateToWidth(text, width))
      })
    } else {
      rightLines.push("Waiting for next question...")
    }
    return rightLines.map(line => truncateToWidth(line, width))
  }
}
