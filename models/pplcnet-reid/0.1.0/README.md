---
license: apache-2.0
library_name: onnx
tags: [onnx, re-identification, tracking, pplcnet, webgpu]
language: [zh, en]
---

# PPLCNet ReID FP32 · Web SDK 适配

[English](README.en.md)

这是 PaddleDetection 官方发布的人体 `deepsort_pplcnet.pdparams` 的 FP32 ONNX 转换，用于已有检测框中的人体外观特征提取。它不是检测器，不直接分配轨迹 ID，也不识别人的真实身份。对应 SDK 为 [web-sdk-PP-Tracking](https://github.com/chenmohan123/web-sdk-PP-Tracking)，转换者 chenmohan；非 Paddle 官方发行。

## 固定资产

| 字段 | 值 |
| --- | --- |
| 文件 | `pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx` |
| 格式 | FP32 ONNX，opset 17 |
| 大小 | 33,704,835 bytes |
| SHA-256 | `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4` |
| 输入 | `crops`，float32 `[1,3,192,64]` |
| 输出 | `save_infer_model/scale_0.tmp_0`，float32 `[1,512]` |

网络为 PPLCNetEmbedding（scale 2.5，1280 维 neck 输入、512 维输出）。推理状态共 146 个张量、8,419,792 个元素，包含 BN 状态；未将其冒称为全部可训练参数。checkpoint 附加的 `head.weight [512,1502]` 不在官方 Embedding forward 内，转换不使用该训练头。

## 来源、转换与许可依据

- 官方仓库固定提交：[b25522a0f4bde8c80603f3ba5e3472059972e3b5](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5)。[ReID README](https://github.com/PaddlePaddle/PaddleDetection/blob/b25522a0f4bde8c80603f3ba5e3472059972e3b5/configs/mot/deepsort/reid/README.md)明确列出 PPLCNet-2.5x 人体模型及权重。
- 原权重：[官方下载](https://paddledet.bj.bcebos.com/models/mot/deepsort/deepsort_pplcnet.pdparams)，36,769,814 bytes，SHA-256 `abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758`。
- 转换：Paddle 2.6.2 / Paddle2ONNX 1.3.1，固定batch1；仅去除注册依赖、导出原Embedding推理图，没有重新训练或量化。裁剪、标准化及 L2 不在 ONNX 内。
- 分发采用上述官方仓库整体 **Apache-2.0** 授权作为官方链接权重及转换产物的依据，保留原[LICENSE](LICENSE)与[NOTICE](NOTICE)，注明来源和修改。所读取材料没有权重专属许可/独立模型卡，未声称取得额外的checkpoint专属授权或下游用途保证。
- 官方文档披露由 PaddleClas 提供、Market1501（751训练身份）训练，具体训练过程待公布。训练头维度不能用于推断额外训练集合。本仓库不分发训练图像或数据，模型的Apache许可声明不替代数据集自身条件。

## Web SDK 预处理与输出

预处理版本 `rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`：调用者提供方向已处理的 sRGB、非预乘 RGBA8 与完整图内 xywh 人体框；左/上 floor、右/下 ceil；透明像素白底合成；正常朝向 RGB、half-pixel 双线性缩放到 64×192，float64 中间计算；ImageNet mean `[0.485,0.456,0.406]` / std `[0.229,0.224,0.225]`，最终 float32 NCHW。

输出按 float64 范数 L2 归一化并写回 float32（`l2-f32-v1`），得到512维单位向量。特征空间须同时绑定完整模型 SHA、预处理及 L2 版本。该 Web 适配与固定上游部署的转置 BGR 路径不同，不能与其向量混用，也不宣称复现未公开的训练预处理。

## 验证与限制

2026-09-21，本机 Windows 11 / i5-10400F / RTX5060Ti / Chromium153 / ORT Web1.27：WASM 与 WebGPU 各34组向量对 Paddle 参考通过；归一化最大绝对差约3.502e-7/4.396e-7。WebGPU禁CPU回退。源码与独立参考报告在SDK仓库的 `reports/2026-09-21-reid-module/`；不代表所有浏览器或手机兼容。

小样本、GT人体框的闭集检索不是完整跟踪精度；相似衣着、遮挡、低分辨率、光照与相机变化可能导致混淆。没有以本次分发宣称IDF1/MOTA提升或完整视频FPS。模型面向人体，不应把512维接口视为车辆或所有物体的通用ReID。文件解码由宿主处理，透明PNG经Canvas可能发生颜色变化，原始文件与解码RGBA并非逐字节等价。
