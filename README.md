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

Helm orchestrates work; it does **not** replace your coding assistant, perform work independently of a configured agent, or guarantee that generated code is correct.

## Quick start

### Requirements

- **Node.js 18 or newer**
- **Git**
- A supported MCP-capable coding assistant for agent integration (or just a terminal for the CLI)

### 1. Install Helm

Clone the repository to a permanent location:

```bash
git clone https://github.com/samjuniors/Helm.git
cd Helm
node install.mjs
```

The installer checks the local MCP server and attempts to register it with **Claude Code and/or Codex** if their CLIs are available. Use `node install.mjs --dry-run` to preview registration without changing your configuration.

Prefer a packaged version? See [Releases](https://github.com/samjuniors/Helm/releases) for versioned ZIP downloads and checksums.

### 2. Start a project

From the Helm directory:

```bash
node bin/helm.mjs init ../my-app --name "My App" --brief "A simple app to manage personal tasks."
```

For an **existing project**, use its folder instead of `../my-app`. Helm preserves existing source files and does not automatically commit pre-existing uncommitted changes. It refuses to overwrite an already initialized Helm kit.

### 3. Recover and continue

```bash
node bin/helm.mjs recover --path ../my-app
node bin/helm.mjs continue --path ../my-app
```

Open the project in your coding assistant and try:

> "Recover this project, show me what's done and what's next, then continue with the next milestone."

Helm creates project-specific files in `.agents/product-kit/`. You can inspect and commit the roadmap, vision, and progress history like any other project files.

[Full getting-started walkthrough](TODO-MAP.md)

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

The MCP server provides nine tools covering initialization, roadmap updates, workflow commands, agent policy, spawning, status, waiting, landing, and cancellation. [Explore the technical architecture](docs/ADVANCED_USAGE.md).

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

## Updating Helm

For an installation from a Git clone, first check for local changes:

```bash
git status
git pull --ff-only origin main
```

For an installation from a downloaded ZIP, extract the **new** version separately and use its updater:

```bash
node update.mjs --into /path/to/existing/helm --dry-run
node update.mjs --into /path/to/existing/helm
```

To refresh Helm's generated engine inside a project while preserving its existing roadmap and records:

```bash
node bin/helm.mjs upgrade-project --path /path/to/project
```

Back up important projects and review changes before upgrading. Read the [changelog](CHANGELOG.md) and [release downloads](https://github.com/samjuniors/Helm/releases).

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
