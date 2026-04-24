const { readFileSync } = require('fs');
const { join } = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('executing-plans skill contract', async (t) => {
  const skillPath = join(process.cwd(), 'skills/executing-plans/SKILL.md');
  const content = readFileSync(skillPath, 'utf8');

  await t.test('should contain Option B: Stateless Dispatch', () => {
    assert.ok(content.match(/### Option B: Stateless Dispatch/i), 'Missing Option B header');
  });

  await t.test('should provide guidance on when to use Stateless Dispatch', () => {
    assert.ok(content.match(/Use for:[\s\S]*Multi-file implementations[\s\S]*long TDD cycles/i), 'Missing usage guidance');
  });

  await t.test('should include verification steps for stateless path', () => {
    const optionBParts = content.split(/### Option B: Stateless Dispatch/i);
    // Should have 2 parts: [before, implementation]
    assert.ok(optionBParts.length > 1, 'Missing main implementation of Option B section');

    const mainImplementation = optionBParts[1];
    // Stop at the next header or horizontal rule
    const nextSectionMatch = mainImplementation.match(/\n(##|---|[*]{2}Execute steps)/);
    const optionBSection = nextSectionMatch
      ? mainImplementation.slice(0, nextSectionMatch.index)
      : mainImplementation;

    assert.ok(optionBSection.match(/Record\s*[`"']?POST_SHA[`"']?/i), 'Missing POST_SHA step');
    assert.ok(optionBSection.match(/git diff\s*[`"']?PRE_SHA\.\.POST_SHA[`"']?/i), 'Missing git diff step');
    assert.ok(optionBSection.match(/tm show\s*[`"']?bd-\d+[`"']?/i), 'Missing tm show step');
    assert.ok(!optionBSection.match(/tm close\s*[`"']?bd-\d+[`"']?/i), 'Stateless path should be fail-closed (no auto tm close)');
  });

  await t.test('should update Review phase with subagent findings', () => {
    assert.ok(content.match(/For Stateless Dispatch:[\s\S]*What findings or architectural risks did the subagent report/i), 'Missing review question');
  });

  await t.test('should include counters for common excuses', () => {
    assert.ok(content.match(/Stateless dispatch is too slow/i), 'Missing "too slow" excuse');
    assert.ok(content.match(/I can handle this in-context/i), 'Missing "handle in-context" excuse');
  });
});
