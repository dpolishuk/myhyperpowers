import { test, expect } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import taskContextOrchestratorPlugin from "../.opencode/plugins/task-context-orchestrator"

const createTempRoot = async (overrides: Record<string, unknown> = {}) => {
  const root = await mkdtemp(join(tmpdir(), "task-context-plugin-"))
  const opencodeDir = join(root, ".opencode")
  await mkdir(opencodeDir, { recursive: true })
  await writeFile(
    join(opencodeDir, "task-context.json"),
    JSON.stringify(
      {
        enabled: true,
        timeoutMs: 500,
        retries: 0,
        maxItems: 6,
        maxChars: 600,
        logLevel: "warn",
        ...overrides,
      },
      null,
      2,
    ),
    "utf8",
  )

  return {
    root,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  }
}

type ShellResponse = {
  text: string
  code?: number
}

type ShellSetup = {
  serena?: ShellResponse
  supermemory?: ShellResponse
  serenaSummary?: ShellResponse
  supermemorySummary?: ShellResponse
  serenaSave?: ShellResponse
  supermemorySave?: ShellResponse
}

type TempRootOptions = {
  taskContextOverrides?: Record<string, unknown>
  opencodeConfig?: Record<string, unknown>
  agentFiles?: Record<string, string>
}

const createShell = (responses: ShellSetup = {}) => {
  const savedCalls: string[] = []
  const shell = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const command = strings.reduce(
      (acc, part, index) => `${acc}${part}${index < values.length ? String(values[index]) : ""}`,
      "",
    )

    let selected: ShellResponse | undefined
    if (command.includes("serena-memory") && command.includes("summaries")) selected = responses.serenaSummary
    else if (command.includes("supermemory-memory") && command.includes("summaries")) {
      selected = responses.supermemorySummary
    } else if (command.includes("serena-memory") && command.includes("save")) {
      selected = responses.serenaSave
      savedCalls.push(command)
    } else if (command.includes("supermemory-memory") && command.includes("save")) {
      selected = responses.supermemorySave
      savedCalls.push(command)
    } else if (command.includes("serena-memory")) selected = responses.serena
    else if (command.includes("supermemory-memory")) selected = responses.supermemory

    return {
      text: async () => selected?.text ?? "{}",
      exited: Promise.resolve(selected?.code ?? 0),
    }
  }

  return { shell, savedCalls }
}

const createTempRootWithConfig = async ({
  taskContextOverrides = {},
  opencodeConfig,
  agentFiles = {},
}: TempRootOptions = {}) => {
  const base = await createTempRoot(taskContextOverrides)

  if (opencodeConfig) {
    await writeFile(join(base.root, "opencode.json"), JSON.stringify(opencodeConfig, null, 2), "utf8")
  }

  const agentEntries = Object.entries(agentFiles)
  if (agentEntries.length > 0) {
    const agentsDir = join(base.root, ".opencode", "agents")
    await mkdir(agentsDir, { recursive: true })
    for (const [name, contents] of agentEntries) {
      await writeFile(join(agentsDir, `${name}.md`), contents, "utf8")
    }
  }

  return base
}

test("task_only_interception", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const mock = createShell({})
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })
    const output = { args: { prompt: "Leave untouched" } }

    await plugin["tool.execute.before"]({ tool: "bash" }, output)

    expect(output.args.prompt).toBe("Leave untouched")
  } finally {
    await cleanup()
  }
})

test("serena_precedence_on_overlap", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const serenaPayload = JSON.stringify({
      entries: [{ id: "overlap", content: "serena-decision", score: 0.7, tag: "decision" }],
    })
    const superPayload = JSON.stringify({
      entries: [{ id: "overlap", content: "supermemory-decision", score: 0.9, tag: "decision" }],
    })

    const mock = createShell({
      serena: { text: serenaPayload, code: 0 },
      supermemory: { text: superPayload, code: 0 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })
    const output = { args: { prompt: "Implement task" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt.includes("Task Context Pack")).toBe(true)
    expect(output.args.prompt.includes("serena-decision")).toBe(true)
    expect(output.args.prompt.includes("supermemory-decision")).toBe(false)
  } finally {
    await cleanup()
  }
})

test("deterministic_dedupe_and_order", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const serenaPayload = JSON.stringify({
      entries: [
        { id: "b", content: "second", score: 0.4, tag: "decision" },
        { id: "a", content: "first", score: 0.8, tag: "constraint" },
      ],
    })
    const superPayload = JSON.stringify({
      entries: [
        { id: "dup", content: "remove-me", score: 1, tag: "outcome" },
        { id: "dup", content: "remove-me", score: 1, tag: "outcome" },
      ],
    })

    const mock = createShell({
      serena: { text: serenaPayload, code: 0 },
      supermemory: { text: superPayload, code: 0 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })
    const outputOne = { args: { prompt: "Task A" } }
    const outputTwo = { args: { prompt: "Task A" } }

    await plugin["tool.execute.before"]({ tool: "task" }, outputOne)
    await plugin["tool.execute.before"]({ tool: "task" }, outputTwo)

    expect(outputOne.args.prompt).toBe(outputTwo.args.prompt)
  } finally {
    await cleanup()
  }
})

test("payload_budget_truncation_marker", async () => {
  const { root, cleanup } = await createTempRoot({ maxChars: 140 })
  try {
    const serenaPayload = JSON.stringify({
      entries: [{ id: "long", content: "x".repeat(500), score: 1, tag: "decision" }],
    })

    const mock = createShell({
      serena: { text: serenaPayload, code: 0 },
      supermemory: { text: "{\"entries\":[]}", code: 0 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })
    const output = { args: { prompt: "Prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    const contextBlock = String(output.args.prompt).split("\n\n")[0]
    expect(contextBlock.endsWith("(truncated)")).toBe(true)
    expect(contextBlock.length).toBeLessThanOrEqual(140)
  } finally {
    await cleanup()
  }
})

test("fetch_failure_does_not_block_task", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const mock = createShell({
      serena: { text: "error", code: 1 },
      supermemory: { text: "error", code: 1 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })
    const output = { args: { prompt: "Original prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.prompt).toBe("Original prompt")
    const logPath = join(root, ".opencode", "cache", "task-context", "errors.log")
    const logContents = await readFile(logPath, "utf8")
    expect(logContents.length).toBeGreaterThan(0)
  } finally {
    await cleanup()
  }
})

test("after_hook_writes_json_and_narrative", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const mock = createShell({
      serenaSave: { text: "ok", code: 0 },
      supermemorySave: { text: "ok", code: 0 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })

    const output = {
      args: { prompt: "Task prompt" },
      result: { status: "ok", message: "done" },
    }

    await plugin["tool.execute.after"]?.({ tool: "task" }, output)

    expect(mock.savedCalls.some((command) => command.includes("serena-memory") && command.includes("save"))).toBe(
      true,
    )
    expect(
      mock.savedCalls.some((command) => command.includes("supermemory-memory") && command.includes("save")),
    ).toBe(true)
  } finally {
    await cleanup()
  }
})

test("one_backend_write_failure_does_not_block_task", async () => {
  const { root, cleanup } = await createTempRoot()
  try {
    const mock = createShell({
      serenaSave: { text: "failed", code: 1 },
      supermemorySave: { text: "ok", code: 0 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })

    const output = {
      args: { prompt: "Task prompt" },
      result: { status: "ok", message: "done" },
    }

    await plugin["tool.execute.after"]?.({ tool: "task" }, output)

    const logPath = join(root, ".opencode", "cache", "task-context", "errors.log")
    const logContents = await readFile(logPath, "utf8")
    expect(logContents.includes("serena")).toBe(true)
  } finally {
    await cleanup()
  }
})

test("next_task_prefers_recent_persisted_summaries_within_budget", async () => {
  const { root, cleanup } = await createTempRoot({ maxChars: 250 })
  try {
    const serenaPayload = JSON.stringify({ entries: [{ id: "base", content: "base-context", score: 0.1 }] })
    const summaryPayload = JSON.stringify({
      entries: [{ id: "summary", content: "recent-summary", score: 10, timestamp: new Date().toISOString() }],
    })
    const mock = createShell({
      serena: { text: serenaPayload, code: 0 },
      supermemory: { text: "{\"entries\":[]}", code: 0 },
      serenaSummary: { text: summaryPayload, code: 0 },
      supermemorySummary: { text: "{\"entries\":[]}", code: 0 },
    })

    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })
    const output = { args: { prompt: "Prompt" } }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(String(output.args.prompt).includes("recent-summary")).toBe(true)
    const contextBlock = String(output.args.prompt).split("\n\n")[0]
    expect(contextBlock.length).toBeLessThanOrEqual(250)
  } finally {
    await cleanup()
  }
})

test("idempotency_key_prevents_duplicate_summary_entries", async () => {
  const { root, cleanup } = await createTempRoot({ maxSummaryCount: 10, maxSummaryAgeHours: 72 })
  try {
    const mock = createShell({
      serenaSave: { text: "ok", code: 0 },
      supermemorySave: { text: "ok", code: 0 },
    })
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: mock.shell,
    })

    const output = {
      args: {
        prompt: "Task prompt",
        __taskContextRunId: "run-1",
        __taskContextFingerprint: "fp-1",
      },
      result: { status: "ok", message: "done" },
    }

    await plugin["tool.execute.after"]?.({ tool: "task" }, output)
    await plugin["tool.execute.after"]?.({ tool: "task" }, output)

    const summariesPath = join(root, ".opencode", "cache", "task-context", "summaries.json")
    const summaries = JSON.parse(await readFile(summariesPath, "utf8")) as Array<Record<string, unknown>>
    expect(summaries.length).toBe(1)
  } finally {
    await cleanup()
  }
})

test("task_model_routing_prefers_workflow_override", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    opencodeConfig: {
      model: "global/model",
      agent: {
        "autonomous-reviewer": {
          model: "agent/model",
        },
      },
      hyperpowers: {
        workflowOverrides: {
          "execute-ralph": {
            "autonomous-reviewer": {
              model: "workflow/model",
            },
          },
        },
      },
    },
    agentFiles: {
      "autonomous-reviewer": `---\ndescription: reviewer\nmode: subagent\nmodel: frontmatter/model\n---\nPrompt`,
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run execute-ralph final validation",
        agent: "autonomous-reviewer",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("workflow/model")
  } finally {
    await cleanup()
  }
})

test("task_model_routing_prefers_explicit_workflow_argument_over_prompt_detection", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    opencodeConfig: {
      model: "global/model",
      hyperpowers: {
        workflowOverrides: {
          brainstorming: {
            "internet-researcher": {
              model: "brainstorm/model",
            },
          },
          "execute-ralph": {
            "internet-researcher": {
              model: "ralph/model",
            },
          },
        },
      },
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run execute-ralph research prep",
        workflow: "brainstorming",
        agent: "internet-researcher",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("brainstorm/model")
  } finally {
    await cleanup()
  }
})

test("task_model_routing_normalizes_prefixed_workflow_names", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    opencodeConfig: {
      hyperpowers: {
        workflowOverrides: {
          "execute-ralph": {
            "autonomous-reviewer": {
              model: "workflow/model",
            },
          },
        },
      },
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run final validation",
        workflow: "hyperpowers:execute-ralph",
        agent: "autonomous-reviewer",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("workflow/model")
  } finally {
    await cleanup()
  }
})

test("task_model_routing_uses_agent_mapping_before_global_model", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    opencodeConfig: {
      model: "global/model",
      agent: {
        "test-runner": {
          model: "agent/model",
        },
      },
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run targeted verification",
        agent: "test-runner",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("agent/model")
  } finally {
    await cleanup()
  }
})

test("task_model_routing_normalizes_prefixed_subagent_type_names", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    opencodeConfig: {
      model: "global/model",
      agent: {
        "test-runner": {
          model: "agent/model",
        },
      },
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run targeted verification",
        subagent_type: "hyperpowers:test-runner",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("agent/model")
  } finally {
    await cleanup()
  }
})

test("task_model_routing_preserves_native_inheritance_when_only_top_level_model_exists", async () => {
  const withGlobal = await createTempRootWithConfig({
    opencodeConfig: {
      model: "global/model",
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: withGlobal.root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Review these tests",
        agent: "review-testing",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBeUndefined()
  } finally {
    await withGlobal.cleanup()
  }
})

test("task_model_routing_falls_back_to_frontmatter_when_available", async () => {
  const frontmatterOnly = await createTempRootWithConfig({
    agentFiles: {
      "review-documentation": `---\ndescription: reviewer\nmode: subagent\nmodel: frontmatter/model\n---\nPrompt`,
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: frontmatterOnly.root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Review docs",
        agent: "review-documentation",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("frontmatter/model")
  } finally {
    await frontmatterOnly.cleanup()
  }
})

test("task_model_routing_reads_frontmatter_with_crlf_line_endings", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    agentFiles: {
      "review-quality": "---\r\ndescription: reviewer\r\nmode: subagent\r\nmodel: crlf/model\r\n---\r\nPrompt\r\n",
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Review code quality",
        agent: "review-quality",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("crlf/model")
  } finally {
    await cleanup()
  }
})

test("task_model_routing_logs_malformed_opencode_config_warnings", async () => {
  const { root, cleanup } = await createTempRoot()
  await writeFile(join(root, "opencode.json"), "{", "utf8")

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run targeted verification",
        agent: "test-runner",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    const errorLog = await readFile(join(root, ".opencode", "cache", "task-context", "errors.log"), "utf8")
    expect(errorLog.includes("loadOpenCodeRoutingConfig")).toBe(true)
    expect(errorLog.includes("opencode.json")).toBe(true)
  } finally {
    await cleanup()
  }
})

test("task_model_routing_preserves_explicit_model_argument", async () => {
  const { root, cleanup } = await createTempRootWithConfig({
    opencodeConfig: {
      model: "global/model",
      agent: {
        "autonomous-reviewer": {
          model: "agent/model",
        },
      },
      hyperpowers: {
        workflowOverrides: {
          "execute-ralph": {
            "autonomous-reviewer": {
              model: "workflow/model",
            },
          },
        },
      },
    },
  })

  try {
    const plugin = await taskContextOrchestratorPlugin({
      directory: root,
      $: createShell({}).shell,
    })
    const output = {
      args: {
        prompt: "Run execute-ralph final validation",
        agent: "autonomous-reviewer",
        model: "explicit/model",
      },
    }

    await plugin["tool.execute.before"]({ tool: "task" }, output)

    expect(output.args.model).toBe("explicit/model")
  } finally {
    await cleanup()
  }
})
