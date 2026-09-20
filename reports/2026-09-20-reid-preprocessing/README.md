# PPLCNet ReID 图像预处理与独立样本验证

[English](README.en.md)

日期：2026-09-20。分层：单 SDK 的研究与接入准备。**已解码 RGBA 到特征向量的确定性预处理通过本机验证，支持下一阶段接入同包可选 ReID 模块。** 任意透明 PNG 解码逐字节一致的目标未通过，反例已保留；本报告不把它计为通过。

当前生产接口仍为三种 CPU/main 跟踪策略，本地版本 `0.2.0-alpha.0`，线上仍为 `0.1.0`。本轮新增报告、研究脚本、模型卡及设计，没有新增 npm API、Demo 控件或模型分发。完整来源与限制见[模型卡](model-card.md)，预先固定的门槛及运行后偏离见[协议](protocol.md)。

## 图像契约与数值

固定使用上轮 FP32 ONNX，33,704,835 字节，SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`；输入 `[1,3,192,64]`，输出 512 维。加载前同时校验原始 Paddle 静态图及参数的哈希，保持参考身份。

预处理 ID 为 `rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`：调用者提供已解码、方向正确、sRGB 非预乘 RGBA8；图内交集取左/上 floor、右/下 ceil，透明像素先按白底合成，保持正常朝向与 RGB 通道，以 half-pixel 双线性缩放到 64×192，float64 中间计算，ImageNet 标准化后写入 FP32。像素函数的尺寸、非法框、共享缓冲和不可变输入规则见协议与测试。研究像素函数支持越界裁剪，未来生产 extract 将只接受与 Tracker 兼容的完整图内检测框。

8 组人工边界图和按固定规则选出的 26 组真实裁剪，共 34 组：

| 路径 | 张量与 Python 参考最大绝对差 | 特征与 Paddle 参考最大绝对差 | 结果 |
| --- | ---: | ---: | --- |
| Node 预处理 | 0 | 不执行模型 | 34/34 |
| Python ORT | 使用参考张量 | 1.818e-6 | 34/34 |
| Chromium WASM | 0 | 1.818e-6 | 34/34 |
| Chromium WebGPU | 0 | 2.444e-6 | 34/34 |

预定张量门槛为最大绝对差 ≤2e-6；特征同时要求最大绝对差 <1e-3、余弦距离 <1e-5，未放宽。7 项像素契约测试先全部失败，再全部通过，日志一并保留。

33 组**不透明** PNG 经浏览器解码后与原 RGBA 完全相同；5 张 JPEG 在本次 OpenCV/Chromium 矩阵也相同，作为单独诊断。透明 PNG 的 4 像素反例有 7/16 个通道字节变化，最大差 247：Canvas 可能丢失透明像素隐藏颜色，并量化半透明 RGB。raw RGBA 的白底合成通过，不代表任意原始 PNG 解码保真。因此下一入口接受已解码 RGBA；图片文件解码、EXIF 和其他浏览器须另行验收。详见 [decode-diagnostics.json](evidence/decode-diagnostics.json)。

## 独立序列质量

固定 MOT17-05/09/10/11/13-FRCNN，独立于上轮 02/04；每段取帧 1/31/61/91/121/151。仅保留 mark=1、class=1、visibility≥0.7、完整图内且宽≥16、高≥48 的 GT 行人框，MOT 一起点坐标转零起点。首帧为图库，后续同 ID 为查询；不按结果挑序列。HTTP Range 获得 30 张图片、5 份 GT、5 份序列信息，传输 9,001,707 字节，身份见 [data.lock.json](data.lock.json)。原图和完整 GT 未提交。

共 103 个裁剪，36 个图库身份、67 次查询：

| 路径 | 第一名正确 | 微平均 Rank-1 | 序列宏平均 Rank-1 |
| --- | ---: | ---: | ---: |
| OpenCV RGB | 52/67 | 77.61% | 83.08% |
| OpenCV BGR | 50/67 | 74.63% | 78.83% |
| 确定性 float RGB | 53/67 | 79.10% | 84.33% |
| 确定性 float BGR | 50/67 | 74.63% | 78.83% |

确定性 RGB 在 05/09/10/11/13 各段依次正确 2/2、9/10、17/24、11/15、14/16，支持继续选用 RGB 候选。05 仅有两次查询，宏平均对小序列敏感。这是 GT 框、同摄像头、闭集、小样本检索，不能替代跨摄像头评测或真实检测输入的 IDF1/MOTA。

没有调优现有距离阈值 0.2。固定 0.1/0.2/0.3/0.4 的全部诊断保留在原始结果；0.2 下 float RGB 拒绝同 ID 37/67 次、接纳异 ID 8/555 次，float BGR 分别为 46/67、6/555。Rank-1 较高不等于所有关联门限下同时更好；多向量图库和运动门控还需实际时间序列验证。

## 桌面耗时与边界

Windows 11、i5-10400F、RTX 5060 Ti、Chromium 153.0.8010.12、ORT Web 1.27.0。WASM 为单线程，图优化 basic；WebGPU 从 ORT 实际 GPUDevice 回读 NVIDIA/Blackwell，isFallbackAdapter=false，并禁用 CPU EP fallback。

同一个真实裁剪预热 5 次后运行 30 次，各阶段中位数：

| 后端 | 预处理 | 推理 | 归一化 | 总耗时 |
| --- | ---: | ---: | ---: | ---: |
| WASM | 1.190 ms | 58.930 ms | 0.095 ms | 60.263 ms |
| WebGPU | 1.210 ms | 9.240 ms | 0.085 ms | 10.525 ms |

推理包含输入 Tensor 构造、ORT run、输出回读及释放；总耗时由外围时钟测量。各列中位数分别计算，不能相加代替总耗时。排除解码、检测、关联、下载和帧调度；与上一轮仅张量推理的口径不同，不直接计算加速比，不宣称完整视频实时性能。未验证手机、Worker、NPU、其他浏览器、摄像头或动态 batch。

## 来源、设计与下一步

固定 PaddleDetection 提交 `b25522a0f4bde8c80603f3ba5e3472059972e3b5` 的根许可和模型/预处理文件头为 Apache-2.0。官方 README 记载 Market1501（751 类）训练，完整训练细节待披露；额外 1502 维训练头不用于推理，不能据此猜测训练集。具体 checkpoint 独立条款及完整训练数据条件未独立核实；这不是禁止商用结论。所查 URL、时间、哈希和 404 响应保存在 [sources.lock.json](sources.lock.json)，单个 README 404 不能证明其他位置没有声明。

门户已形成算法/模型混合声明提案与可选模块设计：先实施标准 schema/rules/checker，再增加 `web-sdk-pp-tracking/reid` 子入口，绑定模型哈希、预处理和 L2 规则的 featureSpace，明确并发、取消、整帧原子性和释放。关联仍用 CPU，模型 WASM/WebGPU 单独报告。标准当前仍为 1.2.0，提案及示例接口尚未生效。

模型分发方向为 ModelScope 默认、Hugging Face 可选；本轮没有上传，不填造下载地址或 revision。正式 Demo 和分发前须落实采用的许可依据、署名、真实双源下载和哈希验证。之后在相同真实检测输入上比较三种跟踪策略及全链路成本，再决定发布。

## 复现与归档

离线复算不需要模型或网络：

```powershell
python reports/2026-09-20-reid-preprocessing/verify_archive.py
node --test reports/2026-09-20-reid-preprocessing/probe/preprocess.test.mjs
```

完整推理需 Python 3.11 及[上轮依赖版本](../2026-09-19-pplcnet-reid/requirements.txt)、仓库 Playwright 和 ORT Web 1.27.0。先按[上轮报告](../2026-09-19-pplcnet-reid/README.md)准备固定原始 Paddle 与 ONNX 到 `.tmp/pplcnet-reid/`。以下在 SDK 根目录运行，使用新的临时目录，不覆盖历史证据；`<python>` 替换为已安装依赖的解释器：

```powershell
<python> reports/2026-09-20-reid-preprocessing/probe/data.py --work .tmp/reid-preprocessing-reproduction
<python> reports/2026-09-20-reid-preprocessing/probe/provenance.py --work .tmp/reid-preprocessing-reproduction
<python> reports/2026-09-20-reid-preprocessing/probe/evaluate.py --work .tmp/reid-preprocessing-reproduction --previous-work .tmp/pplcnet-reid
node reports/2026-09-20-reid-preprocessing/probe/node-check.mjs .tmp/reid-preprocessing-reproduction
node reports/2026-09-20-reid-preprocessing/probe/browser.mjs .tmp/reid-preprocessing-reproduction
<python> reports/2026-09-20-reid-preprocessing/probe/prepare-diagnostic.py --work .tmp/reid-preprocessing-reproduction
node reports/2026-09-20-reid-preprocessing/probe/decode-diagnostics.mjs .tmp/reid-preprocessing-reproduction
```

`TRACKING_REID_ORT_DIST` 指向 ORT Web 1.27.0 的 dist；探针默认路径是本机 Detection 仓库安装位置。原始向量、34 组参考身份、全部检索及阈值记录、逐次耗时在 `evidence/`，由 `evidence.lock.json` 固定字节。`verify_archive.py` 独立复算数值、检索和阈值，不重新调用推理；数据/模型原件仅留在忽略目录。`probe/archive.py` 是维护者归档工具，会更新本报告，复现实验不运行它覆盖历史记录。

## 交付检查

独立[复审](evidence/review.md)已通过，透明 PNG 范围、Paddle 参考身份和 OOM 错误设计三项均已修复，无未解决问题。归档哈希及原始向量、检索、阈值统计复算通过；离线张量校验核对身份和既有记录，完整预处理重跑需按上述步骤准备原图。

SDK 完整 verify 退出 0：104 项单测、类型检查、核心/Demo/Vanilla/React 构建、三算法包消费及 12 组浏览器检查通过。runtime 和 22,522 字节 tarball 哈希与阶段开始一致，研究文件未混入发行包。标准 before/after 各 17 项 required 通过、0 失败，状态仅 locally-compliant。门户 99 项测试通过，21 页构建成功，Astro 检查 0 errors/0 warnings、7 条既有 hints。证据见 [validation.json](evidence/validation.json)、[SDK 日志](evidence/sdk-verify.log)与[浏览器回执](evidence/sdk-browser.json)；390px 布局检查不代表手机实机验证。
