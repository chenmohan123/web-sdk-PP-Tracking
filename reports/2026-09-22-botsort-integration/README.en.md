# BoT-SORT public integration and local validation

[中文](README.md). Date: 2026-09-22. SDK base `d9cbac817b8aac8fdf02776b8a199d6627dd9040`; local candidate `0.2.0-rc.1`, without remote publication.

The public root accepts `createTracker({algorithm:'botsort'})` with strict motion-frame types; ByteTrack remains default and the original three algorithms remain available. The existing Demo adds BoT-SORT, original synthetic camera translation, motion receipts, explicit failure policy and optional appearance settings. Image mode retains the existing ReID/DeepSORT flow.

Version 2 input export preserves the algorithm, applied options, complete frame/motion metadata and appearance space. Import restores the file's settings across the current selection; legacy/unversioned files use current settings. External motion or vectors are never fabricated. Switching, parameter application and import validate the entire sequence before replacement. Unapplied drafts stay out of exports, hidden imported settings survive visible edits, seek resets and replays, and language changes preserve results.

[Public-root replay](run-summary.json) covers seven MOT17 FRCNN training sequences, 5316 frames and 67639 detections, with three configurations repeated twice. MOT bytes match the historical core; all non-timing results match after normalizing only the version string. Capacity drops are zero. Matrices and features are frozen inputs; detection, motion estimation, ReID and GT scoring were not rerun.

The identical trajectories retain the [historical scores](../2026-09-22-botsort-core/metrics.json): identity / CMC / CMC+appearance IDF1 48.2922% / 54.5850% / 55.3487%. Sequence 09 still regresses. These are not new test-set scores or universal superiority, and do not justify changing the default.

[Chromium parity](browser.json) covers all 837 frames of sequence 05 through the public root and matches Node MOT/non-timing hashes. It also checks initial frames, invalid identities, cancellation/retry, reset and disposal. Timings exclude detection, motion estimation, ReID inference and rendering.

[Original browser regression](browser-regression.json) and [four-algorithm acceptance](demo-browser.json) cover switching, complete playback, import/export, receipts, invalid final frames/options, explicit fallback, synthetic appearance toggles, seek/reset and Chinese/English at desktop and 390px. The default boxes flow makes no ORT/model requests; a narrow desktop viewport is not a phone test.

[Full verification](verify.log) and [actual package consumption](package-check.json) record builds, types, 220 tests, ESM/CJS/NodeNext, no-ORT isolation, Demo/Vanilla/React builds and 18 browser check groups. The existing optional ORT chunk-size notice remains. [Independent review](review.md) led to four fixes: preserving invalid option fields for strict rejection, preventing assignment of BoT-SORT to the ordinary Tracker type, preserving hidden options on form application, and recovering an empty sequence's feature space from versioned options.

Environment: Windows 11, Intel Core i5-10400F, Playwright 1.63.0 / Chromium 153.0.8010.12; CPU/main association. Model bytes, immutable source revisions, SHA and preprocessing are unchanged. This batch adds no real rc.1 ReID inference, phone, Safari/Firefox, Worker, NPU or video/camera evidence.

[Provenance](provenance.json) and [evidence lock](evidence.lock.json) bind file hashes. Run `node reports/2026-09-22-botsort-integration/verify.mjs --local` to verify source, reports and local artifacts. Replay uses `scripts/evaluation/botsort-core/public.mjs`, and browser parity uses `browser.mjs --public`; existing output is never overwritten. Use a new checkout with the same frozen inputs to repeat. Images, detections/GT, vectors and tracks are not committed.

Next is review and rc.1 preview publication with hosted-package/Demo readback, followed by separate browser motion-estimation design. This delivery is local only; automatic estimation, video/camera scheduling and cross-SDK workflows remain separate stages.
