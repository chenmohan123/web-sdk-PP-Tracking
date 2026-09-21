# web-sdk-pp-tracking

[English](README.en.md)

[0.2.0-rc.0候选说明](docs/zh-CN/releases/0.2.0-rc.0.md)：预发布通道为 `next`，稳定通道 `latest` 保留 `0.1.0`；历史 alpha 评测和 RC 包证据分别保留。远程交付状态见[发布清单](docs/zh-CN/release-checklist.md)。

发布候选版本 **0.2.0-rc.0**。框架无关的多目标跟踪 SDK，独立实现 ByteTrack、OC-SORT 与 DeepSORT；根入口运行于 CPU 主线程，可选 ReID 子入口从人体图像提取外观特征，选择 CPU/WASM 或 GPU/WebGPU。无 React 运行依赖。RC 用于预发布验证，人体 ReID 仍为实验能力。

RC 提供 [ReID 子入口](docs/zh-CN/reid-candidate.md) `web-sdk-pp-tracking/reid`，默认 ModelScope、Hugging Face 可选。固定 FP32 模型已分发到双源；权重不随 npm 包提供，只有显式加载模型时才下载。仅使用根跟踪入口不需要安装推理引擎。

## 安装与运行

2026-09-21使用0.2.0-alpha.0已完成[三算法真实画面评测](reports/2026-09-21-mot-reid/README.md)：七段5316帧、67639检测，DeepSORT+PPLCNet IDF1为45.4637%，低于默认ByteTrack的48.2922%；完整指标与图片获取/解码/ReID/关联成本已归档。RC 继续 ByteTrack 默认、OC-SORT/DeepSORT 显式可选，ReID 作为人体场景实验能力；不承诺手机、跨设备或视频端到端性能。

```sh
npm install web-sdk-pp-tracking@0.2.0-rc.0
# 仅使用可选 ReID 时安装：
npm install onnxruntime-web@1.27.0
```

```ts
import { createTracker } from 'web-sdk-pp-tracking';
const tracker = createTracker();
const result = tracker.update({ timestampMs: 0, imageSize: { width: 640, height: 360 },
  detections: [{ box: { x: 20, y: 40, width: 60, height: 80 }, score: 0.9, classId: 0 }] });
console.log(result.tracks, result.runtime, result.timings);
tracker.reset(); // 跳转或图像尺寸改变前复位
tracker.dispose();
```

## 本地开发

Node >=22.12.0；开发验证使用 Node24.16.0 / pnpm11.21.0。在仓库根目录运行：

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm pack
# 在消费项目中安装上一步生成的本地 tarball：
npm install /absolute/path/web-sdk-pp-tracking/web-sdk-pp-tracking-0.2.0-rc.0.tgz
# 仅使用可选 ReID 时安装：
npm install onnxruntime-web@1.27.0
```

## 独立 Demo 与示例

新增“图像＋检测框”模式：提供本地图片与一帧检测数组，使用PPLCNet提取特征后交给DeepSORT；同尺寸图片可逐帧继续，未提供检测器。模型默认ModelScope，可选Hugging Face和CPU(WASM)/GPU(WebGPU)，关联始终CPU。仅选中并运行模型模式才加载引擎及权重；状态复位和模型清理分别提供。图片限制20MiB、每维8192且总像素16777216；原框/向量模式仍为默认。

运行 `npm run dev:demo`，打开 http://127.0.0.1:4196。运行 `npm run build:demo` 构建静态站点。
中文默认、语言切换保留状态；提供 ByteTrack/OC-SORT/DeepSORT 选择、各自有效参数、原创直行/低分/遮挡/交叉掉头序列、JSON 导入、SVG轨迹、播放暂停、单步、复位、跳转、紧凑输入序列导出与实际结果导出。DeepSORT 内置样例的框和外观向量均为原创合成数据，不来自图片。切换算法会先完整校验当前序列，成功后重建实例并清空结果；失败保留配置、序列和结果。
导入兼容 `{ "frames": TrackingFrame[] }`，带外观时可用 `{ "featureSpace": {"id":"...","dimension":4}, "frames": [...] }`；上限5MiB、3000帧、每帧100框。紧凑输入序列导出受同一5MiB上限约束，可直接重新导入；结果报告保留实际算法、已应用参数、特征空间、源序列和本轮结果，可能超过5MiB，不保证可重新导入。计算只在本地内存进行。

- [Vanilla TypeScript](examples/vanilla/README.md)
- [React 完整参考](examples/react/README.md)
- [GitHub 仓库](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm 包](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [在线 Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

manifest 与 package 元数据使用相同项目地址。

## 文档与边界

[快速开始](docs/zh-CN/quick-start.md) · [API](docs/zh-CN/api.md) · [算法](docs/zh-CN/algorithm.md) · [兼容性](docs/zh-CN/compatibility.md) · [排错](docs/zh-CN/troubleshooting.md) · [隐私与部署](docs/zh-CN/privacy-deployment.md) · [性能](docs/zh-CN/performance.md)

默认省略 `algorithm` 时使用 ByteTrack；`algorithm: 'ocsort'` 选择 OC-SORT；`algorithm: 'deepsort'` 必须同时提供 `featureSpace`，且每帧和每个检测都提供匹配标识与向量。低分检测仅由 ByteTrack 用于第二阶段关联；三种策略的专属参数互斥，结果均报告实际 `algorithm`。seek 必须先 reset 再顺序重放。
轨迹 ID 只在同一实例同一代次内有效，不是个人身份。ReID 模块只为调用者提供的人体框生成外观向量，不产生检测框；SDK不保证真实交叉、遮挡或相似衣着情况下身份正确性。模型特征提取和CPU跟踪关联分别报告后端及耗时。
2026-09-19 固定 MOT17 七段 FRCNN 训练序列 5316 帧同输入评测：ByteTrack IDF1 **48.2922%**、IDSW **1101**、MOTA **44.4010%**、FP **4169**、FN **57166**；OC-SORT 为 **48.4107%**、**881**、**39.5434%**、**6751**、**60259**。OC-SORT 减少 220 次 ID 切换且 IDF1 略增，但 MOTA 下降 4.8577 个百分点，误检/漏检增加，Node 跟踪累计耗时也高 8.19%，因此仍以 ByteTrack 为默认。候选 ByteTrack 七份 MOT 输出与 0.1.0 历史基线逐字节一致；两算法各重复确定性，并分别在 Chromium 153 完整对齐 600 帧 Node 输出。详见[候选对比报告](reports/2026-09-19-ocsort/README.md)；这不是测试集排行榜、官方算法复现、视频端到端或跨设备评测。

## 验证与发布准备

```sh
# 首次按操作系统安装浏览器：
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
npm run verify
```

`verify` 构建 SDK，检查类型、单测、实际 npm tarball 的三算法 ESM/CJS/类型消费，构建 Demo 和两种示例，最后验证真实浏览器交互。
浏览器截图和输出写 `.tmp/browser/`。门户标准检查命令与本地证据见 [发布清单](docs/zh-CN/release-checklist.md)。
CI 验证后部署 Pages；Release 先核对不可变标签版本，在 `npm` 环境中通过 OIDC 发布。首次手工发布后，工作流仅在 npm `dist.integrity` 与构建 tarball 完全一致时跳过重复发布；查询网络/权限错误和不一致均失败。首次手工发布不自动具有 provenance，未来 OIDC 发布申请 provenance；具体证据及远程核验项见发布清单。

本项目代码许可 Apache-2.0。[NOTICE](NOTICE) 与 [算法说明](docs/zh-CN/algorithm.md) 记录论文来源和实现差异；模型转换采用上游仓库整体授权，依据与训练披露范围见[模型卡](models/pplcnet-reid/0.1.0/README.md)。不是官方移植，不承诺逐值兼容。变更见 [CHANGELOG](CHANGELOG.md)。
