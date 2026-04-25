const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("test_execute_ralph_uses_bv_robot_next_for_triage", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.match(skill, /bv --robot-next/)
})

test("test_execute_ralph_uses_subagent_driven_development_skill", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.match(skill, /subagent-driven-development/)
})

test("test_execute_ralph_verifies_sha_drift_for_success", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.match(skill, /POST_SHA != PRE_SHA/)
  assert.match(skill, /hallucinated completion/)
})

test("test_execute_ralph_handles_turn_limit_hit_resume", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.match(skill, /Turn Limit Hit/)
  assert.match(skill, /Open but Changed/)
})

test("test_execute_ralph_pruned_phase_3_agents", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const command = read("commands/execute-ralph.md")
  
  // Phase 3 should only have these 3 agents
  const expectedAgents = [
    "review-quality",
    "security-scanner",
    "test-effectiveness-analyst"
  ]
  
  for (const agent of expectedAgents) {
    assert.match(skill, new RegExp(agent))
    assert.match(command, new RegExp(agent))
  }
  
  // These should be pruned
  const prunedAgents = [
    "review-testing",
    "review-simplification",
    "review-documentation",
    "devops"
  ]
  
  for (const agent of prunedAgents) {
    assert.ok(!skill.includes(agent) || skill.indexOf(agent) > skill.indexOf("Phase 3"), `Agent ${agent} should be pruned from Phase 3 in SKILL.md`)
    assert.ok(!command.includes(agent) || command.indexOf(agent) > command.indexOf("Phase 3"), `Agent ${agent} should be pruned from Phase 3 in commands/execute-ralph.md`)
  }
})
