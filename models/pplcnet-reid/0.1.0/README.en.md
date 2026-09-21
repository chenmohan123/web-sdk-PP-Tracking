# PPLCNet ReID FP32 · Web SDK adaptation

[中文](README.md)

This is an FP32 ONNX conversion of PaddleDetection's officially linked human `deepsort_pplcnet.pdparams`. It extracts appearance features from supplied human detection boxes; it neither detects objects, assigns track IDs, nor identifies a person's real identity. Adapted by chenmohan for [web-sdk-PP-Tracking](https://github.com/chenmohan123/web-sdk-PP-Tracking); this is not an official Paddle release.

## Asset identity

File: `pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx`; FP32, opset17; 33,704,835 bytes; SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`.

Input: `crops`, float32 `[1,3,192,64]`. Output: `save_infer_model/scale_0.tmp_0`, float32 `[1,512]`. Architecture: PPLCNetEmbedding scale2.5, 1280-dimensional neck input, 512-dimensional output. Its 146 inference state tensors contain 8,419,792 elements including BN state, not a verified count of trainable parameters. The checkpoint's additional `head.weight [512,1502]` is outside the official embedding forward and is not exported.

## Provenance, conversion and license basis

- Fixed [PaddleDetection revision b25522a0f4bde8c80603f3ba5e3472059972e3b5](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5). The [ReID README](https://github.com/PaddlePaddle/PaddleDetection/blob/b25522a0f4bde8c80603f3ba5e3472059972e3b5/configs/mot/deepsort/reid/README.md) explicitly lists the human PPLCNet-2.5x checkpoint.
- [Official checkpoint](https://paddledet.bj.bcebos.com/models/mot/deepsort/deepsort_pplcnet.pdparams): 36,769,814 bytes; SHA-256 `abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758`.
- Paddle2.6.2 / Paddle2ONNX1.3.1, fixed batch1. Registration dependencies were removed to export the original embedding inference graph; no retraining or quantization. Cropping, normalization and output L2 are outside ONNX.
- Distribution adopts the official repository's overall **Apache-2.0** license as its basis for this officially linked checkpoint and conversion, retaining [LICENSE](LICENSE), [NOTICE](NOTICE), attribution and modification disclosure. The reviewed material does not include a separate checkpoint license/model card; no additional checkpoint-specific grant or downstream-use warranty is claimed.
- Official documentation credits PaddleClas and discloses training on Market1501 (751 training identities), with the detailed training process still to be published. Head dimensions do not establish additional datasets. No training images/data are distributed; the model's license declaration does not replace dataset terms.

## Web preprocessing and output

`rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`: the caller supplies upright sRGB, unpremultiplied RGBA8 and fully in-bounds human xywh boxes. Floor left/top, ceil right/bottom; composite alpha onto white; upright RGB, half-pixel bilinear resize to64×192 using float64 intermediate arithmetic; ImageNet mean `[0.485,0.456,0.406]` and std `[0.229,0.224,0.225]`; final float32 NCHW.

Normalize each output using a float64 L2 norm and store float32 (`l2-f32-v1`), producing a512-dimensional unit vector. Bind the complete model SHA, preprocessing ID and L2 version to the feature space. This Web adaptation differs from the pinned upstream deployment's transposed BGR path: vectors are not interchangeable, and undocumented training preprocessing is not claimed as reproduced.

## Validation and limits

2026-09-21, Windows11 / i5-10400F / RTX5060Ti / Chromium153 / ORT Web1.27: WASM and WebGPU each pass34 fixtures against Paddle; maximum normalized absolute errors approximately3.502e-7/4.396e-7. WebGPU CPU fallback is disabled. Independent references and reports are in SDK `reports/2026-09-21-reid-module/`. These results do not establish all-browser or phone compatibility.

Small closed-set retrieval with GT boxes is not complete tracking evaluation. Similar clothing, occlusion, low resolution, lighting and camera changes can confuse appearance matching. Distribution adds no claim of improved IDF1/MOTA or complete video FPS. This human model is not a general vehicle/object ReID model. The host decodes files; transparent PNG colors may change through Canvas, so original-file pixels and decoded RGBA are not guaranteed byte-identical.
