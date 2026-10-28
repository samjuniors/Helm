# Helm Changelog

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
