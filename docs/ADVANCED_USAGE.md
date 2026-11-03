# Helm — Advanced usage and technical reference

This page contains optional configuration, debugging, and maintainer-oriented details. For the first installation and basic workflow, start with the [README](../README.md).

## Where project state is stored

When initialized, a project contains `.agents/product-kit/`. This path is kept for backwards compatibility and includes its engine, roadmap, vision, configuration, and project records. Review those files before approving changes. Do not remove or rename that directory manually.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `kit_init` | Initialize a new project kit |
| `kit_run` | Run an allowed lifecycle command such as `recover` or `continue` |
| `kit_roadmap_add` | Validate and add milestone steps |
| `agent_policy` | Read configured agents, limits, and history |
| `agent_spawn` | Propose and launch a permitted helper |
| `agent_status` | Inspect a helper's state and logs |
| `agent_wait` | Wait for an agent to finish |
| `agent_land` | Review scope and merge completed helper work |
| `agent_cancel` | Stop an agent run |

Founder-only commands (approvals, decisions, and milestone closure) remain restricted to the human operating the CLI.

## Agent policy and configuration

Configure each project's helper behavior in `.agents/product-kit/kit.config.json`. For instance:

```json
{
  "orchestrator": {
    "approval": "ask",
    "maxConcurrent": 2,
    "maxPerStep": 3,
    "maxPerDay": 12,
    "timeoutMinutes": 30,
    "roles": ["researcher", "tester", "debugger", "reviewer", "implementer"],
    "agent": { "preset": "claude" }
  }
}
```

This is an example of the orchestrator section, not a complete kit config file. For another agent runtime, review `KIT_AGENT_CMD` and the project's CLI presets before executing. Start with `"approval": "ask"` for unfamiliar agents.

## Project scanning, adoption and regression guards (v0.6.0)

These extend the normal init/recover/continue workflow:

~~~bash
node bin/helm.mjs scan ../my-existing-app
node bin/helm.mjs guard baseline --path ../my-existing-app
# Make changes, then check:
node bin/helm.mjs guard check --path ../my-existing-app
~~~

Guard runs detected or configured project test/build commands, which can modify files. Review commands first. A check only proves what it actually tested. Using `--only` is marked PARTIAL and does not satisfy the full guard.

To adopt an existing product, commit your work first. Adoption refuses a dirty tree and creates its kit on the `kit/integration` branch:

~~~bash
node bin/helm.mjs adopt ../my-existing-app
node bin/helm.mjs state ../my-existing-app
~~~

The `kit_consult` MCP tool records a bounded interview, evidence, options, recommendations and plans. Founders can inspect their decisions with `node bin/helm.mjs consult list` and record approval using `consult agree [id] --quote "your own words"`. These records live in local Git metadata and do not automatically travel between computers.

## Installer lifecycle and safety

The release ZIP includes `setup.mjs`, `setup.cmd` for Windows, and `setup.sh` for macOS/Linux. These commands manage Helm's installed copy and MCP registration; they do not install or modify project kits.

```sh
node setup.mjs install --dry-run
node setup.mjs install
node setup.mjs status
# From a NEW extracted release:
node setup.mjs update --dry-run
node setup.mjs update
# Later, if needed:
node setup.mjs uninstall --dry-run
node setup.mjs uninstall
```

- **Install:** copies this distribution to the standard user-managed location `.helm/plugin`, tests MCP startup, registers available supported clients, and creates a launcher in `.helm/bin`. Add that bin directory to PATH yourself; setup does not modify it.
- **Update:** run from a different, newer distribution folder. This invokes Helm's guarded updater, backs up the installed copy, retains the selected name, and validates MCP startup. It refuses a downgrade unless explicitly requested with `--force`. Restart clients afterwards.
- **Uninstall:** asks before action, unregisters only clients selected when installed and removes Helm's verified managed copy and launcher. An `--in-place` or custom `--dir` source folder is retained; delete it manually if you own it.
- **Purge:** `--purge` removes *recognized Helm backup folders only*; it never recursively deletes an entire home/config folder. Unrelated files are left alone.
- **Existing installations:** setup refuses to overwrite an unrecorded installation, unexpected files or another existing MCP registration. Review them first; `--force` can explicitly take over an existing MCP registration, but it cannot replace an already recorded managed install. Use `update` for normal upgrades.
- **Security:** setup invokes the local tool CLIs with your account privileges. Always review downloaded archives, check SHA-256 sums, and use `--dry-run` before changing an existing installation.

Platform notes: Windows acceptance tests use an isolated fake home and no actual Claude/Codex registrations. POSIX lifecycle fixtures use stub CLIs. Live external host applications must be verified separately.

## Host integration

- **Claude Code:** `node install.mjs --host claude` registers the MCP server. For optional plugin commands, hooks, and agent cards, use `.claude-plugin/` with Claude Code's local marketplace feature.
- **Codex:** `node install.mjs --host codex` attempts CLI registration. Or inspect `node bin/helm.mjs print-config --host codex`.
- **Antigravity:** A project initialized with Helm includes adapter files. For existing kits, use `node .agents/product-kit/kit.mjs adapt --host antigravity --mcp /absolute/path/to/Helm/server/mcp.mjs`.
- **VS Code / Cursor:** Print an MCP config snippet with `node bin/helm.mjs print-config --host vscode` or `--host cursor`.

The MCP server speaks stdio; client-specific CLI flags and configuration paths may change. The repository includes adapter tests, but live client verification varies by host and platform.

## View agent activity

```bash
node bin/helm.mjs watch --path /path/to/project --once
node bin/helm.mjs runs --path /path/to/project
```

For continuing work, use `recover` followed by `continue`. Check the relevant roadmap and generated project instructions before handing work to agents.

## Custom plugin names

Most users should keep the default **Helm** identity. If you deliberately maintain a separate customized installation, you can rename its local MCP/plugin registration:

```bash
node rename.mjs --name my-helm --dry-run
node rename.mjs --name my-helm
node install.mjs
```

Renaming changes the plugin/CLI name and requires updated host registrations. It does **not** rename the MCP tool names or the legacy `.agents/product-kit/` project directory. Prefer a backup/copy rather than renaming your only installed version.

## Testing

```bash
npm run check
npm test
npm run audit:repo
npm run test:integration
npm pack --dry-run --ignore-scripts
```

The integration suite downloads the MCP SDK test dependency and requires network access. Hosted GitHub Actions has previously been blocked by a runner/account billing problem, which does not constitute passing CI. Maintainers may verify locally and publish manual GitHub Releases per [the release procedure](RELEASING.md). Only describe tests that actually executed.

## Security and limitations

Helm can execute configured external agent commands with the privileges of the operating-system user. **A Git worktree is not a sandbox.** Use limited credentials and explicit approvals in sensitive repositories. Prompt instructions alone cannot guarantee agent behavior. Some host integrations, Windows-specific behavior, and third-party agent presets need live verification in their target environments.

See [SECURITY.md](../SECURITY.md), [CONTRIBUTING.md](../CONTRIBUTING.md), [TODO-MAP.md](../TODO-MAP.md), and [RELEASING.md](RELEASING.md) for further details.
