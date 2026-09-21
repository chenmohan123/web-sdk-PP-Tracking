# 独立跟踪算法与数值定义

[English](../en/algorithm.md)

本实现参考 [ByteTrack 论文](https://arxiv.org/abs/2110.06864) 的高低分两阶段关联思想。
运动模型、分配器、状态机均按本文公式独立编写，未读取或翻译旧 Kalman/SORT 代码。
不是官方移植；根入口不加载特征提取模型，无运动补偿。DeepSORT 只消费调用者外部向量，不承诺向量质量、交叉掉头的身份正确性或 MOT 精度。

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
IoU 先用框间相对位移求交集宽高，再分别按两轴最大边长归一化面积，避免绝对坐标相减精度损失与面积溢出。阶段依次为：

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

本地候选 runtime 固定实际 CPU/main，版本 `web-sdk-pp-tracking@0.2.0-alpha.0`；线上 0.1.0 的历史发布证据不因此改写。五项耗时均实测毫秒：
validationMs 从方法入口到完成校验；predictionMs 包含状态复制/预先移除/预测；
associationMs 包含候选分组与三个关联阶段；updateMs 包含修正/创建/结果轨迹快照；
totalMs 从方法入口计至结果对象构建时，不以阶段和代替。无轨迹时仍有阶段调度开销。
cold 指新实例首帧，warm 指复用实例，reset 清除运动状态。

## 数值参考与边界

`scripts/generate-math-reference.py` 用独立 NumPy 矩阵运算生成 fixture，使用 `solve` 求 K，
与生产消元实现不同。dt 为0.1、0.2、0.05、1.5秒，覆盖纯预测与连续修正。
测试逐元素均值/协方差绝对差小于5e-9，并做500轮稳定性检查。
数学 fixture 仍只验证公式与原创合成机制。另有不含图像媒体的固定 MOT17 FRCNN 训练序列评测：ByteTrack 与 OC-SORT 在相同 5316 帧检测输入上分别重复运行，指标、输入/输出 SHA、固定 TrackEval 身份和限制见[候选对比报告](../../reports/2026-09-19-ocsort/README.md)。它不是授权真实视频端到端评测、测试集排行榜或官方算法复现。

## OC-SORT（本地 alpha）

`createTracker({algorithm: 'ocsort'})` 选择框输入的 OC-SORT 思路实现；省略
`algorithm` 仍使用原 ByteTrack 思路。结果的 `algorithm` 字段报告实际策略。
OC-SORT 只使用高分关联，不接受 `lowScoreThreshold` 或
`lowMatchIouThreshold`；显式传入会返回 `INVALID_OPTIONS`。公共的
`highScoreThreshold`、`newTrackThreshold`、`matchIouThreshold`、`minHits`、
`maxLostMs`、`largeGapMs`、容量参数仍有效。

来源固定为 Jinkun Cao、Jiangmiao Pang、Xinshuo Weng、Rawal Khirodkar、Kris
Kitani 的论文 [Observation-Centric SORT: Rethinking SORT for Robust
Multi-Object Tracking](https://arxiv.org/abs/2203.14360)，arXiv
`2203.14360v3`，2023-03-16 更新，CVPR 2023 接收版。论文摘要说明 OC-SORT
用观测构造遮挡期间虚拟轨迹，以修正滤波误差；正文第 4.1--4.2 节和附录
伪代码给出 ORU、OCM、OCR 的关系。本项目没有读取或翻译旧 SORT、DeepSORT、
Paddle 或 OC-SORT 的 Kalman/跟踪实现，也不是官方移植或逐值复现。

### OCM、OCR、ORU

对候选轨迹 `i` 和检测 `j`，先要求类别相同且原始 `IoU(i,j) >= τ`，这个硬
门限不能被方向分数绕过。通过后使用论文的方向一致性形式：

`score(i,j) = IoU(i,j) - λ * Δθ(i,j) / π`

`Δθ` 是轨迹历史方向和当前意图方向的最小弧度差，方向由真实观测中心点的
`atan2(Δy, Δx)` 得到；零位移方向不产生惩罚。默认 `λ=ocmWeight=0.2`，
方向观测优先选择相隔至少 `ocmDeltaMs=300` 毫秒的两次真实观测；历史最多
保留 `ocmHistoryLength=30` 次（允许范围 2--120）。这些时间单位是 SDK 的
毫秒时间戳，和论文固定帧间隔不同。

第一次高分关联后，OCR 对仍未匹配的轨迹和剩余高分检测再做一次 IoU 关联，
使用轨迹最后一次真实观测的框；它仍执行类别和 `matchIouThreshold` 硬门限。
这一步能覆盖目标短暂停止或从遮挡中返回的情况。

OCR 或普通高分关联重新激活 `lost` 轨迹时触发 ORU。实现从最后真实观测后
保存的滤波快照恢复，只对实际收到的缺失帧时间戳依次预测和校正，并用锚点
线性插值虚拟框：

`z~(t) = z_last + (t - t_last) / (t_now - t_last) * (z_now - z_last)`

每个虚拟框只用于滤波重放，不增加 `hits`、不写入真实观测历史、不更新
`score`；最后再用当前真实观测校正并只增加一次真实命中。缺失重放最多
`oruMaxReplaySteps=30` 次（允许范围 1--60）；超过上限的轨迹在该次事务中
结束，避免无界历史或循环。更新失败或开始前取消时，时钟、ID、滤波状态、
观测历史和缺失时间戳均不提交。

OC-SORT 复用本项目独立的八维 `cx/cy/w/h` 恒速滤波、秒级 `dt`、类别隔离和
生命周期。论文使用七维状态和帧间隔；因此本实现只声明机制对应关系，不承诺
与官方代码的逐值结果或 MOT 指标兼容。CPU/main、reset、dispose、实例隔离
和同步取消语义与原算法一致。

## DeepSORT（外部向量，本地 alpha）

`createTracker({algorithm:'deepsort',featureSpace})` 依据 [Deep SORT 论文](https://arxiv.org/abs/1703.07402) 的概念独立实现。跟踪根入口不加载模型或生成embedding；可选[ReID子入口](reid-candidate.md)负责人体框特征。调用者为每帧和每个检测提供与 `featureSpace` 一致的标识和向量。向量经缩放避免范数溢出后归一化并复制；缺失、错维、非有限或零范数使整帧以 `INVALID_INPUT` 失败且不提交状态。每条轨迹保存最近 `gallerySize` 个向量，距离为检测向量与图库样本的最小余弦距离。

已确认轨迹按 `lastSeenMs` 从新到旧分组级联。候选边同时要求类别相同、最小余弦距离不大于 `maxCosineDistance`，且四维观测的平方 Mahalanobis 距离不大于 `9.487729036781154`；观测协方差使用预测位置协方差加 `4I`。每组继续使用最大可行匹配数、再最小代价的确定性全局分配。

外观阶段后，只让 tentative 轨迹和进入本帧时仍为 tracked 的未匹配轨迹参与类别/IoU 后备；已经 lost 的轨迹不能绕过外观门限。成功匹配和新建写入图库，失配不写；超出容量移除最旧样本。图库标量上限为 `maxTracks * gallerySize * dimension <= 4_000_000`，reset、dispose 和轨迹移除释放状态。

与论文实现的明确差异：本项目使用 `cx/cy/w/h` 八维状态而非 aspect-ratio/height，按毫秒 `lastSeenMs` 分组而非固定帧年龄，并沿用本文的 Kalman 噪声、门限和状态生命周期。因此只声明机制对应关系，不保证官方逐值复现。当前证据是原创合成向量和契约/浏览器验证；历史 MOT17 报告没有外部 appearance embedding，不能作为 DeepSORT 真实精度证据。
