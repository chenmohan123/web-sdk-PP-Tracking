# Demo checklist

[中文](../zh-CN/demo-checklist.md)

Based on portal `standards/v1/templates/demo-checklist.md`, applicable algorithm items in1.2.0. Verify against `npm run test:browser` evidence; DOM markers do not substitute for interactions.

- [x] One independent SDK; Chinese default, state-preserving English toggle, version and GitHub/npm project links in the brand bar.
- [x] Three strategies and original sequences (synthetic DeepSORT appearance vectors), local JSON import/switch committed atomically after full validation, parameters, play/pause/step, restart, seek and export of actual options/feature space/sequence/results.
- [x] ready/running/success/error states and stable error codes; meaningful preview/empty state without broken images.
- [x] Observations and dashed predictions are distinct; desktop results fit the first viewport and390px has no horizontal overflow.
- [x] data-sdk-algorithm-info exposes source, license, input/output and limits.
- [x] data-sdk-runtime-info / data-sdk-timing expose actual CPU/main, version, five timings and cold/warm semantics.
- [x] data-sdk-state-reset clears state, paths and history; seek resets and replays in order.
- [x] Invalid options, invalid final import frames and vectorless DeepSORT switches preserve options/input/results; valid application creates a fresh instance and clears results.
- [x] In-memory local processing, privacy text, focusable controls and keyboard seek.
- Verify remote GitHub/npm/Demo links and publication evidence using the [release checklist](release-checklist.md).

Model assets/download/cache/precision controls are inapplicable and not fabricated. See [compatibility](compatibility.md) for dated browser limits and `.tmp/browser/` for screenshots.
