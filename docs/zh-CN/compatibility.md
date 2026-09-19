# 兼容性

[English](../en/compatibility.md) · [首页](../../README.md)

本地验证日期：2026-09-19。环境：Windows11专业版10.0.26200，Intel Core i5-10400F @2.90GHz；Node24.16.0、pnpm11.21.0；Playwright1.63.0桌面Chromium153.0.8010.12。runtime为 `web-sdk-pp-tracking@0.1.0`，实际CPU / JavaScript / main，无GPU/驱动依赖。

| 范围 | 证据与边界 |
| --- | --- |
| 桌面Chromium | `npm run test:browser` 验证中文/英文、单步、播放暂停、重播、seek、导入导出、四种合成场景与Vanilla |
| 390px布局 | 桌面浏览器调整视口验证无横向溢出，不等同真实移动设备验证 |
| ESM/CJS/TypeScript | `npm run check:package` 从实际tarball安装并消费 |
| Safari/Firefox/移动设备/微信 | 尚未验证，不声明支持 |
| Worker/WebGPU/WASM/NPU | 首版不实现，不声明兼容 |

截图、浏览器版本和交互计数由 `tests/browser.mjs` 写入 `.tmp/browser/`。这是本地日期化证据，不是线上部署或跨设备兼容承诺。所有示例为合成机制，不证明真实场景MOT精度。

原始JSON与完整verify日志已归档至[桌面验收目录](../../reports/2026-09-19-desktop/README.md)，截图仍在忽略目录。另一份同日Chromium151.0.7922.34 headless证据仅覆盖10/50/100框合成性能，不能用它替代153版本的9组产品交互验证。两者均为同一Windows/CPU环境、CPU/main；不存在真实手机验证。

同日[真实序列报告](../../reports/2026-09-19-mot17/README.md)增加Node七段MOT17 FRCNN训练序列5316帧默认/消融及完整重复运行；Chromium153.0.8010.12的02序列600帧与Node非耗时结果逐字相同。范围仍限上述Windows桌面CPU/main；真实数据指标不扩展设备兼容性，也不构成测试集排行榜成绩。

SDK 本地 required 检查通过仅表示 locally-compliant，远程 Rulesets/发布/托管状态仍 skip。0.1.0 当前为发布候选；npm、GitHub Release 和在线 Demo 需以日期化远程回执核验，manifest 地址不能作为可用性证据。归档校验不会重新生成可信摘要，篡改样本会失败；当前构建须继续匹配测量入口 hash。候选打包与当前完整 verify 使用单独的发布候选证据，不覆盖历史桌面和 MOT17 报告。
