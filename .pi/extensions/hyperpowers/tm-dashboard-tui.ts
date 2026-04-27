import {
  Container,
  matchesKey,
  Key,
  type Focusable,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui"
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
      this.designScrollOffset = Math.max(0, this.designScrollOffset - 5)
      this.invalidate()
    } else if (matchesKey(data, Key.pageDown) || data === "j") {
      this.designScrollOffset += 5
      this.invalidate()
    } else if (matchesKey(data, Key.enter)) {
      this.showingActions = true
      this.invalidate()
    } else if (matchesKey(data, Key.space)) {
      const task = this.state.tasks[this.selectedIndex]
      if (task) this.onClaim?.(task.id)
    } else if (data === "r") {
      this.onRefresh?.()
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
      : "[↑↓] Nav  [j/k] Scroll  [Enter] Actions  [Space] Claim  [r] Refresh  [Esc] Exit"
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

    for (let i = 0; i < this.state.tasks.length; i++) {
      const task = this.state.tasks[i]!
      const icon = this.statusIcon(task.status)
      const prefix = i === this.selectedIndex ? "❯ " : "  "
      const title = truncateToWidth(task.title, width - 4 - visibleWidth(icon))
      lines.push(truncateToWidth(`${prefix}${icon} ${title}`, width))
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
      const maxDesignLines = 25
      const designLines = task.design.split("\n")
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
