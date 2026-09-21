# SDD ledger — plan: docs/superpowers/plans/2026-09-21-tracking-mot-reid.md

## 预检

| 对象 | 生产/消费接口 | 核查 |
| --- | --- | --- |
| 任务1内部 | 锁定真实输入→提取→完整帧→三算法→官方评分 | 行序、空帧、分块、失败原子性均有行为测试，生产算法不变 |
| 正式执行内部 | 已审查工具→7段全帧证据 | 小预检只验证运行，不按评分缩减范围 |
| 任务2内部 | 真实证据→报告/锁/发布判断 | 不虚构提升，不变线上状态 |
| 任务1/正式执行 | data目录、media.lock.json及CLI | 媒体取得与工具实现独立；正式运行等工具审查 |
| 任务1/任务2 | 工具身份、机器summary和计时边界 | 报告消费实际输出，不修改工具追分 |
| 正式执行/任务2 | 完成的7段结果与验证 | 数据完整后才下结论 |

基线：SDK e42cdd6；门户784970d。任务1待实施；正式数据准备中。

媒体准备完成：5316张/67639检测，SHA逐项二次核验；42张旧样本一致。媒体协议与清单提交 b9a6143、b87a69f；当前media.lock SHA 906491d5d02912f38cea5014b2b687fd8b5ae4a3ec55499439ad7c049b328cb5，LF固定。计划/标准before提交b530acb。任务1代理mot_reid_harness实施中（审查base b87a69f，避免重复审查媒体37k行清单）。

Task 1: complete (commits b87a69f..0194ea5, review clean)

Task 1: minor (deferred): compare.mjs补充对照未将浏览器输出再比对运行摘要pin；正式七段merge有此检查。最终归档需核验这两个30帧目录原始哈希，整体审查复核。

Task 1: minor (deferred): Python中文诊断控制台编码未固定；正式运行由主线程设置PYTHONUTF8/PYTHONIOENCODING，JSON仍UTF-8。整体审查核对。

任务1已有9项专项、173项全部测试、typecheck/build/check:package；固定02前30帧GPU/WASM共433检测对齐，最大绝对差3.5762786865234375e-7。正式运行从0194ea5启动。

正式执行完成：七段5316帧/67639检测，S/.tmp/mot17-reid-official-{02,04,05,09,10,11,13}-0194ea5；全部浏览器与两次Node一致，容量丢弃0。merge到S/.tmp/mot17-reid-combined-0194ea5并官方评分exit0。ByteTrack IDF1=.4829221956/IDSW1101/MOTA=.4440100804；OC=.484107408/881/.3954335379；Deep=.4546372506/1030/.4476076832。完整关联+本地图像/ReID共613470.900ms；不能称视频端到端。未调参。

Task1 minor的补充核验完成：S/.tmp/mot17-reid-media/subset-output-validation.json记录30帧双后端48处摘要/原始输出hash一致。正式子进程设置PYTHONUTF8/PYTHONIOENCODING，评分UTF-8输出正常。

独立连续性复核：14份ByteTrack/OC-SORT MOT与历史逐字节一致，逐段及combined官方指标均相同；S/.tmp/mot17-reid-media/historical-validation.json。原用户F门户仅原有两个未跟踪路径。门户 pnpm（两配置参数）run build exit0：Astro0 errors/0 warnings/7 hints、21页面；旧reports两脚本4提示、Zod弃用3提示留存，本轮无门户产品代码更改。任务2由mot_reid_archive实施，基线S0194ea5/Pb530acb。

Task 2: complete (SDK commits 0194ea5..f02c9ca; portal b530acb..53d9a1b; review clean)

任务2审查独立核对126正式输出、49计时源及压缩逐帧计时、48子集hash、14历史MOT与指标均一致，无新增P3。主线程提交后verify --current通过32份归档。after checker 21 required pass/0fail/4 remote skip。整体审查待完成；两个task1 P3按已记录本轮补偿证据保留，不改已固定工具身份。

最终审查Ready Yes，无Critical/Important；保留原两P3，新增媒体准备脚本重跑把本次transferred统计写进工作锁导致与归档pin不同的P3。当前5316图/原始hash/成绩不受影响。唯一收尾修复交原归档代理：仅补中英文README/protocol固定清单恢复步骤及历史统计含义，更新说明的evidence.lock，保留旧脚本和正式运行身份。后续由原整体审查员限定复审，不重跑GPU或全套测试。

最终修复 c3542d4 仅改四份双语说明及锁；模拟统计0→恢复固定锁hash相同，正式工作锁不变；32项归档/current/git字节与30文档链接通过。限定复审final-fix-review.md判定Addressed/Accepted，Ready Yes，无新增问题；工具本身统计与身份混写保留为非阻塞未来改进。

最终SDK checker再读通过locally-compliant，0 required failed/4 remote skipped；不新建远程核验声明。本轮任务1、任务2与最终审查完成，按原本地范围保留分支/工作树和.tmp原始运行数据。审查回执与此ledger复制入SDK reports/2026-09-21-mot-reid/closure，由Git保留；旧scratch不触碰。
