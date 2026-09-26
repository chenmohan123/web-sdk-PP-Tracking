# CenterTrack 资产门槛阶段回执：任务1 通过，任务2 阻断

日期：2026-09-23 至 2026-09-24。层级：单 SDK 候选资产门槛。状态：**在任务2 停止，任务3–7 未执行**。

本目录只放两份 JSON 回执，不放权重、官方源码与 Python 环境（那些在 gitignore 的
`.tmp/centertrack-reference/`）。门槛定义与停止条款见相邻门户仓库
`docs/superpowers/plans/2026-09-23-tracking-centertrack-assets.md`，
设计与 2026-09-24 更正见同目录 `specs/2026-09-23-tracking-centertrack-design.md`，
可行性矩阵与 28 条来源锁见门户 `reports/tracking/2026-09-23-model-tracking-feasibility/`。

## 任务1：权重下载与字节核验（通过）

| 项 | 实测值 |
| --- | --- |
| 来源 | Google Drive `1rJ0fzRcpRQPjaN17lcqfKgsz-wJRifHh` |
| 字节数 | 79,987,301 |
| SHA-256 | `2272af8918b5a0e57b8285684b801b24ac5d0b6c30887b63ad566152af19eed6` |
| 下载时间 | 2026-09-23T15:55:00Z |
| 上游修订 | `e4e7534cc2ebfbd31e0cde680988f286c65fe34f` |
| 权重口径 | MOT17 half val MOTA 66.1；MOT17 为非商业许可数据集 |

证据：[`asset.json`](asset.json)。

## 任务2：官方前向环境与 golden 输出（`status: BLOCKED`）

证据：[`golden-manifest.json`](golden-manifest.json)。

环境：torch 2.14.0+cpu、torchvision 0.29.0+cpu、Python 3.12.13、CUDA 不可用；
`weightsOnlyMode` 为真，并使用一次性 torchvision 垫片（裁定 R10，未删除）。

输入决定论已核验：`images` 为 `1×3×544×960`，`torch.manual_seed(20260923)` 后
`torch.rand`，`pre_images = images.clone()`，`pre_hms` 全零；两条输入张量的 SHA-256
已记录，`inputDeterminismVerified: true`。

checkpoint 清单：418 个张量，分组为 `base` 246、`dla_up` 114、`ida_up` 38，
`hm`/`wh`/`reg`/`ltrb_amodal`/`tracking` 各 4。

两处阻断点：

1. **致命（裁定 R11）**：官方 `mot17_half` 权重实测含 16 个 DCN 模块（`dla_up` 12 个
   ＋ `ida_up` 4 个 DeformConv），对应 32 个 `conv_offset_mask` 张量（offset+mask 通道
   27 = 3×3×3）。`.tmp` venv 内官方 `necks/dlaup.py` 的 try/except 回退使 `DCN=None`，
   `dla_node='dcn'` 构造即 `TypeError(NoneType)`。R11 明令不初始化、不编译 DCNv2。
2. **环境性（非致命但不阻断可绕过）**：`GenericNetwork` 构造 backbone 时无条件以
   `pretrained=True` 下载 `http://dl.yf.io/dla/models/imagenet/dla34-ba72cf86.pth`，
   实测 HTTP 404。该权重只是构造副作用，与 `mot17_half` 的 `state_dict` 无交集
   （backbone 246 参数＋缓冲对 `base.*` 246 键，覆盖 0/0），绕过它也无法解决阻断点1。

键级最近证据（直接构造官方 `DLASeg` 并以 `strict=False` 加载 `dla_up`/`ida_up` 切片）：
`gcn` 分支 missing 104 / unexpected 144（其中 32 个 `conv_offset_mask` 键）、
`conv` 分支 missing 80 / unexpected 144、`dcn` 分支 `CONSTRUCT_FAIL TypeError`。
结论：**不存在既能免 DCNv2 构造、又与 checkpoint 键全匹配的节点类型**，硬门槛
missing/unexpected 为空不可达。`outputs`、`goldenNpz` 均为 null。

三次尝试的参数调整与一处转写更正（`ltrb_amodel` → 实测 `ltrb_amodal`，官方
`opts.py:359` 同为 `ltrb_amodal`）逐条记录在 `adjustments`。

## 任务3–7：未执行

ONNX 导出与算子清单、Python ORT 对齐、JS 参考夹具、模型身份注册、分发上传全部未做；
`models/centertrack/0.1.0/` 与 `tests/fixtures/centertrack-forward.json` 未创建。
`necksExportImplication` 记录：DCNv2 亦非标准 `ai.onnx` 算子，任务3 的"仅标准算子"
判据同样会失败（`deform_conv` 不在 onnxruntime-web@1.27.0 支持表）。

## 边界

不是官方精度复现，不是浏览器运行验证；`mot17_half` 无不可变发布来源，且 MOT17 训练数据
为非商业许可。本阶段未改动 runtime、`sdk-manifest.yaml`、`package.exports`、Demo，未发版，
除只读下载权重外无远程写入。

后续路线已转向 ByteTrack ＋ YOLOX 检测子入口候选，见门户
`docs/superpowers/specs/2026-09-24-tracking-modeltracking-yolox-design.md`。
