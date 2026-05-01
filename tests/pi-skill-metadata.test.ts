import { test, expect } from "bun:test"

import {
  parsePiSkillMetadata,
  parsePiSkillMetadataFromSkillContent,
} from "../.pi/extensions/xpowers/skill-metadata"

test("parsePiSkillMetadata returns safe defaults when metadata is omitted", () => {
  expect(parsePiSkillMetadata({})).toEqual({
    subProcess: false,
    subProcessContext: "fresh",
    model: undefined,
    thinkingLevel: undefined,
  })
})

test("parsePiSkillMetadata normalizes valid metadata.pi fields", () => {
  expect(parsePiSkillMetadata({
    metadata: {
      pi: {
        subProcess: true,
        subProcessContext: "fork",
        model: "anthropic/claude-sonnet-4-5",
        thinkingLevel: "high",
      },
    },
  })).toEqual({
    subProcess: true,
    subProcessContext: "fork",
    model: "anthropic/claude-sonnet-4-5",
    thinkingLevel: "high",
  })
})

test("parsePiSkillMetadata falls back safely for malformed metadata.pi fields", () => {
  expect(parsePiSkillMetadata({
    metadata: {
      pi: {
        subProcess: "yes",
        subProcessContext: "sideways",
        model: "",
        thinkingLevel: "turbo",
      },
    },
  })).toEqual({
    subProcess: false,
    subProcessContext: "fresh",
    model: undefined,
    thinkingLevel: undefined,
  })
})

test("parsePiSkillMetadataFromSkillContent reads YAML frontmatter", () => {
  const content = `---
name: demo-skill
description: Demo skill
metadata:
  pi:
    subProcess: true
    subProcessContext: fork
    model: openai/gpt-4.1
    thinkingLevel: medium
---

Body`

  expect(parsePiSkillMetadataFromSkillContent(content)).toEqual({
    subProcess: true,
    subProcessContext: "fork",
    model: "openai/gpt-4.1",
    thinkingLevel: "medium",
  })
})

test("skill metadata stays advisory relative to routing", () => {
  const metadata = parsePiSkillMetadata({
    metadata: {
      pi: {
        subProcess: true,
        model: "openai/gpt-4.1",
        thinkingLevel: "high",
      },
    },
  })

  const routing = {
    model: "anthropic/claude-opus-4-5",
    effort: "low",
  }

  expect(routing.model).toBe("anthropic/claude-opus-4-5")
  expect(routing.effort).toBe("low")
  expect(metadata.model).toBe("openai/gpt-4.1")
  expect(metadata.thinkingLevel).toBe("high")
})
