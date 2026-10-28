# Contributing to Helm

Thanks for considering a contribution. Helm aims to be a **small, dependable MCP orchestration system** that works with different coding assistants and respects existing projects.

Contributions are welcome when repository access permits. The repository is currently **private**; for public forks and outside pull requests, the maintainer must first make it public.

## Ways to contribute

- **Fix a bug:** Provide a minimal reproduction and add regression coverage.
- **Test compatibility:** Try the CLI/MCP integration on Windows, macOS, or Linux, and report the exact host version.
- **Improve documentation:** Correct a command, clarify an installation step, or add a working example.
- **Propose a feature:** Describe the user problem, smallest viable change, alternatives, and compatibility implications.
- **Review:** Help with PR review, performance, threat modeling, or QA.

Large redesigns or new dependencies should be discussed before implementation.

## Before you start

1. Check existing issues and PRs to avoid duplicate work.
2. For bugs or small docs fixes, a focused PR is fine; for breaking or multi-component changes, open an issue first.
3. Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), [docs/RELEASING.md](docs/RELEASING.md), and [TODO-MAP.md](TODO-MAP.md).
4. Confirm that you own or are permitted to contribute every included file.

## Fork, branch, and propose changes

When the repository is public:

```sh
git clone https://github.com/YOUR-USERNAME/Helm.git
cd Helm
git remote add upstream https://github.com/samjuniors/Helm.git
git switch -c fix/describe-your-change
```

For an existing authorized clone, branch from the latest `main` without overwriting uncommitted work. **Do not push directly to upstream `main`.**

Keep the diff focused and include the reason for every non-obvious change. Prefer a simple fix over a new abstraction or dependency.

## Development and verification

**Requirements:** Node.js 18+, Git; the full integration tests require access to download a test dependency.

```sh
npm run check
npm test
npm run audit:repo
npm run test:integration
npm pack --dry-run --ignore-scripts
```

Use the tests relevant to your change and report exactly what ran, which operating system, and whether any test was skipped. The hosted GitHub Actions workflow may be unavailable because of account-level runner/billing restrictions. **Do not label a PR "tested" just because it was merged or an Action failed before starting.**

## Protect user projects

- Preserve existing Git history, user-created files, and dirty working trees.
- Do not rename or erase the generated `.agents/product-kit/` project state without a documented migration, backups, and regression tests.
- Prefer backwards-compatible behavior and explicit prompts to destructive automatic actions.
- Keep optional agents subject to configured limits; a Git worktree **does not** sandbox a process.
- Do not commit credentials, personal data, cached model prompts, user project state, `node_modules`, or release archives.
- Treat founder-only approvals and decisions as human actions; never fabricate them in tests or docs.

## Pull request checklist

- [ ] PR explains the user problem and what changed.
- [ ] Affected tests, documentation, and example commands have been updated.
- [ ] Existing-project installation and upgrade behavior remain safe.
- [ ] Tests actually run and any limitations are listed.
- [ ] No secrets, proprietary material, or unrelated refactoring.
- [ ] Breaking changes include migration/rollback guidance.

Open a PR into `main` using a focused title such as `fix: ...`, `docs: ...`, `test: ...`, or `feat: ...`. A maintainer reviews and merges; opening a PR does not guarantee acceptance or a particular release date.

## Versioning and releases

Helm follows SemVer: patch for non-breaking fixes, minor for features and pre-1.0 breaking changes, and major for post-1.0 breaking changes or a deliberate 1.0 stable milestone. A docs-only edit need not trigger a new release. See [the release procedure](docs/RELEASING.md). Only the maintainer tags/releases, after verified checks and checksums. If hosted CI is blocked, local verification and manual release upload are the approved alternative.

## Security and conduct

Never publish vulnerability details or credentials in an issue. Follow [SECURITY.md](SECURITY.md) for a private reporting route, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for collaboration expectations.

Thank you for helping make Helm safer and easier to use.
