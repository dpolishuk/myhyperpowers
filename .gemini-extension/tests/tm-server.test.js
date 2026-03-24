const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('node:fs/promises');
const os = require('node:os');

const SERVER_PATH = path.join(__dirname, '..', 'mcp', 'tm-server.js');

function createHarness(env = process.env) {
  const server = spawn('node', [SERVER_PATH], { env });
  let nextId = 1;
  let buffer = '';
  const pending = new Map();

  server.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        continue;
      }

      const resolver = pending.get(response.id ?? '__null__');
      if (resolver) {
        pending.delete(response.id ?? '__null__');
        resolver.resolve(response);
      }
    }
  });

  server.stderr.on('data', () => {
    // ignore stderr logging
  });

  const sendRequest = (method, params) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Timeout waiting for response'));
      }, 5000);

      pending.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
      });

      server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  };

  return {
    server,
    sendRequest,
    async initialize() {
      return sendRequest('initialize', {});
    },
    close() {
      server.kill();
    },
  };
}

test('tm-server responds to initialize', async () => {
  const harness = createHarness();

  try {
    const response = await harness.initialize();

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.equal(response.result.protocolVersion, '2024-11-05');
    assert.deepEqual(response.result.capabilities, { tools: {} });
    assert.equal(response.result.serverInfo.name, 'hyperpowers-tm');
    assert.equal(response.result.serverInfo.version, '1.0.0');
  } finally {
    harness.close();
  }
});

test('tm-server returns list of tm tools with expected schemas', async () => {
  const harness = createHarness();

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/list');
    const tools = response.result.tools;

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(Array.isArray(tools));

    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    for (const name of ['tm_ready', 'tm_show', 'tm_list', 'tm_update', 'tm_close', 'tm_create', 'tm_dep_tree', 'tm_sync']) {
      assert.ok(byName[name], `missing tool ${name}`);
    }

    assert.deepEqual(byName.tm_show.inputSchema.required, ['id']);
    assert.deepEqual(byName.tm_close.inputSchema.required, ['id']);
    assert.deepEqual(byName.tm_create.inputSchema.required, ['title']);
    assert.deepEqual(byName.tm_dep_tree.inputSchema.required, ['id']);
  } finally {
    harness.close();
  }
});

test('tm-server validates required parameters for tm tools deterministically', async () => {
  const harness = createHarness();

  try {
    await harness.initialize();

    const responseShowMissingId = await harness.sendRequest('tools/call', { name: 'tm_show', arguments: {} });
    const responseCloseMissingId = await harness.sendRequest('tools/call', { name: 'tm_close', arguments: {} });
    const responseCreateMissingTitle = await harness.sendRequest('tools/call', { name: 'tm_create', arguments: {} });
    const responseDepTreeMissingId = await harness.sendRequest('tools/call', { name: 'tm_dep_tree', arguments: {} });

    for (const response of [responseShowMissingId, responseCloseMissingId, responseCreateMissingTitle, responseDepTreeMissingId]) {
      assert.equal(response.jsonrpc, '2.0');
      assert.ok(response.error);
      assert.equal(response.error.code, -32602);
      assert.equal(response.error.message.includes('Missing required argument'), true);
    }
  } finally {
    harness.close();
  }
});

test('tm-server dispatches tool calls to tm and surfaces stderr output on success', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-tm-server-'));
  const fakeTmPath = path.join(tempDir, 'tm');
  const callsPath = path.join(tempDir, 'calls.jsonl');

  await fs.writeFile(fakeTmPath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS_PATH, JSON.stringify(args) + '\\n');
if (args[0] === 'sync') {
  process.stderr.write('tm-sync: Synced 1 issues\\n');
} else {
  process.stdout.write('ok:' + args.join(' ') + '\\n');
}
`, { mode: 0o755 });

  const harness = createHarness({ ...process.env, TM_PATH: fakeTmPath, CALLS_PATH: callsPath });

  try {
    await harness.initialize();

    const readyResponse = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });
    const listResponse = await harness.sendRequest('tools/call', { name: 'tm_list', arguments: { status: 'open', parent: 'bd-1' } });
    const syncResponse = await harness.sendRequest('tools/call', { name: 'tm_sync', arguments: {} });

    assert.equal(readyResponse.result.content[0].text.includes('ok:ready'), true);
    assert.equal(listResponse.result.content[0].text.includes('ok:list --status open --parent bd-1'), true);
    assert.equal(syncResponse.result.content[0].text.includes('tm-sync: Synced 1 issues'), true);

    const recordedCalls = (await fs.readFile(callsPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(recordedCalls, [
      ['--version'],
      ['ready'],
      ['list', '--status', 'open', '--parent', 'bd-1'],
      ['sync'],
    ]);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('tm-server prefers ~/.local/bin/tm when TM_PATH is unset and managed runtime exists', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-tm-home-'));
  const homeBin = path.join(tempDir, '.local', 'bin');
  const fakeTmPath = path.join(homeBin, 'tm');
  const callsPath = path.join(tempDir, 'calls-home.jsonl');

  await fs.mkdir(homeBin, { recursive: true });
  await fs.writeFile(fakeTmPath, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.CALLS_PATH, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('home-tm\\n');
`, { mode: 0o755 });

  const harness = createHarness({ ...process.env, HOME: tempDir, CALLS_PATH: callsPath });

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });

    assert.equal(response.result.content[0].text.includes('home-tm'), true);
    const recordedCalls = (await fs.readFile(callsPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(recordedCalls, [
      ['--version'],
      ['ready'],
    ]);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('tm-server falls back to PATH tm when managed runtime is absent', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-tm-path-'));
  const fakeBin = path.join(tempDir, 'bin');
  const fakeTmPath = path.join(fakeBin, 'tm');
  const callsPath = path.join(tempDir, 'calls-path.jsonl');
  const fakeHome = path.join(tempDir, 'home');

  await fs.mkdir(fakeBin, { recursive: true });
  await fs.mkdir(fakeHome, { recursive: true });
  await fs.writeFile(fakeTmPath, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.CALLS_PATH, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('path-tm\\n');
`, { mode: 0o755 });

  const harness = createHarness({
    ...process.env,
    HOME: fakeHome,
    PATH: `${fakeBin}:${process.env.PATH}`,
    CALLS_PATH: callsPath,
  });

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });

    assert.equal(response.result.content[0].text.includes('path-tm'), true);
    const recordedCalls = (await fs.readFile(callsPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(recordedCalls, [
      ['--version'],
      ['ready'],
    ]);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
