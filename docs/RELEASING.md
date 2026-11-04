# Helm release procedure (maintainers)

[Version notes](releases/README.md) · [Changelog](../CHANGELOG.md) · [Installation](INSTALLATION.md) · [Upgrading](UPGRADING.md)

Helm uses **Semantic Versioning**. Use PATCH for compatible bug fixes, MINOR for features and pre-1.0 breaking changes, and MAJOR for a deliberate 1.0 stable milestone or post-1.0 breaking change. A documentation-only correction normally does not require a new release.

**Source of truth:** GitHub `main` and published release tags. Never reuse or replace an existing tag or release asset.

## Prepare and review

1. Fetch and inspect the latest `main`, existing tests, GitHub Releases, and changes since the **last published** version.
2. Make changes on a new branch, preserve user Git work and old project-kit state, and open a PR for review.
3. Keep `package.json`, `plugin.json`, `.claude-plugin/plugin.json` and the MCP `VERSION` constant synchronized.
4. Update `CHANGELOG.md` and create **custom, version-specific release notes** in `docs/releases/vX.Y.Z.md`. Include features, fixes, upgrade/migration guidance, supported environments, assets and actual test limitations.
5. Review the GitHub PR diff before merging. Never claim tests passed if the job was skipped, blocked, or failed.

## Validation gates

Run the relevant checks in an exact source checkout:

~~~sh
npm run check
npm test
npm run test:integration
npm run audit:repo
npm pack --dry-run --ignore-scripts
~~~

Confirm installation and existing-project upgrade compatibility; test MCP initialization and helper controls, guard regressions, clean/dirty Git working trees and host-specific behavior when available. Inspect the actual `npm pack` contents for dependencies, secrets and unexpected files.

GitHub Actions tests Node 18/22 on Ubuntu/Windows. **At the time of the v0.7.0 audit, runners execute but both OS matrices fail tests; see [issue #2](https://github.com/samjuniors/Helm/issues/2).** This is an actual test blocker, not evidence of a runner/billing failure. Do not mark cross-platform CI as passed. Locally verified release builds and manual uploads are an approved fallback only when their limitations are recorded.

## Bootstrap link compatibility

The public README contains version-pinned bootstrap URLs (`scripts/bootstrap.ps1` and `scripts/bootstrap.sh`). When releasing a new MINOR version, verify the links still resolve to scripts that can download the newest published stable GitHub Release. Never point a public one-line installation command at an unreviewed branch.

Bootstrap scripts must be included in both release archives, tested on their target platforms and must verify release SHA-256 checksums before invoking setup. Keep browser ZIP installation as an alternative for environments where remote script execution is prohibited.

## Package from the reviewed commit

After the PR is reviewed and merged, verify the intended `main` commit and a clean checkout. The release tag **must point to that exact commit**. Build artifacts from the same source, not from an earlier uploaded ZIP, temporary prototype, or mismatched working tree.

The v0.11+ package builder uses Node's built-in compression library for ZIP files; no external \`zip\` command is needed on Windows, macOS or Linux. Run:

~~~sh
helm release --dry-run
helm release
~~~

The local release command runs \`npm run check\`, \`npm test\`, \`npm run test:integration\`, and \`npm run pack:release\` in order. It verifies the generated ZIP/TGZ SHA-256 hashes. A failing or unexecuted test stops publication. The packaging command replaces the ignored \`dist\` output, so move any unrelated local files before building.



Verify the generated `dist/helm-vX.Y.Z.zip`, `dist/helm-vX.Y.Z.tgz` and `dist/SHA256SUMS`. Check the listed hashes and inspect the ZIP/TGZ entries, including dotfiles. Extract a fresh ZIP to a temporary directory and run `npm run check`, `node install.mjs --dry-run` and `node setup.mjs install --dry-run`; test actual upgrade behavior on disposable installations.

The builder currently replaces the ignored `dist` output folder. Make sure it contains no files you need before running it.

## Publish with custom notes

After review and merge, start from the exact, clean and up-to-date \`main\` checkout with \`gh auth login\` complete. You can publish without hosted runners:

~~~sh
helm release --dry-run
helm release
helm release --publish --yes
~~~

The publish step refuses a dirty checkout, wrong GitHub repository, wrong branch, stale remote \`main\`, conflicting release/tag, missing notes, failed tests or checksum mismatch. It creates the versioned tag only after validation and preserves it if an upload fails; never silently overwrite a tag. The GitHub CLI can use a locally authenticated account or a secure \`GH_TOKEN\` in CI.

The three Helm commands above work in PowerShell, CMD and POSIX shells. Publishing through GitHub's Releases page with the same locally verified files and custom notes also remains an option.

If tagging succeeds but asset upload fails, **do not retag or create an unrelated release**. Investigate the existing tag/release state and upload the missing verified assets to that same release.

## Post-release verification

- Check the GitHub Release is published and has **exactly the intended ZIP, TGZ and SHA256SUMS** assets.
- Verify their GitHub SHA-256 digests match the locally tested artifacts.
- Confirm the tag resolves to the intended merged `main` commit.
- Check the release notes describe the correct version and limitations; update the release-notes index.
- Keep old versions and Git history intact. Test installation/upgrade in disposable projects before directing users to the new download.
- Record significant decisions in Helm's project memory; do not add owner-specific work instructions to the public README.

## Automated workflow

`.github/workflows/release.yml` can publish automatically **only after its CI test jobs actually pass**. It must require `docs/releases/vX.Y.Z.md`, not substitute the entire changelog for custom release notes. If Actions is disabled by an account billing or runner problem, use verified local checks and accurately disclose which host validations were not executed.

The approved manual fallback does **not** mean failed test cases may be ignored. Differentiate unrun host coverage from known failing tests in release notes and issues.
