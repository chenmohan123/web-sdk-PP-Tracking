# 真实画面三算法评测工具

[English](README.en.md)。此工具只生成本地证据，不预设算法质量结论。规范沿用门户性能契约；不改生产算法、模型或默认参数，不读取上游跟踪实现。

## 固定输入

- 使用旧 `../mot17/lock.json` 的七段 MOT17 FRCNN 训练序列、全部 5316 帧、官方 TrackEval 提交和 Python 依赖。labels 的 `seqinfo.ini`、公开检测按已提交 `reports/2026-09-19-mot17/summary.json` 的 `inputHashes` 校验；只有独立评分进程读取并校验 GT。
- `--images` 指向 `data/<sequence>/img1/000001.jpg` 的 data 目录，其父目录必须有 `media.lock.json`，字节身份须与已提交的 `reports/2026-09-21-mot-reid/media.lock.json` 相同。该锁包含固定官方 ZIP 的 URL、ETag、大小以及全部 5316 个 `entries`，每项为 `path`、`zipMember`、`zipCrc32`、`bytes`、`sha256`。每次图片读取均核对大小/SHA256/CRC32，尺寸还要与 seqinfo 一致。
- `--model` 是已注册 PPLCNet FP32 ONNX 本体，按模型清单校验 33704835 字节与 SHA256。浏览器实际调用正式 `dist/reid/index.js`，通过本地 `modelBytes`、显式 WebGPU、`maxDetections=64` 加载模型；ORT 1.27.0 的资源来自本地依赖。禁止远程隐式资源请求和软件回退。
- 输入行完整保序，保留空帧与时间戳；每块最多 64 个检测，整帧全部成功才更新跟踪器。ByteTrack 用旧 lock 的全部参数，OC-SORT 和 DeepSORT 只接收共同参数，DeepSORT 保持 `maxCosineDistance=.2`、`gallerySize=30`。

## 执行

先安装依赖并构建；所有 pnpm 命令附仓库规定的两个配置参数：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build
$python = '<Python 3.11，numpy 1.23.5 / scipy 1.10.1 的解释器>'
$trackeval = '<固定提交 12c8791b303e0a0b50f753af204249e622d0281a 的干净 TrackEval 目录>'
$labels = '.tmp/mot17-ocsort-c036be8/input'
$images = '.tmp/mot17-reid-media/data'
$model = '.tmp/reid-distribution/upload/pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx'
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --out .tmp/mot17-reid-all-new
```

默认完整运行七段并调用原 `evaluator.score` API。也可每段独立运行，避免长任务重来；各次必须使用同一脚本、源码、dist、模型和媒体锁：

```powershell
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --sequence MOT17-02-FRCNN --out .tmp/mot17-reid-02-new
# 同样运行04、05、09、10、11、13；随后显式列出七个目录。
node scripts/evaluation/mot17-reid/merge.mjs --run .tmp/mot17-reid-02-new --run .tmp/mot17-reid-04-new --run .tmp/mot17-reid-05-new --run .tmp/mot17-reid-09-new --run .tmp/mot17-reid-10-new --run .tmp/mot17-reid-11-new --run .tmp/mot17-reid-13-new --input $labels --python $python --trackeval $trackeval --out .tmp/mot17-reid-combined-new
```

不恢复已有目录。任何已有输出、`.tmp` 外部路径、junction 逃逸和未知模式会被拒绝。失败目录保留 `failure.json` 与已完成帧；新开目录重跑。合并要求七段无重复、完整且身份一致，重新核对原始特征、两次 Node 和浏览器结果哈希后，按官方 `combine_sequences` 计算总计，不平均百分比。

固定 GPU/WASM 补充预检只允许 02 前 30 帧，不能评分或并入全量：

```powershell
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --sequence MOT17-02-FRCNN --limit 30 --backend webgpu --out .tmp/mot17-reid-gpu30-new
node scripts/evaluation/mot17-reid/run.mjs --input $labels --images $images --model $model --python $python --trackeval $trackeval --sequence MOT17-02-FRCNN --limit 30 --backend wasm --out .tmp/mot17-reid-wasm30-new
node scripts/evaluation/mot17-reid/compare.mjs --gpu .tmp/mot17-reid-gpu30-new --wasm .tmp/mot17-reid-wasm30-new --out .tmp/mot17-reid-compare30-new
```

比较文件记录所有检测向量的 maxAbs、最大/平均 cosine distance，以及每个算法的 MOT/非耗时输出是否相同；不通过改阈值强制两后端输出相同，不把此子集称为全量 CPU 模型评测。

## 证据与计时边界

每帧特征流式写入 `features/*.jsonl`，包含序列、帧号、输入哈希和固定特征空间；每段读取一帧向量进行两次独立 Node 回放。浏览器三算法输出和两次 Node 的 MOT 与剔除 timing 的 JSONL 必须逐字一致，容量丢弃必须为零，否则运行失败。`identity.json` 包含脚本、源码、构建、模型、媒体锁及 labels 身份；`summary.json`、逐帧 timing 和 `metrics.json` 保留成本及评分证据。合并引用原运行目录，不能删除这些本地原始证据。

每段新建模型会话和三个跟踪器，首帧 cold、其余 warm。模型本地获取与 load 外围时间单列；这不是远程模型下载实测。DeepSORT 外围时间由图片本地 fetch 前至 decode→全部 ReID→一次 update 结束独立测量，再运行 ByteTrack/OC-SORT；两基线不读取图片、不执行模型，只记录各自关联成本。图片获取时间包括服务器读盘和身份校验。ReID 各块真实 SDK 阶段时间单列。外围总时间不由阶段求和。Node 仅测冻结特征后的关联，不能称视频端到端。

Playwright IPC、证据落盘、检测器、渲染和评分不计入各算法外围时间。`benchmarkFrameTotalMs` 是三算法串行实验循环外围，不能当成 DeepSORT 单流水线耗时。输出仅表示固定训练集、本机有日期观测，不是排行榜、官方算法复现或跨设备兼容证据。原图、完整 GT、检测和向量不分发。
