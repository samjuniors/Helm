# Helm

> [!IMPORTANT]
> **Project retired — November 4, 2026.** Helm is no longer under active development. Future project-orchestration work is focused on **[Orbit Core](https://github.com/samjuniors/Orbit-Core)**. For new installations and development, use [Orbit Core's documentation](https://github.com/samjuniors/Orbit-Core#readme) and [verified releases](https://github.com/samjuniors/Orbit-Core/releases) instead.
>
> The Helm repository, MIT-licensed source, documentation, and existing [v0.11.0 release](https://github.com/samjuniors/Helm/releases/tag/v0.11.0) remain available for historical reference. **Orbit Core is not a drop-in replacement:** do not reuse Helm's installer, database, MCP configuration, or `.agents/product-kit/` state as though it were an Orbit installation. Back up existing work and review Orbit's own installation and migration guidance before changing hosts or projects. No automatic Helm-to-Orbit migration is provided.

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

**Two ways to get started:** a guided installer for first-time users and precise commands for experienced developers. Both use the same lightweight Helm runtime and safeguards.


**First time, no Git clone or ZIP extraction needed.** With Node.js 18+ and Git installed, use a version-pinned, source-visible bootstrap:

**Windows PowerShell:**

~~~powershell
irm 'https://raw.githubusercontent.com/samjuniors/Helm/v0.11.0/scripts/bootstrap.ps1' | iex
~~~

**macOS / Linux:**

~~~sh
curl -fsSL 'https://raw.githubusercontent.com/samjuniors/Helm/v0.11.0/scripts/bootstrap.sh' | sh
~~~

These commands execute a remote script: [review the Windows script](scripts/bootstrap.ps1) or [Unix script](scripts/bootstrap.sh) before running, or [download and inspect it first](docs/INSTALLATION.md#download-and-inspect-before-execution). The bootstrap downloads the latest official release, verifies SHA-256, runs Helm's guarded installer, and never overwrites an unrecognized installation.

When run from an interactive terminal, the verified bootstrap launches Helm's **guided setup wizard**. It shows available clients, lets you choose installation location and CLI integrations, previews the intended changes and requests approval before writing. It does not automatically register every detected application.

Helm creates a managed copy, checks MCP startup, and registers supported coding clients when available. On Windows, the installer safely adds `.helm\bin` to **your user PATH** (not the system PATH), unless you opt out with `--no-path` or bootstrap `-NoPath`. The PowerShell bootstrap also enables `helm` in the current session; other open terminals may need to be restarted. On macOS/Linux, add `.helm/bin` to your shell PATH as shown in the [installation guide](docs/INSTALLATION.md). See [installation details](docs/INSTALLATION.md) or [manual ZIP installation](docs/INSTALLATION.md#manual-zip-installation).

Already have a Git source checkout? See the [source clone instructions](docs/INSTALLATION.md#alternative-source-clone); the updater never rewrites Git history.

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

## Updating Helm and managing installation

**Guided:** Run `helm setup` to choose integrations, preview changes, add another client, check for updates or uninstall with confirmation.

**Advanced:** Once Helm is installed and its launcher is available, use these commands directly:

~~~sh
helm setup                  # Interactive wizard
helm doctor                 # Read-only installation/client diagnostics
helm doctor --json          # Machine-readable diagnostics
helm install --host codex --dry-run    # Preview a targeted installation
helm install --host codex              # Register this client
helm install --host none               # CLI only, no agent integration
helm install --dry-run      # Preview installation or registration
helm install                # Install a managed copy; existing ones are left intact
helm update --check         # Look for a new stable release
helm update --dry-run       # Preview the next update
helm update                 # Verify, back up and install it
helm uninstall --dry-run    # Preview removal
helm uninstall              # Ask before removing the managed Helm copy
~~~

The wizard automatically detects release availability but **never downloads an update without user approval**. Automatic registration currently supports **Claude Code and Codex CLI integrations** (Codex CLI and IDE share configuration). Antigravity, Claude Desktop, Cursor and VS Code are detected with manual connection instructions until their adapters are independently verified.

The uninstaller removes only verified Helm-managed files and selected MCP registrations; **it does not remove application projects, Git repositories or user notes**. Restart your coding client after installing, updating or uninstalling.

The built-in updater requires a setup-managed installation running v0.8.0 or later. Older ZIP installations and Git clones keep their [documented upgrade methods](docs/UPGRADING.md).

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

Helm is retired and is not accepting a new feature roadmap. Please direct new project-orchestration features, design ideas, and development contributions to [Orbit Core](https://github.com/samjuniors/Orbit-Core). This repository's existing contribution and security documentation is retained for reference.

The previous [contribution guide](CONTRIBUTING.md) is preserved as historical documentation. For new features and issues, use [Orbit Core's issue tracker](https://github.com/samjuniors/Orbit-Core/issues). Please report any security concern affecting existing Helm installations using the [Helm security policy](SECURITY.md), not a public issue.

## Support Helm

Helm's historical source and documentation remain available. To support ongoing project-orchestration development, see [Orbit Core](https://github.com/samjuniors/Orbit-Core).

## Project status

**Retired as of November 4, 2026.** No further Helm feature work or routine release series is planned. The final published Helm release is **v0.11.0**. For ongoing development, maintenance, and new deployments, follow [Orbit Core](https://github.com/samjuniors/Orbit-Core). Helm's existing source, releases, and documentation are retained as a historical reference, without any claim of automatic compatibility or migration.

## License

Helm is available under the [MIT License](LICENSE).

---

*Build with a plan. Resume with context. Keep control of your project.*


## Reliable environment repair and project-only MCP setup (v0.11)

Helm uses the absolute Node executable path in its managed launchers and registrations. On Windows the installer maintains only the current user's launcher PATH entry; on macOS/Linux it adds a removable Helm-owned block to the relevant Bash, Zsh or Fish startup file. Existing profile content is preserved and backed up before modification; reopen your terminal to load the change.

\`\`\`sh
helm doctor
helm doctor --repair --dry-run
helm doctor --repair --yes
\`\`\`

To use Helm for **one project only** without changing global Claude Code/Codex MCP registrations, first install the Helm CLI with \`helm install --host none\`, then explicitly connect that project:

\`\`\`sh
helm connect --path /path/to/project --host all --dry-run
helm connect --path /path/to/project --host all --yes
helm disconnect --path /path/to/project --host all --dry-run
helm disconnect --path /path/to/project --host all --yes
\`\`\`

The equivalent \`helm install --scope project\` and \`helm uninstall --scope project\` work with \`--path\`, but they **only configure the selected project's MCP files**; they do not uninstall the global Helm CLI. The project must be trusted for Codex to read \`.codex/config.toml\`. Both integrations use the current installed Helm server path, and modifications to foreign/custom entries are refused.

Helm never generates or guesses API credentials. Missing variables such as \`AGENT_ROUTER_TOKEN\` must be configured securely by the owner or the provider; Helm's PATH repair is not an authentication bypass.

## Offline-first release publishing

Run \`helm release --dry-run\` for a read-only plan. \`helm release\` runs metadata checks, all local tests, SDK integration and repository audits, then builds versioned ZIP/TGZ assets plus checksums on Windows/macOS/Linux. From a clean, up-to-date \`main\` checkout, \`helm release --publish --yes\` additionally verifies GitHub CLI authentication, the repository and tag, then uploads the verified files with that version's custom release notes. This command does **not require GitHub Actions or a paid hosted runner**. See [release procedure](docs/RELEASING.md).
