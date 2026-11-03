# Helm Changelog

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
