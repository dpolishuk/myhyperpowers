import { test, expect } from "bun:test"

import {
  DEFAULT_ROUTING_COMMENT,
  normalizeRoutingConfig,
  resolveRoutingEntry,
  serializeRoutingConfig,
  type RoutingConfig,
} from "../.pi/extensions/hyperpowers/routing"

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
