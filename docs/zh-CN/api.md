# API 0.2.0-alpha.0（本地候选）

[English](../en/api.md) · [首页](../../README.md)

`createTracker(options?: TrackerOptions): Tracker` 返回同步 `update(frame, {signal}?)`、`reset()`、`dispose()`。ESM/CJS 均导出 createTracker、TrackingError；声明还导出 `TrackerAlgorithm = 'bytetrack' | 'ocsort' | 'deepsort'` 与 `FeatureSpace`。本地候选为 0.2.0-alpha.0；线上安装包仍是 0.1.0。

## 输入

`TrackingFrame = {timestampMs, imageSize:{width,height}, featureSpaceId?, detections:[{box:{x,y,width,height},score,classId,embedding?}]}`。
坐标为像素 xywh，不是 xyxy；框必须完全在图像内，宽高正，x/y非负；不自动裁剪。
图像宽高为有限正数，时间为非负有限数且严格递增，尺寸整段一致。score在[0,1]；classId为非负安全整数。所有数值必须有限。
默认每帧最多100框，配置可到500；Demo独立限制仍是100。类别严格隔离。
无效输入、取消或数值失败不会推进时钟、轨迹或ID；输入与返回对象均和内部状态隔离。

| 参数 | 默认 | 约束 |
| --- | --- | --- |
| algorithm | bytetrack | `'bytetrack'`、`'ocsort'` 或 `'deepsort'`；实例创建后固定 |
| lowScoreThreshold | 0.1 | [0,1] |
| highScoreThreshold | 0.5 | ByteTrack 为 [low,1]；OC-SORT 为 [0,1]；两者均须 <= new |
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

`algorithm: 'deepsort'` 必须显式提供 `featureSpace: {id,dimension}`。`id` 为1–256字符、首尾无空白的字符串，调用者应用它绑定权重摘要、预处理版本和输出定义；SDK只比较标识。`dimension` 为1–2048整数。每帧（包括空帧）的 `featureSpaceId` 必须匹配，每个检测（包括低于分数门限者）都必须携带指定维度、有限、非零范数的普通数组或 `Float32Array`。输入会稳健归一化并复制，不修改调用者对象。

| DeepSORT 参数 | 默认 | 约束 |
| --- | --- | --- |
| featureSpace | 必填 | 仅含 id、dimension |
| maxCosineDistance | 0.2 | [0,2] |
| gallerySize | 30 | 整数1–100 |

图库总容量满足 `maxTracks * gallerySize * dimension <= 4_000_000`。DeepSORT 不接受 ByteTrack 低分字段或 OC-SORT 专用字段；成功匹配/新建才更新图库，reset、dispose、移除会释放对应向量。

未知参数拒绝，显式undefined不是缺省；将另一种策略的专属参数显式传入也返回 `INVALID_OPTIONS`。低分检测仅供 ByteTrack 的tracked续接，lost只允许高分恢复。DeepSORT 的 lost 轨迹也不能通过 IoU 后备绕过外观门限。首次未确认轨迹失配立即移除。容量满时只跳过新建，不驱逐现存轨迹。

## 输出

`TrackingResult = {generation,algorithm,timestampMs,tracks,removed,droppedDetections,runtime,timings}`。`algorithm` 为该次更新实际使用的固定实例策略。
Track字段：`id,classId,box,state,observed,score,ageMs,hits,missedMs`。
state为tentative/tracked/lost；removed数组仅包含本帧移除事件，state为removed。
预测轨迹 observed=false、score=null；输出框可能超出画面，不裁剪。hits为累计实际观测次数，新建为1。
droppedDetections只计算因容量满而跳过的新轨迹，不包含低分过滤数量。
runtime实际报告cpu/main、`web-sdk-pp-tracking@0.2.0-alpha.0`。五项timings见 [性能](performance.md)。

Demo 的紧凑输入序列导出只包含规范化后的 `frames` 与可选顶层 `featureSpace`，按 UTF-8 字节限制为5MiB并可重新导入。结果报告另含实际参数和已处理结果，可能超过5MiB，不保证可重新导入。

## 生命周期

初始generation=0。reset清空轨迹、时钟和状态，generation加1，ID从1重新开始。同代ID不复用，跨实例独立。ID非身份。Demo的reset同时清空路径和导出历史。
seek或改变尺寸前必须reset；重放按原始timestampMs逐帧推进。dispose幂等，之后update/reset抛DISPOSED。
同步主线程只在开始前检查AbortSignal，不支持运行中抢占。

稳定错误码：INVALID_OPTIONS、INVALID_INPUT、ABORTED、DISPOSED、NUMERICAL_FAILURE、ID_EXHAUSTED。用 `error instanceof TrackingError` 和 `error.code` 分支；不匹配中文错误文本。

详细运动方程与移除边界见 [算法](algorithm.md)。
