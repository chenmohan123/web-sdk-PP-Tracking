# Task 1 实施与验证回执

日期：2026-09-21；SDK：`C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking`（下称S）。任务基线`1e4d777`，本地提交`99874c7`，提交信息“整理 Tracking 0.2 发布候选与预发布通道”，36文件、208新增/58删除。未执行push、PR、tag、Release、npm发布或部署；单测的npm成功输出来自注入的测试执行器，并非真实发布。

## 完成范围

- package、4处生产runtime版本声明、Demo品牌/导出/运行信息、manifest当前声明和双语当前文档同步0.2.0-rc.0；保持现有常量结构，没有版本系统重构。
- `src/`共17文件逐一与基线比较，只有`src/reid/ort.ts`、`src/reid/types.ts`、`src/tracker.ts`、`src/types.ts`的alpha→RC标识变化，数学与接口语义不变。证据：`S/.tmp/tracking-02-rc/source-identity-check.txt`。
- `reports/`历史已跟踪文件、`models/`和`scripts/evaluation/`均未修改；模型仍0.1.0、原revision/bytes/SHA和预处理。manifest原alpha历史验证行原样保留，新增加3条2026-09-21 RC算法/MS-WASM/HF-WebGPU环境。
- `scripts/release.mjs`在版本存在预发布标识时明确`--tag next`，正式版明确`--tag latest`；忽略build metadata中的横线。已有版本完整性相同仅view，不publish、不dist-tag；原精确Git标签、完整性拒绝、结构化缺失、重试和失败门禁保留。
- CHANGELOG新增双语RC条目，双语README/当前指南同步，新增`docs/{zh-CN,en}/releases/0.2.0-rc.0.md`，覆盖0.1迁移、实验边界、双源模型/许可、optional peer、分层后端/耗时、历史alpha评测与RC身份区别、未来next通道及以新版本撤回策略。旧CHANGELOG中的待MOT说明保留为历史，并追加明确时序说明。
- 图像工作台新增短标签“人体 ReID · 实验”/“Person ReID · Experimental”，保留布局样式。OC-SORT既有“未声明真实MOT”文案修正为固定训练序列已有证据，不声明测试集精度。
- `tests/reid-demo-browser.mjs`新增可选`TRACKING_REID_DEMO_OUT`，默认仍`.tmp/reid-distribution/demo`；本次指定新目录，从未覆盖旧ReID证据。另外增加英文桌面、GPU桌面截图。既有`.tmp/browser`此前已由主线程归档，本轮成功后再复制到RC目录。

## RED / GREEN 与故障说明

从SDK根运行：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false test -- tests/release.test.ts
```

RED先于发布脚本修改：退出1，8测试中3失败/5通过。失败分别对应0.2.0-alpha.0、0.2.0-rc.0、0.2.0三个版本的实际publish参数缺`--tag`，并非测试加载/语法错误。完整输出：`S/.tmp/tracking-02-rc/release-red.txt`。

最小脚本修改后同命令GREEN：退出0，8/8通过。明确检查publish完整参数和已有版本只发生view，标签精确匹配检查通过。完整输出：`S/.tmp/tracking-02-rc/release-green.txt`。

完整verify首次退出1：176测试中175通过，`tests/mot17-adapter.test.ts`的“真实SDK顺序更新”测试硬编码alpha期望，当前RC runtime被执行器正确拒绝。保留原输出`S/.tmp/tracking-02-rc/verify-first-version-test-failure.txt`。采用系统化调试确认期望来源后，只将该当前源码单测的期望改为读取当前package name/version；保留另一个错误版本必须拒绝的用例，未修改任何固定评测CLI或历史报告。

## 完整验证

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false verify
```

修正上述单测后完整成功运行一次，退出0；原始完整输出`S/.tmp/tracking-02-rc/verify.txt`。结果：

- SDK build和typecheck通过，14测试文件/176测试全部通过。
- 实际npm pack及三算法/ReID ESM/CJS、NodeNext两格式类型消费通过。
- 独立系统临时消费项目无ORT，根入口算法、ReID导入/工厂/dispose通过；ORT1.27.0保持optional peer；无生产依赖。
- 发行白名单与排除模型/引擎/原图/凭据检查通过。
- Demo typecheck/build、Vanilla build、React build通过。
- Chromium153.0.8010.12、Windows11，12组实际浏览器检查通过，pageErrors为空。包括三算法切换与播放、导入/导出、512维千帧输入往返、无效输入原子性、复位/seek、参数、双语和390px、Vanilla真实包消费。
- Demo与React构建仍有已有ORT bundle大于500kB提示；ORT动态资源约847kB，WASM约26.8MB，不阻塞构建，不据此声明首次模型启动轻量。

算法浏览器原始报告与6张截图已复制：`S/.tmp/tracking-02-rc/browser/`。报告测试时间`2026-09-21T05:48:01.801Z`，runtimeVersion为RC。

## 真实模型生产UI

```powershell
$env:TRACKING_REID_DEMO_OUT='.tmp/tracking-02-rc/reid-demo'
node tests/reid-demo-browser.mjs
```

退出0。日志：`S/.tmp/tracking-02-rc/reid-demo.txt`；报告：`S/.tmp/tracking-02-rc/reid-demo/report.json`，测试时间`2026-09-21T05:48:47.471Z`，Chromium153.0.8010.12，errors为空。通过5组：

- 默认框/向量工作台无ORT/模型请求。
- ModelScope固定revision真实下载/WASM会话、两帧确认ID1；同尺寸换图第三帧保持ID、语言切换不复位、坏JSON不推进。
- 390px中英文无横向溢出。
- 下载挂起期间取消、禁重复开始、失败任务不推进。
- Hugging Face固定revision真实下载/WebGPU会话、两帧确认ID1；换源/后端复位，复位后可运行，模型清理保留其他缓存。

模型actualBackend分别为wasm/webgpu；关联actualBackend始终cpu/main。系统只读硬件核对为NVIDIA GeForce RTX5060Ti，驱动32.0.16.1692。此次UI使用人工生成128×192不透明图片和人工框，只证明接口与真实会话，不是人体质量评测。历史七段5316帧不重跑。

已实际打开并目视核对以下四张图，RC品牌、实验标签、图像和轨迹均可见，文字无遮挡；fullPage超出视口高度属于正常页面滚动：

- `S/.tmp/tracking-02-rc/reid-demo/desktop.png`：1440×1886，中文WASM。
- `S/.tmp/tracking-02-rc/reid-demo/desktop-en.png`：1440×1995，英文WASM。
- `S/.tmp/tracking-02-rc/reid-demo/mobile-zh-CN.png`：390×2684，中文WASM。
- `S/.tmp/tracking-02-rc/reid-demo/mobile-en.png`：390×2775，英文WASM。
- 另存`desktop-webgpu.png`：中文GPU成功态。390px为桌面视口，非真机证据。

## 标准检查

修改前checker已由主线程成功运行；本子任务沿用其回执。最后增加日期化manifest行后，从门户工作树运行：

```powershell
pnpm --config.verify-deps-before-run=false --config.manage-package-manager-versions=false sdk:check -- --repo C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking --format json --out C:/Users/chenm/.codex/worktrees/tracking-algorithms/web-sdk-PP-Tracking/.tmp/tracking-02-rc/standard-after.json
```

退出0。输出`standard-after.txt`、结构化`standard-after.json`：requiredPassed21、requiredFailed0、requiredSkipped4、recommendedPassed3、labs1，状态locally-compliant。远程规则skip不是远程交付通过声明。

## 当前实际tarball

固定副本：`S/.tmp/tracking-02-rc/web-sdk-pp-tracking-0.2.0-rc.0.tgz`；实际消费回执：同目录`package-check.json`。verify后重新读取副本校验SHA256/sha512均一致。

```text
filename: web-sdk-pp-tracking-0.2.0-rc.0.tgz
size: 46313 bytes
unpackedSize: 152360 bytes
sha256: fa082976517c4d767a36d59388661a82d3759507e334a71093e7addb1ea54076
integrity: sha512-EbNwWqVGLQi5aB73T7fElvyoV+C3psEnC1t2ZCGl/d8x4trwdqJHfBV0p5TnJKDUu4F9Cu0Nlh1SBOFVT/C9EA==
```

打包完成后仅增加不进tarball的兼容性文档与manifest日期证据；包内README、package、dist没有再修改。未将旧alpha包摘要改称RC。

## 提交边界与后续

提交前`git diff --check`及暂存差异检查通过，git add显式列出本任务36个文件。主线程同时新增的`reports/2026-09-21-02-rc/`及`.tmp/tracking-02-rc/capture.mjs`不包含在本提交；原有scratch与证据未清理。主线程继续正式归档、独立审查及门户回执；本子任务无远程写入、无子代理。现有4204服务由主线程保留，本测试专用4197/4198/4206临时服务均已随成功进程退出。

注意：任何后续对包内README/package/dist的修改都需重新打包并更新摘要；当前版本尚未发布。RC的接口smoke不替代历史全序列精度测量，历史alpha身份锁不应用当前RC构建强行校验。
