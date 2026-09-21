# Release preparation checklist

[中文](../zh-CN/release-checklist.md)

Based on portal `standards/v1/templates/release-checklist.md`. The local candidate is0.2.0-alpha.0; npm, GitHub Release and the HTTPS Demo still publish0.1.0. This checklist does not authorize remote publication.

## Current hybrid SDK candidate

- [x] The root provides three CPU/main trackers; optional `./reid` independently exports ESM/CJS/types. ORT1.27.0 is an optional peer, unnecessary for root consumers.
- [x] Fixed FP32 weights are distributed on ModelScope/Hugging Face, defaulting to ModelScope. Immutable revisions, bytes, SHA and anonymous readback appear in the [stage report](../../reports/2026-09-21-reid-distribution/README.en.md).
- [x] The model card records reliance on the official repository's Apache-2.0 license, conversion attribution and training-disclosure gaps; parameterCount is null.
- [x] Standard1.3 hybrid manifest and Demo pass the after-check, complete verify and real production-build browser acceptance; see the current stage report.
- [x] Final tarball consumption, isolation without ORT and integrity are archived.
- [ ] The current candidate passes independent final review.
- [ ] Once this version's release is explicitly authorized, publish through PR, current-commit CI, merge and a new immutable tag, then refresh npm/hosted-Demo receipts.

Model distribution is not SDK/npm/Demo publication. Identical-input three-algorithm IDF1/IDSW/MOTA and complete cost, and video/camera scheduling, remain later evaluations.

## Historical delivery and baseline checks

Remote checks below record only the2026-09-19 release of0.1.0; current local checks require the evidence above.

- [x] Chinese README and equivalent English guides link reciprocally; source/license, input/output, state/reset and cold/warm are documented.
- [x] Version0.1.0 used the1.2.0 algorithm manifest without model/cache; later candidate CHANGELOG entries separately cover all three algorithms and ReID.
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

The local checker preserves remote rules as skip. No local required failures means locally-compliant only. Model assets apply to the current hybrid candidate; historical algorithm exemptions do not. Unchecked items do not trigger remote actions.

The [optional ReID module](reid-candidate.md) is now in local package.exports/dist, with real sources, licensing documentation and the1.3 hybrid manifest. Dated browser acceptance is archived independently and does not establish an updated npm package or hosted Demo.

The three-strategy, external-vector and Demo changes in 0.2.0-alpha.0 remain a local candidate. No push, Release, npm publication or Pages deployment occurred; the checked remote items above record historical 0.1.0 facts and do not prove that the alpha was published.

Release text uses LF; historical reports preserve original bytes. Actual ESM/CJS/declaration consumption, SHA256, sha512 integrity, and the LF-checkout comparison are archived separately. The old desktop package size is not evidence for the final package. The locally authenticated first publication has `provenance: null`; Trusted Publisher is configured, while a future OIDC publication has not yet been exercised by a new version. Its final status must come from that version's npm receipt. Real-sequence metrics and limitations are in the [MOT17 report](../../reports/2026-09-19-mot17/README.en.md).
