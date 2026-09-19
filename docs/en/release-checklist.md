# Release preparation checklist

[中文](../zh-CN/release-checklist.md)

Based on portal `standards/v1/templates/release-checklist.md`. This is the 0.1.0 release candidate, not an online compliance claim. The user authorized first publication in this task; execution and remote receipts belong to the publication phase.

- [x] Chinese README and equivalent English guides link reciprocally; source/license, input/output, state/reset and cold/warm are documented.
- [x] Algorithm1.2.0 manifest without model/cache; CHANGELOG includes sources, implementation differences and limits.
- [x] `npm run verify` is the complete local check; CI covers types, units, package consumption, Demo/examples and browser interactions.
- [x] Published files are restricted to dist, READMEs, LICENSE, NOTICE and package.json; no React production dependency.
- [x] Compatibility records date, OS, device, browser, actual backend and runtime.
- [ ] Before release, run from the portal and save evidence: `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false sdk:check -- --repo /path/to/web-sdk-PP-Tracking --format json --out reports/tracking-check.json`.
- [x] First publication is explicitly authorized for this task, without extending authorization to future versions or unrelated repositories.
- [ ] Verify repository, npm trusted publisher (release.yml / npm environment), GitHub About, Homepage and topics.
- [ ] Verify default-branch rules via API: PR, latest-commit CI, resolved discussions, deletion/force-push prevention and minimal bypass.
- [ ] Verify immutable v* tags through API; tag version must match package version.
- [ ] Publish a GitHub Release; the workflow checks the tag first, verifies, then publishes through OIDC in the npm environment. Never move published tags. A manual first publication must preserve the unique candidate SHA256 and sha512 integrity; the subsequent workflow skips publication only if existing dist.integrity matches. Only structured E404/ENOVERSIONS errors establish absence; network, permission, mismatch and publication errors fail.
- [ ] Verify Pages Source=GitHub Actions, github-pages environment, HTTPS, serialized deployment, minimal permissions and commit-linked deployment record.
- [ ] Verify GitHub/npm/Demo URLs work; archive dated API evidence without credentials.

The local checker preserves remote rules as skip. No local required failures means locally-compliant only. Model assets are inapplicable. Unchecked items do not trigger remote actions.

Release text uses LF; historical reports preserve original bytes. Archive actual ESM/CJS/declaration consumption, SHA256, sha512 integrity and the LF-checkout comparison separately. The old desktop package size is not evidence for the new candidate. Manual publication does not automatically provide provenance; future OIDC publication requests it, with final status established by npm receipts. Real-sequence metrics and limitations are in the [MOT17 report](../../reports/2026-09-19-mot17/README.en.md).
