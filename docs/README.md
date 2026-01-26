# OpenCode Configuration Examples

This directory contains example `opencode.json` configurations for different model providers.

## Available Examples

### `opencode.example.inherit.json`
**Recommended starting point.** All agents inherit your chosen model.

- Simplest configuration
- Just set the `model` field at the top level
- All agents use `model: inherit` by default
- Add agent-specific overrides only if needed

### `opencode.example.anthropic.json`
Anthropic Claude models with optimized agent assignments:

- **Main model:** Sonnet 4.5 (balanced speed/capability)
- **Fast agents** (test-runner, investigator, researcher): Haiku 4.5
- **Capable agents** (code-reviewer, test-analyst): Sonnet 4.5

### `opencode.example.glm.json`
GLM models with optimized agent assignments:

- **Main model:** GLM-4.7 (capable)
- **Fast agents** (test-runner, investigator, researcher): GLM-4.5
- **Capable agents** (code-reviewer, test-analyst): GLM-4.7

## How to Use

1. **Copy** the example that matches your provider:

```bash
cp docs/opencode.example.anthropic.json opencode.json
# or
cp docs/opencode.example.glm.json opencode.json
```

2. **Edit** the `model` field to use your preferred model IDs

3. **Customize** agent overrides if you want different models for specific agents

## Model Recommendations

| Agent Type | Recommended Models |
|------------|-------------------|
| **Fast agents** (test-runner, codebase-investigator, internet-researcher) | Haiku 4.5, GLM-4.5, or similar fast models |
| **Capable agents** (code-reviewer, test-effectiveness-analyst) | Sonnet 4.5, GLM-4.7, Opus 4, or similar capable models |

## Environment Variables

These examples reference the following environment variables:

- `PERPLEXITY_API_KEY` - For Perplexity MCP server (optional, remove if not using)
- `CONTEXT7_API_KEY` - For Context7 documentation server (optional, remove if not using)

Set these in your shell or project `.env` file before running OpenCode.

## See Also

- [OpenCode Models Documentation](https://opencode.ai/docs/models/)
- [OpenCode Configuration Reference](https://opencode.ai/docs/config/)
