# Helm

**Give AI coding agents a roadmap — and a reliable way to pick up where they left off.**

Helm is a lightweight, local-first **project orchestration system built on the Model Context Protocol (MCP)**. It helps developers plan work, coordinate optional AI helpers, manage Git-backed tasks, and resume projects without losing track of progress.

Bring Helm to a new app, an existing codebase, or a project that needs debugging, maintenance, or its next feature. Keep using your preferred coding assistant.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-stdio-5865F2)](https://modelcontextprotocol.io/)

[**Get started**](#quick-start) · [Features](#features) · [Integrations](#integrations) · [Contributing](CONTRIBUTING.md) · [Releases](https://github.com/samjuniors/Helm/releases)

## Why Helm?

A coding agent can write code, but a long-running software project also needs to answer:

- What are we building, and what has already been completed?
- Which task should be done next?
- What decisions and dependencies must be respected?
- When does a specialist agent actually help?
- How do we resume after a break without reconstructing the entire conversation?

Helm adds a **persistent project workflow** around your existing tools, with human decisions, milestones, checkpoints, and reviewable Git history.

## Features

| | |
| --- | --- |
| **Works across project stages** | Initialize a new project or organize an existing one; plan changes, fixes, and maintenance |
| **Roadmaps and milestones** | Break work into steps with dependencies, acceptance criteria, and quality checks |
| **Resume with context** | Recover current progress, pending work, decisions, and recent activity |
| **Optional multi-agent help** | Coordinate researchers, testers, debuggers, reviewers, and implementers when useful |
| **Git-aware execution** | Use dedicated worktrees and scope checks for helper-agent work |
| **Human control** | Configure approvals, agent limits, and timeouts; keep key decisions with the project owner |
| **Local-first MCP server** | Run over stdio with Node.js, without a Helm-hosted account or service |
| **Repository scanning and adoption** | Inspect new or existing projects, then adopt through a separate Git branch |
| **Regression guards** | Compare recorded test baselines against subsequent changes, with partial checks labeled clearly |

Helm orchestrates work; it does **not** replace your coding assistant, perform work independently of a configured agent, or guarantee that generated code is correct.

## Quick start

**Requirements:** Node.js 18+, Git, and (for MCP integration) a coding assistant with MCP support.

### 1. Install Helm

Download and extract the [latest Helm ZIP](https://github.com/samjuniors/Helm/releases/latest), and compare its SHA-256 hash with the release's `SHA256SUMS`.

- **Windows:** double-click `setup.cmd` in the extracted `helm` folder.
- **macOS / Linux:** from the extracted folder run `sh setup.sh install`.
- **All platforms:** preview the operation with `node setup.mjs install --dry-run`.

Setup creates a managed copy, checks MCP startup, and attempts to register installed Claude Code and/or Codex clients. It does **not** modify PATH, so use the launcher path shown by setup until you add `.helm/bin` to PATH. [Detailed installation guide](docs/INSTALLATION.md).

For a source checkout instead, run `git clone https://github.com/samjuniors/Helm.git`, open the clone and run `node install.mjs`. That registration points to the clone itself, which must remain at its registered path.

### 2. Start or inspect a project

After adding the launcher to PATH (or using the full launcher path):

~~~sh
# New project
helm init ./my-app --name "My App" --brief "A simple app to manage tasks."
helm recover --path ./my-app
helm continue --path ./my-app

# Existing project: scan before changing anything
helm scan ./existing-app
~~~

For a clean existing Git repository, `helm adopt ./existing-app` can introduce Helm on a separate integration branch. Review the result before merging.

### 3. Work with your coding assistant

Open the project in your MCP-connected coding assistant and ask:

> "Recover this project, summarize the current milestone and decisions, and propose the next safe task."

Helm's generated project records are stored in `.agents/product-kit/` for backwards compatibility. Protected approvals remain human decisions.

## Update Helm in one command

After your initial setup-managed installation is running v0.8.0 or newer, update directly from GitHub Releases:

~~~sh
helm update --check     # Check for a new version
helm update --dry-run   # Preview the update
helm update             # Verify and install it
~~~

Helm verifies the release checksum, retains a backup, tests MCP startup and preserves your project files. Restart your coding assistant after an update.

**Using v0.7.1 or earlier?** Upgrade to v0.8.0 once using the [manual ZIP upgrade guide](docs/UPGRADING.md). Git source clones continue updating with Git; automatic self-update never overwrites source checkouts.

## How it works

```text
Developer + coding assistant
            |
          Helm
            |
  Roadmap · Context · Quality
            |
    Git-backed project work
            |
  Optional specialist agents
            |
  Checkpoints and recovery
```

The coding assistant decides what work to propose. Helm exposes tools to track it and enforces configured limits on helper-agent execution. Helpers are optional; a small task can stay with one agent. Agent worktrees organize changes but are **not security sandboxes**.

The MCP server exposes **14 tools** covering initialization, roadmap updates, workflow commands, agent policy, helper-agent execution, project scanning, regression guards, structured consultation, project-state summaries, and existing-project adoption. [Explore the technical architecture](docs/ADVANCED_USAGE.md).

## Integrations

Helm uses MCP over standard input/output and includes integration files or configuration examples for several coding environments.

| Environment | How to connect |
| --- | --- |
| **Claude Code** | `node install.mjs --host claude` or use the included local Claude plugin |
| **OpenAI Codex** | `node install.mjs --host codex` |
| **Antigravity** | Initialize or adapt a project's MCP and agent configuration |
| **VS Code / Cursor** | Generate a configuration snippet with the Helm CLI |
| **Other MCP clients** | Configure the stdio server at `server/mcp.mjs` |

For example, to print Codex's MCP configuration:

```bash
node bin/helm.mjs print-config --host codex
```

Client-specific configuration and external-agent behavior vary by environment. See [integration setup and compatibility notes](docs/ADVANCED_USAGE.md) before relying on a new host.

## Installation, upgrades and help

Different installation methods need different upgrades. **Do not use the ZIP updater on a Git source clone.** The [upgrade guide](docs/UPGRADING.md) explains how to update managed setup copies, older ZIP installations, source clones, and project engines without replacing project data.

| Need | Guide |
| --- | --- |
| Install and connect a supported client | [Installation](docs/INSTALLATION.md) |
| Upgrade, roll back, or uninstall | [Upgrading safely](docs/UPGRADING.md) |
| Fix missing commands, MCP errors, or guard failures | [Troubleshooting](docs/TROUBLESHOOTING.md) |
| Advanced agents, 14 MCP tools, adapters and security boundaries | [Advanced usage](docs/ADVANCED_USAGE.md) |
| Read changes by published version | [Release notes](docs/releases/README.md) and [Changelog](CHANGELOG.md) |

Review the [latest release](https://github.com/samjuniors/Helm/releases/latest) before installing. The GitHub TGZ is downloadable, but the package is not advertised as an npm-registry installation.

## Contributing

Helm is open to bug reports, documentation improvements, compatibility tests, design ideas, and code contributions.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch and pull-request guidelines, and testing expectations. For a bug or feature idea, [open an issue](https://github.com/samjuniors/Helm/issues). Please report security concerns using the [security policy](SECURITY.md), not a public issue.

## Support Helm

If Helm is useful, you can **star the repository**, share it with other developers, or contribute a fix or example. If a **Sponsor** button is available on the repository, you can also support ongoing development through GitHub Sponsors.

## Project status

Helm is under active development and its current version is **pre-1.0**. Features and client integrations are still being refined. Review the [latest releases](https://github.com/samjuniors/Helm/releases) for available versions and the [advanced documentation](docs/ADVANCED_USAGE.md) for testing and known limitations.

## License

Helm is available under the [MIT License](LICENSE).

---

*Build with a plan. Resume with context. Keep control of your project.*
