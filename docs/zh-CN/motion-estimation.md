# 浏览器运动估计实验

[English](../en/motion-estimation.md) · [API](api.md) · [首页](../../README.md)

`web-sdk-pp-tracking/motion` 是独立实验子入口。它接收相邻的 `ImageData` 或 `VideoFrame`，比较纯平移、稀疏光流和特征匹配，并返回矩阵、质量字段、失败原因和三段耗时。它不读取检测框，不运行检测模型，也不会自动修改 `createTracker({ algorithm: 'botsort' })` 的运动输入。

## 调用

```ts
import { estimateMotion } from 'web-sdk-pp-tracking/motion';

const result = await estimateMotion({
  previous: { image: previousImage, frameId: 0, timestampMs: 0 },
  current: { image: currentImage, frameId: 1, timestampMs: 33 },
  imageSize: { width: previousImage.width, height: previousImage.height },
}, { algorithm: 'sparse-flow' });

if (result.status === 'estimated' || result.status === 'identity') {
  // 只有这两个状态带可应用矩阵。
  console.log(result.matrix, result.confidence, result.timings.totalMs);
} else {
  console.warn(result.reason);
}
```

帧编号必须严格相邻，时间戳必须递增，两个输入尺寸必须与 `imageSize` 一致。输入错误抛出 `MotionEstimateError`；纹理不足、匹配不足、数值不稳定和质量门限失败返回 `status: 'failed'`，失败结果不包含矩阵，调用方不能自行把它改成恒等矩阵。

`VideoFrame` 的读取只调用 `copyTo`，不会关闭调用方拥有的帧。调用方仍负责在自己的生命周期结束时释放帧。当前入口无内部序列状态，不需要 reset 或 dispose。

稀疏光流默认要求候选置信度至少为 `0.8`；纯平移和特征匹配使用 `0.5`。这是为了在局部搜索范围外或周期纹理产生歧义时返回失败，避免把错误矩阵交给跟踪器。

## Demo 与证据

本地 Demo 入口为 `demo/motion.html`，构建后可从 `/motion.html` 打开。页面提供原创合成帧、本地图片对、三算法对比、JSON 导出和状态复位；图片只在本机内存处理，不提供视频播放器、摄像头调度或上传服务。

2026-09-23 的合成对比见[运动估计实验报告](../../reports/2026-09-23-motion-estimation/README.md)。当前只形成 Windows 11、Chromium 153、CPU/main 的证据。特征匹配在 640×360 的 p95 成本明显高于纯平移，尚不足以自动接入 BoT-SORT；详见报告中的限制和后续决策。
