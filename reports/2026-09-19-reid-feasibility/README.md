# ReID / DeepSORT 可行性评估

[English](README.en.md)

日期：2026-09-19。分层：单 SDK 的本地可行性探针。结论是**继续在同一个 `web-sdk-pp-tracking` 中推进 DeepSORT 思路的独立实现，先接收外部外观向量；本轮 ReID 候选不进入稳定清单或发布**。

当前代码仍是 ByteTrack / OC-SORT 两策略的 `0.2.0-alpha.0` 本地候选，线上仍为 `0.1.0`。本轮没有增加算法选项、生产依赖、摄像头或视频功能。探针不属于 SDK API 或 Demo；保留脚本只为复现研究结果，不能直接作为产品运行时。

## 来源与候选

完整固定提交、下载 URL、文件长度和 SHA-256 见 [sources.lock.json](sources.lock.json)。只读取了来源说明、配置和许可，以及 Apache-2.0 转换器的 MVN 适配代码；没有读取或复制上游 DeepSORT / SORT / Paddle 跟踪与 Kalman 实现。

| 候选 | 已核对的事实 | 本轮判断 |
| --- | --- | --- |
| PaddleDetection PPLCNet ReID | `b25522a0f4bde8c80603f3ba5e3472059972e3b5`；根 Apache-2.0；DeepSORT README 明确在 Market1501 751 类上训练；配置 `input_size: [64, 192]`、`output_ch: 512` | 与 Paddle 系列最贴近，保留下一模型候选。此次只做文档核验，未下载或转换该权重；RGB/BGR、完整预处理和 checkpoint 专属分发声明尚未核验。配置 URL 与 README 的权重目录写法不同，后续必须固定实际文件及哈希 |
| 原始 DeepSORT / mars-small128 | `f08cf1dc470eeb1cd2add1cbf077d95ac6c48aab`；代码 GPL-3.0；README 指向 TensorFlow 1.5 的 `mars-small128.pb`，128 维输出 | 不把原代码或外部 Google Drive 权重直接纳入当前 Apache SDK；论文驱动的独立数学实现另行设计。代码许可不能自动替代外部权重许可 |
| Torchreid OSNet-x0.25 | `f8cd150fdf77e8d9e1ed143b7f308c2c609ded50`；代码 MIT；模型库区分 ImageNet、Market1501、DukeMTMC、MSMT17 等训练来源 | 备选。ImageNet 权重不能冒充已训练的 ReID 权重；此次未固定或转换具体 checkpoint，不把模型库的研究指标当成本项目结果 |
| Intel person-reidentification-retail-0288 | OMZ `6697dead54ed1cdd664b0313189c2cb52ee6335e`；模型自己的 `model.yml` 明确将 license 指向 Apache-2.0；BGR NCHW `[1,3,256,128]` → 256 维 | 权重许可声明明确、规模小，选作技术探针；**不是 Paddle 权重，也不冒称 PP 模型**。已转换和测量，浏览器边界输入未达标，暂不接入 |

Paddle/Torchreid 文档中的训练数据名称不足以证明数据或权重所有再分发条件，也不足以断言“权重禁止商用”。本轮未取得这些 checkpoint 的独立模型卡和完整数据条款，因此保留未核验状态，不作法律定论。OMZ 模型卡给出 Market1501 测试指标，但没有披露完整训练数据清单；不能把测试数据集写成它的训练来源。未来分发须保留适用许可、署名和转换说明。

来源入口：[Paddle DeepSORT](https://github.com/PaddlePaddle/PaddleDetection/blob/b25522a0f4bde8c80603f3ba5e3472059972e3b5/configs/mot/deepsort/README_cn.md)、[原始 DeepSORT](https://github.com/nwojke/deep_sort/tree/f08cf1dc470eeb1cd2add1cbf077d95ac6c48aab)、[Torchreid 模型库](https://github.com/KaiyangZhou/deep-person-reid/blob/f8cd150fdf77e8d9e1ed143b7f308c2c609ded50/docs/MODEL_ZOO.md)、[OMZ 模型清单](https://github.com/openvinotoolkit/open_model_zoo/blob/6697dead54ed1cdd664b0313189c2cb52ee6335e/models/intel/person-reidentification-retail-0288/model.yml)。算法设计依据为 [DeepSORT 论文](https://arxiv.org/abs/1703.07402v1)，不以 GPL 实现作为待翻译代码。

## 转换与数值证据

原始 XML 450,664 字节，FP32 BIN 728,052 字节，二者均通过官方清单 SHA-384；另记 SHA-256 于 [assets.lock.json](assets.lock.json)。使用 Apache-2.0 的 openvino2onnx 1.1.0 转至 opset 17。

未适配 ONNX 在 Python ORT 1.23.2 上执行失败：`LayerNormalization` 的归一化元素数量为 1，出现 `Size of X.shape[axis:] must be larger than 1, got 1`。只把四个单元素 MVN 表示为等价零输出可解除该错误，但全黑/全白输入仍出现非有限 ONNX 输出，而原始 OpenVINO 为有限值。

最终研究图将全部 14 个 MVN 展开为原 IR 的中心化方差公式 `(x-mean(x))/sqrt(mean((x-mean(x))²)+epsilon)`，核对原始轴、`normalize_variance`、`INSIDE_SQRT` 和 epsilon；不改权重。只使用 basic 图优化。适配记录见 [adaptation.json](evidence/adaptation.json)。该修改是实验，不是已验收的通用转换器修复。

- ONNX：**991,822 字节**（0.946 MiB），SHA-256 `50ec57f754c2e277a309607ef2b27f3ce67fe89dd637bf156c9be0b7bb6362e4`。
- 输入为原始 0–255 BGR FP32；图内已含通道反转和均值/尺度，不应再重复标准化。
- 输出 `[1,256]`，探针中 L2 范数约 10.54–18.51，**不是单位向量**；余弦比较前必须显式归一化或计算双范数。
- 八个自建输入：全黑、全白、六组确定性纹理张量；不是自然图片、行人身份样本或多目标视频。
- 原始 OpenVINO 2025.4.1 CPU、强制 FP32 为参考。Python ONNX Runtime 1.23.2 单线程/basic 最大绝对差 `0.0003406703472137451`，最大余弦距离 `1.5390648866464574e-8`，八组均满足预先使用的 `maxAbs < 1e-3` 且 `cosineDistance < 1e-5`。

### 浏览器没有通过验收

Chromium 153.0.8010.12，Windows 11，i5-10400F，RTX 5060 Ti（驱动 32.0.16.1692），ORT Web 1.27.0；headless 桌面、main、basic 图优化、WASM 单线程。WebGPU 使用实际 NVIDIA/Blackwell 非软件适配器，并显式禁止 CPU EP fallback；没有通过降级后端掩盖错误。

| 对比原始 OpenVINO | 通过数 / 8 | 最大绝对差 | 最大余弦距离 | 结论 |
| --- | ---: | ---: | ---: | --- |
| Python ORT CPU | 8 | 0.0003406703 | 0.00000001539 | 此探针范围内通过 |
| 浏览器 WASM | 6 | 0.6726350784 | 0.03885450690 | 全黑、全白失败 |
| 浏览器 WebGPU | 6 | 0.1527701318 | 0.002740533916 | 全黑、全白失败 |

六组纹理在 WASM 最大绝对差约 `8.595e-5`，WebGPU 约 `2.158e-5`。全黑/全白偏差仍存在，未放宽阈值、删除反例或声称“可稳定识别”。剩余跨后端差异的具体节点尚未完成定位，后续需逐层诊断并复验低对比、遮挡和自然图片。转换遗留的未使用常量警告保留在原始浏览器日志；并未把 warning 当作质量通过证据。

### 成本测量

下表只测已准备好输入张量后的 `session.run`；GPU 输出回读在计时内。每后端预热 5 次、单目标测 30 次；8/16 个目标各串行重复 5 组。中位数按探针的上中位样本记录。不同人数在不同循环测量，不用于线性速度排名。

| 执行方式 | 单目标中位数 | 单目标 P95 | 8 个目标串行中位数 | 16 个目标串行中位数 |
| --- | ---: | ---: | ---: | ---: |
| 浏览器 WASM | 19.135 ms | 24.305 ms | 141.610 ms | 291.000 ms |
| 浏览器 WebGPU | 20.185 ms | 30.680 ms | 122.680 ms | 214.380 ms |

本地会话创建分别约 885 / 936 ms，第一次运行约 52 / 810 ms（WASM / WebGPU）。冷启动和本地 HTTP 读模型耗时另记原始证据；不代表 ModelScope/Hugging Face 下载速度。数据不含图像解码、裁剪、检测、跟踪、Worker 通信或视频调度；未测批推理、多线程、手机、相机和 NPU。模型很小也不能据此宣称多人实时，GPU 不保证单目标更快。后续应比较批输入、特征提取频率与 ID 指标的共同变化。

## 下一阶段建议接口边界

以下为后续实现建议，**尚未变成导出的 API**。

1. 在同包增加 `algorithm: 'deepsort'` 的独立策略。它接收检测框、分数、类别、时间戳和外观向量，关联仍为 CPU/main。模型特征提取的 WASM/WebGPU 与关联后端分别报告，不能把选择 GPU 写成整个算法都在 GPU。
2. 固定实例的特征空间身份和维度，身份至少绑定权重哈希、预处理版本和输出定义；每帧携带相同身份，每条检测绑定自己的向量，避免平行数组错位。不同模型的同维向量也不可混用。
3. 首版采用严格输入：DeepSORT 检测必须有有限、维度正确、非零范数的向量；内部复制后归一化，不修改用户数组。缺失/错误向量、身份变化和已取消输入应整帧拒绝，不静默退为 ByteTrack；空检测帧合法。是否支持显式无特征策略作为后续独立选项。
4. 从论文设计余弦最近邻图库、运动门控、匹配级联和有限的 IoU 补配；复用现有独立数学内核与秒级时间语义，文档明确和原论文坐标/帧间隔的差异，不称官方逐值复现。相似外观、完全遮挡和相机运动仍可能换 ID。
5. 每轨迹图库和全局状态必须有上限；删除、reset、dispose 清除外观历史。以 100 条轨迹、每轨 100 个 FP32 向量估算，仅向量占用：256 维约 9.77 MiB，512 维约 19.53 MiB，不含对象与关联矩阵。不能照搬无限图库。
6. 模型适配保持同一 SDK 的按需模块，未来可提供独立导入入口，框输入调用者不加载 ORT 或权重。**纯外部向量算法仍符合标准 1.2.0；一旦同包提供模型加载，必须先扩展标准的算法/模型混合声明、资产、缓存和验证规则。** 当前不更改 `kind`、schema 或模型清单来提前声明能力。
7. Demo 只在算法实际完成后增加选项，并标明外部向量演示的输入性质。视频/摄像头仍要有图像帧、检测和特征提取；算法菜单不会自动提供这些能力。门户只更新路线，不搬入运行时，Workflow 继续暂缓。

备选方案中，直接实现整套视频/摄像头 + ReID 会同时引入尚未通过的模型、标准和媒体边界；为七算法各拆一个包则与既定同 SDK 路线不符。因此建议先完成外部向量算法层，然后再验收可选模型层。

## 后续验收门槛

- 固定 DeepSORT 独立公式和输入契约后，验证同坐标不同外观、外观相似、遮挡重现、运动/类别硬门限、错误原子性、图库上限及实例隔离；合成向量只证明关联机制。
- 用包含实际图像、检测框和身份真值且用途允许的数据集，对 ByteTrack / OC-SORT / DeepSORT 使用相同检测输入评测；记录 IDF1、IDSW、MOTA、FP/FN 和全部预处理/推理/关联成本。现有 `MOT17Labels.zip` 只有标签和检测，不能用于提取真实 ReID 特征；不伪造外观真值来宣称真实精度。
- PPLCNet 下一步先核对具体 checkpoint 身份、权重许可依据与 RGB/BGR/裁剪/标准化，再做 Python 和浏览器对齐。OMZ 0288 只有在全黑/全白等反例修复且真实图片验证后，才能重新考虑；它不是已选定的默认发布模型。
- 可选模型层接入前先演进标准；分发继续 ModelScope 默认、Hugging Face 可选，固定 revision、大小、哈希、许可、显式来源失败语义。当前没有创建或上传模型仓库。

## 证据与复现

| 文件 | 内容 |
| --- | --- |
| `sources.lock.json` / `assets.lock.json` | 固定来源文档与原始模型资产 |
| `evidence/python-result.json` / `fixtures.json` | 环境、模型 SHA、原始参考向量、Python 输出及数值差异 |
| `evidence/browser-result.json` | 两后端原始向量、每样本比较、逐次耗时和全部控制台警告 |
| `evidence/adaptation.json` / `environment.json` | 图改写内容、哈希、硬件和 SDK 基线 |
| `probe/` / `requirements.lock.txt` | 一次性研究脚本及实跑依赖版本；不是生产代码，锁不等于跨平台 wheel 哈希保证 |
| `evidence.lock.json` / `verify_archive.py` | 归档校验与从原始向量复算通过/失败；归档可自洽不等于模型通过 |

从 SDK 根目录，先把 `probe/` 内五个脚本和 `sources.lock.json` 复制到新的 `.tmp/reid-reproduction/`，用 Python 3.11 建隔离环境并安装 `requirements.lock.txt`，依次执行：

```powershell
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/fetch_sources.py
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/download.py
.tmp/reid-reproduction/venv/Scripts/openvino2onnx.exe .tmp/reid-reproduction/assets/person-reidentification-retail-0288.xml .tmp/reid-reproduction/assets/reid-0288-fp32.onnx -v 17
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/adapt.py
.tmp/reid-reproduction/venv/Scripts/python.exe .tmp/reid-reproduction/prepare.py
node .tmp/reid-reproduction/browser.mjs
```

浏览器探针使用 SDK 开发依赖 Playwright 1.63.0 的 Chromium；设置 `TRACKING_REID_ORT_DIST` 为 ORT Web **1.27.0** 的 `dist` 绝对路径，默认只读复用本机 Detection 的安装目录。探针监听随机 localhost 端口，结束即释放；不改变 4204 Demo。最终浏览器命令按当前证据应返回 **1** 并保存两项 `validationPassed: false`；不能将这个非零退出改为通过。重跑输出留在新目录，不覆盖封存证据。无需下载或提交上游图片、跟踪源码或模型二进制。

归档复核：`python reports/2026-09-19-reid-feasibility/verify_archive.py`。SDK 前后静态标准检查保留在门户 `reports/sdk-standard/tracking-reid-{before,after}-20260919.json`；其通过仅覆盖当前两算法产品声明，不为本次未接入的模型背书。
