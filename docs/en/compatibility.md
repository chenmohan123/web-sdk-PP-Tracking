# Compatibility

[中文](../zh-CN/compatibility.md) · [Home](../../README.en.md)

Local candidate verification date:2026-09-19. Environment: Windows11 Pro10.0.26200, Intel Core i5-10400F @2.90GHz; Node24.16.0, pnpm11.21.0; Playwright1.63.0 desktop Chromium153.0.8010.12. Runtime: `web-sdk-pp-tracking@0.2.0-alpha.0`, actual CPU / JavaScript / main. No GPU/driver dependency; the published version remains 0.1.0.

This matrix describes the release core and its Demo at that date. WASM/WebGPU, input limits and dated evidence for the [ReID source candidate](reid-candidate.md) are recorded separately. They neither change this CPU association backend declaration nor establish a published npm model entry.

| Scope | Evidence and limits |
| --- | --- |
| Desktop Chromium | `npm run test:browser` covers ByteTrack/OC-SORT/DeepSORT switching, exclusive options, appearance-envelope import and failure atomicity, actual-option/feature-space/sequence export, Chinese/English, step, play/pause, restart, seek, four synthetic scenarios and Vanilla |
| 390px layout | Resized desktop viewport with no horizontal overflow; not real mobile-device verification |
| ESM/CJS/TypeScript | `npm run check:package` installs the actual tarball and consumes all three algorithms while preserving the runtime export allowlist |
| Safari/Firefox/mobile/WeChat | Unverified; support is not claimed |
| Worker/WebGPU/WASM/NPU | Not implemented in this version |

`tests/browser.mjs` writes screenshots, browser version and interaction counts to `.tmp/browser/`. This is dated local evidence, not proof of hosted deployment or cross-device compatibility. Synthetic scenarios do not establish real-world MOT accuracy.

The three-strategy candidate's complete verify log is `reports/2026-09-19-deepsort/verify.txt`; Chromium153 reports and screenshots are generated under `.tmp/browser/` with11 check groups. `2026-09-19-ocsort` establishes only the earlier two-strategy candidate; `2026-09-19-desktop` and `2026-09-19-release-candidate` are historical 0.1.0 evidence. Separate Chromium151 headless evidence covers only synthetic10/50/100-box performance and does not replace this interaction run. None establishes real mobile-device or real-appearance-vector compatibility.

The same-day [two-algorithm candidate comparison](../../reports/2026-09-19-ocsort/README.en.md) pins all 5316 frames of seven MOT17 FRCNN training sequences in Node and each algorithm's complete 600-frame sequence02 alignment in Chromium153. Historical ByteTrack default/ablation evidence remains in the [0.1.0 real-sequence report](../../reports/2026-09-19-mot17/README.en.md). Scope remains the stated Windows desktop CPU/main environment; accuracy evidence does not expand device compatibility or establish a test-set leaderboard result.

Local required checks establish only locally-compliant status; the offline checker does not verify remote Rulesets, publication, or hosting. Use the `2026-09-19-deepsort` log above for this three-strategy candidate's full verify. The [0.1.0 validation record](../../reports/2026-09-19-release-candidate/README.md) and [first release record](../../reports/2026-09-19-release/README.md) prove only the historical public package, GitHub Release, governance, Pages deployment, and hosted Demo. Hosted Demo evidence remains same-day desktop Chromium 153 on CPU/main and does not extend compatibility to mobile devices, Safari, Firefox, WeChat, or other backends. Validate that historical archive with `node scripts/evaluation/verify-archive.mjs --sdk <independent-directory-at-the-matching-historical-commit-and-build>`. The validator pins the old entry hash and does not regenerate trusted hashes, so rejecting the current candidate directory is expected. Each record remains separate without overwriting historical desktop or MOT17 reports.
