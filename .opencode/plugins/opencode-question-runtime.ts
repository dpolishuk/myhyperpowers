export type RuntimeQuestionOption = {
  label: string
  description: string
}

export type RuntimeQuestionInfo = {
  header: string
  question: string
  options: RuntimeQuestionOption[]
  multiple?: boolean
  custom?: boolean
}

export type RuntimeQuestionRequest = {
  id: string
  sessionID: string
  questions: RuntimeQuestionInfo[]
  tool?: {
    messageID: string
    callID: string
  }
}

type ToolListItem = {
  id: string
  description?: string
  parameters?: unknown
}

type FetchLike = typeof fetch

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const requestJson = async (fetchImpl: FetchLike, url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }
  const response = await fetchImpl(url, {
    ...init,
    headers,
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`)
  }

  return json
}

export const buildQuestionToolPrompt = (questions: RuntimeQuestionInfo[]) => {
  const payload = JSON.stringify({ questions }, null, 2)
  return [
    "Use the built-in question tool now.",
    "Ask exactly the following question payload and do not answer it yourself.",
    "Do not use any other tools and do not add or remove options.",
    payload,
  ].join("\n\n")
}

export const listAvailableTools = async (
  fetchImpl: FetchLike,
  serverUrl: string,
  params: { directory: string; providerID: string; modelID: string },
): Promise<ToolListItem[]> => {
  const url = new URL("/experimental/tool", serverUrl)
  url.searchParams.set("directory", params.directory)
  url.searchParams.set("provider", params.providerID)
  url.searchParams.set("model", params.modelID)
  return (await requestJson(fetchImpl, url.toString())) ?? []
}

export const hasQuestionTool = (tools: ToolListItem[]) => tools.some((tool) => tool.id === "question")

export const listPendingQuestions = async (
  fetchImpl: FetchLike,
  serverUrl: string,
  params: { directory: string },
): Promise<RuntimeQuestionRequest[]> => {
  const url = new URL("/question", serverUrl)
  url.searchParams.set("directory", params.directory)
  return (await requestJson(fetchImpl, url.toString())) ?? []
}

export const promptQuestionTool = async (
  fetchImpl: FetchLike,
  serverUrl: string,
  params: {
    directory: string
    sessionID: string
    providerID: string
    modelID: string
    questions: RuntimeQuestionInfo[]
  },
) => {
  const url = new URL(`/session/${params.sessionID}/prompt_async`, serverUrl)
  url.searchParams.set("directory", params.directory)
  await requestJson(fetchImpl, url.toString(), {
    method: "POST",
    body: JSON.stringify({
      model: {
        providerID: params.providerID,
        modelID: params.modelID,
      },
      tools: {
        question: true,
      },
      parts: [
        {
          type: "text",
          text: buildQuestionToolPrompt(params.questions),
        },
      ],
    }),
  })
}

export const createQuestionRequest = async (
  fetchImpl: FetchLike,
  serverUrl: string,
  params: {
    directory: string
    sessionID: string
    providerID: string
    modelID: string
    questions: RuntimeQuestionInfo[]
    timeoutMs?: number
    pollIntervalMs?: number
  },
) => {
  const tools = await listAvailableTools(fetchImpl, serverUrl, {
    directory: params.directory,
    providerID: params.providerID,
    modelID: params.modelID,
  })

  if (!hasQuestionTool(tools)) {
    throw new Error(`Question tool is not available for ${params.providerID}/${params.modelID}`)
  }

  await promptQuestionTool(fetchImpl, serverUrl, params)

  const deadline = Date.now() + (params.timeoutMs ?? 30000)
  const pollIntervalMs = params.pollIntervalMs ?? 1000

  while (Date.now() < deadline) {
    const pending = await listPendingQuestions(fetchImpl, serverUrl, {
      directory: params.directory,
    })
    const match = pending.find(
      (question) =>
        question.sessionID === params.sessionID &&
        Array.isArray(question.questions) &&
        question.questions.length === params.questions.length,
    )
    if (match) return match
    await sleep(pollIntervalMs)
  }

  throw new Error(`Timed out waiting for a question request for session ${params.sessionID}`)
}

export const replyToQuestionRequest = async (
  fetchImpl: FetchLike,
  serverUrl: string,
  params: {
    directory: string
    requestID: string
    answers: string[][]
  },
) => {
  const url = new URL(`/question/${params.requestID}/reply`, serverUrl)
  url.searchParams.set("directory", params.directory)
  return requestJson(fetchImpl, url.toString(), {
    method: "POST",
    body: JSON.stringify({ answers: params.answers }),
  })
}
