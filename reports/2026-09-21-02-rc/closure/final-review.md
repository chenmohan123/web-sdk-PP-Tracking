# Tracking 0.2 RC 最终整体独立审查

日期：2026-09-21。结论：**本地交付通过，无严重或重要阻塞项；不是远程发布通过。**

## 范围与依据

本次按 `requesting-code-review/code-reviewer.md` 审查计划符合性、代码质量、架构、验证与发布准备。SDK 范围为 `1e4d777..a51f0b0`，门户范围为 `93b8814..0535ad1`，涵盖本轮产品变更、候选身份与证据归档、门户规划和回执。没有重新审查此前已验收的算法实现。

引用前缀：`S` 为 `C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`；`P` 为 `C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io`；`R` 为 `S/reports/2026-09-21-02-rc`。已读取门户标准入口、SDK/门户/文档发布契约、本轮计划、任务实施与独立审查报告，并分块阅读本轮产品和文档差异及关键原始证据。

## 优点与计划符合性

- 发布通道修改集中在实际 publish 调用：预发布为 `next`，正式版为 `latest`；在版本完整性相同的提前返回之后计算 tag，因此已有版本只发生 `view`。精确 Git 标签、完整性不匹配拒绝、结构化缺失判断及发布后重试门禁保留。新增用例断言完整 publish 参数和已有版本的只读调用序列。依据：`S/scripts/release.mjs:31`、`:35`、`:39`，`S/tests/release.test.ts:8`、`:17`、`:20`。
- 包、运行时值及类型、Demo、manifest 当前声明均为 `0.2.0-rc.0`；图像模式新增简短人体实验标签。没有运行时重构、算法变更或将推理实现复制进门户。ByteTrack 默认、其他策略显式选择、可选 ORT 和 ReID 独立入口边界不变。依据：`S/package.json:3`、`S/src/tracker.ts:212`、`S/src/reid/ort.ts:24`、`S/demo/src/ReIdWorkspace.tsx:98`、`S/sdk-manifest.yaml:110`。
- 双语候选说明交代从 0.1 迁移、两个模块及后端、模型原始版本/revision/SHA/许可、人工图像与手机限制、未来发布通道和以新版本撤回。没有将历史 alpha 的七段 5316 帧成绩改称 RC 实测。依据：`S/docs/zh-CN/releases/0.2.0-rc.0.md:5`、`:9`、`:23`、`:25`、`:29`、`:31`、`:35`及英文对应文件。
- 本地和远程清单状态分开。RC PR/CI、tag、预发布 Release、npm/OIDC、目标 Demo 部署和门户登记仍未勾选；只读远程响应支持既有 0.1.0 的状态，不被当作新版本发布成功。依据：`R/release-checklist.md:15`、`R/remote-preflight.md:17`、`:19`。门户仅改规划与回执，`src` 在本轮范围没有差异，生产 registry 保持 0.1。

## 发现

### 严重

无。

### 重要

无。未发现归档身份、版本声明、发布通道或验证范围的阻塞性不一致。

### 轻微与既有限制

- 既有 ORT 动态分块超过 500 kB，Demo 与 React 构建各出现一次 Vite 提示：`R/logs/verify.txt:120`、`:153`；JS 约 847.14 kB，WASM 约 26.8 MB。`R/README.md:27`已准确披露，未由本次变更引入，不阻断本地候选。后续性能工作应测量首启成本后决定优化方式。
- 门户构建的 7 项既有 hints 已如实保留，最终诊断为 0 errors、0 warnings，生成 21 页；依据 `P/reports/tracking/2026-09-21-02-rc/portal-build.log:39`、`:82`。本轮没有修改相关旧脚本或 schema，不作为本轮新增问题。

## 身份与归档复核

本审查实际运行 `node reports/2026-09-21-02-rc/verify.mjs --current`，退出 0，49 份归档、66 份当前文件以及当前 `.tmp/web-sdk-pp-tracking-0.2.0-rc.0.tgz` 的字节数、SHA256、sha512 integrity 均通过。包为 46313 字节，SHA256 为 `fa082976517c4d767a36d59388661a82d3759507e334a71093e7addb1ea54076`。

额外只读检查逐一计算最终 SDK 提交 `a51f0b0` 内 49 份归档 Git blob 的 SHA256，并与锁文件比较；全部一致。锁覆盖该归档目录除锁本身外的全部已提交文件，不存在遗漏。`.gitattributes` 保持本阶段报告原始字节，避免行尾转换损坏证据。依据：`S/.gitattributes:6`、`R/evidence.lock.json`、`R/verify.mjs:27`。

另外从 Git 读取源码等价记录列出的全部 17 份源码在 `0194ea5` 与 `99874c7` 两端的 blob，计算哈希并与记录逐项比较，全部一致。代码差异仅为四份文件的版本标识，模型未改变；从实现提交 `99874c7` 到归档提交 `a51f0b0` 的 src/models/demo/package/scripts/tests/README 无差异。因此 `identity.commit` 固定实现提交而不是后续归档提交是正确分工，不属于身份过期。依据：`R/identity.json:4`、`R/runtime-equivalence.json`、`R/runtime-diff.patch`、`R/closure/identity-generation.mjs:28`。

归档生成脚本在构建后读取源码、模型、构建及包记录并固定身份；只读校验脚本默认验证归档和记录关系，`--current` 才另外核对当前文件及包。其输出明确为哈希和版本等价记录检查，不声称重新运行模型、浏览器、MOT 或发布。依据：`R/verify.mjs:28`、`:44`、`:53`、`R/README.md:38`。归档生成脚本本次只读取审查，没有执行或重写历史证据。

## 验证证据与边界

- 原始完整 verify 日志记录 14 文件、176 单测全部通过，SDK/Demo 类型和构建、Vanilla/React 构建、真实包消费及 12 组浏览器检查通过，pageErrors 为空；包清单包含 ESM/CJS、两入口 NodeNext 类型和不安装 ORT 的隔离消费检查。依据：`R/logs/verify.txt:57`、`:58`、`R/package-check.json:35`、`R/browser/report.json`。发布单测中的成功发布输出来自注入执行器，不是实际 npm/OIDC 上传证据。
- 真实模型报告记录 ModelScope/WASM、Hugging Face/WebGPU 的实际会话及 CPU 关联，五组交互检查通过、errors 为空。输入明确为人工生成图片和人工框，390px 为桌面视口，不能外推人体质量或移动真机兼容。依据：`R/reid-demo/report.json:4`、`:5`、`:12`、`:28`。
- 前后标准报告均为 21 required 通过、0 失败、4 skip、locally-compliant。本审查逐字段比较 SDK 与门户的 before/after 副本，完全一致。该结果是标准静态校验，不替代实际运行与远程交付。
- 只读审查 npm、Rulesets、环境策略、Pages、部署与 Release 原始响应：npm 仅 0.1.0/latest，无 next；两项规则 active、无 bypass；Pages run/部署提交及成功时间与说明一致；既有 Release 为 v0.1.0。没有重新发起 gh 或 npm 远程查询，远程结论限定于归档时点。
- 没有重复完整测试、浏览器、模型推理或 5316 帧评测，也没有执行发布。旧 MOT 32 份归档及公式复核通过属于协调者已有回执，本次未把它表述为重新测量。工作区干净、原用户文件和账号状态保持由协调者另行核对，本报告不把静态 diff 当作该类操作历史的独立证明。

## 交付判定与建议

**可本地交付：是。** 本轮实现满足候选版本与通道规则，已执行验证的原始回执、固定包、源码/构建身份和归档锁彼此一致。当前无须为一般性信心重复运行完整套件。

最终审查归档和计划收尾属于协调者剩余文档动作；若将本报告加入 SDK 归档目录，应按现有流程更新证据锁并再做轻量哈希核验。后续远程发布须按未勾选清单逐项取得版本实际回执，不能沿用本报告声称 RC 已发布或 OIDC 已成功。
