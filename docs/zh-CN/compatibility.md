# 兼容性

[English](../en/compatibility.md) · [首页](../../README.md)

本地候选验证日期：2026-09-19。环境：Windows11专业版10.0.26200，Intel Core i5-10400F @2.90GHz；Node24.16.0、pnpm11.21.0；Playwright1.63.0桌面Chromium153.0.8010.12。runtime为 `web-sdk-pp-tracking@0.2.0-alpha.0`，实际CPU / JavaScript / main，无GPU/驱动依赖；线上已发布版本仍为0.1.0。

| 范围 | 证据与边界 |
| --- | --- |
| 桌面Chromium | `npm run test:browser` 验证 ByteTrack/OC-SORT 切换、参数互斥、中文/英文、单步、播放暂停、重播、seek、异步导入保护、导入导出、四种合成场景与Vanilla |
| 390px布局 | 桌面浏览器调整视口验证无横向溢出，不等同真实移动设备验证 |
| ESM/CJS/TypeScript | `npm run check:package` 从实际tarball安装并消费 |
| Safari/Firefox/移动设备/微信 | 尚未验证，不声明支持 |
| Worker/WebGPU/WASM/NPU | 首版不实现，不声明兼容 |

截图、浏览器版本和交互计数由 `tests/browser.mjs` 写入 `.tmp/browser/`。这是本地日期化证据，不是线上部署或跨设备兼容承诺。所有示例为合成机制，不证明真实场景MOT精度。

当前候选的[完整 verify 原始日志](../../reports/2026-09-19-ocsort/verification/task-2-verify.txt)和[10 组浏览器检查原始日志](../../reports/2026-09-19-ocsort/verification/task-2-browser-green.txt)覆盖 ByteTrack/OC-SORT；截图仍在忽略目录。`2026-09-19-desktop` 与 `2026-09-19-release-candidate` 目录只属于已发布 0.1.0 的历史证据。另一份同日 Chromium151.0.7922.34 headless 证据仅覆盖 10/50/100 框合成性能，不能替代候选 Chromium153 的 10 组产品交互验证。它们均为同一 Windows/CPU 环境、CPU/main；不存在真实手机验证。

同日[两算法候选对比](../../reports/2026-09-19-ocsort/README.md)固定 Node 七段 MOT17 FRCNN 训练序列 5316 帧及两算法各自的 Chromium153 完整 02 序列 600 帧对齐；ByteTrack 历史默认/消融证据仍见[0.1.0 真实序列报告](../../reports/2026-09-19-mot17/README.md)。范围仍限上述 Windows 桌面 CPU/main；真实数据指标不扩展设备兼容性，也不构成测试集排行榜成绩。

SDK 本地 required 检查通过仅表示 locally-compliant；离线检查器不验证远程 Rulesets、发布或托管。候选完整 verify 使用上方 `2026-09-19-ocsort/verification` 日志；[0.1.0 验证记录](../../reports/2026-09-19-release-candidate/README.md)和[首版交付记录](../../reports/2026-09-19-release/README.md)仅证明历史发布包、GitHub Release、治理、Pages 部署和线上 Demo。线上 Demo 证据仍是同日桌面 Chromium 153 与 CPU/main，不扩展手机、Safari、Firefox、微信或其他后端兼容性。历史归档校验须运行 `node scripts/evaluation/verify-archive.mjs --sdk <匹配历史提交及构建的独立目录>`；它固定旧入口 hash、不会重新生成可信摘要，故当前候选目录被拒绝是预期行为。各次记录独立保留，不覆盖历史桌面和 MOT17 报告。
