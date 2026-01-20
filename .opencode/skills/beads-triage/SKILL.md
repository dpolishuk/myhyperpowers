---
name: beads-triage
description: Use to run bv --robot-triage and return raw JSON for bd graph analysis
allowed-tools:
  - bash
---

# beads-triage

Run `bv --robot-triage` directly and return raw JSON only. This skill is for non-interactive triage output suitable for piping or programmatic parsing.

## Behavior

1. Check if `bv` is installed. If not, install it using the official script:

```bash
curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/beads_viewer/main/install.sh?$(date +%s)" | bash
```

2. Run `bv --robot-triage` with optional arguments passed through verbatim:

```bash
bv --robot-triage $ARGUMENTS
```

## Output Requirements

- Return the raw JSON output from `bv --robot-triage` only.
- Do not summarize or add extra prose.
- Never run bare `bv` (must always use `--robot-triage`).

## Edge Cases

- If install fails, surface the error output and stop.
- If `bv --robot-triage` exits non-zero, return its error output unchanged.
