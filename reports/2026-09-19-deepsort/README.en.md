# Local acceptance of external-vector DeepSORT

[简体中文](README.md)

Date: 2026-09-19. Local candidate `0.2.0-alpha.0`, core commit `28cb83a`, Demo/docs commit `fc3adebb7630b0d53c9831cc96ee57b56bb6f143`. npm, the HTTPS Demo and production portal remain on `0.1.0`. This stage made no push, PR, release, model upload or deployment.

The same package now provides ByteTrack (default), OC-SORT and external-vector DeepSORT. DeepSORT validates a fixed feature space, copies and normalizes each detection embedding, then uses bounded nearest-neighbour galleries, four-dimensional motion gating, a recency cascade and a limited IoU fallback. Runtime remains dependency-free CPU/main, with no built-in ReID model, video or camera pipeline.

## Verification

| Check | Result and evidence |
| --- | --- |
| Core red/green | Initial 14 expected failures; final focused tests19/19 and first full regression95/95; independent core review passed |
| Demo input red/green | [Initial RED](task-2-red-demo-test.txt):3 failed/5 passed; final12/12 covering full-sequence validation, deep copies and state preservation |
| Full `npm run verify` | [Raw log](verify.txt), exit0;102 tests in9 files, type checks, runtime build, package consumption, Demo/Vanilla/React builds and11 browser checks passed |
| Actual npm tarball | [Package report](package-check.json): three algorithms consumed through ESM/CJS/TypeScript, export whitelist and zero production dependencies passed;22,395bytes |
| Browser interactions | [Report](browser-report.json): Windows11 / Intel i5-10400F / Playwright1.63.0 / Chromium153.0.8010.12, CPU/main,11 checks, empty pageErrors |
| Independent4204 preview | [Report](preview/report.json),[script](preview/smoke.mjs):three options, two confirmed DeepSORT crossing tracks after3 frames, no horizontal overflow at390px in Chinese/English |
| Local standard | Portal `tracking-deepsort-before-20260919.json` / `tracking-deepsort-after-20260919.json`:17 required passes and0 failures each; locally-compliant only |

The [first full attempt](verify-attempt-1-failed.txt) failed with TS6142 because a unit test imported the React page from a root configuration without JSX support. The pure parameter conversion moved into the data module; the final full run passed. The log's npm OIDC success text comes from the existing mocked release.test.ts scenario, not an actual publication.

Task review led to fix `5b7c714`: sample switching uses applied options and no longer silently applies draft parameters. The [regression RED](task-2-fix-1-red.txt) reproduced `0.9 !== 0.2`; after the fix, [Demo type checking/build](task-2-fix-1-typecheck-build.txt) and [11 browser GREEN checks](task-2-fix-1-browser-green.txt) passed, also covering switching a custom feature space back to the built-in synthetic space. This patch changes only the Demo and tests; runtime builds and the tarball remain unchanged. Original full verification and preview records are preserved.

`sdk-check-before.txt` was taken before Task2 and already includes core `28cb83a`; the portal's whole-stage baseline is `1982e87`. The coordinator separately ran the whole-stage after check.

## Fixed build and screenshots

- Tarball SHA256:`58eaf180579d0bdfae0351513978b7a6dff189aa22a921c1c945082977a5f739`.
- `dist/index.js` SHA256:`8396ef79f22c6afd2690bd6413f2b32b25fd46ec67b9fabca8fcab44c9a82041`.
- `dist/index.cjs` SHA256:`f9bd94a1a63e97d424891436b974aafc1dff312c6ca8c183eb7ff74953af186b`.
- [Desktop](preview/desktop.png),[390px Chinese](preview/narrow.png),[390px English](preview/narrow-en.png). The menu uses the short name DeepSORT; the sample description identifies synthetic appearance vectors to avoid truncation in the desktop sidebar.

`browser-report.json` preserves original temporary screenshot paths; the three independent preview screenshots above are archived. Run `node reports/2026-09-19-deepsort/preview/smoke.mjs` from the SDK root with the4204 preview already running. It writes to ignored `.tmp/deepsort-preview` without replacing this archive.

## Scope and next steps

Evidence covers the external-vector contract, association mechanisms, package and desktop interactions. Synthetic vectors are not image-derived and do not establish real person quality or superiority over existing algorithms.390px is a desktop viewport, not a physical phone test. Historical two-algorithm MOT17 results and failed OMZ probe evidence remain unchanged.

Next evaluate the exact Paddle PPLCNet ReID checkpoint, weight terms, preprocessing and Python/browser alignment, then compare identical detections using real images and identity ground truth. Evolve the algorithm/model hybrid standard before adding model loading to this package. BoT-SORT, JDE, FairMOT and CenterTrack remain unimplemented.
