import { test, expect, mock } from "bun:test"
import { registerHooksPipeline } from "../.pi/extensions/hyperpowers/hooks-pipeline"

test("hooks pipeline registers session_start event", () => {
  const piMock: any = {
    on: mock((event: string, handler: Function) => {}),
  }
  registerHooksPipeline(piMock)
  const calls = piMock.on.mock.calls
  const registeredEvents = calls.map((args: any) => args[0])
  expect(registeredEvents).toContain("session_start")
  expect(registeredEvents).toContain("input")
  expect(registeredEvents).toContain("tool_call")
  expect(registeredEvents).toContain("tool_result")
  expect(registeredEvents).toContain("session_shutdown")
})
