# BoT-SORT external-motion core validation

[中文](README.md). Date: 2026-09-22. Local candidate `0.2.0-rc.0+botsort-core.1`, based on commit `99928c639d84f30efcd5b4686d9e7144c5b818e5`. The disposable probe is now a reusable, typed, buildable and tested core in the same SDK. A fourth public algorithm/version has not been released.

## Delivered

- `src/botsort/` provides `createBoTSortTracker`, strict frame/matrix validation, post-prediction compensation, optional gated appearance/EMA, and distinct candidate metadata. Internal strategy hooks share the existing engine instead of duplicating it.
- from/to bind the last successful frame and current frame by ID/time. initial is mandatory after creation/reset. estimated, identity, and unavailable remain distinct; failure defaults to an error, while explicitly enabled identity degradation retains the failure reason. Seek, size changes, and large gaps require reset.
- Input/cancellation/numerical failures never advance state. Empty/first frames are validated, disposal is idempotent, and instances/inputs/results are isolated. Appearance retains one EMA; low scores neither use nor update it. The root entry loads neither the candidate nor an image engine.
- The [candidate API and executable example](../../docs/en/botsort-candidate.md) document coordinates, bounds, lifecycle, timing, provenance, and paper differences. Metadata reports botsort, cpu/main, and `+botsort-core.1`, not new functionality under the published RC identity.

## Fixed data and scoring

The [previous study](../2026-09-21-botsort-feasibility/README.en.md) supplies seven MOT17 FRCNN train sequences, 5316 frames/67639 detections, frozen motion matrices, and PPLCNet 512D features. Detection, image estimation, and ReID were not rerun. Detection/size/matrix/feature hashes and per-frame detection identity, time, and feature space are checked. GT is read only by the separate scorer.

Each of three configurations ran **twice in full**, reproducing MOT and all non-timing hashes with zero capacity drops. All 21 trajectory files, including seven identity runs, match the corresponding prior probe byte-for-byte. Identity also matches the current shared ByteTrack core's tracks/removals/generation per frame and historical baseline MOT output.

The fixed official TrackEval scorer uses pedestrian preprocessing, IoU 0.5, and combined counts; it rechecks GT and all actual MOT hashes before scoring. All sequence and combined metrics equal the prior study. See [metrics](metrics.json).

| Configuration | IDF1 ↑ | IDSW ↓ | MOTA ↑ | FP | FN |
| --- | ---: | ---: | ---: | ---: | ---: |
| identity, baseline-equivalent | 48.2922% | 1101 | 44.4010% | 4169 | 57166 |
| cmc | 54.5850% | 519 | 47.7163% | 2754 | 55440 |
| cmc-reid | 55.3487% | 489 | 47.7804% | 2734 | 55418 |

[Run summaries](run-summary.json) preserve both repetitions' hashes/timings. Node tracking totals are 9056.92/8905.07 ms for identity, 9762.91/9062.65 ms for CMC, and 11934.59/11615.69 ms for CMC+appearance. They include validation, prediction/compensation, association, and updates, excluding upstream image/model work. Two runs are not robust performance statistics and do not justify speedup claims against small differences or historical timings.

[Chromium 153 evidence](browser.json) covers all 837 frames of 05: all three MOT/non-timing hashes match Node. First-frame rejection, invalid from, cancellation/retry, reset, and disposal pass without page errors. This does not validate browser image estimation, model inference, physical cameras, or phones.

## Investigating the 09 regression

With fixed parameters, detections, and original matrices, the 525-frame comparison changes only the transform applied; no GT-based parameter tuning was performed. See [ablation summary](ablation-summary.json) and [metrics](ablation-metrics.json).

| Transform | IDF1 | IDSW | MOTA |
| --- | ---: | ---: | ---: |
| Identity | 48.7551% | 44 | 48.2441% |
| Original translation components only | 45.8248% | 40 | 48.8263% |
| Full matrix | 45.2744% | 45 | 49.6901% |

Rotation envelopes alone cannot explain the regression: translation-only still loses 2.9304 IDF1 points, and the full transform loses a further 0.5504 points while improving MOTA. Motion is very small: 524 estimated transitions have translation median 0.1014px/p95 0.4531px, rotation median 0.002407°, and scale median 1.000012. Small near-stationary transforms can affect association and identity continuity. **There is no camera-motion ground truth, so these estimates cannot all be labeled noise; individual ID-fragmentation events remain incompletely diagnosed.** Future estimator work should validate stationary-camera detection/confidence across sequences, not tune a special threshold for 09. ByteTrack remains the default.

## Engineering checks and limits

- 208 tests pass: 176 existing plus 32 new. New cases cover geometry/covariance, invalid matrices on first/empty frames, identities/skips/cancellation/retry/reset/size/fallback, isolation, gates, EMA, and low-score non-contamination. Initial failing placeholders preceded implementation; RED logs remain.
- Full `pnpm verify` passes: typecheck, unit tests, ESM/CJS builds, actual npm-pack/runtime/type consumption, Demo and Vanilla/React builds, and 12 existing Demo browser flows including 390px Chinese/English and import/export. Existing >500kB dynamic model-engine chunk notices remain.
- [Candidate build evidence](build-result.json) covers ESM/CJS and NodeNext `.mts/.cts` consumption. Public root exports remain the original three algorithms plus optional ReID; candidate artifacts live only in `.tmp/botsort-core/build`.
- Independent core review found no blockers. A minor discrepancy about gap/matrix validation order was clarified in the design. Delivery review found the ablation did not verify its current bundle against the main run hash; the check was added and ablation/scoring rerun in new `ablation-verified` output. Browser checks also gained adapter-hash/completeness validation with a new receipt. Original outputs remain; core mathematics/parameters did not change.
- Matrix uncertainty is not modeled and repeated rotation envelopes can inflate boxes. Existing seconds-based fixed noise/lifecycle, size mapping, and some association details differ from the paper. This is not official value-level BoT-SORT reproduction. Fixed paper/license provenance follows the prior study; no third-party tracking implementation was read/copied.

## Evidence and reproduction

[Final validation receipt](validation.json) summarizes SDK, candidate, and portal checks. The [independent review receipt](review.md) records findings, fixes, and recheck scope in Chinese.

[Provenance](provenance.json) pins 31 source/script/document/dependency files, the environment, and previous input evidence. The [evidence lock](evidence.lock.json) pins report files. Run `node reports/2026-09-22-botsort-core/verify.mjs --local` to check sources, bundles, input labels/features/matrices, and actual output bytes. Images, detections/GT, vectors, and per-frame trajectories are not committed.

For a full rerun, use a fresh checkout with the same locally prepared prior-study inputs. Run `pnpm build`, `node scripts/build-botsort-candidate.mjs`, then `node scripts/evaluation/botsort-core/run.mjs`. Use the fixed Python for `score.py --trackeval <fixed-clean-TrackEval>`. Run `ablation.mjs` followed by `score.py --run ablation-verified --trackeval <directory>`; run `browser.mjs` for browser checks. Existing run/ablation-verified/browser-verified outputs are protected against overwrites. Scripts preserve prior local input-directory naming; do not remove old evidence to force reruns. Timing and timestamp-bearing files need not match across environments.

Next comes public integration: root algorithm selection, version, manifest, four-algorithm bilingual Demo, import/export, and release validation. Automatic image estimation, video/camera, phones, and portal Workflow remain separate stages. This delivery is local implementation/validation only, without push, PR, merge, npm, or Demo publication.
