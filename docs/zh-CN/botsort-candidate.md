# BoT-SORT 外部运动矩阵候选

[English](../en/botsort-candidate.md)。本地阶段：2026-09-22，CPU/main。此模块是同 SDK 的后续算法核心，尚未加入 npm 导出、根工厂算法选项或正式 Demo。

在本仓运行 `node scripts/build-botsort-candidate.mjs`，候选 ESM/CJS/声明写入 `.tmp/botsort-core/build/`，并实际验证两种运行时及 NodeNext 类型消费。可在仓库根目录保存下面示例为 `.mjs` 后运行：

```js
import { createBoTSortTracker } from './.tmp/botsort-core/build/index.js';
const tracker = createBoTSortTracker({ minHits: 1 });
const imageSize = { width: 640, height: 480 };
const detection = x => ({ box: { x, y: 100, width: 20, height: 80 }, score: 1, classId: 0 });
tracker.update({
  frameId: 0, timestampMs: 0, imageSize, detections: [detection(50)],
  motion: { status: 'initial', from: null, to: { frameId: 0, timestampMs: 0 } },
});
const result = tracker.update({
  frameId: 1, timestampMs: 100, imageSize, detections: [detection(100)],
  motion: {
    status: 'estimated', from: { frameId: 0, timestampMs: 0 }, to: { frameId: 1, timestampMs: 100 },
    matrix: [1, 0, 50, 0, 1, 0], source: '调用者估计器', confidence: 1,
  },
});
console.log(result.algorithm, result.tracks[0].id, result.tracks[0].box.x); // botsort 1 100
tracker.dispose();
```

## 输入与状态

候选沿用原 ByteTrack 的通用参数及低分续接，工厂不接受 `algorithm`、OC-SORT 方向参数或 DeepSORT 图库参数。新增 `motionFailure?: 'error' | 'identity'`，默认 error；可选外观如下：

```js
const tracker = createBoTSortTracker({
  appearance: {
    featureSpace: { id: '调用者固定特征空间', dimension: 512 },
    proximityIouThreshold: 0.5, maxCosineDistance: 0.25, emaAlpha: 0.9,
  },
});
// 启用后，每帧必须带相同 featureSpaceId，所有检测必须带512维非零有限embedding。
```

已有 `./reid` 可生成相应特征空间与向量，但候选不自动调用模型。未启用 appearance 时拒绝 featureSpaceId/embedding；启用时复制并归一化向量，一条 EMA 保留每个轨迹的外观。低分检测参与几何续接，既不参与外观匹配也不更新 EMA。emaAlpha 范围 [0,1)，其他门限和维数约束见导出类型与源码；反向向量使 EMA 精确抵消时返回 NUMERICAL_FAILURE，状态不推进。

`frameId` 为非负安全整数，与 timestampMs 均严格递增。imageSize 为每边 1–32768 的整数；检测沿用原图零基框、分数与类别约束。首帧/reset 后须用 `initial`；后续每帧 motion 的 from 必须匹配上一次**成功处理**帧的 ID 与时间，to 必须匹配当前帧。允许丢帧，但矩阵必须覆盖两次实际处理之间的整个间隔。暂停恢复超过 largeGapMs、seek、尺寸变化必须先 reset。

| motion.status | 必需字段与含义 |
| --- | --- |
| initial | from:null、to；仅首帧/reset后 |
| identity | from、to；调用者明确恒等，不带matrix |
| estimated | from、to、matrix、source、confidence |
| unavailable | from、to、reason；默认报错，仅工厂显式motionFailure:'identity'时接受降级 |

estimated 的 matrix 为 `[a,b,tx,c,d,ty]`，表示上一处理帧到当前帧：`x'=a*x+b*y+tx`，`y'=c*x+d*y+ty`。source/reason 是1–256字符非空去边空白文本；confidence在[0,1]，只记录调用者质量说明，不自动做置信过滤。矩阵必须稠密有限、保向，两个奇异值在[0.8,1.25]，旋转绝对值≤15°，平移≤原图对角线的25%；拒绝反射/奇异/强剪切及超范围。帧头、运动对象和选项拒绝未知字段。

输入、取消或数值失败不提交轨迹、帧 ID、时间、EMA 或代次，可以修正后重试同一帧。reset 清空状态、ID从1开始、generation加1；dispose 幂等，释放后 update/reset 返回 DISPOSED。同步取消仅支持计算开始前检查。

## 数学、结果和限制

预测后、关联前补偿中心/速度，宽高使用变换后四角的轴对齐包络：`J=diag(M,abs(M),M,abs(M))`，均值中心加平移，协方差 `JPJᵀ`。恒等走原值路径。输出框可能越界，裁边不反馈到滤波。矩阵估计不确定性尚未建模；连续旋转的包络会增大，不能视为无损几何转换。

高分检测仅在同类别、原IoU≥0.5且cosine距离≤0.25（默认）时融合，代价为 `min(1-IoU, cosine/2)`；包含 tentative 关联。不满足外观门限仍可通过几何关联。保留本项目秒级固定滤波噪声与生命周期，未实现论文全部机制；宽高映射、包含等号的门限、噪声与官方实现有差异，来源与许可沿用[研究报告](../../reports/2026-09-21-botsort-feasibility/README.md)，不复制第三方跟踪源码。

结果 algorithm 为 botsort，runtimeVersion 为 `web-sdk-pp-tracking@0.2.0-rc.0+botsort-core.1`，实际cpu/main；frameId及motion回执保留状态与原因，只有estimated的applied为true。五阶段耗时兼容原含义：validationMs包含运动/特征校验，predictionMs包含矩阵应用，totalMs由候选外围独立测量。**不包含图像估计、检测、ReID提取、传输或渲染。**

[本轮验收](../../reports/2026-09-22-botsort-core/README.md)覆盖固定七段5316帧及桌面Chromium；09段仍退步。先完成核心候选不表示生产算法已上线；下一阶段才整合根工厂、四算法Demo、版本和发布验收。浏览器自动估计、手机、视频/摄像头与门户Workflow另行推进。
