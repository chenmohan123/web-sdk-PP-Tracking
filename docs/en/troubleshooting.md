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
| FILE_TOO_LARGE / INVALID_SEQUENCE | Both the original Demo file and normalized compact input sequence must be≤5MiB by UTF-8 byte size, with1–3000 frames and≤100 boxes/frame. A DeepSORT all-empty sequence must declare top-level featureSpace because dimension cannot be inferred. Failure preserves previous options/input/results |
| Low scores do not recover lost tracks | Lost tracks need high scores; second-stage low association only applies to still-tracked candidates |
| IDs switch at crossings | ByteTrack/OC-SORT have no appearance; DeepSORT depends on feature quality. The optional ReID module does not guarantee personal identity or an accuracy gain on real, identical-input sequences |
| Model-source download failure | Check the chosen ModelScope/Hugging Face host and CORS. Explicit selections never silently switch sources; release/reset before selecting another |
| INTEGRITY_FAILED | Byte size or SHA-256 mismatch; clear this SDK's cache and retry without bypassing integrity checks |
| SESSION_FAILED / unresolved onnxruntime-web | ReID in the RC needs optional peer onnxruntime-web@1.27.0 and reachable built engine MJS/WASM resources |
| UNSUPPORTED_BACKEND | Use HTTPS/localhost and check WebGPU availability. GPU never silently falls back; explicitly choose CPU(WASM) if needed |
| Image extraction fails or is cancelled | Frame number and association state do not advance. Correct the image/detection array and retry. Images are limited to20MiB,8192 per side and16777216 pixels, with at most32 boxes per frame in the Demo model mode |
| Missing package build | Run npm run build before Demo, tests or packing |

Invalid Demo parameter changes preserve the current run. Valid changes create a new instance and clear history. Restart before playing after the last frame. Compact input export is available before processing and disabled while reading or playing. Result reports require processed results while paused, can exceed5MiB, and should not be used for replay; use the input-sequence export instead.
Install Playwright browsers as in the README, or set PLAYWRIGHT_BROWSERS_PATH to a matching cache. Never skip browser tests while claiming they passed.
