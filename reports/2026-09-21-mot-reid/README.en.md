# Real-image evaluation of three trackers and ReID (2026-09-21)

[中文](README.md) · [Protocol](protocol.en.md) · [Machine summary](summary.json) · [Original official metrics](raw/metrics.json)

Keep ByteTrack as default. For version 0.2, retain OC-SORT and DeepSORT as explicit options and label PPLCNet ReID experimental for human scenarios. This report performs no publication: npm, Release and the hosted Demo remain 0.1.0; the local candidate is 0.2.0-alpha.0.

All 5316 frames and 67639 detections from the seven fixed MOT17 FRCNN training sequences were evaluated at `0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`. Chromium extracted every detection's features with actual WebGPU; all three trackers ran on CPU/main. Browser MOT/non-timing outputs matched both frozen-input Node repetitions, with zero capacity drops. Official TrackEval combined results below are not averages of sequence percentages.

| 算法 / Algorithm | IDF1 % | IDSW | MOTA % | FP | FN |
| --- | --- | --- | --- | --- | --- |
| ByteTrack | 48.2922 | 1101 | 44.4010 | 4169 | 57166 |
| OC-SORT | 48.4107 | 881 | 39.5434 | 6751 | 60259 |
| DeepSORT + PPLCNet | 45.4637 | 1030 | 44.7608 | 3373 | 57629 |

Compared with ByteTrack, DeepSORT + PPLCNet has 2.8285 percentage points lower IDF1, 71 fewer IDSW, 0.3598 points higher MOTA, 796 fewer FP and 463 more FN. This does not support replacing the default. OC-SORT has 220 fewer IDSW and 0.1185 points higher IDF1, but 4.8577 points lower MOTA, 2582 more FP and 3093 more FN. These are three complete configurations with different association/low-score policies. There is no DeepSORT appearance-disabled ablation, so differences cannot be attributed solely to ReID or establish that ReID is generally ineffective. No parameters or sequences were selected after seeing the scores.

## Environment, inputs and identity

Windows 11 Pro 10.0.26200; i5-10400F (6 cores/12 threads); RTX 5060 Ti, driver 32.0.16.1692; Chromium 153.0.8010.12 / Playwright 1.63.0; Node 24.16.0; ORT Web 1.27.0. Requested/actual model backend: WebGPU/main, non-fallback; association: CPU/main. Each sequence starts a new session and three trackers. See [environment](validation/environment.json), [identity](raw/identity.json) and [original summary](raw/summary.json).

The 33,704,835-byte PPLCNet FP32 ONNX model has SHA256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`. Its 512-dimensional feature space binds the model, RGB/half-pixel/white-background preprocessing and L2 normalization versions. Only detection boxes supply crops; GT identities never enter extraction/tracking. All low-score detections are extracted, in ordered chunks of at most64; update happens once after the entire frame succeeds. Full options are in the original summary; DeepSORT uses distance0.2/gallery30. GT is read only by the separate scorer.

| 序列 / Sequence | 帧 / Frames | 检测 / Detections | 最大单帧检测 / Max frame detections |
| --- | --- | --- | --- |
| MOT17-02-FRCNN | 600 | 8186 | 18 |
| MOT17-04-FRCNN | 1050 | 28406 | 34 |
| MOT17-05-FRCNN | 837 | 3848 | 10 |
| MOT17-09-FRCNN | 525 | 3049 | 10 |
| MOT17-10-FRCNN | 654 | 9701 | 21 |
| MOT17-11-FRCNN | 900 | 6007 | 18 |
| MOT17-13-FRCNN | 750 | 8442 | 30 |

## Official per-sequence metrics

| 序列 / Sequence | 算法 / Algorithm | IDF1 % | IDSW | MOTA % | FP | FN |
| --- | --- | --- | --- | --- | --- | --- |
| MOT17-02-FRCNN | ByteTrack | 39.4506 | 56 | 32.1726 | 179 | 12368 |
| MOT17-02-FRCNN | OC-SORT | 40.0708 | 57 | 31.7313 | 166 | 12462 |
| MOT17-02-FRCNN | DeepSORT + PPLCNet | 36.4522 | 77 | 31.7582 | 134 | 12469 |
| MOT17-04-FRCNN | ByteTrack | 61.6916 | 42 | 52.9764 | 273 | 22048 |
| MOT17-04-FRCNN | OC-SORT | 61.3499 | 43 | 52.6989 | 264 | 22188 |
| MOT17-04-FRCNN | DeepSORT + PPLCNet | 56.4197 | 84 | 52.7388 | 206 | 22186 |
| MOT17-05-FRCNN | ByteTrack | 50.1394 | 83 | 43.7617 | 188 | 3619 |
| MOT17-05-FRCNN | OC-SORT | 49.8162 | 63 | 39.9884 | 296 | 3792 |
| MOT17-05-FRCNN | DeepSORT + PPLCNet | 50.0584 | 75 | 43.7184 | 132 | 3686 |
| MOT17-09-FRCNN | ByteTrack | 48.7551 | 44 | 48.2441 | 168 | 2544 |
| MOT17-09-FRCNN | OC-SORT | 50.6068 | 29 | 40.9014 | 354 | 2764 |
| MOT17-09-FRCNN | DeepSORT + PPLCNet | 49.0488 | 39 | 49.9155 | 89 | 2539 |
| MOT17-10-FRCNN | ByteTrack | 22.7684 | 428 | 36.8253 | 1438 | 6245 |
| MOT17-10-FRCNN | OC-SORT | 25.4926 | 310 | 19.6199 | 2620 | 7390 |
| MOT17-10-FRCNN | DeepSORT + PPLCNet | 23.6700 | 366 | 37.2926 | 1295 | 6390 |
| MOT17-11-FRCNN | ByteTrack | 50.4042 | 77 | 46.4922 | 595 | 4377 |
| MOT17-11-FRCNN | OC-SORT | 50.9159 | 57 | 40.5468 | 847 | 4706 |
| MOT17-11-FRCNN | DeepSORT + PPLCNet | 46.9612 | 77 | 48.6117 | 420 | 4352 |
| MOT17-13-FRCNN | ByteTrack | 33.0563 | 371 | 34.1694 | 1328 | 5965 |
| MOT17-13-FRCNN | OC-SORT | 30.5650 | 322 | 18.5449 | 2204 | 6957 |
| MOT17-13-FRCNN | DeepSORT + PPLCNet | 33.0576 | 312 | 36.2996 | 1097 | 6007 |

## Measured costs

All values are milliseconds. Both Node repetitions measure SDK tracking totalMs with frozen features, excluding ReID. Browser ByteTrack/OC-SORT outer timings cover only tracking and execute no model. Browser DeepSORT outer time independently covers local image fetch, decoding, full-frame ReID and tracking. Detection, video pipelines, rendering, scoring, Playwright IPC and disk writes are excluded; model loading is separate. These are not end-to-end video FPS, and Node throughput cannot stand in for the image pipeline. Browser order is fixed: DeepSORT, ByteTrack, OC-SORT. The two Node replays are not independent hardware or cross-process performance experiments.

| 运行 / Run | 累计 / Sum ms | 平均 / Mean ms | p50 ms | p95 ms |
| --- | --- | --- | --- | --- |
| Browser ByteTrack | 9547.600 | 1.796 | 1.500 | 4.000 |
| Browser OC-SORT | 10497.200 | 1.975 | 1.600 | 4.900 |
| Browser DeepSORT + PPLCNet | 613470.900 | 115.401 | 100.900 | 247.700 |
| Node 1 ByteTrack | 8679.482 | 1.633 | 1.387 | 3.491 |
| Node 1 OC-SORT | 9387.251 | 1.766 | 1.443 | 3.961 |
| Node 1 DeepSORT + PPLCNet | 31180.492 | 5.865 | 3.421 | 18.820 |
| Node 2 ByteTrack | 8459.654 | 1.591 | 1.337 | 3.425 |
| Node 2 OC-SORT | 9135.977 | 1.719 | 1.382 | 3.888 |
| Node 2 DeepSORT + PPLCNet | 30824.135 | 5.798 | 3.363 | 18.703 |

Cold means each sequence's first frame (7 samples); warm means its remaining frames (5309 samples). Model acquisition/session creation is separate; first execution may still compile runtime work. Cold is neither a full browser cold start nor a speedup baseline for populated tracking state. No extra warmup frames were discarded. Quantiles pool and sort raw frame samples: p50=floor((n−1)×0.5), p95=ceil((n−1)×0.95), without interpolation. No averaging sequence quantiles or assembling totals from stage medians.

| 运行 / Run | cold p50 / p95 ms (n=7) | warm p50 / p95 ms (n=5309) |
| --- | --- | --- |
| Browser ByteTrack | 0.300 / 0.500 | 1.500 / 4.000 |
| Browser OC-SORT | 0.300 / 1.000 | 1.600 / 4.900 |
| Browser DeepSORT + PPLCNet | 676.100 / 796.400 | 100.700 / 247.200 |
| Node 1 ByteTrack | 1.395 / 1.898 | 1.387 / 3.491 |
| Node 1 OC-SORT | 0.357 / 0.852 | 1.445 / 3.961 |
| Node 1 DeepSORT + PPLCNet | 1.507 / 2.401 | 3.427 / 18.820 |
| Node 2 ByteTrack | 0.252 / 0.426 | 1.338 / 3.425 |
| Node 2 OC-SORT | 0.160 / 0.309 | 1.385 / 3.888 |
| Node 2 DeepSORT + PPLCNet | 0.326 / 0.693 | 3.376 / 18.703 |

DeepSORT stage costs below are measured on the same frames. The outer measurement includes inter-stage overhead and is not a stage sum. Extraction sub-stages, per-frame chunk costs and all cold/warm statistics are preserved in the compressed samples and machine summary.

| 阶段 / Stage | 累计 / Sum ms | p50 ms | p95 ms |
| --- | --- | --- | --- |
| 图片获取 / Image fetch | 31967.100 | 4.800 | 17.500 |
| 图片解码 / Image decode | 64960.300 | 13.400 | 16.800 |
| 整帧特征提取 / Frame ReID | 483360.200 | 75.600 | 204.000 |
| CPU 跟踪 / CPU tracking | 33132.900 | 3.900 | 19.600 |
| 外围实测 / Measured outer | 613470.900 | 100.900 | 247.700 |

Per-sequence local model acquisition/loading follows. Seven outer loads sum to **9005.000 ms**, separate from the613470.900 ms frame outer sum. modelBytes input uses no persistent cache; SDK modelDownloadMs/modelCacheReadMs are0 because those paths were not executed. Local fetch is not public distribution performance. summary.modelLoads retains complete runtime/source/cache/load fields.

| 序列 / Sequence | 本地获取 / Fetch ms | 完整性 / Integrity ms | 会话 / Session ms | SDK load total ms | 外围加载 / Outer load ms |
| --- | --- | --- | --- | --- | --- |
| MOT17-02-FRCNN | 322.700 | 98.700 | 1029.100 | 1128.100 | 1460.500 |
| MOT17-04-FRCNN | 238.600 | 89.700 | 960.500 | 1050.500 | 1296.700 |
| MOT17-05-FRCNN | 160.000 | 87.400 | 995.300 | 1083.100 | 1250.000 |
| MOT17-09-FRCNN | 254.200 | 87.800 | 917.100 | 1005.300 | 1266.700 |
| MOT17-10-FRCNN | 228.500 | 87.800 | 949.800 | 1037.900 | 1273.800 |
| MOT17-11-FRCNN | 195.100 | 92.700 | 886.000 | 979.100 | 1182.700 |
| MOT17-13-FRCNN | 237.300 | 90.600 | 937.700 | 1028.600 | 1274.600 |

## Supplementary checks and limits

The predetermined first30 frames/433 detections of MOT17-02 were compared on WebGPU and WASM: maxAbs=3.5762786865234375e−7, maxCosineDistance=2.7502444766014378e−12; all three trackers' MOT/non-timing outputs agree. This is subset consistency, not full-dataset WASM performance or accuracy. See [comparison](subset/comparison.json) and both original backend summaries. Archiving reread and verified126 formal browser/Node/MOT files; provenance.outputHashes records their hashes. A further [48 subset-output hashes](validation/subset-output-validation.json) were independently verified. [Historical validation](validation/historical-validation.json) confirms14 ByteTrack/OC-SORT MOT files and all metrics remain identical; historical reports are unchanged.

The [tool implementation record](validation/task-1-report.md) preserves commands/output excerpts for9 focused tests,173 unit tests, typecheck/build/package success, rather than a separate complete raw log. The [review](validation/task-1-review.md) retains two nonblocking P3 findings: compare does not recheck original-summary output hashes, addressed for this run by the48 independent checks; formal Windows Python execution fixed console encoding with PYTHONUTF8=1 / PYTHONIOENCODING=utf-8. No script inside the formal identity was changed after measurement to rewrite evidence.

These are fixed-training-set observations on one machine, not test-set leaderboard results, official algorithm reproductions or a general quality ranking. Physical phones, Safari, Firefox, Workers, NPU, cross-camera identity, detector integration, end-to-end video/camera pipelines and peak memory were not verified. Earlier OMZ black/white-input and transparent-PNG decoding counterexamples remain. Video scheduling/Workflow requires a defined use case and compatible contracts; publication requires separate explicit authorization for this version.

## Archive and verification

- `raw/`: original official metrics, merged/per-sequence summaries, identity and scorer completion log.
- `timings.json.gz`: complete per-frame timing fields and sequence names only, about1.26MB gzip; no media, full detections/GT, embeddings or full trajectories.
- `provenance.json`: pre-archive source hashes, timing-source hashes and independently checked formal-output hashes. Archived text uses LF; post-archive hashes are in `evidence.lock.json`.
- `evidence.lock.json`: SHA256/bytes of evidence, reports and verifier; excludes itself and later `closure/` receipts to avoid self-reference. Such receipts are not locked measurement inputs.

From the SDK root run `node reports/2026-09-21-mot-reid/verify.mjs` to verify hashes, frame coverage, repeated-output declarations, raw timing sums/cold/warm/quantiles and per-sequence/combined IDF1/MOTA formulas/count sums. Add `--current` to check current source/scripts/build against measured identity. Build matching dist first if absent; changed code requires an independent checkout of the measured commit. This offline check does not rerun TrackEval, inference or tracking, and hash verification is not rescoring.

To actually rerun, prepare the locked media/labels/model/TrackEval/dependencies and follow the [tool guide](../../scripts/evaluation/mot17-reid/README.en.md) with fresh .tmp directories for the seven sequences, merge and official scoring. Original media/trajectories remain in local .tmp; the evidence lock cannot replace scoring again from GT.
