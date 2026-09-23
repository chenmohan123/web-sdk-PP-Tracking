# ReID 可选模块（预发布能力）

[English](../en/reid-candidate.md) · [首页](../../README.md)

预发布模块用于从已解码人体图像裁剪提取 512 维外观向量，供现有 DeepSORT 策略消费。它不产生检测框、不读取视频或摄像头，也不分配轨迹 ID。根入口的跟踪算法继续使用 CPU/main，特征提取单独选择 WASM 或 WebGPU。

预发布构建与 tarball 已提供 `web-sdk-pp-tracking/reid` 独立 ESM/CJS/类型入口，`sdk-manifest.yaml` 使用标准1.3.0 hybrid，同时声明算法和模型。需要先按首页安装 0.2.0-rc.2，再安装可选依赖 `onnxruntime-web@1.27.0`。根入口用户不需要这个依赖，权重不进入tarball。

## 输入与模型身份

固定模型 `pplcnet-reid-fp32`：33,704,835 字节 FP32 ONNX，SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`，输入 `[1,3,192,64]`，输出 `[1,512]`。模型文件不随代码提交或进入 tarball，来源、转换、训练披露和许可范围见[模型卡](../../models/pplcnet-reid/0.1.0/README.md)。

图像为 `RgbaImage={width,height,data}`，data只能是 Uint8Array 或 Uint8ClampedArray 的非共享缓冲；尺寸为正整数，各不超过8192，总像素不超过16777216，长度严格等于宽×高×4。调用者先完成EXIF/方向、sRGB和非预乘RGBA解码。本模块不保证任意透明PNG在Canvas解码时的隐藏颜色保真。

每个检测提供 `{box:{x,y,width,height},score,classId}`，完整位于图内；坐标有限、宽高正数，score在0至1间，classId为非负安全整数。默认最多32个检测，可设置1至64；不接受越界框并静默裁剪。候选像素规则将合法框左/上floor、右/下ceil，白底合成透明颜色，正常朝向RGB，half-pixel双线性缩放到64×192，float64中间值，ImageNet标准化后FP32。

输出按原输入顺序绑定embedding，保留原浮点框、分数和类别。512维向量先以float64范数L2归一化再写Float32Array，禁止零范数或非有限值。featureSpace同时绑定模型哈希、`rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`和`l2-f32-v1`；不同模型或预处理即使维度相同也不可混用。

## 本地包调用

安装 RC 包与可选 ORT 后，使用同包子入口；这不是已发布0.1.0的功能：

```ts
import { createReIdExtractor } from 'web-sdk-pp-tracking/reid';
import { createTracker } from 'web-sdk-pp-tracking';

const extractor = createReIdExtractor({
  modelId: 'pplcnet-reid-fp32', backend: 'wasm', source: 'modelscope',
});
const tracker = createTracker({ algorithm: 'deepsort', featureSpace: extractor.featureSpace });
try {
  const loaded = await extractor.load({ signal });
  const features = await extractor.extract({ image, detections }, { signal });
  const result = tracker.update({
    timestampMs, imageSize: { width: image.width, height: image.height },
    featureSpaceId: features.featureSpace.id, detections: features.detections,
  });
  console.log(loaded, features.runtime, features.timings, result);
} finally {
  tracker.dispose();
  await extractor.dispose();
}
```

省略source默认ModelScope，可显式选`huggingface`；`getReIdModelSource()`返回固定来源快照。也可用精确模型ArrayBuffer的`modelBytes`替代source，二者互斥。`image`和`detections`遵循上述契约，`timestampMs`沿用Tracker递增时间规则，`signal`可省略。仅在整帧提取成功后调用tracker.update；取消或推理失败没有部分向量，调用者不得推进同一帧的关联状态。

模型字节在工厂入口复制，图像及检测元数据在extract入口复制，异步期间调用者修改原对象不改变本次工作。根入口不加载ORT；候选入口也只在load时动态加载ORT Web。首版候选仅main，WASM单线程，GPU不静默回退CPU。

## 生命周期和错误

load成功后可重复extract，ready状态的load幂等。每实例同时只能进行一次load/extract，重入返回BUSY，不排队。load失败回到idle并可重试，extract失败保留可继续工作的ready状态。backend/source变更须dispose后新建实例，同时复位依赖该特征空间的Tracker。

取消检查入口、下载、会话创建边界、每次裁剪及提交边界。ORT单次run不承诺中途抢占，取消后等待它结束、释放Tensor并丢弃整帧。dispose幂等，立即禁止新调用，等待当前操作完成后释放会话，不在运行中提前release。

稳定错误码：INVALID_INPUT、INVALID_MANIFEST、UNSUPPORTED_BACKEND、DOWNLOAD_FAILED、INTEGRITY_FAILED、OUT_OF_MEMORY、SESSION_FAILED、INFERENCE_FAILED、ABORTED、BUSY、NOT_LOADED、DISPOSED。可识别的内存不足归OUT_OF_MEMORY；设备丢失按发生阶段归SESSION_FAILED或INFERENCE_FAILED，不把未知错误猜成内存不足。

## 资源、缓存和耗时

工厂接受modelBytes或source字符串/明确来源对象，二者互斥。来源对象包含kind（modelscope/huggingface）、repository、不可变revision、path、HTTPS downloadUrl、bytes、sha256，内容身份必须对应固定模型。内置[双源清单](../../models/pplcnet-reid/0.1.0/sources.json)已实际上传并匿名回读，ModelScope默认、Hugging Face可选；失败不静默切换。

本地modelBytes不写持久缓存。远程模型使用本SDK专属CacheStorage，命中仍检查bytes/SHA；缓存损坏报告完整性失败，来源失败不自动换源。`estimateReIdCache()`报告bytes/entries，`clearReIdCache()`仅清理本模块缓存；清理不等于释放已加载实例，也不复位Tracker，完整清理由宿主先取消/释放并复位相关跟踪状态。

load报告下载、缓存读取、完整性、会话与总耗时；extract报告预处理、推理、归一化与本次总耗时。decodeMs为0，解码由宿主完成；模型特征与CPU关联分别计量，不能相加不同次运行的中位数冒充完整视频帧率。

## 验证与发布范围

[本地阶段报告](../../reports/2026-09-21-reid-module/README.md)保存实际测试环境、浏览器向量、取消恢复和缓存证据。浏览器测试需要本地固定模型和上轮RGBA fixtures，运行 `node tests/reid-browser.mjs`；`TRACKING_REID_FIXTURES`可指定fixtures目录，`TRACKING_REID_ORT_DIST`指定ORT Web1.27.0的dist目录。测试不会访问真正的模型hub。

压缩下载验收使用本机 HTTPS 及临时自签名证书；准备命令见阶段报告。默认读取 `.tmp/reid-module/localhost-test.key` 与 `.crt`，或用 `TRACKING_REID_TLS_KEY` / `TRACKING_REID_TLS_CERT` 指定。仅自动测试的浏览器上下文忽略证书错误，无需安装证书，证书和私钥不提交。

本轮[分发与接入报告](../../reports/2026-09-21-reid-distribution/README.md)记录真实双源与公开入口、Demo的验收。`node tests/reid-distribution-browser.mjs`使用正式dist子入口实测双源CPU/GPU，需上轮本地RGBA资源。Demo的“图像+检测框”模式采用本地图片与调用者检测数组逐帧提取并跟踪；没有自动检测器。[真实同输入评测](../../reports/2026-09-21-mot-reid/README.md)使用0.2.0-alpha.0已完成七段5316帧/67639检测：DeepSORT+PPLCNet的IDF1为45.4637%，低于ByteTrack的48.2922%；其余指标及完整成本见报告，不能据局部指标宣称总体提升。当前预发布版本为 0.2.0-rc.2，本文模型验证仍保留原始阶段身份；rc.2 新增独立运动估计实验，ByteTrack默认，ReID保留人体场景实验能力；没有禁用外观消融，不能把结果单独归因模型。未声明手机、Safari、Firefox、Worker、NPU或完整视频/摄像头兼容。
