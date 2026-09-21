# Task 2 审查：规格不通过，需要修复

- 审查范围：`4bbd3d5..6fc6e5a` 的完整 `task-2.diff`，单 SDK ReID 源码候选；未修改源码、索引或 HEAD，未执行完整测试。
- 规格结论：❌ 存在合法 HTTPS 模型响应被提前拒绝的问题，见 Important 1；其余可从差异核验的接口、生命周期、输入快照、独立候选构建与发布隔离要求符合 brief。
- ⚠️ 跨任务证据：真实模型 SHA、真实 ORT 双后端浏览器矩阵、完整 verify 与标准检查由父代理验证；本审查不把单测依赖替身当成真实模型证据，不评价实际跟踪质量，也不作正式发布或公开 hub 可用性结论。

## 做得好的部分

- `src/reid/types.ts:9`、`src/reid/model.ts:11`：互斥模型来源、固定字节数与 SHA、显式后端和检测数上限均有接口及运行时约束；没有内置虚构下载来源。
- `src/reid/extractor.ts:25`、`src/reid/extractor.ts:65`、`src/reid/preprocess.ts:18`：活动操作在异步回调前登记；整帧校验、图像与检测元数据复制在首次异步执行前完成，BUSY 和原子结果语义清晰。
- `src/reid/extractor.ts:106`、`src/reid/extractor.ts:123`：输入及全部输出逐个释放，单个释放失败不阻止其余资源释放；dispose 等待活动操作再释放会话。
- `src/reid/ort.ts:13`、`src/reid/ort.ts:18`：ORT 仅在 load 的会话阶段动态加载，版本固定；WASM 单线程，WebGPU 禁止 CPU EP 回退。
- `scripts/build-reid-candidate.mjs:6`、`package.json:34`、`package.json:51`：候选产物输出到 `.tmp/reid-module/dist`，ORT 保持 external 且仅作为开发依赖；差异未修改正式 exports、根入口或三种算法。
- `tests/reid-lifecycle.test.ts:31`、`tests/reid-preprocess.test.ts:6`：测试包含手算像素、顺序绑定、整帧失败、等待期间取消和资源释放等行为断言，ORT 替身位于底层依赖，没有生产测试后门。

## 问题

### Critical

- 无。

### Important

1. **压缩响应的 Content-Length 被误当成模型明文字节数。** `src/reid/assets.ts:19`：只要响应声明 Content-Length，就要求其严格等于 `MODEL_BYTES`。浏览器 fetch 会解压 gzip/br 响应，供 reader 读取的是解压后的模型，但响应头中的 Content-Length 仍是压缩传输长度。因此，同一份正确模型经过启用压缩的 HTTPS CDN 或代理后，会在读取和 SHA 校验前被报为 `INTEGRITY_FAILED`。当前来源契约没有禁止压缩响应，这使合法来源无法加载。修复建议：存在非 identity 的 Content-Encoding 时不以传输 Content-Length 判定明文模型大小；始终保留流读取硬上限、最终明文字节数和 SHA 校验。增加“解压后字节正确、传输长度不同”的行为测试。
   - 聚焦诊断：通过现有候选 bundle，以 Response 模拟浏览器解压后的 33,704,835-byte body，头部设为 `content-encoding: gzip`、`content-length: 10000000`；结果为 `INTEGRITY_FAILED`，原因“模型响应大小与固定资产不符”，`digestCalls=0`。这是响应处理边界的模拟诊断，未宣称样本通过真实模型 SHA。

### Minor

1. **缓存匹配完成时取消，未关闭已经拿到的响应体。** `src/reid/assets.ts:62`、`src/reid/assets.ts:65`：`cache.match()` 返回 Response 后立即调用 `aborted(signal)`；如果等待期间取消，函数直接退出，尚未进入负责清理的 `readBounded()`，因此响应体没有 cancel。虽然不启动推理且未持有 reader 锁，仍应显式释放这份缓存响应，保持各阶段一致的取消清理语义。修复建议：在这一取消分支关闭 `response.body`，或将已获取响应的所有失败出口纳入统一清理，并补充 cache.match 等待阶段取消用例。
   - 聚焦诊断：缓存替身在返回含 ReadableStream 的 Response 时触发取消；load 返回 `ABORTED`，底层 cancel 次数为 0，dispose 后仍为 0。诊断最后主动关闭模拟响应体，没有留下活动资源。

## 核查与质量结论

- 聚焦外部读取：为排除“新增 src/reid 被正式构建自动收录”的具体风险，检查了 `scripts/build.mjs:6`、`scripts/build.mjs:9`、`tsconfig.json:8` 及 package 的产物入口；正式 JS 与声明构建都明确从 `src/index.ts` 出发，风险未成立。未遍历其他源码。
- 已读取 `reports/2026-09-21-reid-module/unit-green.log:1`、`typecheck.log:1`、`build-candidate.log:1`：34/34 单测、类型检查和候选构建均通过，所读日志无警告。没有重跑这些检查。
- **代码质量结论：需要修复。** 模块职责划分、状态管理和资源释放的主路径可靠，测试也覆盖了多数复杂生命周期场景；Important 1 会错误拒绝有效模型响应，应修复后再通过本任务审查。Minor 1 不单独阻塞任务。

## 修复轮 1 复审回执（5dcd2d4）

- **最新规格结论：✅ 通过；最新代码质量结论：通过。** 本回执取代上文初审的未通过结论；范围仅为 `6fc6e5a..5dcd2d4` 修复差异和原两项问题。
- **Important 1：ADDRESSED（已解决）。** `src/reid/assets.ts:19` 移除以 Content-Length 判断模型明文字节数的逻辑，正文读取硬上限、最终长度及后续 SHA 校验保留。该实现也覆盖 Content-Encoding 因 CORS 不可见的情况。`tests/reid-lifecycle.test.ts:183` 对 gzip、br 和隐藏编码头的已解压正文分别验证成功加载；`tests/reid-lifecycle.test.ts:194` 验证短正文、超限正文及错误 SHA 仍被拒绝，未见资产身份校验削弱。
- **Minor 1：ADDRESSED（已解决）。** `src/reid/assets.ts:65` 让已取得的缓存响应先进入 `readBounded`，取消由该函数的 finally 关闭 reader 并释放锁；无缓存响应时仍在下载前检查取消。`tests/reid-lifecycle.test.ts:204` 对 cache.match 返回瞬间取消验证 cancel 恰好一次，且不下载、不做 SHA、不创建会话。
- **新增破坏：未发现。** 两处修复都局限于原故障分支，没有新增来源回退、正式导出或其他产品能力；新增测试断言覆盖成功与拒绝行为。
- **验证检查：** 已读取 `reports/2026-09-21-reid-module/fix-1-green.log:1`、`fix-1-typecheck.log:1`、`fix-1-build.log:1`，分别为生命周期测试 37/37、类型检查与候选构建通过，日志无警告；本次未运行测试或新增诊断。
- **证据边界：** 新单测模拟浏览器解压后的 Response，未冒充真实 HTTP 压缩传输证据；父代理执行的真实 gzip 浏览器验证仍由父代理记录。此范围复审未发现需要继续修复的 Critical、Important 或 Minor 项，也不扩大为发布及实际跟踪质量认证。
