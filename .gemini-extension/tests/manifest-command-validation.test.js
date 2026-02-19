const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const EXT_ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(EXT_ROOT, 'gemini-extension.json');
const COMMANDS_ROOT = path.join(EXT_ROOT, 'commands');
const COMMAND_NAMESPACE = 'hyperpowers';
const REQUIRED_COMMANDS = ['brainstorm', 'write-plan', 'execute-plan', 'review-implementation'];

test('gemini extension manifest is parseable and canonical', async () => {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(raw);

  assert.equal(manifest.name, 'hyperpowers');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.contextFileName, 'GEMINI.md');
  assert.ok(manifest.mcpServers, 'manifest should include mcpServers');
  assert.equal(typeof manifest.mcpServers, 'object');
  assert.ok(manifest.mcpServers.skills, 'manifest should include skills server');
  assert.ok(manifest.mcpServers.agents, 'manifest should include agents server');
  assert.ok(manifest.mcpServers.bd, 'manifest should include bd server');
  assert.ok(!Object.prototype.hasOwnProperty.call(manifest, 'commands'), 'commands should be defined by TOML files, not manifest');
});

test('required command files exist and are discoverable by namespace', async () => {
  const namespaceDir = path.join(COMMANDS_ROOT, COMMAND_NAMESPACE);
  const entries = await fs.readdir(namespaceDir, { withFileTypes: true });
  const commandFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.toml'))
    .map((entry) => path.parse(entry.name).name)
    .sort();

  for (const command of REQUIRED_COMMANDS) {
    assert.ok(commandFiles.includes(command), `missing command file: ${command}`);
  }

  for (const command of REQUIRED_COMMANDS) {
    assert.ok(commandFiles.includes(command), `expected /${COMMAND_NAMESPACE}:${command}`);
  }
});

test('command TOML files contain required fields', async () => {
  const namespaceDir = path.join(COMMANDS_ROOT, COMMAND_NAMESPACE);
  for (const command of REQUIRED_COMMANDS) {
    const commandPath = path.join(namespaceDir, `${command}.toml`);
    const raw = await fs.readFile(commandPath, 'utf-8');
    const hasDescription = /^description\s*=\s*".+"/m.test(raw);
    const hasPrompt = /prompt\s*=\s*"""[\s\S]*"""/m.test(raw);

    assert.ok(hasDescription, `${command}.toml must include description`);
    assert.ok(hasPrompt, `${command}.toml must include a multiline prompt`);
    assert.ok(raw.includes('{{args}}'), `${command}.toml should include arg passthrough`);
  }
});
