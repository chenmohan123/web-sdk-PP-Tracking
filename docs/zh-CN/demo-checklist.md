# Demo 验收清单

[English](../en/demo-checklist.md)

基于门户 `standards/v1/templates/demo-checklist.md`（1.2.0算法适用项）。以 `npm run test:browser` 的运行报告核对，不能用DOM标记代替交互证据。

- [x] 当前独立 SDK，中文默认、英文切换保留状态，品牌栏显示版本及 GitHub/npm 项目链接。
- [x] 三策略与原创序列（DeepSORT外观向量为合成数据）、含UTF-8 5MiB规范化上限且完整校验后原子提交的本地JSON导入/切换、参数设置、播放暂停单步、重播、seek、可重导入的紧凑输入序列及实际结果报告导出。
- [x] 状态使用ready/running/success/error；错误显示稳定码；空预览显示检测框或空态，无破损图片。
- [x] SVG观测和虚线预测可区分；宽屏首屏结果可见，390px无横向溢出。
- [x] data-sdk-algorithm-info 显示算法来源、许可、输入输出与限制。
- [x] data-sdk-runtime-info / data-sdk-timing 显示实际CPU/main、版本、五项耗时及cold/warm语义。
- [x] data-sdk-state-reset 清空状态、轨迹路径与历史；seek复位顺序重算。
- [x] 参数、导入末帧或无向量切换错误保留当前配置、序列和结果；合法应用新建实例并清空结果。
- [x] 文件在本机内存处理；有隐私说明、可聚焦控件和键盘seek。
- 远程 GitHub/npm/Demo 链接与发布证据按[发布清单](release-checklist.md)核对。

模型资产/下载/缓存/精度选择项不适用；没有伪造模型控件。实际浏览器环境与限制见[兼容性](compatibility.md)，截图在 `.tmp/browser/`。
