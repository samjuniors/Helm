# Troubleshooting Helm

[Installation](INSTALLATION.md) · [Upgrading](UPGRADING.md) · [Advanced usage](ADVANCED_USAGE.md)

This guide covers common setup, CLI, MCP, and project workflow problems. Include the Helm version, operating system, host application/version, and **sanitized** error output when reporting an issue.

## `helm update` refuses to run

Self-update requires **v0.8.0 or newer** and an installation recorded by the setup assistant. Git clones deliberately refuse self-update; run `git status` and `git pull --ff-only origin main` instead. Manually extracted installs without a setup record require `node update.mjs --into OLD-INSTALL` from a newer release.

If GitHub cannot be reached, check internet access and the GitHub API rate limit. A missing release asset, failed SHA-256 verification or unsafe archive is a **stop condition**, not an error to bypass. Review the published [release notes](releases/README.md) and do not delete update backups or project data to work around the refusal.

## The terminal says “node is not recognized” or “command not found”

Install Node.js 18 or newer, restart the terminal, and run `node --version`. Git is also required; verify with `git --version`. If an installation still fails, check that those commands are on PATH.

## The `helm` command is not found after setup

The installer creates a launcher under `.helm/bin` but does not add it to PATH. Run it directly:

- Windows PowerShell: `& "$HOME\.helm\bin\helm.cmd" version`
- macOS / Linux: `"$HOME/.helm/bin/helm" version`

Add that bin directory to PATH if you want to use `helm` without its full path. Do not move the installed `.helm/plugin` folder without updating MCP registrations.

## MCP tools do not appear in Claude Code or Codex

Check that the registered command points to an existing `server/mcp.mjs` file. Restart the client after installing/upgrading and check its MCP server list. You can preview registration using `node install.mjs --dry-run`.

If another `helm` MCP server is already registered, the managed installer may refuse to overwrite it. This is intentional: review the existing registration and source path before making changes. Never unregister an unrelated server without checking what created it.

Helm v0.7.0 exposes **14 MCP tools**. An adapter file is not itself proof that a particular client has connected successfully.

## Which installer do I use?

- **New user with a ZIP:** `node setup.mjs install`.
- **Existing managed setup installation:** `node setup.mjs update` from a **newer** extracted ZIP.
- **Older extracted-ZIP installation:** `node update.mjs --into OLD-INSTALL` from the newer ZIP.
- **Git clone:** `git pull --ff-only origin main` (when clean), optionally refreshing MCP registration with `node install.mjs`.

See the [upgrade decision table](UPGRADING.md#choose-your-upgrade-method). Never run a destructive updater against a Git source checkout.

## Existing-project adoption refuses to proceed

`helm adopt` requires a clean Git repository. Inspect `git status` and preserve/commit unfinished work before trying again. Adoption uses a separate integration branch so your original main branch can remain unchanged.

`helm scan` is a safer first step when you only want to inspect a project.

## A guard check says PARTIAL, UNVERIFIED, or SAFE-BUT-UNPROVEN

These statuses mean the available tests were insufficient to prove full regression safety. Read which commands were discovered, which parts were covered, and what was not run. Never replace missing checks with a claim that everything passed.

Guard checks can execute repository-defined commands. Review what they do first; some test/build scripts write files or run tools with local permissions.

## A helper cannot spawn or merge

Inspect `agent_policy`, the selected role, approval mode, concurrency/timeout limits, and the actual Git worktree changes. An out-of-scope helper edit must be reviewed and corrected; do **not** disable scope checks merely to make an integration test pass.

Git worktrees isolate branches but **not OS permissions**.

## Windows quoting and path issues

Use full paths surrounded by quotes when they contain spaces. In PowerShell invoke an external launcher with `&`, for example `& "$HOME\.helm\bin\helm.cmd" version`. To check the managed installation record, use `node setup.mjs status` from an extracted Helm release.

Avoid placing the managed installation inside a temporary extracted folder that you intend to delete. Keep the source clone or managed copy at its registered path.

## Reporting problems

Open a [bug report](https://github.com/samjuniors/Helm/issues/new/choose) with a reproducible sequence, expected and actual outcomes, Helm version, OS/Node version, client name/version, and a minimal test project if possible.

**Do not paste credentials, API keys, private project code, or home-directory secrets into a public issue.** Use [SECURITY.md](../SECURITY.md) for vulnerabilities.
