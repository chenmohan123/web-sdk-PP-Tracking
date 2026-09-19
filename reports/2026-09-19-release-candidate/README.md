# 2026-09-19 首版发布候选

本报告只证明本地 `web-sdk-pp-tracking@0.1.0` 候选通过验证，不表示 npm、GitHub Release 或 Pages 已发布。基础为任务 1 提交 `40b56ff85a41fbf7585e100f5ec903cbfc19cfc3`；算法实现和历史报告保持原样。

## 验证

- Windows 11 专业版 10.0.26200、Intel Core i5-10400F、Node 24.16.0、npm 11.13.0、pnpm 11.21.0。
- `npm run verify` 完整执行一次，退出 0：[完整日志](verify.log)。SDK ESM/CJS/声明构建、typecheck、7 文件 50 单测、实际 tarball 消费、Demo typecheck/build、Vanilla/React build 均通过。
- Playwright 1.63.0 / Chromium 153.0.8010.12 的 9 组交互通过，无 pageErrors：[JSON](browser.json)、[桌面](desktop.png)、[390px](mobile.png)。390px 为桌面窄视口，不是手机测试。
- 门户 `sdk:check` 修改前后均退出 0，required 17 pass / 0 fail / 7 skip，recommended 3 pass；算法不适用模型项以及远程规则保留 skip，状态仅 locally-compliant。报告在门户 `reports/sdk-standard/pp-tracking-2026-09-19-release-{before,after}.json`。
- 新发布门禁先写测试再实现：缺少 `scripts/release.mjs` 时定向测试失败；实现后 5 项通过，覆盖标签不符、完整性不符、仅 E404/ENOVERSIONS 缺失、网络/权限错误、真正发布错误、元数据延迟和不重复发布。

完整验证命令：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='F:/git/00_chenmohan/github/web-sdk-PP-Detection/.tmp/dependencies-compatible-browsers'
npm run verify
```

## 唯一候选

[包消费记录](package-check.json)保存发行文件列表、完整性和消费检查。压缩包 16826 字节，解包 57833 字节，13 个文件，无生产依赖。

- 固定本机文件：`F:/git/00_chenmohan/github/web-sdk-PP-Tracking/.tmp/release-candidate-2026-09-19/web-sdk-pp-tracking-0.1.0.tgz`
- SHA256：`fac25d8c0fc394f2b989b94e1448670b386cac3425106c6c8e7f546d2c18180c`
- npm integrity：`sha512-IUmDEq5ZO3f30uxajy0SNQz4UeCipJfKLuX7hHqD9rslVsMo+V8rUFhQHep5wAuiwMveGOoYUvWQUDdMIJYCEg==`

通过 `git -c core.autocrlf=false checkout-index --all --prefix=.tmp/release-lf-checkout/` 从暂存候选建立 LF checkout，复用锁定依赖重新 `npm run build` 和 `npm pack --json`，所得 SHA256、sha512、大小完全相同。所有入包文本（README 中英文、NOTICE、LICENSE、package.json、dist）无 CR 字节。`.gitattributes` 约束 LF 且历史桌面/MOT17 报告使用 `-text`；TypeScript 声明构建显式使用 `--newLine lf`。该实验证明本机候选与 LF checkout 一致，不声称已在 Linux 运行；线上 Linux 发布工作流仍以完整性匹配作为硬门禁。

## 发布边界

工作流先核对 tag，复用 CI 后在固定 `npm` 环境以 npm 11.13.0 发布。不配置占位 NODE_AUTH_TOKEN；由 npm trusted publisher 使用 OIDC。已存在版本仅在 dist.integrity 完全相等时跳过；缺版本仅接受结构化 E404/ENOVERSIONS，其余错误失败。成功 publish 后对暂时缺失的元数据最多查询 30 次、间隔 10 秒，不再次 publish；五分钟内未可见须人工核验。首版手工发布不自动取得 provenance，未来 OIDC 发布申请 provenance，实际状态以回执为准。

真实指标沿用 [MOT17 训练序列报告](../2026-09-19-mot17/README.md)，本次没有重跑真实评测或修改历史摘要。无 ReID、相机运动补偿和移动设备证据；低分续接并非普遍改善精度。下一阶段按本次明确授权执行远程交付并保存证据。
