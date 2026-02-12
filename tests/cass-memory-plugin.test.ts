import { test, expect } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import cassMemoryPlugin from "../.opencode/plugins/cass-memory"

const createTempRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "cass-plugin-"))
  const opencodeDir = join(root, ".opencode")
  await mkdir(opencodeDir, { recursive: true })
  await writeFile(
    join(opencodeDir, "cass-memory.json"),
    JSON.stringify({ enabled: true, timeoutMs: 500, logLevel: "warn" }, null, 2),
    "utf8"
  )
  return {
    root,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  }
}

type ShellResponse = {
  output: string
  exitCode?: number
}

const createShell = (responses: { serena?: ShellResponse; supermemory?: ShellResponse } = {}) => {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const command = strings.reduce(
      (acc, part, index) => `${acc}${part}${index < values.length ? String(values[index]) : ""}`,
      "",
    )
    const selected = command.includes("serena-memory") ? responses.serena : responses.supermemory

    return {
      text: async () => selected?.output ?? "{\"entries\":[]}",
      exited: Promise.resolve(selected?.exitCode ?? 0),
    }
  }
}

test("injects_cass_block_for_task_prompt", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const payload = JSON.stringify({
      entries: [
        {
          id: "s-1",
          content: "Use hooks for prompt context",
          score: 1,
        },
      ],
    })

    const plugin = await cassMemoryPlugin({
      directory: root,
      $: createShell({
        serena: { output: payload, exitCode: 0 },
        supermemory: { output: "{\"entries\":[]}", exitCode: 0 },
      }),
    })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt.startsWith("Cass Memory (rules)")).toBe(true)
    expect(output.args.prompt.includes("Original prompt")).toBe(true)
    expect(output.args.prompt.includes("s-1")).toBe(true)
  } finally {
    await cleanup()
  }
})

test("skips_injection_on_context_fetch_failure", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const plugin = await cassMemoryPlugin({
      directory: root,
      $: createShell({
        serena: { output: "", exitCode: 1 },
        supermemory: { output: "", exitCode: 1 },
      }),
    })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt).toBe("Original prompt")
    const logPath = join(root, ".opencode", "cache", "cass", "errors.log")
    const logContents = await readFile(logPath, "utf8")
    expect(logContents.length).toBeGreaterThan(0)
  } finally {
    await cleanup()
  }
})

test("skips_injection_when_sources_return_no_entries", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const payload = JSON.stringify({ entries: [] })
    const plugin = await cassMemoryPlugin({
      directory: root,
      $: createShell({
        serena: { output: payload, exitCode: 0 },
        supermemory: { output: payload, exitCode: 0 },
      }),
    })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt).toBe("Original prompt")
  } finally {
    await cleanup()
  }
})

test("skips_injection_on_invalid_json", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const plugin = await cassMemoryPlugin({
      directory: root,
      $: createShell({
        serena: { output: "not json", exitCode: 0 },
        supermemory: { output: "{\"entries\":[]}", exitCode: 0 },
      }),
    })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt).toBe("Original prompt")
    const logPath = join(root, ".opencode", "cache", "cass", "errors.log")
    const logContents = await readFile(logPath, "utf8")
    expect(logContents.length).toBeGreaterThan(0)
  } finally {
    await cleanup()
  }
})
