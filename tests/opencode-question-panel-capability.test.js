const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("installed OpenCode SDK exposes question consumption but not question creation", { skip: !fs.existsSync(path.join(repoRoot, ".opencode/node_modules/@opencode-ai/sdk")) }, () => {
  const v2Types = read(".opencode/node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts")
  const v2Sdk = read(".opencode/node_modules/@opencode-ai/sdk/dist/v2/gen/sdk.gen.d.ts")
  const pluginTypes = read(".opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts")

  assert.equal(v2Sdk.includes("class Question"), true)
  assert.equal(v2Types.includes('url: "/question"'), true)
  assert.equal(v2Types.includes('url: "/question/{requestID}/reply"'), true)
  assert.equal(v2Types.includes('url: "/question/{requestID}/reject"'), true)

  assert.equal(v2Sdk.includes("create(") || v2Sdk.includes("ask("), false)
  assert.equal(v2Types.includes('url: "/question/create"'), false)
  assert.equal(v2Types.includes('url: "/question/{requestID}/create"'), false)
  assert.equal(v2Types.includes('url: "/question/ask"'), false)

  assert.equal(pluginTypes.includes('type: "question"'), false)
  assert.equal(pluginTypes.includes('question.create'), false)
})

test("repo documents the OpenCode question-panel creation gap", () => {
  const doc = read("docs/opencode-question-panel-gap.md")

  assert.equal(doc.includes("question.list"), true)
  assert.equal(doc.includes("question.reply"), true)
  assert.equal(doc.includes("question.reject"), true)
  assert.equal(doc.includes("no direct plugin API to create a question-panel request"), true)
  assert.equal(doc.includes("opencode-question-runtime.ts"), true)
  assert.equal(doc.includes("tests/opencode-question-runtime.test.ts"), true)
  assert.equal(doc.includes("myhyperpowers-e22"), true)
})
