# 独立跟踪算法与数值定义

本实现参考 [ByteTrack 论文](https://arxiv.org/abs/2110.06864) 的高低分两阶段关联思想。
运动模型、分配器、状态机均按本文公式独立编写，未读取或翻译旧 Kalman/SORT 代码。
不是官方移植；无模型、ReID、运动补偿，不承诺交叉掉头的身份正确性或 MOT 精度。

## 数学定义

状态 `x=[cx,cy,w,h,vx,vy,vw,vh]^T`，位置和尺寸单位为像素，速度为像素/秒。
初值为观测框中心和尺寸、零速度；`P0=diag(100,100,100,100,10000,10000,10000,10000)`。
`dt=(当前 timestampMs-上一成功 timestampMs)/1000`，首帧为0。

令 I 为4阶单位矩阵：`F=[[I,dt*I],[0,I]]`，`H=[I,0]`。
每轴独立恒定加速度方差为25；`G=[dt²/2*I;dt*I]`，`Q=25*G*G^T`；观测噪声 `R=4*I`。
噪声为本项目固定选择，与框尺寸无关，不承诺复现其他实现。

- 预测：`x'=F*x`，`P'=F*P*F^T+Q`。
- 更新：`S=H*P'*H^T+R`，`K=P'*H^T*S^-1`，`x=x'+K*(z-H*x')`。
- Joseph 协方差：`A=I8-K*H`，`P=A*P'*A^T+K*R*K^T`。

4阶求逆使用带主元交换的消元；协方差按 `(P+P^T)/2` 对称化。
宽高在预测和更新后投影至至少 `1e-6` 像素；这是几何约束，不声称投影后仍为严格高斯分布。
输出预测框可能超出图像边缘，不裁剪；输入框必须完全位于图像内。
非有限中间结果、不可逆观测协方差、负方差抛 `NUMERICAL_FAILURE`，整个更新不提交。

## 关联与状态

以 `1-IoU` 为代价。先在门限内最大化匹配数量，再最小化总成本；同代价按轨迹/检测输入顺序确定。
矩形匈牙利算法增加 n 个未匹配虚拟列，未匹配惩罚 `n+1`，禁止边惩罚 `(n+1)^3`。
真实检测可未匹配。类别不同或 IoU 小于当前门限的边不能被选择；等于门限可匹配。
IoU 计算先统一归一化坐标以避免面积溢出。阶段依次为：

1. tracked/lost 与高分框；2. 剩余 tracked 与低分框；3. tentative 与剩余高分框。

高分 `score>=high`；低分 `low<=score<high`；剩余高分且 `score>=new` 可创建。
默认 low/high/new 为0.1/0.5/0.6，IoU门限0.3/0.2，minHits=2。
tentative 连续命中达到 minHits 后 tracked；首次失配立即 removed。
tracked 失配变 lost；lost 只允许高分恢复。hits 统计实际匹配累计次数，新建为1。
lost 的 `当前时间-lastSeenMs>maxLostMs` 在关联前移除，默认1000ms；等于上限仍可恢复。
帧间隔严格大于 largeGapMs（默认2000ms）先移除所有旧轨迹，再处理新观测。
超时/大间隔移除输出最后成功运动状态，tentative 当帧失配输出本帧预测状态。
removed 只在移除当次返回且 observed=false、score=null。

默认 maxDetections=100、maxTracks=200，上限均为500；超量输入整帧失败。
容量占满只跳过新建并增加 droppedDetections，不驱逐现存轨迹；该计数不包含低分被过滤的框。

## 事务与接口

公开工厂 `createTracker(options?)` 返回同步 `update(frame,{signal}?)`、`reset()`、`dispose()`。
输入和所有返回值与内部状态引用隔离；校验、预测、关联、修正和输出全部成功后才一次提交。
timestampMs 必须非负有限且严格递增；尺寸变化或 seek 需 reset。
generation 从0开始；reset 加1并清空时钟和轨迹、ID从1开始；同代不复用，跨实例独立。
dispose 幂等，随后 update/reset 抛 DISPOSED。同步主线程仅支持开始前取消，抛 ABORTED。
稳定错误码另有 INVALID_OPTIONS、INVALID_INPUT、NUMERICAL_FAILURE、ID_EXHAUSTED。
未知配置键拒绝；选项值必须有效，显式 undefined 不视为缺省。

runtime 固定实际 CPU/main，版本 `web-sdk-pp-tracking@0.1.0`。五项耗时均实测毫秒：
validationMs 从方法入口到完成校验；predictionMs 包含状态复制/预先移除/预测；
associationMs 包含候选分组与三个关联阶段；updateMs 包含修正/创建/结果轨迹快照；
totalMs 从方法入口计至结果对象构建时，不以阶段和代替。无轨迹时仍有阶段调度开销。
cold 指新实例首帧，warm 指复用实例，reset 清除运动状态。

## 数值参考与边界

`scripts/generate-math-reference.py` 用独立 NumPy 矩阵运算生成 fixture，使用 `solve` 求 K，
与生产消元实现不同。dt 为0.1、0.2、0.05、1.5秒，覆盖纯预测与连续修正。
测试逐元素均值/协方差绝对差小于5e-9，并做500轮稳定性检查。
这里只验证数学与原创合成机制；尚无授权真实视频序列评测，不报告 MOT 指标。
