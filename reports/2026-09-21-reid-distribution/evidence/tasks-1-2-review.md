# Task 1–2 组合审查

审查日期：2026-09-21。审查对象：Tracking SDK `a065020..aab7920`，包括 Task 2 `1f67da9` 与 Task 1 `aab7920`，共 22 个文件。已阅读两个任务的 brief、report、合并差异、实施计划全局约束，以及标准 v1 的 SDK、发布与治理契约。

审查分层为单 SDK 的模型分发与可选公开子入口；本报告不评价尚未进入 Task 3 的 manifest/Demo，也不将主线程正在更新的根文档与未归档浏览器报告视作本分任务缺陷。

## 结论

- 规格审查：通过。Task 1 和 Task 2 的共享模型身份、双源注册、默认 ModelScope、显式 Hugging Face、自定义来源兼容与独立包入口符合任务约定。
- 质量审查：通过。没有发现本轮差异引入的可定位功能回归、包隔离缺陷或与实际分发证据相矛盾的声明。
- Critical：0。
- Important：0。
- Minor：0。

没有需要提供修复行号的缺陷。以下行号为已核对实现与证据的位置，均相对于 SDK 仓库。

## 规格与实现核对

| 核对项 | 位置 | 结果 |
| --- | --- | --- |
| 固定资产与参数口径 | `models/pplcnet-reid/0.1.0/model.json:8`、`:10`、`:11` | 固定 33,704,835 字节与指定 SHA；`parameterCount=null`，8,419,792 明确为含 BN 状态元素。FP32/opset17、输入输出及预处理身份与既有候选一致。 |
| 许可与训练披露范围 | `models/pplcnet-reid/0.1.0/README.md:29`、`:32`、`:33`，英文对应模型卡及 NOTICE | 明示采用官方仓库整体 Apache-2.0 作为官方链接 checkpoint 转换分发依据；保留许可、来源和修改署名，明确无独立 checkpoint 授权声明及训练披露缺口。未凭训练头推断额外数据集。 |
| 真实双源 | `models/pplcnet-reid/0.1.0/sources.json:5`、`:14`，`reports/2026-09-21-reid-distribution/distribution.json:2` | MS 固定 `dc3d9f7a97be4033e654525f0e9d3fbd5eaf7c9b`；HF 固定 `02c299b5b5618315fc754002b7ea7c95c95e8a82`。两源模型大小及 SHA 一致，回执包含日期和匿名下载结果。 |
| 上传边界 | `scripts/distribute-reid.py:24`、`:33`、`:41`、`:79` | 准备阶段验证资产；上传精确限定 11 文件；默认不上传，仅 `--publish` 写远程；来源注册在固定 revision 全体字节回读成功后写入。本轮分发在用户明确授权范围内，不包含 GitHub/npm/Demo 发布。 |
| 默认选择及防修改快照 | `src/reid/sources.ts:6`，`src/reid/model.ts:24` | 来源直接来自已提交 JSON；默认 MS，显式 HF，未知来源拒绝；查询每次返回独立冻结对象，工厂再次复制来源。 |
| 兼容及互斥 | `src/reid/types.ts:10`，`src/reid/model.ts:18`、`:25` | 保留显式 `ReIdSource` 与本地 `modelBytes`；字节与来源同时指定时拒绝。原有固定资产完整性、HTTPS 地址限制保留；显式失败不静默换源。 |
| 独立包入口与引擎依赖 | `package.json:16`、`:62`，`scripts/build.mjs:7`、`:9`、`:13` | 根与 `./reid` 各有 ESM/CJS/types；仅子入口 external ORT。根入口没有新增运行时导出。ORT 1.27.0 为 optional peer 与开发依赖，动态 import 仍位于 load 的会话阶段。 |
| 实际消费隔离 | `scripts/check-package.mjs:18`、`:23`、`:52`、`:72` | 从实际 tarball 解包到系统临时目录，明确检查 ORT 不可解析；两个格式的导入、工厂、释放和 NodeNext 类型消费均有成功记录。公共声明入口不引用 ORT 类型，内部 `ort.d.ts` 不在公共声明可达路径上。 |

## 验证证据

已检查 `.tmp/task-2/unit-green.log`：3 个文件、49 项测试通过，包括 8 项来源行为测试、37 项生命周期与 4 项预处理测试；已检查 typecheck、build、独立 candidate build 和实际包消费日志。`.tmp/package-check.json` 记录包大小 44,606 字节、解包 148,693 字节；文件清单不含权重、引擎二进制、原图或凭据文件。

已检查 `.tmp/reid-distribution/browser/report.json` 及产生该报告的浏览器脚本。2026-09-21 Chromium 153.0.8010.12 的 MS/HF × WASM/WebGPU 四组均为独立页面、冷缓存、实际请求固定来源一次，完成下载、完整性与会话进度；缓存结果均为 stored。默认 MS 通过省略 source 测试，HF 通过显式 source 测试。四组 `rootImportNetworkClean`、`anonymousCorsDownload` 均为 true，errors 为空；WebGPU adapter 为 NVIDIA Blackwell 且非 fallback。相对固定 Paddle 归一化参考，WASM 最大绝对误差 2.4586915969848633e-7，WebGPU 为 2.53552570939064e-7，输出均为 512 维单位向量。

审查期间仅补充只读一致性核对：模型目录的 README 中英文、LICENSE、NOTICE、model.json 的当前原始字节大小与 SHA 全部匹配上传清单；根 dist 无 ORT 引用，子入口两个格式仅保留动态 import；`git diff --check a065020..aab7920` 通过。没有重跑完整测试或下载矩阵，没有改 SDK 源码、index 或 HEAD，没有远程写操作。

这些结论覆盖本轮本地 `0.2.0-alpha.0` 公开入口候选和已完成的双源模型分发；浏览器结果只代表上述日期与环境。后续 Task 3–4 的 Demo、hybrid 清单、完整 verify、最终文档与证据归档仍按主计划验证，不构成本次审查对稳定发布、线上 Demo 或其他设备兼容性的承诺。
