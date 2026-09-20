# PPLCNet ReID FP32 model card draft

[简体中文](model-card.md)

Date: 2026-09-20. Status: local candidate, not a stable product or distributed model. This card records verified provenance and adaptation choices without inventing undisclosed upstream details.

## Identity and purpose

- Upstream: [PaddleDetection](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5), pinned revision `b25522a0f4bde8c80603f3ba5e3472059972e3b5`.
- Person ReID network: `PPLCNetEmbedding`, PPLCNet scale 2.5, 1280-channel neck input and 512-dimensional output. It extracts appearance from one person crop; it does not detect boxes, decode video, assign IDs or track objects.
- Official checkpoint: [README URL](https://paddledet.bj.bcebos.com/models/mot/deepsort/deepsort_pplcnet.pdparams) and [config URL](https://paddledet.bj.bcebos.com/models/mot/deepsort_pplcnet.pdparams) returned identical bytes on 2026-09-19; 36,769,814 bytes, SHA-256 `abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758`.
- Local conversion: FP32 ONNX opset17, 33,704,835 bytes, SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`. Input `crops: float32[1,3,192,64]`, output `save_infer_model/scale_0.tmp_0: float32[1,512]`.
- All 146 inference state tensors load, containing 8,419,792 elements including BN state, not all necessarily trainable parameters. The checkpoint's extra training classifier `head.weight [512,1502]` is unused because it is absent from the original Embedding forward.

## Conversion and image contract

Paddle2ONNX1.3.1 exports the original Paddle2.6.2 FP32 network. Only model registration dependencies are removed; inference weights are unchanged. The ONNX graph does not crop images, normalize pixels or L2-normalize embeddings.

The next-module preprocessing candidate is `rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`: decoded, orientation-corrected sRGB unpremultiplied RGBA8; each dimension <=8192 and at most 16,777,216 pixels. Zero-based xywh boxes are intersected with the image, then left/top are floored and right/bottom ceiled, with exclusive right/bottom edges. Empty intersections are rejected. Upright 64x192 output uses white alpha compositing, float64 half-pixel bilinear interpolation clamped inside the crop, ImageNet mean/std, then one final FP32 conversion. See the [pre-run protocol](protocol.md), `probe/preprocess.mjs` and the independent Python oracle `probe/reference.py`.

This is an explicitly named project adaptation, distinct from the pinned upstream deployment's transposed BGR path. It does not claim to recover undisclosed training preprocessing or exactly reproduce OpenCV integer interpolation. Output requires explicit L2 normalization. The future feature-space ID binds the ONNX hash, preprocessing version and `l2-f32-v1` output rule, not merely “512 dimensions”.

## Training disclosure and license evidence

The pinned official ReID README says the model was provided by PaddleClas and trained on Market1501, 751 classes, with training details pending publication by PaddleClas. The 1502-wide training head alone does not establish training data, identity augmentation or procedure. The Market1501 author page describes 1501 identities, 32,668 boxes and six cameras and requests citation for research use; this is not checkpoint redistribution permission.

The root README license section states `PaddlePaddle is provided under the Apache 2.0 license`. The pinned root LICENSE and model/preprocessing headers state Apache-2.0. These are verified official code-license sources. [Source records](sources.lock.json) retain actual URLs, date, bytes, hashes and the 404 response. No checkpoint-specific model card or license declaration was found in the inspected material. A 404 for one directory README does not prove that no declaration exists elsewhere.

Accordingly, code Apache-2.0 is verified; checkpoint-specific terms and complete training-data conditions are not independently verified. This does not assert a ban on commercial use, nor justify inventing a weight-specific SPDX declaration. If a later release relies on the upstream repository's overall grant, its model card must state that basis and scope, preserve license and attribution, and identify original and converted assets. This card is not evidence of separately obtained permission.

## Measurements and limits

- 2026-09-19: against original Paddle, Python ORT/browser WASM/WebGPU each passed 32/32 inputs: eight edge/texture tensors and 24 real crops.
- 2026-09-20: deterministic preprocessing on 34 inputs (eight artificial edge cases and 26 real crops) produced identical Python/Node/Chromium tensors. Both browser backends passed 34/34 embedding comparisons at maxAbs<1e-3 and cosineDistance<1e-5. All 33 opaque PNGs decoded identically; five JPEGs also matched in this specific decoder/browser matrix.
- Transparent PNG counterexample: Canvas premultiplication round trips can discard hidden colors and quantize partially transparent RGB. A separate four-pixel diagnostic changed 7/16 bytes, with maximum difference 247. Transparent PNG byte equivalence failed. Passing raw RGBA white compositing does not establish original-file decode equivalence; see the protocol's post-run deviation record.
- Previous sequences 02/04 with upright OpenCV RGB scored 87/95. New, previously unused sequences 05/09/10/11/13 scored 53/67 (79.10%) using deterministic RGB, versus 52/67 OpenCV RGB and 50/67 deterministic BGR. Each sequence uses first-frame galleries and later same-ID queries. This is a small, closed-set, same-camera sample with GT boxes, not full MOT17, cross-camera or tracking ID metrics.
- Distance thresholds still need testing with real detections and temporal tracking. The 0.2 threshold was not tuned here. Similar clothing, occlusion, lighting, low resolution and camera motion can reduce discriminability.
- Matrix: Windows11/i5-10400F/RTX5060Ti/Chromium153.0.8010.12/ORT Web1.27.0; single-thread WASM and actual hardware WebGPU without CPU EP fallback. Phones, Safari/Firefox, Workers, NPU, dynamic batches, cameras and full video were not tested.

## Distribution and product status

Weights and original images remain in ignored local directories. Nothing has been uploaded to ModelScope or Hugging Face, so neither has a revision or download URL. ModelScope remains the planned default and Hugging Face optional. After upload, actual immutable revisions, bytes, SHA-256, CORS and browser downloads must be verified; nonexistent addresses must not be prefilled.

The local Tracking SDK is still `0.2.0-alpha.0` with three CPU/main tracking strategies; production remains `0.1.0`. Research does not mean the SDK or Demo includes a model loader. A same-package model entry requires the hybrid declaration and checker standard to be implemented first. This card and its evidence are local review materials, not a release announcement.
