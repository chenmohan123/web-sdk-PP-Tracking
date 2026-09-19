# PP-Tracking 桌面本地验收（2026-09-19）

本报告归档已发生的测量，不表示在归档提交上重新跑过性能。SDK 当前仅本地交付，npm、GitHub Release、在线 Demo、Rulesets 和可信发布均未执行或核验。真实视频 MOT 精度、手机、Safari/Firefox、微信、Worker 和 GPU 不在本轮结论内。

## 身份与来源

- 核心测量提交：`518f94ada6c6f3cc0308b7970564e6a4053df429`。
- 完整 Demo/文档验证基线：`7241a714aaa8a3cbd5a74b3377fa965bafc77185`（Task 3）。
- 两次原始 API/性能报告的 ESM SHA256 均为 `fdd721bf78b7dc2ea3c554619418c914041971e37a2274ef3851e251997d4935`，归档时当前 `dist/index.js` 逐字节一致。
- [完整构建清单](build-inventory.json)记录归档时8个构建文件摘要；历史性能报告直接记录的是 ESM 入口摘要，不能把事后清单说成历史测量已经记录的字段。
- SDK `web-sdk-pp-tracking@0.1.0`，CPU / JavaScript / main；Node 24.16.0、pnpm 11.21.0；Windows 11 专业版 10.0.26200、Intel Core i5-10400F @2.90GHz。
- Task 3原tarball仍位于 `.tmp/web-sdk-pp-tracking-0.1.0.tgz`，归档时核对SHA256为 `856e951d6e5501d318577199f569f0a54af162bc96241e0c6fb06e1152e870fe`；二进制包保持忽略，正式发布未执行。
- [NOTICE](../../NOTICE)记录论文机制来源、独立 Kalman/全局分配/生命周期实现和 Apache-2.0 许可边界；不分发或翻译上游跟踪代码，不以论文代替代码许可。

## 原始证据索引

| 文件 | 已发生的执行与内容 |
| --- | --- |
| [benchmark.json](benchmark.json) | 01:12:06 UTC，Chromium **151.0.7922.34** headless；全部1800个warm、9个cold样本、浏览器UA/OS/CPU/并行度/时间原点、核心commit和入口摘要 |
| [independent-api.json](independent-api.json) | 01:04:51 UTC；10个原创场景、129次更新的完整结果及timings，核心commit和输入摘要 |
| [inputs.json](inputs.json) | 门户 `reports/tracking/2026-09-18-feasibility/inputs.json` 的原字节副本；SHA256 `714aea989ae3d4d4e88288cc74f3db893186353935774db72ebd8897e2ee2ebc` |
| [browser.json](browser.json) | 01:31:44 UTC，Playwright 1.63.0 / Chromium **153.0.8010.12**，9组完整产品交互、pageErrors=[]、本机截图路径 |
| [package-check.json](package-check.json) | 实际tarball的ESM、CJS、TypeScript消费；无runtime依赖、发行白名单，压缩15170 bytes / 解包54890 bytes |
| [task-3-verify.log](task-3-verify.log) | Task 3 完整原始日志：29单测、类型检查、SDK/Demo/Vanilla/React构建、真实包与9组浏览器交互 |
| [provenance/](provenance/) | 性能和公开API的原始测量脚本，保留当时机器路径；可移植入口见 `scripts/evaluation/` |

所有原始 JSON、日志、原测量脚本均原字节复制，路径、时间、timings、commit 未改写。图片继续留在忽略目录：SDK `.tmp/browser/{desktop,english,occlusion,mobile,vanilla}.png`；门户 `.tmp/tracking-visual/{desktop,english,occlusion,mobile}.png`。完整绝对路径保留于浏览器JSON，不将本机路径视为其他机器上的可用链接。

## 性能读法

输入为原创固定网格，全部classId=0、score=0.9，1000×1000画布、35×45框，每33.33ms一帧，x方向 `3*sin(frame/25)` 缓慢位移。生成逻辑在测量脚本内，输入生成不计时。先以100框预热30帧JIT；每规模新建3个实例，分别记录首帧cold和之后200帧warm。warm每帧均断言轨迹数等于输入数且全部observed，活动状态规模等于10/50/100。

| 框数 | warm样本数 | SDK totalMs p50 / p95（ms） | cold样本数 | 创建+首帧 p50 / p95（ms） |
| --- | --- | --- | --- | --- |
| 10 | 600 | 1.0 / 1.3 | 3 | 0.2 / 0.5 |
| 50 | 600 | 5.3 / 8.9 | 3 | 0.6 / 0.7 |
| 100 | 600 | 11.3 / 14.9 | 3 | 1.1 / 1.1 |

表格四舍五入到0.1ms，原JSON保存浮点原值、min/max和外层调用耗时。p50取排序下标 `floor((n-1)*0.5)`，p95取 `ceil((n-1)*0.95)`，无插值。cold包含createTracker+首帧，初次没有已有轨迹预测/关联，不是浏览器冷启动；不得与warm相除宣称加速。计时分辨率可能产生0值。这里不含检测模型、解码或渲染，不是最坏情况/真实视频质量/其他设备性能承诺。

## 复现与校验

在SDK根目录执行，所有新结果默认写入忽略目录，不覆盖固定历史报告：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
node scripts/evaluation/verify-archive.mjs
node scripts/evaluation/independent-api.mjs --out .tmp/replayed-api.json
$env:PLAYWRIGHT_BROWSERS_PATH='F:/git/00_chenmohan/github/web-sdk-PP-Detection/.tmp/dependencies-compatible-browsers'
node scripts/evaluation/benchmark.mjs --out .tmp/new-benchmark.json
```

浏览器缓存路径只是本机示例；其他机器安装与自身Playwright匹配的Chromium后可省略该环境变量。可执行 `pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium`。当前SDK依赖默认使用Chromium153，新报告如实记录实际版本；历史151报告不会因此变为153。复现指输入/算法/采样口径可重跑，不要求不同设备/浏览器得到相同耗时。

两个执行入口支持 `--sdk <SDK目录>`、`--out <新JSON路径>`，公开API还支持 `--input <输入JSON>`。API明确把旧输入xyxy转换为当前像素xywh，忽略subject评分真值，maxLostMs固定为5×1000/30；它不是旧参考实现逐值对照或MOT准确率。

输出保护解析现有父目录的真实路径，并处理Windows大小写及symlink/junction别名；写入前重新检查，且使用排他创建。已有输出会报 `EEXIST`，再次复跑应指定新的 `--out` 文件名。归档验证器自行分配唯一临时目录，可重复执行。定向回归命令为 `node --test scripts/evaluation/check-output-path.mjs`。

`verify-archive.mjs` 默认检查9份固定摘要、8个当前构建文件、源码相对测量commit没有变化、浏览器版本、样本数量/顺序/分位数，然后真实复跑10场景129次API更新并比较除timings外的完整结果。它不改写摘要、不跑性能。验证器允许 `--sdk` 和 `--archive` 定位副本；只要原始样本实质改变，即使重算统计也会被固定摘要拒绝。恶意同时编辑验证器的信任常量仍需Git审查，本工具不是外部数字签名。

Task 4实际验证：上述归档校验和API复跑通过；临时副本单个warm totalMs增加100后校验退出1；新性能脚本语法检查通过且浏览器测量函数与原脚本逐字核对一致。仅文档、清单和归档工具变更，因此引用Task 3完整verify，不重复其29单测/9组浏览器或性能跑数。

## 产品验收与后续

Chromium153主线程真实交互覆盖中文/英文状态保持、四场景、单步/播放暂停/重播、键盘seek、导入导出及错误原子性、390px无横向溢出、Vanilla单步与复位。390px是桌面视口，不能当手机实测。源码、实际包和NOTICE共同支持无生产依赖及独立实现声明，不承诺上游逐值等价。

门户的7个既有SDK标准回归、93单测、18页构建及生产preview14 e2e摘要位于门户 `reports/tracking/2026-09-19-foundation/`。`sdk:check` after报告位于门户 `reports/sdk-standard/pp-tracking-after.json`，本地required失败0，远程required仍skip，仅 `locally-compliant`。后续须独立整分支审查；发布授权、远程设置核验及真实授权视频质量另行安排，不登记未发布的第8个门户在线SDK。
