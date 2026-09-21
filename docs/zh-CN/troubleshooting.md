# 排错

[English](../en/troubleshooting.md) · [首页](../../README.md)

| 错误/现象 | 处理 |
| --- | --- |
| INVALID_INPUT | 检查有限数值、xywh边界、分数/类别、数量、时间升序和尺寸一致；DeepSORT还要求每帧标识匹配且每个检测都有有限、非零范数、维度一致的向量；seek先reset |
| INVALID_OPTIONS | ByteTrack须低≤高≤新建，OC-SORT/DeepSORT须高≤新建；DeepSORT须合法featureSpace、余弦门限/图库容量及400万标量上限；不要传未知字段、undefined或另一策略的专属参数 |
| ABORTED | 计算前signal已取消；新建AbortController重试 |
| DISPOSED | 已释放实例不能重用，重新createTracker |
| NUMERICAL_FAILURE | 检查极端数值和时间间隔，当前状态未提交；必要时reset后使用合理尺度 |
| ID_EXHAUSTED | reset开始新代次；勿将ID当永久身份 |
| FILE_TOO_LARGE / INVALID_SEQUENCE | Demo原文件及规范化后的紧凑输入序列均≤5MiB（按UTF-8字节）；frames为1–3000帧，每帧≤100框；DeepSORT空检测序列无法推导维度时须在顶层声明featureSpace；失败保留现有配置、序列与结果 |
| 丢失后低分不能恢复 | lost仅接受高分；低分第二阶段仅适用于尚未失配的tracked |
| 交叉换ID | ByteTrack/OC-SORT无外观；DeepSORT依赖外观特征质量。可选ReID模块也不保证真实身份，尚无同输入真实序列精度提升结论 |
| 模型源下载失败 | 核对所选ModelScope/Hugging Face可达性和CORS；显式选择不会自动换源，可在释放/复位后自行切换 |
| INTEGRITY_FAILED | 字节或SHA-256不匹配；清理本SDK缓存后重试，不跳过校验 |
| SESSION_FAILED / 无法解析 onnxruntime-web | 本地候选使用ReID需安装可选peer onnxruntime-web@1.27.0，并确保构建后的引擎MJS/WASM资源可达 |
| UNSUPPORTED_BACKEND | 使用HTTPS/localhost，核对WebGPU可用性；GPU不会静默回退，必要时显式选择CPU(WASM) |
| 图像提取失败或取消 | 不推进帧序号及关联状态；修正图像/检测数组后重试。图像≤20MiB、每维≤8192且总像素≤16777216，Demo模型模式每帧最多32个框 |
| 找不到包产物 | 先npm run build，再运行Demo、测试或本地打包 |

Demo参数应用失败时原运行不变；合法应用创建新实例、清空历史。播放结束后重新开始再播放。紧凑输入序列可在尚未处理时导出，读取或播放时禁用；结果报告仅在有已处理结果且暂停时可用，可能超过5MiB，重放应使用输入序列导出。
浏览器缺失时执行首页的Playwright安装命令，或设置PLAYWRIGHT_BROWSERS_PATH到匹配版本缓存，不能跳过测试伪称通过。
