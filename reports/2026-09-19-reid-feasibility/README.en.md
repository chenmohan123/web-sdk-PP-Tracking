# ReID / DeepSORT feasibility

[中文](README.md)

Date: 2026-09-19. Scope: a local single-SDK feasibility spike. Recommendation: **continue an independently implemented DeepSORT-inspired strategy in the same `web-sdk-pp-tracking` package, starting with caller-supplied appearance vectors. Do not release this ReID candidate.**

The product remains the local `0.2.0-alpha.0` ByteTrack/OC-SORT candidate; the published version remains `0.1.0`. No algorithm selector, production dependency, media feature, or model manifest was added. Scripts in this report are disposable research probes retained for reproducibility, not SDK API or Demo implementation.

## Sources and candidates

[sources.lock.json](sources.lock.json) fixes repository revisions, document URLs, lengths, and SHA-256 hashes. Reading was limited to documentation, configuration, licenses, and the Apache-2.0 converter's MVN adapter. No upstream DeepSORT, SORT, Paddle tracking, or Kalman implementation was read or copied.

| Candidate | Verified facts | Decision |
| --- | --- | --- |
| PaddleDetection PPLCNet ReID | Revision `b25522a0f4bde8c80603f3ba5e3472059972e3b5`; repository Apache-2.0; README names Market1501 with 751 training identities; config has `input_size: [64,192]` and 512 output channels | Closest Paddle candidate for the next model study. No weights were downloaded or converted. Checkpoint-specific distribution evidence and full crop/color/normalization contract remain unverified. README/config weight URLs use different directory paths and must be resolved to exact bytes |
| Original DeepSORT / mars-small128 | Revision `f08cf1dc470eeb1cd2add1cbf077d95ac6c48aab`; code GPL-3.0; README references a TensorFlow 1.5 graph with 128 features | Do not directly incorporate original code or external Drive weights into this Apache SDK. Code licensing does not automatically establish the external weight license |
| Torchreid OSNet-x0.25 | Revision `f8cd150fdf77e8d9e1ed143b7f308c2c609ded50`; code MIT; model zoo separates ImageNet, Market1501, DukeMTMC, and MSMT17 checkpoints | Alternative only. No specific checkpoint fixed or converted. An ImageNet checkpoint is not equivalent to a ReID-trained checkpoint; upstream research scores are not our measurements |
| Intel person-reidentification-retail-0288 | OMZ revision `6697dead54ed1cdd664b0313189c2cb52ee6335e`; its own model manifest explicitly links Apache-2.0; BGR NCHW `[1,3,256,128]` → 256 features | Small, explicitly licensed technical probe. It is an Intel model, not a Paddle weight. Conversion and browser costs measured; boundary inputs failed, so no integration |

Training dataset names alone neither establish all redistribution terms nor prove a checkpoint is prohibited for commercial use. Paddle/Torchreid checkpoint and dataset terms were not fully verified here; this is an unresolved evidence status, not a legal conclusion. OMZ reports Market1501 evaluation but does not disclose a complete training dataset list. Do not mislabel the evaluation set as training provenance. Future distribution must retain applicable licenses, attribution, and conversion notices.

Primary algorithm reference: [DeepSORT paper v1](https://arxiv.org/abs/1703.07402v1). GPL implementations are not translation inputs. The pinned Paddle README, original DeepSORT README, Torchreid model zoo, and OMZ manifest are all indexed in the source lock.

## Conversion and numerical evidence

Original XML: 450,664 bytes. FP32 BIN: 728,052 bytes. Both match official SHA-384 values; SHA-256 recorded in [assets.lock.json](assets.lock.json). Conversion used Apache-2.0 openvino2onnx 1.1.0, opset 17.

The unadapted graph failed in Python ORT 1.23.2 because a LayerNormalization reduction had one element: `Size of X.shape[axis:] must be larger than 1, got 1`. Replacing only the four singleton MVNs removed that exception, but constant inputs still produced non-finite ONNX output while the original OpenVINO graph remained finite.

The final experimental graph expands all 14 MVNs into the original centered-variance formula `(x-mean(x))/sqrt(mean((x-mean(x))²)+epsilon)`, checking axes, variance normalization, `INSIDE_SQRT`, and epsilon against the IR. Weights are unchanged; graph optimization is basic. This is an experiment, not a validated general converter fix.

- ONNX: **991,822 bytes** (0.946 MiB), SHA-256 `50ec57f754c2e277a309607ef2b27f3ce67fe89dd637bf156c9be0b7bb6362e4`.
- Input: raw BGR float32 in 0–255. The graph already includes channel reversal and mean/scale; do not normalize twice.
- Output: `[1,256]`; observed norms 10.54–18.51, not unit vectors. Cosine comparison requires normalization or explicit norms.
- Eight deterministic synthetic tensors: black, white, six texture patterns. No natural images, identity-labeled people, or tracking video.
- Reference: OpenVINO 2025.4.1 CPU with FP32 forced. Python ORT 1.23.2 single-thread/basic passed all eight, max absolute difference `0.0003406703472137451`, max cosine distance `1.5390648866464574e-8`, using preselected limits `<1e-3` and `<1e-5` respectively.

## Browser validation failed

Chromium 153.0.8010.12, Windows 11, i5-10400F, RTX 5060 Ti driver 32.0.16.1692, ORT Web 1.27.0, headless desktop/main/basic. WASM has one thread. WebGPU selected the NVIDIA Blackwell non-software adapter and disabled CPU EP fallback.

| Against original OpenVINO | Passed / 8 | Max absolute difference | Max cosine distance | Result |
| --- | ---: | ---: | ---: | --- |
| Python ORT CPU | 8 | 0.0003406703 | 0.00000001539 | Passed within this probe |
| Browser WASM | 6 | 0.6726350784 | 0.03885450690 | Black/white failed |
| Browser WebGPU | 6 | 0.1527701318 | 0.002740533916 | Black/white failed |

The six textures had max absolute differences about `8.595e-5` (WASM) and `2.158e-5` (WebGPU). Boundary failures were not removed or excused by wider limits. The precise remaining cross-backend divergence point is unresolved; further layer diagnostics and low-contrast, occlusion, and natural-image checks are required. Unused-constant warnings from conversion remain in raw browser logs.

## Execution cost

Timings cover `session.run` with prepared tensors, including GPU output readback. Each backend used five warmups and 30 single-crop runs; 8/16 serial crops each used five repetitions. The probe reports the upper middle sample as median. Separate loops are not a linear speed ranking.

| Browser backend | Single median | Single P95 | 8 serial crops median | 16 serial crops median |
| --- | ---: | ---: | ---: | ---: |
| WASM | 19.135 ms | 24.305 ms | 141.610 ms | 291.000 ms |
| WebGPU | 20.185 ms | 30.680 ms | 122.680 ms | 214.380 ms |

Session creation was about 885/936 ms and first inference 52/810 ms (WASM/WebGPU). Local HTTP fetch timings are separate and are not ModelScope/Hugging Face download measurements. These exclude decoding, cropping, detection, association, Workers, and media scheduling. No batching, multithreading, mobile, camera, or NPU was tested. Small weights do not establish multi-person real-time performance, and GPU is not necessarily faster for one crop. Batch/frequency changes must be evaluated together with identity quality.

## Recommended next boundary — not an exported API

1. Add an independently implemented `algorithm: 'deepsort'` strategy in the same package, receiving boxes, confidence, class, timestamp, and appearance vectors. Association remains CPU/main; optional model inference reports its WASM/WebGPU backend separately.
2. Fix feature-space identity and dimension per instance. Identity binds weight hash, preprocessing version, and output definition. Frames must use that identity and vectors must be bound to detections. Equal-dimensional vectors from different models are not interchangeable.
3. Initially require finite, correctly dimensioned, nonzero vectors for DeepSORT detections. Copy and normalize internally. Reject a whole frame atomically for missing/invalid vectors, changed identity, or pre-cancellation, with no silent ByteTrack fallback. Empty detection frames remain valid. An explicit missing-feature policy can be designed separately later.
4. Design cosine nearest-neighbor galleries, motion gating, matching cascades, and bounded IoU fallback from the paper, using the project's independent math and seconds-based lifecycle. Document coordinate/time differences; do not claim official numerical equivalence. Similar clothing, occlusion, and camera movement can still switch IDs.
5. Bound per-track galleries and global state; deletion/reset/dispose clear appearance history. For 100 tracks × 100 float32 vectors, raw vectors alone need about 9.77 MiB at 256 dimensions or 19.53 MiB at 512, excluding objects and matrices.
6. Keep model extraction optional within the same SDK, potentially a separate import entry. Box-only consumers must not load ORT/weights. External-vector-only algorithms fit standard 1.2.0; adding model loading to the package first requires a standard extension for combined algorithm/model declarations, assets, cache, and verification. No schema or product manifest was prematurely changed.
7. Add a Demo option only when the algorithm is implemented, clearly identifying external-vector examples. Videos/cameras still require frames, detections, and feature extraction. The portal records the roadmap; Workflow remains deferred.

Implementing the complete video/ReID path now would combine unresolved model, standard, and media issues. Splitting every algorithm into a new npm package conflicts with the agreed route. The recommended sequence is external-vector association first, optional validated extraction later.

## Next acceptance gates

- Fix formulas/contracts, then test ambiguous coordinates with different appearance, similar appearance, reappearance, class/motion gates, atomic errors, bounded galleries, and isolated instances. Synthetic vectors establish mechanics only.
- Compare ByteTrack, OC-SORT, and DeepSORT on the same detections using permitted image sequences with identity ground truth; report IDF1, IDSW, MOTA, FP/FN and all processing costs. Existing `MOT17Labels.zip` contains no images and cannot supply real ReID features. Do not synthesize identity vectors and call the result real-world accuracy.
- Resolve the exact PPLCNet checkpoint, licensing evidence, color/crop/normalization, then run Python/browser comparisons. Reconsider OMZ only after boundary failures and real-image checks are resolved; it is not a selected default release model.
- Extend the standard before optional model loading. Future distribution stays ModelScope by default with Hugging Face available, fixed revisions/hashes/size/licenses and explicit-source failure semantics. No model repository was created or updated here.

## Evidence and reproduction

Source/asset locks fix inputs. `evidence/python-result.json`, `fixtures.json`, and `browser-result.json` retain reference and browser vectors, numerical comparisons, individual timings, and warnings. `adaptation.json` records graph edits/hashes; `environment.json` records hardware and SDK base. `requirements.lock.txt` records installed versions, not a cross-platform wheel hash guarantee. `evidence.lock.json` and `verify_archive.py` validate archive integrity and recompute acceptance; archive consistency does not mean model acceptance.

From the SDK root, copy the five scripts in `probe/` and `sources.lock.json` to a new `.tmp/reid-reproduction/`. Create an isolated Python 3.11 environment and install `requirements.lock.txt`, then run:

```powershell
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/fetch_sources.py
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/download.py
.tmp/reid-reproduction/venv/Scripts/openvino2onnx.exe .tmp/reid-reproduction/assets/person-reidentification-retail-0288.xml .tmp/reid-reproduction/assets/reid-0288-fp32.onnx -v 17
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/adapt.py
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/prepare.py
node .tmp/reid-reproduction/browser.mjs
```

Use SDK dev dependency Playwright 1.63.0/Chromium. Set `TRACKING_REID_ORT_DIST` to an absolute ORT Web **1.27.0** `dist` directory; the default only reads the existing local Detection installation. The temporary localhost server closes at completion and does not alter the port-4204 Demo. Current evidence predicts browser exit **1** with both `validationPassed: false`; do not turn it into success. Keep reruns separate from sealed evidence. No upstream images, tracking source, or model binaries need to be committed.

Verify the archive with `python reports/2026-09-19-reid-feasibility/verify_archive.py`. Pre/post SDK checks reside in the portal at `reports/sdk-standard/tracking-reid-{before,after}-20260919.json`. They validate the existing two-algorithm product declarations, not this unintegrated model.
