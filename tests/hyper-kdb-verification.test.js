const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("test_execute_ralph_mandates_sha_verification_in_phase_2", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.includes("verify progress by SHA comparison"), "Should mandate SHA verification")
  assert.ok(skill.includes("If POST_SHA == PRE_SHA"), "Should handle unchanged SHA")
})

test("test_execute_ralph_uses_subagent_driven_development_protocol", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.includes("subagent-driven-development"), "Should reference subagent-driven-development skill")
})

test("test_execute_ralph_triggers_parallel_reviews_per_task", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  // The new requirement is to run reviews after EVERY task verification, not just at the end of the epic.
  assert.ok(skill.match(/Phase 2: Dispatch Subagent[\s\S]+Parallel Review/), "Should trigger parallel reviews in Phase 2 or immediately after")
})

test("test_execute_ralph_includes_remediation_protocol_for_failed_reviews", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.includes("Remediation"), "Should include remediation protocol")
  assert.ok(skill.includes("tm create \"Remediation:"), "Should specify how to create remediation tasks")
})

test("test_execute_ralph_retry_logic_is_limited", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.includes("retry once"), "Should limit retry to once")
})
