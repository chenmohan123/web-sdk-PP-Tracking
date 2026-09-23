# Release preparation checklist

[中文](../zh-CN/release-checklist.md)

On 2026-09-23 `0.2.0-rc.2` completed full verification, Motion lab validation and package-integrity checks, then shipped through the immutable tag, GitHub Release, npm Trusted Publishing and standalone Demo deployment. See the [prerelease receipt](../../reports/2026-09-23-release-rc2/README.md). npm `next` points to rc.2 while stable `latest` remains 0.1.0.

The [0.2.0-rc.1](releases/0.2.0-rc.1.md) integration on 2026-09-22 added four algorithms and motion import/export. [Current validation](../../reports/2026-09-22-botsort-integration/README.en.md) separately records package, desktop-browser and fixed-sequence parity evidence. The rc.1 historical record and rc.2 release receipt remain separate.

Based on portal `standards/v1/templates/release-checklist.md`. The rc.1 historical record and this rc.2 prerelease receipt are retained separately without overwriting the real-sequence evidence.

## Current hybrid SDK candidate

Historical model and real-sequence evidence retains its alpha identity. The final RC tarball, hosted browser checks, standards and remote delivery are independently archived in the [rc.2 release receipt](../../reports/2026-09-23-release-rc2/README.en.md). See [rc.2 notes](releases/0.2.0-rc.2.md) for current behavior and limits.

- [x] The root provides three CPU/main trackers; optional `./reid` independently exports ESM/CJS/types. ORT1.27.0 is an optional peer, unnecessary for root consumers.
- [x] Fixed FP32 weights are distributed on ModelScope/Hugging Face, defaulting to ModelScope. Immutable revisions, bytes, SHA and anonymous readback appear in the [stage report](../../reports/2026-09-21-reid-distribution/README.en.md).
- [x] The model card records reliance on the official repository's Apache-2.0 license, conversion attribution and training-disclosure gaps; parameterCount is null.
- [x] Standard1.3 hybrid manifest and Demo pass the after-check, complete verify and real production-build browser acceptance; see the current stage report.
- [x] Final tarball consumption, isolation without ORT and integrity are archived.
- [x] The candidate passes independent final and scoped fix review; three Minor issues are fixed and the documented lazy ORT resource cost is retained.
- [x] PR #3, current-commit CI, merge and an immutable tag completed publication; npm next, public tarball hashes, OIDC provenance signatures and the hosted dual-source/dual-backend Demo are verified.

- [x] The [three-tracker real-image evaluation](../../reports/2026-09-21-mot-reid/README.en.md) covers5316 frames/67639 detections, official combined/per-sequence metrics, browser/two-Node equality, zero capacity drops and complete measured costs.

Version 0.2.0-rc.2 is now prereleased with ByteTrack default, explicit OC-SORT/DeepSORT/BoT-SORT options and experimental human ReID and motion estimation. Video/camera scheduling and cross-device compatibility require separate design and verification.

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

The [optional ReID module](reid-candidate.md) is published with the RC, real sources, licensing documentation and the 1.3 hybrid manifest. The model remains experimental.

The multi-algorithm, external-vector and Demo changes in 0.2.0-rc.2 follow a separate prerelease process. Checked remote items above record historical 0.1.0 facts and do not replace the rc.2 release receipt.

Release text uses LF; historical reports preserve original bytes. Final ESM/CJS/declaration consumption, SHA256 and sha512 integrity are archived independently; old package sizes do not identify the published artifact. The locally authenticated first publication had null provenance. This RC exercised Trusted Publishing and verified the resulting attestation; see the current receipt. Real-sequence metrics and limitations are in the [MOT17 report](../../reports/2026-09-19-mot17/README.en.md).
