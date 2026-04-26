const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT_DIR = path.resolve(__dirname, '..');
const RALPH_PATH = path.join(ROOT_DIR, 'agents', 'ralph.md');
const PLANNER_PATH = path.join(ROOT_DIR, 'agents', 'planner.md');

test('agents/ralph.md should define itself as a Stateless Orchestrator', () => {
  const content = fs.readFileSync(RALPH_PATH, 'utf8');
  assert.ok(content.includes('Stateless Orchestrator'), 'Ralph should mention "Stateless Orchestrator"');
  assert.ok(content.includes('Side-Effect Verification'), 'Ralph should mention "Side-Effect Verification"');
  assert.ok(content.includes('SHA drift'), 'Ralph should mention "SHA drift"');
  assert.ok(/tm show/i.test(content), 'Ralph should verify task status with tm show');
  assert.ok(/status[\s\S]*closed|closed[\s\S]*status/i.test(content), 'Ralph should require task status to be closed');
});

test('agents/planner.md should mandate Immutable Epic Requirements', () => {
  const content = fs.readFileSync(PLANNER_PATH, 'utf8');
  assert.ok(content.includes('Immutable Epic Requirements'), 'Planner should mention "Immutable Epic Requirements"');
});

test('Agents should not contain placeholder text', () => {
  const ralphContent = fs.readFileSync(RALPH_PATH, 'utf8');
  const plannerContent = fs.readFileSync(PLANNER_PATH, 'utf8');
  
  const placeholders = ['[detailed above]', '[as specified]', '[will be added]'];
  
  placeholders.forEach(placeholder => {
    assert.ok(!ralphContent.includes(placeholder), `Ralph should not contain placeholder: ${placeholder}`);
    assert.ok(!plannerContent.includes(placeholder), `Planner should not contain placeholder: ${placeholder}`);
  });
});
