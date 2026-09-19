# Performance and timings

[中文](../zh-CN/performance.md) · [Home](../../README.en.md)

All values are milliseconds measured with performance.now(), not placeholders.

| Field | Boundary |
| --- | --- |
| validationMs | update entry through input/cancellation validation |
| predictionMs | State copying, pre-removal and Kalman prediction |
| associationMs | Grouping and three association stages |
| updateMs | Correction, creation and track snapshots |
| totalMs | update entry through result construction; independently measured, not a sum |

Empty stages still have scheduling overhead. No fabricated model/download/cache timings. Cold means the first frame of a new instance; warm means reusing its state. Reset clears motion state, not the JavaScript environment.
Record input and active-state scale, initialization/reset boundaries, device, browser, runtime and date. Timings from different sizes or states are not direct speedup ratios.

Demo exports contain all five actual timings, recorded timestamps, applied options and actual algorithm metadata for processed frames. Playback timers control presentation only; the algorithm never receives browser wall time. Synchronous main execution may block UI; AbortSignal is checked before computation only.
Import validation scans structure linearly without running3000 associations. Seek recomputes the prefix, so long sequences can take time. SVG paths show positions from the most recent100 results; export retains all actual results from the current run.

On 2026-09-19, Windows 11 / i5-10400F / headless Chromium 151.0.7922.34 measured 600 warm updates each for 10, 50 and 100 boxes. SDK totalMs p50/p95 were 1.0/1.3, 5.3/8.9 and 11.3/14.9 ms. Three cold samples per size measured instance creation plus the first frame, with p50 about 0.2/0.6/1.1 ms. Cold has no existing tracks to match and is not a browser cold start or a speedup baseline. Input generation, detection models and rendering are excluded.

The [desktop report](../../reports/2026-09-19-desktop/README.md) retains fixed inputs, all raw samples, quantile definitions, the measured core commit and build hashes. Run `node scripts/evaluation/verify-archive.mjs` to validate pinned evidence and replay the public API; run `node scripts/evaluation/benchmark.mjs --out .tmp/new-benchmark.json` for a new measurement. Install the locked dependencies and build first. Both runners accept `--sdk` and `--out`; the API runner also accepts `--input`. Configure PLAYWRIGHT_BROWSERS_PATH for an installed matching Chromium, or install Chromium with Playwright. The current SDK uses Chromium153; new output records its actual version and does not overwrite the historical151 report.

Warm samples use three repetitions of200 frames after a30-frame JIT warmup. Inputs are a1000×1000 same-class grid of35×45 boxes moving by `3*sin(frame/25)`, with generation outside timing. p50 uses sorted index floor((n−1)×0.5), p95 uses ceil((n−1)×0.95), without interpolation. Timer resolution may produce zero samples. Historical Chromium151 performance and Chromium153 product interaction evidence are distinct; archiving did not remeasure performance.

Only the dated [environment](compatibility.md) is established. No real mobile-device, worst-case performance or MOT test-set accuracy claim; page frame rate is not algorithm throughput. Version 0.2.0-alpha.0 is local-only and does not promote either algorithm's timings or accuracy comparison to an online release claim; 0.1.0 package size and integrity belong only to historical published measurements.

The [2026-09-19 real detection evaluation](../../reports/2026-09-19-mot17/README.en.md) covers all 5316 frames of seven fixed MOT17 FRCNN training sequences. Official TrackEval default totals: IDF1 48.2922%, IDSW 1101, MOTA 44.4010%, FP 4169, FN 57166; low=high ablation: 48.3465%, 1066, 44.3405%, 3785, 57653. Default low-score association reduces misses but adds false positives and switches; no universal accuracy improvement is claimed. Node default SDK totalMs sums to 8627.59 ms. Chromium153 matches Node non-timing output for the complete 600-frame sequence02. The report pins data/scorer/build identities and documents per-sequence metrics, capacity and failure/recovery examples. Detection, decoding and rendering are excluded.

Output protection resolves existing parent directories, including Windows case aliases and symlink/junction aliases, and checks again before writing. Reports use exclusive creation: an existing output fails with EEXIST. Choose a new `--out` filename for each runner execution. Archive verification allocates its own unique temporary output and remains repeatable. Run `node --test scripts/evaluation/check-output-path.mjs` for the focused output protection checks.
