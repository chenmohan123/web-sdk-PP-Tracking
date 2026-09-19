# 快速开始

[English](../en/quick-start.md) · [首页](../../README.md)

线上已发布包仍为 0.1.0：

```sh
npm install web-sdk-pp-tracking@0.1.0
```

本地开发依赖和 tarball 消费流程见首页。Node >=22.12.0 用于构建；浏览器只执行生成的 JavaScript。
本地候选为 `0.2.0-alpha.0`，只能以本仓库 `npm pack` 生成的 tarball 消费，不能按 npm 远程 alpha 名称安装。

```ts
import { createTracker } from 'web-sdk-pp-tracking';
const tracker = createTracker();
for (let i = 0; i < 8; i++) {
  const result = tracker.update({ timestampMs: i * 100, imageSize: { width: 640, height: 360 },
    detections: [{ box: { x: 20 + i * 8, y: 100, width: 60, height: 80 }, score: i === 5 ? 0.25 : 0.9, classId: 0 }] });
  console.log(result.tracks);
}
tracker.reset();
tracker.dispose();
```

默认省略算法即 ByteTrack。使用 OC-SORT 时传入其专属的有效配置，结果会返回实际算法：

```ts
const tracker = createTracker({ algorithm: 'ocsort', ocmWeight: 0.2, ocmDeltaMs: 300, ocmHistoryLength: 30, oruMaxReplaySteps: 30 });
const result = tracker.update({ timestampMs: 0, imageSize: { width: 640, height: 360 }, detections: [] });
console.log(result.algorithm); // 'ocsort'
```

DeepSORT 只消费调用者外部向量。特征空间标识应绑定权重摘要、预处理版本和输出定义；每帧（含空帧）携带相同标识，每个检测（含低分框）携带有效向量：

```ts
const featureSpace = { id: 'my-reid-sha256-preprocess-v1-output-v1', dimension: 4 };
const tracker = createTracker({ algorithm: 'deepsort', featureSpace, maxCosineDistance: 0.2, gallerySize: 30 });
const result = tracker.update({ timestampMs: 0, imageSize: { width: 640, height: 360 },
  featureSpaceId: featureSpace.id,
  detections: [{ box: { x: 20, y: 100, width: 60, height: 80 }, score: 0.9, classId: 0, embedding: [1, 0, 0, 0] }] });
```

低分0.25仍传入，使 ByteTrack 已确认轨迹可以关联低分检测。不要先按0.5过滤所有输入；OC-SORT 仅做高分关联，且不能同时传入 ByteTrack 的低分参数。
每段序列尺寸一致、时间严格递增。重新开始、跳转或改变尺寸前 reset；跳转到第k帧需要从序列首帧依次调用到k，不能只输入目标帧。

运行 `npm run dev:demo` 体验四种原创合成序列；DeepSORT 样例的外观向量也是合成数据，不来自图片。文件须为 JSON 对象 `{"frames":[...]}`，带外观时可在顶层增加 `featureSpace`；限制5MiB、1–3000帧、每帧0–100框。未声明顶层特征空间时，Demo 只会从所有帧一致的标识和向量维度推导，不会为用户数据补造 embedding。
单帧文件也可单步并导出。导出包含原序列、实际参数/特征空间，以及本次复位以后实际处理过的结果与时间/运行信息；未处理结果不会伪造。
语言切换不复位；同一文件可以重复导入。刷新返回中文并清空内存数据。

详见 [API](api.md) 和 [Vanilla](../../examples/vanilla/README.md)。
