# Independent tracking algorithm

[中文](../zh-CN/algorithm.md)

This implementation uses the high/low confidence association idea from the
[ByteTrack paper](https://arxiv.org/abs/2110.06864). The Kalman filter, assignment
solver and lifecycle were independently written from mathematical definitions;
no old Kalman/SORT source was read or translated. This is not an official port.
The root entry has no model runtime. BoT-SORT explicitly consumes external motion matrices; see the [motion API](botsort-candidate.md). DeepSORT
only consumes caller-provided vectors; vector quality, identity through crossings or
turns, and real-sequence MOT accuracy are not established.

## Mathematical definition

State: `x=[cx,cy,w,h,vx,vy,vw,vh]^T`, pixels and pixels/second. Initialize from the
box center and size, with zero velocity and
`P0=diag(100,100,100,100,10000,10000,10000,10000)`.
`dt=(current timestampMs-last successful timestampMs)/1000`, zero for the first frame.
With four-dimensional identity I, `F=[[I,dt*I],[0,I]]`, `H=[I,0]`,
`G=[dt²/2*I;dt*I]`, `Q=25*G*G^T`, `R=4*I`. These fixed noise choices are ours;
they do not scale with box size or reproduce an upstream implementation.

Prediction: `x'=F*x`, `P'=F*P*F^T+Q`. Correction:
`S=H*P'*H^T+R`, `K=P'*H^T*S^-1`, `x=x'+K*(z-H*x')`.
Joseph covariance: `A=I8-K*H`, `P=A*P'*A^T+K*R*K^T`.
The 4x4 inverse uses elimination with pivot exchange. Covariance is symmetrized.
Width/height are projected to at least `1e-6` pixels after prediction/correction;
this geometric constraint does not preserve an exact Gaussian interpretation.
Predicted boxes can leave the image and are not clipped. Inputs must be inside it.
Non-finite arithmetic, a singular innovation covariance or negative variance
raises NUMERICAL_FAILURE without committing any update state.

## Association and lifecycle

Among threshold-valid edges, maximize cardinality, then minimize summed `1-IoU`.
Input track/detection order deterministically resolves equal costs. Rectangular
Hungarian assignment adds n dummy columns with unmatched cost `n+1`; forbidden
edges cost `(n+1)^3`. Detections may remain unmatched. Classes never cross-match.
Threshold equality is valid. IoU computes overlap from relative displacement,
then normalizes areas by the maximum side length on each axis to avoid absolute
coordinate cancellation and area overflow.
Stages: tracked/lost with high scores; remaining tracked with low scores;
tentative with remaining high scores. High means `score>=high`; low means
`low<=score<high`; new tracks require `score>=new` among remaining high detections.
Defaults: low/high/new=0.1/0.5/0.6, IoU thresholds=0.3/0.2, minHits=2.

Tentative tracks become tracked after minHits consecutive observations and are
removed on their first miss. Tracked misses become lost. Lost tracks recover only
from high scores. hits counts total observations, starting at 1. Before matching,
lost tracks with `current time-lastSeenMs>maxLostMs` are removed (default 1000ms;
equality remains eligible). Frame gaps strictly greater than largeGapMs (2000ms)
remove every old track before new observations are processed. Timeout/gap removals
return the last committed motion state; missed tentative removals return the
current prediction. Removed events occur once, with observed=false and score=null.

maxDetections defaults to 100, maxTracks to 200, both capped at 500. Excess input
rejects the whole frame. Full capacity skips births and increments droppedDetections;
it never evicts existing tracks. Low-score filtering is not counted as dropping.

## Transactions, API and timing

`createTracker(options?)` returns synchronous `update(frame,{signal}?)`, `reset()`,
`dispose()`. Inputs and returned data share no mutable references with state.
Validation, prediction, association, correction and output complete before commit.
Timestamps are finite, non-negative and strictly increasing; seek/size changes need
reset. Generation starts at 0; reset increments it, clears time/state and restarts
IDs at 1. IDs are private to an instance and never reused within a generation.
dispose is idempotent; later update/reset raises DISPOSED. Cancellation is checked
only before synchronous computation and raises ABORTED. Other stable codes:
INVALID_OPTIONS, INVALID_INPUT, NUMERICAL_FAILURE, ID_EXHAUSTED. Unknown option keys
are rejected; explicit undefined values are invalid rather than defaults.

The RC runtime is CPU/main, version `web-sdk-pp-tracking@0.2.0-rc.0`; this does not rewrite historical published 0.1.0 evidence. Measured milliseconds:
validationMs covers entry through validation; predictionMs includes cloning,
pre-removal and prediction; associationMs includes grouping and all three stages;
updateMs includes corrections, births and track snapshots; totalMs independently
measures entry through result construction, not a sum. Empty stages still incur
scheduling overhead. Cold means first frame on a new instance, warm means reuse;
reset clears the motion state.

## Reference and limitations

`scripts/generate-math-reference.py` independently uses NumPy matrix formulas and
`solve` for the gain, unlike production elimination. dt values 0.1, 0.2, 0.05 and
1.5 seconds cover prediction and successive corrections. Elementwise mean and
covariance errors are below 5e-9; tests also check 500 repeated updates. Evidence
is mathematical and synthetic only. A separate fixed MOT17 FRCNN training-sequence evaluation repeats ByteTrack and OC-SORT on the same 5316 detection frames; the [candidate comparison](../../reports/2026-09-19-ocsort/README.en.md) records metrics, input/output hashes, pinned TrackEval identity and limits. It is not a licensed end-to-end real-video evaluation, a test-set leaderboard result or an official algorithm reproduction.

## OC-SORT (RC)

Use `createTracker({algorithm: 'ocsort'})` to select the box-input OC-SORT
design; omitting `algorithm` keeps the existing ByteTrack-style strategy. The
result reports the selected strategy in `algorithm`. OC-SORT uses high-score
association only: explicit `lowScoreThreshold` or `lowMatchIouThreshold` is
rejected with `INVALID_OPTIONS`. The shared high-score, new-track, IoU,
lifecycle and capacity options remain available.

The fixed source is Jinkun Cao, Jiangmiao Pang, Xinshuo Weng, Rawal Khirodkar
and Kris Kitani, [Observation-Centric SORT: Rethinking SORT for Robust
Multi-Object Tracking](https://arxiv.org/abs/2203.14360), arXiv
`2203.14360v3`, updated 2023-03-16 and accepted at CVPR 2023. Its abstract
describes virtual observation trajectories during occlusion to correct filter
error; sections 4.1-4.2 and the appendix pseudocode define ORU, OCM and OCR.
This SDK did not read or translate old SORT, DeepSORT, Paddle or OC-SORT
Kalman/tracker implementations. It is an independent implementation, not an
official port or value-for-value reproduction.

### OCM, OCR and ORU

For a track `i` and detection `j`, the class must match and the raw
`IoU(i,j) >= tau` gate is checked first. Direction scoring cannot bypass that
gate. The paper's direction consistency is represented as:

`score(i,j) = IoU(i,j) - lambda * DeltaTheta(i,j) / pi`

`DeltaTheta` is the minimum angular difference in radians between the historical
observation direction and the current intention direction. Directions use
`atan2(DeltaY, DeltaX)` between real observation centers; zero displacement has
zero penalty. The defaults are `ocmWeight=lambda=0.2` and
`ocmDeltaMs=300` milliseconds. The direction pair prefers two real observations
at least that far apart. Real observation history is bounded by
`ocmHistoryLength=30` (range 2-120). These are SDK milliseconds, unlike the
paper's fixed frame interval.

After the first high-score association, OCR performs a second IoU association
between unmatched tracks and remaining high-score detections. It uses each
track's last real observation and still applies the class and
`matchIouThreshold` hard gates. This handles a short stop or return from
occlusion.

When a lost track is reactivated by either association, ORU restores the filter
snapshot saved after its last real observation. It replays only the actual
timestamps of missing updates, applying prediction and correction at each
linearly interpolated virtual box:

`z~(t) = z_last + (t - t_last) / (t_now - t_last) * (z_now - z_last)`

Virtual boxes do not increment `hits`, enter real observation history or update
`score`; the current real observation is corrected once and increments the real
hit once. Replay is bounded by `oruMaxReplaySteps=30` (range 1-60). A track that
exceeds the bound ends in that transaction, preventing unbounded history or
loops. A failed or pre-cancelled update commits none of the clock, IDs, filter,
observation history or missing timestamps.

OC-SORT reuses this project's independent eight-dimensional `cx/cy/w/h`
constant-velocity filter, second-based `dt`, class isolation and lifecycle. The
paper uses a seven-dimensional state and frame intervals, so this implementation
documents mechanism correspondence without claiming official value compatibility
or MOT metrics. CPU/main, reset, dispose, instance isolation and synchronous
cancellation semantics match the original strategy.

## DeepSORT (external vectors, RC)

`createTracker({algorithm:'deepsort',featureSpace})` independently implements concepts from the [Deep SORT paper](https://arxiv.org/abs/1703.07402). The tracking root loads no model and generates no embeddings; the optional [ReID subpath](reid-candidate.md) extracts human-box features. Callers provide a matching feature-space ID on every frame and a compatible vector on every detection. Vectors are scale-normalized to avoid norm overflow and copied. Missing, wrong-dimensional, non-finite or zero-norm vectors reject the whole frame with `INVALID_INPUT` and commit no state. Each track stores the newest `gallerySize` vectors; detection-to-track distance is the minimum cosine distance to any gallery sample.

Confirmed tracks are grouped by `lastSeenMs` from newest to oldest for cascade matching. An edge requires the same class, minimum cosine distance no greater than `maxCosineDistance`, and four-dimensional squared Mahalanobis distance no greater than `9.487729036781154`. Observation covariance is the predicted positional covariance plus `4I`. Each group uses the same deterministic maximum-cardinality, minimum-cost assignment.

After appearance matching, only tentative tracks and unmatched tracks that entered the frame as tracked can use class/IoU fallback. A track already lost cannot bypass the appearance threshold. Matches and births update the gallery; misses do not, and the oldest sample is removed at capacity. Scalar gallery capacity is bounded by `maxTracks * gallerySize * dimension <= 4_000_000`; reset, dispose and track removal release state.

Explicit differences from the paper implementation are the eight-dimensional `cx/cy/w/h` state instead of aspect-ratio/height, millisecond `lastSeenMs` groups instead of fixed frame ages, and this document's Kalman noise, thresholds and lifecycle. This is mechanism correspondence, not an official value-for-value reproduction. Current evidence uses original synthetic vectors plus contract/browser verification. Historical MOT17 reports contain no external appearance embeddings and provide no real-data DeepSORT accuracy evidence.
