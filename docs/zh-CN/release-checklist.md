# 发布准备清单

[English](../en/release-checklist.md)

基于门户 `standards/v1/templates/release-checklist.md`。当前为 0.1.0 发布候选，不是线上合规声明；用户本轮已授权首次发布，执行与远程证据由发布阶段完成。

- [x] 中文README和英文等价指南互链；算法来源、许可、输入输出、状态/reset和cold/warm已记录。
- [x] 1.2.0 algorithm清单，无model/cache；CHANGELOG包含来源、实现差异及限制。
- [x] `npm run verify` 为完整本地验证命令；CI覆盖类型、单测、包产物、Demo、示例与浏览器。
- [x] package发行文件仅dist、README、LICENSE、NOTICE和package.json，无React生产依赖。
- [x] 兼容性包含日期、OS、设备、浏览器、实际后端与runtime。
- [ ] 发布前从门户根目录运行并保存报告：`pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false sdk:check -- --repo /path/to/web-sdk-PP-Tracking --format json --out reports/tracking-check.json`。
- [x] 用户本轮已明确授权首次发布；此授权不扩展至未来版本或无关仓库。
- [ ] 核验仓库、npm 可信发布者（release.yml / npm 环境）、GitHub About、Homepage、topics。
- [ ] API核验默认分支Ruleset：PR、最新提交CI、对话解决、防删除与强推、最小bypass。
- [ ] API核验v* tag不可更新/删除，发布tag版本必须等于package版本。
- [ ] 发布 GitHub Release；release workflow 先核对 tag，再验证并在 npm 环境以 OIDC 发布，不移动已发布 tag。首次手工 npm 发布时须保存唯一候选 SHA256/sha512 完整性；随后工作流核对已存在版本的 dist.integrity，一致才跳过。仅结构化 E404/ENOVERSIONS 表示缺版本；网络、权限、内容不一致或发布失败均失败。
- [ ] Pages Source=GitHub Actions、github-pages环境、HTTPS、串行部署、最小权限，核验与commit关联的成功部署记录。
- [ ] 远程GitHub/npm/Demo链接实际可用；归档不含凭据的日期化API证据。

本地检查器将远程规则保留skip；没有required本地失败只能称locally-compliant。模型资产项不适用。清单中的待办不会自动触发任何远程动作。

发布包使用 LF 文本换行；历史 reports 保持原始字节。候选包的实际 ESM/CJS/类型消费、SHA256、sha512 integrity 与 LF checkout 对比单独归档，不拿旧桌面报告的包大小作为新候选证据。手工首发不自动具有 provenance，未来 OIDC 申请 provenance，最终状态以 npm 回执为准。真实序列指标和局限见 [MOT17 报告](../../reports/2026-09-19-mot17/README.md)。
