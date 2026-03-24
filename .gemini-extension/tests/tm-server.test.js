const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'mcp', 'tm-server.js');

async function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    let output = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
      const lines = output.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        try {
          resolve(JSON.parse(lines[0]));
        } catch {
          // wait for more data
        }
      }
    });

    server.stderr.on('data', () => {
      // ignore stderr logging
    });

    server.stdin.write(JSON.stringify(request) + '\n');

    setTimeout(() => reject(new Error('Timeout waiting for response')), 5000);
  });
}

test('tm-server responds to initialize', async () => {
  const server = spawn('node', [SERVER_PATH]);

  try {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 1);
    assert.equal(response.result.serverInfo.name, 'hyperpowers-tm');
  } finally {
    server.kill();
  }
});

test('tm-server returns list of tm tools', async () => {
  const server = spawn('node', [SERVER_PATH]);

  try {
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });

    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(Array.isArray(response.result.tools));
    const toolNames = response.result.tools.map((tool) => tool.name);

    for (const name of ['tm_ready', 'tm_show', 'tm_list', 'tm_update', 'tm_close', 'tm_create', 'tm_dep_tree', 'tm_sync']) {
      assert.ok(toolNames.includes(name), `missing tool ${name}`);
    }
  } finally {
    server.kill();
  }
});

test('tm-server validates required parameters for tm tools', async () => {
  const server = spawn('node', [SERVER_PATH]);

  try {
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });

    const responses = await Promise.all([
      sendRequest(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'tm_show', arguments: {} },
      }),
      sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'tm_close', arguments: {} },
      }),
      sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'tm_create', arguments: {} },
      }),
      sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'tm_dep_tree', arguments: {} },
      }),
    ]);

    for (const response of responses) {
      assert.equal(response.jsonrpc, '2.0');
      assert.ok(response.error);
      assert.equal(response.error.code, -32602);
      assert.equal(response.error.message.includes('Missing required argument'), true);
    }
  } finally {
    server.kill();
  }
});
