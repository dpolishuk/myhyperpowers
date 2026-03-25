const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('node:fs/promises');
const os = require('node:os');

const SERVER_PATH = path.join(__dirname, '..', 'mcp', 'tm-server.js');

function createHarness(env = process.env, options = {}) {
  const server = spawn('node', [SERVER_PATH], { env, ...options });
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

test('tm-server responds to initialize with full MCP shape', async () => {
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
    assert.deepEqual(byName.tm_update.inputSchema.required, ['id']);
  } finally {
    harness.close();
  }
});

test('tm-server validates required parameters deterministically', async () => {
  const harness = createHarness();

  try {
    await harness.initialize();

    const showMissing = await harness.sendRequest('tools/call', { name: 'tm_show', arguments: {} });
    const closeMissing = await harness.sendRequest('tools/call', { name: 'tm_close', arguments: {} });
    const createMissing = await harness.sendRequest('tools/call', { name: 'tm_create', arguments: {} });
    const depTreeMissing = await harness.sendRequest('tools/call', { name: 'tm_dep_tree', arguments: {} });
    const updateMissing = await harness.sendRequest('tools/call', { name: 'tm_update', arguments: {} });

    for (const response of [showMissing, closeMissing, createMissing, depTreeMissing, updateMissing]) {
      assert.equal(response.jsonrpc, '2.0');
      assert.ok(response.error);
      assert.equal(response.error.code, -32602);
      assert.equal(response.error.message.includes('Missing required argument'), true);
    }
  } finally {
    harness.close();
  }
});

test('tm-server dispatches all tool calls to tm with correct argv', async () => {
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

    const readyR = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });
    const showR = await harness.sendRequest('tools/call', { name: 'tm_show', arguments: { id: 'bd-1' } });
    const listR = await harness.sendRequest('tools/call', { name: 'tm_list', arguments: { status: 'open', parent: 'bd-1' } });
    const updateR = await harness.sendRequest('tools/call', { name: 'tm_update', arguments: { id: 'bd-2', status: 'in_progress', priority: 1 } });
    const closeR = await harness.sendRequest('tools/call', { name: 'tm_close', arguments: { id: 'bd-3' } });
    const createR = await harness.sendRequest('tools/call', { name: 'tm_create', arguments: { title: 'New task', type: 'feature', priority: 2 } });
    const depR = await harness.sendRequest('tools/call', { name: 'tm_dep_tree', arguments: { id: 'bd-4' } });
    const syncR = await harness.sendRequest('tools/call', { name: 'tm_sync', arguments: {} });

    assert.equal(readyR.result.content[0].text.includes('ok:ready'), true);
    assert.equal(showR.result.content[0].text.includes('ok:show bd-1'), true);
    assert.equal(listR.result.content[0].text.includes('ok:list --status open --parent bd-1'), true);
    assert.equal(updateR.result.content[0].text.includes('ok:update bd-2 --status in_progress --priority 1'), true);
    assert.equal(closeR.result.content[0].text.includes('ok:close bd-3'), true);
    assert.equal(createR.result.content[0].text.includes('ok:create New task --type feature --priority 2'), true);
    assert.equal(depR.result.content[0].text.includes('ok:dep tree bd-4'), true);
    assert.equal(syncR.result.content[0].text.includes('tm-sync: Synced 1 issues'), true);

    const recordedCalls = (await fs.readFile(callsPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(recordedCalls, [
      ['--version'],
      ['ready'],
      ['show', 'bd-1'],
      ['list', '--status', 'open', '--parent', 'bd-1'],
      ['update', 'bd-2', '--status', 'in_progress', '--priority', '1'],
      ['close', 'bd-3'],
      ['create', 'New task', '--type', 'feature', '--priority', '2'],
      ['dep', 'tree', 'bd-4'],
      ['sync'],
    ]);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('tm-server returns isError for non-zero tm exit', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-tm-fail-'));
  const fakeTmPath = path.join(tempDir, 'tm');

  await fs.writeFile(fakeTmPath, `#!/usr/bin/env node
if (process.argv[2] === '--version') { process.stdout.write('fake\\n'); process.exit(0); }
process.stderr.write('fatal: something broke\\n');
process.exit(1);
`, { mode: 0o755 });

  const harness = createHarness({ ...process.env, TM_PATH: fakeTmPath });

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });

    assert.equal(response.result.isError, true);
    assert.equal(response.result.content[0].text.includes('fatal: something broke'), true);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('tm-server rejects unknown tool name', async () => {
  const harness = createHarness();

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { name: 'tm_nonexistent', arguments: {} });

    assert.ok(response.error);
    assert.equal(response.error.code, -32602);
    assert.equal(response.error.message.includes('Tool not found'), true);
  } finally {
    harness.close();
  }
});

test('tm-server rejects missing name in tools/call', async () => {
  const harness = createHarness();

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { arguments: {} });

    assert.ok(response.error);
    assert.equal(response.error.code, -32602);
    assert.equal(response.error.message.includes('Missing required argument: name'), true);
  } finally {
    harness.close();
  }
});

test('tm-server prefers executable ~/.local/bin/tm when TM_PATH is unset', async () => {
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
    assert.deepEqual(recordedCalls, [['--version'], ['ready']]);
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
    assert.deepEqual(recordedCalls, [['--version'], ['ready']]);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('tm-server falls back to PATH tm when managed runtime is broken at runtime', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-tm-broken-'));
  const homeBin = path.join(tempDir, '.local', 'bin');
  const managedTmPath = path.join(homeBin, 'tm');
  const fakeBin = path.join(tempDir, 'bin');
  const pathTmPath = path.join(fakeBin, 'tm');
  const pathCalls = path.join(tempDir, 'calls-path-fallback.jsonl');

  await fs.mkdir(homeBin, { recursive: true });
  await fs.mkdir(fakeBin, { recursive: true });
  await fs.writeFile(managedTmPath, `#!/usr/bin/env node
process.stderr.write('managed tm broken\\n');
process.exit(127);
`, { mode: 0o755 });
  await fs.writeFile(pathTmPath, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.CALLS_PATH, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('path-fallback-tm\\n');
`, { mode: 0o755 });

  const harness = createHarness({
    ...process.env,
    HOME: tempDir,
    PATH: `${fakeBin}:${process.env.PATH}`,
    CALLS_PATH: pathCalls,
  });

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });

    assert.equal(response.result.content[0].text.includes('path-fallback-tm'), true);
    const recordedCalls = (await fs.readFile(pathCalls, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(recordedCalls, [['--version'], ['ready']]);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('tm-server executes tm in TM_REPO_ROOT when provided', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-tm-repo-root-'));
  const fakeTmPath = path.join(tempDir, 'tm');
  const callsPath = path.join(tempDir, 'calls-root.jsonl');
  const workspaceDir = path.join(tempDir, 'workspace');
  const extensionDir = path.join(tempDir, 'extension');

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(extensionDir, { recursive: true });
  await fs.writeFile(fakeTmPath, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.CALLS_PATH, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n');
process.stdout.write('root-tm\\n');
`, { mode: 0o755 });

  const harness = createHarness({
    ...process.env,
    TM_PATH: fakeTmPath,
    TM_REPO_ROOT: workspaceDir,
    CALLS_PATH: callsPath,
  }, {
    cwd: extensionDir,
  });

  try {
    await harness.initialize();
    const response = await harness.sendRequest('tools/call', { name: 'tm_ready', arguments: {} });

    assert.equal(response.result.content[0].text.includes('root-tm'), true);
    const recordedCalls = (await fs.readFile(callsPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(recordedCalls[0].cwd, workspaceDir);
    assert.equal(recordedCalls[1].cwd, workspaceDir);
  } finally {
    harness.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
