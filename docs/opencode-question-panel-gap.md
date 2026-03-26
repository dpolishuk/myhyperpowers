# OpenCode Question-Panel Creation Gap

This repository currently cannot implement a **real runtime question-panel wizard** for `/routing-settings` using the installed OpenCode plugin/runtime APIs.

## What is available today

From the installed OpenCode SDK and plugin SDK in `.opencode/node_modules/`:

- `question.list`
- `question.reply`
- `question.reject`
- `session.prompt(...)` text injection
- limited TUI publishing for prompt append, command execute, toast, and session selection

## What is missing

There is **no plugin API to create a question-panel request**.

Examples of missing capability:

- no `question.create`
- no `question.ask`
- no `session.ask`
- no supported TUI publish payload for `question.asked`

## Why this blocks Hyperpowers

Epic `myhyperpowers-9qh` requires `/routing-settings` to launch a **real runtime interactive question/panel flow**.

The current skill system can only inject text into the session; it cannot originate the structured panel request needed for the real wizard UX.

## Tracking

- Blocking platform epic: `myhyperpowers-e22`
- Blocked feature epic: `myhyperpowers-9qh`

## Acceptable upstream/platform fixes

Any one of these would unblock implementation:

- `client.question.create(...)`
- `client.session.ask(...)`
- a documented plugin-safe way to publish `question.asked`

Until one of those exists, Hyperpowers can only provide:

- documented guided flows
- CLI fallback flows
- honest runtime limitation messaging
