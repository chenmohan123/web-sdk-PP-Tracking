# ReID distribution and local public subpath

[中文](README.md) · [API guide](../../docs/en/reid-candidate.md)

Date:2026-09-21. Fixed human ReID weights are distributed on both hubs; the package subpath, local image workspace and1.3 hybrid manifest are implemented. The SDK remains a local `0.2.0-alpha.0` candidate. npm, GitHub Release and the hosted Demo remain `0.1.0`; this stage did not push GitHub, publish npm or deploy the hosted Demo.

## Model and sources

PPLCNet ReID FP32/ONNX opset17, `[1,3,192,64]` input and512-dimensional L2 output. Weights:33,704,835 bytes, SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`. Parameter count is null;8,419,792 includes BN inference-state elements and is not a trainable-parameter count.

| Source | Immutable revision |
| --- | --- |
| ModelScope(default) | `dc3d9f7a97be4033e654525f0e9d3fbd5eaf7c9b` |
| Hugging Face(optional) | `02c299b5b5618315fc754002b7ea7c95c95e8a82` |

Both repositories are `chenmohan/web-sdk-pp-tracking`, with path `pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx`. [Receipts](distribution.json) pin actual URLs, anonymous downloads and hashes; the[11-file inventory](upload-inventory.json) includes weights, bilingual cards, LICENSE, NOTICE and metadata. Weights and source images are excluded from Git/npm.

Distribution relies on the pinned official repository's Apache-2.0 license for its explicitly linked human checkpoint, retaining attribution and conversion notice. The[model card](../../models/pplcnet-reid/0.1.0/README.en.md) states that checkpoint-specific authorization/cards and a complete training account were not found. Official disclosure names Market1501 and PaddleClas, with details pending; dataset terms are not equated with model licensing. The root README is symlink text; actual README_en was checked. The separate ReID README returned200 this round; NOTICE404 does not prove no other statement exists.[Upstream evidence](upstream-evidence.json) pins URLs/status/hashes.

## SDK and Demo

The root `web-sdk-pp-tracking` retains three CPU/main strategies and createTracker/TrackingError exports. Optional `web-sdk-pp-tracking/reid` provides ESM/CJS/types; ORT Web1.27.0 is an optional peer loaded dynamically during session creation. Root consumers need no ORT. Importing the subpath, creating and disposing without load do not load the engine. MS is default, HF explicit, without silent source fallback.

The Demo defaults to boxes/vectors. Image-plus-detections accepts a local image and caller-provided human boxes, extracts features and feeds DeepSORT without a detector. Model WASM/WebGPU and CPU association are separate. Successful frames advance100ms; failed/cancelled frames do not. Same-size images preserve tracks; size changes require reset. Source/backend changes release/reset; full cleanup waits for tasks and clears only this SDK's cache. Limits:20MiB,8192 per side,16777216 pixels and32 boxes. Transparent-file decoding is not claimed byte-faithful.

## Dated verification

Local Windows11 10.0.26200, i5-10400F, RTX5060Ti/32.0.16.1692, Chromium153.0.8010.12, ORT1.27.0 and Node24.16.0:[environment](evidence/environment.json).

| Check | Result |
| --- | --- |
| Actual MS/HF × WASM/WebGPU | Four isolated cold-cache pages each downloaded the selected fixed URL once; stored with matching SHA/source |
| Independent normalized Paddle comparison | WASM maxAbs2.4586915969848633e-7; GPU2.53552570939064e-7; cosine/unit-norm thresholds passed |
| Actual GPU | NVIDIA Blackwell, non-fallback; requested and actual backends match |
| Vite production model Demo | Real MS/WASM and HF/WebGPU, consecutive frames, language, invalid input, cancellation, reset/cleanup and unrelated-cache preservation |
| UI | Default/mode-only entry requests no ORT/model; empty preview valid;390px Chinese/English without horizontal overflow |
| Complete SDK verify | 13 files/164 unit tests,12 existing browser groups, types/package/core/Demo/Vanilla/React builds passed |
| Standard after | 21 required passed,0 failed,4 remote skips; locally-compliant only |

Source validation uses the previous stage's first real crop and independently normalizes Paddle output; it does not rerun the34-fixture matrix.[Four raw vectors](evidence/sources-browser.json),[production interactions](evidence/demo-browser.json),[complete log](evidence/sdk-verify.log) and[existing browser results](evidence/sdk-browser.json) are archived separately. Vite warns that the independent ORT chunk exceeds500kB; it is an explicit model-mode cost, not a default-page request. Portal build:21 pages,0 errors/warnings,7 existing hints.

The actual tarball is45,703 bytes (151,027 unpacked), SHA-256 `2af81f61beda65c1256df01eb89c2f85f2414f8ba471e432b836b35deb6b0b1f`.[Package receipt](evidence/package-check.json) records sha512 and file allowlist. A system-temp consumer with no ORT successfully consumed both entry formats and NodeNext declarations. No weights,WASM,source images or React production dependency are packed.

[Final review](evidence/final-review.md) found no Critical/Important issue. Commit8126365 then clarified the current-load label, rejected stale cache-usage writes and clarified the Chinese root-entry introduction, retaining the ORT size notice. Afterward,11 controller tests,Demo types/build,standard checks and4 real-CacheStorage race regressions passed, followed by a fresh production UI run on both model backends. The164-test full verify is the pre-fix stage record; the complete suite was not repeated or misrepresented. Root runtime and package artifacts are unchanged. See the[fix report](evidence/final-fix-report.md),[scoped review](evidence/final-fix-review.md) and[race evidence](evidence/final-fix-cache-ui.json).

## Reproduction and limits

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
node tests/reid-distribution-browser.mjs
node tests/reid-demo-browser.mjs
node tests/reid-cache-ui-browser.mjs
node reports/2026-09-21-reid-distribution/verify_archive.mjs
node reports/2026-09-21-reid-distribution/verify_archive.mjs --current
```

The real-source script needs pinned RGBA in `.tmp/reid-preprocessing-20260920/assets`; the Demo script generates its own PNG. Sources need network access and the browser must match Playwright. archive.mjs is a maintainer collector for completed evidence; normal review uses verify_archive.mjs without rebuilding the trusted lock. `--current` also checks current LF source,dist and.tmp tarball identity, only against the matching build. The distribution script defaults to prepare; do not blindly republish an existing version.

Artificial images and repeated frames establish interfaces, not identity accuracy gains or video FPS. Identical-input ByteTrack/OC-SORT/DeepSORT temporal IDF1/IDSW/MOTA and complete cost remain future work, as do video/camera scheduling, phones,Safari/Firefox,Worker/NPU and portal Workflow.

Scope decisions: authorization covers the previously proposed model hubs and local integration, leaving SDK release later; repository-wide official licensing is used with disclosure gaps retained; unknown trainable parameter count is null. Revisions to those decisions would require model-version withdrawal/release scheduling, distribution-material review or parameter-statistics correction, without expanding compatibility claims.
