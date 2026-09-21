# Quick start

[中文](../zh-CN/quick-start.md) · [Home](../../README.en.md)

The local candidate also provides an [optional ReID subpath](reid-candidate.md) that extracts appearance vectors from human images and boxes for DeepSORT. It needs the local tarball plus optional ORT; the published0.1.0 installation below provides only root ByteTrack.

The published package remains version 0.1.0:

```sh
npm install web-sdk-pp-tracking@0.1.0
```

See the README for local development dependencies and tarball consumption. Building requires Node >=22.12.0; browsers execute generated JavaScript.
The local candidate is `0.2.0-alpha.0`; consume only a tarball produced by `npm pack` in this repository, never an unavailable remote npm alpha name.

```ts
import { createTracker } from 'web-sdk-pp-tracking';
const tracker = createTracker();
for (let i = 0; i < 8; i++) {
  const result = tracker.update({ timestampMs: i * 100, imageSize: { width: 640, height: 360 },
    detections: [{ box: { x: 20 + i * 8, y: 100, width: 60, height: 80 }, score: i === 5 ? 0.25 : 0.9, classId: 0 }] });
  console.log(result.tracks);
}
tracker.reset();
tracker.dispose();
```

Omitting the algorithm selects ByteTrack. Pass only OC-SORT-valid options for that strategy; results report the actual algorithm:

```ts
const tracker = createTracker({ algorithm: 'ocsort', ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 });
const result = tracker.update({ timestampMs: 0, imageSize: { width: 640, height: 360 }, detections: [] });
console.log(result.algorithm); // 'ocsort'
```

DeepSORT only consumes caller-provided vectors. Bind the feature-space ID to the weight digest, preprocessing version and output definition; include it on every frame, including empty frames, and include a valid vector on every detection, including low-score detections:

```ts
const featureSpace = { id: 'my-reid-sha256-preprocess-v1-output-v1', dimension: 4 };
const tracker = createTracker({ algorithm: 'deepsort', featureSpace, maxCosineDistance: 0.2, gallerySize: 30 });
const result = tracker.update({ timestampMs: 0, imageSize: { width: 640, height: 360 },
  featureSpaceId: featureSpace.id,
  detections: [{ box: { x: 20, y: 100, width: 60, height: 80 }, score: 0.9, classId: 0, embedding: [1, 0, 0, 0] }] });
```

Keep the0.25 detection so confirmed ByteTrack tracks can use low-score association. Do not discard all inputs below0.5 beforehand; OC-SORT uses high-score association only and cannot receive ByteTrack low-score options.
Sequence dimensions must stay fixed and timestamps must strictly increase. Reset before restart, seek or resizing. Seeking to frame k requires replaying every frame from the beginning to k.

Run `npm run dev:demo` for four original synthetic scenarios. DeepSORT appearance vectors in these samples are also synthetic and are not derived from images. JSON must be an object `{"frames":[...]}` and may add a top-level `featureSpace` for appearance input; limits: 5MiB, 1–3000 frames, 0–100 boxes/frame. Without the top-level declaration, the Demo only infers a space from consistent IDs and vector dimensions across all frames; it never fabricates embeddings for user data.
A single-frame file supports step and export. The compact input-sequence export can be re-imported directly and is limited to 5MiB. The result report includes the source sequence, actual options/feature space and only results actually processed since reset with time/runtime information; it can exceed 5MiB and is not guaranteed to be re-importable. Unprocessed results are never fabricated.
Language changes preserve state; the same file can be imported again. Refresh restores Chinese and clears memory.

See [API](api.md) and [Vanilla](../../examples/vanilla/README.en.md).
