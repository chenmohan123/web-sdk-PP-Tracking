# web-sdk-pp-tracking

[中文（默认）](README.md)

Local candidate version **0.2.0-alpha.0**. A framework-neutral CPU/main-thread multi-object tracker independently implementing ByteTrack high/low-score association and OC-SORT observation-centric mechanisms. No model download, inference or React runtime dependency. The published npm package and hosted HTTPS Demo remain **0.1.0**; no remote alpha package is available.

## Installation and usage

```sh
npm install web-sdk-pp-tracking@0.1.0
```

```ts
import { createTracker } from 'web-sdk-pp-tracking';
const tracker = createTracker();
const result = tracker.update({ timestampMs: 0, imageSize: { width: 640, height: 360 },
  detections: [{ box: { x: 20, y: 40, width: 60, height: 80 }, score: 0.9, classId: 0 }] });
console.log(result.tracks, result.runtime, result.timings);
tracker.reset();
tracker.dispose();
```

## Local development

Node >=22.12.0. Development verification uses Node24.16.0 / pnpm11.21.0. From the repository root:

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm pack
# Install the generated local tarball in a consumer project:
npm install /absolute/path/web-sdk-pp-tracking/web-sdk-pp-tracking-0.2.0-alpha.0.tgz
```

## Standalone Demo and examples

Run `npm run dev:demo` and open http://127.0.0.1:4196. Run `npm run build:demo` for the static build.
Chinese by default; language switching preserves state. Includes ByteTrack/OC-SORT selection with algorithm-valid parameters, original straight-motion, low-score, occlusion and crossing/turning sequences, JSON import, SVG paths, play/pause, step, reset, seek and actual-result export. Switching stops playback, rebuilds from valid defaults and clears results; export contains only applied options and the actual algorithm.
Input: `{ "frames": TrackingFrame[] }`, limited to 5MiB, 3000 frames, 100 boxes/frame. Failed validation preserves previous input and results. Processing stays in local memory.

- [Vanilla TypeScript](examples/vanilla/README.en.md)
- [Complete React reference](examples/react/README.en.md)
- [GitHub repository](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm package](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [Hosted Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

The manifest and package metadata use these same project URLs.

## Documentation and limits

[Quick start](docs/en/quick-start.md) · [API](docs/en/api.md) · [Algorithm](docs/en/algorithm.md) · [Compatibility](docs/en/compatibility.md) · [Troubleshooting](docs/en/troubleshooting.md) · [Privacy/deployment](docs/en/privacy-deployment.md) · [Performance](docs/en/performance.md)

Omitting `algorithm` selects ByteTrack; `createTracker({ algorithm: 'ocsort' })` selects OC-SORT. Only ByteTrack uses low-score detections for second-stage association; OC-SORT rejects `lowScoreThreshold` and `lowMatchIouThreshold`. Both result forms report the actual `algorithm`. Seek requires reset followed by ordered replay.
Track IDs are local to an instance and generation, not personal identities. There is no ReID, and crossing/turning may switch IDs.
On 2026-09-19, the same 5316 frames from seven fixed MOT17 FRCNN training sequences produced ByteTrack IDF1 **48.2922%**, IDSW **1101**, MOTA **44.4010%**, FP **4169**, FN **57166**; OC-SORT produced **48.4107%**, **881**, **39.5434%**, **6751**, **60259**. OC-SORT reduced identity switches by 220 and slightly increased IDF1, but MOTA fell 4.8577 percentage points, FP/FN increased, and cumulative Node tracking time was 8.19% higher, so ByteTrack remains the default. All seven candidate ByteTrack MOT outputs byte-match the historical 0.1.0 baseline. Both algorithms passed repeated determinism and separately matched Node over a complete 600-frame sequence in Chromium 153. See the [candidate comparison](reports/2026-09-19-ocsort/README.en.md). These are not test-set leaderboard scores, official algorithm reproductions, end-to-end video or cross-device measurements.

## Verification and release preparation

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
npm run verify
```

`verify` builds the SDK, checks types and units, consumes the actual npm tarball through ESM/CJS and declarations, builds the Demo and both examples, then tests real browser interactions. Screenshots and outputs go to `.tmp/browser/`.
See the [release checklist](docs/en/release-checklist.md) for portal standard verification and local evidence.
Pages deployment follows CI validation. Release first checks the immutable tag against the package version, then publishes via OIDC in the `npm` environment. After a manual first publication, it skips duplicate publication only when npm `dist.integrity` exactly matches the built tarball; network/permission errors and mismatches fail. Manual publication does not automatically carry provenance; future OIDC publication requests it. See the release checklist for evidence and remote verification items.

Project code: Apache-2.0. [NOTICE](NOTICE) and the [algorithm guide](docs/en/algorithm.md) record paper sources and implementation differences. This is not an official port or a claim of numerical equivalence. See [CHANGELOG](CHANGELOG.md).
