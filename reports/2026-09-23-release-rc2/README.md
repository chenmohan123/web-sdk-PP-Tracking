# 2026-09-23 `0.2.0-rc.2` 预发布回执

本记录归档 PP-Tracking 运动估计实验候选的远程交付结果。候选来自合并提交 `a262e0e40039b17b83332ea8b18ca994ab4dbc88`，标签为不可变的 `v0.2.0-rc.2`。本版本进入 npm `next`，不改动 `latest`。

## 远程结果

- [SDK PR #8](https://github.com/chenmohan123/web-sdk-PP-Tracking/pull/8) 和门户 [PR #52](https://github.com/chenmohan123/chenmohan123.github.io/pull/52) 均在 CI 通过后合并。
- [GitHub Release v0.2.0-rc.2](https://github.com/chenmohan123/web-sdk-PP-Tracking/releases/tag/v0.2.0-rc.2) 为预发布，目标提交与 SDK 合并提交一致。
- [可信发布工作流](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35820131859) 成功完成：prepare、完整 verify、npm 构建/包检查和 OIDC 发布门禁均通过。
- npm `web-sdk-pp-tracking@0.2.0-rc.2` 已可见，`dist.integrity` 为 `sha512-X+iwLoxu865pr//nHFDHMsN9q1u3ej4X9IvWC9juDduprWiMNgTR/vgStHfwNjJ13iqTItTaUhuOqCZsxId82Q==`，公开 tarball 为 `https://registry.npmjs.org/web-sdk-pp-tracking/-/web-sdk-pp-tracking-0.2.0-rc.2.tgz`。
- npm dist-tags 回读为 `latest=0.1.0`、`next=0.2.0-rc.2`；稳定入口保持不变。
- [独立 Demo 部署](https://github.com/chenmohan123/web-sdk-PP-Tracking/actions/runs/35820030775) 成功；线上 [`/motion.html`](https://chenmohan123.github.io/web-sdk-PP-Tracking/motion.html) 返回 HTTP 200 并加载 rc.2 资源。

## 实验边界

运动估计仍是独立 `web-sdk-pp-tracking/motion` 子入口，默认跟踪器保持 ByteTrack，不自动接入 BoT-SORT。640×360 本地 benchmark 为 translation 成功率 41.7%、p95 15.5 ms；sparse-flow 成功率 33.3%、p95 71.8 ms；feature-match 成功率 41.7%、p95 191.1 ms。上述数据属于实验候选证据，不扩展为手机、Worker、GPU/NPU、Safari、Firefox、视频或摄像头兼容承诺。

本候选包的本地 SHA-256 为 `b52419f5d6c4fdc64a5457c1a2806ad7d67d915fae2f172a0e9277b1d07a4604`；registry 的公开完整性以 [npm 回执](npm.json) 中的 `dist.integrity` 为准。

结构化回执见 [release.json](release.json) 和 [npm.json](npm.json)。
