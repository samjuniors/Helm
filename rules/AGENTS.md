# Helm Rules

When working in a project that uses the Helm product kit (`.agents/product-kit/`):

- **Order of work**: Run `node .agents/product-kit/kit.mjs continue` or use the `kit_run` tool with `continue` to determine the next step. Work milestone by milestone.
- **Recovery**: If resuming an interrupted session, starting on a new project, or if work stopped unexpectedly, run `kit_run` with `recover` (or `node .agents/product-kit/kit.mjs recover`) first.
- **Helper Agents**: Before building a step, decide whether to work alone or spawn a helper agent (researcher, tester, debugger, reviewer). Use the `agent_spawn`, `agent_wait`, and `agent_land` tools where appropriate.
- **Audit trail**: Always record progress before stopping using `kit_run note <ID> --doing "..." --next "..."`.
- **Founder authority**: Never fabricate or execute founder-only commands (`ack`, `decide`, `milestone close`) on your own; prompt the founder to execute them directly in their terminal.
