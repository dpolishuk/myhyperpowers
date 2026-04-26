import { test, expect, mock } from "bun:test"
import initExtension from "../.pi/extensions/hyperpowers/index.js"

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
      custom: (component: any) => {
        passedComponent = component
        // simulate selection asynchronously
        setTimeout(() => {
          passedComponent.onOptionSelect(1)
        }, 10)
        return { close: () => {} }
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
