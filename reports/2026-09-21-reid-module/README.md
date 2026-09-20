# ReID 可选模块本地验收

[English](README.en.md) · [候选接口指南](../../docs/zh-CN/reid-candidate.md)

日期：2026-09-21（Asia/Shanghai，机器记录使用 UTC）。本阶段完成同包 `src/reid/` 源码候选：已解码人体 RGBA 和检测框 → 512 维外观向量 → 现有 DeepSORT。实现基线 `4bbd3d5`，模块提交 `6fc6e5a`，下载与取消修复 `5dcd2d4`。SDK 本地仍为 `0.2.0-alpha.0`，线上版本仍为 `0.1.0`。

候选构建位于忽略目录 `.tmp/reid-module/dist/`，没有加入正式 `package.exports` 或发行 `dist`。正式模型双源、hybrid manifest、公开子入口及 Demo 模型控件尚待后续阶段；没有上传模型、推送 GitHub 或发布 npm。根包仍提供三种 CPU/main 跟踪策略。

## 模型与验收结果

固定 PPLCNet ReID FP32 ONNX 为 33,704,835 字节，SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`。模型、原图均未纳入提交。来源、转换、许可与训练披露见[上轮模型卡](../2026-09-20-reid-preprocessing/model-card.md)，本轮不扩大其证据范围。

参考来自上轮固定 Paddle 原始输出，独立执行 L2 归一化后比较。门槛为 maxAbs < 1e-3、余弦距离 < 1e-5、单位范数误差 < 1e-6。

| 模型后端 | 通过样本 | 最大绝对差 | 最大余弦距离 | 最大单位范数误差 |
| --- | ---: | ---: | ---: | ---: |
| WASM | 34/34 | 3.502e-7 | 2.820e-12 | 3.202e-9 |
| WebGPU | 34/34 | 4.396e-7 | 3.096e-12 | 4.375e-9 |

34 组包含 8 组人工图和 26 组真实裁剪。唯一越界研究样本 `clipped` 的原框先确认被生产入口拒绝，再显式取图内等价交集、保持原整数裁剪区参与比较；归档标记 `equivalentClippedBox`，其余 33 组原框不变。

本机 Windows 11 10.0.26200、i5-10400F、RTX 5060 Ti（驱动 32.0.16.1692）、Chromium 153.0.8010.12、ORT Web 1.27.0、Node 24.16.0。ORT 实际 GPUDevice 报告 NVIDIA/Blackwell、非 fallback；WebGPU 禁 CPU EP 回退。仅代表本机带日期结果，未据此声明手机或其他浏览器兼容。

## 生命周期、缓存与包边界

- 工厂同步复制模型；extract 在异步工作前复制图像和检测元数据，先验证完整一帧。绑定模型 SHA、预处理与 L2 规则的 featureSpace 在运行时只读。
- 单实例并发返回 BUSY；取消等待当前 ORT run 与回读结束，释放 Tensor，丢弃整帧。dispose 幂等且等待活动任务。两后端均通过取消后再次成功提取。
- 重复同一真实裁剪送 DeepSORT 后 ID 保持 1，关联实际后端为 CPU。它是接口测试，不能代表真实时间序列质量提升。
- 真实 CacheStorage 完成首次下载 stored、再次 hit、损坏缓存 INTEGRITY_FAILED、只清理自身命名空间。受控短响应同样拒绝；额外 gzip 传输经浏览器解压后通过固定模型 SHA 和会话创建。总计三次请求，没有静默换源或重新下载坏缓存。
- HTTPS 地址由 Playwright 在本机拦截，未访问真实模型 hub。`test-only` 仓库及全 a revision 仅为测试输入，不能用于发布清单或当作实际来源证据。
- 根算法和候选入口仅 import/创建/释放时没有 ORT 或 ONNX 请求；ORT 仅在 load 会话阶段动态加载。
- 实际 tarball 为 22,861 字节，SHA-256 `4d15a44fcdfde6bbf16a5309ad7fb91ecd5f40a30ed5ce3283ee70bab3e88ef9`，没有 ReID、模型或 ORT 文件，也无生产依赖。ESM/CJS 核心哈希与基线相同；包哈希因文档及开发元数据而改变。

load 单独记录下载、缓存读取、SHA、会话与总耗时；extract 记录验证复制/预处理/构造 Tensor、推理、输出回读/归一化/释放和总耗时，decodeMs=0。工厂模型复制发生在 load 之前，不包含于 load.totalMs。本轮保留逐次 timings，但未做固定预热的性能排名，也不报告完整视频 FPS。

## 检查与重现

模块 `6fc6e5a` 的 SDK 完整 verify 通过 138 项单测、类型检查、核心/Demo/Vanilla/React 构建、三算法实际 ESM/CJS/TypeScript 包消费和 12 组原有浏览器检查。新增 ReID 单测当时为 34 项；审查修复再增加 7 项，生命周期聚焦回归 37/37、类型与候选构建通过，没有重复无变化的全套。保留首次未实现、边界、释放及下载修复的红绿日志。最终修复版本重新完成两后端各 34 组与 gzip/缓存复核。

对应门户标准已本地实施 1.3.0；before/after 各 17 项 required 通过、0 失败，仅证明当前 algorithm 发行核心 locally-compliant。候选模型没有用算法清单豁免正式分发与 Demo 门槛。

有固定本地模型和 RGBA 资源时：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false build:reid-candidate
openssl req -x509 -newkey rsa:2048 -nodes -keyout .tmp/reid-module/localhost-test.key -out .tmp/reid-module/localhost-test.crt -days 7 -subj /CN=localhost -addext subjectAltName=DNS:localhost,IP:127.0.0.1
node tests/reid-browser.mjs
```

Windows 可将 `openssl` 换成 `& 'C:/Program Files/Git/usr/bin/openssl.exe'`。临时证书仅供本机测试，浏览器测试上下文忽略其信任错误，不安装系统证书，私钥保留在忽略目录。也可用 `TRACKING_REID_TLS_KEY` / `TRACKING_REID_TLS_CERT` 指向已有测试证书。

首次 gzip 路由模拟失败保留在 `browser-gzip-route-failed.log`。最小诊断 `browser-gzip-diagnostic.log` 记录：4096-byte 内容压缩为39字节，Playwright route.fulfill交给fetch的仍是39字节，真实TLS响应由浏览器解压回4096字节。因此最终测试使用真实本机HTTPS传输模型，不放宽SDK完整性规则。

不需要模型或浏览器的归档复算：

```powershell
node reports/2026-09-21-reid-module/verify_archive.mjs
```

[协议](protocol.md)、[归档锁](evidence.lock.json)、[汇总](evidence/validation.json)、[浏览器原始向量](evidence/browser-result.json.gz)、[环境](evidence/environment.json)和[完整检查日志](evidence/sdk-verify.log)保留证据。复算脚本核对锁定文件并从原始向量重算 68 条误差，不重新执行模型，也不能替代新平台实测。`summarize.mjs` 和 `archive.mjs` 是维护者在完成验证后生成归档的工具。

下一阶段是核实可采用的权重许可依据与署名、落实 ModelScope 默认/Hugging Face 可选的真实不可变来源，随后启用公开子入口、hybrid manifest 和 Demo。真实检测序列的 IDF1/IDSW/MOTA、完整成本以及视频/摄像头帧调度仍需分别验收；门户 Workflow 继续暂缓。
