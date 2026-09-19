# MOT17 真实检测序列复现

这是离线评测工具，不进入 npm 包和普通 CI 单测，不下载视频图片。固定来源、提交、参数和依赖见 `lock.json`；默认读取七段 FRCNN 训练序列，共 5316 帧，不以指标挑选子集。原检测、GT、逐轨输出及第三方源码只存储在忽略目录 `.tmp`。来源用途、引用和许可边界见 [日期化报告](../../../reports/2026-09-19-mot17/README.md)。

先安装仓库锁定的 JS 依赖并构建。使用 Python 3.11 隔离环境；官方固定提交尚使用 NumPy 旧别名，因此固定 NumPy 1.23.5 / SciPy 1.10.1，不修改上游代码或猴子补丁。TrackEval MIT 源码会自动按固定 SHA 抓取到 `.tmp`，也可传入已有的干净 checkout。

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false install --frozen-lockfile
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
python -m venv .tmp/mot17-venv
.tmp/mot17-venv/Scripts/python.exe -m pip install -r scripts/evaluation/mot17/requirements.txt
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false exec playwright install chromium
node scripts/evaluation/mot17/run.mjs --python .tmp/mot17-venv/Scripts/python.exe --download-data
```

Linux 将 Python 路径换为 `.tmp/mot17-venv/bin/python`。已有匹配浏览器可设置 `PLAYWRIGHT_BROWSERS_PATH`。已有数据用 `--zip .tmp/real-sequence-research/MOT17Labels.zip` 代替 `--download-data`；已有评分源码用 `--trackeval .tmp/real-sequence-research/TrackEval`。`--out` 必须指向本仓库 `.tmp` 内尚不存在的目录，省略时生成唯一目录。`--skip-browser` 仅便于没有浏览器的诊断，此时报告明确记为未运行，不等同完整发布验证。

运行顺序为数据完整性核对和白名单提取、默认与 `lowScoreThreshold=highScoreThreshold` 两配置、每配置每段从新实例重复运行、官方评分、Chromium 完整 02 序列与 Node 对齐。输出 `summary.json`、输入摘要、评分结果和日志；原始 MOT 输出、非耗时 SDK JSONL 和逐帧耗时分别留在本次目录中。输出复用公共 `output-path.mjs` 保护，拒绝报告归档、symlink/junction 逃逸和已有目录/文件，不覆盖失败运行。

输入 MOT 帧号为一基，timestampMs=`frame*1000/fps`；像素左上角减 1 后裁剪到图像半开边界，空框剔除，低分不预筛选。贴边浮点减法产生向外舍入时，宽/高向内收缩一个图像尺度机器精度并单独计数。空帧保留；乱序行按帧分组但保持同帧行序；坏行、缺字段、非有限值、越界帧号直接报错，不静默截断。GT 仅由 Python 评分器读取，从不参与 SDK 输入或参数选择。

仅 `observed && state === 'tracked'` 写入 MOT；恢复一基像素原点，不额外裁剪或平滑 SDK 输出。调用官方 `MotChallenge2DBox` 的 `get_raw_seq_data` / `get_preprocessed_seq_data`（`DO_PREPROC=true`、pedestrian）及 Identity/CLEAR（IoU=0.5）。跨段统计调用各指标官方 `combine_sequences`，不是百分比算术平均。为避免无关数据集与绘图依赖，仅装载官方评分所需模块，实际装载源码和 LICENSE 的 SHA256 均写入报告。

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test tests/mot17-adapter.test.ts tests/mot17-cli.test.ts
$env:TRACKEVAL_PATH=(Resolve-Path '.tmp/real-sequence-research/TrackEval').Path
.tmp/mot17-venv/Scripts/python.exe scripts/evaluation/mot17/test_scoring.py
```

Python 原创 fixture 手算核对：完美四帧 IDF1/MOTA=1；中途切 ID 的 IDF1=0.5、IDSW=1、MOTA=0.75；漏后两帧 IDF1=2/3、FN=2、MOTA=0.5；添加匹配的 distractor 不产生 FP。还验证错误数据包在提取前拒绝。普通 JS 单测完全不需要真实数据、Python 或网络。
