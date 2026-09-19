# Task 2：DeepSORT Demo、打包与双语文档报告

日期：2026-09-19  
SDK 工作树：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`  
基线：`28cb83a4b319e5822df8e1a38fb95e26e5861a04`（Task 1 核心已审查）  
提交：`fc3adebb7630b0d53c9831cc96ee57b56bb6f143`。

## 完成范围

- Demo 增加 DeepSORT 选择和专用参数，选项文字保持简短；内置样例的框和外观向量均明确为原创合成数据。
- `prepareSequence(value, algorithm, currentOptions)` 保留既有 `{frames}` 包装格式，支持可选顶层 `featureSpace`，深复制 frame/embedding，并在临时 tracker 中完整验证后返回可提交对象；每 100 帧让出一次浏览器主线程。
- 未声明顶层特征空间时，只从所有帧一致的 `featureSpaceId` 和有效向量维度推导；空检测或无向量序列无法推导时失败，不为用户数据补造 embedding。
- `Playback.replace` 和 UI 切换/导入仅在准备成功后替换实例、配置和序列；非法末帧、无向量切换或读取竞态保留此前配置、序列、结果、时间与算法。
- 初始会话也保存实际 ByteTrack 默认配置；导出包含实际算法、已应用选项、特征空间、可重新导入的原序列和本轮结果。
- 实际 npm tarball 的 ESM、CommonJS、`.mts`、`.cts` 均消费 ByteTrack、OC-SORT、DeepSORT；运行时导出白名单仍只有 `createTracker`、`TrackingError`。
- 更新 manifest、NOTICE、CHANGELOG、README 及既有中英 API、算法、快速开始、排错、隐私、性能、兼容性和两份清单。版本保持 `0.2.0-alpha.0`，线上 npm/HTTPS Demo 仍说明为 `0.1.0`。
- 未修改核心 `src/`、旧历史报告、门户生产 registry；未执行远程写操作。

## TDD 证据

RED 命令：

```text
npm test -- --run tests/demo.test.ts
```

首次结果：退出码 1；新增 3 项失败、既有 5 项通过。三项均因 `prepareSequence is not a function` 失败，证明测试针对缺失的导入准备行为。完整原始输出：

- `S/reports/2026-09-19-deepsort/task-2-red-demo-test.txt`

随后分轮固定并实现：包装对象/向量深复制、非法末帧不影响现有回放、旧无向量 ByteTrack 输入、特征空间推导、空/无向量拒绝、三算法默认准备、专用字段隔离、初始实际配置。聚焦 GREEN 最终为 `12/12`。

浏览器先失败后实现：扩展脚本后首次在 `selectOption('deepsort')` 等待超时，因为选择器尚无第三选项。实现后发现并修复非 DeepSORT 返回配置误带 `featureSpace` 的提交错误；对应单测先得到 `1 failed / 11 passed`，修复后 `12/12`。最终浏览器为 11 组通过、`pageErrors=[]`。

## 验证结果

最终完整命令：

```text
npm run verify
```

最终退出码 `0`，原始 stdout/stderr：

- `S/reports/2026-09-19-deepsort/verify.txt`
- 首次完整验证因测试从根 tsconfig 导入 TSX 而出现 `TS6142`，保留于 `S/reports/2026-09-19-deepsort/verify-attempt-1-failed.txt`；纯 `optionsFrom` 后移入无 React 依赖的数据模块并复跑通过。

最终摘要：

- SDK build/typecheck：通过。
- Vitest：9 个文件、102 项全部通过。
- 实际 tarball：三算法 ESM/CJS/TypeScript 消费、发行文件白名单、零生产依赖通过；`.tmp/package-check.json` 记录 SHA256 `58eaf180579d0bdfae0351513978b7a6dff189aa22a921c1c945082977a5f739`。
- Demo typecheck/build、Vanilla build、React build：通过。
- Chromium `153.0.8010.12` / Windows / CPU main：11 组通过、无页面异常；报告为 `S/.tmp/browser/report.json`，截图含 `deepsort.png`、`mobile.png` 等 6 张。
- 390px 为桌面浏览器窄视口验证，不是手机实测；长 feature-space id 中英文均无横向溢出。

## 标准检查基线

- 门户 `tracking-deepsort-before-20260919.json` 是 Task 1 核心前、`1982e87` 阶段的修改前基线。
- `S/reports/2026-09-19-deepsort/sdk-check-before.txt` 是 Task 2 开始前检查，已包含核心提交 `28cb83a`；结果 `locally-compliant`、required failed 0、required skipped 7。
- Task 2 提交后的门户 checker 由协调者统一执行并写入新的门户报告，本任务没有伪装成远程合规结论。

## 自审与关注点

- 输入准备和会话替换边界清晰：先解析/深复制，临时 tracker 全序列验证，成功后创建真实实例并一次提交。
- ByteTrack/OC-SORT 返回选项不携带 DeepSORT 专用字段；DeepSORT 导入用声明或推导出的特征空间覆盖当前空间。
- 用户数据从不生成 embedding；非 DeepSORT 旧 `{frames}` 输入保持可用。
- 默认参数由 `DEMO_DEFAULT_PARAMETERS` 单一来源生成 UI 草稿和实际默认配置，避免展示值与执行值漂移。
- 当前 DeepSORT 证据仅覆盖原创合成向量、契约、打包和浏览器交互。没有内置 ReID 模型、真实 appearance 精度或新跨设备性能证据；历史 MOT17 两策略报告保持原样并明确不能外推。
- 协调者已独立运行 4204 预览 smoke，确认两条 tracked 轨迹、无页面异常和 390px 中英文无溢出；长算法选项据此缩短为 `DeepSORT`，合成说明保留在样例信息。

## 提交

本地提交 `fc3adebb7630b0d53c9831cc96ee57b56bb6f143`（`完善 DeepSORT Demo 与文档`）；无 push、PR、发布或部署。

## 审查修复 1：样例切换不得应用参数草稿

审查发现 `switchSample` 把尚未提交的表单 `parameters` 传给 `optionsFrom`，使编辑草稿后切换样例会静默改变实际 tracker 配置。修复为样例准备始终沿用 `session.options`；只有参数表单 submit 会把草稿转换为生效配置。内置样例仍在输入顶层声明 `SYNTHETIC_FEATURE_SPACE`，因此从自定义 DeepSORT 空间切回内置样例时，`prepareSequence` 会用合成空间覆盖旧空间。

RED：在 OC-SORT 生效值 `ocmWeight=0.2` 时把草稿改为 `0.9`，不点击应用而切换样例、单步并导出。`npm run test:browser` 退出码 1，断言明确得到 `0.9 !== 0.2`。原始日志：`S/reports/2026-09-19-deepsort/task-2-fix-1-red.txt`。

GREEN：

- `npm run typecheck:demo && npm run build:demo`：退出码 0，日志 `S/reports/2026-09-19-deepsort/task-2-fix-1-typecheck-build.txt`。
- `npm run test:browser`：退出码 0，11 组检查通过、`pageErrors=[]`，日志 `S/reports/2026-09-19-deepsort/task-2-fix-1-browser-green.txt`。
- 浏览器回归同时确认：切换样例后仍导出 `ocmWeight=0.2`；自定义 2D DeepSORT 空间导入后切内置样例，导出恢复 `pp-tracking-demo-synthetic-appearance-v1-original-vectors` / 4D；非法末帧继续保留该内置会话。

修复提交：`5b7c714ff225165b11c67906089a11f6ecd8d8fe`（`修复样例切换误用参数草稿`）。未重跑完整 verify，未修改历史 `verify.txt`，未执行远程操作。
