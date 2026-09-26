# YOLOX-Tiny 候选资产与运行时证据

日期：2026-09-25，2026-09-26 追加组合序列与类型消费证据
状态：候选验证记录，未进入正式 exports、manifest 或分发渠道
关联 SDK：`web-sdk-PP-Tracking`

本目录记录 ByteTrack + YOLOX 候选路线的模型资产、导出边界、参考张量、PyTorch/ONNX Runtime parity，以及 Windows 11 + Chromium 桌面环境的 Node/WASM、Chromium/WASM 和 Chromium/WebGPU 实测结果。

候选路线只新增单帧 person 检测能力。YOLOX 不保存跨帧状态，不接收 timestamp，不修改根入口 ByteTrack；检测结果由调用方自行交给既有 ByteTrack 算法。候选阶段不修改正式 `package.exports`、`sdk-manifest.yaml` 或公开 Demo，不执行发布和远程写入。

## 1. 结论摘要

- 官方权重来源已锁定为 `Megvii-BaseDetection/YOLOX` Release `0.1.1rc0`。
- 上游修订为 `e1052df71842031413f6030723c3607b839c80ce`。
- 使用 YOLOX-Tiny，输入尺寸 `416×416`，FP32，ONNX opset 17。
- 源权重为 COCO 通用检测权重，不是 MOT17 专用行人权重。
- 只保留 COCO `person`，上游类别索引为 `0`，SDK 输出 `classId: 1`。
- ONNX 图内包含 objectness 和类别 sigmoid；grid decode、阈值、topK 和 NMS 留在 JS 侧。
- Node WASM/main、Chromium WASM/main 和 Chromium WebGPU/main 均完成本机实测。
- Node 与 Chromium WASM 的 canonical detection 序列化和 SHA-256 一致。
- 真实 YOLOX 输出经正式根入口 `createTracker()` 送入 ByteTrack 的七帧合成序列已在 Node 与 Chromium 双端跑通，分三组变体：候选默认阈值（空检测契约）、零阈值（真实框进跟踪）、零阈值加低跟踪阈值（真实走完 `tracked/lost/removed`）。两端配置各自 import 同一份共享模块后互核，六份模块按磁盘字节 SHA-256 比对（该比对的证明力边界见第 15 节）。
- 带真实框的两组在 `motion-approach` 上跨运行时不一致（6/7），成因是 `8e-11 ~ 1e-9` 级近平局处 greedy NMS 保留了不同的框；该差异未级联到后续帧。以上均如实入证据，见第 15 节。
- 序列接入过程中发现并修复了贴边检测框的浮点边界缺陷，见第 16 节；该修复位于 `src/tracker.ts` 的输入校验，不改算法、阈值或生命周期默认值。
- 候选 bundle 完成 ESM、CommonJS 与 NodeNext mts/cts 类型消费，并带一个必须失败的反面对照，见第 17 节。
- WebGPU 结果单独记录，不要求与 WASM 输出逐字节一致。
- Worker、移动端、Safari、Firefox、NPU 和 WebNN 均未验证，不作兼容性承诺。
- `sources.json` 当前为 `pending-authorization`，分发数组为空；本候选没有正式模型分发地址。

## 2. 证据文件

| 文件 | 内容 |
| --- | --- |
| `asset.json` | 官方 `yolox_tiny.pth` 下载、字节数、SHA-256 和来源锁定 |
| `golden-manifest.json` | 固定 CPU PyTorch golden 输入、输出和确定性配置 |
| `onnx-manifest.json` | ONNX 输入输出、导出边界和算子清单 |
| `parity.json` | PyTorch 与 ONNX Runtime 全量输出对齐 |
| `fixture-manifest.json` | JS 参考 fixture、原始输出和 decode/NMS 期望值 |
| `runtime-evidence.json` | Node、Chromium WASM、Chromium WebGPU 实测、ByteTrack 组合序列与运行边界 |
| `candidate-consumer-check.json` | 候选 ESM、CommonJS 与 NodeNext 类型消费及反面对照 |
| `sdk-check.json` | 门户 `sdk:check` 在 tracker 校验变更之后的整仓结论 |

生成时间以各 JSON 文件中的 `generatedAt`（`candidate-consumer-check.json` 为 `testedAt`，`sdk-check.json` 为 `checkedAt`）为准；本 README 不替代这些机器可读证据。

## 3. 上游权重身份

来源：

- 组织：`Megvii-BaseDetection`
- 仓库：`YOLOX`
- Release：`0.1.1rc0`
- Release 发布时间：`2021-08-18T12:41:41Z`
- 上游 revision：`e1052df71842031413f6030723c3607b839c80ce`
- 资产：`yolox_tiny.pth`
- 字节数：`40,755,013`
- SHA-256：`9de513de589ac98bb92d3bca53b5af7b9acfa9b0bacb831f7999d0f7afaee8f0`
- 许可证依据：官方 YOLOX 仓库 Apache-2.0

`asset.json` 记录了流式下载和独立本地校验，两者的字节数和 SHA-256 均一致，且与 Release 元数据一致：

- `bytesMatch: true`
- `sha256Match: true`
- `sourceLockMatch: true`
- `passed: true`

该权重的用途是 COCO 80 类通用目标检测。候选模块只在解码阶段保留 `person`，不把该权重描述为 MOT17 行人训练权重，也不从本次证据推导 MOT 行人精度。

## 4. 模型与 ONNX 导出

模型身份：

- id：`yolox-tiny-416-fp32`
- version：`0.1.0`
- precision：`fp32`
- parameter count：`5,055,855`
- 输入：`[1, 3, 416, 416]`，FP32，NCHW
- 输出：`[1, 3549, 85]`，FP32
- ONNX 字节数：`20,258,925`
- ONNX SHA-256：`2e99f041301698ff4a9e898aa1efb4bcdd503d46f5c5c1829be17af9b7adfab6`
- preprocessing id：`yolox-letterbox-416-imagenet-meanstd-f32-v1`

导出边界：

- `decode_in_inference: false`
- objectness sigmoid：图内
- class sigmoid：图内
- grid decode：图外，由 JS 实现
- score threshold：图外，由 JS 实现
- topK：图外，由 JS 实现
- NMS：图外，由 JS 实现
- ONNX opset：17
- ONNX IR version：8
- onnxsim：未启用；当前环境不可用，并在 Task 2 中显式关闭

输出通道顺序：

`dx, dy, dw, dh, objectness, class[0..79]`

图中只包含 `ai.onnx` 标准域算子，共 324 个节点：

- Add：7
- Concat：21
- Constant：38
- Conv：83
- MaxPool：3
- Mul：74
- Reshape：3
- Resize：2
- Shape：3
- Sigmoid：80
- Slice：9
- Transpose：1

未发现自定义域、`NonMaxSuppression`、`TopK`、阈值比较或其他后处理算子。ONNX checker 完整校验通过。

## 5. PyTorch golden 与 ORT parity

golden 输入：

- shape：`[1, 3, 416, 416]`
- dtype：`float32`
- bytes：`2,076,672`
- SHA-256：`a8c8d479826e6fe83e627c44f549cc1435b29cb2bbb9759b1457817787aadb51`
- layout：NCHW

PyTorch golden 输出：

- shape：`[1, 3549, 85]`
- dtype：`float32`
- bytes：`1,206,660`
- elements：`301,665`
- SHA-256：`72a66a37d2d2da175a844223d2e2b601f9e21fd94ed9d6255a55952509cb9834`

ONNX Runtime 环境：

- Windows 11 `10.0.26200-SP0`
- Python `3.12.13`
- NumPy `2.5.2`
- ONNX Runtime `1.27.0`
- provider：`CPUExecutionProvider`
- inter-op threads：1
- intra-op threads：1
- graph optimization：`ORT_ENABLE_ALL`

全量比较结果：

- 比较元素：`301,665`
- 超出容差元素：`0`
- 容差：`0.0001`
- 最大绝对误差：`2.5272369384765625e-05`
- 平均绝对误差：`1.2306379911639282e-07`
- RMSE：`5.931297342509856e-07`
- `fullTensorCompared: true`
- `tolerancePassed: true`
- `passed: true`

该 parity 证明固定输入下 PyTorch 与 ONNX Runtime 的完整输出张量满足记录的容差；它不等价于官方逐值复现声明，也不代表真实 COCO 或 MOT 精度评估。

## 6. JS decode、过滤与 NMS 参考 fixture

固定参考输出形状为 `[1, 3549, 85]`，anchor 顺序为 stride 层级顺序，再按 `y * width + x` 行主序排列。网格尺寸为：

- stride 8：52×52
- stride 16：26×26
- stride 32：13×13

解码公式：

- `cx = (dx + gx) * stride`
- `cy = (dy + gy) * stride`
- `width = exp(dw) * stride`
- `height = exp(dh) * stride`

person 分数为：

`objectness * class[0]`

默认候选契约：

- score threshold：`0.1`
- NMS threshold：`0.7`
- NMS 抑制条件：`IoU > nmsThreshold`
- max detections：`100`
- 排序：score 降序；等分数按 anchor index 升序
- 输出框：左上角 `xywh`，裁剪到原始图像边界
- COCO person index：`0`
- SDK classId：`1`

`fixture-manifest.json` 的原始输出为：

- dtype：`float32`
- bytes：`1,206,660`
- elements：`301,665`
- SHA-256：`613f8ee10c4bbfca430dfd85647b7180ac3bb82296757c596f7da02409fb3dfa`
- `shape: [1, 3549, 85]`

fixture 校验结果：

- base64 round trip：通过
- 原始输出身份：通过
- 字节长度和元素数量：通过
- 确定性排序：通过
- person-only：通过
- strict NMS threshold：通过
- fixture 原子写入：通过
- `passed: true`

需要明确这条 fixture 的覆盖边界：该真实前向输出在 `scoreThreshold: 0.1` 下 `scoreQualifiedAnchors` 为 0，期望集是空集，所以 `tests/yolox-decode.test.ts` 里"与 Python 期望一致"的断言实际上是空对空，它只证明这份张量在 JS 侧解码同样不产生候选，不证明排序、person-only 与 NMS 行为。为此同一夹具另加了一条零阈值断言：`scoreThreshold: 0` 时必须解出非空、分数降序、`classId` 为 1、且按**无容差的精确比较**满足 `x + width <= imageWidth` 与 `y + height <= imageHeight`。两点实测依据：该断言在变异检查中确实会失败（把阈值换成 `0.1` 后立即在 `toBeGreaterThan(0)` 上红）；而精确包含在零阈值真实张量上全部成立，说明生产端 `clipBox` 本身没有越界，第 16 节的问题只出在消费端的减法判定形式。排序、抑制与等分 tie-break 的行为覆盖在合成张量单测 `tests/yolox-decode.test.ts` 与 `tests/yolox-nms.test.ts` 中。

另一处需要如实标注：上表中 `deterministicSort`、`personOnly`、`strictNmsThreshold` 三个布尔来自 `fixture-manifest.json` 的历史记录，本仓库内没有可重跑该清单的生成脚本，因此它们目前不可独立复现；可复现的是 fixture 文件自身的 SHA-256 与上述 JS 单测。

## 7. Node WASM/main 实测

运行证据由 `tests/yolox-node.mjs` 生成，并写入 `runtime-evidence.json`。

环境与配置：

- requested backend：`wasm`
- actual backend：`wasm`
- execution mode：`main`
- ORT：`1.27.0`
- runtime version：`web-sdk-pp-tracking@0.2.0-rc.2`
- fixture：`320×240` RGBA8
- fixture bytes：`307,200`
- fixture SHA-256：`14fe928c3e967653c288fae97134892ba2541ea50af50eadea2976bbf52dc459`
- warmup runs：1
- measured runs：5
- score threshold：0
- NMS threshold：0.7
- max detections：100

加载：

- cold load wall time：`1100.6594 ms`
- integrity：`65.4732 ms`
- session：`1034.6021 ms`
- total timing：`1100.5042 ms`

warm detection 汇总：

- total p50：`476.5887 ms`
- total p95：`489.56228 ms`
- inference p50：`383.2649 ms`
- postprocess p50：`74.3914 ms`
- repeated output stable：true

输出：

- detection count：100
- dropped detections：1556
- canonical serialized bytes：13272
- detection SHA-256：`f762c76fc4ed703fc886534b0e9b791dd2685f0ab472aa31a96f79c93687b152`
- model identity match：true
- fixture written：true
- runtime identity match：true
- `passed: true`

本次测量使用 score threshold `0` 是为了让固定 fixture 覆盖更多候选框并稳定检验后处理和截断路径，不改变产品契约中默认的 score threshold `0.1`。

## 8. Chromium WASM/main 实测

环境：

- Chromium：`153.0.8010.12`
- HeadlessChrome user agent：Windows 11 x64
- `crossOriginIsolated: true`
- requested backend：`wasm`
- actual backend：`wasm`
- execution mode：`main`
- ORT：`1.27.0`

加载：

- cold load wall time：`1452.825 ms`
- integrity：`68.515 ms`
- session：`1383.635 ms`
- total timing：`1452.625 ms`

warm detection 汇总：

- total p50：`613.34 ms`
- total p95：`706.405 ms`
- inference p50：`542.62 ms`
- postprocess p50：`66.845 ms`

输出：

- detection count：100
- dropped detections：1556
- canonical serialized bytes：13272
- detection SHA-256：`f762c76fc4ed703fc886534b0e9b791dd2685f0ab472aa31a96f79c93687b152`
- page errors：空

Node 与 Chromium WASM 对照：

- canonical serialization：一致
- detection SHA-256：一致
- repeated output：稳定
- `nodeChromiumSerializedOutputMatch: true`
- `nodeChromiumDetectionHashMatch: true`

浏览器请求全部指向本地 HTTP server，`localNetworkOnly: true`。

## 9. Chromium WebGPU/main 实测

本次实测在实际 NVIDIA adapter 上完成：

- status：`verified`
- vendor：`nvidia`
- architecture：`blackwell`
- isFallbackAdapter：false
- requested backend：`webgpu`
- actual backend：`webgpu`
- execution mode：`main`
- ORT：`1.27.0`

加载：

- cold load wall time：`334.03 ms`
- integrity：`53.445 ms`
- session：`280.42 ms`
- total timing：`333.965 ms`

warm detection 汇总：

- total p50：`91.65 ms`
- total p95：`112.521 ms`
- inference p50：`19.475 ms`
- postprocess p50：`63.605 ms`

输出：

- detection count：100
- dropped detections：1550
- canonical serialized bytes：13282
- detection SHA-256：`eb09a45a12e47275a7d38a8068311d4838f4fb0f58185c86f0d15882b63815e5`

WebGPU 输出与 WASM 输出使用独立 hash。两者不要求逐字节一致，因为后端浮点计算路径可能不同；本证据只要求各自重复运行稳定并完成对应后端的运行契约验证。

Chromium 控制台保留一条 Windows warning：

`The powerPreference option is currently ignored when calling requestAdapter() on Windows.`

该 warning 未产生 page error，也未阻断本次 WebGPU 验收。

## 10. 跨运行时 canonical 序列化

Node 和 Chromium 不直接对 detector 返回的原始浮点对象执行 JSON.stringify。证据 helper `tests/yolox-serialization.mjs` 对 box 坐标和 score 使用固定 12 位小数规范化：

`Number(value.toFixed(12))`

该规范化仅用于证据比较、序列化字节数和 hash，不改变 detector 的真实返回值，也不改变模型或后处理算法。

回归测试覆盖两类情况：

- 极低位的跨运行时浮点差异会被统一。
- 大于 canonical 精度的真实差异不会被吞掉。

该处理解决了 Node 与 Chromium 在 WASM 浮点执行和 JavaScript 序列化上的低位差异，同时保留了对真实检测差异的敏感性。

组合序列另提供 `serializeYoloxDetectionsUnordered`：把每条检测单独规范化成字符串后排序再序列化，使哈希不受保留集合内部顺序影响。它只消除排序差异，不消除“哪个框被选中”的差异，也不改变单帧证据仍在使用的顺序敏感序列化。`tests/yolox-serialization.test.ts` 覆盖三点：近平局换序后哈希不变、重复检测按多集合保留、超出 canonical 精度的数值与丢弃数变化仍会改变哈希。

## 11. ONNX Runtime Web 算子审计边界

静态审计针对 ONNX Runtime Web `1.27.0`：

- WASM 所需标准算子均在静态覆盖范围内。
- WASM 静态覆盖结论为完整，但静态证据本身不替代运行时验证。
- WebGPU 静态注册审计发现 `Constant` 注册信息缺失。
- `Reshape` 和 `Shape` 在上游文档中记录为无 GPU kernel，存在 CPU fallback 相关边界。
- WebGPU 静态审计报告为 `static-registration-audit-only`，不能单独证明所有设备兼容。
- 本 README 的 WebGPU 已验证结论只适用于本次实际测量的 Windows 11、Chromium 153、NVIDIA Blackwell adapter。

## 12. 验证范围和限制

已实际验证：

- Windows 11 `10.0.26200-SP0`
- Node WASM/main
- Chromium 153 WASM/main
- Chromium 153 WebGPU/main
- ORT `1.27.0`
- 固定 320×240 RGBA8 合成 fixture
- 模型身份、fixture 身份、重复输出、Node/Chromium WASM canonical 序列化
- ByteTrack + YOLOX 七帧合成组合序列三组变体（Node WASM/main 与 Chromium WASM/main，含共享配置互核与六份模块磁盘字节哈希比对）
- 真实 Python 前向张量在零阈值下的非空、降序、person 与精确边界包含断言
- 候选 bundle 的 ESM、CommonJS 与 NodeNext mts/cts 类型消费
- 本机网络边界

未验证：

- Web Worker
- 手机或其他移动设备
- Safari
- Firefox
- NPU
- WebNN
- 真实 MOT17 行人精度
- 真实行人帧上的 YOLOX→ByteTrack 组合行为与精度
- 零阈值噪声区跨运行时的 NMS 存活集合一致性（已实测为不一致，见第 15 节）
- COCO 全量精度
- 长视频、摄像头调度、录制或上传
- 公开模型分发和远程来源回读

本证据不把合成 fixture 的检测输出或运行耗时表述为真实行人精度，也不把桌面环境结果扩大为其他设备或浏览器的兼容性承诺。

## 13. 候选治理状态

当前候选身份文件中的分发状态为 `pending-authorization`，`sources.json` 的 `distributions` 为空。

候选阶段明确不做以下操作：

- 不加入正式 `package.exports`。
- 不加入正式 `sdk-manifest.yaml`。
- 不新增 `detect + track` 组合生产 API，不改根入口导出的公共类型与函数签名。
- 不修改公开 Demo。
- 不发布 npm 包。
- 不发布 GitHub Release。
- 不写入 ModelScope 或 Hugging Face。
- 不把候选能力写入稳定版本说明。

一处已授权的例外必须记录在这里：为修复第 16 节的浮点边界缺陷，`src/tracker.ts:28` 与 `:82` 的输入校验被修改，属于已发布跟踪入口的代码变更，但不改匹配算法、阈值默认值、生命周期状态机或公开返回结构。四算法共用同一处 `validateFrame`（`src/tracker.ts:118` 是唯一调用点），故同时生效；`tests/tracker.test.ts` 已对 bytetrack 与 ocsort 两侧分别断言接受与拒绝。该变更随工作树保留，尚未推送或发布；覆盖该变更之后整仓状态的门户检查见 `sdk-check.json`（必需项 21 通过、0 失败，4 项必需检查因需远程核验而跳过，另有 1 项 lab 为信息性跳过）。进入正式版本前需要按门户标准走版本与发布门槛，并在发行说明中说明校验接受条件的变化。

另一个提交时的注意事项：本轮新增的 8 个 `tests/yolox-*.test.ts` 已进入官方 `npm test` 与 `typecheck` 门禁，它们必须与 `src/yolox/`、`models/yolox-tiny/`、`tests/fixtures/yolox-forward.json` 同进退；若只提交其中一部分，CI 会因缺少被测源或夹具而失败。

该风险目前只有本地证据支撑：`.github/workflows/ci.yml` 只在 push 到 `main`、`pull_request` 或 `workflow_call` 时触发，而本分支按决定未开 PR，所以远端 CI 没有跑过这组提交。"门禁不再依赖未跟踪文件"是由本地干净树复跑（typecheck 通过、280 项单测通过、`git status` 无未跟踪残留）证明的，不是由 CI 证明的；要拿到 CI 证据必须先开 PR 或并入 main。

后续若进入集成阶段，必须先按门户标准扩展标准层，再决定 manifest、exports、Demo、分发来源和版本边界；本目录中的运行证据不能替代这些集成和发布门槛。

## 14. 机器可读证据索引

- `asset.json`
- `golden-manifest.json`
- `onnx-manifest.json`
- `parity.json`
- `fixture-manifest.json`
- `runtime-evidence.json`
- `candidate-consumer-check.json`
- `sdk-check.json`

其中 `runtime-evidence.json` 没有顶层 `passed`，通过与否看 `verification.passed` 与 `comparison.passed`，并记录了 Node WASM、Chromium WASM、Chromium WebGPU、网络边界和未验证环境声明。`sdk-check.json` 是覆盖 `src/tracker.ts` 校验变更后重跑的门户检查结果。

## 15. ByteTrack + YOLOX 组合序列验收

七帧原创合成序列（320×240 RGBA8）固定帧 id 与时间戳：`motion-start` 0、`motion-approach` 100、`crossing` 200、`occlusion` 300、`reappearance` 400、`long-loss` 2601、`sparse-resume` 5002。后两帧用于覆盖 `largeGapMs` 与稀疏时间戳路径。

检测与跟踪由真实产物承担：`tests/yolox-node.mjs` 与 `tests/yolox-browser.mjs` 调用同一个 `tests/yolox-tracking-sequence.mjs` runner，检测端是已锁定 ONNX 的真实 YOLOX 推理，跟踪端是正式根入口 `dist/index.js` 导出的 `createTracker()`，不新增组合生产 API。

三组变体各自声明检测阈值、跟踪阈值与哈希口径：

| 变体 | 检测阈值 | 跟踪阈值 | 送入真实框 | 建立轨迹 | Node/Chromium 检测·跟踪逐帧一致 |
| --- | --- | --- | --- | --- | --- |
| `candidate-default-threshold` | `0.1 / 0.7 / 100` | ByteTrack 默认 | 否 | 否 | 7/7 · 7/7（空对空） |
| `zero-threshold-coverage` | `0 / 0.7 / 100` | ByteTrack 默认 | 是 | 否 | 6/7 · 7/7 |
| `zero-threshold-lifecycle` | `0 / 0.7 / 100` | `newTrackThreshold: 1e-9` | 是 | 是 | 6/7 · 6/7 |

两端的变体清单与阈值来自共享模块 `tests/yolox-candidate-config.mjs`，各自 `import` 后交叉核对（`verification.sharedSequenceConfigMatch`），浏览器不采信 Node 的结果文件；页内还断言配置模块使用的序列化器与验收脚本是同一函数引用。证据同时绑定被测产物身份：`node.artifacts` 记录候选 ESM/CJS 与根入口 bundle 的 SHA-256，Chromium 对服务端实际返回的同一批字节取哈希并比对（`verification.servedModuleIdentityMatch`）。每组变体在单个运行时内重放两次，两次序列哈希一致，重放值记录在各变体的 `repeat` 字段。

`servedModuleIdentityMatch` 的证明力要说清边界：页面是在 `import()` 之后再对同一 URL 发一次 `fetch` 取哈希，两次读取之间服务器每次都从同一磁盘路径重新读文件，因此它证明的是"导入时刻与哈希时刻磁盘上的内容一致，且与 Node 记录的磁盘哈希一致"，不是密码学意义上"被执行的字节就是这份哈希"。真正不依赖哈希的独立性来自另外两条：配置数值与变体清单由两端各自 import 同一模块后互核，以及序列化器的函数引用同一性断言。

第一组的 `7/7` 是空集合对空集合的一致，只证明调用契约与时间戳路径可跑通；该语义由 `verification.nodeChromiumEmptySequenceContractMatch` 命名表达，脚本同时断言该变体每帧 `detectionCount` 必须为 0，否则报错。

后两组每帧固定输出 100 框、丢弃 1686 至 1894 框，两端框数与丢弃数完全相同，只有 `motion-approach` 的存活框集合不同。成因数据已随证据留存：`comparison.sequenceVariants[].minimumAdjacentScoreGaps` 记录每帧保留集合中相邻分数的最小正间隔，本次实测为 `8.26e-11` 到 `1.03e-9`。greedy NMS 在这种近平局处保留哪一个框，对 Node 与 Chromium 的 WASM 浮点尾差敏感；顺序无关哈希只能消除排序差异，无法消除“哪个框存活”的差异。

第三组的存在是为了让跟踪侧不再空转。`tests/tracker.test.ts` 之外，这是唯一用真实检测框驱动 ByteTrack 状态机的实测：`zero-threshold-lifecycle` 的活跃轨迹在七帧间为 100、100、109、116、132、100、100，`lost` 峰值 32，`removed` 每帧 41 至 132，脚本断言必须同时出现 `tracked`、`lost` 与 `removed`，否则失败。该变体把 `newTrackThreshold` 人为降到 `1e-9` 只为了让噪声分数能够建轨，不代表任何真实置信度语义。

一个值得记录的观测：单帧的存活框差异没有级联。`zero-threshold-coverage` 只有第 2 帧检测不同、七帧跟踪全一致（跟踪侧本来就无轨迹）；`zero-threshold-lifecycle` 也只有第 2 帧的检测与该帧跟踪不同，第 3 帧起两端的跟踪哈希重新逐字节一致，说明该差异没有通过轨迹状态传播下去。

本组合序列能证明的是：真实 YOLOX 输出满足 ByteTrack 的 `Detection` 输入契约（每帧 100 框量级）、时间戳与大间隔路径可跑通、跟踪状态机在真实框上确实走完 `tentative/tracked/lost/removed`、每个运行时内部完全确定、两端执行同一批 bundle 与同一份配置。它不能证明有数据的帧在两个运行时逐字节相同（6/7），不能证明任何行人精度，也不能替代 MOT17 指标评测。

Chromium 侧请求全部命中 `127.0.0.1` 本地 origin，`pageErrors` 为空，逐帧与序列级哈希记录在 `runtime-evidence.json` 的 `node.sequence.variants`、`chromium.sequences` 和 `comparison.sequenceVariants`。

## 16. 贴边检测框的浮点边界缺陷与修复

接入序列时第一帧即被跟踪器拒绝，报 `INVALID_INPUT`。根因不在算法，而在两端使用不同的浮点表述：

- 生产端 `src/yolox/decode.ts:87-99` 的 `clipBox` 用 `height = Math.min(imageHeight, …) - y0` 产出贴边框。
- 消费端 `src/tracker.ts:82`（修复前同行）用 `box.y > imageSize.height - box.height` 判断包含。

实测复现框为 `x=196.4773154358571, y=40.42656526587306, width=97.68965682453731, height=199.57343473412695`，图像高 240：`y + height` 精确等于 240，但 `240 - height` 得 `40.42656526587305`，比 `y` 小 1 ULP，于是完全合法的贴边框被判越界。

修复位于 `src/tracker.ts:28` 与 `:82`，把减法包含判定改为加法形式，容差为边界值的 `Number.EPSILON * 8`（约合边界值 15 ULP，在 240 像素上是 `4.26e-13`，在 4K 上约 `6.8e-12` 像素）。按测试先行流程，`tests/tracker.test.ts` 新增用例先复现失败（17 项中 1 项红），修复后全绿；同一用例同时钉住超出容差（`+1e-6`）的真实越界仍被拒绝。该判定由 bytetrack、ocsort、deepsort、botsort 共用 `validateFrame`，因此四算法同时受影响；`box.width > imageSize.width` 这类精确比较保持原样，未引入额外放行。

该改动只放宽“因浮点舍入落在边界附近”的接受条件，不改匹配逻辑、阈值默认值、生命周期状态机或公开返回结构。同一 320×240 合成 fixture 的单帧 detection 哈希在本轮修复前后的实测值均为 `f762c76fc4ed703fc886534b0e9b791dd2685f0ab472aa31a96f79c93687b152`；需要说明的是修复前那次运行未单独留档，此对比来自本轮会话内的两次实测，而非可回读的产物。

## 17. 候选 ESM、CommonJS 与 NodeNext 类型消费

`scripts/build-yolox-candidate.mjs` 现在输出 ESM 与 CommonJS 两份 bundle，并把 tsc 生成的 `.d.ts` 中无扩展名相对导入补成 `.js`，与正式 `scripts/build.mjs` 的处理一致。

消费检查在临时目录里安装一个本地候选包 `tracking-yolox-local-candidate`，然后：

- 用 `import` 与 `require` 实际执行工厂，断言缺少授权来源时抛 `INVALID_MANIFEST`、字节长度不符时抛 `INVALID_INPUT`；同时把 `globalThis.fetch` 换成哨兵并断言其从未被调用。需要说清这条证明力的边界：它只证明消费路径没有发生任何网络取数，不证明 ORT 内核未被加载——`src/yolox/ort.ts` 走的是动态 `import()`，哨兵拦不到；真正保证这点的是消费脚本从未调用 `load()`。
- 用 `--module NodeNext --moduleResolution NodeNext --noEmit` 检查 `.mts` 与 `.cts` 消费者，含两个 `@ts-expect-error` 负例。
- 反面对照：把已补好的声明扩展名剥掉后，同一消费者必须以 `TS2834` 失败，证明类型消费不是空过。

结果写入 `candidate-consumer-check.json`，临时消费目录在检查后删除。候选产物仍只存在于 `.tmp/yolox-module`，未进入 `package.exports`、`sdk-manifest.yaml` 或 npm 包。
