# React 示例（RC 0.2.0-rc.0）

[English](README.en.md)

完整实现位于 [demo/src/App.tsx](../../demo/src/App.tsx)，通过公开包入口 `web-sdk-pp-tracking` 消费本地候选构建的 SDK。React 仅为开发依赖，发行 runtime 无框架依赖；发布状态见[发布清单](../../docs/zh-CN/release-checklist.md)。

在仓库根目录使用 Node >=22.12.0，运行：

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm run dev:demo
npm run build:react
```

开发地址为 http://127.0.0.1:4196。构建产物在 `examples/react/dist`。项目入口：[npm](https://www.npmjs.com/package/web-sdk-pp-tracking) · [独立 Demo](https://chenmohan123.github.io/web-sdk-PP-Tracking/)。
