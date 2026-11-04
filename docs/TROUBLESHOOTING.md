# Troubleshooting Helm

[Installation](INSTALLATION.md) · [Upgrading](UPGRADING.md) · [Advanced usage](ADVANCED_USAGE.md)

This guide covers common setup, CLI, MCP, and project workflow problems. Include the Helm version, operating system, host application/version, and **sanitized** error output when reporting an issue.

## `helm update` refuses to run

Self-update requires **v0.8.0 or newer** and an installation recorded by the setup assistant. Git clones deliberately refuse self-update; run `git status` and `git pull --ff-only origin main` instead. Manually extracted installs without a setup record require `node update.mjs --into OLD-INSTALL` from a newer release.

If GitHub cannot be reached, check internet access and the GitHub API rate limit. A missing release asset, failed SHA-256 verification or unsafe archive is a **stop condition**, not an error to bypass. Review the published [release notes](releases/README.md) and do not delete update backups or project data to work around the refusal.

## The terminal says “node is not recognized” or “command not found”

Install Node.js 18 or newer, restart the terminal, and run `node --version`. Git is also required; verify with `git --version`. If an installation still fails, check that those commands are on PATH.

## The `helm` command is not found after setup

From v0.9.1, Windows setup adds Helm's launcher to the **user PATH** by default, but a PowerShell window opened before installation may still have an older PATH value. Close that terminal and open a new one. If Helm is already installed but PATH was never configured, run the launcher directly and use `install` once to repair PATH without reinstalling. The full launcher paths are:

- Windows PowerShell: `& "$HOME\.helm\bin\helm.cmd" version`
- macOS / Linux: `"$HOME/.helm/bin/helm" version`

To repair an existing Windows installation from PowerShell without reinstalling any files:

```powershell
& "$HOME\.helm\bin\helm.cmd" install
# Reopen PowerShell, then:
helm version
```

If it still isn't recognized, check **Windows Environment Variables → User variables → Path** for `%USERPROFILE%\.helm\bin` (or its absolute equivalent). You can add it manually; for the current shell only, use `$env:Path += ";$HOME\.helm\bin"`. On macOS/Linux, add `$HOME/.helm/bin` to your shell PATH. Do not move the installed plugin folder without updating client registrations.

## MCP tools do not appear in Claude Code or Codex

Check that the registered command points to an existing `server/mcp.mjs` file. Restart the client after installing/upgrading and check its MCP server list. You can preview registration using `node install.mjs --dry-run`.

If another `helm` MCP server is already registered, the managed installer may refuse to overwrite it. This is intentional: review the existing registration and source path before making changes. Never unregister an unrelated server without checking what created it.

Helm v0.7.0 exposes **14 MCP tools**. An adapter file is not itself proof that a particular client has connected successfully.

## A coding assistant is detected but not connected

`helm doctor` shows application markers and launchable CLI programs separately. Detection does not prove an MCP registration. Automatic configuration is supported only for Claude Code and Codex CLIs. Re-run `helm setup` to select a new supported client; the wizard previews its changes and refuses to overwrite foreign registrations.

Antigravity can load global settings from `.gemini/config/mcp_config.json` and project settings from `.agents/mcp_config.json`. Claude Desktop is separate from Claude Code and may use an MSIX-specific configuration. For VS Code or Cursor, review `helm print-config --host vscode` or `--host cursor` and the editor's current MCP documentation. Refresh or restart the client after editing its configuration.

If the wizard does not open, launch it from a real interactive terminal. Non-interactive scripts should use `helm install --host codex --dry-run` and then `helm install --host codex` instead. `helm doctor --json` does not modify files.

## Which installer do I use?

- **First-time user with no Helm command:** use the reviewed, version-pinned [bootstrap script](INSTALLATION.md#recommended-first-time-bootstrap-no-manual-zip), or download an official ZIP and `SHA256SUMS` manually.
- **Managed Helm already installed:** `helm install` is idempotent; `helm update` checks downloads and installs future versions; `helm uninstall --dry-run` previews safe removal.
- **Older manually extracted ZIP with no setup record:** use the new release's `node update.mjs --into OLD-INSTALL`, or follow the documented migration.
- **Git clone:** update source with `git pull --ff-only origin main` after preserving local work. Never use automatic self-update to replace the checkout.

If `helm uninstall` reports that the installation is not managed, examine its CLI registration before deleting anything. Removing Helm must not erase application project files. On Windows, v0.9.0+ launchers self-remove after a successful uninstall to avoid a misleading batch-file error.

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


## Repair reports that the launcher or project configuration is not owned by Helm

Run `helm doctor --json` to inspect the state and then `helm repair --dry-run`. `helm repair --yes` can recreate a missing Helm-managed launcher and add only its per-user PATH entry. It never replaces another program's launcher, changes machine-wide PATH, or removes third-party MCP registrations. Project-scoped registrations are tied to the original recorded project directory and may not be silently moved to another project. Restart terminals/IDEs after PATH repairs.

## GitHub Actions billing blocks a release

Use `helm release --dry-run` and, **only from a clean, reviewed `main` checkout**, `helm release --yes`. The manual path runs metadata, regression tests, the MCP SDK integration suite and repository checks before building ZIP/TGZ/checksums and publishing through an authenticated `gh` CLI. No hosted GitHub Actions minutes are needed. It refuses dirty source, mismatched origin/main and existing published releases. If release upload fails after tag push, preserve the original tag and investigate; never move an existing tag.
