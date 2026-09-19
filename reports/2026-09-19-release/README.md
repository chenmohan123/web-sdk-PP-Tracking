# 2026-09-19 首版交付记录

本记录固定 0.1.0 首次发布使用的最终包，并分别记录已完成与待完成的远程步骤。SDK 首个 PR 和 HTTPS Demo 已交付；npm 首次发布正在等待本人安全验证，GitHub Release 与 Trusted Publishing 尚未完成。

公开 README 中英文均以版本 0.1.0 和标准 `npm install web-sdk-pp-tracking@0.1.0` 为入口，另保留本地开发流程。quick-start、React 示例、Demo checklist、manifest、CHANGELOG、compatibility 与当前实现保持一致；Demo 删除未使用的 planned 文案。算法、测试、构建与发布逻辑未修改。

包身份、定向检查与 LF checkout 对比见 [package-finalization.json](package-finalization.json)。完整 verify 沿用[前一阶段验证](../2026-09-19-release-candidate/README.md)，本次不重复完整 verify、浏览器套件或真实 MOT17 评测。历史候选包、报告与摘要保持原样，不能用历史候选摘要替代最终包。

## 已完成的远程交付

- [整分支独立审查](final-review.md) 通过，Critical/Important 为零；三个既有 Minor 已明确记录为非阻断，不冒充已修复。
- [SDK PR #1](https://github.com/chenmohan123/web-sdk-PP-Tracking/pull/1) 在最新提交的 Linux `verify` 成功后合并，来源提交 `c2ee347884426aa1a03962b76ac2915959397611`；不可变 `v0.1.0` 指向该提交。
- 默认分支、版本标签、npm/github-pages 环境、About/Homepage/topics 及 Pages Actions+HTTPS 已通过 API 回读：[治理快照](github-governance.json)。默认分支与标签均无 bypass actor。
- [Pages 部署](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35423375204) 已成功，与上述来源提交一致：[交付回执](github-delivery.json)。
- [HTTPS Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/) 通过中文默认、单步、英文切换保留状态、播放暂停、复位和 390px 中英文检查，无页面异常：[线上报告](demo/report.json)、[桌面截图](demo/desktop.png)。这仍是桌面 Chromium 153 的证据，不是手机验证。

线上脚本首次检查把包含“帧”字的文本当作数字解析，导致等待超时；仅修正验收脚本的数字提取后通过，产品源码没有因此修改。

## 待完成

npm `web-sdk-pp-tracking@0.1.0` 本人安全验证、发行包实际下载消费、Trusted Publisher 保存回执、GitHub Release 及其 Linux 完整性核对仍需完成。2026-09-19 两次首发安全验证均未在有效期内完成，CLI 的官方验证轮询以 E404 退出；没有发布成功回执，不连续自动生成新的短时验证链接。npm 账号登录本身已经成功，后续只需按服务端要求重新发起发布安全验证。

首版计划以本机认证发布，不能据配置存在声明该版本已有 OIDC provenance；门户正式条目须等上述公开链接实际可用后合并。
