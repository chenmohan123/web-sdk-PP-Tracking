# API 0.1.0

[中文](../zh-CN/api.md) · [Home](../../README.en.md)

`createTracker(options?: TrackerOptions): Tracker` returns synchronous `update(frame, {signal}?)`, `reset()` and `dispose()`. ESM/CJS export createTracker and TrackingError; packaged declarations expose all input/output types.

## Input

`TrackingFrame = {timestampMs, imageSize:{width,height}, detections:[{box:{x,y,width,height},score,classId}]}`.
Coordinates are pixel xywh, not xyxy. Boxes must be fully in-bounds with positive sizes and nonnegative x/y; no automatic clipping.
Image dimensions are finite and positive, timestamps finite, nonnegative and strictly increasing; dimensions stay fixed per sequence. Scores are in[0,1], classes are nonnegative safe integers. All numbers must be finite.
Default maximum:100 detections/frame, configurable up to500. The Demo retains its separate100-box limit. Categories never associate across classes.
Invalid input, cancellation or numerical failures do not advance clock, tracks or IDs. Input and result objects do not share internal mutable state.

| Option | Default | Constraint |
| --- | --- | --- |
| lowScoreThreshold | 0.1 | [0,1] |
| highScoreThreshold | 0.5 | [low,1] |
| newTrackThreshold | 0.6 | [high,1] |
| matchIouThreshold | 0.3 | [0,1] |
| lowMatchIouThreshold | 0.2 | [0,1] |
| minHits | 2 | Integer1–100 |
| maxLostMs | 1000 | Finite positive |
| largeGapMs | 2000 | Finite, >= maxLostMs |
| maxDetections | 100 | Integer1–500 |
| maxTracks | 200 | Integer1–500 |

Unknown options are rejected; explicit undefined is not omission. Preserve low scores: tracked tracks may continue with them, but lost tracks require high scores. Unconfirmed tracks are removed on the first miss. Full capacity skips new tracks without evicting existing tracks.

## Output

`TrackingResult = {generation,timestampMs,tracks,removed,droppedDetections,runtime,timings}`.
Track fields: `id,classId,box,state,observed,score,ageMs,hits,missedMs`.
States: tentative/tracked/lost. The removed array contains only this update's removal events, with state removed.
Predictions have observed=false and score=null. Output boxes may extend outside the image and are not clipped. Hits count accumulated actual observations, starting at1.
droppedDetections counts only new tracks skipped at capacity, not score filtering.
Runtime reports actual cpu/main and `web-sdk-pp-tracking@0.1.0`. See [performance](performance.md) for five timing fields.

## Lifecycle

Initial generation=0. Reset clears tracks, clock and state, increments generation and restarts IDs at1. IDs are never reused within a generation and are independent across instances. IDs are not identities. Demo reset also clears paths and export history.
Reset before seek or resizing. Replay recorded timestamps in order. Dispose is idempotent; update/reset then throw DISPOSED.
Synchronous main-thread execution checks AbortSignal only before computation, without mid-run preemption.

Stable error codes: INVALID_OPTIONS, INVALID_INPUT, ABORTED, DISPOSED, NUMERICAL_FAILURE, ID_EXHAUSTED. Branch on `error instanceof TrackingError` and `error.code`, not localized error messages.

See [algorithm](algorithm.md) for equations and removal boundaries.
