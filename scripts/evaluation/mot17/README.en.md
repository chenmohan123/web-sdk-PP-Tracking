# Reproducing the MOT17 real detection evaluation

[中文](README.md)

This offline evaluation tool is excluded from the npm package and ordinary CI tests. It downloads no images or videos. `lock.json` pins the dataset, scorer commit, parameters and dependencies. All seven FRCNN training sequences are evaluated, totaling 5316 frames; no subset is selected based on results. Original detections, GT, per-track outputs and third-party source remain in ignored `.tmp`. See the [dated report](../../../reports/2026-09-19-mot17/README.en.md) for permitted-use evidence, citations and licensing boundaries.

Install the repository's locked JavaScript dependencies and build first. Use a Python 3.11 virtual environment. The pinned upstream scorer still uses old NumPy aliases, so NumPy 1.23.5 and SciPy 1.10.1 are fixed; neither upstream source nor NumPy behavior is patched. The CLI automatically fetches the MIT TrackEval source at the pinned SHA into `.tmp`, or accepts an existing clean checkout.

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
python -m venv .tmp/mot17-venv
.tmp/mot17-venv/Scripts/python.exe -m pip install -r scripts/evaluation/mot17/requirements.txt
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
node scripts/evaluation/mot17/run.mjs --python .tmp/mot17-venv/Scripts/python.exe --download-data
```

On Linux, use `.tmp/mot17-venv/bin/python`. Set `PLAYWRIGHT_BROWSERS_PATH` if a matching browser is already installed. To reuse data, replace `--download-data` with `--zip .tmp/real-sequence-research/MOT17Labels.zip`; to reuse scorer source, add `--trackeval .tmp/real-sequence-research/TrackEval`. `--out` must name a new directory inside this repository's `.tmp`; omitting it generates a unique directory. Every write destination—downloaded ZIP, newly fetched scorer source, extracted data, logs and scoring results—must be new and inside this repository's `.tmp`. Existing parents and symlink/junction aliases are resolved before any network access, extraction, scoring or directory creation. Existing ZIP files and scorer checkouts are read-only inputs and may reside elsewhere; Python bytecode caches are disabled. `--skip-browser` is for diagnosis without a browser and explicitly records that the browser check was not run; it is not full release verification.

The run verifies archive integrity and extracts a fixed allowlist, executes default and `lowScoreThreshold=highScoreThreshold` configurations, repeats every complete sequence from a fresh instance, invokes official scoring, then compares a complete Chromium sequence 02 with Node. Outputs include `summary.json`, input hashes, metrics and logs. Raw MOT outputs, non-timing SDK JSONL and per-frame timings remain in the new run directory. The shared `output-path.mjs` protection and Python checks reject report archives, path aliases escaping `.tmp`, and existing targets. Failed runs are never overwritten.

MOT frame numbers are one-based: timestampMs=`frame*1000/fps`. Pixel origins are converted to zero-based coordinates, boxes are clipped to the image's half-open bounds, empty intersections are dropped, and low scores are retained. Boundary subtraction that rounds outward is adjusted inward by one image-scale machine epsilon and counted separately. Empty frames remain present. Unordered rows are grouped by frame while preserving order within a frame. Malformed rows, missing fields, nonfinite values and out-of-range frame numbers fail instead of being silently truncated. Only the Python scorer reads GT; it is never used to select SDK inputs or parameters.

Only `observed && state === 'tracked'` is exported to MOT. Pixel origins are restored to one-based values without additional output clipping or smoothing. The scorer calls official MotChallenge2DBox `get_raw_seq_data` / `get_preprocessed_seq_data` with `DO_PREPROC=true` and pedestrian, then Identity/CLEAR at IoU=0.5. Official `combine_sequences` computes aggregate metrics, rather than averaging percentages. Only required official modules are imported to avoid unrelated datasets and plotting extensions; hashes of loaded source files and LICENSE are recorded.

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test tests/mot17-adapter.test.ts tests/mot17-cli.test.ts
$env:TRACKEVAL_PATH=(Resolve-Path '.tmp/real-sequence-research/TrackEval').Path
.tmp/mot17-venv/Scripts/python.exe -B scripts/evaluation/mot17/test_scoring.py
```

The original Python fixtures check hand-computed results: four perfect frames give IDF1/MOTA=1; a mid-sequence identity change gives IDF1=0.5, IDSW=1 and MOTA=0.75; missing the last two frames gives IDF1=2/3, FN=2 and MOTA=0.5; a matched distractor adds no FP. Tests also cover wrong archive hashes and write boundaries. Ordinary JavaScript tests require no real data, Python or network access.

The standalone Python entry points enforce the same write rules. For `prepare`, `--output` must be a new directory and its parent's `input-hashes.json` must not exist. With `--download`, `--archive` is also a new write destination; otherwise it is an existing read-only ZIP. For `score`, `--run` must refer to existing inputs/tracker results in `.tmp`, and `metrics.json` must not exist. An already scored run cannot be overwritten.

```powershell
.tmp/mot17-venv/Scripts/python.exe -B scripts/evaluation/mot17/evaluator.py prepare --archive .tmp/real-sequence-research/MOT17Labels.zip --output .tmp/new-extraction/input
.tmp/mot17-venv/Scripts/python.exe -B scripts/evaluation/mot17/evaluator.py score --trackeval .tmp/real-sequence-research/TrackEval --run .tmp/an-unscored-run
```
