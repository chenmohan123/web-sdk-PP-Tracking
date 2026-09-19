# DeepSORT 外部向量本地验收

[English](README.en.md)

日期：2026-09-19。本地候选 `0.2.0-alpha.0`，核心提交 `28cb83a`，Demo/文档提交 `fc3adebb7630b0d53c9831cc96ee57b56bb6f143`。线上 npm、HTTPS Demo 和门户仍为 `0.1.0`；本轮没有 push、PR、发布、模型上传或部署。

同一包现在提供 ByteTrack（默认）、OC-SORT 和 DeepSORT 外部向量策略。DeepSORT 接收固定特征空间的检测向量，严格验证后复制归一化，通过有界最近邻图库、四维运动门控、新鲜轨迹优先级联和有限 IoU 后备关联。CPU/main，无生产依赖，没有内置 ReID 模型、视频或摄像头。

## 验证结果

| 验证 | 结果与证据 |
| --- | --- |
| 核心先失败后实现 | 首轮新增能力 14 项预期失败，最终核心聚焦19/19，首次完整回归95/95；独立核心审查通过 |
| Demo 输入先失败后实现 | [初次 RED](task-2-red-demo-test.txt)：3项失败/5项通过；最终12/12，覆盖完整导入校验、深复制和状态保留 |
| 完整 `npm run verify` | [原始日志](verify.txt)，退出0；9文件102项单元测试、类型检查、核心构建、包消费、Demo/Vanilla/React构建和11组浏览器交互全部通过 |
| 实际 npm tarball | [包报告](package-check.json)：三算法 ESM/CJS/TypeScript 消费，导出白名单与零生产依赖通过；22,395字节 |
| 浏览器交互 | [报告](browser-report.json)：Windows 11 / Intel i5-10400F / Playwright1.63.0 / Chromium153.0.8010.12，CPU/main，11组检查，pageErrors为空 |
| 4204独立预览 | [报告](preview/report.json)、[脚本](preview/smoke.mjs)：三个选项，DeepSORT交叉样例3帧后两条确认轨迹，中英文390px无横向溢出 |
| 本地标准 | 门户 `tracking-deepsort-before-20260919.json` / `tracking-deepsort-after-20260919.json` 各17项required通过、0失败；只代表 locally-compliant |

完整验证的[首次失败](verify-attempt-1-failed.txt)是测试从不支持 JSX 的根配置导入 React 页面导致 TS6142；已将纯参数转换逻辑移到数据模块，最终完整运行通过。日志中“npm OIDC 发布完成”是既有 release.test.ts 的模拟场景输出，并非真实发布。

`sdk-check-before.txt` 是 Task 2 开始前检查，已经包含核心 `28cb83a`；它不等同门户保存的整个阶段修改前 `1982e87` 基线。完整阶段修改后检查由协调者单独执行。

## 固定构建与截图

- tarball SHA256：`58eaf180579d0bdfae0351513978b7a6dff189aa22a921c1c945082977a5f739`。
- `dist/index.js` SHA256：`8396ef79f22c6afd2690bd6413f2b32b25fd46ec67b9fabca8fcab44c9a82041`。
- `dist/index.cjs` SHA256：`f9bd94a1a63e97d424891436b974aafc1dff312c6ca8c183eb7ff74953af186b`。
- [桌面截图](preview/desktop.png)、[390px中文](preview/narrow.png)、[390px英文](preview/narrow-en.png)。菜单使用简短 DeepSORT；合成外观向量标识保留在样例信息中，避免桌面窄侧栏截字。

`browser-report.json` 保留原始临时截图路径；上述三张独立预览截图已归档。预览脚本从SDK根目录运行 `node reports/2026-09-19-deepsort/preview/smoke.mjs`，需要先启动4204本地预览，输出到忽略的 `.tmp/deepsort-preview`，不覆盖本归档。

## 范围与后续

这批证据仅证明外部向量契约、关联机制、发行包与桌面交互；合成向量不来自图片，不代表真实行人质量或 DeepSORT 优于现有算法。390px是桌面视口，不是手机实测。历史MOT17两算法数据、OMZ探针失败证据均保持原样。

下一阶段核验Paddle PPLCNet ReID具体checkpoint、权重依据、预处理和Python/浏览器数值，并使用真实图像及身份真值做同输入评测。同包提供模型加载前先扩展算法/模型混合标准。BoT-SORT、JDE、FairMOT、CenterTrack仍未接入。
