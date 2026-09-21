# Tracking 0.2 Release Candidate Acceptance

[中文](README.md) · [Release notes](../../docs/en/releases/0.2.0-rc.0.md) · [Checklist](release-checklist.md)

Date: 2026-09-21. `0.2.0-rc.0` is a local candidate, not an npm, GitHub Release, or production Demo publication. ByteTrack remains the default; OC-SORT and DeepSORT are explicit options; PPLCNet human ReID remains experimental. Production and the portal registry still reference `0.1.0`.

Current package, runtime, Demo, and manifest versions now agree. Publishing explicitly uses `--tag next` for prereleases and `--tag latest` for stable releases. An existing version with identical integrity is verified without uploading or changing tags. Bilingual guides, README, CHANGELOG, and release notes describe this candidate state.

Tracking mathematics, weights, preprocessing, thresholds, and API semantics are unchanged. [Source equivalence](runtime-equivalence.json) compares every runtime source file against evaluated commit `0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`; the [actual diff](runtime-diff.patch) only changes version strings/type literals in four source files. Model metadata is unchanged. [Identity](identity.json) and [package check](package-check.json) pin the candidate commit, source/build/model declarations, and actual tarball.

The seven-sequence, 5316-frame MOT17 results remain [alpha measurements](../2026-09-21-mot-reid/README.en.md). Their 32 archived files, timing statistics, and metric formulas passed offline re-verification. This round did not repeat full inference, tracking, or TrackEval, or relabel old build hashes as RC measurements. The results do not justify changing the default to DeepSORT and are not official test-set rankings.

| Check | Result and evidence |
| --- | --- |
| Publishing behavior | Three expected failures before the fix; eight passing tests afterward, `logs/release-{red,green}.txt` |
| Full verify | 176 unit tests, SDK/Demo type checks and builds, Vanilla/React builds, actual package consumption, and 12 browser groups passed, `logs/verify.txt` |
| Actual npm artifact | ESM/CJS, both NodeNext entry types, root and ReID factory without ORT installed, optional peer, and file allowlist passed; no model, input images, or inference assets bundled |
| Three-algorithm Demo | Playback, pause, seek, imports/exports, 512D thousand-frame round trip, both languages, 390px layout, and Vanilla passed; `pageErrors=[]`, `browser/report.json` |
| Real-model Demo | ModelScope/WASM and Hugging Face/WebGPU succeeded with CPU tracking; lazy loading, reset on switches, cancellation, invalid-input atomicity, and isolated cache clearing passed; `errors=[]`, `reid-demo/report.json` |
| SDK standard | Before/after receipts are in `standard/`; static checks do not prove browser execution or publication |
| Remote preflight | Read-only npm, Rulesets, environments, HTTPS Pages, and existing deployment checks are documented in [remote preflight](remote-preflight.md); RC upload and new-version OIDC publishing have not run |

The first full run exposed a test expectation fixed to alpha; it now reads the current package version. The failed log is retained as `logs/verify-first-version-test-failure.txt`. Historical evaluation scripts/reports were preserved. Vite still reports the optional ORT chunk exceeding 500 kB. Browser checks confirm that the root workspace loads neither ORT nor model weights; this is not a bundle-size optimization claim.

Environment: Windows 11 10.0.26200, Intel Core i5-10400F, NVIDIA RTX 5060 Ti, driver 32.0.16.1692, Chromium 153.0.8010.12, Playwright 1.63.0, Node 24.16.0, and ORT 1.27.0. The 390px captures are desktop viewports. Real-model UI checks use generated opaque PNGs and manual boxes to verify sessions and interfaces, not human-recognition quality. Quality evidence remains the separate real-sequence evaluation.

```sh
node reports/2026-09-21-02-rc/verify.mjs
node reports/2026-09-21-02-rc/verify.mjs --current
```

The first command checks archived hashes and identity records. The second also requires the pinned current sources, model metadata, builds, and `.tmp/web-sdk-pp-tracking-0.2.0-rc.0.tgz`. Neither reruns inference, browsers, or publishing. Commands and reviews are in `closure/`.

Local Demo: <http://127.0.0.1:4204/>. The next step is version-specific publication: refresh remote state, pass protected-branch CI, create an immutable RC tag/prerelease, publish to `next`, verify registry integrity, then verify deployment and portal registration. Stable promotion is a separate decision. Video/camera scheduling, phones, Safari/Firefox, Workers, NPU, cross-camera tracking, and Workflows remain deferred.
