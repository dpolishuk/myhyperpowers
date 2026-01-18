---
description: Execute plan in batches with review checkpoints
---

Use the skills_hyperpowers_executing-plans skill exactly as written.

**Resumption:** This command supports explicit resumption. Run it multiple times to continue execution:

1. First run: Executes first ready task → STOP
2. User reviews implementation, clears context
3. Next run: Resumes from bd state, executes next task → STOP
4. Repeat until epic complete

**Checkpoints:** Each task execution ends with a STOP checkpoint. User must run this command again to continue.
