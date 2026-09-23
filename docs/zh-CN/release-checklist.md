# 发布准备清单

[English](../en/release-checklist.md)

2026-09-23 `0.2.0-rc.2` 已完成完整 verify、Motion 实验验证和包完整性核对，并通过不可变标签、GitHub Release、npm Trusted Publishing 与独立 Demo 部署；详见[预发布回执](../../reports/2026-09-23-release-rc2/README.md)。npm `next` 指向 rc.2，稳定 `latest` 仍为 0.1.0。

2026-09-22 的 [0.2.0-rc.1](releases/0.2.0-rc.1.md) 集成了四算法与运动导入导出；[本轮验收](../../reports/2026-09-22-botsort-integration/README.md)单独记录公开包、桌面浏览器和固定序列对齐。rc.1 的历史记录与 rc.2 发布回执分开保留。

基于门户 `standards/v1/templates/release-checklist.md`。2026-09-22 的 rc.1 历史记录和本轮 rc.2 预发布回执分别保留，不覆盖既有真实序列证据。

## 当前混合SDK候选

模型与真实序列的历史证据仍属于 alpha 阶段；RC 的最终 tarball、线上浏览器、标准检查与远程交付独立归档于[rc.2 发布回执](../../reports/2026-09-23-release-rc2/README.md)，不改写历史包身份。当前功能与限制见[rc.2 说明](releases/0.2.0-rc.2.md)。

- [x] 默认根入口提供三种CPU/main跟踪算法；可选 `./reid` 独立导出ESM/CJS/types，ORT1.27.0为optional peer，根调用者无需引擎。
- [x] 固定FP32模型已分发到ModelScope/Hugging Face，默认ModelScope；固定revision、bytes、SHA及匿名回读证据见[阶段报告](../../reports/2026-09-21-reid-distribution/README.md)。
- [x] 模型卡保留官方仓库整体Apache-2.0采用依据、转换署名和训练披露缺口；parameterCount为null。
- [x] 1.3 hybrid清单、Demo完成标准after、完整verify和真实生产构建浏览器验收，见当前阶段报告。
- [x] 最终实际tarball消费、无ORT隔离与完整性已归档。
- [x] 当前候选通过最终独立审查与修复范围复审；三项Minor已修复，ORT惰性资源成本按报告保留。
- [x] 本版本经 PR #3、最新提交 CI、合并及不可变标签发布；npm next、公开包哈希、OIDC provenance 签名与线上双源/双后端 Demo 已验证。

- [x] [三算法真实画面评测](../../reports/2026-09-21-mot-reid/README.md)已完成5316帧/67639检测、官方七段合计、逐段指标、浏览器/两次Node一致、零容量丢弃与完整成本归档。

当前 0.2.0-rc.2 已完成预发布：ByteTrack 保持默认，OC-SORT/DeepSORT/BoT-SORT 显式可选，ReID 与运动估计为实验能力。视频/摄像头调度与跨设备兼容仍待独立设计验证。

## 历史交付与基础检查

以下远程勾选项只记录0.1.0于2026-09-19的交付状态；本地通用检查须由上方当前阶段证据确认。

- [x] 中文README和英文等价指南互链；算法来源、许可、输入输出、状态/reset和cold/warm已记录。
- [x] 0.1.0使用1.2.0 algorithm清单，无model/cache；后续候选的CHANGELOG另记三算法与ReID变更。
- [x] `npm run verify` 为完整本地验证命令；CI覆盖类型、单测、包产物、Demo、示例与浏览器。
- [x] package发行文件仅dist、README、LICENSE、NOTICE和package.json，无React生产依赖；本地实际tarball已消费三种算法的ESM/CJS/类型声明。
- [x] 兼容性包含日期、OS、设备、浏览器、实际后端与runtime。
- [x] 已从门户根目录运行修改前后检查并保存独立报告；本地 required 失败为 0，远程规则仍由 API 回执核验。
- [x] 用户本轮已明确授权首次发布；此授权不扩展至未来版本或无关仓库。
- [x] 仓库、npm Trusted Publisher（release.yml / npm 环境）、GitHub About、Homepage、topics 已核验并归档。
- [x] 默认分支 Ruleset 已通过 API 核验：PR、最新提交 CI、对话解决、防删除与强推、无 bypass actor。
- [x] `v*` 标签 Ruleset 已通过 API 核验不可更新/删除；`v0.1.0` 与 package 版本一致并指向合并提交。
- [x] GitHub Release 已发布；首版 npm 由本机认证发布并保存唯一候选 SHA256/sha512 完整性。后续工作流在 Linux 重建后确认已有版本 dist.integrity 一致，安全跳过重复发布；本次结果是 `verified-existing`，不是通过 OIDC 发布新版本。
- [x] Pages Source=GitHub Actions、github-pages 环境、HTTPS、串行部署、最小权限及提交关联的成功部署记录已核验。
- [x] GitHub、npm 与 HTTPS Demo 链接已实际核验，日期化回执不含凭据，见[首版交付记录](../../reports/2026-09-19-release/README.md)。

本地检查器将远程规则保留skip；没有required本地失败只能称locally-compliant。模型资产项对当前hybrid候选适用，不能沿用历史algorithm豁免。待办不会自动触发远程动作。

当前[可选ReID模块](reid-candidate.md)已随 RC 发布，配套真实双源、许可说明与 1.3 hybrid 清单；模型依旧保持实验状态。

0.2.0-rc.2 的多算法、外部向量与 Demo 采用独立预发布流程；上述远程勾选项只记录 0.1.0 历史事实，不能替代 rc.2 发布回执。

发布包使用 LF 文本换行；历史 reports 保持原始字节。最终包的实际 ESM/CJS/类型消费、SHA256、sha512 integrity 单独归档，不拿旧报告的包大小作为最终证据。首版本机认证发布的 provenance 为 null；本次 RC 已通过 Trusted Publishing 实际上传并验证 attestation，见本轮回执。真实序列指标和局限见 [MOT17 报告](../../reports/2026-09-19-mot17/README.md)。
