# PP-Tracking 首次发布整分支终审

日期：2026-09-19。结论：**整分支代码审查通过，可公开候选 PR 并继续已授权的 0.1.0 首发流程。** Critical 0、Important 0；三个既有 Minor 均明确裁定为不阻断本轮合并。门户生产合并仍须完成已经约定的目标链接与远程交付门禁，此报告不证明尚未发生的发布或线上验收。

## 审查范围

- SDK（下称 S）：`F:/git/00_chenmohan/github/web-sdk-PP-Tracking`，空基线 `193bc8825e89784023434a3923a4975b21f5f627` 至 `1b8010600e44d08faa3f17fa00c40374756e86ca`。
- 门户（下称 P）：`C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io`，`df2863ec22e73790f35fcf57c673a55afd4a1be0` 至 `2e8c4582510091956242dc245aba4e1e6881258a`，包含尚未合并的算法标准 1.2.0 基础。
- 两仓实际 HEAD 与上述冻结值相同，审查开始时工作树均干净。按指定 `requesting-code-review/code-reviewer.md` 独立审查，没有派子代理，没有修改产品、索引或分支，也没有执行远程请求或写操作；唯一新增文件为本报告。
- 阅读发布设计、标准入口及 SDK/Demo/门户/发布/治理/性能契约；结合规则、schema、整分支差异、当前最终源码和既有独立审查证据，重点审查最终跨层契约及首发可交付性。不是只审查 Task3 的文档增量。

## 已确认的实现与优点

1. **标准扩展保留模型约束。** `P/standards/v1/sdk-manifest.schema.json:165` 限定仅 1.2.0 算法分支可免模型与缓存字段，模型仍必须提供二者，分支互斥。`P/tools/sdk-standard-check/src/check.mjs:22` 将无效清单从规则豁免依据中排除；`rules.mjs:59` 无清单仍按旧模型处理。门户 `src/lib/registry/schema.ts:26` 保留七模型非空 assets，算法必须完整元数据且 assets 为空。既有七 SDK 标准回归及新增算法负例证据与该实现一致。
2. **SDK 与 Demo 契约一致。** SDK 框架无关且无生产依赖，实际 CPU/main、五项耗时、实例 ID/代次、reset/dispose 和开始前取消均明确。核对 `S/src/tracker.ts`、`assignment.ts`、`kalman.ts`：输入先校验，工作副本成功后提交；低分只续接 tracked，lost 仅高分恢复，类别隔离及容量不驱逐符合文档。核心文件自已通过的 foundation 审查以来未变；独立 NumPy 公式、门限与分配反例及状态测试的既有审查可继续适用。
3. **真实评测没有扩大结论。** `S/scripts/evaluation/mot17/evaluator.py:44` 校验固定 ZIP 身份、白名单提取，`:89` 使用固定官方 TrackEval 预处理与 Identity/CLEAR 合计；适配器不接收 GT，输出仅 observed/tracked。默认参数与低分消融固定，七段全量重复与完整 02 序列 Chromium 对齐均有归档。README、Demo、门户均未声称官方移植、测试集排名、可靠跨遮挡身份、手机支持或端到端视频速度。
4. **原数据与复现边界已经补齐。** Node 与独立 Python 的所有新增输出先约束到仓库 `.tmp`，检查真实祖先/别名和已存在目标，再下载、提取或调用评分；已有外部 ZIP/评分 checkout 保持只读。Task1 原两项 Important 已在修复复审关闭，当前 `run.mjs`、`evaluator.py` 与中英文 CLI 指南保持该修复。公开报告只含汇总与哈希，没有将基准媒体/检测/GT/逐轨输出纳入发行包。
5. **Demo 消费公开入口，状态行为可追溯。** `S/demo/src/playback.ts` 调用公开 createTracker/update/reset/dispose；原子结构校验后才替换导入序列，seek 复位后顺序重算，语言切换只改显示。真实四个算法 DOM 标记准确，浏览器归档验证实际复位和交互；算法数据处理没有复制进门户。
6. **发布失败边界明确。** `S/.github/workflows/release.yml` 先验证 tag/package 版本，再复用事件来源 CI，最后在 npm 环境构建、实际包消费和发布。`S/scripts/release.mjs:12` 仅接受结构化 E404/ENOVERSIONS 表示缺版本；已有版本必须 integrity 相同，网络/权限/损坏响应/内容不符均失败，发布接受后只重试查询。Pages 写权限仅部署 job 持有，工作流串行并从 main 构建。Trusted 配置与首版实际 provenance 分开说明。
7. **包内公开文档已经定稿。** README 中英文均为标准 `npm install web-sdk-pp-tracking@0.1.0`；快速开始、React 示例和 Demo checklist 活跃文案同步，候选历史报告未改。当前门户条目仍明确待远程核验，符合“先候选 PR、真实链接通过后再生产合并”的流程。

## 问题与三个 Minor 的合并前裁定

### Critical / Important

无。未发现需在公开候选 PR 或首发前修改的代码阻断项。

### Minor / P3

1. **静态 DOM 标记检查接受连字符后缀。** 位置：`P/tools/sdk-standard-check/src/discover.mjs:63`、`:69`、`:72`。`标记名\\b` 会接受 `data-sdk-state-reset-old` 等名称，可能导致以后缺真实属性的 Demo 通过静态检查。建议后续收紧完整属性边界并增加前缀/后缀负例。**裁定：不阻断本轮合并或首发。** 当前 Demo 四个属性准确且已有实际浏览器交互证据；标准明确静态检查不能代替运行验证。保留该已知检查器稳健性缺口，不将其误报为已修复。
2. **固定 TrackEval/NumPy 组合的弃用警告。** 位置：`S/scripts/evaluation/mot17/requirements.txt:1`、`S/scripts/evaluation/mot17/test_scoring.py:123`，实际依赖检查在 `evaluator.py:79`。既有执行报告记录 `np.float/np.int` DeprecationWarning；它增加日志噪声，但固定 NumPy 1.23.5 与官方公式评分可用，手算 fixture 及完整评分证据不受影响。**裁定：不阻断本轮合并或首发。** 无须为清日志修改上游数学或广泛过滤；以后仅在测试边界精确过滤已知上游消息，未知警告继续可见。
3. **门户既有 Astro hints 与颜色环境提示。** 位置：`P/reports/tracking/2026-09-19-release-candidate/README.md:14`、`:15`。7 条 hints 与 NO_COLOR/FORCE_COLOR 提示已如实记录，现有证据为 check 0 errors/0 warnings、构建和 e2e 通过。**裁定：不阻断本轮合并或首发。** 后续按原有代码归属清理类型提示与测试启动环境；无需为本次发布重复整套测试。

## 本次定向核验及证据边界

- 直接读取最终 tarball，重算 SHA256、sha512 与大小：`4b532782a008a5ef411d6db00fb58900884fef0c1759c15c9441d30a3093b2bb`、`sha512-0ujJfrcXoDcynzIUYQRI7pcETWT1x2t4LkEqB1D2cGQrnT8JCfk9LNrEZwAIDnBh1TLILcPmOaUbCDxsjE+tTQ==`、16541 字节，均与最终记录一致。
- tarball 13 文件；两份 README 都含正式安装命令；其余 11 文件与通过完整 verify 的前一候选逐字节相同。当前 `dist/index.js` SHA256 与 MOT17 归档 `sdk.entrySha256` 相同，支持沿用真实序列结果，不需要重新评分。
- 结构化重算七段总帧数为 5316；默认/消融各项整数合计（IDSW、FP、FN、TP、GT、Frag、IDTP、IDFP、IDFN）与逐段和相符，IDF1 公式相符；14 组确定性标记为真、容量丢弃均零；Chromium 600 帧非耗时摘要等于 Node 对应序列。默认 IDF1 0.48292219560948035、IDSW 1101，消融 IDF1 0.4834647329639305、IDSW 1066，与文档展示一致。
- 核对已有 SDK verify 原始日志：7 文件 50 单测通过、包消费通过；9 组浏览器记录 `pageErrors: []`。门户 99 单测、21 页构建、16 e2e 沿用已审查的实现报告与截图证据；未将该汇总伪装为本轮重新执行的原始日志。
- 本轮没有重跑完整 verify、大套门户测试、性能或全真实评测。最终文档变更只需包身份与链接定向验证，已有 Task3 记录相应构建/消费/链接检查。本机 LF checkout 一致仍不等于 Linux 已通过。

## 后续交付门禁与最终裁决

**允许公开候选 PR：是。允许继续 SDK 0.1.0 首发流程：是。代码合并就绪：是，仍遵守各仓 PR 最新 CI 与会话解决门禁。** 三项 Minor 均已作非阻断裁定，无需再等待本审查批准。

主代理继续完成下列已授权交付事项，它们是后续执行门禁，不是本次代码缺陷：

- SDK 候选 PR 在保护分支上通过最新 Linux CI 后合并；只发布最终固定包，保存 npm 版本、tarball 完整性及实际 provenance 状态。v0.1.0 标签、Release 与来源提交一致且不可移动；Linux 重建与已发包不一致时工作流必须失败，不放宽完整性门禁。
- 保存实际 npm Trusted Publisher 配置、Rulesets、环境、About/Homepage/topics、成功 Pages 部署和 HTTPS API 回执；本地 checker 的 17 pass / 0 fail / 7 skip 只支持 locally-compliant，不能替代远程规则证据。不要为证明未来 OIDC 首发额外发布无必要版本。
- 真实 npm/Release/Demo 链接可用后做线上 Demo 中英文与回放冒烟、实际 npm 包消费核验，更新门户候选时态、路线和日期化交付证据，随后才合并门户生产条目。若主代理为此修改产品代码，应按实际改动补充定向验证。

依据：最终代码的类型、状态、评分和发布契约一致；既有重要问题已经解决，最终包与受验证实现身份相符。剩余风险已被真实精度限制、明确设备范围及远程验收门禁限定，不能把尚未执行的线上阶段写成已完成。
