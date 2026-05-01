import { test, expect, mock } from "bun:test"
import { registerTmTools } from "../.pi/extensions/xpowers/tm-tools"

test("tm-tools registers expected task manager tools", () => {
  const piMock: any = {
    registerTool: mock((def: any) => {}),
  }
  registerTmTools(piMock)
  const calls = piMock.registerTool.mock.calls
  const registeredTools = calls.map((args: any) => args[0].name)
  expect(registeredTools).toContain("tm_ready")
  expect(registeredTools).toContain("tm_show")
  expect(registeredTools).toContain("tm_create")
  expect(registeredTools).toContain("tm_update")
  expect(registeredTools).toContain("tm_close")
  expect(registeredTools).toContain("tm_sync")
})
