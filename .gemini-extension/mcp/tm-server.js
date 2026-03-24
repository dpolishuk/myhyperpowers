#!/usr/bin/env node
/**
 * MCP Server: tm
 *
 * Exposes the shared tm CLI to Gemini CLI users via Model Context Protocol.
 * The server delegates to the root-level tm runtime rather than reimplementing
 * task-management or Linear sync behavior inside the Gemini extension.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

function resolveTmCommand() {
  if (process.env.TM_PATH) {
    return process.env.TM_PATH;
  }

  if (process.env.HOME) {
    const homeTm = path.join(process.env.HOME, '.local', 'bin', 'tm');
    if (fs.existsSync(homeTm)) {
      return homeTm;
    }
  }

  return 'tm';
}

const TM_CMD = resolveTmCommand();

function execTm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(TM_CMD, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`tm exit code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to execute tm: ${err.message}`));
    });
  });
}

class TmMCPServer {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      await execTm(['--version']);
      console.error('tm CLI verified');
    } catch (err) {
      console.error('Warning: tm CLI not available:', err.message);
    }
    this.initialized = true;
  }

  handleRequest(request) {
    const { method, id, params } = request;
    if (!method) return null;
    if (method.startsWith('notifications/')) return null;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id);
      case 'tools/list':
        return this.handleToolsList(id);
      case 'tools/call':
        return this.handleToolsCall(id, params);
      default:
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  }

  handleInitialize(id) {
    this.initialized = true;
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'hyperpowers-tm',
          version: '1.0.0'
        }
      }
    };
  }

  handleToolsList(id) {
    const tools = [
      {
        name: 'tm_ready',
        description: 'Find available work (tm ready)',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'tm_show',
        description: 'View issue details (tm show <id>)',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Issue ID' } },
          required: ['id']
        }
      },
      {
        name: 'tm_list',
        description: 'List issues (tm list [--status <status>] [--parent <id>])',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Optional status filter' },
            parent: { type: 'string', description: 'Optional parent issue filter' }
          },
          required: []
        }
      },
      {
        name: 'tm_update',
        description: 'Update an issue (tm update <id> [--status <status>] [--priority <n>] [--design <text>])',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Issue ID' },
            status: { type: 'string', description: 'Optional new status' },
            priority: { type: 'integer', description: 'Optional new priority' },
            design: { type: 'string', description: 'Optional full design text' }
          },
          required: ['id']
        }
      },
      {
        name: 'tm_close',
        description: 'Close an issue (tm close <id>)',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Issue ID' } },
          required: ['id']
        }
      },
      {
        name: 'tm_create',
        description: 'Create an issue (tm create <title> [--type <type>] [--priority <n>] [--design <text>])',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Issue title' },
            type: { type: 'string', description: 'Optional issue type' },
            priority: { type: 'integer', description: 'Optional priority' },
            design: { type: 'string', description: 'Optional design text' }
          },
          required: ['title']
        }
      },
      {
        name: 'tm_dep_tree',
        description: 'Show dependency tree (tm dep tree <id>)',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Issue ID' } },
          required: ['id']
        }
      },
      {
        name: 'tm_sync',
        description: 'Run tm sync, including optional Linear sync if configured',
        inputSchema: { type: 'object', properties: {}, required: [] }
      }
    ];

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: { tools }
    };
  }

  async handleToolsCall(id, params) {
    const { name, arguments: args = {} } = params || {};

    if (!name) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32602, message: 'Missing required argument: name' }
      };
    }

    if (typeof args !== 'object' || args === null) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32602, message: 'Invalid arguments payload' }
      };
    }

    const needsId = ['tm_show', 'tm_update', 'tm_close', 'tm_dep_tree'].includes(name);
    if (needsId && (!args.id || typeof args.id !== 'string' || args.id.trim() === '')) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32602, message: 'Missing required argument: id' }
      };
    }

    if (name === 'tm_create' && (!args.title || typeof args.title !== 'string' || args.title.trim() === '')) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32602, message: 'Missing required argument: title' }
      };
    }

    try {
      let result;
      switch (name) {
        case 'tm_ready':
          result = await execTm(['ready']);
          break;
        case 'tm_show':
          result = await execTm(['show', args.id]);
          break;
        case 'tm_list': {
          const cliArgs = ['list'];
          if (args.status) cliArgs.push('--status', args.status);
          if (args.parent) cliArgs.push('--parent', args.parent);
          result = await execTm(cliArgs);
          break;
        }
        case 'tm_update': {
          const cliArgs = ['update', args.id];
          if (args.status) cliArgs.push('--status', args.status);
          if (args.priority !== undefined) cliArgs.push('--priority', String(args.priority));
          if (args.design) cliArgs.push('--design', args.design);
          result = await execTm(cliArgs);
          break;
        }
        case 'tm_close':
          result = await execTm(['close', args.id]);
          break;
        case 'tm_create': {
          const cliArgs = ['create', args.title];
          if (args.type) cliArgs.push('--type', args.type);
          if (args.priority !== undefined) cliArgs.push('--priority', String(args.priority));
          if (args.design) cliArgs.push('--design', args.design);
          result = await execTm(cliArgs);
          break;
        }
        case 'tm_dep_tree':
          result = await execTm(['dep', 'tree', args.id]);
          break;
        case 'tm_sync':
          result = await execTm(['sync']);
          break;
        default:
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32602, message: `Tool not found: ${name}` }
          };
      }

      const output = `${result.stdout || ''}${result.stderr || ''}`;
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [{ type: 'text', text: output }]
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          isError: true,
          content: [{ type: 'text', text: err.message }]
        }
      };
    }
  }
}

async function main() {
  const server = new TmMCPServer();
  await server.initialize();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await server.handleRequest(request);
      if (response) {
        console.log(JSON.stringify(response));
      }
    } catch (err) {
      console.error('Error handling request:', err.message);
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }));
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
