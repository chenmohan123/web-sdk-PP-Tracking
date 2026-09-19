# web-sdk-pp-tracking

[中文（默认）](README.md)

Version **0.1.0 (release candidate; online status pending verification)**. A framework-neutral CPU/main-thread multi-object tracker independently implementing ByteTrack's high/low-score association idea. No model download, inference or React runtime dependency.

## Local installation and usage

After publication, install with `npm install web-sdk-pp-tracking@0.1.0`; before publication, use the local tarball below. Links identify final release destinations; npm, Release and Demo availability require dated remote receipts.

Node >=22.12.0. Development verification uses Node24.16.0 / pnpm11.21.0.

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm pack
# Install the generated local tarball in a consumer project:
npm install /absolute/path/web-sdk-pp-tracking/web-sdk-pp-tracking-0.1.0.tgz
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

## Standalone Demo and examples

Run `npm run dev:demo` and open http://127.0.0.1:4196. Run `npm run build:demo` for the static build.
Chinese by default; language switching preserves state. Includes original straight-motion, low-score, occlusion and crossing/turning sequences, JSON import, SVG paths, play/pause, step, reset, seek and actual-result export.
Input: `{ "frames": TrackingFrame[] }`, limited to 5MiB, 3000 frames, 100 boxes/frame. Failed validation preserves previous input and results. Processing stays in local memory.

- [Vanilla TypeScript](examples/vanilla/README.en.md)
- [Complete React reference](examples/react/README.en.md)
- [GitHub repository](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm package](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [Hosted Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

The manifest and package metadata use these same destinations. Local validation does not establish online availability.

## Documentation and limits

[Quick start](docs/en/quick-start.md) · [API](docs/en/api.md) · [Algorithm](docs/en/algorithm.md) · [Compatibility](docs/en/compatibility.md) · [Troubleshooting](docs/en/troubleshooting.md) · [Privacy/deployment](docs/en/privacy-deployment.md) · [Performance](docs/en/performance.md)

Preserve low-score detections for the second association stage. Lost tracks require high scores to recover. Seek requires reset followed by ordered replay.
Track IDs are local to an instance and generation, not personal identities. There is no ReID, and crossing/turning may switch IDs.
On 2026-09-19, seven fixed MOT17 FRCNN training sequences (5316 frames) produced default IDF1 **48.2922%**, IDSW **1101**, MOTA **44.4010%**, FP **4169**, FN **57166**. The low=high ablation produced IDF1 48.3465%, IDSW 1066, MOTA 44.3405%, FP 3785, FN 57653. Low-score continuation reduced misses but increased false positives and ID switches; it does not universally improve accuracy. These are not test-set leaderboard scores, official ByteTrack reproduction or end-to-end video measurements. See the [real-sequence report](reports/2026-09-19-mot17/README.en.md) for sources, licensing boundaries, scorer and per-sequence results.

## Verification and release preparation

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
npm run verify
```

`verify` builds the SDK, checks types and units, consumes the actual npm tarball through ESM/CJS and declarations, builds the Demo and both examples, then tests real browser interactions. Screenshots and outputs go to `.tmp/browser/`.
See the [release checklist](docs/en/release-checklist.md) for portal standard verification and local evidence.
Pages deployment follows CI validation. Release first checks the immutable tag against the package version, then publishes via OIDC in the `npm` environment. After a manual first publication, it skips duplicate publication only when npm `dist.integrity` exactly matches the built tarball; network/permission errors and mismatches fail. Manual publication does not automatically carry provenance; future OIDC publication requests it. Actual provenance claims depend on npm receipts. Remote governance and online status require separate verification.

Project code: Apache-2.0. [NOTICE](NOTICE) and the [algorithm guide](docs/en/algorithm.md) record paper sources and implementation differences. This is not an official port or a claim of numerical equivalence. See [CHANGELOG](CHANGELOG.md).
