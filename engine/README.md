# Product kit

A resumable, milestone-by-milestone work system so AI agents can build {{PROJECT}} from a founder's brief to a tested product, several agents at a time, without losing their place when a session ends or the computer changes.

**One prompt starts or resumes everything:** paste `MASTER_PROMPT.md` into your coding agent (or let the plugin's MCP tools do it). The order of work is the milestones in `MILESTONES.md`; the agent finds it with `continue`. Gates are bookkeeping groups of steps, never an order.

| File | What it is |
|---|---|
| `VISION.md` | What is being built, for whom, and the founder's rules. Written first |
| `MASTER_PROMPT.md` | The only prompt |
| `PROTOCOL.md` | How agents claim, build, verify, land, QA, recover and delegate |
| `QUALITY_BAR.md` | The checklist every step is held to |
| `LAYOUT.md` | Where every kind of file goes |
| `CAPABILITIES.md` | How agents may add tools |
| `gates.json`, `milestones.json` | The roadmap. Edit these (or use `kit_roadmap_add`), then `render` |
| `GATES.md`, `MILESTONES.md` | Generated views of the roadmap |
| `kit.config.json` | Local settings: branches, checks, CI, size limits, layout, orchestrator |
| `kit.mjs` | The tool. `node .agents/product-kit/kit.mjs` lists every command |

Daily loop: say **recover** (or let the hook), then **continue**. Before leaving a computer: `checkpoint --all`.
