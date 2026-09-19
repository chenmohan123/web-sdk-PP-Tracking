# 开发约定

- 本仓库属于单 SDK；生产运行时框架无关，只提供已实现的 CPU/main。
- 文档、回复、提交与注释使用中文；约定的英文镜像文档保留英文。
- 修改前阅读门户 `standards/v1/README.md` 及对应契约；规范以门户为唯一来源。
- 先写失败测试再实现；数学基于独立公式，禁止读取或翻译来源义务不明的旧 Kalman/SORT 代码。
- 手工编辑使用 apply_patch；运行 typecheck、test、build、check:package 并记录证据。
- pnpm 命令统一带 `--config.verify-deps-before-run=false --config.manage-package-manager-versions=false`，复用宿主工具版本。
- SDK 完整阶段修改前后执行门户 sdk:check，保留证据及未完成项。
- 远程发布或 GitHub 修改必须有当前任务的明确授权，只在该次授权范围内执行；历史首次发布授权不构成未来无限授权。调用 gh 前复用宿主登录状态，使用后保持。
