# 任务 2 审查：规格与质量

## 规格判定

- ✅ 规格符合。审查范围为 SDK `0194ea5..f02c9ca`、门户 `b530acb..53d9a1b`，变更仅归档、离线复验与公开文档/路线回执；没有生产 runtime、模型、阈值、manifest、版本或线上 registry 修改。SDK diff 的 40 个文件及门户 diff 的 5 个文件均在任务 2 范围内。
- ✅ 七段完整指标、两次 Node 与浏览器成本、模型加载、cold/warm 和发布判断均已归档。SDK `reports/2026-09-21-mot-reid/README.md:7`、`:33`、`:61`、`:75`、`:99` 分别提供覆盖范围、21 行逐段指标、成本边界、分位数定义和单列加载；英文镜像相同行号保持等价。
- ✅ 结论与实际数据相符：ByteTrack/OC-SORT/DeepSORT 的 IDF1 为 48.2922%/48.4107%/45.4637%；DeepSORT 的 IDSW/MOTA 局部改善不被称为整体更好，没有把配置差异单独归因模型。默认继续 ByteTrack、两策略显式可选、人体 ReID 实验状态的建议有依据：SDK `reports/2026-09-21-mot-reid/README.md:5`、`:9`、`:15`。
- ✅ 根 README、双语 performance/compatibility/reid-candidate/release-checklist 的当前段落均更新了真实序列完成状态，同时保留本地 `0.2.0-alpha.0` 与线上 `0.1.0` 的区别。参见 SDK `README.md:5`、`:11`，`docs/zh-CN/performance.md:23`、`docs/en/performance.md:23`，`docs/zh-CN/compatibility.md:20`、`docs/en/compatibility.md:20`，`docs/zh-CN/reid-candidate.md:71`、`docs/en/reid-candidate.md:71`，`docs/zh-CN/release-checklist.md:19`、`docs/en/release-checklist.md:19`。
- ✅ 门户路线与当前回执一致，只建议候选收口、版本/变更日志/发布预检和后续授权，没有执行远程发布或扩展 Workflow：门户 `docs/superpowers/plans/2026-08-17-web-model-sdk-portal-roadmap.md:13`、`docs/superpowers/plans/2026-09-13-pp-detection-multi-model-roadmap.md:7`、`docs/superpowers/specs/2026-09-19-pp-tracking-multi-algorithm-design.md:8`、`reports/tracking/2026-09-21-mot-reid/README.md:23`。
- ⚠️ 远程 npm/Release/Demo 的当前状态、手机及跨设备兼容不是这份 diff 的新验证对象；文档明确沿用历史线上状态和未覆盖边界，主线程不应把本审查升级为远程或兼容性核验。SDK `reports/2026-09-21-mot-reid/README.md:117`；门户标准 after 的 `summary.status` 为 `locally-compliant`，4 项远程 required 为 skip。

## 优点

- ✅ 精度原始值与展示值可以追溯。`raw/metrics.json:2` 固定评分器提交、实际载入文件摘要、Python/依赖与评分协议；三算法官方合计位于 `:120`、`:228`、`:336`。`verify.mjs:109` 将公开 metrics 对接原始 combined，再核对整数计数累加与 IDF1/MOTA 公式；没有平均逐段百分比。
- ✅ 计时归档保存完整逐帧数值，统计直接合并样本。`verify.mjs:19`、`:28` 定义统计与首帧划分，`:87` 将结果与公开 summary 精确比较，`:98` 至 `:105` 对接原正式摘要的逐段累计和分位数；模型加载通过 `:122` 独立对接原摘要。报告明确本地图片流水线、模型加载和冻结向量关联的区别，排除检测器/视频/渲染/评分/IPC/落盘，未伪造视频端到端 FPS：`README.md:61`、`:75`、`:99`。
- ✅ 原始输出连续性有可核对链路。`provenance.json:308` 记录 126 个正式输出摘要，`:110` 记录 49 个计时来源；七段摘要和原始身份另外锁定。审查独立读取本机来源文件，确认全部摘要及压缩计时数据对应关系，见下方检查记录。
- ✅ 离线校验边界清楚。`verify.mjs:65` 校验锁定归档字节，`:74` 校验正式身份的紧凑 JSON 摘要，`:76` 的 `--current` 只校验当前源码/脚本/构建身份，`:95` 校验重复结果声明；`README.md:126` 明说不重新运行 TrackEval、模型或跟踪器。锁排除自身和将来的 `closure/` 回执，不用后补回执修改实测证据：`evidence.lock.json:4`、`README.md:124`。
- ✅ GT 隔离和数据不分发陈述与定点源码检查相符。既有 `run.mjs:43`、`:50` 只验证/适配 seqinfo 和 det；GT 哈希作为身份元数据保留，实际 GT 字节由 `score.py:29` 至 `:37` 的独立评分阶段读取。归档压缩内容仅 sequence/browser/node 计时对象；原图、完整 GT/det、向量和轨迹没有进入本次新增文件。

## 问题

### 严重 / 重要

- 无新增阻塞问题。

### 次要

- 无本任务新增且需要修复的 P3。任务 1 既有两项 P3 原样保留于 SDK `reports/2026-09-21-mot-reid/validation/task-1-review.md:30`、`:31`；本轮固定子集 48 处原始输出核验已补足实际运行的摘要绑定，正式 Python 环境编码处理已明确记录。无需为本次归档改动实测脚本或扩大范围。
- 门户 build 的 7 个既有 hints 已在门户回执 `reports/tracking/2026-09-21-mot-reid/README.md:21` 如实列出，不能称为完全无提示；它们不来自本任务的文档变更，不构成本任务新增阻塞项。

## 审查检查与边界

- 读取任务计划、brief、实施报告与两份固定 diff。首次工具显示截断后，仅分段补读未完整显示的 diff；未再次取得 git diff、未运行 git 命令。机器证据块原本从文本 diff 省略，按下述具体风险定点读取，没有扫描生产 runtime 或上游跟踪实现。
- 因“报告表格可能转录错误”的具体风险，独立脚本从 SDK diff 的中文报告新增行提取 21 行逐段表，与 `raw/metrics.json` 的 IDF1/IDSW/MOTA/FP/FN 按展示精度逐项比较，21 行全部通过；英文相同行人工核对一致。
- 因“归档计时可能与正式原始记录脱节”的具体风险，读取 `provenance.rawTimingSources` 的全部 49 个来源，检查字节数/SHA256；解压 `timings.json.gz` 并把每段 browser 和两次各算法 node 数组与对应原 JSONL 逐项精确比较，全部通过。没有重新测量性能。
- 因“126 项正式输出核验可能只是声明”的具体风险，按 `provenance.outputHashes` 重新读取全部 126 个本机原始文件，逐项核对字节数/SHA256，全部通过。
- 因“任务 1 compare 的已知哈希缺口是否在本轮补偿”的具体风险，按两个固定子集原摘要的每次 Node 重复，核对 browser JSONL/MOT 和该次 Node JSONL/MOT，共 48 处核对通过（包括跨重复使用同一 browser 文件的核对）。子集摘要、comparison 中三算法相等声明及数值差异一致；没有扩大为全量 WASM 结论。
- 因“旧 ByteTrack/OC-SORT 精度连续性可能失效”的具体风险，读取已注明的 `.tmp/mot17-ocsort-c036be8/` 历史结果；14 份 MOT SHA 与本轮正式摘要完全一致，两算法逐段及合计 metrics 深度比较相同。
- 因“GT 隔离陈述与真实计时范围可能夸大”的具体风险，定点读取既有 `scripts/evaluation/mot17-reid/run.mjs:38` 至 `:53`、`score.py:18` 至 `:40`、`browser.mjs:24` 至 `:60`；确认实际输入读取、GT 评分阶段和 DeepSORT 外围计时终点，基线在该计时结束后执行。
- 已读取主线程最新 `verify.mjs --current` 通过 32 份证据、七段正式运行与官方 merge/score 完成的交接信息；本审查不重复执行该命令、不重跑 173 项测试、build/package 或浏览器长测。已有测试命令与输出摘录的可见范围在 `validation/task-1-report.md:21`、`:35` 和当前报告 `README.md:115` 明确，不将摘录称为完整原始日志。
- 本审查仅新增本 scratch 报告，没有修改 SDK/门户产品文件、实测源码、证据锁、index、HEAD 或分支状态。

## 质量判定

**通过。** 原始输出、逐帧计时和汇总/展示关系可复核，离线复验与正式评分边界准确，双语文档及门户候选状态一致；实际结果支持继续 ByteTrack 默认、其余显式可选及人体 ReID 实验状态的本地候选建议，不构成远程发布或泛化质量承诺。
