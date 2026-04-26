import {
  Container,
  Text,
  Box,
  Markdown,
  matchesKey,
  Key,
  type Focusable,
  type Component,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui"
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent"

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
  private leftPane: Box
  private rightPane: Box
  private selectedOption = 0
  private _focused = true

  public onOptionSelect?: (index: number) => void
  public onCancel?: () => void

  get focused(): boolean {
    return this._focused
  }
  set focused(value: boolean) {
    this._focused = value
  }

  constructor(initialState: BrainstormState) {
    super()
    this.state = initialState

    // We'll construct the two panes in render() because we need the width to split them
    this.leftPane = new Box(1, 1, (s) => s) // Background functions applied in render based on theme
    this.rightPane = new Box(1, 1, (s) => s)
  }

  public updateState(newState: Partial<BrainstormState>) {
    this.state = { ...this.state, ...newState }
    this.selectedOption = 0 // reset selection on new question
    this.invalidate()
  }

  handleInput(data: string): void {
    if (!this.state.currentQuestion) {
      if (matchesKey(data, Key.escape)) {
        this.onCancel?.()
      }
      return
    }

    const optionsCount = this.state.currentQuestion.options.length
    if (matchesKey(data, Key.up) && this.selectedOption > 0) {
      this.selectedOption--
      this.invalidate()
    } else if (matchesKey(data, Key.down) && this.selectedOption < optionsCount - 1) {
      this.selectedOption++
      this.invalidate()
    } else if (matchesKey(data, Key.enter)) {
      this.onOptionSelect?.(this.selectedOption)
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.()
    }
  }

  render(width: number): string[] {
    // Determine split width
    const leftWidth = Math.floor(width * 0.5)
    const rightWidth = width - leftWidth - 1 // 1 for divider

    // Build Epic Preview Markdown
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

    // Render Left Pane
    // We use a mock theme for Markdown here, but ideally we'd pass it in from render context
    const mdTheme = getMarkdownTheme()
    const md = new Markdown(epicMd || "Waiting for requirements...", 0, 0, mdTheme)
    const leftLines = md.render(leftWidth - 2) // padding

    // Render Right Pane (History & Current Question)
    const rightLines: string[] = []
    
    // History
    rightLines.push("--- Q&A History ---")
    const maxHistory = 10
    const historySlice = this.state.history.slice(-maxHistory)
    for (const msg of historySlice) {
      const prefix = msg.role === "agent" ? "🤖 " : "👤 "
      rightLines.push(truncateToWidth(prefix + msg.content, rightWidth - 2))
    }
    rightLines.push("")

    // Current Question
    if (this.state.currentQuestion) {
      rightLines.push(`Q: ${this.state.currentQuestion.question}`)
      rightLines.push(`Priority: ${this.state.currentQuestion.priority}`)
      rightLines.push("")
      this.state.currentQuestion.options.forEach((opt, i) => {
        const isSelected = i === this.selectedOption
        const prefix = isSelected ? "❯ " : "  "
        // TODO: ANSI styles for selected
        let text = prefix + opt.label
        if (opt.description) text += ` - ${opt.description}`
        rightLines.push(truncateToWidth(text, rightWidth - 2))
      })
    } else {
      rightLines.push("Waiting for next question...")
    }

    // Combine them side by side
    const maxLines = Math.max(leftLines.length, rightLines.length)
    const out: string[] = []
    for (let i = 0; i < maxLines; i++) {
      const l = leftLines[i] || ""
      const r = rightLines[i] || ""
      // Pad left
      const lLen = visibleWidth(l)
      const lPad = " ".repeat(Math.max(0, leftWidth - lLen))
      out.push(`${l}${lPad}│ ${r}`)
    }

    return out
  }
}
