# ByteTrack 与 OC-SORT 同输入评测

[English](README.en.md) · [公开机器摘要](evaluation-summary.json)

日期：2026-09-19。对象：本地候选 `web-sdk-pp-tracking@0.2.0-alpha.0`。结论：继续保留 ByteTrack 为默认策略。OC-SORT 在这组固定训练序列上减少了 ID 切换，但没有形成整体精度或耗时优势。

## 结果

| 算法 | IDF1 | IDSW | MOTA | FP | FN | Node SDK totalMs | 驱动墙钟 | CPU | 最大活动轨迹 | 容量丢弃 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ByteTrack | 48.2922% | 1101 | 44.4010% | 4169 | 57166 | 8566.916 ms | 8925.181 ms | 9580 ms | 52 | 0 |
| OC-SORT | 48.4107% | 881 | 39.5434% | 6751 | 60259 | 9268.917 ms | 9617.248 ms | 10033 ms | 47 | 0 |
| OC-SORT - ByteTrack | +0.1185 个百分点 | -220 | -4.8577 个百分点 | +2582 | +3093 | +8.19% | - | - | - | 0 |

OC-SORT 的 IDSW 下降 220，IDF1 略增；同时 MOTA 明显下降，误检和漏检均增加。尤其 MOT17-10-FRCNN 与 MOT17-13-FRCNN 的 MOTA 分别从 36.8253%/34.1694% 降至 19.6199%/18.5449%。因此不能把较少的 IDSW 写成总体提升，也不据此调门限追分。

Node 耗时只覆盖跟踪器 `update` 及驱动循环的注明边界，不包括图像、检测模型、解码、渲染、数据提取或 TrackEval 评分。它是一次 Windows/i5-10400F/Node 24.16.0 观测，不是跨设备吞吐量或端到端视频性能。

## 输入、参数与评分身份

- 数据：MOT17Labels.zip，10107022 字节，SHA256 `0aa79322e91583369f42f17c4d79a0b145380d8732487bba59272048dc82b2b9`；固定七段 FRCNN 训练序列，共 5316 帧，不按结果选子集。
- SDK：提交 `c036be8a5775c879e9062ba41e5b114460c6b16e`，运行前源码干净；`dist/index.js` SHA256 `7b5b1bfd715ea0541bc6dba7416589729bbe10af6ebdb280a95ab967ef20a7ea`。版本从 `package.json` 读取，并逐帧核对实际 `runtimeVersion`。
- 评分器：TrackEval `12c8791b303e0a0b50f753af204249e622d0281a`，Identity/CLEAR，`DO_PREPROC=true`，pedestrian，IoU 0.5；Python 3.11.15、NumPy 1.23.5、SciPy 1.10.1。未修改上游源码或评分公式；运行保留上游 `np.float`/`np.int` 弃用告警。
- 公共参数相同：`highScoreThreshold=0.5`、`newTrackThreshold=0.6`、`minHits=2`、`matchIouThreshold=0.3`、`maxLostMs=1000`、`largeGapMs=2000`、`maxDetections=100`、`maxTracks=200`。ByteTrack 另用既有 `lowScoreThreshold=0.1` 和 `lowMatchIouThreshold=0.2`；OC-SORT 没有接收这两个无效参数，专属参数保持候选默认 `ocmWeight=0.2`、`ocmDeltaMs=300`、`ocmHistoryLength=30`、`oruMaxReplaySteps=30`，未按结果调参。

逐段 IDF1/IDSW/MOTA/FP/FN、适配输入 SHA、两算法 MOT SHA 和脚本/浏览器身份见 `evaluation-summary.json`。原始检测、GT、MOT、逐帧 JSONL 与耗时只保存在忽略目录 `.tmp/mot17-ocsort-c036be8/`，未归档进 Git。

## 确定性、历史连续性与浏览器

七段序列对两算法各从新实例完整运行两次，共 14 组；非耗时 JSON 与 MOT 输出均逐字节一致，容量丢弃为 0。候选 ByteTrack 的七份 MOT 文件又与历史 `default` 逐字节比较，7/7 一致，TrackEval 合计及逐段指标也完全一致。历史原始 JSONL 因新增 `algorithm` 和候选 `runtimeVersion` 元数据而不要求逐字节相同。

Chromium 153.0.8010.12 / Playwright 1.63.0 在动态本地端口分别运行完整 MOT17-02-FRCNN 600 帧。ByteTrack 与 OC-SORT 的非耗时 JSON 和 MOT 输出都与各自 Node 结果一致，实际后端/执行模式均为 `cpu/main`。这是一台桌面环境的数值对齐，不证明手机、其他浏览器、其他 CPU 或跨设备兼容。

`.tmp` 原始 `summary.json` SHA256 为 `cec4a61875ba68edb2103addf14da3a20fdbf94c5bdf3e1f524c9759219a32e3`，`metrics.json` 为 `f9f0f117f2851921a344c8a167b1e53555c6d705229f8b14f48b9b6dd506d5bf`；历史摘要为 `a8aad88094132d28d9a17d9c75ec8e9ece3b792418deba7a0c0f333e9de1b52d`。

## 复跑

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false run build
node scripts/evaluation/mot17/run.mjs --mode algorithms --python <python-3.11> --zip <MOT17Labels.zip> --trackeval <TrackEval-12c8791> --out <本仓库/.tmp/唯一新目录>
```

命令会在任何下载、输出创建或子进程前拒绝未知模式和非法/已有输出；Node 选择的 `bytetrack/ocsort` 配置名显式传给 Python。这里的结果是固定训练序列上的本地算法设置比较，不是 MOT17 测试集排行榜、官方 ByteTrack/OC-SORT 复现、真实视频端到端评测或发布承诺。线上 npm、HTTPS Demo 与门户生产条目仍为 0.1.0。
