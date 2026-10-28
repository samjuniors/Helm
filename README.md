# Helm

**Plan the work. Coordinate AI agents. Keep the context. Ship with confidence.**

Helm is a lightweight, local-first **MCP project orchestrator** for software projects. It brings together milestones, Git-based work, optional specialist agents, quality gates, and a recovery trail so work can resume after interruptions.

Use it for a brand-new project, an in-progress application, or maintenance of an existing codebase. Helm works alongside your coding assistant; **it is not an IDE, an AI model, or a replacement for Git.**

[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![MCP: stdio](https://img.shields.io/badge/MCP-stdio-5a67d8)](https://modelcontextprotocol.io/)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-0366d6)](CONTRIBUTING.md)

[Get started](#installation-and-quick-start) · [Features](#what-helm-does) · [MCP setup](#connect-your-ai-tool) · [Contribute](CONTRIBUTING.md) · [Releases](https://github.com/samjuniors/Helm/releases) · [Support](#support-the-project)

> **Repository availability:** Helm is currently hosted in a private repository. Public forks, public downloads, stars, and community contributions require the maintainer to make the repository public. Documentation here prepares for that launch; it does not change visibility or access.

## Why Helm?

AI coding sessions can lose context, miss dependencies, duplicate work, or forget what was actually tested. Helm gives the project a durable workflow:

- **Pick up where you left off.** Recover the current milestone, outstanding work, decisions, and recent agent activity.
- **Work in achievable slices.** Manage a roadmap, dependencies, checks, and founder approvals rather than improvising the next task.
- **Use specialist agents when useful.** Research, test, review, debug, or implement in separate Git worktrees, under configurable limits.
- **Keep humans in control.** Approval mode, explicit founder-only decisions, Git history, and refusal to silently overwrite existing project kits.
- **Run locally.** The MCP server uses Node.js, standard input/output, and no server-side service or cloud database.

Helm can **coordinate** testing and release work; it does not guarantee the safety, quality, or correctness of the code produced by an agent.

## What Helm does

| Capability | How it helps |
| --- | --- |
| Project initialization | Creates a project-specific kit, starting vision, milestone roadmap, rules, and MCP adapter files |
| Existing projects | Adds its kit without replacing existing source code; preserves pre-existing dirty Git changes on initialization |
| Start, stop, resume | Uses `recover`, `continue`, checkpoints, and durable progress notes |
| Roadmaps and quality gates | Tracks milestones, dependencies, acceptance evidence, and QA work |
| Multi-agent orchestration | Supports researcher, tester, debugger, reviewer, and implementer roles with spawn limits |
| Git-aware execution | Uses dedicated worktrees and checks role scope before landing agent work |
| Inspectable runs | Exposes run status, logs, cancellation, approval, and a terminal watcher |
| Updates and releases | Includes guarded plugin/project upgrades, versioned archives, and SHA-256 verification |

## Installation and quick start

**Requirements:** Node.js 18+, Git, and an MCP-capable coding environment (or a terminal for CLI-only use).

Choose a persistent folder for Helm. On Windows, for example, `E:\SOFTWARE\Plugin\Helm`.

```sh
git clone https://github.com/samjuniors/Helm.git
cd Helm
node bin/helm.mjs version
node install.mjs --dry-run
node install.mjs
```

The installer checks that Helm's MCP server starts, then registers with **Claude Code and/or Codex if those CLIs are available**. To install for one supported tool, use `node install.mjs --host claude` or `--host codex`.

For a **new app**, from the Helm folder:

```sh
node bin/helm.mjs init ../hello-helm --name "Hello Helm" --brief "A small task-tracking app for a single user."
node bin/helm.mjs recover --path ../hello-helm
node bin/helm.mjs continue --path ../hello-helm
```

For an **existing repository**, commit or back up your work first, then run the same `init` command with its existing directory. Helm does **not** auto-commit an existing repository that already contains uncommitted work. Inspect the proposed kit files before committing them. Helm refuses to overwrite a project kit it already manages.

**Where is the project data?** Helm keeps generated engine files and project records at `.agents/product-kit/` for compatibility with existing installations. The name is intentionally retained.

For a guided checklist, see [TODO-MAP.md](TODO-MAP.md).

## How it works

```text
You + your coding assistant
            |
       Helm MCP tools
            |
    Project orchestration
     /       |         \
 Roadmap   Git/QA     Agent policy
   |         |             |
 Milestones Checks     Optional helpers
   |         |          in worktrees
   +---------+-------------+
            |
   Recover / continue / notes
            |
   .agents/product-kit/
```

**The assistant proposes work; Helm enforces configured execution rules.** A helper is started only after the assistant supplies a role, task, and reason, and the runtime accepts the request. Helpers run using the configured external agent command. If approval mode is set to `ask`, a human must approve the spawn.

The MCP server currently exposes **nine tools**:

| Tool | Responsibility |
| --- | --- |
| `kit_init` | Initialize the kit in a project |
| `kit_run` | Invoke permitted project workflow commands |
| `kit_roadmap_add` | Add roadmap steps with validation |
| `agent_policy` | Inspect agent configuration and limits |
| `agent_spawn` | Request an optional helper agent |
| `agent_status` | Check an agent's status and logs |
| `agent_wait` | Wait for an agent run |
| `agent_land` | Validate scope and merge finished helper work |
| `agent_cancel` | Stop an agent run |

Some actions, including founder acknowledgements, decisions, and closing milestones, are intentionally **not available to the AI through MCP**. The founder records them in a terminal.

## Connect your AI tool

| Environment | Integration | Current verification |
| --- | --- | --- |
| Claude Code | MCP registration; optional local plugin with hooks, commands, and role cards | MCP adapter tested with stand-ins; live CLI/plugin behavior needs host-side validation |
| OpenAI Codex | MCP registration using CLI or configuration | MCP adapter available; real Codex integration needs host-side validation |
| Antigravity | Project-level agent/rules files and MCP config | Generated adapter available; real-host behavior needs validation |
| VS Code / Cursor | Printed stdio MCP configuration | Configuration examples available; verify in your client |
| Other MCP clients | Standard stdio server at `server/mcp.mjs` | Compatibility depends on the client's MCP implementation |

Get a configuration snippet:

```sh
node bin/helm.mjs print-config --host codex
# other options: claude, vscode, cursor
```

For a full Claude Code local plugin, see the [installation walkthrough](TODO-MAP.md) and `.claude-plugin/`. The folder must remain available at the path used for MCP registration.

## Everyday workflow

After initializing a project, a typical session is:

```text
"Recover my project and show the current milestone."
"Continue with the next ready step."
"Research the risk before implementing this change."
"Run the appropriate tests, then review the result."
"Record what is finished and what remains."
```

You can also inspect progress from the terminal:

```sh
node bin/helm.mjs watch --path ../hello-helm --once
node bin/helm.mjs runs --path ../hello-helm
```

Read the generated `VISION.md`, roadmap, and project instructions before delegating work. A checkpoint is a work record, **not** proof that a test passed.

## Configuration and architecture

Helm's implementation is organized around a dependency-free stdio MCP server and a Git-aware project engine.

| Location | Responsibility |
| --- | --- |
| `server/mcp.mjs` | MCP protocol and exposed tools |
| `server/runtime.mjs`, `server/runner.mjs` | Initialization, orchestration, agent execution |
| `engine/kit.mjs` | Project lifecycle, Git steps, validation, recovery |
| `engine/template/` | Initial vision, milestones, gates, settings |
| `bin/helm.mjs` | Command-line entry point |
| `agents/`, `commands/`, `skills/`, `hooks/` | Assistant-specific integration |
| `tests/` | Regression and MCP integration test suites |

The project-specific agent policy is stored in `.agents/product-kit/kit.config.json`. Configure the allowed roles, spawn limits, timeout, and whether approvals are required. **Start with `"approval": "ask"`** when introducing external agents.

## Updating Helm

Use [GitHub Releases](https://github.com/samjuniors/Helm/releases) for versioned downloads: `helm-vX.Y.Z.zip`, `helm-vX.Y.Z.tgz`, and `SHA256SUMS`.

If you installed from a **Git clone**, update the source after reviewing changes:

```sh
git status
git pull --ff-only origin main
node bin/helm.mjs version
```

If you installed from an **extracted ZIP**, use the updater in the *new* extracted release. Preview first:

```sh
node update.mjs --into /path/to/existing/helm --dry-run
node update.mjs --into /path/to/existing/helm
```

The updater backs up the existing installation and validates the new MCP server. To refresh the generated engine in an existing project without replacing its roadmap and records:

```sh
node bin/helm.mjs upgrade-project --path /path/to/project
```

Review the output and back up your project before upgrades. See the [changelog](CHANGELOG.md) and [release procedure](docs/RELEASING.md).

## Rename the plugin

Use `node rename.mjs --name my-helm` in a separate plugin installation to change the registered server/plugin name. Start with `--dry-run`, and reinstall host registrations afterwards. The generated `.agents/product-kit/` project data path and the MCP tool names remain unchanged.

## Testing and current limitations

Run the checks that match the change:

```sh
npm run check
npm test
npm run audit:repo
npm run test:integration
npm pack --dry-run --ignore-scripts
```

`test:integration` installs the MCP SDK test dependency and requires dependency-network access. GitHub-hosted Actions has previously been blocked before executing any jobs by an account/payment issue; see [issue #2](https://github.com/samjuniors/Helm/issues/2). A failed or unassigned runner does **not** mean tests passed. Releases can instead use verified local builds and manual GitHub uploads.

**Known limits:** A Git worktree is *not* a security sandbox; spawned agents run with the permissions of the configured account. Do not use unrestricted credentials or run untrusted agents on sensitive repositories. Real host integration, Windows behavior, and releases should be verified in the target environment; see [security guidance](SECURITY.md) and [the technical TODO map](TODO-MAP.md).

## Roadmap and project direction

Helm prioritizes **safe existing-project support**, reliable resume/recovery, cross-agent compatibility, clear validation, and lightweight installation. Future work is chosen from observed user needs, not promised on a fixed schedule.

The project welcomes focused proposals on project lifecycle UX, adapters, regression coverage, documentation, and release reliability. Open a [feature request](https://github.com/samjuniors/Helm/issues/new/choose) when public issues are enabled.

## Contributing

Contributors can help with bugs, docs, tests, compatibility research, design feedback, and small features.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).
2. Once the repository is public, fork it, create a focused branch, and make your change.
3. Run relevant tests, describe what you actually checked, and open a pull request.
4. For larger changes, discuss the problem and migration strategy before implementation.

**Good first contributions:** reproduction cases, Windows/macOS compatibility checks, host integration instructions, and smaller documentation improvements.

## Support the project

Helm is maintained by [samjuniors](https://github.com/samjuniors) and distributed under the MIT license. If Helm helps your work, consider starring it once public, sharing a real use case, helping triage issues, or contributing a fix.

**Sponsorship:** The repository includes a [GitHub Sponsors funding configuration](.github/FUNDING.yml). The maintainer must activate an eligible GitHub Sponsors profile before donations can be received or the Sponsor button works. Contributions and sponsorship do not buy roadmap priority or bypass reviews.

## Community and support

- [Issues](https://github.com/samjuniors/Helm/issues) — reproducible bugs and feature proposals (when accessible).
- [Releases](https://github.com/samjuniors/Helm/releases) — versions and downloadable artifacts.
- [Contribution guide](CONTRIBUTING.md) — fork/PR process and review expectations.
- [Security policy](SECURITY.md) — report security problems privately, not in public issues.
- [Open-source launch checklist](docs/OPEN_SOURCE_LAUNCH.md) — steps the maintainer must complete before making this repository public.

## License

Helm is licensed under the [MIT License](LICENSE). Before contributing, make sure you have the rights to submit the code, assets, or documentation.

---

**Build software with a clear next step — and a reliable way back to it.**
