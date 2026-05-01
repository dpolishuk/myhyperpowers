#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    rulesPath: path.join(__dirname, '..', 'skill-rules.json'),
    maxSkills: 3,  // Limit to top 3 to avoid context overload
    debugMode: process.env.DEBUG_HOOKS === 'true'
};

// Load skill rules from skill-rules.json
function loadRules() {
    try {
        const content = fs.readFileSync(CONFIG.rulesPath, 'utf8');
        const data = JSON.parse(content);
        // Filter out _comment and _schema meta keys
        const rules = {};
        for (const [key, value] of Object.entries(data)) {
            if (!key.startsWith('_')) {
                rules[key] = value;
            }
        }
        return rules;
    } catch (error) {
        if (CONFIG.debugMode) {
            console.error('Failed to load skill rules:', error.message);
        }
        return {};
    }
}

// Read prompt from stdin (Claude passes { "text": "..." })
function readPrompt() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (error) {
                if (CONFIG.debugMode) {
                    console.error('Failed to parse prompt:', error.message);
                }
                resolve({ text: '' });
            }
        });
    });
}

// Analyze prompt for skill matches
function analyzePrompt(promptText, rules) {
    const lowerText = promptText.toLowerCase();
    const activated = [];

    for (const [skillName, config] of Object.entries(rules)) {
        let matched = false;
        let matchReason = '';

        // Check keyword triggers (case-insensitive substring matching)
        if (config.promptTriggers?.keywords) {
            for (const keyword of config.promptTriggers.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    matched = true;
                    matchReason = `keyword: "${keyword}"`;
                    break;
                }
            }
        }

        // Check intent pattern triggers (regex matching)
        if (!matched && config.promptTriggers?.intentPatterns) {
            for (const pattern of config.promptTriggers.intentPatterns) {
                try {
                    if (new RegExp(pattern, 'i').test(promptText)) {
                        matched = true;
                        matchReason = `intent pattern: "${pattern}"`;
                        break;
                    }
                } catch (error) {
                    if (CONFIG.debugMode) {
                        console.error(`Invalid pattern "${pattern}":`, error.message);
                    }
                }
            }
        }

        if (matched) {
            activated.push({
                skill: skillName,
                priority: config.priority || 'medium',
                reason: matchReason,
                type: config.type || 'workflow'
            });
        }
    }

    // Sort by priority (critical > high > medium > low)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    activated.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        // Secondary sort: process types before domain/workflow types
        const typeOrder = { process: 0, domain: 1, workflow: 2 };
        return (typeOrder[a.type] || 2) - (typeOrder[b.type] || 2);
    });

    // Limit to max skills
    return activated.slice(0, CONFIG.maxSkills);
}

// Generate activation context message
function generateContext(skills) {
    if (skills.length === 0) {
        return null;
    }

    const hasSkills = skills.some(s => s.type !== 'agent');
    const hasAgents = skills.some(s => s.type === 'agent');

    const lines = [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🎯 SKILL/AGENT ACTIVATION CHECK',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ''
    ];

    // Display skills
    const skillItems = skills.filter(s => s.type !== 'agent');
    if (skillItems.length > 0) {
        lines.push('Relevant skills for this prompt:');
        lines.push('');
        for (const skill of skillItems) {
            const emoji = skill.priority === 'critical' ? '🔴' :
                         skill.priority === 'high' ? '⭐' :
                         skill.priority === 'medium' ? '📌' : '💡';
            lines.push(`${emoji} **${skill.skill}** (${skill.priority} priority, ${skill.type})`);

            if (CONFIG.debugMode) {
                lines.push(`   Matched: ${skill.reason}`);
            }
        }
        lines.push('');
    }

    // Display agents
    const agentItems = skills.filter(s => s.type === 'agent');
    if (agentItems.length > 0) {
        lines.push('Relevant agents for this prompt:');
        lines.push('');
        for (const agent of agentItems) {
            const emoji = agent.priority === 'critical' ? '🔴' :
                         agent.priority === 'high' ? '⭐' :
                         agent.priority === 'medium' ? '💾' : '🤖';
            lines.push(`${emoji} **xpowers:${agent.skill}** (${agent.priority} priority)`);

            if (CONFIG.debugMode) {
                lines.push(`   Matched: ${agent.reason}`);
            }
        }
        lines.push('');
    }

    // Activation instructions
    if (hasSkills) {
        lines.push('Use the Skill tool for skills: `Skill command="xpowers:<skill-name>"`');
    }
    if (hasAgents) {
        lines.push('Use the Task tool for agents: `Task(subagent_type="xpowers:<agent-name>", ...)`');
        lines.push('Example: `Task(subagent_type="xpowers:test-runner", prompt="Run: git commit...", ...)`');
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    return lines.join('\n');
}

// Main execution
async function main() {
    try {
        // Load rules
        const rules = loadRules();

        if (Object.keys(rules).length === 0) {
            if (CONFIG.debugMode) {
                console.error('No rules loaded');
            }
            console.log(JSON.stringify({}));
            return;
        }

        // Read prompt
        const prompt = await readPrompt();

        if (!prompt.text || prompt.text.trim() === '') {
            console.log(JSON.stringify({}));
            return;
        }

        // Analyze prompt
        const activatedSkills = analyzePrompt(prompt.text, rules);

        // Generate response
        if (activatedSkills.length > 0) {
            const context = generateContext(activatedSkills);

            if (CONFIG.debugMode) {
                console.error('Activated skills:', activatedSkills.map(s => s.skill).join(', '));
            }

            console.log(JSON.stringify({
                additionalContext: context
            }));
        } else {
            if (CONFIG.debugMode) {
                console.error('No skills activated');
            }
            console.log(JSON.stringify({}));
        }
    } catch (error) {
        if (CONFIG.debugMode) {
            console.error('Hook error:', error.message, error.stack);
        }
        // Always return empty response on error - never block user
        console.log(JSON.stringify({}));
    }
}

main();
