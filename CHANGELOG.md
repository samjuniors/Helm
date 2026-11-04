# Helm Changelog

## 0.11.0
- Add `helm release --dry-run` / `--yes` for Actions-free publication, with clean-main checks, all regression/integration gates, checksum verification, immutable tags and custom release notes.
- Make ZIP packaging portable across Windows, macOS and Linux without a system `zip` command.
- Add `helm repair --dry-run` / `--yes` to recover the Helm-managed launcher and persistent per-user PATH. Keep other environment entries and foreign launchers untouched; restore own shell profile blocks only.
- Correct client registration to use an absolute Node executable. Bind project-scoped Claude registrations to their saved project folder and use marked, non-global Codex project MCP configuration.
- Handle normal EOF when closing the guided wizard from a pseudo-terminal; expand environment, safety, project-scoping and archiving regression checks.

## 0.10.0
- Add a lightweight guided installer wizard available from the normal setup launchers and `helm setup`. Show detected coding environments, choose supported clients and installation folder, preview exact planned actions, and confirm explicitly before writing.
- Add advanced read-only `helm doctor [--json] [--check]` and `helm setup --json`; keep explicit `helm install --host ... --dir ... --dry-run` scripting for PowerShell, CMD and Unix.
- First-time verified bootstrap opens the wizard in an interactive terminal; specifying a host uses non-interactive scripted installation. A client can be added to an existing Helm installation without replacing existing code, project data or unrelated registrations.
- Detect pending stable Helm releases in the wizard, offering opt-in update. Never install updates automatically. Provide accurate separate instructions for Antigravity, Claude Desktop, VS Code and Cursor where automatic host integration has not yet been verified.
- Remove implicit deletion/recreation of duplicate MCP registrations, and add dedicated isolated guided/setup lifecycle tests. Keep all 14 MCP tools and the existing install/update/uninstall paths.

## 0.9.1
- Fix the first-time Windows command-not-found experience: managed installation now adds Helm's launcher directory to the current user's PATH while preserving existing entries and registry value type; `--no-path` keeps it entirely manual.
- The PowerShell bootstrap makes `helm` available in its current session after a verified installation, while new terminals read the persistent user PATH. Explicit instructions cover reopening older shells.
- Existing managed users can run `helm install` (via the full launcher path if necessary) to repair PATH without reinstalling or replacing user files. Uninstall removes the Helm PATH entry only if Helm added it.
- Add isolated Windows registry tests and cross-platform regression coverage; improve README, installation and troubleshooting guidance without changing any of Helm's 14 MCP tools.

## 0.9.0
- Add first-time release-based bootstrap scripts for Windows and macOS/Linux that fetch the latest stable GitHub Release and verify its SHA-256 checksum before running the installer.
- Expose `helm install` and `helm uninstall` (including previews) on the existing CLI. Uninstall confirms destructive actions unless `--yes` is supplied and never removes source clones or unrelated project files.
- Keep `helm update` as the official in-place upgrade for managed installations and retain manual ZIP/Git paths for existing installations.
- Add cross-platform CLI lifecycle regression tests and public beginner-to-advanced install/uninstall documentation.

## 0.8.0
- Add \`helm update\` for managed Helm installations: discover the latest published stable GitHub Release, download a checksum-verified TGZ, stage it safely, then invoke the existing backup/rollback updater and MCP startup validation.
- Add \`helm update --check\` and \`helm update --dry-run\` for a read-only update check and preview without downloading/extracting the archive.
- Refuse self-update in Git checkouts, unrecorded or mismatched installations, and malformed/unsafe release archives; do not alter project code or MCP registration paths.
- Add offline fixture tests for version checks, archive integrity, safe extraction, update/rollback behavior and cross-platform compatibility.
- Keep the existing manual setup, ZIP download, CLI, project engine, and 14 MCP tools.

## 0.7.1
- Correct cross-platform setup tests to verify actual MCP upgrade success, downgrade refusal and safe backup purging.
- Remove empty Helm setup folders after purge while retaining unrelated user files and project data.
- Fix Windows 8.3/long-path aliases by asking Git for the kit's repository-relative prefix; use NUL-delimited change paths so legitimate helper reports land while out-of-scope edits remain blocked.
- Require versioned custom release notes during release metadata validation.

## 0.7.0
- Add cross-platform setup with a simple Windows menu and Unix shell entry point for installing, updating, uninstalling, and checking Helm.
- Install a managed plugin copy and optional launcher, while preserving Git source clones, project data, agent configuration, and existing integrations.
- Validate the installed MCP server, protect manual installations from overwrite, and keep backups during upgrades.
- Add installation lifecycle regression tests and update the public quick start and advanced usage guide.

## 0.6.0
- Scan projects by frontend, backend, data, library, mobile and desktop parts and identify checks protecting each part.
- Add safe existing-project adoption on a separate kit/integration branch, docs/STATE.md summaries, and refreshable AGENTS.md rules.
- Add per-part regression guards, partial-check warnings, workspace-aware test discovery and founder-approved roadmap plans.
- Preserve existing user Git changes, the Helm CLI, legacy engine data, MIT license and release infrastructure.
- Include regression coverage for the new scanner, guard, consultation, adoption and state features.

## 0.5.0 (features incorporated in v0.6.0; no separate publication)
- Introduce read-only project scanning, regression guard baselines and structured feature/fix/research consultation.
- Add five MCP tools (kit_scan, kit_guard, kit_consult, kit_state and kit_adopt), bringing the server to 14 tools.


## 0.4.1
- Reconciled the maintenance changes from Product Kit 0.4.1 without replacing Helm source, CLI, project memory or the MIT license.
- Added optional read-only Git/repository audit (`npm run audit:repo`) for versions, tags, release metadata, tracked file hygiene and secret patterns.
- Fixed `rename.mjs --name helm` to write `.plugin-name` even if the installation is already named Helm.
- Added private-package protection, discoverability keywords, and compatibility regression tests; the npm-compatible TGZ is still downloadable.
- Preserved legacy Product Kit upgrade support, existing user Git changes, the project engine and manual release packaging.

## 0.4.0
- Post-merge hardening: prevent setup from auto-committing existing user work; add a regression test.
- Archive duplicate Claude agent definitions while keeping the established `kit-*` roles.
- Document reproducible release verification and unsafe-agent execution boundaries.
- Helm npm, MCP, plugin and CLI versions synchronized.
- Added project-kit origin markers and guarded upgrades with backups.
- Added read-only project scan and optional CI/test check suggestions.
- Added installer/update path and GitHub release download with SHA256 verification.
- CI and versioned downloadable GitHub releases.

## 0.3.0
- Helm CLI, session integration and orchestration runtime.
