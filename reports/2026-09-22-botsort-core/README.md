# BoT-SORT 外部运动矩阵核心验收

[English](README.en.md)。日期：2026-09-22。本地核心候选 `0.2.0-rc.0+botsort-core.1`，基线提交 `99928c639d84f30efcd5b4686d9e7144c5b818e5`。本轮已把一次性探针转为有明确契约、可独立构建/消费/测试的同包核心；尚未增加公开第四算法或发布版本。

## 已实现

- `src/botsort/` 提供 `createBoTSortTracker`、严格帧/运动矩阵校验、预测后补偿、可选外观门控/EMA和独立候选身份。通过内部策略接口复用原跟踪引擎，未复制整套运行时。
- from/to绑定上一成功处理帧与当前帧的ID/时间。首帧/reset专用initial；estimated、identity、unavailable有明确区别。失败默认报错，显式identity降级仍报告原失败原因；seek、尺寸变化和大间隔要求reset。
- 输入/取消/数值错误不推进状态，首帧和空状态同样校验；dispose幂等、实例隔离、输入与返回值隔离。可选外观一条EMA，低分不使用或更新外观；根入口不加载候选或图像引擎。
- [中文候选API与可运行示例](../../docs/zh-CN/botsort-candidate.md)和英文镜像说明矩阵范围、来源、坐标、耗时及论文差异。输出算法为botsort，cpu/main，版本含`+botsort-core.1`；不冒充已发布RC新增能力。

## 固定序列与评分

沿用[上一研究](../2026-09-21-botsort-feasibility/README.md)的MOT17七段FRCNN训练序列、5316帧/67639检测、原图估计矩阵与PPLCNet 512维冻结向量。没有重跑检测器、图像运动估计或ReID。每段先核验检测、尺寸、矩阵/向量SHA，逐帧核对检测身份/时间/特征空间；GT仅独立评分进程读取。

三配置**各完整运行两次**，MOT及所有非耗时输出哈希一致，0容量丢弃。CMC与CMC+外观的21份轨迹（含7份恒等）与前期探针对应文件逐字一致；恒等候选逐帧轨迹/移除/代次对齐当前共享核心ByteTrack，七份MOT又对齐历史基线。

固定官方TrackEval、pedestrian预处理及IoU0.5，评分前再次核验GT和21份实际MOT哈希，使用官方合并计数。全部逐段/合计结果与前期研究相等，见[metrics.json](metrics.json)。

| 配置 | IDF1 ↑ | IDSW ↓ | MOTA ↑ | FP | FN |
| --- | ---: | ---: | ---: | ---: | ---: |
| identity（原基线等价） | 48.2922% | 1101 | 44.4010% | 4169 | 57166 |
| cmc | 54.5850% | 519 | 47.7163% | 2754 | 55440 |
| cmc-reid | 55.3487% | 489 | 47.7804% | 2734 | 55418 |

[运行摘要](run-summary.json)记录两次轨迹/非耗时SHA与耗时。Node两次全序列跟踪累计分别为：恒等9056.92/8905.07 ms、CMC 9762.91/9062.65 ms、CMC+外观11934.59/11615.69 ms。仅校验、预测/补偿、关联及状态更新，不含上游图像/模型成本；两次数字不构成稳定性能统计，不能以小差异或旧报告数字推断加速比。

[Chromium 153回执](browser.json)：完整05序列837帧，三配置MOT与所有非耗时结果都与Node一致；首帧拒绝、from错误、取消重试、reset及dispose通过，无pageerror。矩阵和向量均冻结，未验证浏览器图像估计/模型推理、物理摄像头或手机。

## 09退步的进一步定位

冻结参数、同一525帧检测与原矩阵，只改变矩阵应用方式；没有根据GT调参。见[消融摘要](ablation-summary.json)及[评分](ablation-metrics.json)。

| 矩阵方式 | IDF1 | IDSW | MOTA |
| --- | ---: | ---: | ---: |
| 恒等 | 48.7551% | 44 | 48.2441% |
| 仅原矩阵平移项 | 45.8248% | 40 | 48.8263% |
| 完整矩阵 | 45.2744% | 45 | 49.6901% |

退步并非仅来自宽高旋转包络：只保留平移时IDF1仍下降2.9304个百分点；完整矩阵再低0.5504个百分点，但MOTA更高。该段估计运动很小，524次平移中位0.1014px、p95 0.4531px，旋转中位0.002407°、scale中位1.000012。说明近静止情况下微小变换也可能改变关联并影响身份连贯性；**没有真实相机运动真值，不能确定它们都是估计噪声，也尚未定位所有具体ID分裂事件**。下一次估计器设计应验证静止判定、置信和不同序列，不能只为09加阈值或默认关闭补偿。仍不替换ByteTrack默认。

## 工程验证与边界

- 208项测试（原176+新增32）通过。新增测试实际覆盖几何/协方差、首帧/空状态非法矩阵、身份/跳帧/取消/重试/reset/尺寸/失败降级、实例隔离、门控、EMA及低分不污染。先运行失败占位测试，再实现；RED日志保留。
- 完整`pnpm verify`通过：typecheck、测试、ESM/CJS构建、真实npm pack/类型消费、Demo与Vanilla/React构建、原Demo 12组浏览器流程；旧390px中英文布局与导入/导出也通过。模型引擎动态chunk仍有原有>500kB构建提示。
- [候选构建回执](build-result.json)证明ESM/CJS及NodeNext `.mts/.cts`类型实际消费；正式包根exports保持三算法与可选ReID，候选仅构建于`.tmp/botsort-core/build`。
- 独立审查核心无阻塞；关于“大间隔/矩阵检查顺序”的轻微设计描述已同步实际拒绝顺序。后续审查发现消融没有核验当前bundle与主评测哈希，已补断言，并在新`ablation-verified`目录重跑和评分；浏览器也补adapter哈希及完整运行检查，在新文件保存回执。原始结果保留，核心算法/参数未改。
- 图像估计不确定性未建模；连续旋转包络会增大。仍沿用项目秒级固定噪声/生命周期，与论文尺寸噪声、宽高映射及部分关联细节不同，非官方BoT-SORT逐值复现。来源/许可沿用前期固定论文与来源锁；未读取/复制第三方跟踪实现。

## 证据与复现

[最终验证回执](validation.json)汇总 SDK、候选和门户检查；[独立审查回执](review.md)记录发现、修复与复查范围。

[provenance.json](provenance.json)固定31份源码/脚本/文档/依赖文件哈希，记录环境与旧输入证据；[完整性锁](evidence.lock.json)固定报告文件。运行 `node reports/2026-09-22-botsort-core/verify.mjs --local` 可核对源码、构建物、原始标签/特征/矩阵与所有输出字节。原图、检测/GT、向量和逐帧轨迹不提交。

完整重跑用新checkout并按旧研究准备相同本地输入；先`pnpm build`、`node scripts/build-botsort-candidate.mjs`，再运行`node scripts/evaluation/botsort-core/run.mjs`。评分为固定Python执行`score.py --trackeval <固定干净TrackEval目录>`；消融先`ablation.mjs`再`score.py --run ablation-verified --trackeval <目录>`；浏览器为`browser.mjs`。脚本默认拒绝覆盖run、ablation-verified及browser-verified文件，保留旧研究输入目录命名；不要清理已有证据强行重跑。耗时与含时间戳文件不要求跨环境逐字一致。

下一阶段是公开集成：根工厂algorithm选择、版本、manifest、四算法双语Demo和导入导出契约，再完成发布验收。自动图像估计、视频/摄像头、手机和门户Workflow另行推进。本轮已完成本地实现与验证，未push、PR、合并或发布npm/Demo。
