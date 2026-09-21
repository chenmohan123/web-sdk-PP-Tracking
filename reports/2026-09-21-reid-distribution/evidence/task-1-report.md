# Task1 双源分发回执

实现aab7920（依赖Task2提交1f67da9，本次diff从a065020）。官方固定材料核验、双语模型卡及采用整体Apache依据、保留LICENSE/NOTICE，准备上传白名单11文件后执行了本次用户已确认的模型分发。凭据仅复用宿主缓存，未输出或改变登录状态，无GitHub/npm/线上Demo修改。

S/models/pplcnet-reid/0.1.0/{model.json,sources.json}为身份单一来源。源格式为2条ReIdSource数组；均33704835字节及固定SHA。
MS revision dc3d9f7a97be4033e654525f0e9d3fbd5eaf7c9b；HF02c299b5b5618315fc754002b7ea7c95c95e8a82。源URL在sources.json，仓库均chenmohan/web-sdk-pp-tracking。

scripts/distribute-reid.py默认仅prepare，--publish才远程。准备输出11文件，实际上传11；脚本遇已有仓库/文件主动拒绝盲目覆盖，不保证跨平台事务。上传后匿名requests固定revision回读各自模型全体字节，身份一致；reports/2026-09-21-reid-distribution/{distribution.json,upload-inventory.json,upstream-evidence.json}留证据。requirements固定此次Python库版本。

真实浏览器4组合MS/HF×WASM/WebGPU已运行通过（待主线程归档.tmp/reid-distribution/browser/report.json），每组合独立清缓存、实际模型load/session、单个真实RGBA裁剪对Paddle归一化参考；maxAbs CPU2.459e-7/GPU2.536e-7，进度cache stored，默认MS显式HF，实际来源revision一致。仅代表本机Chromium153，本次无需再次完整34fixture；模块数值路径没改。

未读上游tracking/Kalman/matching源码。模型卡把8419792称含BN状态元素，parameterCount=null；未伪称专属checkpoint许可或完整训练数据已核实。models无权重/媒体，模型只在.tmp与两个hub。
