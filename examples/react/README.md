# React 示例（0.1.0）

[English](README.en.md)

完整实现位于 [demo/src/App.tsx](../../demo/src/App.tsx)，通过公开包入口 `web-sdk-pp-tracking` 消费本地构建的 SDK。React 仅为开发依赖，发行 runtime 无框架依赖。

在仓库根目录使用 Node >=22.12.0，运行：

```sh
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
npm run build
npm run dev:demo
npm run build:react
```

开发地址为 http://127.0.0.1:4196。构建产物在 `examples/react/dist`。npm 和线上 Demo 尚未发布。
