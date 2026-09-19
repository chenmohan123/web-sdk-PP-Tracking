# 快速开始

[English](../en/quick-start.md) · [首页](../../README.md)

安装 0.1.0 算法包：

```sh
npm install web-sdk-pp-tracking@0.1.0
```

本地开发依赖和 tarball 消费流程见首页。Node >=22.12.0 用于构建；浏览器只执行生成的 JavaScript。

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

低分0.25仍传入，使已确认轨迹可以关联低分检测。不要先按0.5过滤所有输入。
每段序列尺寸一致、时间严格递增。重新开始、跳转或改变尺寸前 reset；跳转到第k帧需要从序列首帧依次调用到k，不能只输入目标帧。

运行 `npm run dev:demo` 体验四种原创合成序列。文件须为 JSON 对象 `{"frames":[...]}`；限制5MiB、1–3000帧、每帧0–100框。
单帧文件也可单步并导出。导出仅包括本次复位以后实际处理过的帧及时间/运行信息，未处理帧不会伪造结果。
语言切换不复位；同一文件可以重复导入。刷新返回中文并清空内存数据。

详见 [API](api.md) 和 [Vanilla](../../examples/vanilla/README.md)。
