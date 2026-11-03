# Upgrading Helm safely

[Installation](INSTALLATION.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Versioned release notes](releases/README.md)

The Helm plugin, its registered MCP server, and each project's copied `.agents/product-kit/` engine are separate. **Do not replace an existing project folder just to upgrade the plugin.**

## Choose your upgrade method

| Existing installation | Safe method |
| --- | --- |
| Managed installation created by the **v0.7.0+ setup assistant** (record at `.helm/install.json`) | Run `node setup.mjs update` from a newly extracted release |
| Older manually extracted ZIP, **without** a setup record | Run the new release's `node update.mjs --into OLD-INSTALL` |
| Git source checkout containing `.git` | Use `git pull --ff-only` after reviewing changes; never use the ZIP updater on a Git clone |
| Existing project with a copied kit engine | Upgrade separately only when needed, after backing up project work |

Before any upgrade, read the [new release notes](releases/README.md), preserve your current work, and verify the download checksum.

## Managed setup installation

Download the next version's ZIP and its `SHA256SUMS` from [GitHub Releases](https://github.com/samjuniors/Helm/releases). Verify the archive and extract it to a **separate** directory (never over the installed `.helm/plugin` copy).

Open a terminal in the **new** release directory:

~~~sh
node setup.mjs status
node setup.mjs update --dry-run
node setup.mjs update
node setup.mjs status
~~~

Update keeps a backup of the installed copy, retains existing MCP registrations, and verifies the upgraded server's startup. Restart your coding client afterward.

The managed setup updater requires a valid setup record. Older installs that used `node install.mjs` do not automatically have one. Do not bypass its checks by writing a fake record.

## Older extracted-ZIP installation

From the newly extracted release, run:

~~~sh
node update.mjs --into /absolute/path/to/old/helm --dry-run
node update.mjs --into /absolute/path/to/old/helm
~~~

Review the preview, back up your existing installation, and restart your MCP client afterward. The updater deliberately refuses to modify Git source checkouts and refuses downgrades by default.

## Git source installation

In the cloned Helm repository:

~~~sh
git status
git switch main
git pull --ff-only origin main
node bin/helm.mjs version
node install.mjs --dry-run
~~~

Continue only after reviewing any local changes and fetched updates. Run `node install.mjs` again if your MCP client's registered path needs refreshing. A Git checkout should not be updated with `setup.mjs update` or `update.mjs --into`.

## Project engine compatibility

Changing your installed Helm version **does not automatically replace existing projects' roadmap, decisions, or engine**. If the version's release notes explicitly require refreshing a project's copied engine, first inspect and back up its files, then run:

~~~sh
helm upgrade-project --path /absolute/path/to/project
~~~

This example assumes the Helm launcher is on PATH. Otherwise use `node bin/helm.mjs upgrade-project --path ...` from your installed Helm source.

## Rollback and uninstall

If an update fails, Helm attempts to restore the original installation from its backup. Keep those backup files until you verify that Helm and the connected client are functioning. A successful update can still contain a regression; do not force a downgrade or remove user project state without reviewing the backup and release notes.

For a setup-managed install:

~~~sh
node setup.mjs uninstall --dry-run
node setup.mjs uninstall
~~~

The setup assistant removes only the recognized managed copy, owned launcher, and recorded integrations. Custom `--dir` and `--in-place` installation folders are retained for manual review. Your actual software projects, source history and `.agents/product-kit/` records are not deleted. `--purge` is only for recognized update backups; review the preview first.

For source-clone/manual installations, unregister the server from the coding client before deleting the plugin source folder so the client does not retain an invalid path.

## Verify the upgrade

Check the new version with `helm version` (or the full launcher path), then restart the coding assistant and confirm its MCP tool list. If it cannot connect, see [Troubleshooting](TROUBLESHOOTING.md). A restored backup or a successful version command alone does not prove every external client integration.
