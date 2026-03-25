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
  assert.equal(readme.includes('Manual extension install alone does **not** provision the shared `tm` runtime'), true);
  assert.equal(readme.includes('cd myhyperpowers'), true);
});

test('Gemini context docs describe tm-oriented task surface', async () => {
  const geminiDoc = await read('.gemini-extension/GEMINI.md');

  assert.equal(geminiDoc.includes('tm ready'), true);
  assert.equal(geminiDoc.includes('tm show <id>'), true);
  assert.equal(geminiDoc.includes('tm list --parent <epic-id>'), true);
  assert.equal(geminiDoc.includes('tm update <id> --status in_progress'), true);
  assert.equal(geminiDoc.includes('LINEAR_TEAM_KEY'), true);
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
  assert.equal(guide.includes('(Claude/OpenCode/Gemini)'), true);
});

test('Top-level README documents installer-first Gemini path for this branch', async () => {
  const readme = await read('README.md');
  const geminiSection = readme.split('<summary><strong>Gemini CLI</strong></summary>')[1]?.split('</details>')[0] || '';

  assert.equal(geminiSection.includes('./scripts/install.sh --gemini'), true);
  assert.equal(geminiSection.includes('gemini extensions install .gemini-extension'), true);
  assert.equal(geminiSection.includes('fallback'), true);
});
