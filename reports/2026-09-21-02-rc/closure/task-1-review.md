# 任务1规格与质量独立审查

规格判定：通过。审查范围为 `1e4d7778c9c57ff3827bc40bc83aff21b1a9043e..99874c7fc89801dd2abfb1d78ad3bd767b6ed4d2` 的完整任务差异，未发现缺项、越界实现或需要阻断的规格偏差。

质量判定：通过；存在1项既有、非阻塞的构建告警。

## 规格与实现证据

- 发布门禁保持完整性核验及已有版本提前返回；新增预发布 `next`、正式版 `latest` 的显式 publish 参数。新测试逐项断言完整参数、已有版本仅一次 `view` 及精确版本标签。证据：`scripts/release.mjs:31`、`scripts/release.mjs:39`、`tests/release.test.ts:8`。
- 当前 package、运行时值及类型、Demo品牌/导出、manifest均升级RC。四处生产源码变化均仅为版本字面量，无算法、模型、预处理或阈值变化。模型0.1.0及历史alpha验证条目保留，完整差异不包含历史reports、models或固定评测脚本。证据：`package.json:3`、`src/tracker.ts:212`、`src/types.ts:39`、`src/reid/ort.ts:24`、`src/reid/types.ts:15`、`demo/src/App.tsx:152`、`sdk-manifest.yaml:33`、`sdk-manifest.yaml:110`。
- 双语候选说明覆盖0.1迁移、算法来源、可选peer、两个入口及分层后端、模型双源与身份、实验限制、未来发布通道和新版本撤回策略；明确旧5316帧属于alpha，未冒认RC重跑。证据：`docs/zh-CN/releases/0.2.0-rc.0.md:5`、`:9`、`:23`、`:25`、`:29`、`:31`、`:35`及英文同名文件对应行；`CHANGELOG.md:3`。
- Demo仅增加简短中英人体实验标签并同步版本；保留既有布局。当前兼容性说明区分桌面390px与移动真机，人工图像接口验证与人体精度验证。证据：`demo/src/ReIdWorkspace.tsx:98`、`docs/zh-CN/compatibility.md:7`、`docs/en/compatibility.md:7`。
- 真实SDK评测适配器单测改为从当前package读取预期版本，历史评测CLI未修改；真实ReID UI脚本新增可选输出目录以保护历史证据，并补充英文桌面和WebGPU截图。证据：`tests/mot17-adapter.test.ts:37`、`tests/reid-demo-browser.mjs:7`、`:63`、`:99`。

## 优点

- 发布通道变更位于已有完整性门禁之后，以最小改动解决RC误入latest的问题，同时保留相同版本只读语义。证据：`scripts/release.mjs:35`、`tests/release.test.ts:17`、`:20`。
- 当前候选说明与历史证据分开，发布清单明确已有勾选来自alpha；未把既有评测或治理回执直接认作RC发布证据。证据：`docs/zh-CN/release-checklist.md:9`、`docs/en/release-checklist.md:9`、`docs/zh-CN/releases/0.2.0-rc.0.md:31`。

## 发现

- 严重：无。
- 重要：无。
- 轻微：`.tmp/tracking-02-rc/verify.txt:120`、`:153`仍有两处Vite超过500kB告警；对应ORT动态JS约847.14kB、WASM约26.8MB（同文件`:114`、`:118`）。这是实施报告已披露的既有依赖资源成本，未由本次版本/发布通道修改引入，不阻断本任务；验证输出不能称为无告警。后续若开展资源优化，应以实际首启成本确定处理方式，不以提高警告阈值替代优化。

## 已核验的验证证据

- 读取RED原始日志：8项中3失败，差异明确为publish缺少`--tag`，其他5项通过。读取GREEN原始日志：8/8通过。证据：`.tmp/tracking-02-rc/release-red.txt:23`、`:48`、`.tmp/tracking-02-rc/release-green.txt:23`。
- 读取完整verify中的结果与构建段：14文件、176测试通过；Demo、Vanilla、React构建成功，浏览器报告无pageErrors。证据：`.tmp/tracking-02-rc/verify.txt:57`、`:58`、`:124`、`:136`、`:157`、`.tmp/tracking-02-rc/browser/report.json:20`。
- 读取实际包消费清单：两个入口ESM/CJS/类型、无ORT消费、optional peer及发行文件白名单检查均列明；包版本与实施报告摘要一致。证据：`.tmp/tracking-02-rc/package-check.json:2`、`:3`、`:4`、`:35`。
- 读取真实生产UI报告：ModelScope/WASM和Hugging Face/WebGPU各完成两帧并保留ID1，CPU关联明确，五组检查及errors为空。证据：`.tmp/tracking-02-rc/reid-demo/report.json:5`、`:12`、`:28`。
- 读取标准after报告：requiredPassed=21、requiredFailed=0、requiredSkipped=4，状态仅为locally-compliant。证据：`.tmp/tracking-02-rc/standard-after.json:8`、`:9`、`:10`、`:16`。
- 未重跑测试、浏览器或固定5316帧评测；未执行git命令，未检索其他业务代码。完整差异分块读取，首次工具总输出截断部分已通过读取差异相应区间补齐，未另读任何已变更源码文件。

## 需协调者核对的边界

- 差异不能证明宿主登录状态未变、绝无远程写入、修改前标准检查、最终归档/源码构建身份及4204常驻服务。这些属于协调者已有或正在完成的证据；本次不把它们认作缺失，也不代替最终整体审查。依据：任务简报“最终验证与归档（主线程）”及实施报告“标准检查”“提交边界与后续”。
- 以上SDK相对路径均以 `C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking` 为根；审查仅新增本报告，无其他文件写入。
