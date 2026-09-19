# 2026-09-19 MOT17 真实检测序列评测

[English](README.en.md) · [完整汇总 JSON](summary.json) · [来源和引用](sources.json) · [复现 CLI](../../scripts/evaluation/mot17/README.md)

固定 MOT17 七段 FRCNN **训练集**，5316 帧、67639 个公开检测；默认参数未用本数据调参。这是独立 SDK 消费已有检测的算法评测，不是 MOT17 测试集成绩、官方 ByteTrack 排名、视频端到端速度或跨设备保证。

| 配置 / 序列 | IDF1 % | IDSW | MOTA % | FP | FN |
| --- | ---: | ---: | ---: | ---: | ---: |
| 默认 / 02 | 39.45 | 56 | 32.17 | 179 | 12368 |
| 默认 / 04 | 61.69 | 42 | 52.98 | 273 | 22048 |
| 默认 / 05 | 50.14 | 83 | 43.76 | 188 | 3619 |
| 默认 / 09 | 48.76 | 44 | 48.24 | 168 | 2544 |
| 默认 / 10 | 22.77 | 428 | 36.83 | 1438 | 6245 |
| 默认 / 11 | 50.40 | 77 | 46.49 | 595 | 4377 |
| 默认 / 13 | 33.06 | 371 | 34.17 | 1328 | 5965 |
| **默认合计** | **48.2922** | **1101** | **44.4010** | **4169** | **57166** |
| 低分消融 / 02 | 39.19 | 56 | 31.90 | 146 | 12451 |
| 低分消融 / 04 | 61.84 | 42 | 52.77 | 246 | 22175 |
| 低分消融 / 05 | 49.91 | 91 | 43.47 | 146 | 3673 |
| 低分消融 / 09 | 47.82 | 43 | 47.53 | 164 | 2587 |
| 低分消融 / 10 | 22.52 | 405 | 37.01 | 1359 | 6323 |
| 低分消融 / 11 | 51.12 | 77 | 46.92 | 520 | 4412 |
| 低分消融 / 13 | 33.28 | 352 | 34.82 | 1204 | 6032 |
| **低分消融合计** | **48.3465** | **1066** | **44.3405** | **3785** | **57653** |

消融只把 lowScoreThreshold 从 0.1 改为 highScoreThreshold=0.5，其余参数完全相同。默认低分续接减少 487 个 FN，但增加 384 个 FP 和 35 次 IDSW；MOTA 增加约 0.0606 个百分点，IDF1 降低约 0.0543 个百分点。低分关联并非无条件改善精度。10/13 两段默认合计 799 次 IDSW，占全部 1101 次的大部分；无 ReID、无相机运动补偿和固定运动噪声的首版仍有明显身份连续性限制，不能宣传高精度或可靠跨遮挡识别。

每段及合计指标直接由固定 MIT TrackEval `12c8791b303e0a0b50f753af204249e622d0281a` 的 MotChallenge2DBox 官方预处理与 Identity/CLEAR 计算，IoU=0.5、pedestrian、DO_PREPROC=true。GT 有效观测共 112297。未把 tentative/lost 预测算作检测；不自造 IDSW 或用序列百分比均值替代合计。评分器与 NumPy 1.23.5 / SciPy 1.10.1 的身份、实际加载源码 SHA256、数据包及各输入/输出 SHA256 均在 JSON。

SDK 核心提交 `8d4a55430fede56c395b3444fcec2098720afba0`，测量入口 SHA256 `fdd721bf78b7dc2ea3c554619418c914041971e37a2274ef3851e251997d4935`。Windows 11 10.0.26200、Intel Core i5-10400F、Node 24.16.0、CPU/main。14 组配置/序列均从新实例完整运行两次，非耗时 JSONL 与 MOT 文本逐字相同；最大单帧输入 34、最大活动轨迹 52、容量丢弃 0、无非有限框或同帧重复 ID。默认两项容量仍为 100/200。实际输入无需几何裁剪或空框剔除；378 个小数贴边框为满足严格浮点边界向内缩一个机器精度尺度，已用原创回归测试覆盖。

默认 SDK totalMs 累计 8627.59 ms，消融 8180.63 ms；Node 进程 CPU 计时（含执行器导出开销，不含文件 I/O/评分）分别 9263/8858 ms。逐段分位数和耗时在 JSON，单次顺序实测未 JIT 预热，首帧为新实例、后续有状态复用，不作为跨配置加速比。Chromium 153.0.8010.12 / Playwright 1.63.0 headless 完整 02 序列 600 帧与 Node 非耗时输出逐字一致，SHA256 为 `9990c41121d920e775fd3b259cc768954af75b52005836479de7c9f6e05f623d`；该序列 SDK totalMs 累计 1015.5 ms，p50/p95 1.6/2.4 ms。不含检测模型、媒体解码、渲染和下载。

可追溯局部检查均为默认 / MOT17-02-FRCNN：

- 帧 16 的 SDK ID 13 为 observed/tracked，17–29 为 unobserved/lost，30 恢复同一 ID，分数 0.916；这是运行时身份保留证据，不等同 GT 身份正确或物理遮挡证明。
- 官方 CLEAR 在帧 148 将 GT ID 27 的匹配从 SDK ID 19 计为 ID 23，计入 IDSW。145–149 的 visibility 约 0.483–0.623；146–147 没有与该 GT IoU≥0.5 的公开检测。145 的候选分数 0.153，148 恢复至 0.972。
- 同一 GT 在帧 167 再从 SDK ID 23 切至 25；164–168 均有 IoU≥0.5 候选，visibility 约 0.480–0.511，分数为 0.400、0.431、0.756、0.805、0.919。存在检测并不保证身份连续。

以上 IDSW 来自只读观测官方 CLEAR 累加时的局部变量；局部 IoU 检查只描述检测覆盖，不替代评分匹配。诊断脚本 `.tmp/inspect-mot17-events.py` 和本次目录 `events-r2.json` 保留在本机。没有读取或展示媒体，因此不把这些例子标为确定的交叉场景，也不将检测间断等同遮挡。

数据包 `https://motchallenge.net/data/MOT17Labels.zip`，10107022 字节，SHA256 `0aa79322e91583369f42f17c4d79a0b145380d8732487bba59272048dc82b2b9`。官方当前数据页提供公开下载；历史官方 FAQ 明确不同算法设置应在训练集比较，并要求引用 MOT16 及相应序列论文。这里据此进行本地公开基准评测，不将其描述为统一 CC 或 Apache 数据许可。MOT16、MOTChallenge 2015、05 序列 Ess 等 ICCV 2007 论文及 TrackEval 引用见 sources.json。网页快照、第三方源码及其原 MIT LICENSE、检测、GT、逐轨输出只保留 `.tmp`，公开代码、文件哈希和汇总，不公开原始基准素材。

实际命令（本机 Python/浏览器路径可按复现指南替换）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='F:/git/00_chenmohan/github/web-sdk-PP-Detection/.tmp/dependencies-compatible-browsers'
node scripts/evaluation/mot17/run.mjs --python C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io/.tmp/tracking-venv/Scripts/python.exe --zip .tmp/real-sequence-research/MOT17Labels.zip --trackeval .tmp/real-sequence-research/TrackEval --out .tmp/mot17-release-20260919-r2
```

归档 JSON 是该次原样拷贝，不会被复跑覆盖。JS 14 项定向测试通过；Python 两项测试覆盖错误哈希和四组手算官方评分 fixture；typecheck/build 通过。首次 `.tmp/mot17-release-20260919` 在浮点贴边适配上失败，未覆盖该目录；修复只涉及适配器，完整成功运行在 r2。发布建议：本轮功能门槛通过，可按既定治理与完整 verify 门禁继续首版发布，明确上述身份连续性与精度限制，不设事后挑选的分数门槛。
