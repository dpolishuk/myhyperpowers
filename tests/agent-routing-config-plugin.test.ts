import { test, expect } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import agentRoutingConfigPlugin from "../.opencode/plugins/agent-routing-config"
import { AGENT_GROUPS, PRESET_NAMES } from "../.opencode/plugins/agent-routing-config"

const createTempRoot = async (configText?: string, hpConfigText?: string) => {
  const root = await mkdtemp(join(tmpdir(), "agent-routing-plugin-"))
  if (typeof configText === "string") {
    await writeFile(join(root, "opencode.json"), configText, "utf8")
  }
  if (typeof hpConfigText === "string") {
    await mkdir(join(root, ".opencode"), { recursive: true })
    await writeFile(join(root, ".opencode", "hyperpowers-routing.json"), hpConfigText, "utf8")
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

test("get_returns_current_global_and_workflow_routing_from_split_config", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify(
      {
        model: "global/model",
        agent: {
          "test-runner": { model: "fast/model" },
        },
      },
      null,
      2,
    ),
    JSON.stringify(
      {
        workflowOverrides: {
          "execute-ralph": {
            "autonomous-reviewer": { model: "strong/model" },
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
    expect(result.sourceOfTruth).toEqual(["opencode.json", ".opencode/hyperpowers-routing.json"])
    expect(result.routing.model).toBe("global/model")
    expect(result.routing.agent["test-runner"].model).toBe("fast/model")
    expect(result.routing.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe("strong/model")
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

test("set_updates_workflow_override_in_separate_hyperpowers_config", async () => {
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
    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    const hpPersisted = JSON.parse(
      await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"),
    )

    expect(result.ok).toBe(true)
    expect(result.updatedPath).toBe("workflowOverrides.execute-ralph.autonomous-reviewer.model")
    expect(result.updatedFile).toBe(".opencode/hyperpowers-routing.json")
    expect(ocPersisted.model).toBe("global/model")
    expect(ocPersisted.hyperpowers).toBeUndefined()
    expect(hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe("strong/model")
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

// --- New tests for agent groups, model discovery, presets ---

test("get_snapshot_includes_available_models_extracted_from_config", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      small_model: "anthropic/claude-haiku-4-5",
      agent: {
        ralph: { model: "anthropic/claude-sonnet-4-5" },
        "test-runner": { model: "anthropic/claude-haiku-4-5" },
        "code-reviewer": { model: "openai/gpt-4o" },
      },
    }),
  )

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(true)
    expect(Array.isArray(result.availableModels)).toBe(true)
    expect(result.availableModels).toContain("anthropic/claude-sonnet-4-5")
    expect(result.availableModels).toContain("anthropic/claude-haiku-4-5")
    expect(result.availableModels).toContain("openai/gpt-4o")
    // Should be deduplicated
    const unique = [...new Set(result.availableModels)]
    expect(result.availableModels.length).toBe(unique.length)
  } finally {
    await cleanup()
  }
})

test("get_snapshot_includes_models_from_provider_blocks", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify({
      model: "proxy/model-a",
      provider: {
        proxy: {
          models: {
            "model-a": { name: "Model A" },
            "model-b": { name: "Model B" },
          },
        },
      },
    }),
  )

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(true)
    expect(result.availableModels).toContain("proxy/model-a")
    expect(result.availableModels).toContain("proxy/model-b")
  } finally {
    await cleanup()
  }
})

test("get_snapshot_includes_agent_groups", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({ model: "x/y" }))

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(true)
    expect(result.agentGroups).toBeDefined()
    expect(result.agentGroups.orchestrator).toContain("ralph")
    expect(result.agentGroups.workers).toContain("test-runner")
    expect(result.agentGroups.workers).toContain("codebase-investigator")
    expect(result.agentGroups.workers).toContain("internet-researcher")
    expect(result.agentGroups.reviewers).toContain("autonomous-reviewer")
    expect(result.agentGroups.reviewers).toContain("code-reviewer")
    expect(result.agentGroups.reviewers.length).toBe(8)
  } finally {
    await cleanup()
  }
})

test("set_group_applies_model_to_all_workers", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify({
      model: "strong/model",
      agent: {
        ralph: { model: "strong/model" },
        "test-runner": { model: "old/model" },
      },
    }),
  )

  try {
    const result = await runTool(root, {
      action: "set-group",
      group: "workers",
      model: "fast/model",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.updatedAgents).toContain("test-runner")
    expect(result.updatedAgents).toContain("codebase-investigator")
    expect(result.updatedAgents).toContain("internet-researcher")
    expect(persisted.agent["test-runner"].model).toBe("fast/model")
    expect(persisted.agent["codebase-investigator"].model).toBe("fast/model")
    expect(persisted.agent["internet-researcher"].model).toBe("fast/model")
    // ralph should NOT be changed
    expect(persisted.agent.ralph.model).toBe("strong/model")
  } finally {
    await cleanup()
  }
})

test("set_group_applies_model_to_all_reviewers", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({ model: "x/y" }))

  try {
    const result = await runTool(root, {
      action: "set-group",
      group: "reviewers",
      model: "capable/model",
    })

    expect(result.ok).toBe(true)
    expect(result.updatedAgents.length).toBe(8)
    expect(result.updatedAgents).toContain("autonomous-reviewer")
    expect(result.updatedAgents).toContain("code-reviewer")
    expect(result.updatedAgents).toContain("review-quality")
  } finally {
    await cleanup()
  }
})

test("set_group_all_applies_to_every_agent", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({ model: "x/y" }))

  try {
    const result = await runTool(root, {
      action: "set-group",
      group: "all",
      model: "universal/model",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.updatedAgents.length).toBe(12)
    expect(persisted.agent.ralph.model).toBe("universal/model")
    expect(persisted.agent["test-runner"].model).toBe("universal/model")
    expect(persisted.agent["autonomous-reviewer"].model).toBe("universal/model")
  } finally {
    await cleanup()
  }
})

test("set_group_unknown_group_returns_error", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({ model: "x/y" }))

  try {
    const result = await runTool(root, {
      action: "set-group",
      group: "validators",
      model: "any/model",
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe("unsupported_group")
  } finally {
    await cleanup()
  }
})

test("apply_preset_cost_optimized", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      small_model: "anthropic/claude-haiku-4-5",
    }),
  )

  try {
    const result = await runTool(root, {
      action: "apply-preset",
      preset: "cost-optimized",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.appliedPreset).toBe("cost-optimized")
    // Workers get fast model (small_model)
    expect(persisted.agent["test-runner"].model).toBe("anthropic/claude-haiku-4-5")
    expect(persisted.agent["codebase-investigator"].model).toBe("anthropic/claude-haiku-4-5")
    // Orchestrator and reviewers get strong model
    expect(persisted.agent.ralph.model).toBe("anthropic/claude-sonnet-4-5")
    expect(persisted.agent["autonomous-reviewer"].model).toBe("anthropic/claude-sonnet-4-5")
  } finally {
    await cleanup()
  }
})

test("apply_preset_quality_first", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      small_model: "anthropic/claude-haiku-4-5",
    }),
  )

  try {
    const result = await runTool(root, {
      action: "apply-preset",
      preset: "quality-first",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    expect(result.appliedPreset).toBe("quality-first")
    // ALL agents get strong model
    expect(persisted.agent.ralph.model).toBe("anthropic/claude-sonnet-4-5")
    expect(persisted.agent["test-runner"].model).toBe("anthropic/claude-sonnet-4-5")
    expect(persisted.agent["autonomous-reviewer"].model).toBe("anthropic/claude-sonnet-4-5")
  } finally {
    await cleanup()
  }
})

test("apply_preset_without_small_model_uses_main_model_for_all", async () => {
  const { root, cleanup } = await createTempRoot(
    JSON.stringify({
      model: "glm/glm-4.7",
    }),
  )

  try {
    const result = await runTool(root, {
      action: "apply-preset",
      preset: "cost-optimized",
    })
    const persisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    expect(result.ok).toBe(true)
    // Without small_model, workers fallback to main model
    expect(persisted.agent["test-runner"].model).toBe("glm/glm-4.7")
    expect(persisted.agent.ralph.model).toBe("glm/glm-4.7")
  } finally {
    await cleanup()
  }
})

test("apply_preset_unknown_returns_error", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({ model: "x/y" }))

  try {
    const result = await runTool(root, {
      action: "apply-preset",
      preset: "ultra-turbo",
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe("unsupported_preset")
  } finally {
    await cleanup()
  }
})

test("apply_preset_without_config_returns_error", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const result = await runTool(root, {
      action: "apply-preset",
      preset: "quality-first",
    })

    expect(result.ok).toBe(false)
    expect(result.error.code).toBe("config_not_found")
  } finally {
    await cleanup()
  }
})

test("get_snapshot_includes_preset_names", async () => {
  const { root, cleanup } = await createTempRoot(JSON.stringify({ model: "x/y" }))

  try {
    const result = await runTool(root, { action: "get" })

    expect(result.ok).toBe(true)
    expect(Array.isArray(result.presets)).toBe(true)
    expect(result.presets).toContain("cost-optimized")
    expect(result.presets).toContain("quality-first")
    expect(result.presets.length).toBe(2)
  } finally {
    await cleanup()
  }
})
