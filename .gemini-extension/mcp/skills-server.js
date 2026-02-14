#!/usr/bin/env node
/**
 * MCP Server: Skills
 * 
 * Exposes hyperpowers skills as Gemini CLI tools via Model Context Protocol.
 * This server scans the skills/ directory and provides tools for each SKILL.md file.
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

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
 * Generate MCP tool name from skill path
 */
function generateToolName(skillPath) {
  // skillPath is the directory name (e.g., "brainstorming" or "common-patterns/bd-commands")
  const parts = skillPath.split(/[\/\\]/).filter(p => p && p !== '.' && p !== 'skills');
  const name = parts.join('_').replace(/-/g, '_');
  return 'skills_' + name;
}

/**
 * Discover all skills in the skills directory
 */
async function discoverSkills() {
  const skills = [];
  
  async function scanDir(dir, relativePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Check for SKILL.md in this directory
          const skillFile = path.join(fullPath, 'SKILL.md');
          try {
            await fs.access(skillFile);
            // Found a skill
            const content = await fs.readFile(skillFile, 'utf-8');
            const frontmatter = parseFrontmatter(content);
            
            if (frontmatter && frontmatter.name && frontmatter.description) {
              skills.push({
                name: frontmatter.name,
                description: frontmatter.description,
                toolName: generateToolName(relPath),
                content: content,
                path: skillFile
              });
            }
          } catch {
            // No SKILL.md, scan subdirectory
            await scanDir(fullPath, relPath);
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning ${dir}:`, err.message);
    }
  }
  
  await scanDir(SKILLS_DIR);
  return skills;
}

/**
 * MCP Server implementation
 */
class SkillsMCPServer {
  constructor() {
    this.skills = [];
    this.initialized = false;
  }

  async initialize() {
    this.skills = await discoverSkills();
    console.error(`Discovered ${this.skills.length} skills`);
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
          name: 'hyperpowers-skills',
          version: '1.0.0'
        }
      }
    };
  }

  handleToolsList(id) {
    const tools = this.skills.map(skill => ({
      name: skill.toolName,
      description: skill.description,
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
    const skill = this.skills.find(s => s.toolName === name);
    
    if (!skill) {
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
            text: skill.content
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
  const server = new SkillsMCPServer();
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
