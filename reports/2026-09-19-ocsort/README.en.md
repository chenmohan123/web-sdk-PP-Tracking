# Same-input ByteTrack and OC-SORT evaluation

[中文](README.md) · [Public machine summary](evaluation-summary.json) · [Delivery status (Chinese)](交付状态.md)

Date: 2026-09-19. Candidate: local `web-sdk-pp-tracking@0.2.0-alpha.0`. Decision: keep ByteTrack as the default strategy. OC-SORT reduced identity switches on these fixed training sequences, but did not provide an overall accuracy or timing improvement.

## Results

| Algorithm | IDF1 | IDSW | MOTA | FP | FN | Node SDK totalMs | Driver wall time | CPU | Max active tracks | Capacity drops |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ByteTrack | 48.2922% | 1101 | 44.4010% | 4169 | 57166 | 8566.916 ms | 8925.181 ms | 9580 ms | 52 | 0 |
| OC-SORT | 48.4107% | 881 | 39.5434% | 6751 | 60259 | 9268.917 ms | 9617.248 ms | 10033 ms | 47 | 0 |
| OC-SORT - ByteTrack | +0.1185 pp | -220 | -4.8577 pp | +2582 | +3093 | +8.19% | - | - | - | 0 |

OC-SORT reduced IDSW by 220 and slightly increased IDF1, while MOTA fell materially and both false positives and misses increased. MOT17-10-FRCNN and MOT17-13-FRCNN MOTA fell from 36.8253%/34.1694% to 19.6199%/18.5449%. Fewer identity switches therefore do not constitute an overall improvement, and no thresholds were tuned after observing the result.

Node timings cover only tracker `update` calls and the stated driver loop. They exclude images, detector inference, decoding, rendering, extraction and TrackEval scoring. This is one Windows/i5-10400F/Node 24.16.0 observation, not cross-device throughput or end-to-end video performance.

## Input, parameters and scorer identity

- Data: MOT17Labels.zip, 10107022 bytes, SHA-256 `0aa79322e91583369f42f17c4d79a0b145380d8732487bba59272048dc82b2b9`; all seven fixed FRCNN training sequences, 5316 frames, with no result-based subset selection.
- SDK: commit `c036be8a5775c879e9062ba41e5b114460c6b16e`, clean before execution; `dist/index.js` SHA-256 `7b5b1bfd715ea0541bc6dba7416589729bbe10af6ebdb280a95ab967ef20a7ea`. The runner read the package version and checked every frame's actual `runtimeVersion`.
- Scorer: TrackEval `12c8791b303e0a0b50f753af204249e622d0281a`, Identity/CLEAR, `DO_PREPROC=true`, pedestrian, IoU 0.5; Python 3.11.15, NumPy 1.23.5 and SciPy 1.10.1. Upstream source and formulas were unchanged; the run retained known upstream `np.float`/`np.int` deprecation warnings.
- Shared parameters: `highScoreThreshold=0.5`, `newTrackThreshold=0.6`, `minHits=2`, `matchIouThreshold=0.3`, `maxLostMs=1000`, `largeGapMs=2000`, `maxDetections=100`, `maxTracks=200`. ByteTrack additionally used its existing `lowScoreThreshold=0.1` and `lowMatchIouThreshold=0.2`; these invalid options were not passed to OC-SORT. Its private parameters remained at candidate defaults `ocmWeight=0.2`, `ocmDeltaMs=300`, `ocmHistoryLength=30`, `oruMaxReplaySteps=30`, with no result-driven tuning.

`evaluation-summary.json` records per-sequence IDF1/IDSW/MOTA/FP/FN, adapted-input hashes, both algorithms' MOT hashes, and script/browser identity. Original detections, GT, MOT output, per-frame JSONL and timings remain only under ignored `.tmp/mot17-ocsort-c036be8/` and are not committed.

## Determinism, historical continuity and browser

Each algorithm ran every complete sequence twice from fresh instances: 14 sequence/algorithm pairs. Non-timing JSON and MOT outputs matched byte for byte on repeats, with zero capacity drops. Candidate ByteTrack MOT files also matched the historical `default` outputs byte for byte, 7/7, and all TrackEval per-sequence and combined metrics matched. Historical raw JSONL is not expected to match because the candidate adds `algorithm` and a new `runtimeVersion`.

Chromium 153.0.8010.12 with Playwright 1.63.0 ran all 600 frames of MOT17-02-FRCNN separately for both algorithms on a dynamic local port. Each algorithm's non-timing JSON and MOT output matched its Node result; actual backend/mode was `cpu/main`. This is desktop numerical alignment, not evidence for mobile devices, other browsers, other CPUs or cross-device compatibility.

The raw `.tmp` `summary.json` SHA-256 is `cec4a61875ba68edb2103addf14da3a20fdbf94c5bdf3e1f524c9759219a32e3`; `metrics.json` is `f9f0f117f2851921a344c8a167b1e53555c6d705229f8b14f48b9b6dd506d5bf`; the historical summary is `a8aad88094132d28d9a17d9c75ec8e9ece3b792418deba7a0c0f333e9de1b52d`.

## Reproduction

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false run build
node scripts/evaluation/mot17/run.mjs --mode algorithms --python <python-3.11> --zip <MOT17Labels.zip> --trackeval <TrackEval-12c8791> --out <unique-new-directory-under-this-repository/.tmp>
```

Before any download, output creation or child process, the CLI rejects unknown modes and invalid/existing targets. Node passes selected `bytetrack/ocsort` configuration names explicitly to Python. These results are a local algorithm-setting comparison on fixed training sequences. They are not MOT17 test-set leaderboard scores, an official ByteTrack/OC-SORT reproduction, end-to-end real-video measurements or a release promise. The published npm package, hosted HTTPS Demo and production portal entry remain at 0.1.0.
