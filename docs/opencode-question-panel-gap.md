# OpenCode Question-Panel Creation Gap

This repository does **not** have a direct plugin API to create a question-panel request, but it can originate a real question-panel request **indirectly** by prompting a session with the built-in `question` tool enabled.

## What is available today

From the installed OpenCode SDK and plugin SDK in `.opencode/node_modules/`:

- `question.list`
- `question.reply`
- `question.reject`
- `session.prompt(...)` text injection
- limited TUI publishing for prompt append, command execute, toast, and session selection

## What is still missing directly

There is still **no direct plugin API to create a question-panel request**.

Examples of missing capability:

- no `question.create`
- no `question.ask`
- no `session.ask`
- no supported TUI publish payload for `question.asked`

## Supported repo-side workaround

Hyperpowers can create a real pending question request indirectly via:

1. discover the built-in `question` tool from `/experimental/tool`
2. submit `prompt_async` to a session with only `question` enabled
3. instruct the assistant to call the `question` tool with the desired payload
4. list pending questions from `/question`
5. correlate and reply via `/question/{requestID}/reply`

Implementation lives in:

- `.opencode/plugins/opencode-question-runtime.ts`

Covered by:

- `tests/opencode-question-runtime.test.ts`

## Why this originally blocked Hyperpowers

Epic `myhyperpowers-9qh` requires `/routing-settings` to launch a **real runtime interactive question/panel flow**.

The current skill system can only inject text into the session; by itself it cannot originate the structured panel request needed for the real wizard UX. The repo-side workaround above provides a way forward without a direct upstream create API.

## Tracking

- Blocking platform epic: `myhyperpowers-e22`
- Blocked feature epic: `myhyperpowers-9qh`

## Acceptable upstream/platform fixes

Any one of these would unblock implementation:

- `client.question.create(...)`
- `client.session.ask(...)`
- a documented plugin-safe way to publish `question.asked`

Until one of those exists, Hyperpowers should prefer the indirect helper route when a real question-panel request is needed from plugin code.
