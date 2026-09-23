# Browser Motion Estimation Lab Report

Date: 2026-09-23. Version: local `0.2.0-rc.2`. This is Spike evidence for the independent PP-Tracking `motion` subpath, not a stable compatibility or end-to-end video performance claim.

## Scope

- Input: adjacent 320×180 and 640×360 RGBA synthetic frames generated with fixed seed `20260923`.
- Scenarios: small/medium/large translation, rotation, scale, affine, static, brightness change, local occlusion, repeated texture, low texture, and out-of-range motion.
- Algorithms: `translation`, `sparse-flow`, and `feature-match`.
- Environment: Node `v24.16.0`, Windows `win32`, CPU/main. The browser page has a separate Chromium smoke test; these are Node synthetic timings and do not generalize to phones, workers, GPU/NPU, Safari, or Firefox.
- Raw data: [metrics.json](metrics.json). Script: `scripts/motion-benchmark.mjs`.

## Results

| Algorithm | 320×180 success | 320×180 p95 | 640×360 success | 640×360 p95 |
| --- | ---: | ---: | ---: | ---: |
| Translation | 41.7% | about 13.3 ms | 41.7% | about 15.5 ms |
| Sparse flow | 33.3% | about 53.7 ms | 33.3% | about 71.8 ms |
| Feature matching | 41.7% | about 201.0 ms | 41.7% | about 191.1 ms |

Success rates cover 12 scenarios per size, including expected failures for low texture, repeated texture, and out-of-range motion; failed results never contain a matrix. All three recover the small/medium translations and brightness-change case, while the static case returns identity only when `identityWhenStatic` is explicitly enabled. Sparse flow rejects low-confidence out-of-range candidates, and translation and feature matching reject ambiguous periodic peaks.

## Decision

The current result does not justify automatic BoT-SORT integration: 640×360 success is only 41.7% or lower for all three algorithms, feature matching is about 191.1 ms p95, sparse flow about 71.8 ms, and complex motion or ambiguous texture must remain explicit failures. Translation is faster but cannot represent scale, rotation, and general affine motion. The three algorithms therefore remain an independent experiment; BoT-SORT defaults, `latest`, and stable compatibility claims are unchanged.

Any future automatic integration needs a separate approved design, a larger synthetic matrix, legally sourced real frames, browser timings, and tracking-box error evidence.
