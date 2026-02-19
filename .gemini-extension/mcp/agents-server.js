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

const EXTENSION_AGENTS_DIR = path.join(__dirname, '..', 'agents');
const WORKSPACE_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');
const DEFAULT_AGENTS_DIRS = [EXTENSION_AGENTS_DIR, WORKSPACE_AGENTS_DIR];

/**
 * Resolve a readable agent directory path.
 */
async function resolveDirectory(p) {
  try {
    const resolved = path.resolve(p);
    const stats = await fs.stat(resolved);
    return stats.isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

/**
 * Return list of directories to scan for agents.
 */
async function discoverAgentDirectories() {
  const candidateDirs = [
    ...(process.env.AGENTS_PATH ? [process.env.AGENTS_PATH] : []),
    ...DEFAULT_AGENTS_DIRS
  ];

  const resolved = [];
  const seen = new Set();
  for (const dir of candidateDirs) {
    const normalized = path.resolve(dir);
    if (seen.has(normalized)) {
      continue;
    }

    const valid = await resolveDirectory(normalized);
    if (valid) {
      resolved.push(normalized);
      seen.add(normalized);
    }
  }

  return resolved;
}

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
  const directories = await discoverAgentDirectories();

  for (const agentsDir of directories) {
    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
          const fullPath = path.join(agentsDir, entry.name);
          const content = await fs.readFile(fullPath, 'utf-8');
          const frontmatter = parseFrontmatter(content);
          
          if (frontmatter && frontmatter.name) {
            const exists = agents.find(a => a.name === frontmatter.name);
            if (!exists) {
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
      }
    } catch {
      // Directory is optional
    }
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
    if (!method) {
      return null;
    }

    if (method.startsWith('notifications/')) {
      return null;
    }

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
          id: id ?? null,
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
      id: id ?? null,
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
      id: id ?? null,
      result: { tools }
    };
  }

  handleToolsCall(id, params) {
    const { name } = params || {};
    const agent = this.agents.find(a => a.toolName === name);
    
    if (!agent) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32602,
          message: `Tool not found: ${name}`
        }
      };
    }

    return {
      jsonrpc: '2.0',
      id: id ?? null,
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
