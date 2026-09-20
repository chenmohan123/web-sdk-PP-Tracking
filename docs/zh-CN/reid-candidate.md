# ReID 源码候选

[English](../en/reid-candidate.md) · [首页](../../README.md)

本地开发模块用于从已解码人体图像裁剪提取 512 维外观向量，供现有 DeepSORT 策略消费。它不产生检测框、不读取视频或摄像头，也不分配轨迹 ID。根入口的三种跟踪算法继续使用 CPU/main，特征提取单独选择 WASM 或 WebGPU。

该模块位于 `src/reid/`，以候选脚本构建到忽略目录 `.tmp/reid-module/dist/`，**尚未加入 npm 的 package.exports 或发行 dist**。现有 `sdk-manifest.yaml` 只声明发行核心；它的 algorithm 合规结果不能证明候选模型已完成分发、Demo 或发布验收。正式子入口计划为 `web-sdk-pp-tracking/reid`，目前不能这样从 npm 包导入。

## 输入与模型身份

固定模型 `pplcnet-reid-fp32`：33,704,835 字节 FP32 ONNX，SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`，输入 `[1,3,192,64]`，输出 `[1,512]`。模型文件不随代码提交或进入 tarball，来源、转换、训练披露和许可范围见[模型卡](../../reports/2026-09-20-reid-preprocessing/model-card.md)。

图像为 `RgbaImage={width,height,data}`，data只能是 Uint8Array 或 Uint8ClampedArray 的非共享缓冲；尺寸为正整数，各不超过8192，总像素不超过16777216，长度严格等于宽×高×4。调用者先完成EXIF/方向、sRGB和非预乘RGBA解码。本模块不保证任意透明PNG在Canvas解码时的隐藏颜色保真。

每个检测提供 `{box:{x,y,width,height},score,classId}`，完整位于图内；坐标有限、宽高正数，score在0至1间，classId为非负安全整数。默认最多32个检测，可设置1至64；不接受越界框并静默裁剪。候选像素规则将合法框左/上floor、右/下ceil，白底合成透明颜色，正常朝向RGB，half-pixel双线性缩放到64×192，float64中间值，ImageNet标准化后FP32。

输出按原输入顺序绑定embedding，保留原浮点框、分数和类别。512维向量先以float64范数L2归一化再写Float32Array，禁止零范数或非有限值。featureSpace同时绑定模型哈希、`rgba8-white-upright-rgb-halfpixel-f64-imagenet-f32-v1`和`l2-f32-v1`；不同模型或预处理即使维度相同也不可混用。

## 本地源码调用

在已配置TypeScript构建的仓库源码消费者中导入 `src/reid/index.ts` 的工厂；这不是已发布的npm安装示例：

```ts
import { createReIdExtractor } from './src/reid/index.js';
import { createTracker } from './src/index.js';

const extractor = createReIdExtractor({
  modelId: 'pplcnet-reid-fp32', backend: 'wasm', modelBytes,
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

`modelBytes`是调用者准备的精确模型ArrayBuffer；`image`和`detections`遵循上述契约，`timestampMs`沿用Tracker递增时间规则，`signal`可省略。仅在整帧提取成功后调用tracker.update；取消或推理失败没有部分向量，调用者不得推进同一帧的关联状态。

模型字节在工厂入口复制，图像及检测元数据在extract入口复制，异步期间调用者修改原对象不改变本次工作。根入口不加载ORT；候选入口也只在load时动态加载ORT Web。首版候选仅main，WASM单线程，GPU不静默回退CPU。

## 生命周期和错误

load成功后可重复extract，ready状态的load幂等。每实例同时只能进行一次load/extract，重入返回BUSY，不排队。load失败回到idle并可重试，extract失败保留可继续工作的ready状态。backend/source变更须dispose后新建实例，同时复位依赖该特征空间的Tracker。

取消检查入口、下载、会话创建边界、每次裁剪及提交边界。ORT单次run不承诺中途抢占，取消后等待它结束、释放Tensor并丢弃整帧。dispose幂等，立即禁止新调用，等待当前操作完成后释放会话，不在运行中提前release。

稳定错误码：INVALID_INPUT、INVALID_MANIFEST、UNSUPPORTED_BACKEND、DOWNLOAD_FAILED、INTEGRITY_FAILED、OUT_OF_MEMORY、SESSION_FAILED、INFERENCE_FAILED、ABORTED、BUSY、NOT_LOADED、DISPOSED。可识别的内存不足归OUT_OF_MEMORY；设备丢失按发生阶段归SESSION_FAILED或INFERENCE_FAILED，不把未知错误猜成内存不足。

## 资源、缓存和耗时

工厂接受modelBytes或明确的source，二者互斥。source包含kind（modelscope/huggingface）、repository、不可变revision、path、HTTPS downloadUrl、bytes、sha256；其内容身份必须对应固定模型。本地验证可使用受控资源，正式hub来源没有预填默认URL；发布后仍计划ModelScope默认、Hugging Face可选。

本地modelBytes不写持久缓存。远程模型使用本SDK专属CacheStorage，命中仍检查bytes/SHA；缓存损坏报告完整性失败，来源失败不自动换源。`estimateReIdCache()`报告bytes/entries，`clearReIdCache()`仅清理本模块缓存；清理不等于释放已加载实例，也不复位Tracker，完整清理由宿主先取消/释放并复位相关跟踪状态。

load报告下载、缓存读取、完整性、会话与总耗时；extract报告预处理、推理、归一化与本次总耗时。decodeMs为0，解码由宿主完成；模型特征与CPU关联分别计量，不能相加不同次运行的中位数冒充完整视频帧率。

## 验证与发布范围

[本地阶段报告](../../reports/2026-09-21-reid-module/README.md)保存实际测试环境、浏览器向量、取消恢复和缓存证据。浏览器测试需要本地固定模型和上轮RGBA fixtures，运行 `node tests/reid-browser.mjs`；`TRACKING_REID_FIXTURES`可指定fixtures目录，`TRACKING_REID_ORT_DIST`指定ORT Web1.27.0的dist目录。测试不会访问真正的模型hub。

压缩下载验收使用本机 HTTPS 及临时自签名证书；准备命令见阶段报告。默认读取 `.tmp/reid-module/localhost-test.key` 与 `.crt`，或用 `TRACKING_REID_TLS_KEY` / `TRACKING_REID_TLS_CERT` 指定。仅自动测试的浏览器上下文忽略证书错误，无需安装证书，证书和私钥不提交。

正式发布仍需模型卡采用的许可依据、署名及真实双源不可变revision/哈希/CORS证据，然后启用hybrid manifest、公开子入口与Demo。真实检测时间序列的IDF1/IDSW/MOTA及完整成本尚需后续评测，重复帧接口测试不等于真实跟踪质量。未声明手机、Safari、Firefox、Worker、NPU或完整视频/摄像头兼容。
