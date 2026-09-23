# Browser Motion Estimation Lab

[中文](../zh-CN/motion-estimation.md) · [API](api.md) · [Home](../../README.en.md)

`web-sdk-pp-tracking/motion` is an independent experimental subpath. It accepts adjacent `ImageData` or `VideoFrame` values, compares a translation baseline, sparse flow, and feature matching, and returns a matrix, quality fields, failure reason, and three timing fields. It does not read detections, run a detection model, or automatically change the motion input of `createTracker({ algorithm: 'botsort' })`.

## Usage

```ts
import { estimateMotion } from 'web-sdk-pp-tracking/motion';

const result = await estimateMotion({
  previous: { image: previousImage, frameId: 0, timestampMs: 0 },
  current: { image: currentImage, frameId: 1, timestampMs: 33 },
  imageSize: { width: previousImage.width, height: previousImage.height },
}, { algorithm: 'sparse-flow' });

if (result.status === 'estimated' || result.status === 'identity') {
  console.log(result.matrix, result.confidence, result.timings.totalMs);
} else {
  console.warn(result.reason);
}
```

Frame IDs must be strictly adjacent, timestamps must increase, and both input sizes must match `imageSize`. Structural input errors throw `MotionEstimateError`. Texture, match, numerical, and quality failures return `status: 'failed'`; failed results do not contain a matrix and must not be changed into identity by the caller.

The estimator calls `copyTo` for a `VideoFrame` and does not close a frame owned by the caller. The caller remains responsible for its frame lifecycle. The current entry has no internal sequence state and needs no reset or dispose.

Sparse flow requires a candidate confidence of at least `0.8` by default; translation and feature matching use `0.5`. This conservative gate turns out-of-range local matches and ambiguous periodic texture into explicit failures instead of passing an incorrect matrix to a tracker.

## Demo and evidence

The local Demo entry is `demo/motion.html`, served as `/motion.html` after the Demo build. It provides original synthetic frames, local image pairs, a three-algorithm comparison, JSON export, and reset. Images stay in local memory; there is no video player, camera scheduler, or upload service.

The 2026-09-23 synthetic comparison is documented in the [motion estimation report](../../reports/2026-09-23-motion-estimation/README.en.md). Evidence currently covers Windows 11, Chromium 153, and CPU/main only. Feature matching is substantially slower at 640×360 p95 than the translation baseline, so automatic BoT-SORT integration is not justified yet.
