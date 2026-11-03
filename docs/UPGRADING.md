# Upgrading Helm safely

[Installation](INSTALLATION.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Versioned release notes](releases/README.md)

The Helm plugin, its registered MCP server, and each project's copied `.agents/product-kit/` engine are separate. **Do not replace an existing project folder just to upgrade the plugin.**

## Choose your upgrade method

| Existing installation | Safe method |
| --- | --- |
| **v0.8.0+ setup-managed** Helm | Run `helm update` (after preview with `--check` or `--dry-run`) |
| **v0.7.x setup-managed** Helm | Upgrade to v0.8.0 once using a newly extracted release and `node setup.mjs update` |
| Older manually extracted ZIP, **without** a setup record | Run the new release's `node update.mjs --into OLD-INSTALL` |
| Git source checkout containing `.git` | Use `git pull --ff-only` after reviewing changes; never use the ZIP updater on a Git clone |
| Existing project with a copied kit engine | Upgrade separately only when needed, after backing up project work |

Before any upgrade, read the [new release notes](releases/README.md), preserve your current work, and verify the download checksum.

## Built-in updates (v0.8.0 and later)

If your Helm plugin was installed using the **managed setup assistant**, v0.8.0 adds a simpler way to update directly from GitHub Releases:

```sh
helm update --check
helm update --dry-run
helm update
```

- `--check` checks the latest stable published release and reports whether an update is available.
- `--dry-run` shows the planned update without modifying installed files or downloading an archive.
- `helm update` downloads the official TGZ and checksum, verifies both, stages the files outside your installation, then uses Helm's backup/rollback updater and MCP startup test.

These commands work only after you have v0.8.0 (or newer) installed in a **setup-managed** copy. If you have **v0.7.1 or earlier**, use the manual ZIP process below **one time** to reach v0.8.0.

If your installation came from `git clone`, the built-in updater refuses to replace that source checkout. Use the Git workflow described below. Manually extracted ZIPs without `.helm/install.json` continue using the existing `update.mjs --into` workflow. Nothing automatically changes a project's own `.agents/product-kit/` state.

The updater requires internet access to GitHub. Unverified downloads, missing checksums, corrupt archives, downgrades and unrecognized installations are refused. It leaves project files and registrations unchanged. Restart the MCP client after a successful update.

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
