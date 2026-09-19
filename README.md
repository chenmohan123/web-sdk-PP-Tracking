# web-sdk-pp-tracking

[English](README.en.md)

本地候选版本 **0.2.0-alpha.0**。框架无关的 CPU 主线程多目标跟踪算法，独立实现 ByteTrack 高低分关联与 OC-SORT 观测中心机制，无模型下载、推理或 React 运行依赖。线上 npm 和 HTTPS Demo 仍为已发布的 **0.1.0**，尚未提供远程 alpha 安装包。

## 安装与运行

```sh
npm install web-sdk-pp-tracking@0.1.0
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
npm install /absolute/path/web-sdk-pp-tracking/web-sdk-pp-tracking-0.2.0-alpha.0.tgz
```

## 独立 Demo 与示例

运行 `npm run dev:demo`，打开 http://127.0.0.1:4196。运行 `npm run build:demo` 构建静态站点。
中文默认、语言切换保留状态；提供 ByteTrack/OC-SORT 选择、各自有效参数、原创直行/低分/遮挡/交叉掉头序列、JSON 导入、SVG轨迹、播放暂停、单步、复位、跳转与实际结果导出。切换算法会停止播放、以有效默认参数重建实例并清空结果；导出只含已应用配置和实际算法。
导入格式 `{ "frames": TrackingFrame[] }`，上限5MiB、3000帧、每帧100框；验证失败保留原序列与结果。计算只在本地内存进行。

- [Vanilla TypeScript](examples/vanilla/README.md)
- [React 完整参考](examples/react/README.md)
- [GitHub 仓库](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm 包](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [在线 Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

manifest 与 package 元数据使用相同项目地址。

## 文档与边界

[快速开始](docs/zh-CN/quick-start.md) · [API](docs/zh-CN/api.md) · [算法](docs/zh-CN/algorithm.md) · [兼容性](docs/zh-CN/compatibility.md) · [排错](docs/zh-CN/troubleshooting.md) · [隐私与部署](docs/zh-CN/privacy-deployment.md) · [性能](docs/zh-CN/performance.md)

默认省略 `algorithm` 时使用 ByteTrack；`createTracker({ algorithm: 'ocsort' })` 选择 OC-SORT。低分检测仅由 ByteTrack 用于第二阶段关联；OC-SORT 不接受 `lowScoreThreshold` 或 `lowMatchIouThreshold`。两种结果均报告实际 `algorithm`。seek 必须先 reset 再顺序重放。
轨迹 ID 只在同一实例同一代次内有效，不是个人身份；无 ReID，不保证交叉/掉头时 ID 正确。
2026-09-19 固定 MOT17 七段 FRCNN 训练序列 5316 帧，默认 IDF1 **48.2922%**、IDSW **1101**、MOTA **44.4010%**、FP **4169**、FN **57166**。low=high 消融 IDF1 48.3465%、IDSW 1066、MOTA 44.3405%、FP 3785、FN 57653。低分续接减少漏检但增加误检和切 ID，不承诺普遍改善精度。这不是测试集排行榜、官方 ByteTrack 复现或视频端到端评测；来源、许可边界、评分器与逐段结果见[真实序列报告](reports/2026-09-19-mot17/README.md)。

## 验证与发布准备

```sh
# 首次按操作系统安装浏览器：
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
npm run verify
```

`verify` 构建 SDK，检查类型、单测、实际 npm tarball 的 ESM/CJS/类型消费，构建 Demo 和两种示例，最后验证真实浏览器交互。
浏览器截图和输出写 `.tmp/browser/`。门户标准检查命令与本地证据见 [发布清单](docs/zh-CN/release-checklist.md)。
CI 验证后部署 Pages；Release 先核对不可变标签版本，在 `npm` 环境中通过 OIDC 发布。首次手工发布后，工作流仅在 npm `dist.integrity` 与构建 tarball 完全一致时跳过重复发布；查询网络/权限错误和不一致均失败。首次手工发布不自动具有 provenance，未来 OIDC 发布申请 provenance；具体证据及远程核验项见发布清单。

本项目代码许可 Apache-2.0。[NOTICE](NOTICE) 与 [算法说明](docs/zh-CN/algorithm.md) 记录论文来源和实现差异；不是官方移植，不承诺逐值兼容。变更见 [CHANGELOG](CHANGELOG.md)。
