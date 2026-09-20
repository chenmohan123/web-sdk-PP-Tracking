# 发布准备清单

[English](../en/release-checklist.md)

基于门户 `standards/v1/templates/release-checklist.md`。0.1.0 已于 2026-09-19 完成首次发布与日期化远程核验；本清单不承诺未来版本或未验证环境继续满足相同状态。

- [x] 中文README和英文等价指南互链；算法来源、许可、输入输出、状态/reset和cold/warm已记录。
- [x] 1.2.0 algorithm清单，无model/cache；CHANGELOG包含 ByteTrack、OC-SORT、DeepSORT 来源、实现差异及限制。
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

本地检查器将远程规则保留skip；没有required本地失败只能称locally-compliant。模型资产项不适用。清单中的待办不会自动触发任何远程动作。

以上 algorithm 清单只覆盖发行核心。[ReID 源码候选](reid-candidate.md)单独构建、尚未加入 npm exports/dist；其浏览器证据不能替代正式模型源、许可说明或 Demo 验收。启用公开模型入口时，必须同步启用标准1.3.0 hybrid声明和模型发布门槛，不得继续用纯algorithm豁免模型要求。

0.2.0-alpha.0 的三策略、外部向量与 Demo 变更仍是本地候选，未执行 push、Release、npm 发布或 Pages 部署；上述远程勾选项只记录 0.1.0 历史事实，不能作为该 alpha 已发布的证据。

发布包使用 LF 文本换行；历史 reports 保持原始字节。最终包的实际 ESM/CJS/类型消费、SHA256、sha512 integrity 与 LF checkout 对比单独归档，不拿旧桌面报告的包大小作为最终证据。首版本机认证发布的 `provenance` 为 `null`；Trusted Publisher 仅已保存配置，未来 OIDC 发布尚未由新版本实测，最终状态须以对应版本 npm 回执为准。真实序列指标和局限见 [MOT17 报告](../../reports/2026-09-19-mot17/README.md)。
