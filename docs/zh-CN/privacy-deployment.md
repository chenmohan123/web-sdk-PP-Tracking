# 隐私与部署

[English](../en/privacy-deployment.md) · [首页](../../README.md)

SDK无网络请求、遥测、模型下载或持久缓存，也不内置特征提取模型。Demo读取本地文件并在内存计算；不上传检测框或 embedding，刷新即清空。JSON导出由用户主动触发，包含原始框、时间和可能可关联个体的外观向量，请按自己的分享范围保存。轨迹ID不代表真实身份，特征空间标识也不证明向量来源。

`npm run build:demo` 生成 `demo/dist`，可由任意静态HTTPS托管服务部署，资源路径相对。站点初次加载会请求自身静态JS/CSS；点击论文链接将访问arxiv。建议宿主按自身需求配置CSP、HTTPS和访问控制。

Pages模板通过官方configure-pages/upload-pages-artifact/deploy-pages actions，在受保护main提交或手动运行后部署，部署任务才获得pages/id-token写权限，使用github-pages环境及串行并发组。启用前核验默认分支Ruleset、Pages Source=GitHub Actions和HTTPS；本轮未创建任何远程资源。

release模板仅在发布v* tag对应GitHub Release后执行，验证成功才以npm OIDC trusted publishing发布。必须预先获授权配置可信发布者（仓库/workflow/环境）、受保护默认分支与不可变v* tag规则；首次包注册若平台要求人工操作，应另外明确授权，不内嵌token。GitHub/npm/Pages地址目前全部为计划地址。

发布说明用CHANGELOG当前版本，包含算法来源、Apache-2.0、状态/API差异与限制。工作流文件不能替代远程治理证据；详见[发布清单](release-checklist.md)。
