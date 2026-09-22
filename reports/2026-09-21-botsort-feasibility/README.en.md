# BoT-SORT feasibility probe (2026-09-21)

[中文](README.md). Layer: independent Tracking SDK research. The local feasibility study is complete; a fourth production algorithm has not been added.

Camera motion compensation (CMC) merits further implementation. Prioritize a **CPU tracking core accepting caller-provided motion matrices**, then evaluate an optional browser image estimator separately. Across seven fixed sequences, CMC improves IDF1 by 6.2928 percentage points and reduces ID switches from 1101 to 519. MOT17-09 regresses and estimation is costly; this does not justify replacing the default or claiming full BoT-SORT support. Published versions remain `0.2.0-rc.0` on npm `next` and `0.1.0` on `latest`.

## Fixed experiment

Baseline commit: `b8ef9c292ba4cae41d5c4a9c83a70809486f509e`. The [protocol](protocol.json) was fixed before evaluation. All MOT17 02/04/05/09/10/11/13 FRCNN **train** sequences are included: 5316 frames and 67639 accepted detections. All configurations use the same public detections and original tracking thresholds, without tuning against the results. Image bytes/SHA256, frozen feature hashes, per-frame timestamps, sizes, detection coordinates/counts, and feature space were checked. Only the separate scorer reads GT; estimation and tracking do not.

TrackEval commit `12c8791b303e0a0b50f753af204249e622d0281a` uses official pedestrian preprocessing, IoU 0.5, and `combine_sequences`, not an average of sequence percentages. See [metrics](metrics.json) and [provenance](provenance.json).

| Research configuration | IDF1 ↑ | IDSW ↓ | MOTA ↑ | FP ↓ | FN ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| `base`: existing ByteTrack | 48.2922% | 1101 | 44.4010% | 4169 | 57166 |
| `cmc`: same core + CMC | 54.5850% | 519 | 47.7163% | 2754 | 55440 |
| `cmc-reid`: additionally gated appearance fusion | 55.3487% | 489 | 47.7804% | 2734 | 55418 |

| Sequence | base IDF1 | cmc IDF1 | cmc-reid IDF1 | IDSW, same order |
| --- | ---: | ---: | ---: | --- |
| 02 | 39.4506% | 39.5291% | 39.8591% | 56 / 55 / 49 |
| 04 | 61.6916% | 61.7017% | 61.7017% | 42 / 42 / 42 |
| 05 | 50.1394% | 56.1128% | 56.2662% | 83 / 40 / 44 |
| 09 | 48.7551% | 45.2744% | 46.5909% | 44 / 45 / 36 |
| 10 | 22.7684% | 49.8566% | 51.7116% | 428 / 134 / 133 |
| 11 | 50.4042% | 60.6626% | 60.6097% | 77 / 33 / 34 |
| 13 | 33.0563% | 50.4564% | 54.3072% | 371 / 170 / 151 |

CMC adds 6.2928 IDF1 and 3.3153 MOTA percentage points overall. Appearance fusion adds 0.7637 IDF1 points beyond CMC, but IDSW increases slightly on 05/11 and IDF1 falls slightly on 11. Both enhanced configurations regress on 09; the cause remains unresolved. These are not test-set scores or universal gains across sequences, detectors, or devices.

## Implemented scope and mathematical differences

This is a **disposable research probe** built from this project's own core. Production `src`, `dist`, package version, manifest, model registry, and Demo are unchanged. Result metadata still says `algorithm: bytetrack`; distinguish experiments by `run-summary.json` configurations, not a new public algorithm ID.

- CMC uses OpenCV 4.10.0, one thread and fixed random seeds: resize to at most 640 pixels wide, ORB 1500, Hamming KNN ratio 0.75, and partial-affine RANSAC. Both frames' detection rectangles mask foreground. Support, inlier ratio, and 4×4 background coverage checks are in the protocol and [probe](probe/motion.py). Failure returns explicit identity with a reason. Of 5309 transitions, 5270 were estimated and 39 fell back for low support, all on 05 (about 0.735%); there are also seven first frames.
- The matrix maps the **previous processed frame to the current frame**, in zero-based original-image coordinates, row order `[a,b,tx,c,d,ty]`. Resize recovery uses `S⁻¹ M S` and `S⁻¹ t`, including unequal x/y rounding. Accepted estimates have scale 0.8–1.25, rotation magnitude ≤15°, and translation ≤25% of the resized image diagonal.
- Compensation follows prediction and precedes association. For `[cx,cy,w,h,vx,vy,vw,vh]`, centers/position velocities use `M`; sizes/size velocities use `abs(M)`. `J = diag(M,abs(M),M,abs(M))` and covariance is `J P Jᵀ`. This independently derived axis-aligned corner envelope differs from the paper's signed `M` approximation on width/height: even a 15° rotation of a 20×100 box can produce negative width there. Repeated envelopes may inflate boxes; this probe does not prove the optimal model or include uncertainty in the estimated matrix.
- Appearance reuses archived `pplcnet-reid-fp32@0.1.0` WebGPU 512-dimensional vectors without rerunning inference. High-score detections with raw IoU ≥0.5 and cosine distance ≤0.25 use `min(1-IoU, cosine/2)`. High-score matches update a normalized EMA with alpha 0.9, initialized from the first vector. Tentative association is included. Inclusive thresholds differ at the boundary from the paper's strict inequalities.
- Existing seconds-based timing, fixed filter noise, lifecycle, classes, low-score continuation, and matching thresholds remain. Full size-dependent noise, detection-score fusion, offline interpolation, and official C++ VideoStab are not implemented. This is not an official BoT-SORT reproduction. Differences from the prior DeepSORT experiment cannot all be attributed to the ReID model.

## Cost and verification limits

Windows 11, i5-10400F, Node 24.16.0, Chromium 153.0.8010.12; Python 3.11.15, NumPy 1.23.5, SciPy 1.10.1, OpenCV 4.10.0. Full identities are in provenance.

| Scope | base | cmc | cmc-reid |
| --- | ---: | ---: | ---: |
| Node tracking total, 5316 frames | 10067.14 ms | 10304.92 ms | 12986.26 ms |
| Chromium tracking total, 837 frames of 05 | 583.60 ms | 607.20 ms | 738.10 ms |

Tracking totals cover validation, prediction, compensation, association, and updates. They exclude image estimation, ReID extraction, detection, image decoding, transport, rendering, and scoring. Single measurements cannot establish stable speed differences or end-to-end FPS.

Python estimation totals 239277.98 ms, with per-sequence `estimateMs` medians of 34.16–47.80 ms, including current-frame ORB, matching, RANSAC, and original-coordinate recovery. Reading/integrity adds 5480.85 ms; decoding/resizing adds 43961.51 ms; combined total is 288720.34 ms. [Motion summaries](motion-summary.json) retain per-sequence p50/p95. This is offline Python cost, not browser estimation, model inference, or video throughput.

- All seven sequences' identity-compensated results match baseline per frame excluding timing. All baseline MOT hashes match historical output; no configuration drops detections for capacity. The full Node experiment ran once, not twice.
- [Chromium evidence](browser-result.json) covers all 837 frames of 05: all three MOT and non-timing result hashes match Node, with no page errors. Only CPU association and matrix application ran in the browser. Matrices were prepared in Python and features came from the prior archive; browser image estimation, ORT inference, phones, and cameras were not tested here.
- Math/integration checks cover identity, translation, rotation envelopes, scaling covariance, quadratic forms, singular/nonfinite matrices, sudden-pan ID continuity, non-advancement on invalid matrices with existing tracks, reset/dispose, synthetic known translation, and blank-image fallback. This is not complete production validation; empty-state first-frame matrix validation remains incomplete.
- [Logs](logs/) retain failures and successes: the initial math test lacked the module; the first full run stopped on an incorrect historical field name and was corrected using new run-2; the first scorer failed on Windows default GBK and succeeded after explicit UTF-8. Experimental parameters were unchanged.

## Sources and licenses

[Source lock](sources.lock.json) records URLs, immutable identities, sizes, and SHA256. Third-party papers and algorithm source are not redistributed here.

- [Paper v2](https://arxiv.org/abs/2206.14651v2), sections 3.1–3.3, informs mechanisms. [BoT-SORT upstream](https://github.com/NirAharon/BoT-SORT/tree/251985436d6712aaf682aaaf5f71edb4987224bd) has a root MIT license, while `fast_reid` is Apache-2.0 and `yolov7` GPL-3.0. The root license does not cover every subtree uniformly. No third-party tracking implementation was read, translated, or copied in this study.
- The [fixed PaddleDetection config](https://github.com/PaddlePaddle/PaddleDetection/blob/b25522a0f4bde8c80603f3ba5e3472059972e3b5/configs/mot/botsort/botsort_ppyoloe.yml) selects `BOTSORTTracker` with `reid: None`, `reid_weights: None`, and `camera_motion: False`. Its MOT17 half-specific PP-YOLOE-L detector differs from the existing COCO L model; export only covers the detector. Its half-val IDF1 64.2 / MOTA 55.5 are not directly comparable to this full-train FRCNN experiment.
- No model conversion/distribution or production dependency was added. PPLCNet weight provenance and training-disclosure limits follow the [existing report](../2026-09-21-mot-reid/README.en.md). Any future browser estimator requires its own dependency/license and cost assessment.

## Options and next stage

| Path | Role and cost | Decision |
| --- | --- | --- |
| Caller-provided matrix, same-package CPU core | Reuses external detections/matrices without an image engine in the default import; caller owns estimation quality | **First priority:** design and implement an optional BoT-SORT-style core |
| Optional image-estimator sub-entry | Produces matrices from pixels, adding decoding, matching, and dependencies | Later browser feasibility/cost validation, loaded on demand |
| Cross-SDK media orchestration | Schedules detection, optional ReID, estimation, video/camera | Await compatible contracts and a real use case; portal only records the roadmap |

Proposed contract requirements, **not a public API**:

1. Bind matrices to from/to frame IDs and timestamps, connecting the last successfully processed frame to the current frame. Specify original coordinates, order, sizes, source, and quality. Dropped frames require re-estimation or correct composition, not a matrix from unrelated adjacent video frames.
2. Distinguish `estimated`, `identity`, and `unavailable/failed`. Failure must not masquerade as a stationary camera; identity degradation must be explicit, without silent algorithm changes.
3. Define first-frame, seek, reset, size change, pause/resume, and large-gap invalidation. Validate matrices, features, and boxes before committing state; errors must not advance time, tracks, or generation. Address nonfinite, singular, reflected, and out-of-range transforms beyond this probe's partial validation.
4. Fix compensation ordering, envelopes/clipping, mean/covariance/velocity semantics; add uncertainty and long-rotation counterexamples. Separate matrix application from image estimation in performance reporting.
5. Keep appearance optional with the existing feature-space contract and `./reid`. Before production, finalize design and algorithm differences, test error atomicity and existing algorithms, compare Node/browser quality, and investigate 09. Only then decide version and public Demo controls.

This follows the original independent-SDK plan: related tracking algorithms share one package; the portal indexes, compares, and links them. Workflow remains deferred. Standard 1.3.0 already allows domain inputs and optional model modules, so this study adds no schema, rule, or UI requirements.

## Verification and reproduction

Run `node reports/2026-09-21-botsort-feasibility/verify.mjs` from the repository to verify archived hashes, aggregates, provenance, and browser alignment; add `--local` to verify local experiment inputs and trajectory hashes. `evidence.lock.json` pins archived files. Images, detections, GT, feature vectors, and real trajectories are not committed.

For a full rerun, use an independent checkout of the baseline and locked dependencies, prepare identical data/features through the [existing process](../2026-09-21-mot-reid/README.en.md), copy `probe/` into `.tmp/botsort-feasibility/`, and copy the protocol beside it. Run `build.mjs`, math/integration tests, `motion.py`, `run.mjs`, `score.py`, then `browser.mjs`. Scripts retain the original local paths and run-2 naming; use a fresh checkout/research location and never overwrite existing evidence. Point Python scoring at the fixed clean TrackEval checkout. Compare deterministic trajectory/matrix values separately from timings; JSONL hashes containing timings need not match across machines.

This delivery contains research code, summaries, and roadmap changes; local checks are in [validation.json](validation.json). No new npm, GitHub, model-source, or public Demo release was performed.
