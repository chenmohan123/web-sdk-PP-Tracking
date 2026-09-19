# Troubleshooting

[中文](../zh-CN/troubleshooting.md) · [Home](../../README.en.md)

| Error/symptom | Action |
| --- | --- |
| INVALID_INPUT | Check finite numbers, xywh bounds, scores/classes, counts, increasing timestamps and fixed sizes. DeepSORT also requires matching frame IDs and a finite, non-zero, correctly sized vector on every detection; reset before seek |
| INVALID_OPTIONS | ByteTrack requires low≤high≤new; OC-SORT/DeepSORT require high≤new. DeepSORT needs a valid featureSpace, cosine/gallery options and the four-million-scalar cap. Omit unknown fields, explicit undefined and strategy-exclusive options |
| ABORTED | Signal was cancelled before computation; retry with a new AbortController |
| DISPOSED | Create a new tracker; disposed instances cannot be reused |
| NUMERICAL_FAILURE | Check extreme numbers/time gaps; no state was committed. Reset with reasonable scales if needed |
| ID_EXHAUSTED | Reset for a new generation; IDs are not permanent identities |
| FILE_TOO_LARGE / INVALID_SEQUENCE | Demo input≤5MiB,1–3000 frames,≤100 boxes/frame. A DeepSORT all-empty sequence must declare top-level featureSpace because dimension cannot be inferred. Failure preserves previous options/input/results |
| Low scores do not recover lost tracks | Lost tracks need high scores; second-stage low association only applies to still-tracked candidates |
| IDs switch at crossings | ByteTrack/OC-SORT have no appearance; DeepSORT depends on caller vector quality. The SDK has no built-in ReID model or identity guarantee. See algorithm limits |
| Missing package build | Run npm run build before Demo, tests or packing |

Invalid Demo parameter changes preserve the current run. Valid changes create a new instance and clear history. Restart before playing after the last frame. Export is enabled only with processed results while paused.
Install Playwright browsers as in the README, or set PLAYWRIGHT_BROWSERS_PATH to a matching cache. Never skip browser tests while claiming they passed.
