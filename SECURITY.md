# Security Policy

Helm is an MCP project orchestrator that can run configured external agent processes. It must be treated as **privileged developer tooling**.

## Reporting a vulnerability

Please **do not disclose exploit details, credentials, or private project files in public GitHub issues or pull requests**.

If GitHub's private vulnerability reporting feature is enabled for Helm, use **Security → Report a vulnerability** in the repository. Otherwise, contact the maintainer privately through their GitHub profile and request a secure reporting channel before sharing sensitive material. No security contact email is published or guaranteed.

Include affected version, reproduction steps, impact, and suggested mitigation where safe to share. Do not test against other people's machines or repositories without permission.

## Security model and boundaries

- Helm launches external commands with the effective permissions of the operating-system account running it.
- **Git worktrees are not sandboxes.** They separate branches and files but do not prevent processes from reading other paths, executing commands, or using available credentials.
- Enable explicit agent approval for untrusted repositories, restrict the tools and credentials available to agents, and review proposed actions.
- Treat third-party prompts, dependencies, plugins, and contributions as untrusted input.
- Preserve existing project files; back up before upgrades and verify release SHA-256 checksums.
- Never commit tokens, `.env` files, private prompts, project secrets, or personal information.

## Supported releases and maintenance

The latest **published** release is listed on [GitHub Releases](https://github.com/samjuniors/Helm/releases). Current source versions and release tags may differ; verify against the repository before claiming support for a given version.

Security fixes follow the documented branch/validation/packaging process. Hosted Actions may be unavailable due to runner/billing restrictions, in which case maintainers must execute relevant tests locally and disclose unverified platforms or integrations.

## Responsible disclosure

We aim to investigate reproducible reports and coordinate a fix before publicly disclosing high-impact vulnerabilities. There is no guaranteed response time or formal bug-bounty program.
