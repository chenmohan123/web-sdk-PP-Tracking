# BoT-SORT 公开集成与本地验收

[English](README.en.md)。日期：2026-09-22。SDK 基线 `d9cbac817b8aac8fdf02776b8a199d6627dd9040`，本地候选 `0.2.0-rc.1`；本轮不包含远程发布。

## 已完成的行为

- 根入口增加 `createTracker({ algorithm: 'botsort' })` 和严格的帧/运动类型。ByteTrack 仍为默认，三种原有算法继续可用；四算法 ESM/CJS 和 NodeNext 类型消费、无 ORT 隔离由实际 tarball 检查。
- 单 SDK Demo 保持既有工作台风格，框/外部向量模式增加 BoT-SORT、原创相机平移样例、运动回执、显式运动失败策略和可选外观参数。图像模式继续使用现有 ReID/DeepSORT。
- 输入导出 `schemaVersion: 2` 保存算法、已应用选项、完整 frameId/motion 及外观空间；跨当前算法导入按文件恢复。旧版/无版本输入继续按当前设置处理，不为外部序列补造运动或向量。
- 切换算法、应用参数和导入先校验完整序列，失败保留原会话。未应用草稿不进入导出，导入的隐藏阈值/容量在应用可见参数时保留。seek 从首帧 reset 后顺序重算，语言切换保留结果。

## 固定序列与浏览器证据

[公开入口摘要](run-summary.json)覆盖七段 MOT17 FRCNN 训练序列 **5316 帧、67639 检测，三配置各两次**。MOT 字节与历史核心相同；仅归一化版本标识后所有非耗时结果逐字对齐。0 容量丢弃。使用冻结运动与特征输入，未重跑检测器、图像估计或 ReID，也未重新读取 GT 评分。

因此[历史核心评分](../2026-09-22-botsort-core/metrics.json)仍适用于相同轨迹：identity / CMC / CMC+外观 IDF1 为 **48.2922% / 54.5850% / 55.3487%**。这不是新测试集成绩；**09 序列仍退步**，不据此替换默认算法或宣称所有场景更优。

[固定05浏览器回执](browser.json)验证公开根入口在 Chromium 153 中完整处理 837 帧，三配置 MOT/非耗时哈希与 Node 一致，并验证首帧、错误身份、取消重试、reset/dispose。跟踪耗时不包含检测、图像运动估计、ReID 推理或渲染。

[原浏览器回归](browser-regression.json)及[四算法 Demo 回执](demo-browser.json)覆盖四算法切换、平移完整播放、导入导出、运动回执、非法末帧/参数原子性、显式回退、内置外观启停、seek/reset、中英文与390px。默认框模式没有模型或 ORT 请求。截图只为桌面视口验证，不代表真实手机。

## 工程验收与修复

[完整验证日志](verify.log)和[实际包回执](package-check.json)记录构建、类型、220项单测、包消费、Demo/Vanilla/React 构建及18组浏览器流程。ORT 动态 chunk 的既有体积提示保留，不影响默认算法入口隔离。

[独立审查](review.md)发现并修复四个边界：版本2不得清洗非法特征空间字段；BoT-SORT 类型不得被赋值给旧 Tracker 以绕过 motion 必填要求；应用表单保留隐藏配置；空检测序列可从版本2选项恢复外观空间。各项均先复现再修复，并补充单测/类型或浏览器验证。

环境：Windows 11、Intel Core i5-10400F、Playwright 1.63.0 / Chromium 153.0.8010.12，关联为 CPU/main。模型字节、双源 revision、SHA 和预处理保持原值；本批没有新增 rc.1 的真实 ReID 推理、移动设备、Safari/Firefox、Worker、NPU、视频或摄像头验证。

## 完整性与复现

[来源锁](provenance.json)与[证据锁](evidence.lock.json)记录当前文件字节哈希。运行 `node reports/2026-09-22-botsort-integration/verify.mjs --local` 检查来源、报告和本地构建包。公开入口脚本为 `scripts/evaluation/botsort-core/public.mjs`，浏览器固定序列使用 `browser.mjs --public`；它们拒绝覆盖既有研究输出，重跑应使用新 checkout 与相同的冻结输入。原图、检测/GT、向量和轨迹不提交。

下一步是审核并发布 rc.1 预览，完成 npm/线上 Demo 回读后，再设计浏览器自动运动估计。当前仅本地提交，自动图像估计、视频/摄像头及跨 SDK Workflow 分阶段推进。
