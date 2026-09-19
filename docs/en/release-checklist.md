# Release preparation checklist

[中文](../zh-CN/release-checklist.md)

Based on portal `standards/v1/templates/release-checklist.md`. Version 0.1.0 completed its first publication and dated remote verification on 2026-09-19. This checklist does not promise the same state for future versions or unverified environments.

- [x] Chinese README and equivalent English guides link reciprocally; source/license, input/output, state/reset and cold/warm are documented.
- [x] Algorithm1.2.0 manifest without model/cache; CHANGELOG includes ByteTrack, OC-SORT and DeepSORT sources, implementation differences and limits.
- [x] `npm run verify` is the complete local check; CI covers types, units, package consumption, Demo/examples and browser interactions.
- [x] Published files are restricted to dist, READMEs, LICENSE, NOTICE and package.json; no React production dependency. Local actual-tarball checks consume all three algorithms through ESM/CJS/declarations.
- [x] Compatibility records date, OS, device, browser, actual backend and runtime.
- [x] The portal checker ran before and after the documentation update with separate reports. Local required failures are zero; remote rules are verified by API receipts.
- [x] First publication is explicitly authorized for this task, without extending authorization to future versions or unrelated repositories.
- [x] The repository, npm Trusted Publisher (`release.yml` / `npm` environment), GitHub About, Homepage, and topics are verified and archived.
- [x] The default-branch Ruleset was verified by API: PRs, latest-commit CI, resolved conversations, deletion and force-push prevention, and no bypass actor.
- [x] The `v*` tag Ruleset was verified by API to block updates and deletion. `v0.1.0` matches the package version and points to the merged commit.
- [x] The GitHub Release is published. The first npm version used local authentication and preserved the unique candidate SHA256 and sha512 integrity. The later Linux workflow rebuilt the package, matched the existing dist.integrity, and safely skipped duplicate publication. Its result is `verified-existing`, not a new OIDC publication.
- [x] Pages Source=GitHub Actions, the github-pages environment, HTTPS, serialized deployment, minimal permissions, and the commit-linked successful deployment were verified.
- [x] GitHub, npm, and HTTPS Demo links were exercised, with credential-free dated receipts in the [first release record](../../reports/2026-09-19-release/README.md).

The local checker preserves remote rules as skip. No local required failures means locally-compliant only. Model assets are inapplicable. Unchecked items do not trigger remote actions.

The three-strategy, external-vector and Demo changes in 0.2.0-alpha.0 remain a local candidate. No push, Release, npm publication or Pages deployment occurred; the checked remote items above record historical 0.1.0 facts and do not prove that the alpha was published.

Release text uses LF; historical reports preserve original bytes. Actual ESM/CJS/declaration consumption, SHA256, sha512 integrity, and the LF-checkout comparison are archived separately. The old desktop package size is not evidence for the final package. The locally authenticated first publication has `provenance: null`; Trusted Publisher is configured, while a future OIDC publication has not yet been exercised by a new version. Its final status must come from that version's npm receipt. Real-sequence metrics and limitations are in the [MOT17 report](../../reports/2026-09-19-mot17/README.en.md).
