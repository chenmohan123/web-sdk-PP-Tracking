# 隐私与部署

[English](../en/privacy-deployment.md) · [首页](../../README.md)

默认算法入口无网络请求、遥测或持久缓存。可选 `web-sdk-pp-tracking/reid` 在 load 时从选定的 ModelScope/Hugging Face 来源下载权重，并加载 ORT 静态资源；远端可获得普通资源请求的网络信息，图片、检测框和向量不随这些请求上传。模型权重存入本 SDK 专属 CacheStorage，刷新不会清除此缓存；本地 modelBytes 不写持久缓存。

Demo 的图片、检测框和 embedding 在本机处理，刷新清空内存会话。框/向量模式的紧凑输入序列与结果报告由用户主动导出，含原始框、时间、外观向量及实际参数，请按自己的分享范围保存。轨迹 ID 不代表真实身份，特征空间标识也不证明向量来源。单独重置只复位轨迹；完整清理先取消并等待提取、释放会话，再清理此 SDK 模型缓存并复位关联状态，不删除其他 SDK 的缓存。

`npm run build:demo` 生成 `demo/dist`，可由静态 HTTPS 托管服务部署，资源路径相对。Demo 构建包含 ORT 引擎资源，不含模型权重；仅启用模型并加载时请求引擎和所选模型来源。部署需允许静态 JS/MJS/WASM 及模型源的 CORS 请求，按自身需求配置 CSP 与访问控制。WebGPU、SHA-256 和 CacheStorage 使用浏览器安全上下文（HTTPS 或 localhost）；普通局域网 HTTP 不等价。

Pages 使用官方 configure-pages/upload-pages-artifact/deploy-pages actions，部署任务才获得 pages/id-token 写权限，使用 github-pages 环境及串行并发组。0.1.0 的远程治理与交付已归档；RC 通过保护分支 CI、不可变标签与可信发布工作流交付，状态见发布清单。

release 工作流在发布 v* tag 对应 GitHub Release 后执行，验证成功才以 npm OIDC Trusted Publishing 发布。可信发布者已配置，首版实际以本机认证发布；未来新版本的 OIDC 成功仍须实际回执证明。发布前重新核验受保护默认分支、不可变标签及对应环境，不在代码或产物内嵌 token。

发布说明用CHANGELOG当前版本，包含算法来源、Apache-2.0、状态/API差异与限制。工作流文件不能替代远程治理证据；详见[发布清单](release-checklist.md)。
