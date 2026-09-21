# 三算法与 ReID 真实画面评测（2026-09-21）

[English](README.en.md) · [协议](protocol.md) · [精简机器汇总](summary.json) · [原始官方指标](raw/metrics.json)

默认继续采用 ByteTrack。建议 0.2 版本保留 OC-SORT、DeepSORT 显式可选，PPLCNet ReID 标为人体场景实验能力；本报告不执行发布，npm、Release 和线上 Demo 仍为 0.1.0，本地为 0.2.0-alpha.0。

固定 MOT17 七段 FRCNN 训练序列的全部 5316 帧、67639 个检测，实测提交 `0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`。真实 Chromium 使用 WebGPU 提取全部检测特征，三种关联器使用 CPU/main；两次 Node 冻结输入重放与浏览器的 MOT/非计时结果全部一致，容量丢弃为 0。官方 TrackEval 七段合计如下，百分比没有按段平均。

| 算法 / Algorithm | IDF1 % | IDSW | MOTA % | FP | FN |
| --- | --- | --- | --- | --- | --- |
| ByteTrack | 48.2922 | 1101 | 44.4010 | 4169 | 57166 |
| OC-SORT | 48.4107 | 881 | 39.5434 | 6751 | 60259 |
| DeepSORT + PPLCNet | 45.4637 | 1030 | 44.7608 | 3373 | 57629 |

DeepSORT + PPLCNet 相比 ByteTrack：IDF1 低 2.8285 个百分点、IDSW 少 71、MOTA 高 0.3598 个百分点、FP 少 796、FN 多 463；无法支持替换默认。OC-SORT 的 IDSW 少 220、IDF1 高 0.1185 个百分点，但 MOTA 低 4.8577 个百分点、FP 多 2582、FN 多 3093。比较的是三套完整配置，关联机制和低分策略不同；没有 DeepSORT 禁用外观的消融，不能把差异单独归因于 ReID 模型，也不能断言 ReID 普遍无效。没有根据这些结果调参或筛选序列。

## 环境、输入和身份

Windows 11 专业版 10.0.26200、i5-10400F（6核/12线程）、RTX 5060 Ti（驱动 32.0.16.1692）、Chromium 153.0.8010.12 / Playwright 1.63.0、Node 24.16.0、ORT Web 1.27.0。请求/实际模型后端均 WebGPU、main、非 fallback；算法为 CPU/main。每段新建会话和三个跟踪器。[机器环境](validation/environment.json)、[原始身份锁](raw/identity.json)与[完整运行摘要](raw/summary.json)独立保存。

PPLCNet FP32 ONNX 为 33,704,835 字节，SHA256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`。512维特征空间绑定模型、RGB/half-pixel/白底预处理及 L2 归一化版本。图像裁剪只使用原检测框，不读 GT 身份；低分检测也提取，按至多64个一块保序，整帧成功后才 update。完整参数在原始摘要中，DeepSORT 距离门限 0.2、图库30；GT 只进入独立评分器。

| 序列 / Sequence | 帧 / Frames | 检测 / Detections | 最大单帧检测 / Max frame detections |
| --- | --- | --- | --- |
| MOT17-02-FRCNN | 600 | 8186 | 18 |
| MOT17-04-FRCNN | 1050 | 28406 | 34 |
| MOT17-05-FRCNN | 837 | 3848 | 10 |
| MOT17-09-FRCNN | 525 | 3049 | 10 |
| MOT17-10-FRCNN | 654 | 9701 | 21 |
| MOT17-11-FRCNN | 900 | 6007 | 18 |
| MOT17-13-FRCNN | 750 | 8442 | 30 |

## 逐段官方指标

| 序列 / Sequence | 算法 / Algorithm | IDF1 % | IDSW | MOTA % | FP | FN |
| --- | --- | --- | --- | --- | --- | --- |
| MOT17-02-FRCNN | ByteTrack | 39.4506 | 56 | 32.1726 | 179 | 12368 |
| MOT17-02-FRCNN | OC-SORT | 40.0708 | 57 | 31.7313 | 166 | 12462 |
| MOT17-02-FRCNN | DeepSORT + PPLCNet | 36.4522 | 77 | 31.7582 | 134 | 12469 |
| MOT17-04-FRCNN | ByteTrack | 61.6916 | 42 | 52.9764 | 273 | 22048 |
| MOT17-04-FRCNN | OC-SORT | 61.3499 | 43 | 52.6989 | 264 | 22188 |
| MOT17-04-FRCNN | DeepSORT + PPLCNet | 56.4197 | 84 | 52.7388 | 206 | 22186 |
| MOT17-05-FRCNN | ByteTrack | 50.1394 | 83 | 43.7617 | 188 | 3619 |
| MOT17-05-FRCNN | OC-SORT | 49.8162 | 63 | 39.9884 | 296 | 3792 |
| MOT17-05-FRCNN | DeepSORT + PPLCNet | 50.0584 | 75 | 43.7184 | 132 | 3686 |
| MOT17-09-FRCNN | ByteTrack | 48.7551 | 44 | 48.2441 | 168 | 2544 |
| MOT17-09-FRCNN | OC-SORT | 50.6068 | 29 | 40.9014 | 354 | 2764 |
| MOT17-09-FRCNN | DeepSORT + PPLCNet | 49.0488 | 39 | 49.9155 | 89 | 2539 |
| MOT17-10-FRCNN | ByteTrack | 22.7684 | 428 | 36.8253 | 1438 | 6245 |
| MOT17-10-FRCNN | OC-SORT | 25.4926 | 310 | 19.6199 | 2620 | 7390 |
| MOT17-10-FRCNN | DeepSORT + PPLCNet | 23.6700 | 366 | 37.2926 | 1295 | 6390 |
| MOT17-11-FRCNN | ByteTrack | 50.4042 | 77 | 46.4922 | 595 | 4377 |
| MOT17-11-FRCNN | OC-SORT | 50.9159 | 57 | 40.5468 | 847 | 4706 |
| MOT17-11-FRCNN | DeepSORT + PPLCNet | 46.9612 | 77 | 48.6117 | 420 | 4352 |
| MOT17-13-FRCNN | ByteTrack | 33.0563 | 371 | 34.1694 | 1328 | 5965 |
| MOT17-13-FRCNN | OC-SORT | 30.5650 | 322 | 18.5449 | 2204 | 6957 |
| MOT17-13-FRCNN | DeepSORT + PPLCNet | 33.0576 | 312 | 36.2996 | 1097 | 6007 |

## 实测成本

以下均为毫秒。Node 两次运行只测冻结特征后的 SDK 跟踪 totalMs，排除 ReID；Browser ByteTrack/OC-SORT 外围也仅含跟踪，不执行模型。Browser DeepSORT 外围从本地图片 fetch 开始，覆盖解码、整帧 ReID 和跟踪，独立计时。检测器、视频流水线、渲染、评分、Playwright IPC 和落盘不计入；模型加载另列。这些数值不能称为视频端到端 FPS，也不能拿 Node 吞吐量代替图像流水线吞吐量。固定串行运行顺序为浏览器 DeepSORT、ByteTrack、OC-SORT；两次 Node 重放不是独立硬件或跨进程性能实验。

| 运行 / Run | 累计 / Sum ms | 平均 / Mean ms | p50 ms | p95 ms |
| --- | --- | --- | --- | --- |
| Browser ByteTrack | 9547.600 | 1.796 | 1.500 | 4.000 |
| Browser OC-SORT | 10497.200 | 1.975 | 1.600 | 4.900 |
| Browser DeepSORT + PPLCNet | 613470.900 | 115.401 | 100.900 | 247.700 |
| Node 1 ByteTrack | 8679.482 | 1.633 | 1.387 | 3.491 |
| Node 1 OC-SORT | 9387.251 | 1.766 | 1.443 | 3.961 |
| Node 1 DeepSORT + PPLCNet | 31180.492 | 5.865 | 3.421 | 18.820 |
| Node 2 ByteTrack | 8459.654 | 1.591 | 1.337 | 3.425 |
| Node 2 OC-SORT | 9135.977 | 1.719 | 1.382 | 3.888 |
| Node 2 DeepSORT + PPLCNet | 30824.135 | 5.798 | 3.363 | 18.703 |

各段首帧为 cold，共7个；其余5309帧为 warm。会话创建和模型获取不计入首帧，首次执行可能仍含运行时编译；cold 不等于完整浏览器冷启动，也不是已有状态 warm 的加速比基线。没有额外删掉预热帧。分位数直接合并全部逐帧样本排序，p50 使用 floor((n−1)×0.5)，p95 使用 ceil((n−1)×0.95)，无插值；不平均各段分位数、不拼接阶段中位数。

| 运行 / Run | cold p50 / p95 ms (n=7) | warm p50 / p95 ms (n=5309) |
| --- | --- | --- |
| Browser ByteTrack | 0.300 / 0.500 | 1.500 / 4.000 |
| Browser OC-SORT | 0.300 / 1.000 | 1.600 / 4.900 |
| Browser DeepSORT + PPLCNet | 676.100 / 796.400 | 100.700 / 247.200 |
| Node 1 ByteTrack | 1.395 / 1.898 | 1.387 / 3.491 |
| Node 1 OC-SORT | 0.357 / 0.852 | 1.445 / 3.961 |
| Node 1 DeepSORT + PPLCNet | 1.507 / 2.401 | 3.427 / 18.820 |
| Node 2 ByteTrack | 0.252 / 0.426 | 1.338 / 3.425 |
| Node 2 OC-SORT | 0.160 / 0.309 | 1.385 / 3.888 |
| Node 2 DeepSORT + PPLCNet | 0.326 / 0.693 | 3.376 / 18.703 |

DeepSORT 外围分层成本如下。阶段是同帧独立测量，外围包含阶段间开销；外围 total 不是阶段相加。模型 extract 的子阶段、逐帧 chunk 成本和全部 cold/warm 统计保存在压缩样本与机器汇总。

| 阶段 / Stage | 累计 / Sum ms | p50 ms | p95 ms |
| --- | --- | --- | --- |
| 图片获取 / Image fetch | 31967.100 | 4.800 | 17.500 |
| 图片解码 / Image decode | 64960.300 | 13.400 | 16.800 |
| 整帧特征提取 / Frame ReID | 483360.200 | 75.600 | 204.000 |
| CPU 跟踪 / CPU tracking | 33132.900 | 3.900 | 19.600 |
| 外围实测 / Measured outer | 613470.900 | 100.900 | 247.700 |

每段本地模型字节获取和加载如下；七次外围加载累计 **9005.000 ms**，未包含在613470.900 ms的帧外围中。modelBytes 输入不读/写持久缓存，SDK modelDownloadMs/modelCacheReadMs 都为0（未执行该路径），本地 fetch 不代表公网分发性能。完整 runtime、来源、缓存和加载字段在 summary.modelLoads 中。

| 序列 / Sequence | 本地获取 / Fetch ms | 完整性 / Integrity ms | 会话 / Session ms | SDK load total ms | 外围加载 / Outer load ms |
| --- | --- | --- | --- | --- | --- |
| MOT17-02-FRCNN | 322.700 | 98.700 | 1029.100 | 1128.100 | 1460.500 |
| MOT17-04-FRCNN | 238.600 | 89.700 | 960.500 | 1050.500 | 1296.700 |
| MOT17-05-FRCNN | 160.000 | 87.400 | 995.300 | 1083.100 | 1250.000 |
| MOT17-09-FRCNN | 254.200 | 87.800 | 917.100 | 1005.300 | 1266.700 |
| MOT17-10-FRCNN | 228.500 | 87.800 | 949.800 | 1037.900 | 1273.800 |
| MOT17-11-FRCNN | 195.100 | 92.700 | 886.000 | 979.100 | 1182.700 |
| MOT17-13-FRCNN | 237.300 | 90.600 | 937.700 | 1028.600 | 1274.600 |

## 补充验证与证据边界

预先固定 MOT17-02 前30帧、433检测的 WebGPU/WASM 补充比较，向量 maxAbs=3.5762786865234375e−7、maxCosineDistance=2.7502444766014378e−12，三算法 MOT/非计时结果相同；仅为该子集一致性，不是全量 WASM 性能或精度评测。见 [比较](subset/comparison.json)和两后端原始摘要。全部正式126个浏览器/Node/MOT文件在归档时重新读取校验，hash 在 provenance.outputHashes；另有[补充48处原始摘要核验](validation/subset-output-validation.json)。[历史核验](validation/historical-validation.json)确认 ByteTrack/OC-SORT 的14份MOT与历史指标全同，历史报告不改。

[工具实施记录](validation/task-1-report.md)保存9项聚焦测试、173项单测、typecheck/build/package通过的命令与输出摘录；并非独立完整原始日志。[审查](validation/task-1-review.md)两项非阻塞 P3 原样保留：compare 未重验原摘要输出hash，本轮额外48处核验弥补；Python控制台编码在正式运行通过 PYTHONUTF8=1 / PYTHONIOENCODING=utf-8 固定。没有修改正式身份锁内脚本来事后改写运行证据。

这是固定训练集和单机观察，不是测试集榜单、官方算法移植复现或一般质量排名。没有真实手机、Safari、Firefox、Worker、NPU、跨摄像头重识别、检测器接入、视频/摄像头端到端及峰值内存证据。旧 OMZ 黑白输入和透明 PNG 解码反例仍保留。后续只有在明确用例和兼容契约成立后再设计视频调度/Workflow；发布需另获当前版本明确授权。

## 归档与复验

- `raw/`：官方 metrics、完整合并/逐段 summary、identity、评分完成日志；保留来源，不重新造分。
- `timings.json.gz`：仅完整逐帧时间字段和序列名，gzip约1.26MB；不包含媒体、完整检测/GT、向量或逐帧轨迹。
- `provenance.json`：归档前原文件SHA、计时源SHA及重新校验的正式输出SHA；文本归档统一LF，归档后SHA以 `evidence.lock.json` 为准。
- `evidence.lock.json`：本目录证据、报告、校验器的SHA256/字节数。排除锁自身以及后续 `closure/` 收尾回执，避免自引用；这些回执不作为锁定实测输入。

在 SDK 根目录运行 `node reports/2026-09-21-mot-reid/verify.mjs`，验证归档hash、完整帧覆盖、重复结果声明、逐帧累计/cold/warm/分位数、逐段与合计的 IDF1/MOTA 公式和计数相加；追加 `--current` 验证当前源码/脚本/构建仍匹配实测identity。缺少匹配dist时先构建，代码不同应使用实测提交的独立目录。该离线校验不重新运行 TrackEval、推理或跟踪，不能把hash校验称作重新评分。

真正复跑须准备锁定媒体/labels/模型/TrackEval/依赖，然后按[工具说明](../../scripts/evaluation/mot17-reid/README.md)使用新的 .tmp 输出目录执行七段、merge 与官方评分。原始媒体与轨迹只保留本机 .tmp；证据锁本身无法代替从GT重新评分。
