# 任务 1 审查：规格与质量

## 规格判定

- ✅ 规格符合，可以进入主线程正式七段执行。审查范围为 `b87a69f..0194ea5`，仅新增独立评测工具、双语说明与针对性测试；没有生产 runtime、模型、默认阈值或旧评测行为修改。
- ✅ 固定模型大小/SHA、历史 labels 身份和固定媒体锁均有门禁；每张实际读取的图片重新验证字节/SHA/CRC，媒体覆盖固定 5316 帧：`scripts/evaluation/mot17-reid/run.mjs:29`、`:35`、`:43`、`:84`。
- ✅ 提取/跟踪只读取 seqinfo 和公开 det；GT 的实际字节只在独立评分进程读取，评分前拒绝固定子集：`run.mjs:43`、`:50`；`score.py:24`、`:29`。
- ✅ 使用实际构建和本地 ORT；请求限制在本机 origin，并验证真实后端及非软件 WebGPU：`run.mjs:68`、`:70`、`:108`；`browser.mjs:15`、`:17`、`:20`。
- ✅ 分块最多 64，完整保序并逐项验证框/分数/类别/空间/维度/有限值，失败不会推进部分帧，空帧仍 update；三个算法公共参数复用旧选择器：`core.mjs:14`、`:19`、`:30`；`browser.mjs:44`、`:49`、`:55`；`tests/mot17-reid.test.ts:13`、`:21`、`:27`、`:33`、`:38`。
- ✅ 逐帧向量落盘，Node 两次流式重放校验输入身份，三算法 MOT 与非 timing 输出均和浏览器哈希对齐；容量丢弃非零立即失败：`run.mjs:125`、`:142`、`:147`、`:160`；`browser.mjs:59`。
- ✅ DeepSORT 外围独立计时覆盖图片获取/解码/完整提取/update，基线不分摊模型耗时；模型 load 独立保留，各阶段记录与边界说明一致：`browser.mjs:10`、`:22`、`:30`、`:50`、`:53`；`README.md:48`、`:50`、`:52`。
- ✅ 合并要求七段完整、无重叠、同身份与参数，并重新验证特征和两次 Node/浏览器输出；评分调用原 API 的官方合计，没有平均百分比：`core.mjs:2`；`merge.mjs:16`、`:19`、`:21`；`score.py:37`。
- ✅ run/merge/compare 均使用新 `.tmp` 输出门禁，排他创建，拒绝已有目标及 junction 逃逸：`io.mjs:20`、`:29`；`merge.mjs:13`、`:35`；`compare.mjs:13`、`:44`。
- ⚠️ 正式七段、全部 5316 帧的浏览器执行、零容量丢弃、完整合并和官方总计尚未运行，属于已明确交给主线程的后续验证，不能以本审查或 30 帧预检代替。预检和 173 测试结果以 `task-1-report.md:35`、`:40`、`:44`、`:50` 为已有证据，未重跑。

## 优点

- `core.mjs:30` 把提取完整性与跟踪状态推进分开，65 检测、第二块失败、空帧及错位测试验证实际行为，而非只验证调用形式。
- `merge.mjs:19` 至 `:31` 在创建输出前重验实现与来源结果，支持逐段新目录恢复工作，并避免静默混用不同构建。
- `score.py:24` 和 `README.md:34` 明确区分固定 GPU/WASM 补充子集与全量评分；说明没有把训练集或冻结特征关联时间夸大成官方排名或视频端到端结果。

## 问题

### 严重 / 重要

- 无阻塞问题。

### 次要

- **P3：比较工具未把读取的浏览器输出绑定到原运行摘要中的结果哈希。** `scripts/evaluation/mot17-reid/compare.mjs:39` 至 `:42` 直接读取两侧浏览器输出生成相等性结论，只对 identity/features 做了原摘要哈希验证（`:17` 至 `:20`）。原浏览器 MOT/JSONL 若被意外编辑或截断，比较仍会成功生成结果，甚至两侧同时为空时报告相同；原 run 的浏览器/Node 一致性保证已不再适用。建议对各侧输出同时校验 `sequence.node[algorithm][0]` 的 MOT/nonTiming 哈希和 `browserEqual`，复用 merge 已有检查语义。现有已成功运行的固定输入不存在该修改证据，因此不阻塞本次正式评测。
- **P3：Windows Python 拒绝路径的中文诊断乱码。** `task-1-report.md:63` 已记录此现象；`scripts/evaluation/mot17-reid/run.mjs:176` 与 `merge.mjs:44` 的 Python 调用仅按 UTF-8 解码父进程结果，没有显式固定子进程标准流编码。建议调用 Python 时加 `-X utf8` 或设定 `PYTHONIOENCODING=utf-8`，并在复跑说明中同步；这不改变拒绝语义或 JSON 证据，但能保持故障证据可读。

## 审查检查与边界

- 读取固定 diff 一次；工具初次显示在中部截断，随后只补取被截断的 compare/core/io/merge 与 run 前半段，没有重新读取完整变更文件或重跑 git。
- 因“junction 是否真正规范化”的具体风险，定点读取既有 `scripts/evaluation/output-path.mjs:6`、`:23`，确认最近既有祖先 realpath 与归档路径保护。
- 因“公共配置是否夹带 ByteTrack 专属字段”的具体风险，定点读取既有 `scripts/evaluation/mot17/configurations.mjs:1`、`:25`，确认白名单没有 lowScoreThreshold/lowMatchIouThreshold。
- 因“评分 API 是否真正固定依赖并采用官方合计”的具体风险，定点读取既有 `scripts/evaluation/mot17/evaluator.py:65`、`:89`、`:106`，确认固定 TrackEval 提交、numpy/scipy 与 combine_sequences；没有读取上游跟踪实现。
- 因“实际构建是否有遗漏的静态本地导入”的具体风险，定点搜索 `dist/index.js` 与 `dist/reid/index.js` 的静态 import/export-from，未发现匹配；查看已有预检 `identity.json` 确认两构建入口及脚本/源码哈希已记录。第三方 ORT 本体未纳入该 identity，正式归档应保留其实际版本证据。
- 未执行测试、未修改实现或 git 状态；只写本审查报告。

## 质量判定

**通过（两项非阻塞 P3）。** 全帧输入、GT 隔离、状态推进、冻结重放和合并评分链路具备明确校验与针对性行为测试；可以继续正式执行。正式结果仍须由主线程按计划完成并归档。
