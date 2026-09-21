# ReID 双源分发与本地公开入口

[English](README.en.md) · [接口指南](../../docs/zh-CN/reid-candidate.md)

日期：2026-09-21。已完成固定人体ReID模型的真实双源分发、同包公开子入口、本地图像工作台及1.3 hybrid清单。SDK仍为本地 `0.2.0-alpha.0`；npm、GitHub Release、线上Demo仍为 `0.1.0`。本阶段没有推送GitHub、发布npm或部署线上Demo。

## 模型及来源

PPLCNet ReID FP32 / ONNX opset17，输入 `[1,3,192,64]`，输出512维L2向量。权重33,704,835字节，SHA-256 `24d347f47405bb1bd24fd582783507edbcb16571d2e845d0528b0ad7856336e4`。参数数目为null；8,419,792是含BN的推理状态元素，不是可训练参数计数。

| 来源 | 不可变revision |
| --- | --- |
| ModelScope（默认） | `dc3d9f7a97be4033e654525f0e9d3fbd5eaf7c9b` |
| Hugging Face（可选） | `02c299b5b5618315fc754002b7ea7c95c95e8a82` |

两源仓库均为 `chenmohan/web-sdk-pp-tracking`，路径 `pplcnet-reid/0.1.0/pplcnet-reid-fp32.onnx`。实际URL、匿名完整下载与固定hash见[分发回执](distribution.json)；11个上传文件包含模型、双语模型卡、LICENSE、NOTICE和元数据，详见[上传清单](upload-inventory.json)。未把模型或原图放入Git/npm。

采用官方固定仓库整体Apache-2.0作为其明确链接人体checkpoint的转换分发依据，保留许可及转换署名。[模型卡](../../models/pplcnet-reid/0.1.0/README.md)明示尚未找到checkpoint专属授权/独立模型卡及完整训练过程；官方披露Market1501、PaddleClas提供、细节待公开，不将数据集条款等同模型许可。根README为符号链接文本，实际README_en已核验；独立ReID README本轮为200，NOTICE路径404不推断其他声明不存在。固定URL/status/hash见[上游证据](upstream-evidence.json)。

## SDK 与 Demo

根 `web-sdk-pp-tracking` 继续三种CPU/main策略，运行时导出仍createTracker/TrackingError。新增 `web-sdk-pp-tracking/reid` 的ESM/CJS/types；ORT Web1.27.0是可选peer，只在load会话时动态加载。根调用者无需安装ORT，导入子入口、创建及释放也不加载引擎。来源默认MS，HF显式选择，失败不静默切换。

Demo默认保留框/向量模式；选择“图像＋检测框”后提供本地图片和一帧人体检测数组，提取后交给DeepSORT，不自动检测。模型WASM/WebGPU与关联CPU分别显示。成功帧每次推进100ms；失败/取消不推进，同尺寸换图保留轨迹，尺寸改变须复位。来源/后端切换释放复位，清理等待任务结束并只清理本SDK缓存。图像限20MiB、每维8192、总像素16777216，模型工作台最多32框；浏览器透明图解码不承诺文件字节保真。

## 日期化验证

本机Windows11 10.0.26200、i5-10400F、RTX5060Ti/32.0.16.1692、Chromium153.0.8010.12、ORT1.27.0、Node24.16.0；[环境](evidence/environment.json)。

| 实测 | 结果 |
| --- | --- |
| 真实MS/HF × WASM/WebGPU | 四个独立冷缓存页面各下载所选固定URL一次，stored，SHA与来源身份一致 |
| 独立Paddle参考归一化比较 | WASM maxAbs 2.4586915969848633e-7；GPU 2.53552570939064e-7；余弦/单位范数门槛通过 |
| GPU真实性 | NVIDIA Blackwell、非fallback；模型请求及实际后端相同 |
| Vite生产模型Demo | MS/WASM与HF/WebGPU真实加载、连续帧、语言、非法输入、取消、复位/清理、其他缓存保留 |
| 界面 | 默认及仅切模式无ORT/模型请求，空预览无破图；390px中英文无横向溢出 |
| SDK完整verify | 13文件164项单测、12组原有浏览器检查、类型/包消费/核心/Demo/Vanilla/React构建通过 |
| 标准after | 21 required通过、0失败、4远程skip；仅locally-compliant |

数值验证使用上一阶段首个真实裁剪，并独立归一化Paddle原始向量；不把单样本来源验证当作重新执行34fixture矩阵。[原始四组向量](evidence/sources-browser.json)、[生产交互](evidence/demo-browser.json)、[完整日志](evidence/sdk-verify.log)、[原浏览器结果](evidence/sdk-browser.json)分别归档。Vite提示ORT独立chunk超过500kB，属于显式启用模型后的资源成本；默认页面不会加载它。门户构建21页、0errors/0warnings，7条既有hints。

实际tarball 45,703字节（解包151,027），SHA-256 `2af81f61beda65c1256df01eb89c2f85f2414f8ba471e432b836b35deb6b0b1f`；[包回执](evidence/package-check.json)记录sha512和白名单。系统临时消费目录无ORT，根与子入口双格式/NodeNext类型可消费；公开入口包不含模型、WASM、原图或React生产依赖。

[最终整体审查](evidence/final-review.md)无Critical/Important。随后`8126365`修复本轮加载标签、缓存估算陈旧写入和中文根入口说明，ORT体积提示保留。修复后11项控制器单测、Demo类型/构建、标准检查和4项真实CacheStorage竞态回归通过，并重新通过上方生产UI双后端。164项完整verify为修复前阶段记录，未冒称修复后重跑全套；根运行时和包产物没有变化。详见[修复回执](evidence/final-fix-report.md)、[范围复审](evidence/final-fix-review.md)及[竞态证据](evidence/final-fix-cache-ui.json)。

## 重现与限制

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
node tests/reid-distribution-browser.mjs
node tests/reid-demo-browser.mjs
node tests/reid-cache-ui-browser.mjs
node reports/2026-09-21-reid-distribution/verify_archive.mjs
node reports/2026-09-21-reid-distribution/verify_archive.mjs --current
```

真实来源脚本需要既有 `.tmp/reid-preprocessing-20260920/assets` 中的固定RGBA；Demo脚本自行生成人工PNG，不需要用户图片。模型源需网络，浏览器版本需匹配Playwright。维护者运行archive.mjs收集已完成证据，普通复核只运行verify_archive.mjs，不重新生成可信锁。`--current`另核对当前源码LF、dist与.tmp实际tarball，只适用匹配本轮构建。分发脚本默认仅prepare；已存在版本不可盲目重新publish。

人工图片和重复帧只证明接口，不能代表身份识别质量提升或视频FPS。完整真实同输入ByteTrack/OC-SORT/DeepSORT IDF1/IDSW/MOTA及完整成本仍待评测；视频/摄像头帧调度、手机、Safari/Firefox、Worker/NPU和门户Workflow不在本轮范围。

本轮采用三项范围判断：授权覆盖前次提出的模型双源与本地接入，SDK发布另留后续；官方仓库整体许可作为权重分发依据且保留披露缺口；未知可训练参数数目填null。判断若需调整，分别涉及模型版本撤回/发布安排、分发材料复核或参数统计修订，不扩大现有兼容性声明。
