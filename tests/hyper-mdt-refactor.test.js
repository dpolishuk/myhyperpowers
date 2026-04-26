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
    // Anchor to the actual Phase 3 header (skill heading or numbered "Phase 3 -" bullet),
    // and end at the next markdown header or an explicit next phase marker.
    const startMatch = content.match(/^(##\s+Phase\s*3\b|\d+\.\s+\*\*Phase\s*3\b)/m)
    if (!startMatch) return ""
    const start = startMatch.index
    const rest = content.slice(start)
    // Find next markdown header (##) or next top-level numbered Phase bullet
    const nextSectionMatch = rest
      .slice(startMatch[0].length)
      .match(/\r?\n(?:##\s|\d+\.\s+\*\*Phase\b)/)
    return nextSectionMatch ? rest.slice(0, startMatch[0].length + nextSectionMatch.index) : rest
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
