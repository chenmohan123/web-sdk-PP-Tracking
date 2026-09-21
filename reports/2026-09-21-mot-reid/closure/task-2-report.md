# 任务2实施报告：真实评测归档与发布判断

状态：已完成，两个工作树提交后均干净。仅本地提交，无远程修改、发布或外部消息；未改生产runtime、正式评测工具、模型、默认参数、manifest、package版本或旧历史报告。

## 本地提交

- SDK：`f02c9ca1b82089fc968b1e9ef06f684d036c1b06`，中文说明“归档三算法真实画面评测与候选发布判断”；40文件，归档约2.95MB（包括此前已有媒体身份锁）。实测核心仍是`0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`。
- 门户：`53d9a1b4098cc5e2f628fff75451d759bc4f03da`，中文说明“同步Tracking真实评测结论与0.2候选路线”；仅两总路线、Tracking多算法设计、当前回执、主线程生成的sdk:check after，共5文件。

## 实际归档内容

SDK `reports/2026-09-21-mot-reid/`新增中英文README、英文协议及正式阶段协议增补；21行逐段指标、官方七段合计、完整/首帧/后续帧的两次Node和浏览器耗时表、模型加载表。

原metrics/summary/identity/评分完成日志、七段摘要、GPU/WASM固定30帧摘要与比较、机器环境、历史输出核验、48处补充输出核验、任务1实施与审查记录均已归档。文本统一LF，原始文件hash和归档来源见provenance；归档后的字节摘要见evidence.lock。

`timings.json.gz`为1,259,934字节，仅包含正式全部逐帧计时与序列标识，不含媒体、完整det/GT、embedding或逐帧轨迹。正式126个浏览器/Node/MOT输出在归档时重新读取校验原summary hash，逐项摘要保存在provenance.outputHashes。完整输入、向量和轨迹仍只在既有.tmp。

`verify.mjs`离线校验32份文件字节/SHA、原identity语义摘要、5316帧覆盖/67639检测/0容量丢弃、重复输出声明、逐帧sum/cold/warm/p50/p95、逐段与官方合计IDF1/MOTA公式及整数计数相加；`--current`另核对当前源码/脚本/dist身份。它不重新运行TrackEval、模型或跟踪器。未把hash校验说成重新官方评分。

evidence.lock排除自身和未来`closure/**`收尾回执，避免自引用；后续任务审查/整体审查可放closure并在门户保存独立回执，不应重写锁定实测证据。任务1报告/审查已放validation且锁定。

## 独立复算结果

- ByteTrack IDF1/IDSW/MOTA/FP/FN：48.29221956% /1101 /44.40100804% /4169 /57166。
- OC-SORT：48.4107408% /881 /39.54335379% /6751 /60259。
- DeepSORT + PPLCNet：45.46372506% /1030 /44.76076832% /3373 /57629。
- Node第1次SDK totalMs累计：8679.482000003 /9387.251300001 /31180.491900000。
- DeepSORT浏览器独立外围：613470.900000334ms，mean115.400846501ms；全量p50/p95=100.900/247.700ms。
- cold为每段首帧共7帧，p50/p95=676.100/796.400ms；warm5309帧为100.700/247.200ms。没有额外剔除预热帧。
- imageFetch31967.100ms、decode64960.300ms、featureExtract483360.200ms、tracking33132.900ms；外围total独立测量，不由阶段相加。
- 模型外围加载七次累计9005.000ms另计；本地modelBytes路径不是公网下载或缓存性能。所有这些都不是视频端到端FPS。

## 文档与路线判断

SDK README与中英文performance/compatibility/reid-candidate/release-checklist更新了“真实时间序列仍待评测”的当前句子，旧历史记录保留。门户两总路线和多算法设计以新回执为最新状态，生产registry仍指向0.1.0。

真实评测门槛完成，建议进入0.2本地候选收口；ByteTrack保持默认、OC-SORT/DeepSORT显式可选、ReID人体场景实验能力。当前DeepSORT组合不支持替换默认。三套完整配置不是禁用外观的消融，不能把IDF1下降单独归因模型或宣称ReID普遍无效。后续先候选版本/变更日志/预检，再取得本版本发布授权。没有新增手机、跨设备、视频端到端或Workflow声明。

## 验证记录

1. `node reports/2026-09-21-mot-reid/verify.mjs --current`退出0：32份归档SHA、5316帧/cold/warm/分位数、三算法公式、当前实现/构建身份全部通过。
2. 初次校验发现identitySha256口径应按正式run/merge的`sha256(JSON.stringify(identity))`，不是pretty JSON文件字节；仅修正新归档校验器，保留原始identity不变。文件字节另外由evidence.lock固定，之后验证通过。
3. SDK14份新/修改公开Markdown中的128个本地链接实际存在。SDK与门户`git diff --check`、两仓库`git diff --cached --check`退出0。
4. 暂存后对evidence.lock全部32项读取`git show :<path>`重新计算SHA，与工作树归档锁全部相同，证明LF在Git字节中稳定，gzip按二进制保存。
5. 主线程已实跑门户build：0errors/0warnings/7既有hints、21页。7 hints为旧reports脚本类型4项和Zod弃用3项，与本轮文档无关，没有扩大修复范围。
6. 主线程已实跑sdk:check after：21 required通过、0失败、4远程skip、recommended3通过；报告已随门户任务2提交。
7. 本任务没有重跑重型浏览器、173项测试或build/package；这些是任务1报告以及主线程正式七段运行证据，未混称为任务2新执行。
8. 提交后SDK和门户`git status --short`均为空。只暂存明确文件，未操作原用户工作树或删除旧scratch。

## 已知问题和边界

没有新增阻塞项。任务1两项非阻塞P3原文保留：compare不再核验原摘要输出hash，本轮48处独立核验已补偿；Python中文诊断编码在正式运行由PYTHONUTF8/PYTHONIOENCODING固定，未事后修改评测源码。官方评分日志仅保存完成行，测试证据是任务1命令与输出摘录，未伪称存在独立完整原始日志。

本地归档/公式复验不取代从GT重跑官方评分；原媒体和逐帧输出不公开。此处无跨设备、测试集排行榜或一般质量承诺，透明PNG/旧OMZ反例和历史报告不改。
