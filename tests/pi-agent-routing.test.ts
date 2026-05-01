import { test, expect } from "bun:test"

import {
  DEFAULT_ROUTING_COMMENT,
  XPOWERS_AGENTS,
  normalizeRoutingConfig,
  resetAllAgentOverrides,
  resolveRoutingEntry,
  serializeRoutingConfig,
  withAgentModel,
  withSubagentModel,
  withoutAgentOverride,
  type RoutingConfig,
} from "../.pi/extensions/xpowers/routing"

test("normalizeRoutingConfig preserves legacy subagent-only configs and adds defaults", () => {
  const config = normalizeRoutingConfig({
    subagents: {
      review: { model: "anthropic/claude-sonnet-4-5" },
    },
  })

  expect(config.subagents.review.model).toBe("anthropic/claude-sonnet-4-5")
  expect(config.subagents.default.model).toBe("inherit")
  expect(config.agents).toEqual({})
})

test("normalizeRoutingConfig falls back safely for malformed input", () => {
  const config = normalizeRoutingConfig("not-an-object")

  expect(config.subagents.default.model).toBe("inherit")
  expect(config.agents).toEqual({})
})

test("resolveRoutingEntry prefers explicit model over all config", () => {
  const config: RoutingConfig = normalizeRoutingConfig({
    subagents: {
      review: { model: "anthropic/claude-sonnet-4-5" },
      default: { model: "inherit" },
    },
    agents: {
      "code-reviewer": { model: "anthropic/claude-opus-4-5", effort: "high" },
    },
  })

  const resolved = resolveRoutingEntry(config, {
    explicitModel: "openai/gpt-4.1",
    agent: "code-reviewer",
    type: "review",
  })

  expect(resolved.source).toBe("explicit")
  expect(resolved.model).toBe("openai/gpt-4.1")
})

test("resolveRoutingEntry prefers concrete agent override over type override", () => {
  const config: RoutingConfig = normalizeRoutingConfig({
    subagents: {
      review: { model: "anthropic/claude-sonnet-4-5", effort: "medium" },
      default: { model: "inherit" },
    },
    agents: {
      "code-reviewer": { model: "anthropic/claude-opus-4-5", effort: "high" },
    },
  })

  const resolved = resolveRoutingEntry(config, {
    agent: "code-reviewer",
    type: "review",
  })

  expect(resolved.source).toBe("agent")
  expect(resolved.model).toBe("anthropic/claude-opus-4-5")
  expect(resolved.effort).toBe("high")
})

test("resolveRoutingEntry falls back from type override to default to inherit", () => {
  const typeConfig = normalizeRoutingConfig({
    subagents: {
      research: { model: "anthropic/claude-haiku-4-5" },
      default: { model: "inherit" },
    },
  })
  const defaultConfig = normalizeRoutingConfig({
    subagents: {
      default: { model: "anthropic/claude-sonnet-4-5", effort: "low" },
    },
  })
  const inheritConfig = normalizeRoutingConfig({})

  expect(resolveRoutingEntry(typeConfig, { type: "research" })).toMatchObject({
    source: "type",
    model: "anthropic/claude-haiku-4-5",
  })
  expect(resolveRoutingEntry(defaultConfig, { type: "unknown" })).toMatchObject({
    source: "default",
    model: "anthropic/claude-sonnet-4-5",
    effort: "low",
  })
  expect(resolveRoutingEntry(inheritConfig, { type: "unknown" })).toMatchObject({
    source: "inherit",
    model: null,
  })
})

test("resolveRoutingEntry treats inherit as null model even when coming from agent override", () => {
  const config = normalizeRoutingConfig({
    subagents: {
      review: { model: "anthropic/claude-sonnet-4-5" },
      default: { model: "inherit" },
    },
    agents: {
      "code-reviewer": { model: "inherit", effort: "medium" },
    },
  })

  const resolved = resolveRoutingEntry(config, { agent: "code-reviewer", type: "review" })
  expect(resolved.source).toBe("agent")
  expect(resolved.model).toBeNull()
  expect(resolved.effort).toBe("medium")
})

test("resolveRoutingEntry preserves explicit model precedence when effort metadata exists elsewhere", () => {
  const config: RoutingConfig = normalizeRoutingConfig({
    subagents: {
      review: { model: "anthropic/claude-sonnet-4-5", effort: "low" },
      default: { model: "anthropic/claude-haiku-4-5", effort: "minimal" },
    },
    agents: {
      "code-reviewer": { model: "anthropic/claude-opus-4-5", effort: "high" },
    },
  })

  const resolved = resolveRoutingEntry(config, {
    explicitModel: "openai/gpt-4.1",
    agent: "code-reviewer",
    type: "review",
  })

  expect(resolved.source).toBe("explicit")
  expect(resolved.model).toBe("openai/gpt-4.1")
  expect(resolved.effort).toBeUndefined()
})

test("resolveRoutingEntry prefers agent effort over type effort", () => {
  const config: RoutingConfig = normalizeRoutingConfig({
    subagents: {
      review: { model: "anthropic/claude-sonnet-4-5", effort: "low" },
    },
    agents: {
      "code-reviewer": { model: "inherit", effort: "high" },
    },
  })

  const resolved = resolveRoutingEntry(config, {
    agent: "code-reviewer",
    type: "review",
  })

  expect(resolved.source).toBe("agent")
  expect(resolved.model).toBeNull()
  expect(resolved.effort).toBe("high")
})

test("agent catalog exposes worker and reviewer routing targets", () => {
  expect(XPOWERS_AGENTS.map((agent) => agent.name)).toEqual([
    "ralph",
    "planner",
    "code-reviewer",
    "autonomous-reviewer",
    "review-quality",
    "review-implementation",
    "review-simplification",
    "review-testing",
    "review-documentation",
    "security-scanner",
    "test-effectiveness-analyst",
    "codebase-investigator",
    "internet-researcher",
    "knowledge-aggregator",
    "devops",
    "test-runner",
  ])
})

test("new concrete review agents participate in routing precedence", () => {
  const config: RoutingConfig = normalizeRoutingConfig({
    subagents: {
      validation: { model: "anthropic/claude-sonnet-4-5" },
    },
    agents: {
      "review-implementation": { model: "anthropic/claude-opus-4-5" },
    },
  })

  const resolved = resolveRoutingEntry(config, {
    agent: "review-implementation",
    type: "validation",
  })

  expect(resolved.source).toBe("agent")
  expect(resolved.model).toBe("anthropic/claude-opus-4-5")
})

test("config update helpers preserve single source of truth semantics", () => {
  const base = normalizeRoutingConfig({})
  const withType = withSubagentModel(base, "review", "anthropic/claude-sonnet-4-5")
  const withConcrete = withAgentModel(withType, "code-reviewer", "anthropic/claude-opus-4-5")
  const withoutConcrete = withoutAgentOverride(withConcrete, "code-reviewer")
  const resetConcrete = resetAllAgentOverrides(withConcrete)

  expect(withType.subagents.review.model).toBe("anthropic/claude-sonnet-4-5")
  expect(withConcrete.agents["code-reviewer"].model).toBe("anthropic/claude-opus-4-5")
  expect(withoutConcrete.agents["code-reviewer"]).toBeUndefined()
  expect(resetConcrete.agents).toEqual({})
  expect(resetConcrete.subagents.review.model).toBe("anthropic/claude-sonnet-4-5")
})

test("serializeRoutingConfig writes canonical shape with comment and agents", () => {
  const text = serializeRoutingConfig(
    normalizeRoutingConfig({
      subagents: {
        review: { model: "anthropic/claude-sonnet-4-5" },
      },
      agents: {
        "code-reviewer": { model: "anthropic/claude-opus-4-5" },
      },
    }),
  )

  const parsed = JSON.parse(text)
  expect(parsed._comment).toBe(DEFAULT_ROUTING_COMMENT)
  expect(parsed.subagents.review.model).toBe("anthropic/claude-sonnet-4-5")
  expect(parsed.subagents.default.model).toBe("inherit")
  expect(parsed.agents["code-reviewer"].model).toBe("anthropic/claude-opus-4-5")
})
