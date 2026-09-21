# Vanilla TypeScript example (RC 0.2.0-rc.0)

[中文](README.md)

No UI framework. The public `web-sdk-pp-tracking` entry resolves to the locally built package. Each step displays an actual `TrackingResult`. Reset clears state and restarts timestamps at zero. See the root release checklist for delivery status.

From the repository root (Node >=22.12.0):

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec vite examples/vanilla --host 127.0.0.1 --port 4197
npm run build:vanilla
```

Open http://127.0.0.1:4197. This is a DOM/H5 portability baseline, not evidence of CDN, WeChat web-view or mobile browser support. No published npm package is required.
