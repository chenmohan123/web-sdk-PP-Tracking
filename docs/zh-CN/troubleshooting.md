# 排错

[English](../en/troubleshooting.md) · [首页](../../README.md)

| 错误/现象 | 处理 |
| --- | --- |
| INVALID_INPUT | 检查有限数值、xywh边界、分数/类别、数量、时间升序和尺寸一致；seek先reset |
| INVALID_OPTIONS | 低≤高≤新建，阈值[0,1]，命中/容量整数，largeGapMs≥maxLostMs；不要传未知字段或undefined |
| ABORTED | 计算前signal已取消；新建AbortController重试 |
| DISPOSED | 已释放实例不能重用，重新createTracker |
| NUMERICAL_FAILURE | 检查极端数值和时间间隔，当前状态未提交；必要时reset后使用合理尺度 |
| ID_EXHAUSTED | reset开始新代次；勿将ID当永久身份 |
| FILE_TOO_LARGE / INVALID_SEQUENCE | Demo文件≤5MiB；frames为1–3000帧，每帧≤100框；失败保留现有序列与结果 |
| 丢失后低分不能恢复 | lost仅接受高分；低分第二阶段仅适用于尚未失配的tracked |
| 交叉换ID | 无ReID，运动和IoU不能保证身份；查看算法限制 |
| 找不到包产物 | 先npm run build，再运行Demo、测试或本地打包 |

Demo参数应用失败时原运行不变；合法应用创建新实例、清空历史。播放结束后重新开始再播放。导出按钮仅在有已处理结果且暂停时可用。
浏览器缺失时执行首页的Playwright安装命令，或设置PLAYWRIGHT_BROWSERS_PATH到匹配版本缓存，不能跳过测试伪称通过。
