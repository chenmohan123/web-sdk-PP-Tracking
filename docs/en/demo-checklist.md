# Demo checklist

[中文](../zh-CN/demo-checklist.md)

Based on portal `standards/v1/templates/demo-checklist.md`, applicable algorithm items in1.2.0. Verify against `npm run test:browser` evidence; DOM markers do not substitute for interactions.

- [x] One independent SDK; Chinese default, state-preserving English toggle, version and planned GitHub status in the brand bar.
- [x] Original sequences, fully validated local JSON import, parameters, play/pause/step, restart, seek and actual-result export.
- [x] ready/running/success/error states and stable error codes; meaningful preview/empty state without broken images.
- [x] Observations and dashed predictions are distinct; desktop results fit the first viewport and390px has no horizontal overflow.
- [x] data-sdk-algorithm-info exposes source, license, input/output and limits.
- [x] data-sdk-runtime-info / data-sdk-timing expose actual CPU/main, version, five timings and cold/warm semantics.
- [x] data-sdk-state-reset clears state, paths and history; seek resets and replays in order.
- [x] Invalid parameters preserve the run; valid application creates a fresh instance and clears results.
- [x] In-memory local processing, privacy text, focusable controls and keyboard seek.
- [ ] Remote GitHub/npm/Demo links require verification after publication; currently labeled planned.

Model assets/download/cache/precision controls are inapplicable and not fabricated. See [compatibility](compatibility.md) for dated browser limits and `.tmp/browser/` for screenshots.
