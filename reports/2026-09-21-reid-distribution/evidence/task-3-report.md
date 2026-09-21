# Task 3 实施报告

日期：2026-09-21。范围为 Tracking 单 SDK Demo 与 hybrid manifest；未修改根 runtime、models、父任务文档或浏览器矩阵脚本。采用测试先行和完成前验证流程。

本地提交：`49c9944`（新增可选图像ReID工作台与混合模块清单），仅包含下述6个范围内文件；未进行远程 GitHub 修改。

## 实现

- 默认框/向量工作台保留，输入模式选择“图像 + 检测框”后才 lazy import 模型工作台；仅实际提取时进入 ORT/权重加载。
- 图像限 20 MiB、每边 8192、总像素 16,777,216。浏览器按图像方向解码，sRGB Canvas 获取 RGBA；位图在读取后关闭，对象 URL 在换图、取消迟到结果、卸载时释放。浏览器透明图片解码不承诺源文件逐字节一致。
- 控制器每成功帧推进 100 ms；失败、取消不推进时间/轨迹。重复运行 BUSY；同尺寸换图保留轨迹，尺寸变化 IMAGE_SIZE_CHANGED 要求显式复位。来源/后端切换先取消、等待活动提取、释放、复位；完整清理在释放后调用本 SDK cache API。
- 双语来源、模型 CPU(WASM)/GPU(WebGPU)、CPU 关联、状态、进度、错误码、分层计时、缓存用量、复位和清理控件；真实图像与轨迹相邻，无空输入破图。语言仅替换文案。
- manifest 更新 1.3.0/hybrid；根 cpu/main 与可选 ./reid wasm/webgpu/main 分别声明，顶层取并集。实际 MS/HF 固定 revision、bytes/SHA 与注册一致；parameterCount=null，cache-storage。日期环境来自父任务已通过的 `.tmp/reid-distribution/browser/report.json`，不宣称线上 SDK/Demo 已发布。
- Vite 现有配置可以打包 ORT 默认 bundle：生产产物独立输出 ReIdWorkspace、ORT JS chunk 和 `ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm`；ORT bundle 内嵌对应 mjs glue。未增加多余资源复制配置。

## 红绿与检查

全部 pnpm 命令带 `--config.verify-deps-before-run=false --config.manage-package-manager-versions=false`。

1. `pnpm ... test tests/reid-demo.test.ts`：初始缺失模块失败；添加无行为接口后 7/7 行为断言失败，分别覆盖推进、BUSY、切换、清理、尺寸与资源释放。实现后 7/7 通过。
2. 补充活动提取等待、dispose、迟到解码释放验证；自审发现工厂失败可能锁死，新增红测得到 `expected true to be false`，修复后最终 **11/11 通过**。
3. `pnpm ... typecheck`：通过；`pnpm ... typecheck:demo`：通过。
4. `pnpm ... build:demo`：通过，38 modules；约847 kB ORT独立chunk触发Vite 500kB提示，默认页面并不加载该chunk。
5. P 下 `pnpm ... sdk:check -- --repo S --format table`：before 0 required failed / 8 skip；after 0 required failed / 4远程skip，locally-compliant。
6. `node .tmp/reid-ui-smoke.mjs`：生产 preview 4297，Chromium 153.0.8010.12，390×844桌面视口；默认无ORT/模型请求、只启用模式仍无ORT/模型请求、空预览、PNG预览、非法JSON不加载、取消不推进、清理复位、中英文无横向溢出通过，无pageerror。结果在 S/.tmp/reid-ui-smoke-report.json；服务已关闭。
7. `git diff --check`：通过。未重跑完整真实双源矩阵；父任务正在运行真实生产 Demo 模型与交互验收。

## 修改文件与交接

S：`demo/src/App.tsx`、`demo/src/ReIdWorkspace.tsx`、`demo/src/reid-controller.ts`、`demo/src/style.css`、`tests/reid-demo.test.ts`、`sdk-manifest.yaml`。

UI 选择器：`#input-mode`（image），`[data-testid=reid-image]`，`#reid-boxes`，`#reid-source`（modelscope/huggingface），`#reid-backend`（wasm/webgpu），`[data-testid=reid-run/reid-cancel/reid-reset/reid-clear/reid-frame]`。生产构建最后入口 `index-dBaPz_Eq.js` 与 `ReIdWorkspace-BZPRZhf7.js`。

自审：未引入门户编排、检测器、视频按钮或手机兼容声明；未改父任务共享文件；root runtime 与包入口不变；生产真实模型加载结论以父任务最终浏览器证据为准。
