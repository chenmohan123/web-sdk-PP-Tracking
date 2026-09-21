# 远程只读预检

核验日期：2026-09-21。仓库为 `chenmohan123/web-sdk-PP-Tracking`。复用宿主机 `chenmohan123` 的 GitHub keyring 登录，未登录、退出或切换账号；全部操作只读。主要查询时间及退出码见 [queries.json](remote/queries.json)，其余补充响应一并保存于 `remote/`。

| 项目 | 观察结果 | 证据 |
| --- | --- | --- |
| npm | 仅 `0.1.0`，`latest=0.1.0`，无 `next` | [npm.json](remote/npm.json) |
| 默认分支 | Ruleset `23691947` active，PR、最新提交的 `verify`、讨论解决、禁止删除及强推；无 bypass | [branchRules.json](remote/branchRules.json) |
| 发布标签 | Ruleset `23691948` active，保护 `v*` 的更新与删除；无 bypass | [tagRules.json](remote/tagRules.json) |
| About | 描述、Demo homepage 和五项 topics 已配置 | [repository.json](remote/repository.json) |
| Pages | GitHub Actions Source，HTTPS enforced | [pages.json](remote/pages.json) |
| 部署环境 | `github-pages` 限受保护分支；`npm` 限 `v*` 标签，策略 `60388939` | [environments.json](remote/environments.json)、[npm-environment-policies.json](remote/npm-environment-policies.json) |
| 线上 Demo | 成功 run `35425842071`，源码 `1824e274bfb5e6814c2d4eb070081e7df7247b22`；deployment success 于 2026-09-19T06:11:07Z | [pagesRuns.json](remote/pagesRuns.json)、[deployments.json](remote/deployments.json)、[deployment-statuses.json](remote/deployment-statuses.json) |
| 既有 Release | `v0.1.0`，已发布，非预发布 | [releases.json](remote/releases.json) |
| 既有发布流程 | 成功 run `35424969266`，源码 `c2ee347884426aa1a03962b76ac2915959397611` | [releaseRuns.json](remote/releaseRuns.json) |

上述证明的是已存在的远程状态，不是 RC 发布完成。本轮未 push、创建 PR、合并、创建标签、执行 npm publish 或部署 Pages；门户生产 registry 仍对应 `0.1.0`。后续发布前须刷新远程状态。

本轮未回读 npm Trusted Publisher 配置，亦未执行新版本 OIDC 发布。历史成功发布任务不能代替 RC 实际发布证明，尤其既有任务的相同完整性版本核验路径没有执行新版本上传。不得据此声称 `0.2.0-rc.0` 已验证 OIDC 发布成功。

候选发布脚本的本地调用测试分别验证 `--tag next`、`--tag latest` 和已有相同完整性版本不写入。只有未来实际发布并回读 npm integrity、dist-tags、GitHub Release 和部署提交后，才可更新对应发布清单。
