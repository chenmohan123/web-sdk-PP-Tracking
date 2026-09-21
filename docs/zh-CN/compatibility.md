# 兼容性

[English](../en/compatibility.md) · [首页](../../README.md)

本地候选验证日期：2026-09-19。环境：Windows11专业版10.0.26200，Intel Core i5-10400F @2.90GHz；Node24.16.0、pnpm11.21.0；Playwright1.63.0桌面Chromium153.0.8010.12。runtime为 `web-sdk-pp-tracking@0.2.0-alpha.0`，实际CPU / JavaScript / main，无GPU/驱动依赖；线上已发布版本仍为0.1.0。

下表保留2026-09-19的CPU关联器证据。2026-09-21已将[可选ReID子入口](reid-candidate.md)接入本地发布候选：同机 Chromium153、ORT Web1.27.0、RTX5060Ti（驱动32.0.16.1692）通过真实ModelScope/Hugging Face各WASM/WebGPU共四组下载、SHA校验和512维提取；GPU为非fallback适配器。模型后端和CPU关联后端分别报告，见[当前阶段报告](../../reports/2026-09-21-reid-distribution/README.md)。npm及线上Demo仍为0.1.0。

| 范围 | 证据与边界 |
| --- | --- |
| 桌面Chromium | `npm run test:browser` 验证 ByteTrack/OC-SORT/DeepSORT 切换、参数互斥、外观包装导入与失败原子性、实际参数/特征空间/序列导出、中文/英文、单步、播放暂停、重播、seek、四种合成场景与Vanilla |
| 390px布局 | 桌面浏览器调整视口验证无横向溢出，不等同真实移动设备验证 |
| ESM/CJS/TypeScript | `npm run check:package` 从实际tarball安装并消费三种算法，运行时导出白名单不变 |
| Safari/Firefox/移动设备/微信 | 尚未验证，不声明支持 |
| 算法Worker/GPU/WASM/NPU | 根算法仍只实现CPU/main；可选模型的WASM/WebGPU不改变关联后端 |
| 可选模型Worker/NPU | 尚未实现，不声明兼容 |

截图、浏览器版本和交互计数由 `tests/browser.mjs` 写入 `.tmp/browser/`。这是本地日期化证据，不是线上部署或跨设备兼容承诺。所有示例为合成机制，不证明真实场景MOT精度。

2026-09-19三策略候选的完整 verify 原始日志保存于 `reports/2026-09-19-deepsort/verify.txt`，当时包含11组浏览器检查。`2026-09-19-ocsort` 只证明此前两策略候选；`2026-09-19-desktop` 与 `2026-09-19-release-candidate` 只属于已发布0.1.0历史证据。Chromium151 headless仅覆盖10/50/100框合成性能。2026-09-21新增[真实时间序列证据](../../reports/2026-09-21-mot-reid/README.md)：同机Chromium153/ORT1.27.0/RTX5060Ti WebGPU提取全部5316帧、67639检测，三算法CPU/main均与Node两次结果一致、零容量丢弃。固定02前30帧433检测的WASM/WebGPU最大向量差3.5763e-7、三算法结果一致；该子集不是全量WASM评测。没有真实手机或新增跨设备结论。

同日[两算法候选对比](../../reports/2026-09-19-ocsort/README.md)固定 Node 七段 MOT17 FRCNN 训练序列 5316 帧及两算法各自的 Chromium153 完整 02 序列 600 帧对齐；ByteTrack 历史默认/消融证据仍见[0.1.0 真实序列报告](../../reports/2026-09-19-mot17/README.md)。范围仍限上述 Windows 桌面 CPU/main；真实数据指标不扩展设备兼容性，也不构成测试集排行榜成绩。

SDK 本地 required 检查通过仅表示 locally-compliant；离线检查器不验证远程 Rulesets、发布或托管。本次三策略候选使用上方 `2026-09-19-deepsort` 日志；[0.1.0 验证记录](../../reports/2026-09-19-release-candidate/README.md)和[首版交付记录](../../reports/2026-09-19-release/README.md)仅证明历史发布包、GitHub Release、治理、Pages 部署和线上 Demo。线上 Demo 证据仍是同日桌面 Chromium 153 与 CPU/main，不扩展手机、Safari、Firefox、微信或其他后端兼容性。历史归档校验须运行 `node scripts/evaluation/verify-archive.mjs --sdk <匹配历史提交及构建的独立目录>`；它固定旧入口 hash、不会重新生成可信摘要，故当前候选目录被拒绝是预期行为。各次记录独立保留，不覆盖历史桌面和 MOT17 报告。
