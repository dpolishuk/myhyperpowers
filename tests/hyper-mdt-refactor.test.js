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
  
  const extractPhase3 = (content) => {
    // Matches "## Phase 3" OR "8. **Phase 3"
    const match = content.match(/(## Phase 3: End-of-Epic Review|Phase 3 - End-of-Epic Review)[\s\S]*?(?=\n(##|9\.)|$)/i)
    return match ? match[0] : ""
  }

  const skillPhase3 = extractPhase3(skill)
  const commandPhase3 = extractPhase3(command)

  assert.ok(skillPhase3, "Should find Phase 3 in SKILL.md")
  assert.ok(commandPhase3, "Should find Phase 3 in commands/execute-ralph.md")

  const expectedAgents = [
    "review-quality",
    "security-scanner",
    "test-effectiveness-analyst"
  ]
  
  for (const agent of expectedAgents) {
    assert.ok(skillPhase3.includes(agent), `SKILL.md Phase 3 missing: ${agent}`)
    assert.ok(commandPhase3.includes(agent), `Command Phase 3 missing: ${agent}`)
  }
  
  const prunedAgents = [
    "review-testing",
    "review-simplification",
    "review-documentation",
    "devops"
  ]
  
  for (const agent of prunedAgents) {
    assert.ok(!skillPhase3.includes(agent), `SKILL.md Phase 3 should NOT have: ${agent}`)
    assert.ok(!commandPhase3.includes(agent), `Command Phase 3 should NOT have: ${agent}`)
  }
})
