# Vanilla TypeScript 示例（0.1.0）

[English](README.en.md)

无 UI 框架，通过 `web-sdk-pp-tracking` 公开入口使用本地构建包；每次单步显示实际 `TrackingResult`。复位清除状态，下一帧重新从时间0开始。

在仓库根目录（Node >=22.12.0）：

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec vite examples/vanilla --host 127.0.0.1 --port 4197
npm run build:vanilla
```

打开 http://127.0.0.1:4197。这是 H5/DOM 移植基线，不代表 CDN、微信 web-view 或移动浏览器已验证；无在线 npm 安装前提。
