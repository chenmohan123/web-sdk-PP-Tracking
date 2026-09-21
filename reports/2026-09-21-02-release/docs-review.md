# Tracking 0.2.0-rc.0 发布文档增量审查

日期：2026-09-21。结论：**审查通过，无阻断项；两项轻微文档问题已在 e783972 修复并复核，可继续 PR 与发布流程。** 本结论不证明远程发布、OIDC 或线上 Demo 已成功。

## 范围与依据

本次是单 SDK 发布文档层审查，基线为 `44ddd21`，对象为当前工作区相对基线的 28 文件增量及 `.tmp/tracking-02-release/release-docs.diff`。遵循 `requesting-code-review/code-reviewer.md` 的审查结构，阅读门户标准入口、文档发布/仓库治理/示例契约，以及此前 `reports/2026-09-21-02-rc/closure/final-review.md`。算法、ReID 实现和历史评测不重复审查。本次除本报告外只读，没有调用远程写入、运行测试套件、重跑评测或修改 Git 状态。

下列文件位置均相对 SDK 根目录 `C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`；行号为本次读取时的工作区内容。

## 优点

- 双语 README 第 5、16、18 行，双语快速开始第 7、10 行及 RC 说明第 5、18、20 行一致使用指定版本 `0.2.0-rc.0`，明确 `next` 为预发布通道、`latest` 保留 `0.1.0`。ORT 1.27.0 仅为 ReID 的可选依赖，与 `package.json:63`、`:67` 的 optional peer 一致。现有 `scripts/release.mjs:37`、`:39`、`:40` 保持已有版本只核验、新 RC 显式使用 `next` 的行为。
- `demo/src/App.tsx:169` 的 npm 链接使用精确版本路径 `/package/web-sdk-pp-tracking/v/0.2.0-rc.0`。四份示例 README 与 Vanilla 页面均统一到 RC 版本，仍消费公开包入口、本地构建，不改变运行行为。
- 双语发布清单第 9、17、25、45 行继续区分历史 alpha 验证、未完成远程交付及历史 0.1.0 回执。变更没有勾选 RC 发布完成，没有将历史 alpha 的 5316 帧指标改称 RC 实测，也未扩大浏览器和手机兼容范围。
- `git diff --name-only 44ddd21 -- src models reports` 为空；历史模型和报告未被改写。

## 问题

### 严重（必须修复）

无。

### 重要（应修复）

无。

### 轻微（已解决）

1. **英文候选说明未同步授权状态。** `docs/en/releases/0.2.0-rc.0.md:35` 仍写“Remote publication still requires explicit authorization for this version”，而 `docs/zh-CN/releases/0.2.0-rc.0.md:35` 和双语 `release-checklist.md:5` 已记载本版本获授权。该遗漏使双语当前状态不等价，容易被误读为还需再次授权。建议明确本版本已获授权、发布完成仍取决于最新提交 CI 与实际回执；保留 OIDC 未实测的边界。

2. **示例对发布清单的位置描述不准确。** `examples/react/README.md:5`、`examples/react/README.en.md:5`、`examples/vanilla/README.md:5`、`examples/vanilla/README.en.md:5` 都写“根目录的发布清单”或“root release checklist”，但根目录没有该清单。实际文件为 `docs/zh-CN/release-checklist.md` 和 `docs/en/release-checklist.md`。建议替换为 `../../docs/zh-CN/release-checklist.md` 或 `../../docs/en/release-checklist.md` 的 Markdown 链接，便于读者直接核对远程状态。

修复复核：实际读取提交 `e783972e65d1ba76bbca8a4a21b1b4aa73f75aca` 的全部 5 行修改。英文候选说明第 35 行现已明确本版本获授权、最新提交 CI 须通过且完成须以实际回执为准；上述四份示例第 5 行现均链接到对应语言的真实发布清单。两项问题均已解决，没有新增问题。这五份文档不在 npm 发行白名单中，不改变已核验 tarball 的身份，无需因此重跑完整套件。

## 轻量验证及证据边界

- 实际读取 `.tmp/tracking-02-release/web-sdk-pp-tracking-0.2.0-rc.0.tgz`：46274 字节，SHA256 为 `fe42d3ee4c5626ad823e8bd16288b079d6bd7dfd07e79fcff4e987ead8509e12`，与本轮 `package-check.json` 一致。包内两份 README 和 package.json 与当前工作区按 LF 归一后字节一致，确实包含本次 README 更新。没有套用历史候选包的大小或摘要。
- 对变更 Markdown 中 168 个本地相对链接检查文件存在性，无缺失目标；这项检查不包含片段锚点或远程 URL 可达性。
- 读取本轮 `verify.log:57`、`:58`、`:155` 起的现有日志：14 文件、176 单测通过，SDK/Demo/两示例构建和实际 tarball 消费已完成，12 组浏览器检查、`pageErrors: []`，运行版本为 `web-sdk-pp-tracking@0.2.0-rc.0`。本审查没有重跑上述套件，也不将日志中的模拟发布测试当作 npm 回执。
- 保留历史审查与评测的原始身份。README 变化会使当前包摘要与旧候选归档不同，这是预期结果；本轮应另存发布包身份，不重写旧证据锁。

## 建议与判定

**可合并：是，无阻断项或未解决审查问题。** 本增量符合 RC 安装与通道准备范围；两项轻微问题已修复并复核。远程 npm、Release、Pages 和 OIDC 的成功必须由协调者在实际执行后独立记录。若之后再改双语根 README，则须重新打包并更新本轮包证据。

## 追加：pnpm 干净安装修复复核

范围为 `e783972..b0c7f24`。协调者报告 PR #3 的 run `35573853704` 因 `ERR_PNPM_IGNORED_BUILDS` 拒绝未明确决策的 protobufjs@7.6.6 安装脚本。本次仅复核配置与已有安装日志，没有重跑套件或远程查询。

- 实际 diff 仅 `pnpm-workspace.yaml:3` 的中文注释及 `:4` 的 `protobufjs: false`。它在 `allowBuilds` 中明确拒绝此依赖的安装构建脚本；原有 `esbuild: true` 保留，没有允许所有依赖脚本，没有关闭未知构建脚本的保护。
- 实际读取锁定的 `node_modules/.pnpm/protobufjs@7.6.6/node_modules/protobufjs/package.json` 和完整 `scripts/postinstall.js`。安装钩子为 `node scripts/postinstall`，只读取包元数据、核对依赖版本约束并可能输出 stderr 提示，没有编译、下载或写入构建产物。因此对此锁定版本跳过该钩子不会遗漏安装所需生成文件。该判断限定于 7.6.6，不自动扩展至未来依赖升级。
- `.tmp/tracking-02-release/install-check.log:2` 确認锁文件无需重新解析，`:4` 记录安装 81 个包，`:27` 记录 `Done in 4.4s using pnpm v11.21.0`，没有未决脚本错误。协调者报告该命令在隔离目录全新执行 frozen install、退出码 0；日志本身支持安装成功，但未单独打印运行命令和退出码，本报告不把这部分执行上下文当作日志独立证明。
- CI、Pages、Release 工作流均固定 pnpm 11.21.0 和 `install --frozen-lockfile`；此次 Git 差异不含 package.json、pnpm-lock.yaml、src 或 dist。配置文件不在 npm 发行白名单中，修复不改变已核验发布包的内容。

**追加判定：通过，无新增严重、重要或轻微问题。** 配置准确解决此依赖脚本未决导致的安装门禁失败，并保留其余脚本执行限制。仍须以 `b0c7f24` 最新提交 CI 的实际成功回执作为合并门禁；本报告不将运行中的 CI 声称为通过。
