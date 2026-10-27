# Security policy

## Reporting issues
This repository is currently private. Report a suspected vulnerability privately to the maintainer instead of posting secrets, credentials or exploit details to public issues. Do not include tokens or private customer files in test logs.

## Trust boundary
Helm can launch external agent commands with the permissions of the operating-system user. A Git worktree isolates file history; **it is not a security sandbox**. Treat remote prompts and spawned agents as untrusted. Prefer limited-permission execution environments, review the agent policy and require human approval for risky operations.

Do not run arbitrary installation commands copied from unverified sources. Use a pinned Git tag or verified checksum, inspect the release contents, and avoid unnecessary environment variables or broad filesystem permissions. Never commit .env files, credentials, logs or generated archives.

## Supported versions
Until GitHub Actions passes and a tagged release is published, v0.4.0 remains a source version, not a verified published GitHub release. Security fixes are shipped through reviewed commits and tagged releases once verification succeeds.
