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
