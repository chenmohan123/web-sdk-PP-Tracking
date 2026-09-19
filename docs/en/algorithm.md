# Independent tracking algorithm

[中文](../zh-CN/algorithm.md)

This implementation uses the high/low confidence association idea from the
[ByteTrack paper](https://arxiv.org/abs/2110.06864). The Kalman filter, assignment
solver and lifecycle were independently written from mathematical definitions;
no old Kalman/SORT source was read or translated. This is not an official port.
There is no model, ReID or camera-motion compensation, and no guarantee of identity
through crossings or turns. No real-sequence MOT accuracy is claimed.

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

Runtime is CPU/main, version `web-sdk-pp-tracking@0.1.0`. Measured milliseconds:
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
is mathematical and synthetic only; no licensed real-video evaluation is available.
