const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.resolve(__dirname, "..")
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

test("test_subagent_protocol_allows_analytical_tasks_with_no_sha_change", () => {
  const skill = read("skills/subagent-driven-development/SKILL.md")
  // Should allow SHA unchanged IF status is 'closed'
  // More robust regex matching the bash logic
  assert.ok(skill.match(/if[\s\S]*PRE_SHA[\s\S]*==[\s\S]*POST_SHA[\s\S]*STATUS[\s\S]*!=[\s\S]*closed/i), "Should allow SHA unchanged if status is closed")
})

test("test_execute_ralph_mandates_sre_refinement_in_phase_1", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const parts = skill.split(/## Phase 1:/i)
  assert.ok(parts.length > 1, "Should find Phase 1 header")
  const phase1 = parts[1].split(/## Phase 2:/i)[0]
  assert.ok(phase1.match(/sre-task-refinement/i), "Should mandate SRE task refinement in Phase 1")
})

test("test_execute_ralph_pruned_per_task_reviews", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const phase2 = skill.split(/## Phase 2:/i)[1].split(/## Phase 3:/i)[0]
  assert.ok(phase2.match(/mcp_agents_agent_autonomous_reviewer/i), "Should use autonomous-reviewer in Phase 2")
  assert.ok(!phase2.match(/review-quality\(\)/i), "Should NOT use separate review-quality() in Phase 2")
})

test("test_execute_ralph_pruned_end_of_epic_reviews", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  const parts = skill.split(/## Phase 3: End-of-Epic Review/i)
  assert.ok(parts.length > 1, "Should find Phase 3 header")
  const phase3 = parts[1].split(/## Phase 4:/i)[0]
  assert.ok(phase3.match(/review-quality/i), "Phase 3 should have review-quality")
  assert.ok(phase3.match(/security-scanner/i), "Phase 3 should have security-scanner")
  assert.ok(phase3.match(/test-effectiveness-analyst/i), "Phase 3 should have test-effectiveness-analyst")
  assert.ok(!phase3.match(/review-simplification/i), "Phase 3 should NOT have review-simplification")
})

test("test_subagent_prompt_handoff_hardening_tags", () => {
  const skill = read("skills/execute-ralph/SKILL.md")
  assert.ok(skill.match(/<epic_contract>/i), "Should mention <epic_contract> tag")
  assert.ok(skill.match(/<task_spec>/i), "Should mention <task_spec> tag")
})
