const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'mcp', 'bd-server.js');

async function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    let output = '';
    
    server.stdout.on('data', (data) => {
      output += data.toString();
      const lines = output.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        try {
          const response = JSON.parse(lines[0]);
          resolve(response);
        } catch {
          // Wait for more data
        }
      }
    });
    
    server.stderr.on('data', (data) => {
      // Ignore stderr (logging)
    });
    
    server.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 5000);
  });
}

test('bd-server responds to initialize', async () => {
  const server = spawn('node', [SERVER_PATH]);
  
  try {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 1);
    assert.ok(response.result);
    assert.equal(response.result.serverInfo.name, 'hyperpowers-bd');
  } finally {
    server.kill();
  }
});

test('bd-server returns list of tools', async () => {
  const server = spawn('node', [SERVER_PATH]);
  
  try {
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    
    assert.equal(response.jsonrpc, '2.0');
    assert.ok(Array.isArray(response.result.tools));
    assert.ok(response.result.tools.length >= 4, 'Should have at least 4 bd tools');
    
    const toolNames = response.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('bd_ready'), 'Should have bd_ready');
    assert.ok(toolNames.includes('bd_show'), 'Should have bd_show');
    assert.ok(toolNames.includes('bd_close'), 'Should have bd_close');
    assert.ok(toolNames.includes('bd_update'), 'Should have bd_update');
  } finally {
    server.kill();
  }
});

test('bd-server handles missing tools/call params as invalid', async () => {
  const server = spawn('node', [SERVER_PATH]);

  try {
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call'
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 2);
    assert.ok(response.error);
    assert.equal(response.error.code, -32602);
  } finally {
    server.kill();
  }
});

test('bd-server validates required parameters for bd tools', async () => {
  const server = spawn('node', [SERVER_PATH]);

  try {
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    const responseShowMissingId = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'bd_show' }
    });

    const responseCloseMissingId = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'bd_close', arguments: {} }
    });

    const responseUpdateMissingStatus = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'bd_update', arguments: { id: 'bd-1' } }
    });

    for (const response of [responseShowMissingId, responseCloseMissingId, responseUpdateMissingStatus]) {
      assert.equal(response.jsonrpc, '2.0');
      assert.ok(response.error);
      assert.equal(response.error.code, -32602);
      assert.equal(response.error.message.includes('Missing required argument'), true);
    }
  } finally {
    server.kill();
  }
});
