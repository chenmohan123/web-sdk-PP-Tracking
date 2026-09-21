# Three-algorithm evaluation with real frames

[中文](README.md). This local evidence tool does not predetermine quality conclusions or modify production algorithms, models, or defaults. It follows the portal timing contract and does not consume upstream tracker implementations.

## Pinned inputs

Use the seven complete MOT17 FRCNN training sequences (5316 frames), official TrackEval commit and Python dependencies in `../mot17/lock.json`. Sequence metadata and public detections are checked against committed `reports/2026-09-19-mot17/summary.json` input hashes. Only the separate scorer reads and verifies GT.

`--images` is the data directory containing `<sequence>/img1/000001.jpg`. Its parent must contain `media.lock.json`, byte-identical to committed `reports/2026-09-21-mot-reid/media.lock.json`: official ZIP URL, ETag, archive size and 5316 entries with `path`, `zipMember`, `zipCrc32`, `bytes`, and `sha256`. Each image read verifies bytes, SHA256 and CRC32; decoded dimensions must match metadata. `--model` is the registered FP32 ONNX body (33704835 bytes and the pinned SHA256).

The browser uses actual `dist/reid/index.js`, local modelBytes, explicit WebGPU and maxDetections=64, with local ORT 1.27.0 assets. Remote resource requests and software fallback are prohibited. All detection rows remain ordered, including empty frames and timestamps. Extraction uses chunks of at most 64; tracking receives one complete frame only after all chunks succeed. ByteTrack uses the old lock defaults; OC-SORT and DeepSORT receive the same common parameters. DeepSORT retains maxCosineDistance=.2 and gallerySize=30.

## Running

Install dependencies and build with the repository flags:

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
$python = '<Python 3.11 with numpy 1.23.5 and scipy 1.10.1>'
$trackeval = '<clean TrackEval checkout at 12c8791b303e0a0b50f753af204249e622d0281a>'
$labels = '.tmp/mot17-ocsort-c036be8/input'
$images = '.tmp/mot17-reid-media/data'
$model = '.tmp/reid-distribution/upload/pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx'
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --out .tmp/mot17-reid-all-new
```

The default runs all seven sequences and calls the original evaluator.score API. For shorter independent jobs, add `--sequence MOT17-02-FRCNN` and use a fresh output directory per sequence. Repeat for 04, 05, 09, 10, 11 and 13, preserving identical scripts, source, dist, model and media lock, then merge:

```powershell
node scripts/evaluation/mot17-reid/merge.mjs --run .tmp/mot17-reid-02-new --run .tmp/mot17-reid-04-new --run .tmp/mot17-reid-05-new --run .tmp/mot17-reid-09-new --run .tmp/mot17-reid-10-new --run .tmp/mot17-reid-11-new --run .tmp/mot17-reid-13-new --input $labels --python $python --trackeval $trackeval --out .tmp/mot17-reid-combined-new
```

Existing directories, outputs outside this repository's .tmp, junction escapes and unknown modes are rejected. There is no in-place resume. Failed directories retain failure.json and completed frames; rerun in a fresh directory. Merge requires complete non-overlapping coverage and matching identities, rechecks raw features and both Node/browser outputs, then uses official combine_sequences rather than averaging percentages.

The fixed GPU/WASM supplement is limited to the first 30 frames of MOT17-02-FRCNN and cannot be scored or merged into the full run:

```powershell
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --sequence MOT17-02-FRCNN --limit 30 --backend webgpu --out .tmp/mot17-reid-gpu30-new
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --sequence MOT17-02-FRCNN --limit 30 --backend wasm --out .tmp/mot17-reid-wasm30-new
node scripts/evaluation/mot17-reid/compare.mjs --gpu .tmp/mot17-reid-gpu30-new --wasm .tmp/mot17-reid-wasm30-new --out .tmp/mot17-reid-compare30-new
```

The comparison records feature maxAbs, maximum/mean cosine distance and each algorithm's MOT/non-timing equality. It does not force equality by tuning thresholds or claim full-dataset CPU inference coverage.

## Evidence and timing

Features stream to per-sequence JSONL with frame number, input hash and fixed feature space. Two fresh Node tracker sets replay one feature frame at a time. Browser MOT/non-timing JSONL must match both Node runs byte for byte; capacity drops must be zero. identity.json records script, source, build, model, media and label identities. summary.json, per-frame timing and metrics.json preserve costs and scoring evidence. Merged results reference original run directories, which must be retained.

Each sequence gets a fresh model session and trackers: first frame cold, later frames warm. Local model fetching and outer load time are recorded separately and do not represent remote download timing. DeepSORT outer timing independently spans local image fetch, decode, all ReID chunks and one update. ByteTrack/OC-SORT then run separately; they neither read images nor execute models. Image fetch includes server disk reads and integrity checks. Real per-chunk SDK stages are retained. No outer total is constructed by adding stages. Node measures association on frozen features, not video end-to-end latency.

Playwright IPC, evidence writes, detection, rendering and scoring are excluded from pipeline outer timing. benchmarkFrameTotalMs covers the three-algorithm serial experiment and is not the DeepSORT pipeline time. Results are dated observations on this training set and device, not leaderboard results, official algorithm reproduction or cross-device compatibility. Original images, full GT, detections and features are not distributed.
