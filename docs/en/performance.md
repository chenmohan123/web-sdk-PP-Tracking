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

Demo exports contain all five actual timings, recorded timestamps and runtime metadata for processed frames. Playback timers control presentation only; the algorithm never receives browser wall time. Synchronous main execution may block UI; AbortSignal is checked before computation only.
Import validation scans structure linearly without running3000 associations. Seek recomputes the prefix, so long sequences can take time. SVG paths show positions from the most recent100 results; export retains all actual results from the current run.

Only synthetic mechanism verification in the documented [environment](compatibility.md) is established. No real mobile-device performance or MOT accuracy claim; page frame rate is not algorithm throughput.
