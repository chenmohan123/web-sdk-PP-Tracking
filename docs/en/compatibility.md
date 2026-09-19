# Compatibility

[中文](../zh-CN/compatibility.md) · [Home](../../README.en.md)

Local verification date:2026-09-19. Environment: Windows11 Pro10.0.26200, Intel Core i5-10400F @2.90GHz; Node24.16.0, pnpm11.21.0; Playwright1.63.0 desktop Chromium153.0.8010.12. Runtime: `web-sdk-pp-tracking@0.1.0`, actual CPU / JavaScript / main. No GPU/driver dependency.

| Scope | Evidence and limits |
| --- | --- |
| Desktop Chromium | `npm run test:browser` covers Chinese/English, step, play/pause, restart, seek, import/export, four synthetic scenarios and Vanilla |
| 390px layout | Resized desktop viewport with no horizontal overflow; not real mobile-device verification |
| ESM/CJS/TypeScript | `npm run check:package` installs and consumes the actual tarball |
| Safari/Firefox/mobile/WeChat | Unverified; support is not claimed |
| Worker/WebGPU/WASM/NPU | Not implemented in this version |

`tests/browser.mjs` writes screenshots, browser version and interaction counts to `.tmp/browser/`. This is dated local evidence, not proof of hosted deployment or cross-device compatibility. Synthetic scenarios do not establish real-world MOT accuracy.
