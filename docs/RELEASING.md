# Helm release procedure

Helm uses SemVer `MAJOR.MINOR.PATCH`. Keep these version fields equal: `package.json`, `plugin.json`, `.claude-plugin/plugin.json` and the MCP `VERSION` in `server/mcp.mjs`. Record changes in `CHANGELOG.md`.

1. On a PR, run `npm run check`, `npm test`, `npm run test:integration` and `npm pack --dry-run --ignore-scripts`.
2. Confirm GitHub Actions actually assigned a runner and all required checks passed. Zero executed steps is a blocker, not a successful test.
3. Merge the verified PR to `main`. The `release.yml` workflow builds and publishes `helm-vX.Y.Z.zip`, `helm-vX.Y.Z.tgz` and `SHA256SUMS` when that tag does not already exist.
4. Verify the tag points to the intended commit, compare checksums, and test installation/upgrades on clean and dirty projects. For private repos, authenticated GitHub access is required to download release assets.
5. If the job fails before a runner starts, inspect GitHub Actions settings and repository account billing/limits. Restore runner availability before retrying. Do not force a tag while verification is blocked.

Manual alternative **only after tests have passed** (requires `gh` authentication and permission):
```sh
npm run pack:release
VERSION=$(node -p "require('./package.json').version")
git tag "v$VERSION" && git push origin "v$VERSION"
gh release create "v$VERSION" "dist/helm-v$VERSION.zip" "dist/helm-v$VERSION.tgz" dist/SHA256SUMS --verify-tag --generate-notes
```

Private repository releases are not publicly downloadable until the repository or its release distribution policy changes.
