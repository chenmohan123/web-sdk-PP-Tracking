# 发布准备清单

[English](../en/release-checklist.md)

基于门户 `standards/v1/templates/release-checklist.md`。当前是本地0.1.0待发布版本，不是线上合规声明。

- [x] 中文README和英文等价指南互链；算法来源、许可、输入输出、状态/reset和cold/warm已记录。
- [x] 1.2.0 algorithm清单，无model/cache；CHANGELOG包含来源、实现差异及限制。
- [x] `npm run verify` 为完整本地验证命令；CI覆盖类型、单测、包产物、Demo、示例与浏览器。
- [x] package发行文件仅dist、README、LICENSE、NOTICE和package.json，无React生产依赖。
- [x] 兼容性包含日期、OS、设备、浏览器、实际后端与runtime。
- [ ] 发布前从门户根目录运行并保存报告：`pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false sdk:check -- --repo /path/to/web-sdk-PP-Tracking --format json --out reports/tracking-check.json`。
- [ ] 用户明确授权首次远程发布范围；创建/核验仓库、npm可信发布者、GitHub About、Homepage、topics。
- [ ] API核验默认分支Ruleset：PR、最新提交CI、对话解决、防删除与强推、最小bypass。
- [ ] API核验v* tag不可更新/删除，发布tag版本必须等于package版本。
- [ ] 发布GitHub Release，release workflow验证后以OIDC发布npm；不移动已发布tag。
- [ ] Pages Source=GitHub Actions、github-pages环境、HTTPS、串行部署、最小权限，核验与commit关联的成功部署记录。
- [ ] 远程GitHub/npm/Demo链接实际可用；归档不含凭据的日期化API证据。

本地检查器将远程规则保留skip；没有required本地失败只能称locally-compliant。模型资产项不适用。清单中的待办不会自动触发任何远程动作。
