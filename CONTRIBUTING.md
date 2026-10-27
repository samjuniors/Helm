# Contributing to Helm

Keep Helm's lifecycle engine compatible with existing project data under `.agents/product-kit/`. Do not remove, rename, or overwrite user-created project artifacts without a migration, backup and regression test.

Work on a feature branch, keep changes scoped and open a pull request against `main`. Before requesting merge, run:

```sh
npm run check
npm test
npm run test:integration
npm pack --dry-run --ignore-scripts
```

The integration suite requires an installable MCP SDK dependency. A failing or unassigned GitHub Actions runner is not evidence of test success; record its status explicitly. Do not tag a release without green CI and verified downloadable assets.

When cleaning duplicate files, compare their content and usage first. Archive legacy documentation and agent cards under `docs/archive/` before removing runtime discovery duplicates.
