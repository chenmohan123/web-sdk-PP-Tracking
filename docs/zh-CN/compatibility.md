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

SDK本地required检查通过仅表示locally-compliant，远程Rulesets/发布/托管状态仍skip。npm、GitHub Release和在线Demo尚未发布；manifest中的计划地址不能作为可用性证据。归档校验不会重新生成可信摘要，篡改样本会失败；当前构建须继续匹配测量入口hash。
