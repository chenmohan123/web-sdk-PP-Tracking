# ReID 分发与公开入口阶段最终独立审查

日期：2026-09-21。规格与质量结论：通过。**Ready to merge：Yes；Critical 0、Important 0、Minor 4（均非本阶段交付阻塞）。** 此判断只覆盖当前本地候选成果；不等于授权 GitHub/npm/线上 Demo 发布，也不证明真实 MOT 指标提升。

## 范围与依据

- SDK：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`，`a065020..3517d2c`。
- 门户：`C:/Users/chenm/.codex/worktrees/segmentation-portal/chenmohan123.github.io`，`7b65629..f5898e9`。
- 已读本阶段实施计划、ReID 模块设计、progress、Task 2/3 实施报告及 Task 1–2/Task 3 审查；按 requesting-code-review/code-reviewer.md 做独立整体审查。
- 已读标准入口、SDK/Demo/性能/发布/门户契约及相关规则、hybrid schema。分层为单 SDK，门户只同步路线和回执，不复制运行时。
- 审查重点为本轮源码、构建与包检查、模型材料、双语文档、清单、真实浏览器验收脚本和归档协议。机器向量按独立验证器复算、日志与 JSON 按相关字段检查，不以重复大段机器数据代替审查。

下列文件行号除明确标注外均相对于 SDK 根目录。

## 优点及一致性

1. `package.json:16`、`src/reid/sources.ts:6`、`src/reid/model.ts:18`、`scripts/build.mjs:7`：独立 ESM/CJS/types 子入口、默认 MS、显式 HF、冻结来源快照、source/modelBytes 互斥及 optional ORT peer 相互一致。根运行时未在本轮变更，模型数值、预处理和特征空间算法没有扩大改动。
2. `scripts/check-package.mjs:23`：实际 tarball 在系统临时目录消费，并显式断言无法解析 ORT，证明根消费者以及只导入/构造/释放 ReID 的消费者不必安装引擎。两个入口的 NodeNext ESM/CJS 类型消费不是源码别名测试。
3. `demo/src/reid-controller.ts:25`、`:55`、`:83`：成功后才同步推进跟踪和帧号，取消/切源/切后端/清理等待活动任务，图像竞态按序号丢弃并释放。Demo 仍消费人工提供的检测框，不暗中接入检测器或跨 SDK 编排。
4. `sdk-manifest.yaml:32`、`:78`：模型身份、不可变来源、parameterCount=null、cache-storage、两个模块入口/后端/耗时并集及日期环境符合 hybrid 契约。双源权重身份与源码注册、分发回执及实际浏览器结果相同。
5. `models/pplcnet-reid/0.1.0/README.md:29`、英文镜像与 NOTICE：明确整体 Apache-2.0 采用依据、官方链接 checkpoint、转换修改、训练披露缺口；未虚构专属授权，也未把 BN 状态元素当作可训练参数。上传脚本有精确白名单及已有版本保护。
6. 根 README、双语接口/兼容性/发布指南和门户当前回执均明确：模型已经真实双源分发，SDK 为本地 0.2.0-alpha.0，npm/线上 Demo 仍为 0.1.0。历史 34 fixture 数值证据、本轮四组来源证据、人工 Demo 图和真实 MOT 评测范围没有互相冒充。七算法路线继续分阶段，只有三算法与可选 ReID 被列为本地实现。

## 问题与延期裁定

### Critical

无。

### Important

无。

### Minor

1. **加载耗时标签未区分首载与本轮幂等检查。** `demo/src/reid-controller.ts:35`、`demo/src/ReIdWorkspace.tsx:119`。每帧调用 load 并覆盖 loadResult，后续帧下载/会话显示 0，标题仍为“加载”。这些零值是本轮实际未执行阶段，不是虚构冷启动性能；UI 已解释 cold/warm，生产证据也保存此行为。**裁定：不要求交付前修复，接受延期。** 后续把标题明确为“本轮加载检查／复用会话”，或分别保存首次加载与当前调用即可；不能把热调用 0 当作冷启动指标。

2. **缓存估算旧响应可能覆盖新用量。** `demo/src/ReIdWorkspace.tsx:56`、`:90`。usage 仅检查 mounted；挂起估算与 configure/reset 触发的新估算可交叠，旧请求最后结束时会写回旧 bytes 或提前清除忙碌标记。最坏影响是清理后的缓存显示短时陈旧；清理实现仍限定本 SDK 命名空间，模型释放、轨迹复位及结果提交不受影响。**裁定：保留为真实 UI 竞态，但不要求本阶段交付前修复。** 建议后续加入独立估算序号，仅最新请求写状态，清理时使旧请求失效；验证应人为控制两个估算的完成顺序。不能把其误描述为缓存删除失败。

3. **ORT 惰性分块超过默认体积提示阈值。** `demo/src/App.tsx:5`、`reports/2026-09-21-reid-distribution/evidence/sdk-verify.log:102`、`:104`。847.14 kB（gzip 204.48 kB）的 ORT chunk 触发 Vite 500 kB 提示。它已经与默认路径隔离，真实默认/仅切模式均无引擎或权重请求，双语阶段报告明确披露。**裁定：接受当前可选模型资源成本，不要求交付前拆分，不属于构建失败。** 后续若有首载性能目标，再测量和评估引擎裁剪；不为消除日志而直接提高阈值。

4. **中文算法导言缺少根入口限定。** `docs/zh-CN/algorithm.md:7`，对应英文 `docs/en/algorithm.md:9`。中文仍写“无内置特征提取模型”，英文已明确为 root entry；脱离后文可能被理解为整个 SDK 没有 ReID，双语范围略有歧义。该页 DeepSORT 段、首页与 ReID 指南已有准确说明，因此不阻塞 API 使用。**裁定：非阻塞文档修订，建议将中文改为“根入口不加载特征提取模型，无运动补偿”并保留可选模块说明。** 不要求修改已固定的历史证据。

## 验证与证据可信边界

- 本审查亲自执行 `node reports/2026-09-21-reid-distribution/verify_archive.mjs --current`，退出 0：27 份固定证据、4 组向量、2 来源、2 个生产 Demo 后端及当前源码/dist/tarball 身份通过。验证器不重建锁、不联网、不运行模型。
- 本审查亲自执行 SDK `git diff --check a065020..3517d2c`，退出 0；两工作树 status 均为空。未修改 SDK/门户 checkout、index、HEAD 或分支。
- 已读取完整 verify 的关键结果：13 文件、164 单测通过，12 组原浏览器检查及构建/包消费通过；ORT 体积提示按上述 Minor 保留。未把任务早期 44,606 字节包回执当作当前包；最终归档为 45,703 字节，SHA 为 `2af81f61beda65c1256df01eb89c2f85f2414f8ba471e432b836b35deb6b0b1f`。
- 浏览器验收脚本实际通过正式 dist 和 Vite 生产构建；四来源/后端页面独立冷缓存，固定下载 URL、actualBackend、非 fallback GPU、向量范数及误差均有断言。Demo 两组真实加载覆盖连续帧、语言、非法输入、取消、复位、清理和其他缓存保留，errors=[]。
- 标准 after 为 21 required pass、0 fail、4 remote skip；门户构建为 21 页、0 errors、0 warnings、7 既有 hints。结论为本地合规，不借历史远程勾选推导当前 alpha 已发布。
- 未重跑完整测试、未重新下载模型、未执行任何远程写操作、未读取上游 tracking/matching/Kalman 实现、未派生子代理。仅写本审查报告。

## 最终判断

**Ready：Yes。** 公开入口、模型分发、hybrid 清单、Demo 和最终证据已形成一致的本地候选交付；未发现需先修复的功能、数据或架构问题。三个既有 deferred Minor 已逐项裁定，新增中文限定语问题也是非阻塞修订，不应据此无限扩展本阶段范围。真实 MOT 同输入指标与成本、视频调度、其他设备，以及 SDK/线上发布仍属后续明确阶段。
