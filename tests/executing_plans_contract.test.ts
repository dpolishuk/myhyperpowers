import { readFileSync } from 'fs';
import { join } from 'path';

describe('executing-plans skill contract', () => {
  const skillPath = join(process.cwd(), 'skills/executing-plans/SKILL.md');
  const content = readFileSync(skillPath, 'utf8');

  test('should contain Option B: Stateless Dispatch', () => {
    expect(content).toContain('### Option B: Stateless Dispatch');
  });

  test('should provide guidance on when to use Stateless Dispatch', () => {
    expect(content).toContain('Use for: Multi-file implementations, long TDD cycles');
  });

  test('should include verification steps for stateless path', () => {
    expect(content).toContain('Record POST_SHA');
    expect(content).toContain('git diff PRE_SHA..POST_SHA');
    expect(content).toContain('tm show bd-2');
  });

  test('should update Review phase with subagent findings', () => {
    expect(content).toContain('For Stateless Dispatch: What findings or architectural risks did the subagent report');
  });

  test('should include counters for common excuses', () => {
    expect(content).toContain('Stateless dispatch is too slow');
    expect(content).toContain('I can handle this in-context');
  });
});
