# PPLCNet ReID image preprocessing and independent samples

[中文](README.md)

Date: 2026-09-20. Scope: research and integration preparation for one SDK. **Deterministic decoded RGBA-to-embedding preprocessing passed on the tested desktop and supports proceeding with an optional ReID module.** Byte-exact decoding of arbitrary transparent PNGs failed; the counterexample is retained and is not counted as a pass.

The product remains three CPU/main tracking strategies, locally `0.2.0-alpha.0`, with `0.1.0` online. This work adds research scripts, reports, a model card and designs, without a new npm API, Demo control or model distribution. See the [model card](model-card.en.md) for provenance and limitations and the [protocol](protocol.md) for original gates and the recorded deviation.

## Image contract and numerical results

The previous FP32 ONNX is unchanged: 33,704,835 bytes, SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`, input `[1,3,192,64]`, output 512 dimensions. The original Paddle static graph and parameter hashes are also checked before loading the reference.

Preprocessing ID: `rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`. The caller supplies decoded, upright, non-premultiplied sRGB RGBA8. Intersect the box with the image, floor left/top and ceil right/bottom; composite alpha against white before interpolation, retain upright RGB, resize to 64×192 with half-pixel bilinear sampling and float64 intermediates, then apply ImageNet normalization and write FP32. The protocol and tests define dimensions, invalid boxes, shared buffers and input immutability. The research pixel function allows clipping; the future production extractor accepts only complete in-image boxes compatible with Tracker.

Eight synthetic boundary fixtures and 26 real crops selected by a fixed rule produce 34 cases:

| Path | Maximum tensor error versus Python | Maximum embedding error versus Paddle | Result |
| --- | ---: | ---: | --- |
| Node preprocessing | 0 | No inference | 34/34 |
| Python ORT | Reference tensor | 1.818e-6 | 34/34 |
| Chromium WASM | 0 | 1.818e-6 | 34/34 |
| Chromium WebGPU | 0 | 2.444e-6 | 34/34 |

The predeclared tensor gate is maxAbs ≤2e-6; embeddings must satisfy both maxAbs <1e-3 and cosine distance <1e-5. Gates were not relaxed. All seven pixel-contract tests first failed, then passed; both logs are retained.

All 33 **opaque** PNG fixtures decode to identical RGBA pixels. Five JPEGs also match in this particular OpenCV/Chromium matrix and are separate diagnostics. A four-pixel transparent PNG counterexample changes 7/16 channel bytes, with maximum error 247: Canvas can lose hidden transparent RGB and quantize semi-transparent colors. Passing white compositing from raw RGBA does not prove file decoding fidelity. The next entry therefore accepts decoded RGBA; file decoding, EXIF and other browsers require separate validation. See [decode-diagnostics.json](evidence/decode-diagnostics.json).

## Independent-sequence quality

MOT17-05/09/10/11/13-FRCNN are independent of the previous 02/04 sequences. Frames are fixed at 1/31/61/91/121/151. Keep GT pedestrians with mark=1, class=1, visibility≥0.7, complete in-image boxes, width≥16 and height≥48; convert MOT one-based coordinates to zero-based. Frame 1 is the gallery and later matching identities are queries. No sequences were selected based on results. HTTP Range transferred 9,001,707 bytes for 30 images, five GT files and five sequence metadata files; identities are in [data.lock.json](data.lock.json). Original images and complete GT are not committed.

There are 103 crops: 36 gallery identities and 67 queries.

| Path | Correct first match | Micro Rank-1 | Sequence macro Rank-1 |
| --- | ---: | ---: | ---: |
| OpenCV RGB | 52/67 | 77.61% | 83.08% |
| OpenCV BGR | 50/67 | 74.63% | 78.83% |
| Deterministic float RGB | 53/67 | 79.10% | 84.33% |
| Deterministic float BGR | 50/67 | 74.63% | 78.83% |

Float RGB is correct on 2/2, 9/10, 17/24, 11/15 and 14/16 queries respectively, supporting the RGB candidate. Sequence 05 has only two queries, so macro averaging is sensitive to small sequences. This is a small, same-camera, closed-set retrieval experiment using GT crops, not cross-camera evaluation or real-detection tracking IDF1/MOTA.

The existing distance threshold 0.2 was not tuned. Diagnostics at all fixed thresholds 0.1/0.2/0.3/0.4 are retained. At 0.2, float RGB rejects 37/67 same-ID pairs and accepts 8/555 different-ID pairs; float BGR gives 46/67 and 6/555. Higher Rank-1 does not imply better behavior at every association threshold. Temporal tracking with a multi-vector gallery and motion gating remains to be measured.

## Desktop timing and limits

Windows 11, i5-10400F, RTX 5060 Ti, Chromium 153.0.8010.12 and ORT Web 1.27.0. WASM uses one thread and basic graph optimization. WebGPU reads NVIDIA/Blackwell from the actual ORT GPUDevice, with isFallbackAdapter=false and CPU EP fallback disabled.

One real crop, five warmups and 30 measured runs; medians:

| Backend | Preprocess | Inference | Normalize | Total |
| --- | ---: | ---: | ---: | ---: |
| WASM | 1.190 ms | 58.930 ms | 0.095 ms | 60.263 ms |
| WebGPU | 1.210 ms | 9.240 ms | 0.085 ms | 10.525 ms |

Inference includes input Tensor construction, ORT run, output readback and disposal. Total is measured by an outer clock. Column medians are independent and must not be added to replace total. Decoding, detection, association, downloads and frame scheduling are excluded. The previous tensor-only timings use a different scope; no direct speedup or full-video real-time claim is made. Phones, Workers, NPU, other browsers, cameras and dynamic batch are untested.

## Provenance, design and next steps

The root license and the model/preprocessing source headers at PaddleDetection commit `b25522a0f4bde8c80603f3ba5e3472059972e3b5` are Apache-2.0. Its README reports Market1501 training with 751 classes and pending training details. The extra 1502-dimensional training head is not used for inference and does not justify guessing training data. Checkpoint-specific terms and complete training-data conditions have not been independently verified; that is not a claim that commercial use is prohibited. [sources.lock.json](sources.lock.json) records checked URLs, times, hashes and a 404 response. One missing README cannot establish that no statement exists elsewhere.

The portal contains a hybrid algorithm/model declaration proposal and optional module design: implement schema/rules/checker first, then add `web-sdk-pp-tracking/reid`, binding featureSpace to model hash, preprocessing and L2 rules, with concurrency, cancellation, whole-frame atomicity and disposal. Association remains CPU; model WASM/WebGPU is reported separately. The active standard is still 1.2.0; neither the proposal nor the example API is implemented.

Distribution is planned with ModelScope as default and Hugging Face as an option. No upload occurred, and no download URL or revision is invented. Before a production Demo or distribution, document the adopted license basis and attribution, then verify both real sources and hashes. Next compare tracking strategies and complete costs on identical real detections before deciding on release.

## Reproduction and archive

Offline recalculation needs no model or network:

```powershell
python reports/2026-09-20-reid-preprocessing/verify_archive.py
node --test reports/2026-09-20-reid-preprocessing/probe/preprocess.test.mjs
```

Full inference requires Python 3.11 with the [previous dependency versions](../2026-09-19-pplcnet-reid/requirements.txt), repository Playwright and ORT Web 1.27.0. First prepare the fixed original Paddle and ONNX assets under `.tmp/pplcnet-reid/` as described in the [previous report](../2026-09-19-pplcnet-reid/README.en.md). Run from the SDK root, replacing `<python>` with that interpreter and using a fresh temporary directory:

```powershell
<python> reports/2026-09-20-reid-preprocessing/probe/data.py --work .tmp/reid-preprocessing-reproduction
<python> reports/2026-09-20-reid-preprocessing/probe/provenance.py --work .tmp/reid-preprocessing-reproduction
<python> reports/2026-09-20-reid-preprocessing/probe/evaluate.py --work .tmp/reid-preprocessing-reproduction --previous-work .tmp/pplcnet-reid
node reports/2026-09-20-reid-preprocessing/probe/node-check.mjs .tmp/reid-preprocessing-reproduction
node reports/2026-09-20-reid-preprocessing/probe/browser.mjs .tmp/reid-preprocessing-reproduction
<python> reports/2026-09-20-reid-preprocessing/probe/prepare-diagnostic.py --work .tmp/reid-preprocessing-reproduction
node reports/2026-09-20-reid-preprocessing/probe/decode-diagnostics.mjs .tmp/reid-preprocessing-reproduction
```

Set `TRACKING_REID_ORT_DIST` to the ORT Web 1.27.0 dist directory; the default is this machine's Detection installation. Raw vectors, identities of the 34 fixtures, every retrieval and threshold record, and individual timings are archived in `evidence/`, with byte identities in `evidence.lock.json`. `verify_archive.py` independently recalculates numerical results, retrieval and thresholds without inference. Original data/models stay ignored. `probe/archive.py` is a maintainer tool that updates this report; do not use it to overwrite historical evidence during reproduction.

## Delivery checks

Independent [review](evidence/review.md) passed. All three findings concerning transparent PNG scope, Paddle reference identity and the OOM error design are resolved, with no outstanding issues. Archive hashes and raw-vector, retrieval and threshold recalculations pass. Offline tensor verification checks identities and existing records; rerunning preprocessing requires original images prepared with the steps above.

Full SDK verify exits 0: 104 unit tests, type checks, core/Demo/Vanilla/React builds, three-strategy package consumption and 12 browser checks pass. Runtime and 22,522-byte tarball hashes match the stage baseline, so research files are excluded from the release package. Standard before/after each show 17 required passes and zero failures, meaning locally-compliant only. Portal tests pass 99/99; 21 pages build, with Astro reporting zero errors, zero warnings and seven existing hints. See [validation.json](evidence/validation.json), [SDK log](evidence/sdk-verify.log) and [browser receipt](evidence/sdk-browser.json). The 390px layout check is not a physical-phone test.
