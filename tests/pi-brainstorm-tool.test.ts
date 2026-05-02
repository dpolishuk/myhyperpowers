import { test, expect, mock } from "bun:test"
import initExtension from "../.pi/extensions/xpowers/index.js"

test("update_brainstorm_state is registered with optional schema parameters", () => {
  let brainstormTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_brainstorm_state") {
        brainstormTool = def
      }
    }
  }
  initExtension(piMock)
  expect(brainstormTool).toBeDefined()
  
  // Test schema by verifying it requires no parameters to be passed
  expect(brainstormTool.parameters.required).toBeUndefined() // Type.Object with optionals has no required array or it's empty
})

test("update_brainstorm_state non-TUI fallback returns valid result shape", async () => {
  let brainstormTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_brainstorm_state") brainstormTool = def
    }
  }
  initExtension(piMock)
  
  const ctx = { ui: {} } // missing ui.custom
  const result = await brainstormTool.execute("call-id", {}, undefined, undefined, ctx)
  expect(result.content[0].text).toBe("TUI not supported in this environment.")
})

test("update_brainstorm_state resolves correctly when option selected", async () => {
  let brainstormTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_brainstorm_state") brainstormTool = def
    }
  }
  initExtension(piMock)
  
  let passedComponent: any
  const ctx = {
    ui: {
      custom: (factory: any) => {
        expect(typeof factory).toBe("function")
        return new Promise((resolve) => {
          passedComponent = factory({}, {}, {}, resolve)
          // simulate selection asynchronously
          setTimeout(() => {
            passedComponent.onOptionSelect(1)
          }, 10)
        })
      }
    }
  }
  
  const params = {
    question: "Test question?",
    options: [{ label: "opt1" }, { label: "opt2" }]
  }
  const result = await brainstormTool.execute("call-id", params, undefined, undefined, ctx)
  
  expect(passedComponent).toBeDefined()
  expect(result.content[0].text).toBe("opt2")
})

test("update_ralph_state opens dashboard with Pi custom factory", async () => {
  let ralphTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_ralph_state") ralphTool = def
    }
  }
  initExtension(piMock)

  let dashboard: any
  let customCalled = false
  const ctx = {
    sessionManager: { getSessionFile: () => "ralph-factory-test" },
    ui: {
      custom: (factory: any, options: any) => {
        customCalled = true
        expect(typeof factory).toBe("function")
        expect(options).toEqual({ overlay: true, overlayOptions: { width: "96%", maxHeight: "90%", margin: 1 } })
        dashboard = factory({ terminal: { rows: 30, columns: 100 }, requestRender: () => {} }, {}, {}, () => {})
        return { close: () => {}, requestRender: () => {} }
      }
    }
  }

  const result = await ralphTool.execute("call-id", { phase: "setup", logMessage: "starting" }, undefined, undefined, ctx)

  expect(customCalled).toBe(true)
  expect(typeof dashboard.render).toBe("function")
  expect(dashboard.handleInput("q")).toBe(true)
  expect(dashboard.handleInput("a")).toBe(false)
  expect(result.content).toEqual([])
})

test("update_ralph_state can explicitly close dashboard and keep it hidden", async () => {
  let ralphTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_ralph_state") ralphTool = def
    }
  }
  initExtension(piMock)

  let closeCount = 0
  let customCount = 0
  const ctx = {
    sessionManager: { getSessionFile: () => "ralph-close-test" },
    ui: {
      custom: (factory: any) => {
        customCount++
        factory({ terminal: { rows: 30, columns: 100 }, requestRender: () => {} }, {}, {}, () => {})
        return { close: () => { closeCount++ }, requestRender: () => {} }
      }
    }
  }

  await ralphTool.execute("call-id", { phase: "setup" }, undefined, undefined, ctx)
  const result = await ralphTool.execute("call-id", { close: true }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { phase: "subagent", logMessage: "should stay hidden" }, undefined, undefined, ctx)

  expect(closeCount).toBe(1)
  expect(customCount).toBe(1)
  expect(result.content[0].text).toBe("Ralph dashboard hidden.")
})

test("update_ralph_state can reopen dashboard after explicit close", async () => {
  let ralphTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_ralph_state") ralphTool = def
    }
  }
  initExtension(piMock)

  let customCount = 0
  const ctx = {
    sessionManager: { getSessionFile: () => "ralph-reopen-test" },
    ui: {
      custom: (factory: any) => {
        customCount++
        factory({ terminal: { rows: 30, columns: 100 }, requestRender: () => {} }, {}, {}, () => {})
        return { close: () => {}, requestRender: () => {} }
      }
    }
  }

  await ralphTool.execute("call-id", { phase: "setup" }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { close: true }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { phase: "subagent" }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { reopen: true, phase: "review" }, undefined, undefined, ctx)

  expect(customCount).toBe(2)
})

test("update_ralph_state keeps state fresh while dashboard is hidden", async () => {
  let ralphTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_ralph_state") ralphTool = def
    }
  }
  initExtension(piMock)

  let customCount = 0
  let reopenedDashboard: any
  const ctx = {
    sessionManager: { getSessionFile: () => "ralph-hidden-fresh-state-test" },
    ui: {
      custom: (factory: any) => {
        customCount++
        const dashboard = factory({ terminal: { rows: 30, columns: 100 }, requestRender: () => {} }, {}, {}, () => {})
        if (customCount === 2) reopenedDashboard = dashboard
        return { close: () => {}, requestRender: () => {} }
      }
    }
  }

  await ralphTool.execute("call-id", { phase: "setup", currentTaskId: "hyper-old", currentTaskTitle: "Old task" }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { close: true }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { phase: "subagent", currentTaskId: "hyper-new", currentTaskTitle: "Fresh task", logMessage: "fresh hidden log" }, undefined, undefined, ctx)

  expect(customCount).toBe(1)

  await ralphTool.execute("call-id", { reopen: true, phase: "review" }, undefined, undefined, ctx)

  expect(customCount).toBe(2)
  const rendered = reopenedDashboard.render(100).join("\n")
  expect(rendered).toContain("Review")
  expect(rendered).toContain("hyper-new")
  expect(rendered).toContain("Fresh task")
  expect(rendered).toContain("fresh hidden log")
})

test("update_ralph_state cleans up hidden session when done", async () => {
  let ralphTool: any
  const piMock: any = {
    on: () => {},
    registerCommand: () => {},
    registerTool: (def: any) => {
      if (def.name === "update_ralph_state") ralphTool = def
    }
  }
  initExtension(piMock)

  let customCount = 0
  const ctx = {
    sessionManager: { getSessionFile: () => "ralph-hidden-done-cleanup-test" },
    ui: {
      custom: (factory: any) => {
        customCount++
        factory({ terminal: { rows: 30, columns: 100 }, requestRender: () => {} }, {}, {}, () => {})
        return { close: () => {}, requestRender: () => {} }
      }
    }
  }

  await ralphTool.execute("call-id", { phase: "setup" }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { close: true }, undefined, undefined, ctx)
  await ralphTool.execute("call-id", { phase: "done", logMessage: "completed while hidden" }, undefined, undefined, ctx)
  await new Promise(resolve => setTimeout(resolve, 2100))
  await ralphTool.execute("call-id", { phase: "setup" }, undefined, undefined, ctx)

  expect(customCount).toBe(2)
})

test("Ralph dashboard hides on cancel hotkeys", async () => {
  const { RalphDashboard } = await import("../.pi/extensions/xpowers/ralph-dashboard-tui")
  let cancelCount = 0
  const dashboard = new RalphDashboard({
    phase: "setup",
    unmetCriteria: 0,
    totalCriteria: 0,
    logs: [],
  }, () => { cancelCount++ })

  expect(dashboard.focused).toBe(true)
  dashboard.focused = false
  expect(dashboard.focused).toBe(false)
  dashboard.focused = true

  expect(dashboard.handleInput("q")).toBe(true)
  expect(dashboard.handleInput("Q")).toBe(true)
  expect(dashboard.handleInput("\x1b")).toBe(true)
  expect(dashboard.handleInput("\x03")).toBe(true)
  expect(cancelCount).toBe(4)
})
