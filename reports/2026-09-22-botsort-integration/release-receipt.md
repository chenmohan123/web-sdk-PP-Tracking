# PP-Tracking 0.2.0-rc.1 发布回执

日期：2026-09-22。此回执补充集成验收报告，记录其后的远程发布与回读；原报告保留发布前的时间点事实。

- SDK PR [#6](https://github.com/chenmohan123/web-sdk-PP-Tracking/pull/6) 已合并，合并提交为 `ea20757c0ddb0a3c387981e9b57e8ea6d247e7f8`。
- 不可变标签 [`v0.2.0-rc.1`](https://github.com/chenmohan123/web-sdk-PP-Tracking/releases/tag/v0.2.0-rc.1) 指向该合并提交，GitHub Release 为预发布。
- 发布工作流 [35711667585](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35711667585) 的 `prepare`、`verify`、构建/包检查和 OIDC 发布均成功。
- npm [`web-sdk-pp-tracking@0.2.0-rc.1`](https://www.npmjs.com/package/web-sdk-pp-tracking/v/0.2.0-rc.1) 已发布，`next` 指向 rc.1，`latest` 保持 0.1.0。
- registry tarball 的 SHA-256 为 `bf6d3463422e7c66d57dbfed9cafad6e1fb7be77ace11b72735d0bbc48b7bd97`，与本地固定 tarball 一致；npm packument 提供 SLSA provenance 声明。
- Pages 部署 [35711334750](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35711334750) 成功。线上 Demo 已回读 `0.2.0-rc.1`、四种算法和 BoT-SORT 入口。

发布没有扩大兼容范围：仍只声明已记录的 Windows 桌面 Chromium CPU/main 证据；手机、视频/摄像头自动调度、Safari、Firefox、Worker、NPU 和真实端到端速度未验证。
