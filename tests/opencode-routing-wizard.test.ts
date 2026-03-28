import { test, expect } from "bun:test"
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import {
  AGENT_GROUPS,
  HYPERPOWERS_AGENTS,
  discoverOpencodeModels,
  executeRoutingAction,
  parseOpencodeModelsOutput,
  planRecommendedRouting,
  verifyRecommendedRoutingPlan,
  writeRecommendedRoutingPlan,
} from "../.opencode/plugins/routing-wizard-core"
import { resolveSuggestedModels } from "../scripts/opencode-routing-wizard"

const createTempRoot = async (config?: Record<string, unknown>, hpConfig?: Record<string, unknown>) => {
  const root = await mkdtemp(join(tmpdir(), "opencode-routing-wizard-"))

  if (config) {
    await writeFile(join(root, "opencode.json"), JSON.stringify(config, null, 2), "utf8")
  }

  if (hpConfig) {
    await mkdir(join(root, ".opencode"), { recursive: true })
    await writeFile(join(root, ".opencode", "hyperpowers-routing.json"), JSON.stringify(hpConfig, null, 2), "utf8")
  }

  return {
    root,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  }
}

test("parseOpencodeModelsOutput ignores noise and deduplicates model ids", () => {
  const parsed = parseOpencodeModelsOutput(`Available models\n\nanthropic/claude-sonnet-4-5\nopenrouter/google/gemini-2.5-pro\nopenai/gpt-4o-mini\nanthropic/claude-sonnet-4-5\n- not-a-model\n`)

  expect(parsed).toEqual(["anthropic/claude-sonnet-4-5", "openai/gpt-4o-mini", "openrouter/google/gemini-2.5-pro"])
})

test("discoverOpencodeModels returns actionable error when opencode CLI is missing", async () => {
  const result = await discoverOpencodeModels(async () => {
    const error = new Error("spawn opencode ENOENT")
    ;(error as NodeJS.ErrnoException).code = "ENOENT"
    throw error
  })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error("expected missing opencode CLI failure")
  expect(result.error.code).toBe("missing_opencode_cli")
})

test("discoverOpencodeModels returns actionable error when no usable models are found", async () => {
  const result = await discoverOpencodeModels(async () => ({
    exitCode: 0,
    stdout: "Available models\n(no models)\n",
    stderr: "",
  }))

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error("expected no models failure")
  expect(result.error.code).toBe("no_models_found")
})

test("planRecommendedRouting uses safe defaults and creates execute-ralph reviewer override", () => {
  const plan = planRecommendedRouting({
    strongModel: "anthropic/claude-sonnet-4-5",
  })

  expect(plan.agent.ralph.model).toBe("anthropic/claude-sonnet-4-5")
  expect(plan.agent["test-runner"].model).toBe("anthropic/claude-sonnet-4-5")
  expect(plan.agent["code-reviewer"].model).toBe("anthropic/claude-sonnet-4-5")
  expect(plan.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe(
    "anthropic/claude-sonnet-4-5",
  )
})

test("planRecommendedRouting with no effort params leaves effort undefined", () => {
  const plan = planRecommendedRouting({
    strongModel: "anthropic/claude-sonnet-4-5",
  })

  // When effort is not specified, agents should not have an effort field
  for (const agentName of HYPERPOWERS_AGENTS) {
    expect(plan.agent[agentName].effort).toBeUndefined()
  }

  // Workflow override should also have no effort
  expect(plan.workflowOverrides["execute-ralph"]["autonomous-reviewer"].effort).toBeUndefined()
})

test("planRecommendedRouting with mixed effort applies per-group correctly", () => {
  const plan = planRecommendedRouting({
    strongModel: "anthropic/claude-sonnet-4-5",
    fastModel: "anthropic/claude-haiku-4-5",
    strongEffort: "high",
    workerEffort: "low",
    reviewerEffort: "medium",
  })

  // Orchestrator group uses strongEffort
  for (const agent of AGENT_GROUPS.orchestrator) {
    expect(plan.agent[agent].effort).toBe("high")
  }

  // Worker group uses workerEffort
  for (const agent of AGENT_GROUPS.workers) {
    expect(plan.agent[agent].effort).toBe("low")
  }

  // Reviewer group uses strongEffort, except autonomous-reviewer uses reviewerEffort
  for (const agent of AGENT_GROUPS.reviewers) {
    if (agent === "autonomous-reviewer") {
      expect(plan.agent[agent].effort).toBe("medium")
    } else {
      expect(plan.agent[agent].effort).toBe("high")
    }
  }

  // Workflow override gets reviewerEffort
  expect(plan.workflowOverrides["execute-ralph"]["autonomous-reviewer"].effort).toBe("medium")
})

test("writeRecommendedRoutingPlan writes effort to opencode.json when specified", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
      fastModel: "anthropic/claude-haiku-4-5",
      strongEffort: "high",
      workerEffort: "medium",
      reviewerEffort: "high",
    })

    await writeRecommendedRoutingPlan(root, plan)

    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    const hpPersisted = JSON.parse(await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"))

    // Agents with explicit effort should have it persisted
    expect(ocPersisted.agent.ralph.effort).toBe("high")
    expect(ocPersisted.agent["test-runner"].effort).toBe("medium")
    expect(ocPersisted.agent["codebase-investigator"].effort).toBe("medium")
    expect(ocPersisted.agent["internet-researcher"].effort).toBe("medium")
    expect(ocPersisted.agent["code-reviewer"].effort).toBe("high")
    expect(ocPersisted.agent["autonomous-reviewer"].effort).toBe("high")

    // Workflow override should have effort
    expect(hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].effort).toBe("high")
  } finally {
    await cleanup()
  }
})

test("writeRecommendedRoutingPlan with effort preserves unrelated config", async () => {
  const { root, cleanup } = await createTempRoot(
    {
      provider: { openrouter: { apiKey: "{env:OPENROUTER_API_KEY}" } },
      mcp: { context7: { type: "remote" } },
      permission: { read: "allow" },
    },
  )

  try {
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
      strongEffort: "high",
    })

    await writeRecommendedRoutingPlan(root, plan)

    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    // Unrelated config preserved
    expect(ocPersisted.provider.openrouter.apiKey).toBe("{env:OPENROUTER_API_KEY}")
    expect(ocPersisted.mcp.context7.type).toBe("remote")
    expect(ocPersisted.permission.read).toBe("allow")

    // Effort also written
    expect(ocPersisted.agent.ralph.effort).toBe("high")
  } finally {
    await cleanup()
  }
})

test("resolveSuggestedModels merges live discovery with config-derived models", async () => {
  const { root, cleanup } = await createTempRoot(
    {
      model: "anthropic/claude-sonnet-4-5",
      provider: {
        openrouter: {
          models: {
            "custom-model": { name: "Custom Model" },
          },
        },
      },
    },
    {
      workflowOverrides: {
        "execute-ralph": {
          "autonomous-reviewer": { model: "custom-provider/reviewer-only" },
        },
      },
    },
  )

  try {
    const suggested = await resolveSuggestedModels(root, ["anthropic/claude-sonnet-4-5"])

    expect(suggested).toContain("anthropic/claude-sonnet-4-5")
    expect(suggested).toContain("openrouter/custom-model")
    expect(suggested).toContain("custom-provider/reviewer-only")
  } finally {
    await cleanup()
  }
})

test("resolveSuggestedModels includes override-only models when opencode.json is absent", async () => {
  const { root, cleanup } = await createTempRoot(
    undefined,
    {
      workflowOverrides: {
        "execute-ralph": {
          "autonomous-reviewer": { model: "custom-provider/reviewer-only" },
        },
      },
    },
  )

  try {
    const suggested = await resolveSuggestedModels(root, ["anthropic/claude-sonnet-4-5"])

    expect(suggested).toContain("anthropic/claude-sonnet-4-5")
    expect(suggested).toContain("custom-provider/reviewer-only")
  } finally {
    await cleanup()
  }
})

test("writeRecommendedRoutingPlan preserves unrelated config and verifyRecommendedRoutingPlan reads back planned routing", async () => {
  const { root, cleanup } = await createTempRoot(
    {
      provider: {
        openrouter: {
          apiKey: "{env:OPENROUTER_API_KEY}",
        },
      },
      mcp: {
        context7: {
          type: "remote",
        },
      },
      permission: {
        read: "allow",
      },
    },
    {
      workflowOverrides: {
        brainstorming: {
          "code-reviewer": { model: "preserve/me" },
        },
      },
    },
  )

  try {
    const discoveredModels = [
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-haiku-4-5",
      "anthropic/claude-opus-4-5",
    ]
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
      fastModel: "anthropic/claude-haiku-4-5",
      topReviewModel: "anthropic/claude-opus-4-5",
    })

    await writeRecommendedRoutingPlan(root, plan)
    const verify = await verifyRecommendedRoutingPlan(root, plan, discoveredModels)
    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    const hpPersisted = JSON.parse(await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"))

    expect(verify.ok).toBe(true)
    expect(ocPersisted.provider.openrouter.apiKey).toBe("{env:OPENROUTER_API_KEY}")
    expect(ocPersisted.mcp.context7.type).toBe("remote")
    expect(ocPersisted.permission.read).toBe("allow")
    expect(ocPersisted.agent["test-runner"].model).toBe("anthropic/claude-haiku-4-5")
    expect(ocPersisted.agent["code-reviewer"].model).toBe("anthropic/claude-sonnet-4-5")
    expect(hpPersisted.workflowOverrides.brainstorming["code-reviewer"].model).toBe("preserve/me")
    expect(hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe(
      "anthropic/claude-opus-4-5",
    )
  } finally {
    await cleanup()
  }
})

test("verifyRecommendedRoutingPlan rejects models absent from discovered output", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
      fastModel: "anthropic/claude-haiku-4-5",
      topReviewModel: "anthropic/claude-opus-4-5",
    })

    await writeRecommendedRoutingPlan(root, plan)
    const verify = await verifyRecommendedRoutingPlan(root, plan, ["anthropic/claude-sonnet-4-5"])

    expect(verify.ok).toBe(false)
    if (verify.ok) throw new Error("expected model validation failure")
    expect(verify.error.code).toBe("invalid_selected_model")
  } finally {
    await cleanup()
  }
})

test("verifyRecommendedRoutingPlan fails when backend read-back diverges from plan", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const discoveredModels = ["anthropic/claude-sonnet-4-5"]
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
    })

    await writeRecommendedRoutingPlan(root, plan)
    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    ocPersisted.agent.ralph.model = "anthropic/claude-opus-4-5"
    await writeFile(join(root, "opencode.json"), JSON.stringify(ocPersisted, null, 2), "utf8")

    const verify = await verifyRecommendedRoutingPlan(root, plan, discoveredModels)

    expect(verify.ok).toBe(false)
    if (verify.ok) throw new Error("expected snapshot mismatch failure")
    expect(verify.error.code).toBe("snapshot_mismatch")
  } finally {
    await cleanup()
  }
})

test("verifyRecommendedRoutingPlan detects effort drift in global agents", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const discoveredModels = ["anthropic/claude-sonnet-4-5"]
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
      strongEffort: "high",
    })

    await writeRecommendedRoutingPlan(root, plan)

    // Tamper with persisted effort for ralph
    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    ocPersisted.agent.ralph.effort = "low"
    await writeFile(join(root, "opencode.json"), JSON.stringify(ocPersisted, null, 2), "utf8")

    const verify = await verifyRecommendedRoutingPlan(root, plan, discoveredModels)

    expect(verify.ok).toBe(false)
    if (verify.ok) throw new Error("expected effort drift failure")
    expect(verify.error.code).toBe("snapshot_mismatch")
    expect(verify.error.message).toContain("effort")
  } finally {
    await cleanup()
  }
})

test("verifyRecommendedRoutingPlan detects effort drift in workflow overrides", async () => {
  const { root, cleanup } = await createTempRoot()

  try {
    const discoveredModels = ["anthropic/claude-sonnet-4-5"]
    const plan = planRecommendedRouting({
      strongModel: "anthropic/claude-sonnet-4-5",
      reviewerEffort: "high",
    })

    await writeRecommendedRoutingPlan(root, plan)

    // Tamper with persisted workflow override effort
    const hpPersisted = JSON.parse(await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"))
    hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].effort = "low"
    await writeFile(join(root, ".opencode", "hyperpowers-routing.json"), JSON.stringify(hpPersisted, null, 2), "utf8")

    const verify = await verifyRecommendedRoutingPlan(root, plan, discoveredModels)

    expect(verify.ok).toBe(false)
    if (verify.ok) throw new Error("expected workflow effort drift failure")
    expect(verify.error.code).toBe("snapshot_mismatch")
    expect(verify.error.message).toContain("effort")
  } finally {
    await cleanup()
  }
})

test("CLI bootstrap script generates canonical routing files from discovered models", async () => {
  const { root, cleanup } = await createTempRoot({
    provider: {
      openrouter: {
        apiKey: "{env:OPENROUTER_API_KEY}",
      },
    },
    permission: {
      read: "allow",
    },
  })

  const binDir = join(root, "bin")
  const opencodePath = join(binDir, "opencode")
  const wizardPath = resolve(import.meta.dir, "..", "scripts", "opencode-routing-wizard.ts")

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      opencodePath,
      "#!/usr/bin/env bash\nif [ \"$1\" = \"models\" ]; then\n  printf 'Available models\\nanthropic/claude-sonnet-4-5\\nanthropic/claude-haiku-4-5\\nanthropic/claude-opus-4-5\\n'\n  exit 0\nfi\nexit 1\n",
      "utf8",
    )
    await chmod(opencodePath, 0o755)

    const result = spawnSync(
      "bun",
      [
        wizardPath,
        "--strong-model",
        "anthropic/claude-sonnet-4-5",
        "--fast-model",
        "anthropic/claude-haiku-4-5",
        "--top-review-model",
        "anthropic/claude-opus-4-5",
        "--yes",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout.includes("Routing config written and verified") || result.stdout.includes("Verification succeeded")).toBe(true)

    const snapshot = await executeRoutingAction(root, { action: "get" })
    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    const hpPersisted = JSON.parse(await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"))

    expect(snapshot.ok).toBe(true)
    if (!snapshot.ok) throw new Error("expected routing snapshot")
    expect(ocPersisted.permission.read).toBe("allow")
    expect(ocPersisted.agent["test-runner"].model).toBe("anthropic/claude-haiku-4-5")
    expect(snapshot.routing.agent["autonomous-reviewer"].model).toBe("anthropic/claude-opus-4-5")
    expect(hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe(
      "anthropic/claude-opus-4-5",
    )
  } finally {
    await cleanup()
  }
})

test("CLI accepts top-review model present only in merged suggested models", async () => {
  const { root, cleanup } = await createTempRoot(
    {
      model: "anthropic/claude-sonnet-4-5",
    },
    {
      workflowOverrides: {
        "execute-ralph": {
          "autonomous-reviewer": { model: "custom-provider/reviewer-only" },
        },
      },
    },
  )

  const binDir = join(root, "bin")
  const opencodePath = join(binDir, "opencode")
  const wizardPath = resolve(import.meta.dir, "..", "scripts", "opencode-routing-wizard.ts")

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      opencodePath,
      "#!/usr/bin/env bash\nif [ \"$1\" = \"models\" ]; then\n  printf 'Available models\\nanthropic/claude-sonnet-4-5\\n'\n  exit 0\nfi\nexit 1\n",
      "utf8",
    )
    await chmod(opencodePath, 0o755)

    const result = spawnSync(
      "bun",
      [
        wizardPath,
        "--strong-model",
        "anthropic/claude-sonnet-4-5",
        "--top-review-model",
        "custom-provider/reviewer-only",
        "--yes",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout.includes("Routing config written and verified") || result.stdout.includes("Verification succeeded")).toBe(true)
  } finally {
    await cleanup()
  }
})

test("CLI --yes bootstraps without interactive model prompts", async () => {
  const { root, cleanup } = await createTempRoot()

  const binDir = join(root, "bin")
  const opencodePath = join(binDir, "opencode")
  const wizardPath = resolve(import.meta.dir, "..", "scripts", "opencode-routing-wizard.ts")

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      opencodePath,
      "#!/usr/bin/env bash\nif [ \"$1\" = \"models\" ]; then\n  printf 'Available models\\nopencode/claude-sonnet-4-5\\nopencode/claude-haiku-4-5\\n'\n  exit 0\nfi\nexit 1\n",
      "utf8",
    )
    await chmod(opencodePath, 0o755)

    const result = spawnSync("bun", [wizardPath, "--yes"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout.includes("Select strong model")).toBe(false)

    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    expect(ocPersisted.model).toBe("opencode/claude-haiku-4-5")
  } finally {
    await cleanup()
  }
})

test("CLI --yes with effort flags writes effort to config", async () => {
  const { root, cleanup } = await createTempRoot()

  const binDir = join(root, "bin")
  const opencodePath = join(binDir, "opencode")
  const wizardPath = resolve(import.meta.dir, "..", "scripts", "opencode-routing-wizard.ts")

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      opencodePath,
      "#!/usr/bin/env bash\nif [ \"$1\" = \"models\" ]; then\n  printf 'Available models\\nanthropic/claude-sonnet-4-5\\nanthropic/claude-haiku-4-5\\n'\n  exit 0\nfi\nexit 1\n",
      "utf8",
    )
    await chmod(opencodePath, 0o755)

    const result = spawnSync(
      "bun",
      [
        wizardPath,
        "--strong-model", "anthropic/claude-sonnet-4-5",
        "--fast-model", "anthropic/claude-haiku-4-5",
        "--strong-effort", "high",
        "--fast-effort", "medium",
        "--top-review-effort", "low",
        "--yes",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    )

    expect(result.status).toBe(0)

    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    const hpPersisted = JSON.parse(await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"))

    // Orchestrator gets strongEffort
    expect(ocPersisted.agent.ralph.effort).toBe("high")

    // Workers get fastEffort
    expect(ocPersisted.agent["test-runner"].effort).toBe("medium")
    expect(ocPersisted.agent["codebase-investigator"].effort).toBe("medium")

    // Reviewers get strongEffort, autonomous-reviewer gets topReviewEffort
    expect(ocPersisted.agent["code-reviewer"].effort).toBe("high")
    expect(ocPersisted.agent["autonomous-reviewer"].effort).toBe("low")

    // Workflow override gets topReviewEffort
    expect(hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].effort).toBe("low")
  } finally {
    await cleanup()
  }
})

test("CLI --yes without effort flags leaves effort undefined", async () => {
  const { root, cleanup } = await createTempRoot()

  const binDir = join(root, "bin")
  const opencodePath = join(binDir, "opencode")
  const wizardPath = resolve(import.meta.dir, "..", "scripts", "opencode-routing-wizard.ts")

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      opencodePath,
      "#!/usr/bin/env bash\nif [ \"$1\" = \"models\" ]; then\n  printf 'Available models\\nanthropic/claude-sonnet-4-5\\n'\n  exit 0\nfi\nexit 1\n",
      "utf8",
    )
    await chmod(opencodePath, 0o755)

    const result = spawnSync(
      "bun",
      [
        wizardPath,
        "--strong-model", "anthropic/claude-sonnet-4-5",
        "--yes",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    )

    expect(result.status).toBe(0)

    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))

    // Without explicit effort flags, effort should not be set
    expect(ocPersisted.agent.ralph.effort).toBeUndefined()
    expect(ocPersisted.agent["test-runner"].effort).toBeUndefined()
    expect(ocPersisted.agent["code-reviewer"].effort).toBeUndefined()
    expect(ocPersisted.agent["autonomous-reviewer"].effort).toBeUndefined()
  } finally {
    await cleanup()
  }
})

test.skip("CLI interactive flow writes config after explicit confirmation (skipped: clack prompts require TTY)", async () => {
  const { root, cleanup } = await createTempRoot()

  const binDir = join(root, "bin")
  const opencodePath = join(binDir, "opencode")
  const wizardPath = resolve(import.meta.dir, "..", "scripts", "opencode-routing-wizard.ts")

  try {
    await mkdir(binDir, { recursive: true })
    await writeFile(
      opencodePath,
      "#!/usr/bin/env bash\nif [ \"$1\" = \"models\" ]; then\n  printf 'Available models\\nanthropic/claude-sonnet-4-5\\nanthropic/claude-haiku-4-5\\nanthropic/claude-opus-4-5\\n'\n  exit 0\nfi\nexit 1\n",
      "utf8",
    )
    await chmod(opencodePath, 0o755)

    const result = spawnSync(
      "bun",
      [
        wizardPath,
        "--strong-model",
        "anthropic/claude-sonnet-4-5",
        "--fast-model",
        "anthropic/claude-haiku-4-5",
        "--top-review-model",
        "anthropic/claude-opus-4-5",
      ],
      {
        cwd: root,
        encoding: "utf8",
        input: "y\n",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      },
    )

    expect(result.status).toBe(0)
    expect(result.stdout.includes("Write this routing config now? [y/N]")).toBe(true)
    expect(result.stdout.includes("Verified routing state:")).toBe(true)

    const ocPersisted = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"))
    const hpPersisted = JSON.parse(await readFile(join(root, ".opencode", "hyperpowers-routing.json"), "utf8"))

    expect(ocPersisted.agent["test-runner"].model).toBe("anthropic/claude-haiku-4-5")
    expect(hpPersisted.workflowOverrides["execute-ralph"]["autonomous-reviewer"].model).toBe(
      "anthropic/claude-opus-4-5",
    )
  } finally {
    await cleanup()
  }
})
