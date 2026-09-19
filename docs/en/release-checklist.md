# Release preparation checklist

[中文](../zh-CN/release-checklist.md)

Based on portal `standards/v1/templates/release-checklist.md`. This is local unpublished0.1.0, not an online compliance claim.

- [x] Chinese README and equivalent English guides link reciprocally; source/license, input/output, state/reset and cold/warm are documented.
- [x] Algorithm1.2.0 manifest without model/cache; CHANGELOG includes sources, implementation differences and limits.
- [x] `npm run verify` is the complete local check; CI covers types, units, package consumption, Demo/examples and browser interactions.
- [x] Published files are restricted to dist, READMEs, LICENSE, NOTICE and package.json; no React production dependency.
- [x] Compatibility records date, OS, device, browser, actual backend and runtime.
- [ ] Before release, run from the portal and save evidence: `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false sdk:check -- --repo /path/to/web-sdk-PP-Tracking --format json --out reports/tracking-check.json`.
- [ ] Explicitly authorize first remote publication; create/verify repository, npm trusted publisher, GitHub About, Homepage and topics.
- [ ] Verify default-branch rules via API: PR, latest-commit CI, resolved discussions, deletion/force-push prevention and minimal bypass.
- [ ] Verify immutable v* tags through API; tag version must match package version.
- [ ] Publish a GitHub Release; the release workflow verifies before OIDC npm publication. Never move published tags.
- [ ] Verify Pages Source=GitHub Actions, github-pages environment, HTTPS, serialized deployment, minimal permissions and commit-linked deployment record.
- [ ] Verify GitHub/npm/Demo URLs work; archive dated API evidence without credentials.

The local checker preserves remote rules as skip. No local required failures means locally-compliant only. Model assets are inapplicable. Unchecked items do not trigger remote actions.
