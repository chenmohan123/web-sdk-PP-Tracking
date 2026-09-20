# ReID source candidate

[中文](../zh-CN/reid-candidate.md) · [Home](../../README.en.md)

This local development module extracts 512-dimensional appearance vectors from decoded person crops for the existing DeepSORT strategy. It does not detect boxes, open videos/cameras or assign track IDs. The three root tracking strategies remain CPU/main; feature extraction separately selects WASM or WebGPU.

The module lives under `src/reid/` and a candidate script builds it into ignored `.tmp/reid-module/dist/`. **It is not included in npm package.exports or the release dist.** The current algorithm manifest covers only the release core; its compliance does not establish model distribution, Demo or release readiness. The planned public entry is `web-sdk-pp-tracking/reid`, which cannot currently be imported from the npm package.

## Input and model identity

Fixed model: `pplcnet-reid-fp32`, 33,704,835-byte FP32 ONNX, SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`, input `[1,3,192,64]`, output `[1,512]`. Weights are neither committed nor packaged. See the [model card](../../reports/2026-09-20-reid-preprocessing/model-card.en.md) for provenance, conversion, training disclosure and license scope.

Images use `RgbaImage={width,height,data}` with Uint8Array or Uint8ClampedArray backed by a non-shared buffer. Dimensions are positive integers, each ≤8192, with ≤16777216 pixels and exactly width×height×4 bytes. The caller handles EXIF/orientation and supplies decoded non-premultiplied sRGB RGBA. Arbitrary transparent PNG hidden-color fidelity through Canvas is not guaranteed.

Each detection is `{box:{x,y,width,height},score,classId}`, completely inside the image, with finite coordinates, positive sizes, score in [0,1] and a non-negative safe-integer classId. The default detection limit is 32, configurable from 1 to 64. Out-of-image boxes are rejected without silently clipping their output coordinates. Valid boxes floor left/top and ceil right/bottom; pixels are composited on white, kept upright RGB and resized to 64×192 with half-pixel bilinear sampling, float64 intermediates and ImageNet normalization before FP32 output.

Output preserves input order and binds embeddings to the original floating-point boxes, scores and classes. Embeddings have 512 finite values, normalized with a float64 L2 norm then written to Float32Array; zero vectors are rejected. featureSpace binds the complete model hash, `rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1` and `l2-f32-v1`. Equal dimensions do not make different models or preprocessing compatible.

## Local source usage

Import the factory from `src/reid/index.ts` in a repository source consumer with TypeScript bundling. This is not a published npm installation example:

```ts
import { createReIdExtractor } from './src/reid/index.js';
import { createTracker } from './src/index.js';

const extractor = createReIdExtractor({
  modelId: 'pplcnet-reid-fp32', backend: 'wasm', modelBytes,
});
const tracker = createTracker({ algorithm: 'deepsort', featureSpace: extractor.featureSpace });
try {
  const loaded = await extractor.load({ signal });
  const features = await extractor.extract({ image, detections }, { signal });
  const result = tracker.update({
    timestampMs, imageSize: { width: image.width, height: image.height },
    featureSpaceId: features.featureSpace.id, detections: features.detections,
  });
  console.log(loaded, features.runtime, features.timings, result);
} finally {
  tracker.dispose();
  await extractor.dispose();
}
```

`modelBytes` is the exact model ArrayBuffer prepared by the caller; `image` and `detections` follow the contract above. `timestampMs` follows Tracker's increasing-time rules; `signal` is optional. Call tracker.update only after the entire extraction succeeds. Failed or cancelled extraction returns no partial vectors and must not advance association for that frame.

Model bytes are copied at factory entry, and image/detection metadata at extract entry, so later caller mutations do not change in-flight input. The root never loads ORT, and the candidate loads ORT Web dynamically only during load. This candidate supports main execution only, single-threaded WASM and no silent GPU-to-CPU fallback.

## Lifecycle and errors

After load succeeds, extract can be repeated; load is idempotent in ready state. Only one load/extract may run per instance; concurrent calls return BUSY without queuing. Failed load returns to idle and can retry; failed extract returns to ready. Changing backend/source requires disposing and creating a new instance, and resetting the dependent tracker.

Cancellation is checked at entry, download, session boundaries, crop boundaries and result commit. A single ORT run is not forcibly preempted: cancellation waits for completion, disposes tensors and discards the whole frame. dispose is idempotent, rejects new calls immediately and waits for active work before releasing the session.

Stable codes: INVALID_INPUT, INVALID_MANIFEST, UNSUPPORTED_BACKEND, DOWNLOAD_FAILED, INTEGRITY_FAILED, OUT_OF_MEMORY, SESSION_FAILED, INFERENCE_FAILED, ABORTED, BUSY, NOT_LOADED and DISPOSED. Recognizable allocation failures use OUT_OF_MEMORY; device loss maps to SESSION_FAILED or INFERENCE_FAILED by stage without guessing that unknown failures are OOM.

## Resources, cache and timing

Supply either modelBytes or an explicit source, never both. source contains kind (modelscope/huggingface), repository, immutable revision, path, HTTPS downloadUrl, bytes and sha256 matching the fixed model. Local tests may use controlled resources; no default hub URL is invented. ModelScope remains the planned default, with Hugging Face optional once distributed.

Local bytes are not persisted. Remote models use a CacheStorage namespace owned by this module; cache hits still verify bytes/SHA. Corruption fails integrity, and a failed explicit source never switches providers. `estimateReIdCache()` reports bytes/entries and `clearReIdCache()` clears only this module's cache. Clearing cache neither releases loaded instances nor resets Tracker; the host must cancel/dispose and reset dependent tracking state for complete cleanup.

load reports download, cache read, integrity, session and total time. extract separately reports preprocessing, inference, normalization and its total. decodeMs is zero because decoding belongs to the caller. Model and CPU association costs are reported separately; sums of medians from different runs are not full-video frame rates.

## Verification and release scope

The [stage report](../../reports/2026-09-21-reid-module/README.en.md) records actual environments, vectors, cancellation recovery and cache evidence. Browser tests require the fixed local model and previous RGBA fixtures: run `node tests/reid-browser.mjs`; `TRACKING_REID_FIXTURES` selects the fixture directory and `TRACKING_REID_ORT_DIST` selects ORT Web 1.27.0 dist. The test does not contact real model hubs.

Compressed-download verification uses local HTTPS and an ephemeral self-signed certificate; setup commands are in the stage report. Defaults are `.tmp/reid-module/localhost-test.key` and `.crt`, overridable with `TRACKING_REID_TLS_KEY` / `TRACKING_REID_TLS_CERT`. Only the automated test browser context ignores certificate errors; no system certificate installation is needed, and credentials are not committed.

Release still requires the adopted license basis and attribution, actual dual-source immutable revisions/hashes and browser CORS evidence, followed by the hybrid manifest, public entry and Demo. Tracking IDF1/IDSW/MOTA and complete costs on real detection sequences remain future work. Repeated-frame interface tests are not evidence of real tracking quality. Phones, Safari, Firefox, Workers, NPU and complete video/camera pipelines are not claimed as compatible.
