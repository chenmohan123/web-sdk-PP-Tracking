# 2026-09-19 首版交付记录

本记录固定 0.1.0 首次发布使用的最终包及远程交付回执。SDK 首个 PR、npm 包、GitHub Release、HTTPS Demo、仓库治理和 Trusted Publisher 配置均已完成日期化核验。

公开 README 中英文均以版本 0.1.0 和标准 `npm install web-sdk-pp-tracking@0.1.0` 为入口，另保留本地开发流程。quick-start、React 示例、Demo checklist、manifest、CHANGELOG、compatibility 与当前实现保持一致；Demo 删除未使用的 planned 文案。算法、测试、构建与发布逻辑未修改。

包身份、定向检查与 LF checkout 对比见 [package-finalization.json](package-finalization.json)。完整 verify 沿用[前一阶段验证](../2026-09-19-release-candidate/README.md)，本次不重复完整 verify、浏览器套件或真实 MOT17 评测。历史候选包、报告与摘要保持原样，不能用历史候选摘要替代最终包。

本次文档收尾的离线标准检查分别保存为[修改前](sdk-check-task-3-before.json)和[修改后](sdk-check-task-3-after.json)报告；两次均无本地 required 失败，远程规则仍以本目录日期化 API 回执为准。

## 已完成的远程交付

- [整分支独立审查](final-review.md) 通过，Critical/Important 为零；三个既有 Minor 已明确记录为非阻断，不冒充已修复。
- [SDK PR #1](https://github.com/chenmohan123/web-sdk-PP-Tracking/pull/1) 在最新提交的 Linux `verify` 成功后合并，来源提交 `c2ee347884426aa1a03962b76ac2915959397611`；不可变 `v0.1.0` 指向该提交。
- 默认分支、版本标签、npm/github-pages 环境、About/Homepage/topics 及 Pages Actions+HTTPS 已通过 API 回读：[治理快照](github-governance.json)。默认分支与标签均无 bypass actor。
- [Pages 部署](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35423375204) 已成功，与上述来源提交一致：[交付回执](github-delivery.json)。
- [HTTPS Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/) 通过中文默认、单步、英文切换保留状态、播放暂停、复位和 390px 中英文检查，无页面异常：[线上报告](demo/report.json)、[桌面截图](demo/desktop.png)。这仍是桌面 Chromium 153 的证据，不是手机验证。
- npm `web-sdk-pp-tracking@0.1.0` 已由公开 registry 下载并完成 ESM、CommonJS、连续帧 ID、CPU/main、reset 和 dispose 实际调用；16541 字节 tarball 的 sha512 integrity 与本地唯一候选一致：[消费回执](npm-consumption.json)。首版为本机认证发布，registry 返回 `provenance: null`。
- npm 官方 CLI 保存 Trusted Publisher 配置时返回 HTTP 201；固定绑定 `chenmohan123/web-sdk-PP-Tracking`、`release.yml` 和 `npm` 环境，配置 ID 为 `da2f97a7-680c-4041-b902-26c74f639a3c`：[配置回执](npm-trusted-publishing.json)。服务端将请求的 `createPackage` 规范化为 `createPackage` 与 `createStagedPackage`；本回执未执行独立 GET，也未证明新版本已通过 OIDC 发布。
- [GitHub Release v0.1.0](https://github.com/chenmohan123/web-sdk-PP-Tracking/releases/tag/v0.1.0) 已发布，资产 `web-sdk-pp-tracking-0.1.0.tgz` 为 16541 字节，SHA256 为 `4b532782a008a5ef411d6db00fb58900884fef0c1759c15c9441d30a3093b2bb`。[Release 工作流](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35424969266) 在 Linux 重建相同包，确认 npm 已存在相同完整性版本后跳过重复发布，并成功核对 Release 资产：[Release 回执](github-release.json)。

线上脚本首次检查把包含“帧”字的文本当作数字解析，导致等待超时；仅修正验收脚本的数字提取后通过，产品源码没有因此修改。

## 状态边界

2026-09-19 早先两次首发安全验证未在有效期内完成，CLI 轮询以 E404 退出；这是发布过程历史，不再保留过期验证链接。之后的本机认证首发已有公开 registry 与实际消费回执，不再处于等待本人验证状态。

首版没有 npm provenance，Trusted Publisher 配置存在也不等于 0.1.0 通过 OIDC 发布。工作流的 `verified-existing` 成功只证明 Linux 重建、npm dist.integrity 与 Release 资产一致；未来版本是否通过 OIDC 及是否产生 provenance，必须以该版本实际发布回执为准。
