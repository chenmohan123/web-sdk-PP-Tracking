# BoT-SORT 公开接入与 Demo 只读审查

日期：2026-09-22。SDK 工作树：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`；比较基线：`d9cbac817b8aac8fdf02776b8a199d6627dd9040`。审查对象为未提交改动，主代理在本次审查期间修正已反馈问题。

本次覆盖公开工厂与类型、`demo/src/data.ts`、`demo/src/playback.ts`、`demo/src/App.tsx` 和 `tests/botsort-demo.test.ts`。已阅读门户标准入口、SDK/Demo 契约、本阶段设计与计划。审查期间没有编辑 SDK、F: 主仓或生产文件，没有提交、远程写入或启动子代理；本报告是唯一写入文件。

## 结论

未发现 Critical 缺陷。审查确认四项 Important 缺陷，主代理均已修复，独立复查通过；当前审查范围内没有未解决的阻塞项。浏览器验收和完整构建验证由主代理另行记录，本报告不以单元或内存测试替代浏览器证据。

## 已修复并复查的问题

### 1. 版本 2 配置中的非法特征空间字段被清洗

复现时位置：`demo/src/data.ts:151–154`。为合法 BoT-SORT 外观配置添加 `options.appearance.featureSpace.typo = true`，同时保留合法的顶层 `featureSpace`。直接调用公开 `createTracker(options)` 返回 `INVALID_OPTIONS`，但 `prepareSequence` 只比较 id/dimension 后覆盖配置中的特征空间，导入成功且 typo 消失。DeepSORT 的 `options.featureSpace` 同样受影响。这会让 Demo 接受公开 API 拒绝的参数，违反版本化配置完整校验要求。

修复：版本 2 保留原始选项交给工厂，仅旧格式适配特征空间。独立复查中两种算法均拒绝含额外字段的版本 2 选项。

### 2. BoT-SORT 可被赋给旧 Tracker 类型而失去必填运动契约

位置：`src/types.ts:52`、`src/botsort/types.ts:27`。原方法签名在 TypeScript strict 下仍允许：

```ts
const tracker: Tracker = createTracker({ algorithm: 'botsort' });
tracker.update({ timestampMs: 0, imageSize: { width: 10, height: 10 }, detections: [] });
```

内存编译没有诊断，实际更新却必然失败。常见的显式旧 `Tracker` 注解能绕过新接口要求；原直接推导类型负例没有覆盖这种赋值。

修复：两类 `update` 改为函数字段签名。独立 strict/NodeNext 编译确认“普通帧缺少运动”和“BoT-SORT 赋值旧 Tracker”两条 `@ts-expect-error` 均生效，旧 Tracker 正常调用仍通过。实际 tarball 的对应类型测试由主代理执行。

### 3. 导入后应用参数重置不可见选项

位置：`demo/src/App.tsx:178`、`demo/src/data.ts:43`。版本 2 导入 BoT-SORT 配置 `{ matchIouThreshold: 0.85, lowMatchIouThreshold: 0.7, maxTracks: 1, largeGapMs: 4000 }` 后，不修改任何输入而直接应用参数，原实现分别重置为 `0.3 / 0.2 / 200 / 2000`。这些选项没有表单控件，会使容量或关联行为在没有对应可见修改时改变。

修复：同算法应用参数继承当前选项中的未展示字段；切算法继续采用目标算法默认配置。独立验证四算法的同算法保留及跨算法默认恢复共 8 组通过；`App` 已传入 `session.options`。

### 4. 仅在版本 2 选项声明空间的空检测序列不能往返

复现时位置：`demo/src/data.ts:151`。`serializeSequence` 允许省略顶层 `featureSpace`，版本 2 选项本身已含完整空间配置；但 `prepareSequence` 仅取顶层声明或从向量推导，忽略版本 2 配置中的空间。

```ts
const featureSpace = { id: 'empty-camera-run', dimension: 2 };
const options = { algorithm: 'botsort', appearance: { featureSpace }, minHits: 1 };
const frame = {
  frameId: 0, timestampMs: 0, imageSize: { width: 10, height: 10 },
  featureSpaceId: featureSpace.id, detections: [],
  motion: { status: 'initial', from: null, to: { frameId: 0, timestampMs: 0 } },
};
```

公开工厂可以处理该帧；`serializeSequence([frame], undefined, options)` 产生版本 2 输入后，重新 `prepareSequence` 返回 `INVALID_SEQUENCE`，因为空检测无法推导向量维数。DeepSORT 同理。

修复：版本 2 在顶层缺省时读取选项中的完整特征空间，同时保持原选项交给工厂严格校验；旧格式继续原推导行为。独立验证两种算法的空检测往返、非法选项字段拒绝、顶层与配置空间冲突拒绝，共 6 组通过。

## 独立验证证据

验证脚本通过 esbuild `write: false` 在内存构建当前源文件，显式将 `web-sdk-pp-tracking` 映射到当前 `src/index.ts`，避免使用过期 dist。类型探针通过 TypeScript 编译器内存虚拟文件执行，未写测试文件。

- 四算法 × 五内置样例：20 组完整准备、输入导出和跨当前算法重新导入通过。
- 13 类严格输入拒绝通过：缺 motion、缺 frameId、错误 from、错误 to、反射矩阵、非法 confidence/source、端点/运动/图像尺寸/帧头未知字段、未启用外观却传 featureSpaceId 或向量。
- unavailable 默认拒绝、显式 identity 回退与外观参数完整往返、运动 reason/向量/选项深复制、回放 motion 回执、seek/reset，以及两种算法非法特征空间修复，合计 19 组补充断言通过。
- 四算法隐藏参数保留及跨算法默认恢复：8 组通过。
- 两种算法空检测版本 2 往返及非法/冲突空间拒绝：6 组通过。
- 修复后公开类型严格负例及原三算法调用检查通过。

静态审查确认：输入/参数/算法切换通过临时 tracker 验证全部帧后才替换会话；准备失败保留当前实例、帧、参数和结果。版本 1 与无 schema 包装继续使用当前算法配置；未知版本和版本 2 未知/不一致算法被拒绝。内置样例切换从原创数据重新构建向量，外部导入不会补造运动或剥离向量。
