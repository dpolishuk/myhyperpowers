import {
  Container,
  matchesKey,
  Key,
  type Focusable,
  truncateToWidth,
  visibleWidth,
  Markdown,
} from "@mariozechner/pi-tui"
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent"
import type { TmTask } from "./tm-cli-wrapper"

export interface TmDashboardState {
  tasks: TmTask[]
  error?: string
}

export class TmDashboard extends Container implements Focusable {
  private state: TmDashboardState
  private selectedIndex = 0
  private designScrollOffset = 0
  private _focused = true
  private showingActions = false

  public onClaim?: (taskId: string) => void
  public onClose?: (taskId: string) => void
  public onRefresh?: () => void
  public onCancel?: () => void

  public tui?: any

  private mdCache: { taskId: string; design: string; width: number; lines: string[] } | null = null

  private getOverlayHeight(): number {
    const rows = this.tui?.terminal?.rows ?? 24
    return Math.max(1, Math.floor(rows * 0.9))
  }

  get focused(): boolean {
    return this._focused
  }
  set focused(value: boolean) {
    this._focused = value
  }

  constructor(initialState: TmDashboardState) {
    super()
    this.state = initialState
  }

  public updateState(newState: Partial<TmDashboardState>) {
    const hadTasks = this.state.tasks.length > 0
    this.state = { ...this.state, ...newState }
    // Reset selection if tasks changed significantly or if previously empty
    if (!hadTasks || this.state.tasks.length === 0) {
      this.selectedIndex = 0
      this.designScrollOffset = 0
    }
    // Clamp selection
    if (this.selectedIndex >= this.state.tasks.length) {
      this.selectedIndex = Math.max(0, this.state.tasks.length - 1)
      this.designScrollOffset = 0
    }
    this.showingActions = false
    this.invalidate()
  }

  handleInput(data: string): boolean {
    const taskCount = this.state.tasks.length

    if (matchesKey(data, Key.escape) || data === "\x1b") {
      if (this.showingActions) {
        this.showingActions = false
        this.invalidate()
        return true
      }
      this.onCancel?.()
      return true
    }

    if (taskCount === 0) {
      if (data === "r") {
        this.onRefresh?.()
      } else if (data === "q") {
        this.onCancel?.()
      }
      return true
    }

    if (this.showingActions) {
      if (data === "c") {
        const task = this.state.tasks[this.selectedIndex]
        if (task) this.onClaim?.(task.id)
        this.showingActions = false
      } else if (data === "x") {
        const task = this.state.tasks[this.selectedIndex]
        if (task) this.onClose?.(task.id)
        this.showingActions = false
      }
      this.invalidate()
      return true
    }

    if (matchesKey(data, Key.up) && this.selectedIndex > 0) {
      this.selectedIndex--
      this.designScrollOffset = 0
      this.invalidate()
    } else if (matchesKey(data, Key.down) && this.selectedIndex < taskCount - 1) {
      this.selectedIndex++
      this.designScrollOffset = 0
      this.invalidate()
    } else if (matchesKey(data, Key.pageUp) || data === "k") {
      this.designScrollOffset = Math.max(0, this.designScrollOffset - 1)
      this.invalidate()
    } else if (matchesKey(data, Key.pageDown) || data === "j") {
      this.designScrollOffset += 1
      this.invalidate()
    } else if (matchesKey(data, Key.enter)) {
      this.showingActions = true
      this.invalidate()
    } else if (matchesKey(data, Key.space)) {
      const task = this.state.tasks[this.selectedIndex]
      if (task) this.onClaim?.(task.id)
    } else if (data === "r") {
      this.onRefresh?.()
    } else if (data === "q") {
      this.onCancel?.()
    }
    return true
  }

  render(width: number): string[] {
    const leftWidth = Math.floor(width * 0.4)
    const rightWidth = width - leftWidth - 1 // 1 for divider

    const leftLines = this.renderLeftPane(leftWidth)
    const rightLines = this.renderRightPane(rightWidth)

    const maxLines = Math.max(leftLines.length, rightLines.length)
    const out: string[] = []
    for (let i = 0; i < maxLines; i++) {
      const l = leftLines[i] || ""
      const r = rightLines[i] || ""
      const lLen = visibleWidth(l)
      const lPad = " ".repeat(Math.max(0, leftWidth - lLen))
      out.push(`${l}${lPad}│ ${r}`)
    }

    // Error / Help bar at bottom
    if (this.state.error) {
      out.push("")
      out.push(truncateToWidth(`⚠️  ${this.state.error}`, width))
    }
    out.push("")
    const help = this.showingActions
      ? "[c] Claim  [x] Close  [Esc] Back"
      : "[↑↓] Nav  [j/k] Scroll  [Enter] Actions  [Space] Claim  [r] Refresh  [q/Esc] Exit"
    out.push(truncateToWidth(help, width))

    return out
  }

  private renderLeftPane(width: number): string[] {
    const lines: string[] = []
    lines.push(truncateToWidth(" 📋 Tasks ", width))
    lines.push("─".repeat(Math.min(width, visibleWidth(" 📋 Tasks "))))

    if (this.state.tasks.length === 0) {
      lines.push("No tasks found.")
      return lines
    }

    const overlayHeight = this.getOverlayHeight()
    const footerLines = this.state.error ? 4 : 2 // global bottom bars
    const staticLines = 2 // "Tasks" header + divider
    const indicatorReserve = this.state.tasks.length > 1 ? 2 : 0
    const maxListLines = Math.max(1, overlayHeight - footerLines - staticLines - indicatorReserve)

    let startIdx = 0
    let endIdx = this.state.tasks.length

    if (this.state.tasks.length > maxListLines) {
      startIdx = Math.max(0, this.selectedIndex - Math.floor(maxListLines / 2))
      endIdx = Math.min(this.state.tasks.length, startIdx + maxListLines)

      // Adjust start if end hit the boundary
      if (endIdx - startIdx < maxListLines) {
        startIdx = Math.max(0, endIdx - maxListLines)
      }
    }

    if (startIdx > 0) {
      lines.push(truncateToWidth("↑ ...", width))
    }

    for (let i = startIdx; i < endIdx; i++) {
      const task = this.state.tasks[i]!
      const icon = this.statusIcon(task.status)
      const prefix = i === this.selectedIndex ? "❯ " : "  "
      const title = truncateToWidth(task.title, width - 4 - visibleWidth(icon))
      lines.push(truncateToWidth(`${prefix}${icon} ${title}`, width))
    }

    if (endIdx < this.state.tasks.length) {
      lines.push(truncateToWidth("↓ ...", width))
    }

    return lines
  }

  private renderRightPane(width: number): string[] {
    const lines: string[] = []
    lines.push(truncateToWidth(" 📄 Details ", width))
    lines.push("─".repeat(Math.min(width, visibleWidth(" 📄 Details "))))

    if (this.state.tasks.length === 0) {
      lines.push("Select a task to view details.")
      return lines
    }

    const task = this.state.tasks[this.selectedIndex]
    if (!task) {
      lines.push("Select a task to view details.")
      return lines
    }

    lines.push(truncateToWidth(`ID:    ${task.id}`, width))
    lines.push(truncateToWidth(`Title: ${task.title}`, width))
    lines.push(truncateToWidth(`Type:  ${task.issue_type}`, width))
    lines.push(truncateToWidth(`Status: ${task.status} ${this.statusIcon(task.status)}`, width))
    lines.push(truncateToWidth(`Priority: P${task.priority}`, width))
    if (task.owner) {
      lines.push(truncateToWidth(`Owner: ${task.owner}`, width))
    }

    lines.push("")
    if (this.showingActions) {
      lines.push("─── Actions ───")
      lines.push("[c] Claim task (set in_progress)")
      lines.push("[x] Close task")
      lines.push("[Esc] Back to list")
    } else if (task.design) {
      const overlayHeight = this.getOverlayHeight()
      const footerLines = this.state.error ? 4 : 2

      let designLines: string[]
      if (
        this.mdCache &&
        this.mdCache.taskId === task.id &&
        this.mdCache.width === width &&
        this.mdCache.design === task.design
      ) {
        designLines = this.mdCache.lines
      } else {
        const mdTheme = getMarkdownTheme()
        const md = new Markdown(task.design, 0, 0, mdTheme)
        designLines = md.render(width)
        this.mdCache = { taskId: task.id, design: task.design, width, lines: designLines }
      }

      const staticLines = lines.length + 1 // existing right-pane lines + "Design preview" line
      const indicatorReserve = designLines.length > 0 ? 2 : 0
      const maxDesignLines = Math.max(1, overlayHeight - footerLines - staticLines - indicatorReserve)

      // Clamp scroll offset to not scroll completely past the content
      const maxScroll = Math.max(0, designLines.length - maxDesignLines)
      const offset = Math.min(this.designScrollOffset, maxScroll)
      this.designScrollOffset = offset

      const preview = designLines.slice(offset, offset + maxDesignLines)
      
      lines.push(truncateToWidth(`Design preview: (lines ${offset + 1}-${Math.min(designLines.length, offset + maxDesignLines)} of ${designLines.length})`, width))
      if (offset > 0) lines.push(truncateToWidth("↑ ...", width))
      for (const line of preview) {
        lines.push(truncateToWidth(line, width))
      }
      if (offset + maxDesignLines < designLines.length) {
        lines.push(truncateToWidth("↓ ...", width))
      }
    }

    return lines
  }

  private statusIcon(status: string): string {
    switch (status) {
      case "open":
      case "ready":
      case "todo":
        return "⏳"
      case "in_progress":
        return "🔄"
      case "done":
      case "closed":
        return "✅"
      case "blocked":
        return "⚠️"
      default:
        return "📋"
    }
  }
}
