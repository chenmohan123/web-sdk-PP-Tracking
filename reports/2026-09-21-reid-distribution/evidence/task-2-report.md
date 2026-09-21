# Task 2：公开 ReID 子入口报告

状态：实现与聚焦验证完成；等待主线程整体审查和最终验证。未发布 npm，未修改 GitHub 或线上 Demo。

本地提交：`1f67da9`（公开可选 ReID 子入口并接入真实双源注册）；仅提交本任务上述 10 个文件，共享 index 未包含父线程文件。

## API 与包行为

- 新增 `web-sdk-pp-tracking/reid`，提供独立 ESM、CommonJS 与类型声明。
- 新增 `getReIdModelSource(kind = 'modelscope'): ReIdSource`，支持 `modelscope` / `huggingface`，每次返回独立冻结快照，未知来源同步抛出 `INVALID_MANIFEST`。
- `createReIdExtractor({ modelId: 'pplcnet-reid-fp32', backend: 'wasm' })` 默认 ModelScope；`source` 同时接受两个来源字符串和原有显式 `ReIdSource`。
- `modelBytes` 仍独立可用，并与显式来源或字符串来源互斥；自定义 HTTPS 来源和现有完整性约束保留。来源失败不自动换源。
- 来源直接读取主线程的 `models/pplcnet-reid/0.1.0/sources.json`；模型大小、SHA、输入输出名称及特征空间元数据直接读取 `model.json`。注册没有手抄 revision 或下载地址。
- 真实 MS revision：`dc3d9f7a97be4033e654525f0e9d3fbd5eaf7c9b`；HF revision：`02c299b5b5618315fc754002b7ea7c95c95e8a82`。两者为 33704835 字节、SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`。主线程负责匿名下载证据。
- ORT Web 1.27.0 保留为开发依赖，并增加 optional peer；只有模型 load 到达会话阶段时动态导入。根入口运行时导出仍严格只有 `TrackingError` 和 `createTracker`。

## 本任务文件

- `src/reid/sources.ts`：来源查询与冻结快照。
- `src/reid/index.ts`、`types.ts`、`model.ts`：公开 API、默认来源和互斥参数、单一模型身份数据。
- `tests/reid-sources.test.ts`：8 项新增行为测试。
- `scripts/build.mjs`：两个入口各自产出 ESM/CJS；仅 ReID bundle external ORT；JSON 融入 bundle，声明临时生成并补全相对导入扩展名，使 NodeNext 可消费；模型目录不进入包。
- `scripts/check-package.mjs`：实际打包后在系统临时目录解包消费；验证两个格式、两个入口、NodeNext `.mts` / `.cts` 类型、无 ORT 时的根调用及 ReID 工厂/释放、原图/模型文件排除及 optional peer 声明。
- `scripts/build-reid-candidate.mjs`：主线程明确授权的必要兼容修正，增加 JSON 模块与 rootDir，保留历史独立候选构建；类型产物位于 `.tmp/reid-module/dist/types/src/reid/`。
- `package.json`、`AGENTS.md`：导出映射、可选 peer 与仓库入口约定。
- 已运行 lockfile-only 安装，`pnpm-lock.yaml` 无内容变化，因为 ORT 1.27.0 已是锁定开发依赖。

未修改父线程的 models、manifest、docs、reports 或 Demo。此次代码提交依赖主线程正在提交的真实 models JSON 文件。

## 红绿与命令证据

SDK 根目录 S：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`。下列日志路径均相对 S；所有 pnpm 命令均带 `--config.verify-deps-before-run=false --config.manage-package-manager-versions=false`。

| 命令 | 退出码 | 日志与结果 |
| --- | --- | --- |
| `pnpm <两配置> test tests/reid-sources.test.ts` | 1 | `.tmp/task-2/sources-red.log`：8 项失败，缺少 `getReIdModelSource` API |
| `pnpm <两配置> build`（基线） | 0 | `.tmp/task-2/baseline-build.log` |
| `pnpm <两配置> check:package`（红测） | 1 | `.tmp/task-2/package-red.log`：缺少 ReID 子入口双格式或类型 |
| `pnpm <两配置> install --lockfile-only --ignore-scripts` | 0 | `.tmp/task-2/lockfile.log`：Already up to date |
| `pnpm <两配置> test tests/reid-sources.test.ts tests/reid-lifecycle.test.ts tests/reid-preprocess.test.ts` | 0 | `.tmp/task-2/unit-green.log`：3 文件、49 项通过 |
| `pnpm <两配置> typecheck` | 0 | `.tmp/task-2/typecheck.log` |
| `pnpm <两配置> build` | 0 | `.tmp/task-2/build.log` |
| `pnpm <两配置> build:reid-candidate` | 0 | `.tmp/task-2/candidate-build.log` |
| `pnpm <两配置> check:package` | 0 | `.tmp/task-2/package-green.log`；结构化结果 `.tmp/package-check.json` |
| `git diff --check` | 0 | 无空白错误 |

来源测试覆盖默认 MS、显式 MS/HF、未知查询与工厂、快照改写、两个源固定同一身份、本地 bytes 互斥、原有显式 source 及工厂入口复制、下载失败无静默换源。现有 37 项生命周期和 4 项预处理测试保持通过。

实际 npm pack 产物为 `web-sdk-pp-tracking-0.2.0-alpha.0.tgz`，本次检查大小 44606 字节、解包 148693 字节。隔离消费目录不在工作树下，通过 `require.resolve` 明确确认 ORT 不存在；两入口 ESM/CJS 运行与 NodeNext 类型消费均通过，未链接测试 peer。公开声明的可达依赖不依赖 ORT 类型；包中内部 `ort.d.ts` 没有从公开声明入口引用。

没有运行完整 verify 或真实浏览器测试，按任务分工由主线程统一完成。主线程已记录 SDK checker 修改前 17/0，修改后检查也由主线程统一负责。当前结论只覆盖本地打包和上述测试，不表示已发布或新增浏览器兼容承诺。
