const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const EXT_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(EXT_ROOT, '..');

async function read(relativePathFromRepoRoot) {
  return fs.readFile(path.join(REPO_ROOT, relativePathFromRepoRoot), 'utf8');
}

test('Gemini README documents installer-first tm and Linear path', async () => {
  const readme = await read('.gemini-extension/README.md');

  assert.equal(readme.includes('./scripts/install.sh --gemini'), true);
  assert.equal(readme.includes('~/.local/bin/tm'), true);
  assert.equal(readme.includes('tm sync'), true);
  assert.equal(readme.includes('LINEAR_API_KEY'), true);
  assert.equal(readme.includes('LINEAR_TEAM_KEY'), true);
});

test('Gemini context docs describe tm-oriented task surface', async () => {
  const geminiDoc = await read('.gemini-extension/GEMINI.md');

  assert.equal(geminiDoc.includes('tm ready'), true);
  assert.equal(geminiDoc.includes('tm show <id>'), true);
  assert.equal(geminiDoc.includes('tm sync'), true);
});

test('Gemini command surface includes tm-linear setup entrypoint', async () => {
  const commandPath = path.join(EXT_ROOT, 'commands', 'hyperpowers', 'tm-linear-setup.toml');
  const command = await fs.readFile(commandPath, 'utf8');

  assert.equal(command.includes('tm/Linear'), true);
  assert.equal(command.includes('{{args}}'), true);
});

test('Linear setup guide includes a Gemini section', async () => {
  const guide = await read('docs/linear-mcp-setup.md');

  assert.equal(guide.includes('### Gemini CLI'), true);
  assert.equal(guide.includes('./scripts/install.sh --gemini'), true);
  assert.equal(guide.includes('~/.local/bin/tm --help'), true);
});
