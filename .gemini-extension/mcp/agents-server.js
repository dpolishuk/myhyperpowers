#!/usr/bin/env node
/**
 * MCP Server: Agents
 * 
 * Exposes specialized agents as Gemini CLI sub-agents via Model Context Protocol.
 * This server provides agent definitions from the agents/ directory.
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const frontmatter = {};
  const lines = match[1].split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }
  
  return frontmatter;
}

/**
 * Discover all agents in the agents directory
 */
async function discoverAgents() {
  const agents = [];
  
  try {
    const entries = await fs.readdir(AGENTS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        const fullPath = path.join(AGENTS_DIR, entry.name);
        const content = await fs.readFile(fullPath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        
        if (frontmatter && frontmatter.name) {
          agents.push({
            name: frontmatter.name,
            description: frontmatter.description || `Agent: ${frontmatter.name}`,
            toolName: 'agent_' + frontmatter.name.replace(/-/g, '_'),
            content: content,
            path: fullPath
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning agents directory: ${err.message}`);
  }
  
  return agents;
}

/**
 * MCP Server implementation
 */
class AgentsMCPServer {
  constructor() {
    this.agents = [];
    this.initialized = false;
  }

  async initialize() {
    this.agents = await discoverAgents();
    console.error(`Discovered ${this.agents.length} agents`);
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
          name: 'hyperpowers-agents',
          version: '1.0.0'
        }
      }
    };
  }

  handleToolsList(id) {
    const tools = this.agents.map(agent => ({
      name: agent.toolName,
      description: agent.description,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }));

    return {
      jsonrpc: '2.0',
      id,
      result: { tools }
    };
  }

  handleToolsCall(id, params) {
    const { name } = params;
    const agent = this.agents.find(a => a.toolName === name);
    
    if (!agent) {
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
            text: agent.content
          }
        ]
      }
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  const server = new AgentsMCPServer();
  await server.initialize();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      const response = server.handleRequest(request);
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
