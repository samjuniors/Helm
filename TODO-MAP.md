# Todo map: from nothing to your first milestone

Tick these in order. Everything marked **you** is a thing only you can do (decisions, approvals); the agent does the rest.

## A. Install the plugin once (about 10 minutes)
- [ ] **you** Check you have Node 18+ and git: `node -v`, `git --version`.
- [ ] **you** Put this folder somewhere permanent, for example `C:\tools\product-kit-plugin` or `~/tools/product-kit-plugin`.
- [ ] **you** Connect it: from this folder run **`node install.mjs`**. It first proves the server starts on your computer, then registers it with Claude Code and Codex (whichever is installed; use `--host claude` or `--host codex` for one, `--dry-run` to only see the commands). For the other tools, or if you prefer to do it by hand, run `node bin/helm.mjs print-config` and use the snippet for your tool:
  - Claude Code, full plugin (tools + session hook + `/kit-init`, `/kit-recover`, `/kit-continue` + helper sub-agents): add this folder as a local marketplace and install `helm` (see README, "Claude Code"). Or only the tools: `claude mcp add helm -- node <path>/server/mcp.mjs`.
  - Codex, VS Code, Cursor: paste the printed MCP snippet into that tool's MCP settings.
- [ ] After step C2 the project already contains the registration for Claude Code (`.mcp.json`), Codex (`.codex/config.toml`) and Antigravity (`.agents/mcp_config.json`). Claude Code asks you to approve a project `.mcp.json` once; Codex needs the project marked trusted; Antigravity needs its MCP list refreshed.
- [ ] **you** Restart the tool. Ask it: "list your helm tools". You should see nine: `kit_init`, `kit_run`, `kit_roadmap_add`, `agent_policy`, `agent_spawn`, `agent_status`, `agent_wait`, `agent_land`, `agent_cancel`.

## B. Let the runtime start helper agents (optional, 5 minutes)
- [ ] **you** In a terminal, check your agent CLI works headless: `claude -p "say hi"` (or `codex exec "say hi"`). If it does not, skip this section: the agent can still hand you cards for parallel chats.
- [ ] After step C2 you will have `kit.config.json` in the project. Under `orchestrator.agent` choose `{"preset": "claude"}` or `{"preset": "codex"}`, or give your own `command`, `args` and `promptVia` (`stdin` or `arg`). Presets are NOT VERIFIED against current CLI versions.
- [ ] Decide `approval`: `"auto"` (the model starts helpers within the limits) or `"ask"` (the model proposes; you approve each in a terminal with `helm approve <runId>`). Start with `"ask"` until you trust it.

## C. Start a new product (30 minutes of your time)
- [ ] **C1** Create an empty folder for the product, open it in your IDE, and `git init` (the agent can do this).
- [ ] **C2** Tell the agent: *"Set up the product kit for <Product name>. Brief: <2 to 4 sentences: what it is, who it is for, the one job it must do>."* It calls `kit_init`.
- [ ] **C3** Read `.agents/product-kit/VISION.md` with the agent and fill the empty sections. Edit anything wrong. This file is the product's constitution.
- [ ] **C4** **you** In a terminal, in the product folder, record your decisions in your own words:
  - `helm decide G0.1 --quote "<who it is for, the one job, what is out>"`
  - `helm decide G0.2 --quote "<stack, hosting, data store, monthly budget>"`
  - `helm ack GIT-SYNC --quote "<your words authorizing the agent to push and merge through the kit>"`
- [ ] **C5** Tell the agent: *"continue."* It runs `continue` and does what it prints, starting with milestone M0 (foundation).
- [ ] **C6** M0 steps G1.1 to G1.4: one test command, CI, secret hygiene, a setup guide. When G1.2 lands, ask the agent to run `ci check` and turn CI waiting on.
- [ ] **C7** When M0 is done the agent runs the QA pass and gives you a test script. **you** run it. If it works: `helm milestone close M0 --quote "<what you saw>"`, then tell the agent to `milestone ship M0`.
- [ ] **C8** Milestone M1: tell the agent *"turn the first release in VISION.md into 3 to 6 steps"*. It uses `kit_roadmap_add`. **you** read the list and confirm.
- [ ] **C9** Say *"continue"* until M1 is done; repeat C7 for M1. Add milestones by editing `milestones.json` (or asking the agent), then `render` and `validate`.

## D. Daily loop
- [ ] Open the project. Say **"recover"** (the Claude Code hook does it for you). Then **"continue"**.
- [ ] Before you stop or switch computers: say **"checkpoint all"** and wait for "pushed".
- [ ] On another computer: clone, `git switch kit/integration`, say **"recover"**, then **"reconcile"** if it says NEW COMPUTER.

## E. How helpers get started (what the model decides, what the runtime does)
1. Before coding a step, the model writes in the handoff: alone or helpers, and why.
2. If helpers are worth it, the model calls `agent_policy` (to see limits) and `agent_spawn` with a role, a concrete task and a reason.
3. The runtime checks the rules, creates the helper's own worktree, starts the configured agent there with the role card, logs everything, and kills it at the timeout.
4. The model calls `agent_wait` and `agent_status`, then `agent_land`: the runtime checkpoints the helper's work (secret scan), checks it touched only its role's files and wrote its report, and merges.
5. Every spawn and its reason are in the journal; `recover` shows them.

## H. See that it is working
- [ ] Open a second terminal and run `node bin/helm.mjs watch --path <your project>`; leave it running while you work.
- [ ] In your tool, check the server is listed: Claude Code `/mcp`, Codex `codex mcp list`, Antigravity Settings > Customizations > Installed MCP Servers.
- [ ] Ask the agent: "call agent_policy". Later, when it spawns a helper, the `watch` window shows the run, its status and its log.

## F. When something goes wrong
| Symptom | Do this |
|---|---|
| Agent says "no kit" | Check the folder; run C2 |
| `agent_spawn` says no agent command | Section B |
| A helper never finishes | `agent_status`, then `agent_cancel`; the timeout also kills it |
| `agent_land` says out of scope | The helper edited files outside its role; ask it to undo them, or do that part yourself |
| CI red after a landing | The kit stops landing; fix on a small branch (PROTOCOL.md section 11) |
| Lost where you were | `recover` |
| Tools missing in the IDE | Restart it; run `node server/mcp.mjs` by hand: it should wait silently (Ctrl+C) |

## G. Safety, in plain words
- A spawned agent runs with **your** permissions on your computer. Its worktree is not a sandbox. The kit checks its scope only for files inside the repository, and cannot stop it from running other commands. Use `"approval": "ask"` and read what it was asked to do until you trust the setup.
- Limits keep it bounded: concurrent runs, runs per step, runs per day, a timeout, and no spawning from inside a spawned agent.
- The tools can never record your decisions, acknowledgements or milestone acceptance. Only you can, in a terminal.
