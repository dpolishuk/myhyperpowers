#!/usr/bin/env node
/**
 * MCP Server: bd (beads)
 * 
 * Integrates with the bd (beads) issue tracking system via Model Context Protocol.
 * This server provides bd command execution capabilities.
 */

const { spawn } = require('child_process');
const readline = require('readline');

const BD_CMD = 'bd';

/**
 * Execute a bd command and return output
 */
function execBd(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(BD_CMD, args, {
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
        resolve(stdout);
      } else {
        reject(new Error(`bd exit code ${code}: ${stderr || stdout}`));
      }
    });
    
    child.on('error', (err) => {
      reject(new Error(`Failed to execute bd: ${err.message}`));
    });
  });
}

/**
 * MCP Server implementation
 */
class BdMCPServer {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    // Verify bd is available
    try {
      await execBd(['--version']);
      console.error('bd CLI verified');
    } catch (err) {
      console.error('Warning: bd CLI not available:', err.message);
    }
    this.initialized = true;
  }

  handleRequest(request) {
    const { method, id, params } = request;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id, params);
      
      case 'tools/list':
        return this.handleToolsList(id);
      
      case 'tools/call':
        return this.handleToolsCall(id, params);
      
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  }

  handleInitialize(id, params) {
    this.initialized = true;
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'hyperpowers-bd',
          version: '1.0.0'
        }
      }
    };
  }

  handleToolsList(id) {
    const tools = [
      {
        name: 'bd_ready',
        description: 'Find available work (bd ready)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bd_show',
        description: 'View issue details (bd show <id>)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Issue ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'bd_update',
        description: 'Update issue status (bd update <id> --status <status>)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Issue ID' },
            status: { type: 'string', description: 'New status' }
          },
          required: ['id', 'status']
        }
      }
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: { tools }
    };
  }

  async handleToolsCall(id, params) {
    const { name, arguments: args } = params;
    
    try {
      let result;
      
      switch (name) {
        case 'bd_ready':
          result = await execBd(['ready']);
          break;
        
        case 'bd_show':
          if (!args?.id) {
            throw new Error('Missing required argument: id');
          }
          result = await execBd(['show', args.id]);
          break;
        
        case 'bd_update':
          if (!args?.id || !args?.status) {
            throw new Error('Missing required arguments: id and status');
          }
          result = await execBd(['update', args.id, '--status', args.status]);
          break;
        
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Tool not found: ${name}`
            }
          };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: result
            }
          ]
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message
        }
      };
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const server = new BdMCPServer();
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
      console.log(JSON.stringify(response));
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
