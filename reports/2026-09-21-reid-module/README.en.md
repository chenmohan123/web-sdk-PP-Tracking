# Local acceptance of the optional ReID module

[中文](README.md) · [Candidate API guide](../../docs/en/reid-candidate.md)

Date: 2026-09-21 in Asia/Shanghai; machine records use UTC. This stage adds the same-package `src/reid/` source candidate: decoded human RGBA crops and detection boxes → 512-dimensional appearance vectors → existing DeepSORT. Baseline: `4bbd3d5`; module commit: `6fc6e5a`; download/cancellation fix: `5dcd2d4`. The local SDK remains `0.2.0-alpha.0`; the live release remains `0.1.0`.

The candidate builds into ignored `.tmp/reid-module/dist/`. It is not in public `package.exports` or release `dist`. Real dual-source distribution, a hybrid manifest, a public subpath and Demo model controls remain pending. No models were uploaded, GitHub changes pushed, or npm release published. The root package retains three CPU/main tracking strategies.

## Model and results

The fixed PPLCNet ReID FP32 ONNX contains 33,704,835 bytes, SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`. Neither model nor source images are committed. The [previous model card](../2026-09-20-reid-preprocessing/model-card.en.md) records provenance, conversion, licensing evidence and training disclosures; this stage does not expand those claims.

Expected vectors come from the archived Paddle outputs, independently L2-normalized before comparison. Gates: maxAbs < 1e-3, cosine distance < 1e-5, unit norm error < 1e-6.

| Model backend | Passing fixtures | Maximum absolute error | Maximum cosine distance | Maximum norm error |
| --- | ---: | ---: | ---: | ---: |
| WASM | 34/34 | 3.502e-7 | 2.820e-12 | 3.202e-9 |
| WebGPU | 34/34 | 4.396e-7 | 3.096e-12 | 4.375e-9 |

The fixtures include 8 synthetic images and 26 real crops. The original out-of-bounds `clipped` box is first rejected by the production API; only then an explicit in-bounds equivalent intersection, preserving the original integer crop, is used for numerical comparison. This row records `equivalentClippedBox`; all other boxes remain unchanged.

Environment: Windows 11 10.0.26200, i5-10400F, RTX 5060 Ti (driver 32.0.16.1692), Chromium 153.0.8010.12, ORT Web 1.27.0, Node 24.16.0. ORT's actual GPUDevice reports NVIDIA/Blackwell and no fallback adapter; CPU EP fallback is disabled for WebGPU. These dated local results do not establish phone or cross-browser compatibility.

## Lifecycle, cache and package boundaries

- The factory copies model bytes synchronously; extract validates and snapshots the complete frame before asynchronous work. Runtime-readonly featureSpace binds the model SHA, preprocessing and L2 rules.
- Concurrent instance operations return BUSY. Cancellation waits for the current ORT run/readback, disposes tensors and discards the frame. Idempotent dispose waits for active work. Both backends successfully extract again after cancellation.
- Repeating the same real crop through DeepSORT preserves ID 1 and reports CPU association. This checks API integration, not real sequence tracking quality.
- Real CacheStorage verifies stored on first download, hit on reuse, INTEGRITY_FAILED for corrupt data and isolated cleanup. A controlled short response also fails integrity checks. An additional gzip transfer is decompressed by the browser and passes the fixed model SHA and session creation. Exactly three requests occur, without silent source switching or a corrupt-cache redownload.
- Playwright intercepts the HTTPS URL locally; no real model hub is contacted. The test-only repository and all-a revision are fixtures, not publishable source evidence.
- Importing, creating and disposing the idle candidate, and running the root algorithm, request no ORT or ONNX assets. ORT is dynamically imported only at load's session stage.
- The actual tarball is 22,861 bytes with SHA-256 `4d15a44fcdfde6bbf16a5309ad7fb91ecd5f40a30ed5ce3283ee70bab3e88ef9`. It contains no ReID/model/ORT files and has no production dependency. Core ESM/CJS hashes match baseline; documentation and development metadata explain the changed package hash.

Load measures download, cache reads, SHA, session and total separately. Extract measures validation/copy/preprocessing/tensor construction, inference, output readback/normalization/disposal, and total; decodeMs=0. Factory model copying occurs before load and is excluded from load.totalMs. Per-run timings are archived, but this stage has no controlled performance ranking or complete video FPS claim.

## Checks and reproduction

Full SDK verify at module commit `6fc6e5a` passes 138 unit tests, type checks, core/Demo/Vanilla/React builds, three-algorithm ESM/CJS/TypeScript package consumption and 12 existing browser checks. There were 34 new ReID tests then; the review fix adds 7 more, with 37/37 focused lifecycle tests, type checks and candidate build passing. The unchanged full suite was not repeated. Red/green evidence covers missing behavior, input boundaries, cleanup and the download fix. The final fixed version reruns 34 real fixtures per backend plus gzip/cache checks.

Portal standard 1.3.0 is implemented locally. Before/after checks each pass 17 required rules with zero failures, establishing only locally-compliant status for the current algorithm release core. The model candidate does not use the algorithm manifest to bypass distribution or Demo requirements.

With the fixed local model and RGBA resources:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build:reid-candidate
openssl req -x509 -newkey rsa:2048 -nodes -keyout .tmp/reid-module/localhost-test.key -out .tmp/reid-module/localhost-test.crt -days 7 -subj /CN=localhost -addext subjectAltName=DNS:localhost,IP:127.0.0.1
node tests/reid-browser.mjs
```

On Windows, replace `openssl` with `& 'C:/Program Files/Git/usr/bin/openssl.exe'` if needed. This ephemeral certificate is only for local testing. The test browser context ignores its trust error without installing a system certificate; its private key remains ignored. `TRACKING_REID_TLS_KEY` / `TRACKING_REID_TLS_CERT` may point to existing test credentials.

The initial gzip interception failure is retained in `browser-gzip-route-failed.log`. The minimal `browser-gzip-diagnostic.log` records a 4096-byte payload compressed to 39 bytes: route.fulfill exposes 39 bytes to fetch, whereas a real TLS response is decompressed to 4096. The final test therefore transfers the model over real local HTTPS without weakening SDK integrity checks.

Archive verification without model or browser:

```powershell
node reports/2026-09-21-reid-module/verify_archive.mjs
```

Evidence includes the [protocol](protocol.md), [lock](evidence.lock.json), [summary](evidence/validation.json), [browser vectors](evidence/browser-result.json.gz), [environment](evidence/environment.json) and [full validation log](evidence/sdk-verify.log). The verifier checks locked files and independently recomputes errors for 68 archived vectors. It does not rerun inference or establish new-platform compatibility. `summarize.mjs` and `archive.mjs` are maintainer tools for archiving completed validation.

Next: verify the applicable weight license basis and attribution, establish real immutable ModelScope default/Hugging Face alternative sources, then enable the public subpath, hybrid manifest and Demo. IDF1/IDSW/MOTA on real detection sequences, complete costs, and video/camera scheduling remain separate acceptance tasks. Portal Workflow remains deferred.
