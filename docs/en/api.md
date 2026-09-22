# API 0.2.0-rc.1 (release candidate)

[中文](../zh-CN/api.md) · [Home](../../README.en.md)

`createTracker(options?: TrackerOptions): Tracker` returns synchronous `update(frame, {signal}?)`, `reset()` and `dispose()`. ESM/CJS export createTracker and TrackingError; declarations also export `TrackerAlgorithm = 'bytetrack' | 'ocsort' | 'deepsort' | 'botsort'` and `FeatureSpace`. This page covers local rc.1; published next remains rc.0. The new overload `createTracker(options: BoTSortTrackerOptions): BoTSortTracker` requires BoTSortFrame. `AnyTrackerOptions` joins both option types while original TrackerOptions retains three algorithms. See the [motion API](botsort-candidate.md).

## Input

This page documents the root algorithm entry. The optional `web-sdk-pp-tracking/reid` factory, load/extract/dispose, inputs, cache and errors are documented in the [ReID guide](reid-candidate.md). It requires the RC plus optional ORT; version 0.1.0 has no such subpath.

`TrackingFrame = {timestampMs, imageSize:{width,height}, featureSpaceId?, detections:[{box:{x,y,width,height},score,classId,embedding?}]}`.
Coordinates are pixel xywh, not xyxy. Boxes must be fully in-bounds with positive sizes and nonnegative x/y; no automatic clipping.
Image dimensions are finite and positive, timestamps finite, nonnegative and strictly increasing; dimensions stay fixed per sequence. Scores are in[0,1], classes are nonnegative safe integers. All numbers must be finite.
Default maximum:100 detections/frame, configurable up to500. The Demo retains its separate100-box limit. Categories never associate across classes.
Invalid input, cancellation or numerical failures do not advance clock, tracks or IDs. Input and result objects do not share internal mutable state.

| Option | Default | Constraint |
| --- | --- | --- |
| algorithm | bytetrack | `'bytetrack'`, `'ocsort'`, `'deepsort'` or `'botsort'`; fixed when an instance is created |
| lowScoreThreshold | 0.1 | [0,1] |
| highScoreThreshold | 0.5 | ByteTrack: [low,1]; OC-SORT: [0,1]; both must be <= new |
| newTrackThreshold | 0.6 | [high,1] |
| matchIouThreshold | 0.3 | [0,1] |
| lowMatchIouThreshold | 0.2 | [0,1] |
| minHits | 2 | Integer1–100 |
| maxLostMs | 1000 | Finite positive |
| largeGapMs | 2000 | Finite, >= maxLostMs |
| maxDetections | 100 | Integer1–500 |
| maxTracks | 200 | Integer1–500 |

`algorithm: 'bytetrack'` uses low-score second-stage association; among the original three algorithms, only that strategy accepts `lowScoreThreshold` and `lowMatchIouThreshold`. BoT-SORT also accepts these fields. `algorithm: 'ocsort'` uses high-score association only, keeps high-score/new-track/IoU/lifecycle/capacity options, and additionally accepts:

| OC-SORT option | Default | Constraint |
| --- | --- | --- |
| ocmWeight | 0.2 | [0,1] |
| ocmDeltaMs | 300 | Finite1–10000 ms |
| ocmHistoryLength | 30 | Integer2–120 |
| oruMaxReplaySteps | 30 | Integer1–60 |

`algorithm: 'deepsort'` requires `featureSpace: {id,dimension}`. `id` is a 1–256-character string without surrounding whitespace; callers should bind it to the weight digest, preprocessing version and output definition, while the SDK only compares the identifier. `dimension` is an integer from1 to2048. Every frame, including empty frames, must carry the matching `featureSpaceId`; every detection, including score-filtered ones, needs a finite, non-zero-norm plain array or `Float32Array` of exactly that dimension. Inputs are robustly normalized and copied without mutation.

| DeepSORT option | Default | Constraint |
| --- | --- | --- |
| featureSpace | Required | Exactly id and dimension |
| maxCosineDistance | 0.2 | [0,2] |
| gallerySize | 30 | Integer1–100 |

Gallery capacity must satisfy `maxTracks * gallerySize * dimension <= 4_000_000`. DeepSORT rejects ByteTrack low-score fields and OC-SORT-specific fields. Only matches and births update galleries; reset, dispose and removal release their vectors.

Unknown options are rejected; explicit undefined is not omission; explicit strategy-exclusive options also return `INVALID_OPTIONS`. ByteTrack/BoT-SORT tracked candidates may continue through low scores, while lost tracks require high scores. DeepSORT lost tracks also cannot bypass appearance matching through IoU fallback. Unconfirmed tracks are removed on the first miss. Full capacity skips new tracks without evicting existing tracks.

## Output

`TrackingResult = {generation,algorithm,timestampMs,tracks,removed,droppedDetections,runtime,timings}`. `algorithm` is the fixed strategy actually used for that update.
Track fields: `id,classId,box,state,observed,score,ageMs,hits,missedMs`.
States: tentative/tracked/lost. The removed array contains only this update's removal events, with state removed.
Predictions have observed=false and score=null. Output boxes may extend outside the image and are not clipped. Hits count accumulated actual observations, starting at1.
droppedDetections counts only new tracks skipped at capacity, not score filtering.
Runtime reports actual cpu/main and `web-sdk-pp-tracking@0.2.0-rc.1`. See [performance](performance.md) for five timing fields.

The Demo's compact input-sequence export preserves normalized `frames` and optional top-level `featureSpace`; its versioned wrapper also keeps the algorithm and applied options. BoT-SORT preserves complete frameId/motion metadata. It is limited to 5MiB by UTF-8 byte size and can be re-imported. The separate result report also contains actual options and processed results; it can exceed 5MiB and is not guaranteed to be re-importable.

New exports use `schemaVersion: 2`; imports restore the file's `algorithm` and `options`, excluding unapplied drafts. Unversioned and legacy `schemaVersion: 1` files use the current algorithm and options. Unknown versions are rejected and missing motion is never synthesized. Applying parameters validates the entire sequence, changes only form-owned fields and preserves other imported thresholds and capacities; failures preserve the session. Version 2 may declare appearance space only in options, including all-empty detection sequences.

## Lifecycle

Initial generation=0. Reset clears tracks, clock and state, increments generation and restarts IDs at1. IDs are never reused within a generation and are independent across instances. IDs are not identities. Demo reset also clears paths and export history.
Reset before seek or resizing. Replay recorded timestamps in order. Dispose is idempotent; update/reset then throw DISPOSED.
Synchronous main-thread execution checks AbortSignal only before computation, without mid-run preemption.

Stable error codes: INVALID_OPTIONS, INVALID_INPUT, ABORTED, DISPOSED, NUMERICAL_FAILURE, ID_EXHAUSTED. Branch on `error instanceof TrackingError` and `error.code`, not localized error messages.

See [algorithm](algorithm.md) for equations and removal boundaries.
