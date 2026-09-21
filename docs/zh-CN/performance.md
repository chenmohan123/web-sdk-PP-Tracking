# 性能与耗时

[English](../en/performance.md) · [首页](../../README.md)

全部单位毫秒，来自performance.now()，不是固定占位值。

| 字段 | 边界 |
| --- | --- |
| validationMs | update入口到输入/取消校验结束 |
| predictionMs | 状态复制、预先移除与Kalman预测 |
| associationMs | 分组及三次关联 |
| updateMs | 修正、新建与结果轨迹快照 |
| totalMs | update入口至结果对象构建，独立实测，不是阶段相加 |

无轨迹阶段仍有调度开销，不伪造模型/下载/缓存耗时。cold为新实例首帧，warm为同实例复用状态。reset清空运动状态，不等同新建JS运行环境。
输入规模、活动状态规模、初始化/复位边界、设备、浏览器、runtime、日期必须随测量一起记录。不同规模和不同状态耗时不可直接换算加速比。

Demo导出包含已处理帧的五项实际耗时、原始timestampMs、已应用配置、特征空间、原序列和实际算法；播放定时只用于呈现，不传浏览器墙钟给算法。同步main计算可能阻塞UI，AbortSignal只能开始前取消。
导入与算法切换会在临时 tracker 上完整验证全部帧，长序列每100帧让出一次浏览器主线程，成功后才原子提交；因此3000帧或大图库输入可能等待，但失败不会破坏当前会话。seek重新计算前缀。SVG仅保留最近100个结果位置绘制路径，导出仍保留本轮所有实际结果。

DeepSORT 的 `associationMs` 包含外观最近邻图库、Mahalanobis 门控、级联和 IoU 后备，其成本随轨迹数、检测数、向量维度和图库容量变化。它不包含 ReID 模型、图片裁剪、预处理或 embedding 生成。可选子入口的 load 分别报告下载、缓存读取、完整性、会话与总耗时，extract 分别报告预处理、推理、归一化和总耗时；decodeMs为0，因为图像由宿主解码。Demo按模型提取和CPU关联分层展示，不能将模型GPU耗时写成GPU关联，或把不同次测量拼成端到端FPS。

2026-09-21已完成[三算法真实画面评测](../../reports/2026-09-21-mot-reid/README.md)：七段5316帧/67639检测，DeepSORT+PPLCNet合计IDF1 45.4637%、IDSW 1030、MOTA 44.7608%、FP 3373、FN 57629；不支持替换ByteTrack默认。Node第一次跟踪累计ByteTrack/OC-SORT/DeepSORT为8679.482/9387.251/31180.492ms；浏览器DeepSORT图片fetch→解码→ReID→关联外围累计613470.900ms，p50/p95为100.900/247.700ms，7次模型外围加载另计9005.000ms。cold/warm、逐段表、原始压缩计时和离线复算见报告。这不是视频端到端FPS、固定预热排名或跨设备结论；三套完整配置差异不能单独归因ReID模型。

2026-09-19在Windows11 / i5-10400F / Chromium151.0.7922.34 headless实测：10、50、100框每档600个warm更新，totalMs p50/p95分别为1.0/1.3、5.3/8.9、11.3/14.9ms。每档3个cold新实例创建+首帧，p50约0.2/0.6/1.1ms；cold没有已有轨迹匹配，不与warm换算加速比。输入生成在计时外，不含检测模型与渲染。

[0.1.0 桌面验收报告](../../reports/2026-09-19-desktop/README.md)提供固定输入、全部样本、分位数口径、核心 commit、历史构建摘要及复跑命令。校验这份历史归档须使用 `node scripts/evaluation/verify-archive.mjs --sdk <匹配历史提交及构建的独立目录>`；当前 0.2.0-rc.0 候选目录与旧入口 hash 不同，校验器拒绝它属于预期结果。`node scripts/evaluation/benchmark.mjs --out .tmp/new-benchmark.json` 可另存新的性能报告。此前两策略候选的[完整 verify](../../reports/2026-09-19-ocsort/verification/task-2-verify.txt)、[10 组 Chromium153 浏览器检查](../../reports/2026-09-19-ocsort/verification/task-2-browser-green.txt)、本次三策略 `reports/2026-09-19-deepsort/verify.txt` 和 Chromium151 历史性能是不同证据，归档校验不会重新测量性能。

仅限[兼容性](compatibility.md)中注明环境，无真实移动设备性能、最坏情况或 MOT 测试集精度结论；不把页面帧率当作算法吞吐量。0.2.0-rc.0 为发布候选；发布不会扩大历史两算法耗时/精度或 DeepSORT 合成证据的适用范围；0.1.0 的包大小及完整性仅属于历史发布测量。

2026-09-19新增[真实检测序列评测](../../reports/2026-09-19-mot17/README.md)：固定MOT17七段FRCNN训练序列5316帧，官方TrackEval默认合计IDF1 48.2922%、IDSW 1101、MOTA 44.4010%、FP 4169、FN 57166；low=high消融为48.3465%、1066、44.3405%、3785、57653。默认低分续接减少漏检但增加误检/切ID，不作普遍精度提升声明。Node默认SDK totalMs累计8627.59ms；Chromium153完整02序列600帧与Node非耗时输出一致。报告包含固定数据/评分器/构建摘要、逐段指标、容量和失败恢复实例；不含检测模型、解码和渲染耗时。

同日以已提交的 0.2.0-alpha.0 候选做[两算法同输入评测](../../reports/2026-09-19-ocsort/README.md)：候选 ByteTrack 七份 MOT 与上述历史默认逐字节一致，合计 IDF1/IDSW/MOTA/FP/FN 仍为 48.2922%/1101/44.4010%/4169/57166；OC-SORT 为 48.4107%/881/39.5434%/6751/60259。OC-SORT 的 IDSW 少 220、IDF1 高 0.1185 个百分点，但 MOTA 低 4.8577 个百分点，FP 多 2582、FN 多 3093，不能视为总体精度更好。Node `sdkTotalMs` 累计为 8566.916/9268.917ms，OC-SORT 在这一次观测高 8.19%；这只覆盖跟踪器，不含检测、视频、解码、渲染或评分。两算法均在 Chromium153 完整 600 帧对齐各自 Node 非耗时输出，容量丢弃均为 0；ByteTrack 继续作为默认策略。

输出保护解析现有父目录真实位置（含Windows大小写和symlink/junction别名），写入前重新检查，并排他创建文件。已有输出会报EEXIST，复跑请指定新的 `--out` 文件名；归档验证器自行分配唯一临时输出，可重复执行。用 `node --test scripts/evaluation/check-output-path.mjs` 验证输出保护边界。
