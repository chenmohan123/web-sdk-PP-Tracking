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

Original JSON and the complete verify log are archived in the [desktop evidence directory](../../reports/2026-09-19-desktop/README.md); screenshots stay ignored. A separate same-day headless Chromium151.0.7922.34 run covers only synthetic10/50/100-box performance. It does not replace the nine product interaction groups tested with Chromium153. Both used the stated Windows/CPU environment and CPU/main; neither establishes real mobile-device compatibility.

Local required checks establish only locally-compliant status. Remote Rulesets, release and hosting checks remain skipped. npm, GitHub Release and the hosted Demo are unpublished; planned manifest URLs are not availability evidence. Archive validation pins original file hashes, rejects changed samples and requires the current build to match the measured entry hash. It does not regenerate trusted hashes or pretend to repeat historical performance measurements.
