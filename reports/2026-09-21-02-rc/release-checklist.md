# RC 本地发布检查清单

依据门户 `standards/v1/templates/release-checklist.md`，适用 hybrid 1.3.0。日期：2026-09-21。勾选仅表示所述范围完成，待发布项保持未勾选。

- [x] 中文 README 为默认入口，具备等价英文 README、公开指南及 RC 发布说明。
- [x] 当前包、runtime、Demo、manifest 与 CHANGELOG 均为 `0.2.0-rc.0`，模型自身版本仍为 `0.1.0`。
- [x] 本地 verify、实际包 ESM/CJS/类型消费、无 ORT 默认入口及浏览器验收通过。
- [x] 本地 CI/release/Pages 工作流有检查、环境及最小写权限；脚本预发布 `next`、正式 `latest`、已有相同完整性版本仅核验。
- [x] 只读观察到默认分支保护、最新 `verify` 检查、PR/讨论要求、禁删除强推、无 bypass。
- [x] 只读观察到 `v*` 标签更新/删除保护，About、homepage、topics 与 HTTPS Pages 配置。
- [x] 权重使用固定双源 revision、SHA256；默认 ModelScope，可选 Hugging Face；模型不进入 npm。
- [x] 文档区分 CPU 算法模块和 WASM/WebGPU 可选模型模块、状态复位、取消、缓存与释放。
- [x] 带日期的桌面 Chromium 证据保存；手机、其他浏览器及视频端到端能力未扩展声明。
- [x] 前后 SDK 标准检查没有 required 失败；四个远程静态 skip 保留，当前远程只读状态另存证据。
- [ ] RC 源码经保护分支 PR/CI 合并；本轮未执行远程 GitHub 写入。
- [ ] 创建不可变 `v0.2.0-rc.0` 与 GitHub 预发布 Release；发布说明包含来源、许可、模块、限制和资产。
- [ ] npm `0.2.0-rc.0` 实际发布，回读 tarball integrity 与 `next`；核验新版本 OIDC/provenance，保持 `latest=0.1.0`。
- [ ] RC/目标版本 HTTPS Demo 成功部署且记录绑定源码提交；既有 0.1.0 部署不替代此项。
- [ ] 发布后更新门户生产目录及独立链接，回读实际页面；本轮仅更新规划与验收回执。

纯算法 1.2.0 的互斥清单条目不适用：本 SDK 使用 1.3.0 hybrid，同时遵循算法及可选模型规则，未伪装为无模型包。远程发布前须刷新本清单的只读状态；相同版本不能覆盖、已发布 tag 不能移动，问题修复使用新版本。
