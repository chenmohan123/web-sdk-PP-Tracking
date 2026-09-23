# 变更记录 / Changelog

## 0.2.0-rc.2 — 2026-09-23（预发布）

- 新增独立 `web-sdk-pp-tracking/motion` 子入口，接收相邻 `ImageData`/`VideoFrame` 并比较纯平移、稀疏光流和特征匹配。
- 新增 `/motion.html` 实验 Demo、合成对比脚本和失败原因/耗时证据；运动估计不会自动接入 BoT-SORT，也不改变 ByteTrack 默认。
- 仅形成 Windows 11 + Chromium 153 + CPU/main 的实验验证；手机、Worker、GPU/NPU、Safari/Firefox 与视频/摄像头不作兼容承诺。
- 已通过不可变标签 `v0.2.0-rc.2` 发布到 GitHub Release，并由可信发布工作流进入 npm `next`；`latest` 继续保持 0.1.0。远程回执见 [2026-09-23 预发布记录](reports/2026-09-23-release-rc2/README.md)。

English equivalent:

- Added an independent `web-sdk-pp-tracking/motion` subpath for adjacent `ImageData`/`VideoFrame` translation, sparse-flow, and feature-matching experiments.
- Added `/motion.html`, a synthetic comparison script, explicit failures, and timing evidence. Motion estimation is not automatically connected to BoT-SORT and does not change the ByteTrack default.
- Evidence covers Windows 11, Chromium 153, and CPU/main only; no compatibility claim is made for phones, workers, GPU/NPU, Safari/Firefox, video, or cameras.
- Published from immutable tag `v0.2.0-rc.2` through the trusted release workflow to npm `next`; `latest` remains 0.1.0. See the [2026-09-23 prerelease record](reports/2026-09-23-release-rc2/README.md).

## 0.2.0-rc.1 — 2026-09-22（本地准备，未发布）

- 根工厂新增 `algorithm:'botsort'` 与严格的运动帧类型，支持外部矩阵补偿和可选外观 EMA；保持 ByteTrack 默认及既有三算法语义。
- 框/外部向量 Demo 增加第四算法、合成平移和版本化运动数据导入导出，参数/导入完整校验后才替换状态；不加入自动图像估计或视频调度。
- BoT-SORT 为论文思想的独立实现；固定噪声、宽高包络等差异与09序列退步均保留。权重、来源及原ReID图像流程不变。

English equivalent:

- Added public `algorithm:'botsort'` with strict motion-frame types, external-matrix compensation and optional appearance EMA; ByteTrack remains default and existing strategies retain their semantics.
- Added a fourth algorithm, synthetic translation and versioned motion import/export to boxes/vector Demo. Full validation precedes state replacement; automatic image estimation and video scheduling are not included.
- The implementation follows paper concepts independently and documents fixed-noise/envelope differences and sequence09 regression. Weights, sources and the existing ReID image workflow remain unchanged. This version is local and unpublished.

## 0.2.0-rc.0 — 2026-09-21（仅本地发布候选）

- 从0.1升级后默认仍为ByteTrack CPU/main；新增显式OC-SORT、DeepSORT外部向量策略与可选同包 `./reid` 人体实验模块。根入口无需ORT；启用模型时安装可选peer `onnxruntime-web@1.27.0`。
- 模型保持PPLCNet ReID 0.1.0 FP32、33,704,835字节和原SHA；默认ModelScope，Hugging Face可选。许可采用官方仓库Apache-2.0，训练披露与专属权重授权边界见模型卡；权重不进入npm包。
- 2026-09-21的0.2.0-alpha.0七段5316帧真实画面评测已完成：DeepSORT+PPLCNet IDF1 45.4637%，低于ByteTrack 48.2922%；没有外观禁用消融，不能单独归因模型。旧报告保留原版本和构建hash。本轮数学、参数、模型与预处理不变，仅运行时版本标识升级，未重跑全部评测。
- 图像Demo显式标记人体ReID实验能力；视频/摄像头调度、移动真机及跨设备性能尚未验证。0.1调用方式继续可用；OC-SORT/DeepSORT需显式选择，后者要求一致FeatureSpace。
- 发布脚本预发布显式 `--tag next`、正式版 `--tag latest`；已有相同完整性版本只读核验，不修改tag。RC尚未发布，线上仍为0.1.0；候选安装、后端、撤回策略见双语RC说明。

English equivalent:

- The 0.1 default remains ByteTrack on CPU/main. Explicit OC-SORT, DeepSORT with external vectors, and the optional same-package `./reid` experimental person module are available. Root consumers need no ORT; model users install optional peer `onnxruntime-web@1.27.0`.
- PPLCNet ReID model0.1.0 remains FP32, 33,704,835 bytes with the same SHA. ModelScope is default and Hugging Face optional. Distribution relies on the official repository Apache-2.0 license; see the model card for training disclosure and weight-specific authorization limits. Weights are excluded from npm.
- The 2026-09-21 real-image evaluation used0.2.0-alpha.0 across seven sequences/5316 frames: DeepSORT+PPLCNet IDF1 45.4637%, below ByteTrack48.2922%. No appearance-disabled ablation allows attributing results solely to the model. Historical versions/hashes are retained. RC changes runtime version identifiers without changing mathematics, parameters, models or preprocessing; the full evaluation was not repeated.
- Image Demo labels person ReID experimental. Video/camera scheduling, real phones and cross-device performance remain unverified. Existing0.1 calls continue to work; OC-SORT/DeepSORT require explicit selection and DeepSORT requires a consistent FeatureSpace.
- Publication explicitly uses `--tag next` for prereleases and `--tag latest` for stable versions. An existing identical version is verified read-only without tag mutation. RC remains unpublished and online0.1.0 remains available; bilingual RC notes document installation, backends and withdrawal by a new version.

## 0.2.0-alpha.0 — 2026-09-21（仅本地候选）

以下保留分发阶段历史记录；其中当时待完成的真实MOT评测已由上方RC条目及2026-09-21评测报告补充。The following distribution-stage history is retained; the later real-MOT evaluation is documented in the RC entry and the dated evaluation report.

- 在同一框输入 SDK 中新增 OC-SORT 观察中心策略；`TrackerOptions.algorithm` 支持 `bytetrack` / `ocsort` / `deepsort`，`TrackingResult.algorithm` 返回实际策略，`TrackerAlgorithm` 作为类型导出。
- 新增消费调用者外部向量的 DeepSORT 策略、严格 `FeatureSpace`/embedding 契约、最近邻图库、运动门控、新鲜度级联和有限 IoU 后备；根入口保持CPU/main，不加载模型。
- 新增可选 `web-sdk-pp-tracking/reid` 子入口，PPLCNet人体FP32特征提取支持WASM/WebGPU；ORT1.27.0为可选peer。固定33,704,835字节模型已分发到ModelScope/Hugging Face，默认ModelScope，固定revision及SHA见模型卡；权重不进入npm。采用官方仓库整体Apache-2.0，保留训练披露范围及署名。
- 本地Demo增加图像＋调用者检测框逐帧提取/DeepSORT工作台，区分模型与CPU关联、状态复位与模型缓存清理；标准清单升级1.3 hybrid。真实同输入MOT精度、视频/摄像头调度仍待后续验证。
- Demo 可切换三种已实现算法，完整验证后原子提交导入/切换，导出实际参数、特征空间与可重新导入的帧；内置 DeepSORT 外观向量为原创合成数据。
- 本地 tarball、实际 ESM/CJS/类型消费和浏览器验证覆盖三算法；线上 npm、GitHub Release 与 HTTPS Demo 仍为 0.1.0，本条不构成远程 alpha 发布说明。

English equivalent:

- Added the OC-SORT observation-centric strategy to the same box-input SDK. `TrackerOptions.algorithm` accepts `bytetrack` / `ocsort` / `deepsort`, `TrackingResult.algorithm` reports the actual strategy, and `TrackerAlgorithm` is exported as a type.
- Added DeepSORT over caller-provided vectors with strict `FeatureSpace`/embedding contracts, nearest-neighbour galleries, motion gating, recency cascade and a limited IoU fallback. The root entry remains CPU/main and never loads a model.
- Added optional `web-sdk-pp-tracking/reid` with PPLCNet human FP32 extraction on WASM/WebGPU and ORT1.27.0 as an optional peer. The fixed33,704,835-byte model is distributed on ModelScope/Hugging Face, defaulting to ModelScope; immutable revisions and SHA are in the model card. Weights are excluded from npm. Distribution relies on the official repository's Apache-2.0 license with attribution and training-disclosure limits retained.
- The local Demo adds image plus caller-provided boxes for per-frame extraction and DeepSORT, separating model/CPU association and state reset/model-cache cleanup. The manifest uses standard1.3 hybrid. Real identical-input MOT accuracy and video/camera scheduling still require evaluation.
- The Demo switches among all three implementations, validates imports/switches before atomic commit, and exports actual options, feature space and re-importable frames. Built-in DeepSORT vectors are original synthetic data.
- Local tarball ESM/CJS/declaration consumption and browser verification cover all three algorithms. Published npm, GitHub Release and HTTPS Demo remain 0.1.0; this entry does not announce a remote alpha release.

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
