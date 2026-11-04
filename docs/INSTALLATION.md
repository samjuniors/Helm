# Installing Helm

[Back to README](../README.md) · [Upgrade guide](UPGRADING.md) · [Troubleshooting](TROUBLESHOOTING.md)

Helm requires **Node.js 18+** and **Git**. A compatible MCP client is needed for AI tool integration, but you can use the command-line interface without one.

## Guided and advanced setup

**First-time or nontechnical users:** use the official version-pinned bootstrap. When started from an interactive terminal it opens a text wizard that detects coding environments, prompts for supported clients and an installation directory, previews the intended changes and requests explicit confirmation. This is a terminal wizard, not a separate desktop application.

**Developers and automation:** use explicit `--host` and optional `--dir` arguments in PowerShell, Command Prompt or a Unix shell. Non-interactive scripts do not need to navigate any menu. A dry run remains read-only.

After installation, `helm setup` reopens the wizard and `helm doctor --json` provides read-only structured diagnostics.

Automatic registration covers Claude Code and Codex where their command-line tools are available. Codex CLI and IDE extension share configuration. Antigravity, Claude Desktop, Cursor and VS Code appear in detection but receive manual instructions; no automatic integration with those clients is claimed.

## Recommended: first-time bootstrap (no manual ZIP)

With [Node.js 18+](https://nodejs.org/) and Git installed, use a **version-pinned** bootstrap to fetch the latest published stable Helm release, verify its SHA-256 checksum, and install a managed copy.

**Windows PowerShell:**

~~~powershell
irm 'https://raw.githubusercontent.com/samjuniors/Helm/v0.9.1/scripts/bootstrap.ps1' | iex
~~~

**macOS / Linux:**

~~~sh
curl -fsSL 'https://raw.githubusercontent.com/samjuniors/Helm/v0.9.1/scripts/bootstrap.sh' | sh
~~~

Both commands fetch code and execute it immediately. **Review the script before executing.** The safer inspect-first method is below. Bootstrapping uses the official GitHub Releases API and assets; it does not clone the Git repository or write anything into your existing project.

### Advanced one-command bootstrap (skip prompts)

On Windows PowerShell, download and inspect the version-pinned script first, then run:

```powershell
& .\helm-bootstrap.ps1 -Client codex -InstallDir 'D:\Tools\Helm'
# Or choose no agent registration:
& .\helm-bootstrap.ps1 -Client none
```

On macOS / Linux after downloading and reviewing `helm-bootstrap.sh`:

```sh
sh ./helm-bootstrap.sh --host codex --dir "$HOME/tools/helm"
sh ./helm-bootstrap.sh --host none
```

A custom installation directory is not silently deleted by uninstall: the wizard will explain that its folder remains for manual review. The managed launcher and installation record are stored under `.helm/`.

### Download and inspect before execution

On Windows:

~~~powershell
Invoke-WebRequest 'https://raw.githubusercontent.com/samjuniors/Helm/v0.9.1/scripts/bootstrap.ps1' -OutFile .\helm-bootstrap.ps1
Get-Content .\helm-bootstrap.ps1
& .\helm-bootstrap.ps1 -DryRun
& .\helm-bootstrap.ps1
~~~

PowerShell execution policy may block scripts saved from the internet. Review the script and use your organization's approved execution method; do not disable security controls blindly.

On macOS or Linux:

~~~sh
curl -fsSLo ./helm-bootstrap.sh 'https://raw.githubusercontent.com/samjuniors/Helm/v0.9.1/scripts/bootstrap.sh'
cat ./helm-bootstrap.sh
sh ./helm-bootstrap.sh --dry-run
sh ./helm-bootstrap.sh
~~~

The scripts use a temporary folder, verify the downloaded official archive against `SHA256SUMS`, check archive entries and run the existing setup assistant. On Windows, the installer appends only Helm's launcher folder to the current user's PATH unless `-NoPath` is selected. The PowerShell bootstrap also activates the launcher in its current session. Other open terminals may need restarting. Unix shell startup files are not edited automatically; follow the PATH instructions below.

### Choosing clients and installation location

In the guided wizard, selecting an automatic client is always explicit. Supported choices are `claude`, `codex`, both (`all`), or `none`. Helm checks each CLI before attempting registration and leaves foreign or customized MCP registrations untouched rather than replacing them. Selecting an existing managed installation can add another supported client without moving or replacing your installed files.

For advanced terminal users, the equivalent commands after downloading an official release are:

```powershell
node .\setup.mjs install --host codex --dir 'D:\Tools\Helm' --dry-run
node .\setup.mjs install --host codex --dir 'D:\Tools\Helm'
node .\setup.mjs status
```

You can later run `helm setup` or `helm install --host claude` to add a client. Change of installation path or registration scope requires explicit manual migration; it is never a silent reinstall.

### Which Helm command should I use later?

Once the launcher is available:

~~~sh
helm setup
helm doctor
helm doctor --json
helm install --dry-run
helm install --host codex
helm update
helm uninstall --dry-run
helm uninstall
~~~

`helm uninstall` asks for confirmation before removing recognized managed files. It never deletes application repositories or user-created project data. In a non-interactive script, explicitly pass `--yes`; only use `--purge` if you intend to remove recognized Helm update backups.

## Manual ZIP installation

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

The setup assistant creates a managed installation under your home directory (or `--dir`), validates the Helm MCP server, and registers only the CLI hosts you explicitly selected. Choose `none` to install the Helm CLI without registering an agent. It does not install those clients. On Windows it adds the Helm launcher to the **user PATH** by default (opt out using `--no-path`), preserving all existing entries. Open a new PowerShell terminal if an older one does not recognize `helm`. On Unix systems, add the launcher folder to your shell PATH manually.

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

## Keeping Helm updated after installation

Starting with v0.8.0, setup-managed installs can update without manually downloading a new ZIP:

```sh
helm update --check
helm update --dry-run
helm update
```

You must have the Helm launcher on PATH, or invoke the launcher from the managed installation. On Windows PowerShell, for example:

```powershell
& "$HOME\.helm\bin\helm.cmd" update --check
& "$HOME\.helm\bin\helm.cmd" update
```

The updater checks GitHub Releases, verifies the download checksum, backs up the existing installation and validates MCP startup. Your projects and MCP registration paths are preserved. **Restart your coding assistant afterwards.**

If you installed **v0.7.1 or older**, first upgrade once using a downloaded v0.8.0 ZIP and `node setup.mjs update` from that new folder. After that, future versions can use `helm update`.

See [Upgrading safely](UPGRADING.md#built-in-updates-v080-and-later) for limitations and other installation types.

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


## Automatic environment repair (v0.11.0)

A managed Helm install now keeps its launcher accessible through the current user's PATH. On Windows it uses only the **user** registry PATH and preserves other entries. On macOS/Linux it adds a uniquely marked Helm section to `~/.profile` and the active shell's supported profile when appropriate; uninstall removes only Helm-owned sections. Existing manually authored PATH lines remain untouched. Changes to PATH are read by newly opened terminals; a running IDE or shell may need restarting.

Preview a repair (no writes):

```sh
helm repair --dry-run
helm repair --yes
```

When PowerShell does not recognize `helm`, invoke its full launcher: `& "$HOME\.helm\bin\helm.cmd" repair --yes`. You can also run `node setup.mjs install --host none` from your existing installed copy. Repair recreates only missing Helm-owned launchers; it refuses foreign launchers, invalid installation records, and any attempt to modify system-wide PATH.

**Global versus project MCP registration:** `helm install --scope user` manages the user-wide CLI registration. For project-scoped Claude/Codex integration use `helm install --scope project --project /absolute/path/to/project --host codex` from an uninstalled managed profile. Codex project mode writes only a uniquely marked block in the project's `.codex/config.toml`; Claude Code registration runs from the recorded project directory. Uninstall uses that recorded directory. A single managed Helm installation never silently changes from global to project scope; use an explicit migration instead. Existing project state and any foreign MCP entries are preserved.
