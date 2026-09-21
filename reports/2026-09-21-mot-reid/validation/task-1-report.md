# 任务1实施报告：真实画面评测工具

状态：实现、TDD、仓库检查与固定子集浏览器预检完成，待独立审查后正式执行。未修改生产算法、模型、默认阈值、旧评测行为；未读取上游跟踪实现，未执行远程发布。

本地中文提交：`0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`（新增固定真实序列三算法与ReID评测工具）。提交后SDK工作树干净。

工作目录：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`。本任务仅提交 `scripts/evaluation/mot17-reid/` 和 `tests/mot17-reid.test.ts`。主线程的媒体准备/协议提交不混入本任务。

## 实现与边界

- `core.mjs`：复用旧公共参数选择；DeepSORT显式特征空间、`.2/30`；64分块完整提取，保序、数量/空间/维度/有限值/框/时间戳校验；全部成功后一次更新，空帧保留；完整合并校验。
- `run.mjs` / `browser.mjs`：旧labels身份、已提交媒体锁、全部图片CRC/SHA/字节、模型SHA/字节校验；实际dist与ORT；localhost离线资源；真实GPU非fallback；每序列新会话和跟踪器。GT只进入独立评分器。逐帧features/输出/计时落盘，Node按行回放两次，全部MOT与剔除timing结果均与浏览器哈希一致才完成。特征文件整体哈希用流读取。
- DeepSORT外围由本地图片fetch起至解码/全部ReID/update结束独立计时，再运行两基线。模型本地获取/load单列，首帧cold/其余warm。两基线不执行模型。IPC/落盘/检测器/渲染/评分不计入流水线。Node仅冻结向量关联。
- `merge.mjs`：七段完整、不重复、非子集、同参数/输入/源码/脚本/dist/模型身份；重新核验features与两次Node/浏览器MOT和JSONL，随后原评分API官方合计。原输出保留，合并不复制向量。
- `score.py`：仅评分器校验和读取完整GT，原固定TrackEval、依赖和combine_sequences不变。拒绝子集评分。
- `compare.mjs`：只接收固定02前30帧的GPU/WASM两个运行，流式计算全部向量数值差异，记录三算法MOT/非耗时是否一致，不调参强行对齐。
- 所有写入要求新的本仓库`.tmp`子目录；已有目标、外部路径、归档、junction逃逸、未知模式均拒绝。没有原地恢复功能，按段新目录后合并。
- 双语README提供完整、按段合并与固定子集复跑命令，以及范围/计时/原始数据不分发说明。

## RED / GREEN 原始命令与输出摘录

统一命令：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec vitest run tests/mot17-reid.test.ts
```

1. 12:08:26 RED：`Tests 7 failed (7)`，覆盖65检测、第二块失败、空帧、特征错位/缺项/维度/NaN、公共配置、文件身份和路径边界。占位行为抛出`待实现全帧提取`/`待实现公共配置`/`待实现文件身份校验`/`待实现新输出保护`，断言实际失败，无导入或语法错误。
2. 12:09:10 GREEN：`Test Files 1 passed (1); Tests 7 passed (7)`。
3. 12:09:58 RED：新增CLI模式门禁，`Tests 1 failed | 7 passed (8)`；预期`未知后端|固定02前30帧`，实际`待实现运行模式校验`。
4. 12:13:06 GREEN：`Tests 8 passed (8)`。
5. 12:15:03 RED：新增完整合并门禁，`Tests 1 failed | 8 passed (9)`；有效合并不应抛错，实际`待实现完整合并校验`。
6. 12:16:28 GREEN：`Tests 9 passed (9)`。
7. 最后补充已提交媒体锁字节验证后，12:22:28针对性GREEN：`Tests 9 passed (9)`，退出0；`git diff --check`退出0。

## 必需仓库检查

依次运行（均使用上述两个pnpm配置参数）：`typecheck` → `test` → `build` → `check:package`，最终退出0。

输出：`tsc --noEmit`通过；`Test Files 14 passed (14); Tests 173 passed (173)`；`算法与 ReID 独立 ESM、CommonJS 和 NodeNext 类型声明构建完成`；`三算法与 ReID 实际 npm pack、双格式导入、独立类型消费、可选 ORT 与发行文件检查通过`。仅运行一遍完整仓库检查；媒体锁额外验证后只做针对性检查和实际浏览器复验。

## 实际浏览器预检

最终工具版本预检目录：

- GPU：`S/.tmp/mot17-reid-smoke-20260921-c/summary.json`
- WASM：`S/.tmp/mot17-reid-wasm-20260921-c/summary.json`
- 比较：`S/.tmp/mot17-reid-compare-20260921-c/comparison.json`

两后端均为预先固定02前30帧，共433检测；每个后端各自三算法与Node两次重复的MOT/非timing JSONL哈希均一致，容量丢弃0。比较预检显示maxAbs=`3.5762786865234375e-7`，maxCosineDistance=`2.7502444766014378e-12`，三算法MOT/非timing均一致。此处不读取评分结果，不把子集写成全量CPU结论。

实际命令（S为SDK根目录，P为门户根目录）：

```powershell
$python = 'C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io/.tmp/tracking-venv/Scripts/python.exe'
$trackeval = 'F:/git/00_chenmohan/github/web-sdk-PP-Tracking/.tmp/real-sequence-research/TrackEval'
$common = @('--input','.tmp/mot17-ocsort-c036be8/input','--images','.tmp/mot17-reid-media/data','--model','.tmp/reid-distribution/upload/pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx','--python',$python,'--trackeval',$trackeval)
node scripts/evaluation/mot17-reid/run.mjs @common --sequence MOT17-02-FRCNN --limit 30 --out .tmp/mot17-reid-smoke-20260921-c
node scripts/evaluation/mot17-reid/run.mjs @common --sequence MOT17-02-FRCNN --limit 30 --backend wasm --out .tmp/mot17-reid-wasm-20260921-c
node scripts/evaluation/mot17-reid/compare.mjs --gpu .tmp/mot17-reid-smoke-20260921-c --wasm .tmp/mot17-reid-wasm-20260921-c --out .tmp/mot17-reid-compare-20260921-c
```

额外用`score.py --run .tmp/mot17-reid-smoke-20260921-c`调用固定子集，预期退出1并在读GT前报`评分只接收七段完整WebGPU运行`，未产出metrics。当前Windows Python诊断控制台编码显示乱码，但拒绝语义及退出正确；JSON证据始终UTF-8。

## 正式执行交接

全量单进程：`node scripts/evaluation/mot17-reid/run.mjs @common --out .tmp/mot17-reid-official-new`。

按段：追加`--sequence MOT17-02-FRCNN --out .tmp/mot17-reid-02-new`，04/05/09/10/11/13依次同理。随后：

```powershell
node scripts/evaluation/mot17-reid/merge.mjs --run .tmp/mot17-reid-02-new --run .tmp/mot17-reid-04-new --run .tmp/mot17-reid-05-new --run .tmp/mot17-reid-09-new --run .tmp/mot17-reid-10-new --run .tmp/mot17-reid-11-new --run .tmp/mot17-reid-13-new --input .tmp/mot17-ocsort-c036be8/input --python $python --trackeval $trackeval --out .tmp/mot17-reid-combined-new
```

关注项：正式七段运行/官方总分尚未执行；merge完整路径须在实际七段结果到位后验证。不能把预检写成正式结果。合并需要所有来源目录仍存在且同一工具版本；最终构建或脚本变化须重跑对应段，不能静默混用。

自审已检查：GT隔离、全部检测顺序、分块失败原子性、空帧、模型/媒体锁、框对应关系、低分专属参数隔离、GPU真实后端、流式向量、双重复确定性、独立外围计时与输出保护。没有发现需要修改生产实现的问题。
