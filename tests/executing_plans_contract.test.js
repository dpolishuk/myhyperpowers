const { readFileSync } = require('fs');
const { join } = require('path');
const test = require('node:test');
const assert = require('node:assert');

test('executing-plans skill contract', async (t) => {
  const skillPath = join(process.cwd(), 'skills/executing-plans/SKILL.md');
  const content = readFileSync(skillPath, 'utf8');

  await t.test('should contain Option B: Stateless Dispatch', () => {
    assert.ok(content.includes('### Option B: Stateless Dispatch'), 'Missing Option B header');
  });

  await t.test('should provide guidance on when to use Stateless Dispatch', () => {
    assert.ok(content.includes('Use for: Multi-file implementations, long TDD cycles'), 'Missing usage guidance');
  });

  await t.test('should include verification steps for stateless path', () => {
    assert.ok(content.includes('Record POST_SHA'), 'Missing POST_SHA step');
    assert.ok(content.includes('git diff PRE_SHA..POST_SHA'), 'Missing git diff step');
    assert.ok(content.includes('tm show bd-2'), 'Missing tm show step');
  });

  await t.test('should update Review phase with subagent findings', () => {
    assert.ok(content.includes('For Stateless Dispatch: What findings or architectural risks did the subagent report'), 'Missing review question');
  });

  await t.test('should include counters for common excuses', () => {
    assert.ok(content.includes('Stateless dispatch is too slow'), 'Missing "too slow" excuse');
    assert.ok(content.includes('I can handle this in-context'), 'Missing "handle in-context" excuse');
  });
});
