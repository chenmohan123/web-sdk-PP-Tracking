# web-sdk-pp-tracking

[English](README.en.md)

版本 **0.1.0（发布候选，线上状态待核验）**。框架无关的 CPU 主线程多目标跟踪算法，参考 ByteTrack 的高低分两阶段关联思想独立实现，无模型下载、推理或 React 运行依赖。

## 本地安装与运行

发布后可安装 `npm install web-sdk-pp-tracking@0.1.0`；发布前使用下列本地 tarball。以下链接为正式发布目标，实际 npm、Release 和 Demo 可用性须以日期化远程回执为准。

Node >=22.12.0；开发验证使用 Node24.16.0 / pnpm11.21.0。

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm pack
# 在消费项目中安装上一步生成的本地 tarball：
npm install /absolute/path/web-sdk-pp-tracking/web-sdk-pp-tracking-0.1.0.tgz
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

## 独立 Demo 与示例

运行 `npm run dev:demo`，打开 http://127.0.0.1:4196。运行 `npm run build:demo` 构建静态站点。
中文默认、语言切换保留状态；提供原创直行/低分/遮挡/交叉掉头序列、JSON 导入、SVG轨迹、播放暂停、单步、复位、跳转与实际结果导出。
导入格式 `{ "frames": TrackingFrame[] }`，上限5MiB、3000帧、每帧100框；验证失败保留原序列与结果。计算只在本地内存进行。

- [Vanilla TypeScript](examples/vanilla/README.md)
- [React 完整参考](examples/react/README.md)
- [GitHub 仓库](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm 包](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [在线 Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

manifest 与 package 元数据使用相同目标地址；本地验证不证明线上服务可用。

## 文档与边界

[快速开始](docs/zh-CN/quick-start.md) · [API](docs/zh-CN/api.md) · [算法](docs/zh-CN/algorithm.md) · [兼容性](docs/zh-CN/compatibility.md) · [排错](docs/zh-CN/troubleshooting.md) · [隐私与部署](docs/zh-CN/privacy-deployment.md) · [性能](docs/zh-CN/performance.md)

保留低分检测框供第二阶段关联；lost 轨迹仅允许高分恢复。seek 必须先 reset 再顺序重放。
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
CI 验证后部署 Pages；Release 先核对不可变标签版本，在 `npm` 环境中通过 OIDC 发布。首次手工发布后，工作流仅在 npm `dist.integrity` 与构建 tarball 完全一致时跳过重复发布；查询网络/权限错误和不一致均失败。首次手工发布不自动具有 provenance，未来 OIDC 发布申请 provenance；具体声明以 npm 回执为准。远程治理和线上状态仍需单独核验。

本项目代码许可 Apache-2.0。[NOTICE](NOTICE) 与 [算法说明](docs/zh-CN/algorithm.md) 记录论文来源和实现差异；不是官方移植，不承诺逐值兼容。变更见 [CHANGELOG](CHANGELOG.md)。
