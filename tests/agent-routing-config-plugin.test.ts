import { test, expect } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import agentRoutingConfigPlugin from "../.opencode/plugins/agent-routing-config"

const createTempRoot = async (configText?: string) => {
  const root = await mkdtemp(join(tmpdir(), "agent-routing-plugin-"))
  if (typeof configText === "string") {
    await writeFile(join(root, "opencode.json"), configText, "utf8")
  }

  return {
    root,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  }
}

const runTool = async (root: string, args: Record<string, unknown>) => {
  const plugin = await agentRoutingConfigPlugin({ directory: root })
  const tool = plugin.tool.hyperpowers_agent_routing_config
  const result = await tool.execute(args, { directory: root, worktree: root })
  return JSON.parse(String(result))
}

test("get_returns_current_global_and_workflow_routing_from_opencode_json", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify(
      {
        model: "global/model",
        agent: {
          "test-runner": { model: "fast/model" },
        },
        hyperpowers: {
          workflowOverrides: {
            "execute-ralph": {
              "autonomous-reviewer": { model: "strong/model" },
            },
          },
        },
      },
      null,
      2,
    ),
  )

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(true)
    expect(result.sourceOfTruth).toBe("opencode.json")
    expect(result.routing.model).toBe("global/model")
    expect(result.routing.agent["test-runner"].model).toBe("fast/model")
    expect(result.routing.hyperpowers.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe(
      "strong/model",
    )
  } finally {
    await cleanup()
  }
})

test("set_updates_global_agent_mapping_and_preserves_unrelated_config", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify(
      {
        mcp: {
          linear: { type: "local", command: ["npx", "linear"] },
        },
        permission: {
          read: "allow",
        },
        agent: {
          ralph: {
            comment: "keep-me",
          },
        },
      },
      null,
      2,
    ),
  )

  try {
    const result = await runTool(root, {
      action: "set",
      agent: "test-runner",
      model: "fast/model",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.updatedPath).toBe("agent.test-runner.model")
    expect(persisted.permission.read).toBe("allow")
    expect(persisted.mcp.linear.type).toBe("local")
    expect(persisted.agent.ralph.comment).toBe("keep-me")
    expect(persisted.agent["test-runner"].model).toBe("fast/model")
  } finally {
    await cleanup()
  }
})

test("set_updates_workflow_override_and_creates_missing_blocks", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify(
      {
        model: "global/model",
      },
      null,
      2,
    ),
  )

  try {
    const result = await runTool(root, {
      action: "set",
      workflow: "execute-ralph",
      agent: "autonomous-reviewer",
      model: "strong/model",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.updatedPath).toBe("hyperpowers.workflowOverrides.execute-ralph.autonomous-reviewer.model")
    expect(persisted.model).toBe("global/model")
    expect(persisted.hyperpowers.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe(
      "strong/model",
    )
  } finally {
    await cleanup()
  }
})

test("get_returns_explicit_error_when_opencode_json_is_missing", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe("config_not_found")
  } finally {
    await cleanup()
  }
})

test("set_bootstraps_missing_opencode_json_with_canonical_map", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const result = await runTool(root, {
      action: "set",
      agent: "review-testing",
      model: "capable/model",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.createdConfig).toBe(true)
    expect(persisted.$schema).toBe("https://opencode.ai/config.json")
    expect(persisted.agent["review-testing"].model).toBe("capable/model")
  } finally {
    await cleanup()
  }
})

test("malformed_json_returns_explicit_error_result", async () => {
  const { root, cleanup } = await createTempRoot("{")

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe("invalid_json")
  } finally {
    await cleanup()
  }
})

test("unsupported_agent_and_workflow_return_actionable_errors", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({}, null, 2))

  try {
    const agentResult = await runTool(root, {
      action: "set",
      agent: "validator",
      model: "bad/model",
    })
    const workflowResult = await runTool(root, {
      action: "set",
      workflow: "validator-flow",
      agent: "test-runner",
      model: "bad/model",
    })

    expect(agentResult.ok).toBe(false)
    expect(agentResult.error.code).toBe("unsupported_agent")
    expect(workflowResult.ok).toBe(false)
    expect(workflowResult.error.code).toBe("unsupported_workflow")
  } finally {
    await cleanup()
  }
})
