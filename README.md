# web-sdk-pp-tracking

[English](README.en.md)

版本 **0.1.0（本地未发布）**。框架无关的 CPU 主线程多目标跟踪算法，参考 ByteTrack 的高低分两阶段关联思想独立实现，无模型下载、推理或 React 运行依赖。

## 本地安装与运行

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
- [GitHub（计划地址，尚未创建/发布）](https://github.com/chenmohan123/web-sdk-PP-Tracking)
- [npm（计划地址，尚未发布）](https://www.npmjs.com/package/web-sdk-pp-tracking)
- [在线 Demo（计划地址，尚未部署）](https://chenmohan123.github.io/web-sdk-PP-Tracking/)

manifest 与 package 元数据中的远程地址同为计划地址，不表示可用服务。

## 文档与边界

[快速开始](docs/zh-CN/quick-start.md) · [API](docs/zh-CN/api.md) · [算法](docs/zh-CN/algorithm.md) · [兼容性](docs/zh-CN/compatibility.md) · [排错](docs/zh-CN/troubleshooting.md) · [隐私与部署](docs/zh-CN/privacy-deployment.md) · [性能](docs/zh-CN/performance.md)

保留低分检测框供第二阶段关联；lost 轨迹仅允许高分恢复。seek 必须先 reset 再顺序重放。
轨迹 ID 只在同一实例同一代次内有效，不是个人身份；无 ReID，不保证交叉/掉头时 ID 正确。
目前仅原创合成机制与数学验证，无授权真实视频 MOT 精度结论。

## 验证与发布准备

```sh
# 首次按操作系统安装浏览器：
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
npm run verify
```

`verify` 构建 SDK，检查类型、单测、实际 npm tarball 的 ESM/CJS/类型消费，构建 Demo 和两种示例，最后验证真实浏览器交互。
浏览器截图和输出写 `.tmp/browser/`。门户标准检查命令与本地证据见 [发布清单](docs/zh-CN/release-checklist.md)。
CI、Pages、OIDC npm 发布 workflow 是待启用模板，首次发布仍待明确授权、可信发布者和远程治理核验；本地通过不表示线上已发布。

本项目代码许可 Apache-2.0。[NOTICE](NOTICE) 与 [算法说明](docs/zh-CN/algorithm.md) 记录论文来源和实现差异；不是官方移植，不承诺逐值兼容。变更见 [CHANGELOG](CHANGELOG.md)。
