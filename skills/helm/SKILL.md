---
name: helm
description: Use when starting or resuming a software project with the product kit: set it up (kit_init), recover after a stop, continue the next step, decide whether to spawn helper agents, land work, run a milestone QA pass.
---

1. No `.agents/product-kit` folder? Ask for a name and brief, call `kit_init`.
2. Stopped in the middle, or a new session? `kit_run recover`, then `kit_run continue`, and do what it prints. The order of work is the active milestone.
3. Before coding a step, decide alone or helpers. Read `agent_policy`. If a parallel researcher, tester, debugger or reviewer is worth the cost, call `agent_spawn` with a role, a concrete task and a real reason, then `agent_wait` and `agent_land`. You decide; the runtime creates and runs the agent and enforces the limits.
4. Leave a note before you stop: `kit_run note <ID> --doing ... --next ...`.
5. Founder decisions and acknowledgements are never yours to record; the founder does it in a terminal with their own words.
