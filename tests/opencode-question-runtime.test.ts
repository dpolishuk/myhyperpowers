import { test, expect } from "bun:test"
import { createOpencodeClient, createOpencodeServer } from "../.opencode/node_modules/@opencode-ai/sdk/dist/index.js"

import {
  buildQuestionToolPrompt,
  createQuestionRequest,
  hasQuestionTool,
  listAvailableTools,
  replyToQuestionRequest,
} from "../.opencode/plugins/opencode-question-runtime.ts"

test("buildQuestionToolPrompt embeds exact question payload", () => {
  const prompt = buildQuestionToolPrompt([
    {
      header: "Test",
      question: "Pick one",
      options: [
        { label: "Yes", description: "Select yes" },
        { label: "No", description: "Select no" },
      ],
    },
  ])

  expect(prompt.includes("Use the built-in question tool now.")).toBe(true)
  expect(prompt.includes('"header": "Test"')).toBe(true)
  expect(prompt.includes('"label": "Yes"')).toBe(true)
})

test("hasQuestionTool detects availability from experimental tool list", () => {
  expect(hasQuestionTool([{ id: "bash" }, { id: "question" }])).toBe(true)
  expect(hasQuestionTool([{ id: "bash" }])).toBe(false)
})

test("createQuestionRequest rejects when question tool is unavailable", async () => {
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/experimental/tool")) {
      return new Response(JSON.stringify([{ id: "bash" }]), { status: 200 })
    }
    return new Response(null, { status: 204 })
  }

  await expect(
    createQuestionRequest(fetchImpl as typeof fetch, "http://example.test", {
      directory: "/tmp/project",
      sessionID: "ses_test",
      providerID: "openai",
      modelID: "gpt-5.4-mini",
      questions: [
        {
          header: "Test",
          question: "Pick one",
          options: [{ label: "Yes", description: "Select yes" }],
        },
      ],
      timeoutMs: 10,
      pollIntervalMs: 1,
    }),
  ).rejects.toThrow("Question tool is not available")
})

test("live helper can originate and answer a pending question request", async () => {
  if (!process.env.OPENAI_API_KEY) return

  const testDir = process.cwd()
  const { server } = await createOpencodeServer({
    hostname: "127.0.0.1",
    port: 0,
  })
  const client = createOpencodeClient({
    baseUrl: server.url,
    directory: testDir,
  })

  try {
    const session = await client.session.create({
      query: { directory: testDir },
      body: { title: "question-runtime-test" },
    })

    const tools = await listAvailableTools(fetch, server.url, {
      directory: testDir,
      providerID: "openai",
      modelID: "gpt-5.4-mini",
    })
    expect(hasQuestionTool(tools)).toBe(true)

    const request = await createQuestionRequest(fetch, server.url, {
      directory: testDir,
      sessionID: session.id,
      providerID: "openai",
      modelID: "gpt-5.4-mini",
      questions: [
        {
          header: "Runtime test",
          question: "Pick one",
          options: [
            { label: "Yes", description: "Select yes" },
            { label: "No", description: "Select no" },
          ],
          multiple: false,
        },
      ],
      timeoutMs: 45000,
      pollIntervalMs: 1000,
    })

    expect(request.sessionID).toBe(session.id)
    expect(request.questions[0].header).toBe("Runtime test")

    const replyResult = await replyToQuestionRequest(fetch, server.url, {
      directory: testDir,
      requestID: request.id,
      answers: [["Yes"]],
    })

    expect(replyResult).toBe(true)
  } finally {
    server.close()
  }
}, 60000)
