const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("test_execute_ralph_mandates_sha_verification_in_phase_2", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.match(/verify progress by.*SHA comparison/i), "Should mandate SHA verification")
  assert.ok(skill.match(/If\s+[`"']?POST_SHA\s*==\s*PRE_SHA[`"']?/i), "Should handle unchanged SHA")
})

test("test_execute_ralph_uses_subagent_driven_development_protocol", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.match(/subagent-driven-development/i), "Should reference subagent-driven-development skill")
})

test("test_execute_ralph_triggers_parallel_reviews_per_task", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  // The new requirement is to run reviews after EVERY task verification, not just at the end of the epic.
  assert.ok(skill.match(/Phase 2: Dispatch Subagent[\s\S]+Parallel Review/i), "Should trigger parallel reviews in Phase 2 or immediately after")
})

test("test_execute_ralph_includes_remediation_protocol_for_failed_reviews", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.match(/Remediation/i), "Should include remediation protocol")
  assert.ok(skill.match(/tm create ["']Remediation:/i), "Should specify how to create remediation tasks")
})

test("test_execute_ralph_retry_logic_is_limited", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.match(/retry once/i), "Should limit retry to once")
})
