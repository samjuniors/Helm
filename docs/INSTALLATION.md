# Installing Helm

[Back to README](../README.md) · [Upgrade guide](UPGRADING.md) · [Troubleshooting](TROUBLESHOOTING.md)

Helm requires **Node.js 18+** and **Git**. A compatible MCP client is needed for AI tool integration, but you can use the command-line interface without one.

## Recommended: a versioned GitHub release

1. Download the ZIP and `SHA256SUMS` from [the latest release](https://github.com/samjuniors/Helm/releases/latest).
2. Compare the ZIP SHA-256 digest to the matching value in the checksum file. On Windows, run `Get-FileHash -Algorithm SHA256 helm-vX.Y.Z.zip` in PowerShell. On Linux use `sha256sum helm-vX.Y.Z.zip`; on macOS use `shasum -a 256 helm-vX.Y.Z.zip`.
3. Extract the ZIP, open the extracted `helm` directory, and run the setup assistant.

### Windows

Double-click `setup.cmd` for a menu, or use PowerShell in the extracted folder:

~~~powershell
node .\setup.mjs install --dry-run
node .\setup.mjs install
node .\setup.mjs status
~~~

### macOS / Linux

~~~sh
node setup.mjs install --dry-run
sh setup.sh install
node setup.mjs status
~~~

The setup assistant creates a managed installation under your home directory, validates the Helm MCP server, and attempts to register Claude Code and/or Codex if present. It does not install those clients or automatically modify your PATH.

| Platform | Managed copy | CLI launcher |
| --- | --- | --- |
| Windows | `%USERPROFILE%\.helm\plugin` | `%USERPROFILE%\.helm\bin\helm.cmd` |
| macOS / Linux | `$HOME/.helm/plugin` | `$HOME/.helm/bin/helm` |

To register only one supported host, use `node setup.mjs install --host codex` or `--host claude`. Antigravity is configured per project, not globally.

If the `helm` command is not on PATH yet, use the launcher directly. On PowerShell:

~~~powershell
& "$HOME\.helm\bin\helm.cmd" version
& "$HOME\.helm\bin\helm.cmd" scan "C:\path\to\my-project"
~~~

On macOS/Linux:

~~~sh
"$HOME/.helm/bin/helm" version
"$HOME/.helm/bin/helm" scan /path/to/my-project
~~~

A first project, after adding the launcher to PATH:

~~~sh
helm init ./my-app --name "My App" --brief "An app to organize tasks."
helm recover --path ./my-app
helm continue --path ./my-app
~~~

For an existing Git repository, start with `helm scan /path/to/project`. Commit existing work before attempting `helm adopt /path/to/project`, which creates an integration branch instead of editing the current branch.

## Alternative: source clone

For contributors or anyone who prefers to control the source directly:

~~~sh
git clone https://github.com/samjuniors/Helm.git
cd Helm
node install.mjs --dry-run
node install.mjs
node bin/helm.mjs version
~~~

Keep the clone at the registered path. This registers the server directly from the clone; it does **not** install a managed copy under `.helm`. Update it with Git, not `setup.mjs update`. See the [upgrade guide](UPGRADING.md).

## Other MCP clients

Generate a configuration example with `node bin/helm.mjs print-config --host codex`, replacing `codex` with `claude`, `vscode` or `cursor`. See [Advanced usage](ADVANCED_USAGE.md#host-integration) for Antigravity and host-specific notes. Client approvals and CLI interfaces can vary.

## Verification and limitations

Restart the coding assistant and list its MCP servers. Helm should provide **14 MCP tools** on v0.7.0. Test registration in your actual client; generated configuration alone does not prove live compatibility.

GitHub provides a TGZ too, but the npm package is marked `"private": true` to prevent accidental registry publication. **Do not assume `npm install @samjuniors/helm` is supported.**

External helper agents run with the permissions of your account. Git worktrees are **not** security sandboxes. Review commands and approvals before enabling unattended agents.

For missing commands, installation conflicts, or connection errors, see [Troubleshooting](TROUBLESHOOTING.md).
