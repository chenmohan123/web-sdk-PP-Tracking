# Tracking 0.2 发布候选验收

[English](README.en.md) · [版本说明](../../docs/zh-CN/releases/0.2.0-rc.0.md) · [发布清单](release-checklist.md)

日期：2026-09-21。`0.2.0-rc.0` 为本地发布候选，尚未发布到 npm、GitHub Release 或线上 Demo。ByteTrack 保持默认，OC-SORT、DeepSORT 显式可选，PPLCNet 人体 ReID 保留实验标记。线上版本与门户生产目录仍为 `0.1.0`。

## 本轮改动与边界

包、runtime、Demo 和清单的当前版本统一为 RC；发布脚本为预发布指定 `--tag next`，正式版指定 `--tag latest`。已有相同完整性版本只做核验，不重新上传、不修改标签。双语 README、CHANGELOG、文档及版本说明同步候选状态。

关联数学、权重、预处理、阈值及 API 输入输出语义没有变化。[源码等价记录](runtime-equivalence.json)逐一比较正式评测提交 `0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e` 与本轮实现提交；[实际差异](runtime-diff.patch)仅含四个源文件的版本字符串或类型字面量，模型元数据未变。本轮完整源码、构建文件、模型声明和实际包身份见 [identity.json](identity.json) 与 [package-check.json](package-check.json)。

七段 MOT17、5316 帧的成绩仍属于 [alpha 实测归档](../2026-09-21-mot-reid/README.md)，没有改写为 RC 新评测。旧归档的 32 个文件及计时、指标公式再次离线核验通过；本轮没有重新运行全部模型、跟踪和 TrackEval。既有结果不支持将 DeepSORT 组合提升为默认，也不代表官方测试集排名。

## 本轮验证

| 检查 | 结果与证据 |
| --- | --- |
| 发布通道行为 | 新增用例先出现 3 项预期失败，修复后 8 项通过；见 `logs/release-red.txt`、`logs/release-green.txt` |
| 完整 verify | 176 项单测、SDK/Demo 类型检查与构建、Vanilla/React 构建、实际包消费和 12 组浏览器检查通过；见 `logs/verify.txt` |
| 实际发行包 | ESM/CJS、两入口 NodeNext 类型、未安装 ORT 的根入口和 ReID 工厂、可选 peer、文件白名单通过；无权重、原图或推理资源打入 npm |
| 三算法 Demo | 播放、暂停、跳帧、导入导出、512D 千帧往返、中英文、390px 布局与 Vanilla 通过，`pageErrors=[]`；见 `browser/report.json` |
| 真实模型 Demo | ModelScope/WASM、Hugging Face/WebGPU 成功，跟踪实际为 CPU；惰性加载、切换复位、取消、无效输入不推进、缓存隔离通过，`errors=[]`；见 `reid-demo/report.json` |
| SDK 标准 | before/after 回执归档于 `standard/`；静态检查不能替代浏览器或远程发布证据 |
| 远程预检 | npm、Rulesets、环境、HTTPS Pages 与既有部署已只读核验，见 [远程预检](remote-preflight.md)；RC 发布与 OIDC 新版本上传未执行 |

首次完整检查发现评测适配器测试写死 alpha 版本期望，现从当前 `package.json` 读取；失败日志保留于 `logs/verify-first-version-test-failure.txt`。固定历史评测脚本与报告没有改写。构建保留 ORT 可选分块超过 500 kB 的 Vite 提示，根入口浏览器检查确认不会加载 ORT 或模型；这不影响通过状态，也不表示依赖体积已优化。

环境为 Windows 11 10.0.26200、Intel Core i5-10400F、NVIDIA RTX 5060 Ti、驱动 32.0.16.1692、Chromium 153.0.8010.12、Playwright 1.63.0、Node 24.16.0、ORT 1.27.0。390px 是桌面浏览器视口。模型 Demo 使用人工生成的不透明 PNG 与人工框，仅证明接口及会话可用；质量依据仍为上述独立真实评测，不将该图用作人体识别质量证据。

## 复核与下一步

```sh
node reports/2026-09-21-02-rc/verify.mjs
node reports/2026-09-21-02-rc/verify.mjs --current
```

第一条离线校验归档哈希及身份记录；第二条另要求当前源码、模型元数据、构建和 `.tmp/web-sdk-pp-tracking-0.2.0-rc.0.tgz` 与固定身份一致。二者都不重新运行浏览器、模型或远程发布。完整命令和审查记录保存在 `closure/`。

本地 Demo：<http://127.0.0.1:4204/>。下一步为本版本发布：刷新远程状态，经保护分支 CI 后创建不可变 RC tag/预发布 Release，以 `next` 发布并回读 integrity，再验证部署和门户登记。正式版另需稳定性判断。视频/摄像头调度、手机、Safari/Firefox、Worker、NPU、跨摄像头和 Workflow 继续后置。
