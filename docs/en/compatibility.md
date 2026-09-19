# Compatibility

[中文](../zh-CN/compatibility.md) · [Home](../../README.en.md)

Local candidate verification date:2026-09-19. Environment: Windows11 Pro10.0.26200, Intel Core i5-10400F @2.90GHz; Node24.16.0, pnpm11.21.0; Playwright1.63.0 desktop Chromium153.0.8010.12. Runtime: `web-sdk-pp-tracking@0.2.0-alpha.0`, actual CPU / JavaScript / main. No GPU/driver dependency; the published version remains 0.1.0.

| Scope | Evidence and limits |
| --- | --- |
| Desktop Chromium | `npm run test:browser` covers ByteTrack/OC-SORT switching, exclusive options, Chinese/English, step, play/pause, restart, seek, asynchronous-import protection, import/export, four synthetic scenarios and Vanilla |
| 390px layout | Resized desktop viewport with no horizontal overflow; not real mobile-device verification |
| ESM/CJS/TypeScript | `npm run check:package` installs and consumes the actual tarball |
| Safari/Firefox/mobile/WeChat | Unverified; support is not claimed |
| Worker/WebGPU/WASM/NPU | Not implemented in this version |

`tests/browser.mjs` writes screenshots, browser version and interaction counts to `.tmp/browser/`. This is dated local evidence, not proof of hosted deployment or cross-device compatibility. Synthetic scenarios do not establish real-world MOT accuracy.

Original JSON and the complete verify log are archived in the [desktop evidence directory](../../reports/2026-09-19-desktop/README.md); screenshots stay ignored. A separate same-day headless Chromium151.0.7922.34 run covers only synthetic10/50/100-box performance. It does not replace the nine product interaction groups tested with Chromium153. Both used the stated Windows/CPU environment and CPU/main; neither establishes real mobile-device compatibility.

The same-day [real sequence report](../../reports/2026-09-19-mot17/README.en.md) adds all 5316 frames of seven MOT17 FRCNN training sequences in Node, default/ablation and full deterministic repeats. Chromium153.0.8010.12 matches Node non-timing results byte for byte for the entire 600-frame sequence02. Scope remains the stated Windows desktop CPU/main environment; accuracy evidence does not expand device compatibility or establish a test-set leaderboard result.

Local required checks establish only locally-compliant status; the offline checker does not verify remote Rulesets, publication, or hosting. Full verify is in the [2026-09-19 validation record](../../reports/2026-09-19-release-candidate/README.md). The final [first release record](../../reports/2026-09-19-release/README.md) includes actual ESM/CJS consumption from the public npm package plus GitHub Release, governance, Pages deployment, and hosted Demo receipts. Hosted Demo evidence remains same-day desktop Chromium 153 on CPU/main and does not extend compatibility to mobile devices, Safari, Firefox, WeChat, or other backends. Archive validation pins original file hashes, rejects changed samples, and requires the current build to match the measured entry hash. It does not regenerate trusted hashes or repeat historical performance measurements. Each record is preserved separately without overwriting historical desktop or MOT17 reports.
