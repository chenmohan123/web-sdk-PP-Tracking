# web-sdk-pp-tracking

[中文（默认）](README.md)

Version **0.1.0 (local, unpublished)**. A framework-neutral CPU/main-thread multi-object tracker independently implementing ByteTrack's high/low-score association idea. No model download, inference or React runtime dependency.

## Local installation and usage

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
- [GitHub (planned, not created/published)](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm (planned, unpublished)](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [Hosted Demo (planned, not deployed)](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

Remote URLs in the manifest and package metadata are also planned destinations, not claims of availability.

## Documentation and limits

[Quick start](docs/en/quick-start.md) · [API](docs/en/api.md) · [Algorithm](docs/en/algorithm.md) · [Compatibility](docs/en/compatibility.md) · [Troubleshooting](docs/en/troubleshooting.md) · [Privacy/deployment](docs/en/privacy-deployment.md) · [Performance](docs/en/performance.md)

Preserve low-score detections for the second association stage. Lost tracks require high scores to recover. Seek requires reset followed by ordered replay.
Track IDs are local to an instance and generation, not personal identities. There is no ReID, and crossing/turning may switch IDs.
Evidence currently covers original synthetic mechanisms and mathematics, not authorized real-video MOT accuracy.

## Verification and release preparation

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
npm run verify
```

`verify` builds the SDK, checks types and units, consumes the actual npm tarball through ESM/CJS and declarations, builds the Demo and both examples, then tests real browser interactions. Screenshots and outputs go to `.tmp/browser/`.
See the [release checklist](docs/en/release-checklist.md) for portal standard verification and local evidence.
CI, Pages and OIDC npm workflows are prepared templates. First publication still requires explicit authorization, trusted-publisher setup and remote governance evidence. Local success is not online publication.

Project code: Apache-2.0. [NOTICE](NOTICE) and the [algorithm guide](docs/en/algorithm.md) record paper sources and implementation differences. This is not an official port or a claim of numerical equivalence. See [CHANGELOG](CHANGELOG.md).
