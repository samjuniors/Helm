# helm plugin

Turn any new software project into a milestone roadmap an AI agent can drive, with tests, CI, QA, recovery after any stop, and an orchestration runtime where **the model decides when and why to start helper agents and the runtime creates and runs them**.

It is the SamjuniorsOS kit (v4 plus a fix) made generic: the engine is the same, the roadmap is a blank template filled from your brief.

## What is inside
| Folder | What |
|---|---|
| `server/mcp.mjs` | MCP server (stdio, no dependencies): 9 tools |
| `server/runtime.mjs`, `server/runner.mjs` | Scaffolding, safe command runner, orchestration runtime, the detached process that runs each helper |
| `engine/` | The kit that `kit_init` copies into a project (`.agents/product-kit/`): tool, protocol, quality bar, layout, roadmap template |
| `bin/helm.mjs` | Command line: `init`, `print-config`, `watch`, `runs`, `approve`, `cancel`, and the founder-only `ack`, `decide`, `milestone close` |
| `.claude-plugin/`, `.mcp.json`, `hooks/`, `commands/`, `agents/`, `skills/` | The Claude Code plugin wrapper |
| `tests/e2e.mjs` | 46 checks through the official MCP SDK client |
| `TODO-MAP.md` | Start here |

## The tools
| Tool | Purpose |
|---|---|
| `kit_init` | Create the kit in a project from a name and a brief |
| `kit_run` | Run an allowed kit command (`recover`, `continue`, `claim`, `done`, `land`, `qa`, `note`, ...). Never `ack`, `decide` or `milestone close` |
| `kit_roadmap_add` | Add validated steps to a milestone; undoes itself if the roadmap would break |
| `agent_policy` | Limits, configuration and past runs. Read before spawning |
| `agent_spawn` | The model asks for a helper with a role, task and reason; the runtime validates, creates the worktree and starts the agent |
| `agent_status`, `agent_wait` | Watch a run (log tail included) |
| `agent_land` | Check scope and report, then merge a finished helper into its step |
| `agent_cancel` | Stop a running helper |

## How the split works
The model decides: alone or helpers, which role, what task, why. The runtime decides nothing about the work; it enforces rules and does the doing: refuses a missing reason, an unclaimed step, a disallowed role, a run over the limits (`maxConcurrent`, `maxPerStep`, `maxPerDay`), or a spawn from inside a spawned agent; creates an isolated git worktree and branch; starts the configured agent command there with the role card on stdin; logs; kills at `timeoutMinutes`; and refuses to merge a run that failed, timed out, edited outside its role's files, or wrote no report. `"approval": "ask"` turns every spawn into a proposal only you can approve.

Configure in `.agents/product-kit/kit.config.json`:
```json
"orchestrator": {
  "approval": "ask",
  "maxConcurrent": 2, "maxPerStep": 3, "maxPerDay": 12, "timeoutMinutes": 30,
  "roles": ["researcher", "tester", "debugger", "reviewer", "implementer"],
  "agent": { "preset": "claude" }
}
```
or `"agent": { "command": "codex", "args": ["exec", "-"], "promptVia": "stdin" }`, or the `KIT_AGENT_CMD` environment variable as JSON.

## Install
- **One command:** `node install.mjs` (self-test, then `claude mcp add` and `codex mcp add` for the tools it finds). The two commands are the documented ones for those tools; the installer itself was tested here against stand-in `claude` and `codex` programs, not the real ones.
- **Any MCP tool:** `node bin/helm.mjs print-config [--host claude|codex|vscode|cursor]`, paste the snippet, restart.
- **Claude Code, as a plugin:** this folder is also a one-plugin marketplace (`.claude-plugin/marketplace.json`). In Claude Code: `/plugin marketplace add <path to this folder>` then `/plugin install helm@helm-local`. This adds the tools, a `SessionStart` hook that runs `recover`, the commands `/kit-init`, `/kit-recover`, `/kit-continue`, and helper sub-agents `kit-researcher`, `kit-tester`, `kit-debugger`, `kit-reviewer`.
- **CLI only:** `node bin/helm.mjs init <folder> --name "My App" --brief "..."`, or `npm link` here and use `helm`.

## Which tools it works in
`kit_init` (or `adapt` in any project that has the kit) wires all of these in one go: an `AGENTS.md` block that tells every agent to run `recover` first, `CLAUDE.md` and `GEMINI.md` that import `AGENTS.md`, and the MCP server registered in each tool's project file (merged into existing files, never replaced).

| Tool | Reads the rules from | MCP tools via | Recovers at session start | Helper agents |
|---|---|---|---|---|
| Claude Code (CLI, desktop) | `CLAUDE.md` (it does **not** read `AGENTS.md`; the import line fixes that) | project `.mcp.json`, or `claude mcp add`, or the plugin | hook in `.claude/settings.json` (SessionStart) | `.claude/agents/kit-*.md`, or this runtime with `claude -p` |
| Codex (CLI, desktop app, IDE extension) | `AGENTS.md` | `config.toml`, shared by all three; project `.codex/config.toml` only for **trusted** projects | no hook: the `AGENTS.md` rule tells it to run `recover` first | this runtime with `codex exec` |
| Antigravity (app, `agy` CLI) | `AGENTS.md` and `GEMINI.md` | `.agents/mcp_config.json` (or the user-level `~/.gemini/antigravity/mcp_config.json`) | no hook: the `AGENTS.md` rule | `.agents/agents/kit-*.md` (its own sub-agents); this runtime only with a custom command |

What works the same everywhere: `kit.mjs` (any agent that can run a shell command), the MCP server, and the `AGENTS.md` rule. What differs is the glue. Where a tool has no start-up hook, "run recover first" depends on the model following the rule, so a session that ignores it must be told "recover".

Evidence: Codex MCP and AGENTS.md behaviour is from OpenAI's Codex docs; the Claude Code `CLAUDE.md` behaviour, the Antigravity file locations and the headless flags are from third-party documentation and from the ORBIT plugin's installer, not from the vendors' own pages. None of it has been run in the real tools by me.

## Rename it
`node rename.mjs --name my-name` (lowercase letters, digits, dashes). It changes the name your tools show, the MCP server key, the Claude Code plugin and marketplace names, the command-line tool (`bin/my-name.mjs`), and the name that new projects register. It leaves alone the `.agents/product-kit` folder inside your projects, the tool names (`kit_init`, `agent_spawn`, ...) and this folder's name. Afterwards remove the old registration (`claude mcp remove helm`, `codex mcp remove helm`) and run `node install.mjs` again. `--dry-run` shows what would change. The whole 46-check suite passes on a renamed copy. To register under a different name without renaming any file: `node install.mjs --name my-name`.

## Antigravity (app and IDE)
Everything below follows the ORBIT plugin's own instructions for Antigravity 2.0 Desktop plus third-party documentation; I could not run Antigravity, and I do not know whether the IDE and the agent app differ.
1. Keep this folder on a permanent path (for example on your SSD).
2. In the project: for a **new** project run `node bin/helm.mjs init . --name "My App" --brief "..."` (this also writes the Antigravity files). For a project that already has the kit run `node .agents/product-kit/kit.mjs adapt --host antigravity --mcp "<full path>\server\mcp.mjs"`. These write `GEMINI.md`, `.agents/mcp_config.json` (merged with anything already there, such as ORBIT) and the sub-agents `.agents/agents/kit-*.md`.
3. Reopen the project in Antigravity (or reload the app).
4. Open **Settings > Customizations > Installed MCP Servers**, refresh, and look for `helm` with nine tools. The sub-agents `kit-researcher`, `kit-tester`, `kit-debugger` and `kit-reviewer` should appear in the agent selector. If nothing appears, restart the app; ORBIT's README says to confirm that the workspace `.agents/mcp_config.json` is loaded.
5. Ask the agent: "call agent_policy". It should answer with the limits and the run list.

## See it working
- **The tool's own list:** Claude Code `/mcp`; Codex `codex mcp list`; Antigravity the Installed MCP Servers panel. Each should show the server and its nine tools.
- **A live view in a terminal** (refreshes every two seconds): `node bin/helm.mjs watch --path <project>`. It shows where you are (finished, in progress, next, last events and notes), every helper run with its status and elapsed time, and the last log lines of the runs in progress. `--once` prints one frame.
- **The evidence trail:** `node .agents/product-kit/kit.mjs recover` (last events with the spawn reasons), `git worktree list` (each helper has its own folder), `.git/kit/agents/<run>.log` (the helper's full output).
- There is no graphical dashboard; "visible" means the terminal view plus each tool's own panels.

## Status: what is verified and what is not
Verified (Linux, Node 22, MCP SDK 1.32.2 as the client, a stand-in for the agent CLI; 46 checks): the whole protocol handshake and all nine tools; init and validation; roadmap edits with rollback; refusal of founder-only commands; spawn rules; a real child process started, logged, waited on, landed after scope and report checks, with the helper worktree and branch removed; refusal of out-of-scope edits, failed runs, over-limit spawns, nested spawns; timeout kill; cancel; approval mode with terminal approval; `recover` showing the journal; the session-hook script; the adapter files for Claude Code, Codex and Antigravity (written, merged without overwriting existing entries, and idempotent).

**Not verified:** running a real `claude` or `codex` CLI headless (the presets and `promptVia: stdin` are from memory of those tools); installing through Claude Code's plugin marketplace and the hook inside a live Claude Code session; the MCP config formats for Codex, VS Code and Cursor; Windows (the runner uses `taskkill` and a shell for `.cmd` commands, untested); CI waiting against real GitHub. Test each once on your machine before relying on it; `TODO-MAP.md` says where.

## Known limits
- A spawned agent runs with your permissions; a worktree is not a sandbox (see TODO-MAP section G).
- Long commands (`land` with CI waiting, `ship`) can exceed a client's tool timeout; the work continues, run `recover` to see the state.
- The roadmap template is generic. The quality of the first milestone depends on the brief and on you confirming the steps.
