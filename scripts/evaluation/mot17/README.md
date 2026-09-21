# MOT17 真实检测序列复现

[English](README.en.md)

这是离线评测工具，不进入 npm 包和普通 CI 单测，不下载视频图片。固定来源、提交、参数和依赖见 `lock.json`；默认读取七段 FRCNN 训练序列，共 5316 帧，不以指标挑选子集。原检测、GT、逐轨输出及第三方源码只存储在忽略目录 `.tmp`。来源用途、引用和许可边界见 [日期化报告](../../../reports/2026-09-19-mot17/README.md)。

先安装仓库锁定的 JS 依赖并构建。使用 Python 3.11 隔离环境；官方固定提交尚使用 NumPy 旧别名，因此固定 NumPy 1.23.5 / SciPy 1.10.1，不修改上游代码或猴子补丁。TrackEval MIT 源码会自动按固定 SHA 抓取到 `.tmp`，也可传入已有的干净 checkout。

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
python -m venv .tmp/mot17-venv
.tmp/mot17-venv/Scripts/python.exe -m pip install -r scripts/evaluation/mot17/requirements.txt
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
node scripts/evaluation/mot17/run.mjs --python .tmp/mot17-venv/Scripts/python.exe --download-data
# ByteTrack 与 OC-SORT 同输入对比：
node scripts/evaluation/mot17/run.mjs --mode algorithms --python .tmp/mot17-venv/Scripts/python.exe --download-data
```

Linux 将 Python 路径换为 `.tmp/mot17-venv/bin/python`。已有匹配浏览器可设置 `PLAYWRIGHT_BROWSERS_PATH`。已有数据用 `--zip .tmp/real-sequence-research/MOT17Labels.zip` 代替 `--download-data`；已有评分源码用 `--trackeval .tmp/real-sequence-research/TrackEval`。`--out` 必须指向本仓库 `.tmp` 内尚不存在的目录，省略时生成唯一目录。下载ZIP、新获取评分源码、提取数据、日志和评分结果的所有写入目标均须位于本仓库`.tmp`内且尚不存在；先解析真实父目录与symlink/junction，再在网络/提取/评分或创建目录之前拒绝非法目标。已有ZIP和评分checkout是只读输入，允许位于其他目录，不产生Python字节码缓存。`--skip-browser` 仅便于没有浏览器的诊断，此时报告明确记为未运行，不等同完整发布验证。

省略 `--mode` 时保留历史 `default/no-low` 两配置。显式传 `--mode algorithms` 时，同一组公共参数分别运行 `bytetrack/ocsort`；OC-SORT 不接收 ByteTrack 专属的低分阈值。模式和配置名在任何输出创建、下载或子进程之前校验，并由 Node 显式传给 Python 评分器。

运行顺序为数据完整性核对和白名单提取、每配置每段从新实例重复运行、官方评分、Chromium 完整 02 序列与各自 Node 结果对齐。输出 `summary.json`、输入摘要、评分结果和日志；原始 MOT 输出、非耗时 SDK JSONL 和逐帧耗时分别留在本次目录中。摘要从 `package.json` 读取候选版本，并核对每帧实际 `runtimeVersion`，同时记录源码提交、构建入口与评测脚本 SHA256。输出复用公共 `output-path.mjs` 保护，拒绝报告归档、symlink/junction 逃逸和已有目录/文件，不覆盖失败运行。

输入 MOT 帧号为一基，timestampMs=`frame*1000/fps`；像素左上角减 1 后裁剪到图像半开边界，空框剔除，低分不预筛选。贴边浮点减法产生向外舍入时，宽/高向内收缩一个图像尺度机器精度并单独计数。空帧保留；乱序行按帧分组但保持同帧行序；坏行、缺字段、非有限值、越界帧号直接报错，不静默截断。GT 仅由 Python 评分器读取，从不参与 SDK 输入或参数选择。

仅 `observed && state === 'tracked'` 写入 MOT；恢复一基像素原点，不额外裁剪或平滑 SDK 输出。调用官方 `MotChallenge2DBox` 的 `get_raw_seq_data` / `get_preprocessed_seq_data`（`DO_PREPROC=true`、pedestrian）及 Identity/CLEAR（IoU=0.5）。跨段统计调用各指标官方 `combine_sequences`，不是百分比算术平均。为避免无关数据集与绘图依赖，仅装载官方评分所需模块，实际装载源码和 LICENSE 的 SHA256 均写入报告。

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test tests/mot17-adapter.test.ts tests/mot17-cli.test.ts
$env:TRACKEVAL_PATH=(Resolve-Path '.tmp/real-sequence-research/TrackEval').Path
.tmp/mot17-venv/Scripts/python.exe -B scripts/evaluation/mot17/test_scoring.py
```

Python 原创 fixture 手算核对：完美四帧 IDF1/MOTA=1；中途切 ID 的 IDF1=0.5、IDSW=1、MOTA=0.75；漏后两帧 IDF1=2/3、FN=2、MOTA=0.5；添加匹配的 distractor 不产生 FP。还验证错误数据包在提取前拒绝。普通 JS 单测完全不需要真实数据、Python 或网络。

Python底层入口也执行同一写入约束，可独立提取或对已有完整运行目录评分；`prepare --output`必须是新目录，同时其父目录的`input-hashes.json`不得已存在。加`--download`时`--archive`也是新建写入目标，不加时只读已有ZIP。`score --run`必须是`.tmp`中的既有输入/跟踪结果目录，`metrics.json`不得已存在；拒绝在已评分目录覆盖结果。

```powershell
.tmp/mot17-venv/Scripts/python.exe -B scripts/evaluation/mot17/evaluator.py prepare --archive .tmp/real-sequence-research/MOT17Labels.zip --output .tmp/new-extraction/input
.tmp/mot17-venv/Scripts/python.exe -B scripts/evaluation/mot17/evaluator.py score --trackeval .tmp/real-sequence-research/TrackEval --run .tmp/an-unscored-run --configuration default --configuration no-low
```
