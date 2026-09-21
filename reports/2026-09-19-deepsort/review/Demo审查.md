### 规格符合性

- ❌ 存在问题：样例切换没有沿用当前已生效配置，而是把参数表单草稿直接转成配置并提交。`demo/src/App.tsx:129` 将 `parameters` 传给 `optionsFrom`，所以用户只编辑参数但未点击“应用”，随后切换样例时，这些草稿也会通过 `session.replace` 成为实际配置；导出又会在 `demo/src/App.tsx:150` 如实输出这个意外生效的配置。这违反了“草稿与实际配置分离、导出实际参数”的要求。
- ⚠️ 无法仅从本 diff 验证：Task 1 的 DeepSORT 核心契约、图库与匹配实现不在本任务 diff 中；本任务只消费其接口，协调信息称 Task 1 已独立审查通过。门户侧 after checker（17 项 required）和 4204 独立预览 smoke 也属于协调者收尾证据，不在本审查包内；本报告将它们列为跨任务项，不据此扩大本任务结论。

### 优点

- `demo/src/data.ts:106` 先深复制并解析输入，再用临时 tracker 逐帧完成算法校验；`demo/src/data.ts:114` 到返回前始终通过 `finally` 释放临时实例。`demo/src/playback.ts:34` 先成功创建新 tracker，再替换序列、配置和特征空间，导入失败不会部分提交会话。
- `demo/src/App.tsx:113`、`demo/src/App.tsx:126`、`demo/src/App.tsx:138` 为算法切换、样例切换和文件导入使用同一递增请求号，并在提交前于 `demo/src/App.tsx:118`、`demo/src/App.tsx:130`、`demo/src/App.tsx:143` 检查新旧请求，过期异步结果不会覆盖较新的操作。
- `demo/src/data.ts:87` 仅从所有帧一致的空间标识和实际向量维度推导特征空间；无向量时拒绝，且 `tests/demo.test.ts:76` 明确验证不补造 embedding。旧无向量 ByteTrack 包装由 `tests/demo.test.ts:51` 覆盖。
- `demo/src/App.tsx:142` 的文件导入沿用 `session.options`，`demo/src/App.tsx:150` 导出实际会话配置、特征空间、原序列和结果；`tests/browser.mjs:74` 到 `tests/browser.mjs:76` 检查 DeepSORT 生效参数与特征空间，非法末帧和语言切换的会话保留证据记录于 `tests/browser.mjs:97`。
- `scripts/check-package.mjs:27` 保持运行时导出白名单，`scripts/check-package.mjs:29` 到 `scripts/check-package.mjs:48` 从实际 tarball 消费 ByteTrack、OC-SORT、DeepSORT 的 ESM、CJS、`.mts` 和 `.cts`，`scripts/check-package.mjs:53` 继续断言零生产依赖。
- 文档范围和证据边界处理准确：`docs/zh-CN/algorithm.md:123` 说明外部向量 DeepSORT 与实现差异，`docs/zh-CN/performance.md:21` 将 CPU 关联耗时与 ReID 推理分开，`docs/zh-CN/performance.md:27` 明确合成证据不能外推，`docs/zh-CN/release-checklist.md:23` 明确 `0.2.0-alpha.0` 未 push、发布或部署；英文对应文档同步更新。
- 已读取固定 `reports/2026-09-19-deepsort/verify.txt` 证据：完整 verify 退出码 0，9 个测试文件共 102 项通过，实际 tarball 检查通过，11 组 Chromium 浏览器检查通过且 `pageErrors=[]`。按审查约束未重跑验证。

### 问题

#### 严重（必须修复）

- 无。

#### 重要（应修复）

- `demo/src/App.tsx:129`：`switchSample` 使用 `optionsFrom(algorithm, parameters, ...)`，其中 `parameters` 是可编辑但可能尚未应用的表单草稿。具体复现是先修改 `minHits` 或 DeepSORT 图库参数但不点击“应用”，再切换样例；新会话会悄然采用草稿值，清空结果并在后续导出中将其显示为已应用配置。应改为用 `session.options` 准备新样例，只在表单提交处理器 `demo/src/App.tsx:174` 中把草稿转换为实际配置；同时在 `tests/browser.mjs:62` 所述“未应用草稿不混入导出”用例中加入“编辑草稿后切换样例”的回归断言。

#### 次要（可改进）

- 无。

### 评估

**任务质量：** 需要修复

**理由：** 原子导入、异步竞态防护、DeepSORT/非 DeepSORT 兼容、可重导入导出、实际 tarball 消费和双语证据边界均实现得较完整；但样例切换绕过“应用”动作提交参数草稿，破坏了用户可见的配置语义，修复并补回归用例后才可通过本任务门禁。
