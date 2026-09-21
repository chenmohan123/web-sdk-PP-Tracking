# PPLCNet ReID FP32 本地评测

[English](README.en.md)

日期：2026-09-19。分层：单 SDK 的一次性研究。**PPLCNet ReID FP32 已完成转换，Python、浏览器 WASM 和 WebGPU 的 32 组数值对齐全部通过；可继续作为同包可选 ReID 模块的候选。** 本轮还发现上游部署裁剪的轴顺序影响检索结果，因此尚未把模型接入产品或标为稳定。

当前 SDK 仍为本地 `0.2.0-alpha.0`，包含 ByteTrack、OC-SORT、DeepSORT 外部向量三种策略；线上仍为 `0.1.0`。本轮只增加研究脚本、证据与文档，没有发布权重、npm、Demo 或新 API。探针代码不能直接作为生产 runtime；浏览器模型能力不等于当前 SDK 已提供 GPU 跟踪。

## 模型、来源和许可依据

固定上游为 [PaddleDetection b25522a](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5)，不是 Intel OMZ 模型。该提交的根 LICENSE、`pplcnet_embedding.py` 和本次读取的预处理文件头均为 Apache-2.0。未读取、复制或导入上游 tracker、matching、Kalman 实现。源文件不可变身份见 [sources.lock.json](sources.lock.json)。

| 资产 | 字节数 | SHA-256 |
| --- | ---: | --- |
| 官方 PPLCNet ReID checkpoint | 36,769,814 | `abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758` |
| 本地 FP32 ONNX，opset 17 | 33,704,835（32.14 MiB） | `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4` |

README 地址 `models/mot/deepsort/deepsort_pplcnet.pdparams` 与配置地址 `models/mot/deepsort_pplcnet.pdparams` 的实际文件完全相同。复现脚本固定本次 checkpoint 的大小和哈希，不会静默接受远端换权重。

直接使用原 Apache 模型结构，仅移除 `ppdet` 注册依赖，避免加载整个仓库。`PPLCNetEmbedding(scale=2.5, input_ch=1280, output_ch=512)` 的 146 个推理状态张量全部匹配并加载，没有随机补缺。checkpoint 多出训练分类头 `head.weight [512,1502]`，该头不属于官方 Embedding 的 forward，导出时不使用；不能据此反推训练数据。README 记载 Market1501 751 类、训练细节待 PaddleClas 公布。

**许可核验的范围：**已核实代码许可、官方权重链接及内容身份；本轮读取文件未包含 checkpoint 的独立模型卡、完整训练数据条款。代码根许可不能自动补齐这些材料，也不能据此断言权重禁止商用。后续分发要补齐模型卡中的来源、适用许可依据、转换差异和训练信息边界。当前未上传 ModelScope/Hugging Face。

## 预处理差异

输入为单目标 FP32 NCHW `[1,3,192,64]`；输出 `[1,512]`，未在图内 L2 归一化。本轮输出范数约 3.24–5.83。余弦检索与 DeepSORT 关联须归一化，不能直接把点积当余弦。

固定上游部署路径从 RGB 原图取框，`get_crops` 先把 HWC 转为 WHC，按 x/y 裁剪后没有转回；`preprocess_reid` 再 resize 至宽 64、高 192，反转通道、除以 255，使用均值 `[0.485,0.456,0.406]`、标准差 `[0.229,0.224,0.225]`。因此该路径实际是**转置的人体裁剪 + BGR**。本轮只提取并执行这两个预处理函数，以非方形、非对称输入逐值确认；没有把整个上游跟踪程序当参考。

对照包括正常 RGB、正常 BGR、转置 RGB、上游转置 BGR，均使用 OpenCV 4.11 `INTER_LINEAR`。MOT 的 1 起点坐标转换为 0 起点、右/下边界不包含的裁剪。数值验证送入各引擎的是完全相同、哈希固定的 FP32 张量；**尚未验证浏览器 Canvas resize 与 OpenCV 的逐像素一致性**。

正常 RGB 在本次样本上较好，可作为下一阶段明确命名的预处理候选。这不证明它就是未公开的训练预处理。模型 SHA、轴/通道顺序、resize/标准化和输出定义必须一起固定为特征空间身份，不同路径的 512 维向量不可混用。

## 数值与浏览器

[协议](protocol.md)在运行前固定：有限、非零输出，逐样本最大绝对差 `< 1e-3` 且余弦距离 `< 1e-5`。参考为 Paddle 2.6.2 CPU FP32 eval；转换为 paddle2onnx 1.3.1 / ONNX 1.16.2。8 组边界/纹理输入包含黑、白、低对比、RGB 纯色、纹理及棋盘格，另有 24 个真实行人裁剪。

| 对比原始 Paddle | 通过 / 总数 | 最大绝对差 | 最大余弦距离 |
| --- | ---: | ---: | ---: |
| Python ORT 1.20.1 CPU | 32 / 32 | `1.54972e-6` | `2.99549e-12` |
| 浏览器 ORT Web 1.27.0 WASM | 32 / 32 | `2.35438e-6` | `3.40206e-12` |
| 浏览器 ORT Web 1.27.0 WebGPU | 32 / 32 | `2.44379e-6` | `4.53371e-12` |

环境：Windows 11 专业版 10.0.26200、Intel i5-10400F、RTX 5060 Ti、驱动 32.0.16.1692、Chromium 153.0.8010.12 headless/main。basic 图优化、WASM 单线程；从 ORT 实际使用的 GPUDevice 回读 NVIDIA/Blackwell 非软件适配器，显式禁止 CPU EP fallback。浏览器控制台无警告/错误。结果只覆盖本矩阵，不扩展到手机、其他浏览器、Worker、NPU 或批推理。

| 后端 | 单目标中位数 | 单目标 P95 | 8 目标串行中位数 | 16 目标串行中位数 |
| --- | ---: | ---: | ---: | ---: |
| WASM | 33.925 ms | 41.620 ms | 273.175 ms | 550.300 ms |
| WebGPU | 5.932 ms | 7.585 ms | 63.865 ms | 97.730 ms |

真实裁剪输入预先准备好；预热 5 次、单目标 30 次，多目标各 5 组。中位数用标准中位数，偶数取中间两值平均；P95 用最近秩。计时包含运行、输出回读、向量数组复制和输出释放，不含解码、裁剪、检测、关联或调度。WASM/WebGPU 会话创建约 772/819 ms，首次运行约 72/504 ms；本地 HTTP 取模型约 249/254 ms，不代表模型源下载。未清除驱动着色器缓存，首次运行不能视为全新设备冷启动。不能把这些数据称为完整视频实时帧率，或直接与旧 OMZ 探针不同口径作速度比。

表格采用补充 ORT 实际 GPUDevice 信息后的最终探针；最初仅记录能力探测适配器的两后端结果同样32/32通过，其原始记录保留在 `evidence/browser-initial.json.gz`。最终结果文件为 `browser-result.json.gz`，没有按最佳耗时挑选两轮数据。

## 真实行人小样本

来源为 MOTChallenge 官方 MOT17 ZIP，按 HTTP Range 只传输约 6.93 MB，获得 `MOT17-02-FRCNN`、`MOT17-04-FRCNN` 的帧 `[1,31,61,91,121,151]` 与 GT。图像和标注 SHA 见 [data.lock.json](data.lock.json)。只保留有效行人、可见度 ≥0.7、完整图内框、宽 ≥16、高 ≥48。每段帧 1 为图库，后续与图库同 ID 的裁剪为查询：共 120 个裁剪，25 个图库身份、95 个查询。评估使用真实 GT 身份，不是单照片的增强版本；未使用检测器。

| 预处理 | 第一名正确 | Rank-1 | 距离 0.2 下同 ID 被拒绝 / 95 | 不同 ID 被接纳 / 1274 |
| --- | ---: | ---: | ---: | ---: |
| 正常 RGB | 87 / 95 | 91.58% | 27 | 24 |
| 正常 BGR | 85 / 95 | 89.47% | 21 | 12 |
| 转置 RGB | 70 / 95 | 73.68% | 15 | 241 |
| 上游转置 BGR | 75 / 95 | 78.95% | 19 | 104 |

正常 RGB 的同 ID / 不同 ID 余弦距离中位数为 0.1388 / 0.5079；两序列分别正确 30/31、57/64。它虽在 Rank-1 上领先，却没有在拒真/认假上同时优于正常 BGR。不能仅凭这 95 个相关查询确定最终通道顺序或阈值，更不能声称泛化到跨摄像头、完整 MOT17 或真实视频 IDF1/MOTA 提升。距离 0.2 只是预先固定的单向量诊断，SDK 的运动门控和多向量图库会产生不同结果。

2026-09-19 的 MOT17 页面已改为静态归档，主页返回 410；数据下载仍可用。本轮未取得完整许可页面，不将原图、完整 GT 或图片示例纳入分发。页面状态、哈希及核验限制见 [source-review.json](evidence/source-review.json)。

## 复现和后续

原始 Paddle/ORT/浏览器向量、逐样本误差、480 个质量向量、查询结果、逐次耗时和环境在 `evidence/`；`summary.json` 是便于查看的摘要。`verify_archive.py` 独立复算误差、检索、阈值诊断和性能统计，不重新调用推理实现。模型、原图、完整 GT 和准备好的输入张量仅在 `.tmp/pplcnet-reid/`，未提交。`requirements.txt` 固定本次 Python 直接依赖版本，不是跨平台 wheel/传递依赖锁。

在 SDK 根目录，用 Python 3.11 环境依次执行（`<python>` 替换为该环境的解释器）：

```powershell
<python> reports/2026-09-19-pplcnet-reid/probe/fetch.py --work .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/probe/data.py --work .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/probe/export.py --work .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/probe/evaluate.py --work .tmp/pplcnet-reproduction
node reports/2026-09-19-pplcnet-reid/probe/browser.mjs .tmp/pplcnet-reproduction
<python> reports/2026-09-19-pplcnet-reid/verify_archive.py
```

浏览器探针依赖仓库 Playwright，`TRACKING_REID_ORT_DIST` 可指定 ORT Web 1.27.0 的 dist 目录。离线归档校验使用已提交证据；重跑推理的输出先留在新的临时目录，核对来源/数据哈希与原报告，不覆盖历史结果。

下一阶段先冻结正常朝向的裁剪/颜色/插值契约，用独立样本确认通道与门槛并验证浏览器图像预处理，再完成模型分发说明。接入同包可选特征提取模块前，演进算法/模型混合标准，保留按需加载、特征空间身份、明确后端与取消/释放语义。之后才使用相同真实检测输入比较三种策略的 ID 指标和完整耗时。模型源仍计划 ModelScope 默认、Hugging Face 可选；视频/摄像头、BoT-SORT、JDE、FairMOT、CenterTrack 和门户 Workflow 未在本轮实现。

## 本地交付验证

归档哈希及原始向量、检索、耗时复算通过。SDK 完整 `verify` 退出0：104/104单测、类型检查、核心/Demo/Vanilla/React构建、三算法真实npm包消费与12组浏览器交互通过；运行时及22,522字节tarball哈希与阶段开始相同。标准before/after各17项required通过、0失败，仅代表 locally-compliant。门户99/99测试、Astro检查和21页构建通过，保留7条既有hints、0errors/0warnings。证据见 [validation.json](evidence/validation.json)、[SDK日志](evidence/sdk-verify.log)及[浏览器回执](evidence/sdk-browser.json)；390px布局检查不是手机实机测试。
