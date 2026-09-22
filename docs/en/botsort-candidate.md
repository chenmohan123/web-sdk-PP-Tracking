# BoT-SORT external-motion candidate

[中文](../zh-CN/botsort-candidate.md). Local stage: 2026-09-22, CPU/main. This is a future algorithm core in the same SDK, not yet included in npm exports, root-factory choices, or the production Demo.

Run `node scripts/build-botsort-candidate.mjs` in this repository. It writes ESM/CJS/declarations to `.tmp/botsort-core/build/` and verifies runtime and NodeNext consumption. Save the following as an `.mjs` file at the repository root:

```js
import { createBoTSortTracker } from './.tmp/botsort-core/build/index.js';
const tracker = createBoTSortTracker({ minHits: 1 });
const imageSize = { width: 640, height: 480 };
const detection = x => ({ box: { x, y: 100, width: 20, height: 80 }, score: 1, classId: 0 });
tracker.update({
  frameId: 0, timestampMs: 0, imageSize, detections: [detection(50)],
  motion: { status: 'initial', from: null, to: { frameId: 0, timestampMs: 0 } },
});
const result = tracker.update({
  frameId: 1, timestampMs: 100, imageSize, detections: [detection(100)],
  motion: {
    status: 'estimated', from: { frameId: 0, timestampMs: 0 }, to: { frameId: 1, timestampMs: 100 },
    matrix: [1, 0, 50, 0, 1, 0], source: 'Caller estimator', confidence: 1,
  },
});
console.log(result.algorithm, result.tracks[0].id, result.tracks[0].box.x); // botsort 1 100
tracker.dispose();
```

## Inputs and lifecycle

The candidate inherits common ByteTrack options and low-score continuation. It does not accept `algorithm`, OC-SORT direction settings, or DeepSORT gallery settings. `motionFailure?: 'error' | 'identity'` defaults to error. Optional appearance is configured as follows:

```js
const tracker = createBoTSortTracker({
  appearance: {
    featureSpace: { id: 'Fixed caller feature space', dimension: 512 },
    proximityIouThreshold: 0.5, maxCosineDistance: 0.25, emaAlpha: 0.9,
  },
});
// Each frame requires the same featureSpaceId and every detection a finite nonzero 512D embedding.
```

The existing `./reid` can provide a matching space and vectors, but the candidate never calls the model automatically. Without appearance, featureSpaceId/embedding are rejected. With appearance, inputs are copied and normalized, and each track retains one EMA vector. Low-score detections only continue geometric tracks; they neither use nor update appearance. emaAlpha is in [0,1); thresholds/dimensions are validated by the source contract. Exact cancellation of opposite vectors during EMA returns NUMERICAL_FAILURE without advancing state.

frameId is a nonnegative safe integer; it and timestampMs strictly increase. Image dimensions are integers in 1–32768; detections retain original-image zero-based boxes, scores, and classes. The first frame and every reset require `initial`. Later motion.from must match the last **successfully processed** frame's ID/time, and motion.to must match the current frame. Skipped frames are allowed only with a transform spanning the actual processing interval. Gaps exceeding largeGapMs, seek, or size changes require reset.

| motion.status | Required fields and meaning |
| --- | --- |
| initial | from:null and to; first frame/reset only |
| identity | from/to, explicit identity without matrix |
| estimated | from/to, matrix, source, confidence |
| unavailable | from/to, reason; error by default, accepted only with explicit motionFailure:'identity' |

The matrix is `[a,b,tx,c,d,ty]`, mapping the previous processed original image into the current one: `x'=a*x+b*y+tx`, `y'=c*x+d*y+ty`. source/reason are nonempty trimmed strings of 1–256 characters; confidence is in [0,1] and is caller metadata, not an automatic confidence gate. Matrices must be dense, finite and orientation-preserving, with singular values in [0.8,1.25], rotation magnitude ≤15°, and translation ≤25% of the image diagonal. Reflections, singularity, strong shear, and out-of-range motion are rejected. Frame headers, motion objects, and options reject unknown fields.

Input, cancellation, or numerical errors do not commit tracks, frame identity, time, EMA, or generation, so corrected frames can be retried. reset clears state, restarts IDs at 1, and increments generation. dispose is idempotent; update/reset afterward return DISPOSED. Synchronous cancellation is checked only before computation starts.

## Mathematics, output, and limits

Compensation runs after prediction and before association. Centers/velocities use the affine linear map; dimensions use the axis-aligned envelope of transformed corners: `J=diag(M,abs(M),M,abs(M))`, center means receive translation, and covariance becomes `JPJᵀ`. Identity retains original values. Output boxes may leave the image; clipping is not fed back into the filter. Matrix uncertainty is not modeled, and repeated rotation envelopes can inflate boxes.

High-score appearance fusion requires matching classes, raw IoU≥0.5, and cosine distance≤0.25 by default. Cost is `min(1-IoU, cosine/2)`, including tentative association. Failed appearance gates still allow geometric matching. This retains the SDK's seconds-based fixed noise/lifecycle and does not implement all paper mechanisms. Width/height mapping, inclusive thresholds, and noise differ from the reference implementation. See the [research report](../../reports/2026-09-21-botsort-feasibility/README.en.md) for source/license scope; no third-party tracking implementation was copied.

Results report algorithm botsort, runtimeVersion `web-sdk-pp-tracking@0.2.0-rc.0+botsort-core.1`, cpu/main, frameId, and motion status/reason. Only estimated motion reports applied:true. validationMs includes motion/features validation; predictionMs includes matrix application; totalMs is independently measured around the candidate call. **Image estimation, detection, ReID extraction, transport, and rendering are excluded.**

[Current validation](../../reports/2026-09-22-botsort-core/README.en.md) covers seven fixed sequences/5316 frames and desktop Chromium; 09 still regresses. The next stage integrates the root factory, four-algorithm Demo, version, and release checks. Browser estimation, phones, video/camera, and portal Workflow remain separate work.
