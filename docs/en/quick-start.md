# Quick start

[中文](../zh-CN/quick-start.md) · [Home](../../README.en.md)

This is local, unpublished version0.1.0. Follow the README to install development dependencies and run `npm run build`, then install the local tarball in a consumer. Building requires Node >=22.12.0; browsers execute generated JavaScript.

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

Keep the0.25 detection so confirmed tracks can use low-score association. Do not discard all inputs below0.5 beforehand.
Sequence dimensions must stay fixed and timestamps must strictly increase. Reset before restart, seek or resizing. Seeking to frame k requires replaying every frame from the beginning to k.

Run `npm run dev:demo` for four original synthetic scenarios. JSON must be an object `{"frames":[...]}`; limits: 5MiB, 1–3000 frames, 0–100 boxes/frame.
A single-frame file supports step and export. Exports include only frames actually processed since the last reset, with time/runtime information. Unprocessed results are never fabricated.
Language changes preserve state; the same file can be imported again. Refresh restores Chinese and clears memory.

See [API](api.md) and [Vanilla](../../examples/vanilla/README.en.md).
