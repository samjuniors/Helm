# Open-source launch checklist for Helm

Helm's code is currently stored in a **private** GitHub repository. Writing a public-quality README does not make the repository public. Only the maintainer should decide when to change visibility.

## Before making Helm public

- [ ] Audit the **entire Git history**, current branches, past releases, issues, workflows, and committed files for secrets, tokens, user data, customer code, and private repository references. Cleaning the latest commit alone is not sufficient.
- [ ] Confirm ownership and redistribution rights for all code, templates, docs, and any code adapted from other projects. Verify the MIT license covers the material actually included.
- [ ] Review MCP/agent execution defaults, installation commands, public endpoints, dependencies, and private paths. Test as a new external contributor.
- [ ] Run `npm run check`, `npm test`, `npm run test:integration`, and a clean install/upgrade smoke test. Disclose platform coverage and outstanding gaps.
- [ ] Review the latest release assets and checksums; confirm that public release files contain no private content.
- [ ] Review [SECURITY.md](../SECURITY.md), [CONTRIBUTING.md](../CONTRIBUTING.md), [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md), and issue/PR templates.

**Visibility changes should be made by the owner through GitHub repository settings after reviewing the risks.** Making a private repository public can expose source history and past releases; treat it as a security-impacting operation.

## Repository storefront

After the safety review and public launch, consider this grounded metadata (GitHub repo Settings → General / About):

- **Description:** `Local-first MCP project orchestration: milestones, recovery, QA, Git workflows, and optional AI helper agents.`
- **Website:** Link to the GitHub repository or a real project site if one exists.
- **Topics:** `mcp`, `mcp-server`, `ai-agents`, `developer-tools`, `claude-code`, `codex`, `automation`, `project-management`
- **Community:** Enable Issues and (if there is capacity to moderate them) Discussions. Keep issue templates enabled.
- **Visibility:** Public only when ready; **do not** assume public discovery while private.

Prefer a short screen recording or a real terminal session demonstrating `recover → continue → watch` over promotional promises. Avoid badges claiming CI success until the checks actually run.

## Sponsorship readiness

1. Apply for GitHub Sponsors and finish profile verification, payout and tax setup if eligible. See [GitHub's setup guide](https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/setting-up-github-sponsors-for-your-personal-account).
2. Verify the real sponsors profile is accessible. The project's `.github/FUNDING.yml` currently points to `samjuniors`; this alone does not activate payouts.
3. In repository Settings → Features, enable **Sponsorships** if GitHub offers the option.
4. Introduce a clear, honest sponsorship purpose and optional tiers. Do not promise priority reviews, fixes, or future features you cannot guarantee.
5. Show supporters' names/logos only with their permission.

## Sustainable discoverability

- Publish an accurate demo, starter example, and troubleshooting documentation.
- Ask early adopters for reproducible feedback and a voluntary testimonial.
- Improve one integration based on evidence before promoting broader compatibility.
- Share useful tutorials or technical write-ups in communities where self-promotion is permitted.
- Track meaningful signals such as first successful install, issues resolved, repeat contributors, and verified integrations—not just stars.

No README, badge, or sponsorship button can guarantee popularity. A dependable product, clear demo, and responsive maintenance are the best foundations.
