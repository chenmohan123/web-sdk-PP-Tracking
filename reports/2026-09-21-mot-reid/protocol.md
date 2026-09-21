# 三算法同输入真实画面协议

日期：2026-09-21。[English](protocol.en.md)。协议准备基线为 `e42cdd6`；正式工具及完整实测提交为 `0194ea5f9c32dda786b9e4b0bb7394ac0e51c23e`，版本 `0.2.0-alpha.0`。这是本地候选评测，不修改线上 0.1.0。正式结果与证据见[报告](README.md)。

## 固定数据与隔离

完整使用 MOT17 的 02、04、05、09、10、11、13 七段 FRCNN 训练序列，共 5316 帧；检测框总计 67639 个。模型裁剪只使用检测框，不使用 GT 框或身份。GT 仅在跟踪结果完成后的独立官方评分进程中读取。

检测和标注来自固定 `MOT17Labels.zip`（10107022 字节，SHA256 `0aa79322e91583369f42f17c4d79a0b145380d8732487bba59272048dc82b2b9`）。图片来自 `https://motchallenge.net/data/MOT17.zip`，固定长度 5860214001 字节、ETag `"15d4bc4f1-5b6c01991f807"`。图片按白名单文件名获取，每个 Range 使用 If-Match，并校验 Content-Range、压缩方式、本地头文件名、解压长度和中央目录 CRC32；图片清单逐文件记录 SHA256。ETag/CRC 是源与传输的一致性检查，不是上游签名，也没有声称取得完整 ZIP 的 SHA256。

全部原图只保存在忽略的 `.tmp/mot17-reid-media/data/`，不分发原图、完整 GT 或检测文件。42 张与此前预处理研究重叠的图片逐字节身份一致。没有以先看评分的方式挑帧、挑序列或调整参数。

复跑时，图片准备完成后、执行正式 run 前，须从 SDK 根目录运行以下命令恢复固定媒体锁：

```powershell
Copy-Item -LiteralPath 'reports/2026-09-21-mot-reid/media.lock.json' -Destination '.tmp/mot17-reid-media/media.lock.json' -Force
```

历史 `prepare_media.py` 将 `transferredBytesThisRun` 写入内容身份锁，完整缓存重跑会写0，改变锁的整文件hash；归档值876659951仅代表历史下载观测，不是本次传输量。恢复归档固定锁后，run 仍逐项核验图片字节数、SHA256和CRC，不修改归档锁绕过门禁。统计与身份分离是已知非阻塞工具待办；保留历史脚本与正式运行身份，不影响本轮已经完成的实测。

## 模型与输入

采用已核验的 PPLCNet FP32 模型，33704835 字节，SHA256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`；预处理和归一化由生产 SDK 完成。模型来源与许可沿用 `models/pplcnet-reid/0.1.0/` 的唯一注册数据。

复用 `scripts/evaluation/mot17/adapter.mjs` 的时间戳、零基半开坐标裁剪和浮点贴边处理；保持行序和空帧，不在特征提取前筛选低分。图像由真实浏览器解码为 RGBA，同一帧所有检测特征成功后才关联一次。模型每批上限 64，超过时分块保序，不丢弃检测。

ByteTrack、OC-SORT、DeepSORT 的公共阈值来自既有锁：高分 0.5、新轨迹 0.6、minHits=2、匹配 IoU 0.3、maxLostMs=1000、largeGapMs=2000、maxDetections=100、maxTracks=200。ByteTrack 另用低分阈值 0.1/低分匹配 IoU 0.2。OC-SORT 和 DeepSORT 专属参数保持候选默认，不根据评分调整。

## 正式与补充评测

正式范围为七段全部画面，在同一桌面 Chromium 中使用实际 WebGPU ReID，配合 CPU/main 的三种关联算法。提取向量冻结后，各算法在 Node 从新实例重复两次；比较 MOT 和剔除计时的结果确定性，再与浏览器对应输出比较。补充验证固定为 MOT17-02 的前 30 帧，分别使用 WebGPU 与 WASM；该子集不替代或混入全量成绩。

官方评分器是 TrackEval `12c8791b303e0a0b50f753af204249e622d0281a`，Python 3.11.15、NumPy 1.23.5、SciPy 1.10.1，Identity/CLEAR、pedestrian、DO_PREPROC=true、IoU 0.5。使用官方 combine_sequences 合计，不能平均各段百分比。

## 耗时与结论边界

区分本地模型字节获取、校验/会话创建、图片获取、浏览器解码、模型预处理/推理/归一化、CPU 关联和外围帧总时间。各层总时间独立计时，不能相加不同运行的中位数，也不能把模型 GPU 执行写成 GPU 关联。模型分发下载已有独立证据，本轮本地模型字节输入不作为公网下载性能。

正式计时不运行检测器、视频编解码流水线、渲染或门户 Workflow，不将其称为实际视频端到端 FPS。首帧包含首次执行成本，后续帧复用会话和跟踪状态；每段新建会话/实例须单列加载成本。Node 冻结向量的计时只衡量关联。

结果是固定训练集与单机环境的观测，不是 MOT17 测试集榜单、上游算法逐值复现、真实手机或跨浏览器兼容承诺。较少 IDSW 不代表总体精度提升，发布判断必须同时看 IDF1、MOTA、FP/FN 和额外成本。

正式运行完成后按原始逐帧计时归档：每段首帧为cold，其余为warm；合并样本排序，p50取floor((n−1)×0.5)，p95取ceil((n−1)×0.95)，不插值、不平均逐段分位数。模型加载单列，无额外预热帧剔除。三套完整配置比较没有DeepSORT禁用外观消融，不能把差异单独归因ReID模型。正式Python运行固定PYTHONUTF8=1和PYTHONIOENCODING=utf-8；补充比较独立核验48个原始输出hash。归档计时压缩样本不含特征向量或轨迹，离线验证只校验hash、公式与统计，不冒充重新运行官方评分。
