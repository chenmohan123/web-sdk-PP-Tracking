# 变更记录 / Changelog

## 0.2.0-alpha.0 — 2026-09-19（仅本地候选）

- 在同一框输入 SDK 中新增 OC-SORT 观察中心策略；`TrackerOptions.algorithm` 支持 `bytetrack` / `ocsort`，`TrackingResult.algorithm` 返回实际策略，`TrackerAlgorithm` 作为类型导出。
- Demo 可切换两种已实现算法，切换停止播放并以当前算法的有效默认参数重建；ByteTrack 低分字段与 OC-SORT 四项专属参数互斥，导出只包含已应用配置和实际算法。
- 本地 tarball、实际 ESM/CJS 消费和浏览器验证覆盖两算法；线上 npm、GitHub Release 与 HTTPS Demo 仍为 0.1.0，本条不构成远程 alpha 发布说明。

English equivalent:

- Added the OC-SORT observation-centric strategy to the same box-input SDK. `TrackerOptions.algorithm` accepts `bytetrack` / `ocsort`, `TrackingResult.algorithm` reports the actual strategy, and `TrackerAlgorithm` is exported as a type.
- The Demo switches between the two implemented algorithms, stops playback and rebuilds from algorithm-valid defaults. ByteTrack low-score fields and the four OC-SORT-specific fields are mutually exclusive; export includes only applied options and the actual algorithm.
- Local tarball, actual ESM/CJS consumption and browser verification cover both algorithms. Published npm, GitHub Release and HTTPS Demo remain 0.1.0; this entry does not announce a remote alpha release.

## 0.1.0 — 2026-09-19

- 独立CPU/main跟踪算法：高低分关联、恒速Kalman、全局分配；公开update/reset/dispose、有状态代次和稳定错误码。
- 原创合成React Demo、Vanilla公开包消费示例、双语指南；真实timestamp回放、原子JSON导入、实际结果导出、复位与seek。
- 本项目Apache-2.0。思想来源：[ByteTrack论文](https://arxiv.org/abs/2110.06864)；未复制旧实现，不是官方移植。噪声定义、毫秒生命周期和状态规则见算法指南及NOTICE。
- 无模型、ReID、Worker或GPU；不保证交叉掉头身份。ID不是个人身份。
- 固定 MOT17 七段 FRCNN 训练序列 5316 帧：默认 IDF1 48.2922%、IDSW 1101、MOTA 44.4010%、FP 4169、FN 57166；消融 IDF1 48.3465%、IDSW 1066。低分续接不是普遍精度提升；非测试集、非官方排名、非端到端视频速度。来源和评分证据见 reports/2026-09-19-mot17。
- CI、最小权限串行 Pages 与 npm 环境 OIDC 发布流程；首版手工发布后必须核对相同 tarball 完整性再跳过重复发布，provenance 以实际发布回执为准。

English equivalent:

- Independent CPU/main tracking: high/low-score association, constant-velocity Kalman, global assignment; update/reset/dispose, state generations and stable errors.
- Original synthetic React Demo, Vanilla public-package consumer and bilingual guides; recorded-timestamp playback, atomic JSON import, actual-result export, reset and seek.
- Project code is Apache-2.0. Idea source: the ByteTrack paper above. No copied legacy implementation or official-port claim. Noise, millisecond lifecycle and state differences are documented in the algorithm guide and NOTICE.
- No model, ReID, Worker or GPU. Crossing/turning identity is not guaranteed. IDs are not personal identities.
- Seven fixed MOT17 FRCNN training sequences, 5316 frames: default IDF1 48.2922%, IDSW 1101, MOTA 44.4010%, FP 4169, FN 57166; ablation IDF1 48.3465%, IDSW 1066. Low-score continuation does not universally improve accuracy. These are not test-set scores, official rankings or end-to-end video speed. Sources and scorer evidence: reports/2026-09-19-mot17.
- CI, least-privilege serialized Pages and npm-environment OIDC release workflows; a manually published first version must match tarball integrity before duplicate publication is skipped. Provenance is established by actual publication receipts.
