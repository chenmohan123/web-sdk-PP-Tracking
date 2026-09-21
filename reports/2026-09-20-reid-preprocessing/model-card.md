# PPLCNet ReID FP32 模型卡草案

[English](model-card.en.md)

日期：2026-09-20。状态：本地候选，非稳定产品、尚未分发。本卡记录已核实的来源和适配定义，不补写上游未披露的信息。

## 身份和用途

- 上游：[PaddleDetection](https://github.com/PaddlePaddle/PaddleDetection/tree/b25522a0f4bde8c80603f3ba5e3472059972e3b5)，固定提交 `b25522a0f4bde8c80603f3ba5e3472059972e3b5`。
- 人体 ReID 网络：`PPLCNetEmbedding`，PPLCNet scale 2.5，1280维neck输入、512维输出。它提取单个人体裁剪的外观特征；不负责检测框、视频解码、ID分配或跟踪。
- 官方 checkpoint：[README地址](https://paddledet.bj.bcebos.com/models/mot/deepsort/deepsort_pplcnet.pdparams)与[配置地址](https://paddledet.bj.bcebos.com/models/mot/deepsort_pplcnet.pdparams)在2026-09-19内容一致；36,769,814字节，SHA-256 `abce7d12af14b5b5c10c287ba01517470db3247ee06e3beeaa5ffc1c76628758`。
- 本地转换 ONNX：FP32、opset17、33,704,835字节，SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`。输入`crops: float32[1,3,192,64]`，输出`save_infer_model/scale_0.tmp_0: float32[1,512]`。
- 固定参数完整加载146个推理状态张量，合计8,419,792个元素（包含BN状态，不冒称全部为可训练参数）。不使用checkpoint内额外的训练分类头`head.weight [512,1502]`，因为它不属于原Embedding forward。

## 转换和图像契约

Paddle2ONNX1.3.1从Paddle2.6.2原始FP32模型导出。只去除模型注册依赖，没有修改推理权重。ONNX本身不包含图像裁剪、标准化和输出L2归一化。

下一模块的预处理候选固定为`rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`：已解码sRGB非预乘RGBA8，方向已处理；宽高各<=8192、总像素<=16,777,216。0起点xywh框与图像求交后，左/上floor、右/下ceil，右/下边界不含。空交集拒绝，正常朝向，输出64x192；透明像素先以白底合成，双线性half-pixel在float64计算并钳位到裁剪边界，最终按ImageNet均值/标准差归一化并转FP32。完整定义见[运行前协议](protocol.md)，探针见`probe/preprocess.mjs`与独立Python参考`probe/reference.py`。

该预处理是本项目明确命名的适配，与固定上游部署中的转置BGR路径不同；不声称等同未公开的训练预处理，也不承诺与OpenCV整数插值逐值一致。特征输出必须显式L2归一化；未来特征空间ID同时绑定ONNX哈希、该预处理版本和`l2-f32-v1`输出规则，不能只写“512维”。

## 训练披露与许可证据

固定官方ReID README记载：模型由PaddleClas提供，在Market1501（751类）训练，训练细节待PaddleClas公布。不能由1502维训练头自行推断训练集合、身份增强方法或训练流程。Market1501作者页面描述1501身份、32668框和6摄像头，并要求研究使用时引用论文；这不是本checkpoint的再分发授权。

根README的License章节写明`PaddlePaddle is provided under the Apache 2.0 license`；固定根LICENSE及模型、预处理文件头为Apache-2.0。这是已取得的官方代码许可依据。[来源记录](sources.lock.json)保存实际URL、时间、字节数、SHA-256及404响应。所读取材料中未找到checkpoint独立模型卡或专属许可声明；只检查一个目录README返回404，不代表其他地方没有声明。

因此本卡明确区分：代码Apache-2.0已核实，checkpoint专属条款和完整训练数据条件未独立核实。不把这些未知写成“禁止商用”，也不填造权重专属SPDX。未来若依据官方仓库整体授权分发，须在发行模型卡中说明采用的依据及其范围，附许可、署名、原权重与转换身份；不得把本卡当作已取得独立授权的证明。

## 已测量的结果与限制

- 2026-09-19：原Paddle/PythonORT/浏览器WASM/WebGPU，8边界/纹理+24真实张量，三种运行方式各32/32通过。
- 2026-09-20：确定性图像预处理的34组输入（8人工边界+26真实裁剪），Node/Chromium张量与Python完全相同；浏览器两后端各34/34特征向量通过maxAbs<1e-3且cosineDistance<1e-5。33组不透明PNG逐像素相同；5张JPEG只在本次浏览器/解码器矩阵测得相同。
- 透明PNG反例：Canvas可能经预乘往返丢失隐藏颜色、量化半透明RGB，独立4像素PNG诊断有7/16字节变化、最大差247。透明PNG逐字节一致目标未通过；raw RGBA透明白底合成通过不等于原文件解码等价，见协议的运行后偏离记录。
- 上轮02/04序列的正常RGB OpenCV路径87/95；本轮独立于上轮的05/09/10/11/13序列确定性RGB路径53/67（79.10%），OpenCV RGB52/67，确定性BGR50/67。每段首帧图库、后续同ID查询，属于带GT框的同摄像头闭集小样本；不是完整MOT17、跨摄像头精度或跟踪ID指标。
- 特征距离阈值仍需在真实检测和时间序列上评估。0.2没有在本轮调优；相似衣着、遮挡、光照、低分辨率和相机运动均可能降低可分辨性。
- 矩阵：Windows11/i5-10400F/RTX5060Ti/Chromium153.0.8010.12/ORT Web1.27.0；WASM单线程、WebGPU实际硬件且无CPU EP回退。未测手机、Safari/Firefox、Worker、NPU、动态batch、摄像头或完整视频。

## 分发与产品状态

当前权重与原图只在本地忽略目录，未上传至ModelScope/Hugging Face，故没有这两个源的revision或下载URL。分发计划仍是ModelScope默认、Hugging Face可选；上传后须实际回读固定revision、bytes、SHA-256并核验CORS及浏览器下载，不预填不存在的地址。

本地Tracking SDK仍为`0.2.0-alpha.0`三种CPU/main跟踪策略，线上仍为`0.1.0`。本轮研究不构成模型已加载到SDK/Demo；同包模型入口接入前须演进标准的混合声明与检查规则。报告与来源链可本地审阅，不是发布公告。
