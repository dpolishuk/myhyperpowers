---
name: hyperpowers-recall
description: Search long-term memory from previous sessions using memsearch
---

# Memory Recall

Search persistent memories from previous Claude Code and OpenCode sessions.

## How to use

Run `memsearch search` via the shell with the user's query:

```bash
memsearch search "<user's query>" --top-k 10
```

If the user didn't provide a specific query, search for recent work on the current project:

```bash
memsearch search "recent work on $(basename $(git rev-parse --show-toplevel 2>/dev/null || pwd))" --top-k 10
```

## Expanding results

If a result looks relevant and the user wants more detail, expand it:

```bash
memsearch expand <chunk_hash>
```

## Presenting results

- Show the results to the user in a clean format
- Highlight which sessions/dates the memories are from
- If no results found, say so and suggest memsearch may not be installed or indexed yet

## If memsearch is not installed

If `memsearch` command is not found, tell the user:

```
memsearch is not installed. Install it with:
  pip install memsearch[onnx]
  memsearch config init
```
