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

const createShell = (output: string, exitCode = 0) => {
  return (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
    text: async () => output,
    exited: Promise.resolve(exitCode),
  })
}

test("injects_cass_block_for_task_prompt", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const payload = JSON.stringify({
      success: true,
      data: {
        relevantBullets: [
          {
            id: "b-1",
            content: "Use hooks for prompt context",
            relevanceScore: 1,
            maturity: "proven",
          },
        ],
        antiPatterns: [],
      },
    })

    const plugin = await cassMemoryPlugin({ directory: root, $: createShell(payload) })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt.startsWith("Cass Memory (rules)")).toBe(true)
    expect(output.args.prompt.includes("Original prompt")).toBe(true)
  } finally {
    await cleanup()
  }
})

test("skips_injection_on_cm_failure", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const plugin = await cassMemoryPlugin({ directory: root, $: createShell("{}", 1) })
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

test("skips_injection_on_success_false", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const payload = JSON.stringify({ success: false, error: "nope" })
    const plugin = await cassMemoryPlugin({ directory: root, $: createShell(payload) })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt).toBe("Original prompt")
    const logPath = join(root, ".opencode", "cache", "cass", "errors.log")
    const logContents = await readFile(logPath, "utf8")
    expect(logContents).toContain("nope")
  } finally {
    await cleanup()
  }
})

test("skips_injection_on_invalid_json", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const plugin = await cassMemoryPlugin({ directory: root, $: createShell("not json") })
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
