const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'mcp', 'skills-server.js');

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

test('skills-server responds to initialize', async () => {
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
    assert.equal(response.result.protocolVersion, '2024-11-05');
    assert.equal(response.result.serverInfo.name, 'hyperpowers-skills');
  } finally {
    server.kill();
  }
});

test('skills-server returns list of tools', async () => {
  const server = spawn('node', [SERVER_PATH]);
  
  try {
    // Initialize first
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    
    // Get tools list
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 2);
    assert.ok(response.result);
    assert.ok(Array.isArray(response.result.tools));
    assert.ok(response.result.tools.length > 0, 'Should have at least one skill');
    
    // Check tool structure
    const tool = response.result.tools[0];
    assert.ok(tool.name, 'Tool should have a name');
    assert.ok(tool.description, 'Tool should have a description');
    assert.ok(tool.inputSchema, 'Tool should have inputSchema');
  } finally {
    server.kill();
  }
});

test('skills-server can call a tool', async () => {
  const server = spawn('node', [SERVER_PATH]);
  
  try {
    // Initialize
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    
    // Get tools list to find a valid tool name
    const listResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    
    const toolName = listResponse.result.tools[0].name;
    
    // Call the tool
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: toolName }
    });
    
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 3);
    assert.ok(response.result);
    assert.ok(Array.isArray(response.result.content));
    assert.ok(response.result.content.length > 0);
    assert.ok(response.result.content[0].text, 'Should have text content');
    assert.ok(response.result.content[0].text.includes('name:'), 'Should contain skill name');
  } finally {
    server.kill();
  }
});

test('skills-server returns error for unknown tool', async () => {
  const server = spawn('node', [SERVER_PATH]);
  
  try {
    // Initialize
    await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    
    // Call unknown tool
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'skills_nonexistent' }
    });
    
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 2);
    assert.ok(response.error);
    assert.equal(response.error.code, -32602);
    assert.ok(response.error.message.includes('not found'));
  } finally {
    server.kill();
  }
});

test('skills-server handles missing tools/call params as invalid', async () => {
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
