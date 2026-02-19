const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('node:fs/promises');
const os = require('node:os');

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

test('agents-server handles missing tools/call params as invalid', async () => {
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

test('agents-server respects AGENTS_PATH override', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hp-agents-'));
  const agentsDir = path.join(tempRoot, 'agents');
  await fs.mkdir(agentsDir, { recursive: true });
  await fs.writeFile(path.join(agentsDir, 'custom.md'), `---\nname: override-test\ndescription: Custom agent loaded via AGENTS_PATH\n---\n\nCustom agent marker: OVERRIDES_ACTIVE\n`);

  const server = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      AGENTS_PATH: agentsDir
    }
  });

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

    const toolName = listResponse.result.tools
      .map((tool) => tool.name)
      .find((name) => name === 'agent_override_test');

    assert.equal(toolName, 'agent_override_test');

    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: toolName }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 3);
    assert.ok(response.result);
    assert.ok(response.result.content[0].text.includes('OVERRIDES_ACTIVE'));
  } finally {
    server.kill();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
