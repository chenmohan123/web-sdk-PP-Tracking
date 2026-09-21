# 最终修复回执

日期：2026-09-21。范围：单 SDK 的 Demo UI、针对性生产浏览器回归及中文算法导言；本次为唯一最终修复波次。

SDK 工作树：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`。
提交：`8126365732b8bec9297ad6050862951d2babe978`（修复 ReID 缓存估算竞态并明确加载语义），基线 `3517d2c`。

## 发现处置

- F1 已修复：`demo/src/ReIdWorkspace.tsx` 双语加载组标题改为“本轮加载检查 / 会话复用”及“Current load check / session reuse”，明确显示本轮幂等调用，未改变加载逻辑或保存首载历史。
- F2 已修复：独立 `cacheRequest` 序号只允许最新估算更新用量、错误和忙碌状态；清理开始和卸载使旧请求失效。切源、复位或清理进行时禁止手动刷新用量，避免过渡中的新估算。未改动 `src` runtime。
- F3 接受现状：生产构建 ORT 惰性 chunk 847.14 kB、gzip 204.48 kB，仍触发 Vite 默认 500 kB 提示。延续已有真实默认路径不请求引擎的证据；不把提示当构建失败，不提高阈值、不做无收益拆分。
- F4 已修复：`docs/zh-CN/algorithm.md` 导言改为“根入口不加载特征提取模型，无运动补偿”，与英文根入口限定一致。

## 聚焦红绿验证

新增 `tests/reid-cache-ui-browser.mjs` 使用现有 Playwright 和 Vite preview，消费实际生产构建。页面使用真实 CacheStorage 中的 1 MiB / 2 MiB 响应，只在浏览器 API 边界增加可控延迟，不替换 React 组件、SDK 估算逻辑或控制器；无模型下载、无需新增测试框架。

修复前执行 `node tests/reid-cache-ui-browser.mjs`，退出 1，准确失败于“旧估算不得清除新估算的忙碌状态”：实际 false、预期 true。修复后执行相同命令退出 0，最终脚本增加 JSON 输出后再执行一次，仍退出 0。覆盖：

1. 手动估算与复位后的新估算重叠，旧估算先结束不能提前解锁刷新按钮。
2. 延迟一 MiB 缓存响应，切源后新估算显示二 MiB，旧响应迟到不得覆盖。
3. 重叠估算后完整清理到零，旧缓存响应迟到不得恢复旧用量。
4. 卸载、重新挂载后旧响应不得污染新工作台；浏览器错误 0。

日志：S/`.tmp/reid-distribution/final-fix-cache-ui.log`；结构化回执：S/`.tmp/reid-distribution/final-fix-cache-ui.json`。由主线程纳入最终归档。

## 检查命令与结果

所有 pnpm 命令均使用 `--config.verify-deps-before-run=false --config.manage-package-manager-versions=false`。

- 门户前、后各执行 `pnpm <两配置> sdk:check -- --repo <SDK工作树>`：均退出 0，locally-compliant，required fail 0、skip 4、unknown 0，recommended fail 0。
- SDK 执行 `pnpm <两配置> test tests/reid-demo.test.ts`：退出 0，11/11 通过。
- SDK 执行 `pnpm <两配置> typecheck:demo`：退出 0。
- SDK 执行 `pnpm <两配置> build:demo`：退出 0，38 模块；ORT 体积提示如 F3 所述。
- SDK 执行 `git diff --check`、`git diff --cached --check`：均退出 0。

仅提交上述 UI、中文文档和新增浏览器测试三个文件。未重跑完整 verify 或四组合真实来源矩阵，未更改模型身份、分发记录、根 dist 或 reports/evidence。提交后剩余未跟踪项仅为主线程写入的 `reports/2026-09-21-reid-distribution/evidence/final-review.md`。最终身份锁、归档、审查回执及真实生产 UI 两后端回归由主线程继续完成；不据本聚焦回归扩展兼容性或真实 MOT 精度结论。
