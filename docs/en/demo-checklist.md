# Demo checklist

[中文](../zh-CN/demo-checklist.md)

Local [0.2.0-rc.1](releases/0.2.0-rc.1.md) integrates four algorithms and motion import/export as of 2026-09-22. [Current validation](../../reports/2026-09-22-botsort-integration/README.en.md) separately records package, desktop-browser and fixed-sequence parity evidence. Historical checks below retain their original versions and dates and do not mean rc.1 is published.

The released [0.2.0-rc.2](releases/0.2.0-rc.2.md) adds an independent `/motion.html` lab as of 2026-09-23. Its synthetic three-algorithm evidence is separate from the main Demo and does not change stable `latest` 0.1.0.

Based on portal `standards/v1/templates/demo-checklist.md`, applicable algorithm items in1.2.0. Verify against `npm run test:browser` evidence; DOM markers do not substitute for interactions.

- [x] One independent SDK; Chinese default, state-preserving English toggle, version and GitHub/npm project links in the brand bar.
- [x] Three strategies and original sequences (synthetic DeepSORT appearance vectors), local JSON import/switch committed atomically after full validation including the normalized 5MiB UTF-8 limit, parameters, play/pause/step, restart, seek, re-importable compact input-sequence export and actual result-report export.
- [x] ready/running/success/error states and stable error codes; meaningful preview/empty state without broken images.
- [x] Observations and dashed predictions are distinct; desktop results fit the first viewport and390px has no horizontal overflow.
- [x] data-sdk-algorithm-info exposes source, license, input/output and limits.
- [x] data-sdk-runtime-info / data-sdk-timing expose actual CPU/main, version, five timings and cold/warm semantics.
- [x] data-sdk-state-reset clears state, paths and history; seek resets and replays in order.
- [x] Invalid options, invalid final import frames and vectorless DeepSORT switches preserve options/input/results; valid application creates a fresh instance and clears results.
- [x] In-memory local processing, privacy text, focusable controls and keyboard seek.
- [x] Independent Motion Demo with Chinese default, English toggle, three-algorithm comparison, reset, JSON export and no 390px horizontal overflow; quality failures expose no applicable matrix.
- Verify remote GitHub/npm/Demo links and publication evidence using the [release checklist](release-checklist.md).

Model assets/download/cache/precision controls are inapplicable and not fabricated. See [compatibility](compatibility.md) for dated browser limits and `.tmp/browser/` for screenshots.
