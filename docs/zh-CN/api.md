# API 0.2.0-alpha.0（本地候选）

[English](../en/api.md) · [首页](../../README.md)

`createTracker(options?: TrackerOptions): Tracker` 返回同步 `update(frame, {signal}?)`、`reset()`、`dispose()`。ESM/CJS 均导出 createTracker、TrackingError；声明还导出 `TrackerAlgorithm = 'bytetrack' | 'ocsort'`。本地候选为 0.2.0-alpha.0；线上安装包仍是 0.1.0。

## 输入

`TrackingFrame = {timestampMs, imageSize:{width,height}, detections:[{box:{x,y,width,height},score,classId}]}`。
坐标为像素 xywh，不是 xyxy；框必须完全在图像内，宽高正，x/y非负；不自动裁剪。
图像宽高为有限正数，时间为非负有限数且严格递增，尺寸整段一致。score在[0,1]；classId为非负安全整数。所有数值必须有限。
默认每帧最多100框，配置可到500；Demo独立限制仍是100。类别严格隔离。
无效输入、取消或数值失败不会推进时钟、轨迹或ID；输入与返回对象均和内部状态隔离。

| 参数 | 默认 | 约束 |
| --- | --- | --- |
| algorithm | bytetrack | `'bytetrack'` 或 `'ocsort'`；实例创建后固定 |
| lowScoreThreshold | 0.1 | [0,1] |
| highScoreThreshold | 0.5 | [low,1] |
| newTrackThreshold | 0.6 | [high,1] |
| matchIouThreshold | 0.3 | [0,1] |
| lowMatchIouThreshold | 0.2 | [0,1] |
| minHits | 2 | 整数1–100 |
| maxLostMs | 1000 | 有限正数 |
| largeGapMs | 2000 | 有限且 >= maxLostMs |
| maxDetections | 100 | 整数1–500 |
| maxTracks | 200 | 整数1–500 |

`algorithm: 'bytetrack'` 使用低分二阶段关联；`lowScoreThreshold` 与 `lowMatchIouThreshold` 只允许该策略。`algorithm: 'ocsort'` 只使用高分关联，仍接受高分、新建、IoU、生命周期和容量参数，并额外接受：

| OC-SORT 参数 | 默认 | 约束 |
| --- | --- | --- |
| ocmWeight | 0.2 | [0,1] |
| ocmDeltaMs | 300 | 有限数1–10000 ms |
| ocmHistoryLength | 30 | 整数2–120 |
| oruMaxReplaySteps | 30 | 整数1–60 |

未知参数拒绝，显式undefined不是缺省；将另一种策略的专属参数显式传入也返回 `INVALID_OPTIONS`。低分检测仅供 ByteTrack 的tracked续接，lost只允许高分恢复。首次未确认轨迹失配立即移除。容量满时只跳过新建，不驱逐现存轨迹。

## 输出

`TrackingResult = {generation,algorithm,timestampMs,tracks,removed,droppedDetections,runtime,timings}`。`algorithm` 为该次更新实际使用的固定实例策略。
Track字段：`id,classId,box,state,observed,score,ageMs,hits,missedMs`。
state为tentative/tracked/lost；removed数组仅包含本帧移除事件，state为removed。
预测轨迹 observed=false、score=null；输出框可能超出画面，不裁剪。hits为累计实际观测次数，新建为1。
droppedDetections只计算因容量满而跳过的新轨迹，不包含低分过滤数量。
runtime实际报告cpu/main、`web-sdk-pp-tracking@0.2.0-alpha.0`。五项timings见 [性能](performance.md)。

## 生命周期

初始generation=0。reset清空轨迹、时钟和状态，generation加1，ID从1重新开始。同代ID不复用，跨实例独立。ID非身份。Demo的reset同时清空路径和导出历史。
seek或改变尺寸前必须reset；重放按原始timestampMs逐帧推进。dispose幂等，之后update/reset抛DISPOSED。
同步主线程只在开始前检查AbortSignal，不支持运行中抢占。

稳定错误码：INVALID_OPTIONS、INVALID_INPUT、ABORTED、DISPOSED、NUMERICAL_FAILURE、ID_EXHAUSTED。用 `error instanceof TrackingError` 和 `error.code` 分支；不匹配中文错误文本。

详细运动方程与移除边界见 [算法](algorithm.md)。
