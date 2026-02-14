const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'mcp', 'agents-server.js');

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

test('agents-server responds to initialize', async () => {
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
    assert.equal(response.result.serverInfo.name, 'hyperpowers-agents');
  } finally {
    server.kill();
  }
});

test('agents-server returns list of agents', async () => {
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
    assert.ok(response.result.tools.length > 0, 'Should have at least one agent');
    
    const tool = response.result.tools[0];
    assert.ok(tool.name.startsWith('agent_'), 'Tool name should start with agent_');
  } finally {
    server.kill();
  }
});

test('agents-server can call an agent', async () => {
  const server = spawn('node', [SERVER_PATH]);
  
  try {
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    
    const listResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    
    const toolName = listResponse.result.tools[0].name;
    
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: toolName }
    });
    
    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(response.result.content[0].text);
  } finally {
    server.kill();
  }
});
