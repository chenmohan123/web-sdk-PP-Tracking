# PPLCNet ReID FP32 local evaluation

[简体中文](README.md)

Date: 2026-09-19. Layer: disposable research for a single SDK. **PPLCNet ReID FP32 conversion is complete; Python, browser WASM and WebGPU each pass all 32 numerical comparisons. It remains a candidate for an optional ReID module in this package.** An upstream crop-axis difference affects retrieval quality, so the model has not been integrated or declared stable.

The local SDK remains `0.2.0-alpha.0`, with ByteTrack, OC-SORT and external-embedding DeepSORT. Production remains `0.1.0`. This work adds research scripts, evidence and documentation only; no weights, npm version, Demo or API were published. The probe is not production runtime, and browser model execution does not mean the SDK already provides GPU tracking.

## Model and provenance

The pinned upstream is [PaddleDetection b25522a](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5), not the Intel OMZ model. Its root LICENSE, model file and inspected preprocessing headers state Apache-2.0. No upstream tracker, matching or Kalman implementation was read, copied or imported. Immutable source identities are in [sources.lock.json](sources.lock.json).

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Official PPLCNet ReID checkpoint | 36,769,814 | `abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758` |
| Local FP32 ONNX, opset 17 | 33,704,835 (32.14 MiB) | `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4` |

The README URL under `models/mot/deepsort/` and the config URL under `models/mot/` return identical bytes. The reproduction fetcher now enforces this checkpoint size and hash. The original Apache model structure is used with only the `ppdet` registration dependency removed. All 146 inference state tensors of `PPLCNetEmbedding(scale=2.5, input_ch=1280, output_ch=512)` load with matching names and shapes; no missing tensor is randomly initialized. The extra checkpoint `head.weight [512,1502]` is a training classifier absent from the official embedding forward and is unused. Its width does not establish a training-data inventory. The README states Market1501, 751 identities, with training details pending publication by PaddleClas.

Verified licensing evidence covers code, official weight links and file identity. The inspected files did not include a checkpoint-specific model card or complete training-data terms. The repository code license alone does not fill these gaps, nor does this establish that commercial use is prohibited. Before distribution, document the applicable licensing basis, provenance, conversion differences and limits of the training disclosure. Nothing was uploaded to ModelScope or Hugging Face.

## Preprocessing

The input is FP32 NCHW `[1,3,192,64]`, output `[1,512]`, without in-graph L2 normalization. Observed output norms are about 3.24–5.83. Cosine retrieval and tracking must normalize; a raw dot product is not cosine similarity.

The pinned deployment decodes RGB. `get_crops` transposes HWC into WHC, crops by x/y and does not transpose back. `preprocess_reid` resizes to width 64, height 192, reverses channels, divides by 255, and applies means `[0.485,0.456,0.406]` and standard deviations `[0.229,0.224,0.225]`. This produces a **transposed BGR crop**. The probe executes only those two audited preprocessing functions and confirms exact equivalence on an asymmetric, non-square fixture, without importing the tracking program.

Four explicit alternatives are compared: upright RGB, upright BGR, transposed RGB and upstream transposed BGR, using OpenCV 4.11 `INTER_LINEAR`. MOT's one-based coordinates become zero-based half-open crops. Numerical tests send identical hashed FP32 tensors to all engines; **browser Canvas resizing has not been checked for pixel agreement with OpenCV**. Upright RGB is a candidate based on this sample, not proof of the undisclosed training preprocessing. Weight hash, orientation, channels, resize, normalization and output definition must jointly identify the feature space; different 512-dimensional spaces are not interchangeable.

## Numerical results and cost

The [pre-run protocol](protocol.md) requires finite nonzero outputs, maximum absolute error `< 1e-3` and cosine distance `< 1e-5` per sample. The reference is Paddle 2.6.2 CPU FP32 eval, converted with paddle2onnx 1.3.1 / ONNX 1.16.2. Inputs comprise black, white, low contrast, three RGB colors, texture, checkerboard, and 24 real pedestrian crops.

| Against original Paddle | Passed / total | Maximum absolute error | Maximum cosine distance |
| --- | ---: | ---: | ---: |
| Python ORT 1.20.1 CPU | 32 / 32 | `1.54972e-6` | `2.99549e-12` |
| ORT Web 1.27.0 WASM | 32 / 32 | `2.35438e-6` | `3.40206e-12` |
| ORT Web 1.27.0 WebGPU | 32 / 32 | `2.44379e-6` | `4.53371e-12` |

Environment: Windows 11 Pro 10.0.26200, Intel i5-10400F, RTX 5060 Ti, driver 32.0.16.1692, Chromium 153.0.8010.12 headless/main. Basic graph optimization, single-thread WASM; the GPUDevice actually used by ORT reports a non-fallback NVIDIA/Blackwell adapter, with CPU EP fallback disabled. No browser console warnings/errors were recorded. This does not establish support for phones, other browsers, Workers, NPU or batches.

| Backend | Single crop median | Single crop P95 | 8 serial crops median | 16 serial crops median |
| --- | ---: | ---: | ---: | ---: |
| WASM | 33.925 ms | 41.620 ms | 273.175 ms | 550.300 ms |
| WebGPU | 5.932 ms | 7.585 ms | 63.865 ms | 97.730 ms |

Prepared real crops are used for 5 warmups, 30 single-crop runs and 5 repeats at each serial count. Standard median averages the two central observations for even counts; P95 uses nearest rank. Timings include execution, output readback, array copying and output disposal, excluding decoding, cropping, detection, association and scheduling. WASM/WebGPU session creation was about 772/819 ms; first inference 72/504 ms; local HTTP fetch 249/254 ms. Driver shader caches were not cleared, so first inference is not a fresh-device cold start. These are not model-host download speeds or end-to-end video FPS and should not be used for direct speed ratios against the earlier OMZ probe's different measurement definition.

The table uses the final probe after adding ORT's actual GPUDevice information. The initial probe only recorded the capability-query adapter and also passed 32/32 on both backends; its raw results remain in `evidence/browser-initial.json.gz`. Final results are in `browser-result.json.gz`; values are not selected across runs for best timing.

## Real-image sample

HTTP ranges from the official MOT17 ZIP transferred about 6.93 MB for frames `[1,31,61,91,121,151]` of `MOT17-02-FRCNN` and `MOT17-04-FRCNN`, plus GT. Image/annotation hashes are in [data.lock.json](data.lock.json). The fixed filter selects valid pedestrians, visibility ≥0.7, fully in-frame boxes, width ≥16 and height ≥48. Frame 1 is the per-sequence gallery; later occurrences of those IDs are queries. This gives 120 crops, 25 gallery identities and 95 queries. Identity labels are real GT, not augmentation labels, and no detector is used.

| Preprocessing | Correct first match | Rank-1 | Same-ID rejected at distance 0.2 / 95 | Different-ID accepted / 1274 |
| --- | ---: | ---: | ---: | ---: |
| Upright RGB | 87 / 95 | 91.58% | 27 | 24 |
| Upright BGR | 85 / 95 | 89.47% | 21 | 12 |
| Transposed RGB | 70 / 95 | 73.68% | 15 | 241 |
| Upstream transposed BGR | 75 / 95 | 78.95% | 19 | 104 |

Upright RGB same-ID/different-ID median cosine distances are 0.1388/0.5079, with 30/31 and 57/64 correct in the two sequences. Its better Rank-1 does not also dominate upright BGR's rejection/acceptance counts. These 95 correlated queries cannot determine final channel order or threshold, establish cross-camera/general benchmark accuracy, or demonstrate video IDF1/MOTA gains. Distance 0.2 is a predeclared single-vector diagnostic; the SDK's motion gating and multi-vector gallery will behave differently.

As checked on 2026-09-19, the MOT17 page is a static archive and its homepage returns 410, while downloads remain available. Complete current dataset terms were not obtained. Original images, full GT and image examples are not redistributed. See [source-review.json](evidence/source-review.json) for response identities and evidence limits.

## Reproduction and next stage

`evidence/` contains original Paddle/ORT/browser vectors, all errors, 480 quality vectors, retrieval records, raw timings and environment; `summary.json` is a compact derivative. `verify_archive.py` independently recomputes numerical, retrieval, threshold and timing conclusions without calling the inference implementation. Weights, ONNX, images, full GT and input tensors remain in ignored `.tmp/pplcnet-reid/`. `requirements.txt` pins observed direct Python dependencies, not transitive dependencies or platform wheels.

From the SDK root, use Python 3.11 with those dependencies. Replace `<python>` with that interpreter:

```powershell
<python> reports/2026-09-19-pplcnet-reid/probe/fetch.py --work .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/probe/data.py --work .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/probe/export.py --work .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/probe/evaluate.py --work .tmp/pplcnet-reproduction
node reports/2026-09-19-pplcnet-reid/probe/browser.mjs .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/verify_archive.py
```

The browser probe uses repository Playwright; `TRACKING_REID_ORT_DIST` can specify an ORT Web 1.27.0 dist directory. Archive verification checks the committed evidence. New inference results remain in the separate temporary directory and must be checked against original source/data hashes without overwriting history.

Next, freeze an upright crop/color/interpolation contract, use independent samples to check channels and thresholds, verify browser image preprocessing, and complete distribution documentation. Before adding an optional extractor in this package, evolve the algorithm/model hybrid standard and define lazy loading, feature-space identity, backend reporting, cancellation and disposal. Then compare all three strategies on identical real detections with ID metrics and full cost. Distribution is still planned as ModelScope default and Hugging Face optional. Video/camera input, BoT-SORT, JDE, FairMOT, CenterTrack and portal Workflows are outside this research stage.

## Local delivery verification

Archive hashes and numerical, retrieval and timing recomputation pass. The SDK's full `verify` exits 0: 104/104 unit tests, type checks, core/Demo/Vanilla/React builds, actual three-algorithm package consumption and 12 browser interaction groups pass. Runtime and 22,522-byte tarball hashes remain identical to the starting baseline. Standard before/after checks each pass 17 required rules with zero failures, establishing only locally-compliant status. Portal tests pass 99/99; Astro checks and the 21-page build pass with seven existing hints and zero errors/warnings. See [validation.json](evidence/validation.json), [SDK log](evidence/sdk-verify.log) and [browser report](evidence/sdk-browser.json). The 390px viewport check is not a physical phone test.
