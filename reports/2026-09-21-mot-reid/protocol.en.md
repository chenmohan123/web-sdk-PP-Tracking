# Same-input real-image protocol for three trackers

[中文](protocol.md) · [Results](README.en.md)

Date: 2026-09-21. Protocol preparation baseline: `e42cdd6`; formal tools and measured commit: `0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`, version0.2.0-alpha.0. This local evaluation does not change hosted0.1.0.

Use all5316 frames/67639 detections from MOT17 FRCNN training sequences02/04/05/09/10/11/13. Crops use detection boxes only, never GT boxes/identities. Only the independent scorer reads GT after tracking is complete. No score-driven frame/sequence selection or parameter tuning.

Labels: fixed `MOT17Labels.zip`,10107022 bytes, SHA256 `0aa79322e91583369f42f17c4d79a0b145380d8732487bba59272048dc82b2b9`. Images: `https://motchallenge.net/data/MOT17.zip`,5860214001 bytes, ETag `"15d4bc4f1-5b6c01991f807"`. Allowlisted entries use Range/If-Match and validate Content-Range, compression, local filename, expanded length, central-directory CRC32 and per-image SHA256. ETag/CRC establish source/transport consistency, not an upstream signature; no full-ZIP SHA256 is claimed. All originals stay in ignored `.tmp/mot17-reid-media/data/`;42 overlapping images byte-match the earlier preprocessing study. No original images, full GT or detection files are distributed.

PPLCNet FP32:33704835 bytes, SHA256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`. Production SDK handles preprocessing/normalization; model registry and license evidence remain under `models/pplcnet-reid/0.1.0/`. Reuse the locked MOT17 adapter's timestamps, zero-based half-open clipping and floating-edge handling. Preserve row order/empty frames, extract low-score detections too, decode actual browser RGBA and update only after every detection's feature succeeds. Chunk at most64 detections in order without dropping the remainder.

Shared options: high score0.5, new track0.6, minHits2, matching IoU0.3, maxLostMs1000, largeGapMs2000, maxDetections100, maxTracks200. ByteTrack additionally uses low score0.1 and low-match IoU0.2. OC-SORT/DeepSORT retain candidate defaults; DeepSORT distance0.2/gallery30. No parameter tuning against scores.

Formal evaluation covers every image in one desktop Chromium environment with actual WebGPU ReID and CPU/main association. Freeze extracted vectors and replay each tracker twice from new Node instances. Compare MOT/non-timing outputs with each other and the browser. Supplementary WebGPU/WASM comparison is predetermined to sequence02's first30 frames, kept separate from full metrics; it is not a full CPU-model evaluation.

Official TrackEval commit `12c8791b303e0a0b50f753af204249e622d0281a`; Python3.11.15, NumPy1.23.5, SciPy1.10.1; Identity/CLEAR, pedestrian, DO_PREPROC=true, IoU0.5. Use official combine_sequences, never average sequence percentages. Formal Python console encoding is fixed with PYTHONUTF8=1 and PYTHONIOENCODING=utf-8. Independently verify48 original supplementary output hashes because the comparison tool does not itself bind all output hashes back to the original summaries.

Record local model acquisition, integrity/session loading, image fetch/decoding, feature preprocessing/inference/normalization, CPU tracking and independent outer frame duration separately. Model GPU execution is not GPU association. ModelBytes timings do not establish public download performance. No detector, video decoding pipeline, rendering, scoring, IPC or disk output is included in frame costs; never call these end-to-end video FPS. Node frozen-feature timing covers only tracking.

Each sequence creates new model/tracker instances: first frame=cold, remaining frames=warm; loading is separate and no extra warmup frames are discarded. Pool raw frame samples; p50 uses floor((n−1)×0.5), p95 uses ceil((n−1)×0.95), without interpolation. Do not average sequence quantiles or add medians from separate stages/runs. Compressed archived timings contain neither vectors nor trajectories; offline verification checks hashes, formulas and statistics rather than rerunning official scoring.

This is one-machine fixed-training-set evidence, not MOT17 test-set ranking, an official algorithm reproduction or mobile/cross-browser compatibility. Fewer identity switches alone do not establish better quality: inspect IDF1/MOTA/FP/FN and cost together. The three complete configurations are not an appearance-disabled DeepSORT ablation, so differences cannot be attributed solely to ReID.
