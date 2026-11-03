---
name: helm
description: Use when starting or resuming a software project with the product kit: set it up (kit_init), recover after a stop, continue the next step, decide whether to spawn helper agents, land work, run a milestone QA pass.
---

1. No `.agents/product-kit` folder? Ask for a name and brief, call `kit_init`.
2. Stopped in the middle, or a new session? `kit_run recover`, then `kit_run continue`, and do what it prints. The order of work is the active milestone.
3. Before coding a step, decide alone or helpers. Read `agent_policy`. If a parallel researcher, tester, debugger or reviewer is worth the cost, call `agent_spawn` with a role, a concrete task and a real reason, then `agent_wait` and `agent_land`. You decide; the runtime creates and runs the agent and enforces the limits.
4. Leave a note before you stop: `kit_run note <ID> --doing ... --next ...`.
5. Founder decisions and acknowledgements are never yours to record; the founder does it in a terminal with their own words.
6. Where you start decides the first move. `kit_scan` shows the stage. Empty folder: `kit_init`, then `kit_consult` kind "build". Existing or half-built project: `kit_adopt` (needs a clean git tree; it works on branch kit/integration and never edits the code). Kit already installed: `kit_run` recover.
7. Changing an existing product, or asked for a feature, a fix, a comparison or research? Do not start coding. `kit_scan`, then `kit_guard` baseline so "nothing broke" can be shown, then `kit_consult` open.
8. Interview only when an answer changes the recommendation: at most 3 questions per round, each with what the answer changes; ask, then stop and wait. Otherwise state your assumption and go on.
9. Grade every claim: Verified (checked this session, with a source), Stable, Inference, Unknown. Anything current (prices, versions, APIs, laws, a competitor's features) is looked up with web search or a researcher helper; if you cannot look it up, it is Unknown, not remembered.
10. At least two options (doing nothing counts), the risk of each to what already works, then a recommendation with the strongest counterargument to it, a verdict, and what would change it. Do not plan or build until the founder agrees; they record it in a terminal (`consult agree`), you cannot.
11. After agreement `kit_consult` plan puts the steps in the roadmap (new milestone or an existing one; it adds the guard check to every exit). Build step by step. After each step `kit_guard` check; with several parts, a full check, not `only`. REGRESSION means stop: fix or undo first. Report each refinement with `kit_consult` round; the server decides CONTINUE, DONE or STOP, and a STOP at the round limit is reported as unfinished, never as done.
12. After each milestone run `kit_state` to refresh docs/STATE.md (parts such as frontend and backend, checks, last guard result, roadmap progress) and commit it.
