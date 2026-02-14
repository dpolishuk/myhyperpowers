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
    assert.ok(response.result.tools.length >= 3, 'Should have at least 3 bd tools');
    
    const toolNames = response.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('bd_ready'), 'Should have bd_ready');
    assert.ok(toolNames.includes('bd_show'), 'Should have bd_show');
    assert.ok(toolNames.includes('bd_update'), 'Should have bd_update');
  } finally {
    server.kill();
  }
});
