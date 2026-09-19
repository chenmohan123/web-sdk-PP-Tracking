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

Demo导出包含已处理帧的五项实际耗时、原始timestampMs和运行信息；播放定时只用于呈现，不传浏览器墙钟给算法。同步main计算可能阻塞UI，AbortSignal只能开始前取消。
导入结构校验是线性扫描，不为3000帧预先运行3000次关联。seek重新计算前缀，因此长序列跳到末尾可能等待。SVG仅保留最近100个结果位置绘制路径，导出仍保留本轮所有实际结果。

2026-09-19在Windows11 / i5-10400F / Chromium151.0.7922.34 headless实测：10、50、100框每档600个warm更新，totalMs p50/p95分别为1.0/1.3、5.3/8.9、11.3/14.9ms。每档3个cold新实例创建+首帧，p50约0.2/0.6/1.1ms；cold没有已有轨迹匹配，不与warm换算加速比。输入生成在计时外，不含检测模型与渲染。

[桌面验收报告](../../reports/2026-09-19-desktop/README.md)提供固定输入、全部样本、分位数口径、核心commit、完整构建摘要及复跑命令。`node scripts/evaluation/verify-archive.mjs`校验固定证据并复跑公开API，`node scripts/evaluation/benchmark.mjs`另存新的性能报告。Chromium151性能与Chromium153完整Demo交互是两份不同证据，归档不是重新测量。

仅限[兼容性](compatibility.md)中注明环境，无真实移动设备性能、最坏情况或MOT测试集精度结论；不把页面帧率当作算法吞吐量。

2026-09-19新增[真实检测序列评测](../../reports/2026-09-19-mot17/README.md)：固定MOT17七段FRCNN训练序列5316帧，官方TrackEval默认合计IDF1 48.2922%、IDSW 1101、MOTA 44.4010%、FP 4169、FN 57166；low=high消融为48.3465%、1066、44.3405%、3785、57653。默认低分续接减少漏检但增加误检/切ID，不作普遍精度提升声明。Node默认SDK totalMs累计8627.59ms；Chromium153完整02序列600帧与Node非耗时输出一致。报告包含固定数据/评分器/构建摘要、逐段指标、容量和失败恢复实例；不含检测模型、解码和渲染耗时。

输出保护解析现有父目录真实位置（含Windows大小写和symlink/junction别名），写入前重新检查，并排他创建文件。已有输出会报EEXIST，复跑请指定新的 `--out` 文件名；归档验证器自行分配唯一临时输出，可重复执行。用 `node --test scripts/evaluation/check-output-path.mjs` 验证输出保护边界。
