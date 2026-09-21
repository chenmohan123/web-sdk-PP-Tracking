# Tracking 0.2.0-rc.0 发布回执

[English](README.en.md)。日期：2026-09-21；这是本轮远程发布证据，历史 RC 候选和 alpha 评测归档保持原身份。

## 实际交付

- [PR #3](https://github.com/chenmohan123/web-sdk-PP-Tracking/pull/3) 经最新提交 CI 合并。不可变标签 `v0.2.0-rc.0` 指向 `041686f6c335a66dbe1f3796d6be5b5ae908c2cb`。
- [GitHub 预发布](https://github.com/chenmohan123/web-sdk-PP-Tracking/releases/tag/v0.2.0-rc.0) 和 [npm RC](https://www.npmjs.com/package/web-sdk-pp-tracking/v/0.2.0-rc.0) 已发布；`next=0.2.0-rc.0`，`latest=0.1.0`。
- [发布工作流 35574391794](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35574391794) 的 prepare、verify、publish 全部成功；本次是实际 OIDC 新版本上传，区别于 0.1.0 的 verified-existing。
- [Pages 工作流 35574347075](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35574347075) 从同一提交成功部署 [HTTPS Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)。这是发布提交的快照，后续纯文档提交可能触发更新部署。

## 唯一公开包

最终包为 46,274 字节，解包 152,483 字节。SHA256 为 `fe42d3ee4c5626ad823e8bd16288b079d6bd7dfd07e79fcff4e987ead8509e12`；sha512 integrity 为 `sha512-PF+ZyXJwoRQwnxWOd6tJyWLjZB2ICXsWlhEIlCYO27CEMCO7yvKAJt13KSARq+/pZ2Jzrdqc/tHC2dwLk1pTbA==`。公开 registry 下载与最终候选逐字节相同，见 [package-check.json](package-check.json) 和 [registry/version.json](registry/version.json)。本轮 README 定稿改变了包字节，不能拿此前候选归档的 46,313 字节哈希代替。

隔离消费者从公共 registry 安装精确版本、未安装 ORT，`npm audit signatures` 验证 1 个 registry signature 和 1 个 attestation，见 [npm-signatures.log](npm-signatures.log)。[公开 attestation](registry/attestations.json) 中的 SLSA subject 对应相同 SHA512，workflow 为本仓库 `.github/workflows/release.yml`、`refs/tags/v0.2.0-rc.0`、提交 `041686f…`，invocation 对应上述发布 run。

## 验证范围

- 最终产品变更通过完整 verify：176 项单测、ESM/CJS/NodeNext 类型与无 ORT 包消费、Demo/示例构建、12 组浏览器交互。CI 的干净安装曾因 protobufjs 未声明构建策略失败；检查其仅提示版本约束的 postinstall 后，显式设为 `false`，干净安装和 PR CI 均通过，未放宽全局策略。
- 线上 [online/report.json](online/report.json) 核对 HTTPS、RC 品牌、npm 精确链接、三算法单步、默认无模型请求、真实 ModelScope/WASM 与 Hugging Face/WebGPU 会话、语言与 390px 布局、取消、非法输入不推进、来源/后端切换复位与缓存隔离；浏览器错误为空。
- 环境为 Windows 11 10.0.26200、i5-10400F、RTX 5060 Ti（驱动 32.0.16.1692）、Chromium 153.0.8010.12 / Playwright 1.63、ORT 1.27.0。390px 仅桌面视口。人工图像验证会话与流程，不作为质量评测。
- 标准检查前后均无 required 本地失败（21 pass、4 远程 skip）；[remote/queries.json](remote/queries.json) 记录本轮只读 API：默认分支 PR/最新 CI/对话解决/防删除强推、无 bypass；`v*` 标签防更新删除；Pages Actions/HTTPS、受保护源码与成功部署均回读。

ByteTrack 仍为默认，OC-SORT/DeepSORT 可选，人体 ReID 为实验能力。模型身份、双源 revision 与许可边界见 [RC 说明](../../docs/zh-CN/releases/0.2.0-rc.0.md)。历史七段 5316 帧评测未重跑；不扩展手机、NPU、Worker、视频/摄像头调度或跨 SDK Workflow 声明。ORT 可选资源首启体积提示保留。

复现脚本见 [scripts/](scripts/)，仅消费公开元数据、运行浏览器及读取宿主 gh 登录，不含凭据。发布后归档提交不改 npm 包、模型或 runtime，也不覆盖标签。
