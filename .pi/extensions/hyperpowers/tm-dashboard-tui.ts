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

  private viewMode: "list" | "kanban" = "list"
  private kanbanActiveColumn: 0 | 1 | 2 = 0
  private kanbanSelectedIndex: [number, number, number] = [0, 0, 0]
  private kanbanTasks: [TmTask[], TmTask[], TmTask[]] = [[], [], []]

  // Used for disposing mouse tracking
  dispose?(): void

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
    this.updateKanbanTasks()
  }

  private updateKanbanTasks() {
    this.kanbanTasks = [[], [], []]
    for (const task of this.state.tasks) {
      if (task.status === "in_progress") {
        this.kanbanTasks[1].push(task)
      } else if (task.status === "done" || task.status === "closed") {
        this.kanbanTasks[2].push(task)
      } else {
        this.kanbanTasks[0].push(task)
      }
    }
    
    // clamp selection
    for (let i = 0; i < 3; i++) {
      if (this.kanbanSelectedIndex[i] >= this.kanbanTasks[i]!.length) {
        this.kanbanSelectedIndex[i] = Math.max(0, this.kanbanTasks[i]!.length - 1)
      }
    }
  }

  public updateState(newState: Partial<TmDashboardState>) {
    const hadTasks = this.state.tasks.length > 0
    this.state = { ...this.state, ...newState }
    // Reset selection if tasks changed significantly or if previously empty
    if (!hadTasks || this.state.tasks.length === 0) {
      this.selectedIndex = 0
      this.designScrollOffset = 0
      this.kanbanSelectedIndex = [0, 0, 0]
    }
    // Clamp selection
    if (this.selectedIndex >= this.state.tasks.length) {
      this.selectedIndex = Math.max(0, this.state.tasks.length - 1)
      this.designScrollOffset = 0
    }
    this.updateKanbanTasks()
    this.showingActions = false
    this.invalidate()
  }

  handleInput(data: string): boolean {
    const taskCount = this.state.tasks.length

    if (data === "m") {
      this.viewMode = this.viewMode === "list" ? "kanban" : "list"
      if (this.viewMode === "kanban") {
         const selectedTask = this.state.tasks[this.selectedIndex]
         if (selectedTask) {
           for (let i = 0; i < 3; i++) {
             const idx = this.kanbanTasks[i]!.findIndex(t => t.id === selectedTask.id)
             if (idx !== -1) {
               this.kanbanActiveColumn = i as 0 | 1 | 2
               this.kanbanSelectedIndex[i] = idx
               break
             }
           }
         }
      } else {
         const activeTask = this.kanbanTasks[this.kanbanActiveColumn]?.[this.kanbanSelectedIndex[this.kanbanActiveColumn]]
         if (activeTask) {
           const idx = this.state.tasks.findIndex(t => t.id === activeTask.id)
           if (idx !== -1) {
             this.selectedIndex = idx
             this.designScrollOffset = 0
           }
         }
      }
      this.invalidate()
      return true
    }

    if (matchesKey(data, Key.escape) || data === "\x1b") {
      if (this.showingActions) {
        this.showingActions = false
        this.invalidate()
        return true
      }
      this.onCancel?.()
      return true
    }

    const mouseMatch = data.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/)
    if (mouseMatch) {
      const button = parseInt(mouseMatch[1]!, 10)
      const x = parseInt(mouseMatch[2]!, 10)
      const isRelease = mouseMatch[4] === "m"

      if (!isRelease) {
        // Scroll Up = 64, Scroll Down = 65
        const isScrollUp = button === 64 || button === 64 + 32 // Some terminals add 32 for motion
        const isScrollDown = button === 65 || button === 65 + 32
        
        if (button === 64 || button === 65) {
          const termWidth = this.tui?.terminal?.columns || 80
          // Overlay is 90% wide, centered. Left pane is 40% of overlay.
          // That means left pane is roughly from 5% to 41% of the terminal width.
          const isLeftPane = x <= Math.floor(termWidth * 0.45)
          
          if (isLeftPane) {
            if (button === 64 && this.selectedIndex > 0) {
              this.selectedIndex--
              this.designScrollOffset = 0
            } else if (button === 65 && this.selectedIndex < taskCount - 1) {
              this.selectedIndex++
              this.designScrollOffset = 0
            }
          } else {
            if (button === 64) {
              this.designScrollOffset = Math.max(0, this.designScrollOffset - 1)
            } else if (button === 65) {
              this.designScrollOffset += 1
            }
          }
          this.invalidate()
        }
      }
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
        const task = this.viewMode === "list" ? this.state.tasks[this.selectedIndex] : this.kanbanTasks[this.kanbanActiveColumn]?.[this.kanbanSelectedIndex[this.kanbanActiveColumn]]
        if (task) this.onClaim?.(task.id)
        this.showingActions = false
      } else if (data === "x") {
        const task = this.viewMode === "list" ? this.state.tasks[this.selectedIndex] : this.kanbanTasks[this.kanbanActiveColumn]?.[this.kanbanSelectedIndex[this.kanbanActiveColumn]]
        if (task) this.onClose?.(task.id)
        this.showingActions = false
      }
      this.invalidate()
      return true
    }

    if (this.viewMode === "list") {
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
    } else { // kanban mode
      if (matchesKey(data, Key.left) && this.kanbanActiveColumn > 0) {
        this.kanbanActiveColumn--
        this.invalidate()
      } else if (matchesKey(data, Key.right) && this.kanbanActiveColumn < 2) {
        this.kanbanActiveColumn++
        this.invalidate()
      } else if (matchesKey(data, Key.up) && this.kanbanSelectedIndex[this.kanbanActiveColumn] > 0) {
        this.kanbanSelectedIndex[this.kanbanActiveColumn]--
        this.invalidate()
      } else if (matchesKey(data, Key.down) && this.kanbanSelectedIndex[this.kanbanActiveColumn] < (this.kanbanTasks[this.kanbanActiveColumn]?.length || 0) - 1) {
        this.kanbanSelectedIndex[this.kanbanActiveColumn]++
        this.invalidate()
      } else if (matchesKey(data, Key.enter)) {
        const activeTask = this.kanbanTasks[this.kanbanActiveColumn]?.[this.kanbanSelectedIndex[this.kanbanActiveColumn]]
        if (activeTask) {
          const idx = this.state.tasks.findIndex(t => t.id === activeTask.id)
          if (idx !== -1) {
            this.selectedIndex = idx
            this.viewMode = "list"
            this.designScrollOffset = 0
            this.invalidate()
          }
        }
      } else if (matchesKey(data, Key.space)) {
        const task = this.kanbanTasks[this.kanbanActiveColumn]?.[this.kanbanSelectedIndex[this.kanbanActiveColumn]]
        if (task) this.onClaim?.(task.id)
      } else if (data === "r") {
        this.onRefresh?.()
      } else if (data === "q") {
        this.onCancel?.()
      }
    }
    return true
  }

  render(width: number): string[] {
    if (this.viewMode === "kanban") {
      return this.renderKanbanView(width)
    }

    const leftWidth = Math.floor(width * 0.4) - 1 // 1 for left border
    const rightWidth = width - leftWidth - 3 // 3 total border lines

    const leftLines = this.renderLeftPane(leftWidth)
    const rightLines = this.renderRightPane(rightWidth)

    const footerLines = this.state.error ? 4 : 2
    // 4 static lines for borders: top, header, divider, bottom
    const targetPaneLines = Math.max(1, this.getOverlayHeight() - footerLines - 4)
    const maxLines = Math.max(leftLines.length, rightLines.length, targetPaneLines)

    const out: string[] = []

    // Top border
    out.push(`╭${"─".repeat(leftWidth)}┬${"─".repeat(rightWidth)}╮`)

    // Headers
    const lTitle = truncateToWidth(" 📋 Tasks ", leftWidth)
    const rTitle = truncateToWidth(" 📄 Details ", rightWidth)
    const lTitlePad = " ".repeat(Math.max(0, leftWidth - visibleWidth(lTitle)))
    const rTitlePad = " ".repeat(Math.max(0, rightWidth - visibleWidth(rTitle)))
    out.push(`│${lTitle}${lTitlePad}│${rTitle}${rTitlePad}│`)

    // Divider
    out.push(`├${"─".repeat(leftWidth)}┼${"─".repeat(rightWidth)}┤`)

    for (let i = 0; i < maxLines; i++) {
      const l = leftLines[i] || ""
      const r = rightLines[i] || ""
      const lLen = visibleWidth(l)
      const lPad = " ".repeat(Math.max(0, leftWidth - lLen))
      const rLen = visibleWidth(r)
      const rPad = " ".repeat(Math.max(0, rightWidth - rLen))
      out.push(`│${l}${lPad}│${r}${rPad}│`)
    }

    // Bottom border
    out.push(`╰${"─".repeat(leftWidth)}┴${"─".repeat(rightWidth)}╯`)

    // Error / Help bar at bottom
    if (this.state.error) {
      out.push("")
      out.push(truncateToWidth(`⚠️  ${this.state.error}`, width))
    }
    out.push("")
    const help = this.showingActions
      ? "[c] Claim  [x] Close  [Esc] Back"
      : "[m] Kanban  [↑↓] Nav  [j/k] Scroll  [Enter] Actions  [Space] Claim  [r] Refresh  [q/Esc] Exit"
    out.push(truncateToWidth(help, width))

    return out
  }

  private renderLeftPane(width: number): string[] {
    const lines: string[] = []

    if (this.state.tasks.length === 0) {
      lines.push(" No tasks found.")
      return lines
    }

    const overlayHeight = this.getOverlayHeight()
    const footerLines = this.state.error ? 4 : 2 // global bottom bars
    const staticLines = 4 // top, header, divider, bottom
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
      lines.push(truncateToWidth(" ↑ ...", width))
    }

    for (let i = startIdx; i < endIdx; i++) {
      const task = this.state.tasks[i]!
      const icon = this.statusIcon(task.status)
      const prefix = i === this.selectedIndex ? " ❯ " : "   "
      const title = truncateToWidth(task.title, width - 4 - visibleWidth(icon))
      lines.push(truncateToWidth(`${prefix}${icon} ${title}`, width))
    }

    if (endIdx < this.state.tasks.length) {
      lines.push(truncateToWidth(" ↓ ...", width))
    }

    return lines
  }

  private renderRightPane(width: number): string[] {
    const lines: string[] = []

    if (this.state.tasks.length === 0) {
      lines.push(" Select a task to view details.")
      return lines
    }

    const task = this.state.tasks[this.selectedIndex]
    if (!task) {
      lines.push(" Select a task to view details.")
      return lines
    }

    lines.push(truncateToWidth(` ID:    ${task.id}`, width))
    lines.push(truncateToWidth(` Title: ${task.title}`, width))
    lines.push(truncateToWidth(` Type:  ${task.issue_type}`, width))
    lines.push(truncateToWidth(` Status: ${task.status} ${this.statusIcon(task.status)}`, width))
    lines.push(truncateToWidth(` Priority: P${task.priority}`, width))
    if (task.owner) {
      lines.push(truncateToWidth(` Owner: ${task.owner}`, width))
    }

    lines.push("")
    if (this.showingActions) {
      lines.push(" ─── Actions ───")
      lines.push(" [c] Claim task (set in_progress)")
      lines.push(" [x] Close task")
      lines.push(" [Esc] Back to list")
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
        const md = new Markdown(task.design, 1, 0, mdTheme)
        designLines = md.render(width)
        this.mdCache = { taskId: task.id, design: task.design, width, lines: designLines }
      }

      const staticLines = 4 /* window borders */ + lines.length + 1 /* "Design preview" */
      const indicatorReserve = designLines.length > 0 ? 2 : 0
      const maxDesignLines = Math.max(1, overlayHeight - footerLines - staticLines - indicatorReserve)

      // Clamp scroll offset to not scroll completely past the content
      const maxScroll = Math.max(0, designLines.length - maxDesignLines)
      const offset = Math.min(this.designScrollOffset, maxScroll)
      this.designScrollOffset = offset

      const preview = designLines.slice(offset, offset + maxDesignLines)
      
      lines.push(truncateToWidth(` Design preview: (lines ${offset + 1}-${Math.min(designLines.length, offset + maxDesignLines)} of ${designLines.length})`, width))
      if (offset > 0) lines.push(truncateToWidth(" ↑ ...", width))
      for (const line of preview) {
        lines.push(truncateToWidth(line, width))
      }
      if (offset + maxDesignLines < designLines.length) {
        lines.push(truncateToWidth(" ↓ ...", width))
      }
    }

    return lines
  }

  private renderKanbanView(width: number): string[] {
    const colWidth = Math.max(1, Math.floor(width / 3)) - 1 // 1 for border
    const extraWidth = width - (colWidth + 1) * 3
    const c1Width = colWidth + (extraWidth > 0 ? 1 : 0)
    const c2Width = colWidth + (extraWidth > 1 ? 1 : 0)
    const c3Width = Math.max(1, width - c1Width - c2Width - 4) // 4 borders: ╭ ┬ ┬ ╮

    const footerLines = this.state.error ? 4 : 2
    // 4 static lines for borders: top, header, divider, bottom
    const targetPaneLines = Math.max(1, this.getOverlayHeight() - footerLines - 4)

    const cols = [
      this.renderKanbanColumn(0, c1Width, targetPaneLines),
      this.renderKanbanColumn(1, c2Width, targetPaneLines),
      this.renderKanbanColumn(2, c3Width, targetPaneLines),
    ]

    const maxLines = Math.max(cols[0]!.length, cols[1]!.length, cols[2]!.length, targetPaneLines)

    const out: string[] = []

    // Top border
    out.push(`╭${"─".repeat(c1Width)}┬${"─".repeat(c2Width)}┬${"─".repeat(c3Width)}╮`)

    // Headers
    const t1 = truncateToWidth(" ⏳ Todo ", c1Width)
    const t2 = truncateToWidth(" 🔄 In Progress ", c2Width)
    const t3 = truncateToWidth(" ✅ Done ", c3Width)
    const p1 = " ".repeat(Math.max(0, c1Width - visibleWidth(t1)))
    const p2 = " ".repeat(Math.max(0, c2Width - visibleWidth(t2)))
    const p3 = " ".repeat(Math.max(0, c3Width - visibleWidth(t3)))
    
    // Highlight active column header
    const h1 = this.kanbanActiveColumn === 0 ? `\x1b[7m${t1}${p1}\x1b[27m` : `${t1}${p1}`
    const h2 = this.kanbanActiveColumn === 1 ? `\x1b[7m${t2}${p2}\x1b[27m` : `${t2}${p2}`
    const h3 = this.kanbanActiveColumn === 2 ? `\x1b[7m${t3}${p3}\x1b[27m` : `${t3}${p3}`
    out.push(`│${h1}│${h2}│${h3}│`)

    // Divider
    out.push(`├${"─".repeat(c1Width)}┼${"─".repeat(c2Width)}┼${"─".repeat(c3Width)}┤`)

    for (let i = 0; i < maxLines; i++) {
      const l1 = cols[0]![i] || ""
      const l2 = cols[1]![i] || ""
      const l3 = cols[2]![i] || ""
      const pad1 = " ".repeat(Math.max(0, c1Width - visibleWidth(l1)))
      const pad2 = " ".repeat(Math.max(0, c2Width - visibleWidth(l2)))
      const pad3 = " ".repeat(Math.max(0, c3Width - visibleWidth(l3)))
      out.push(`│${l1}${pad1}│${l2}${pad2}│${l3}${pad3}│`)
    }

    // Bottom border
    out.push(`╰${"─".repeat(c1Width)}┴${"─".repeat(c2Width)}┴${"─".repeat(c3Width)}╯`)

    // Error / Help bar at bottom
    if (this.state.error) {
      out.push("")
      out.push(truncateToWidth(`⚠️  ${this.state.error}`, width))
    }
    out.push("")
    const help = this.showingActions
      ? "[c] Claim  [x] Close  [Esc] Back"
      : "[m] List View  [←→] Cols  [↑↓] Tasks  [Enter] Details  [Space] Claim  [r] Refresh  [q/Esc] Exit"
    out.push(truncateToWidth(help, width))

    return out
  }

  private renderKanbanColumn(colIdx: 0 | 1 | 2, width: number, targetLines: number): string[] {
    const lines: string[] = []
    const tasks = this.kanbanTasks[colIdx]!

    if (tasks.length === 0) {
      lines.push(" No tasks.")
      return lines
    }

    const indicatorReserve = tasks.length > 1 ? 2 : 0
    const maxListLines = Math.max(1, targetLines - indicatorReserve)

    let startIdx = 0
    let endIdx = tasks.length
    const activeIdx = this.kanbanSelectedIndex[colIdx]

    if (tasks.length > maxListLines) {
      startIdx = Math.max(0, activeIdx - Math.floor(maxListLines / 2))
      endIdx = Math.min(tasks.length, startIdx + maxListLines)

      if (endIdx - startIdx < maxListLines) {
        startIdx = Math.max(0, endIdx - maxListLines)
      }
    }

    if (startIdx > 0) {
      lines.push(truncateToWidth(" ↑ ...", width))
    }

    for (let i = startIdx; i < endIdx; i++) {
      const task = tasks[i]!
      const isActive = this.kanbanActiveColumn === colIdx && i === activeIdx
      const prefix = isActive ? " ❯ " : "   "
      const taskStr = truncateToWidth(`${prefix}${task.id} ${task.title}`, width)
      lines.push(taskStr)
    }

    if (endIdx < tasks.length) {
      lines.push(truncateToWidth(" ↓ ...", width))
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
