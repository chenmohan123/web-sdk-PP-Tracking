import { useEffect, useRef, useState } from 'react';
import { TrackingError, type TrackerAlgorithm } from 'web-sdk-pp-tracking';
import { DEMO_DEFAULT_PARAMETERS, MAX_BYTES, optionsFrom, prepareSequence, samples, serializeSequence, SYNTHETIC_FEATURE_SPACE, type DemoParameterDraft, type DemoParameterKey, type Sample } from './data';
import { Playback } from './playback';

const copy = {
  zh: {
    title: '目标跟踪', subtitle: 'PP-Tracking · 多算法跟踪', algorithmSelect: '跟踪算法', bytetrack: 'ByteTrack', ocsort: 'OC-SORT', deepsort: 'DeepSORT', sample: '示例', parameters: '跟踪参数', apply: '应用并重新开始', lowLabel: '低分门限', highLabel: '高分门限', newLabel: '新建门限', hitsLabel: '确认命中次数', lostLabel: '丢失保留（ms）', ocmWeightLabel: '方向权重', ocmDeltaMsLabel: '方向历史间隔（ms）', ocmHistoryLengthLabel: '真实观测历史容量', oruMaxReplayStepsLabel: '最大缺失重放帧数', maxCosineDistanceLabel: '最大余弦距离', gallerySizeLabel: '图库容量', featureSpace: '当前特征空间', optionsError: '参数不满足约束；原参数、序列和结果已保留。',
    sequence: '输入序列', straight: '匀速直行', low: '低分关联', occlusion: '短时遮挡', crossing: '交叉与掉头', imported: '已导入序列',
    synthetic: '原创合成数据 · 非真实视频测评', syntheticAppearance: '原创合成框与外观向量 · 不来自图片或 ReID 模型', upload: '导入 JSON', limits: '≤ 5 MiB · 3000 帧 · 100 框/帧',
    play: '播放', pause: '暂停', step: '单步', reset: '重新开始', export: '导出本轮结果', exportInput: '导出输入序列', timeline: '跳转到帧',
    ready: '就绪', running: '播放中', success: '已处理', error: '输入或计算错误', reading: '读取文件中',
    result: '跟踪结果', preview: '输入预览', frame: '帧', observation: '观测', prediction: '预测 / 丢失', detection: '输入检测框',
    empty: '暂无轨迹，单步或播放开始跟踪', noTracks: '本帧无活动轨迹', active: '活动轨迹', removed: '本帧移除', dropped: '容量跳过',
    tracked: '跟踪中', tentative: '待确认', lost: '丢失', score: '分数', class: '类别', runtime: '运行与耗时',
    algorithm: '算法与限制', privacy: '文件仅在本机内存处理，不上传；刷新即清空。',
    detail: '当前算法的独立实现、来源、参数边界和已知限制如下。Apache-2.0；本地候选版本 0.2.0-alpha.0，线上 npm 仍为 0.1.0。',
    contract: '输入：像素 xywh 检测框、分数、类别及严格递增的毫秒时间。输出：轨迹、状态、代次及耗时。',
    limitation: '无外观 ReID。交叉与掉头可能换 ID；轨迹 ID 不是人的身份。低分框应保留，不要提前按高分阈值过滤。',
    resetInfo: '重播、切换序列或跳转会 reset 并清空历史；跳转按顺序重算。语言切换保留状态。',
    defaults: '默认参数：低/高/新建分数 0.1 / 0.5 / 0.6；确认 2 次；丢失保留 1000 ms。',
    timing: '毫秒；冷启动=新实例首帧，热运行=复用状态。复位清除运动状态。',
    verified: '2026-09-19 本地验证：Chromium 153.0.8010.12 / Windows 11 / Intel i5-10400F，CPU main。390px仅为桌面视口测试，其他浏览器与移动设备未验证。',
    invalid: 'JSON 须包含有效 frames 数组，时间递增、尺寸一致、框在范围内。原序列与结果已保留。',
    tooLarge: '文件超过 5 MiB；原序列与结果已保留。', failed: '计算未完成，请重新开始或检查输入。', exportFailed: '输入序列导出失败；原序列与结果已保留。', generation: '代次', source: '论文来源',
  },
  en: {
    title: 'Object tracking', subtitle: 'PP-Tracking · Multi-algorithm tracking', algorithmSelect: 'Tracking algorithm', bytetrack: 'ByteTrack', ocsort: 'OC-SORT', deepsort: 'DeepSORT', sample: 'Example', parameters: 'Tracking parameters', apply: 'Apply & restart', lowLabel: 'Low-score threshold', highLabel: 'High-score threshold', newLabel: 'New-track threshold', hitsLabel: 'Confirmation hits', lostLabel: 'Lost retention (ms)', ocmWeightLabel: 'Observation direction weight', ocmDeltaMsLabel: 'Direction history interval (ms)', ocmHistoryLengthLabel: 'Observed history capacity', oruMaxReplayStepsLabel: 'Maximum missing-frame replay', maxCosineDistanceLabel: 'Maximum cosine distance', gallerySizeLabel: 'Gallery capacity', featureSpace: 'Current feature space', optionsError: 'Invalid parameters. Previous options, input and results preserved.',
    sequence: 'Input sequence', straight: 'Straight motion', low: 'Low-score association', occlusion: 'Brief occlusion', crossing: 'Crossing & turning', imported: 'Imported sequence',
    synthetic: 'Original synthetic data · no real-video evaluation', syntheticAppearance: 'Original synthetic boxes and appearance vectors · not from images or a ReID model', upload: 'Import JSON', limits: '≤ 5 MiB · 3000 frames · 100 boxes/frame',
    play: 'Play', pause: 'Pause', step: 'Step', reset: 'Restart', export: 'Export this run', exportInput: 'Export input sequence', timeline: 'Seek to frame',
    ready: 'Ready', running: 'Playing', success: 'Processed', error: 'Input or computation error', reading: 'Reading file',
    result: 'Tracking result', preview: 'Input preview', frame: 'Frame', observation: 'Observed', prediction: 'Predicted / lost', detection: 'Input detections',
    empty: 'No tracks yet. Step or play to start.', noTracks: 'No active tracks in this frame', active: 'Active tracks', removed: 'Removed now', dropped: 'Capacity skipped',
    tracked: 'Tracked', tentative: 'Tentative', lost: 'Lost', score: 'Score', class: 'Class', runtime: 'Runtime & timings',
    algorithm: 'Algorithm & limitations', privacy: 'Files stay in local memory; no upload. Refresh clears all data.',
    detail: 'The selected algorithm\'s independent implementation, source, parameter bounds and limitations appear below. Apache-2.0; local candidate 0.2.0-alpha.0, while npm remains 0.1.0.',
    contract: 'Input: pixel xywh boxes, scores, classes and strictly increasing millisecond timestamps. Output: tracks, states, generation and timings.',
    limitation: 'No appearance ReID. Crossing and turning may switch IDs; track IDs are not personal identities. Preserve low-score detections before tracking.',
    resetInfo: 'Restart, sequence changes and seek reset state and history. Seek replays in order. Language changes preserve state.',
    defaults: 'Defaults: low/high/new score 0.1 / 0.5 / 0.6; 2 hits to confirm; lost retention 1000 ms.',
    timing: 'Milliseconds; cold = first frame of a new instance, warm = reused state. Reset clears motion state.',
    verified: 'Local verification 2026-09-19: Chromium 153.0.8010.12 / Windows 11 / Intel i5-10400F, CPU main. 390px is a desktop viewport test; other browsers and mobile devices are unverified.',
    invalid: 'JSON must contain valid frames, increasing timestamps, consistent sizes and in-bounds boxes. Previous input and results preserved.',
    tooLarge: 'File exceeds 5 MiB. Previous input and results preserved.', failed: 'Computation failed. Restart or check the input.', exportFailed: 'Input sequence export failed. Previous input and results preserved.', generation: 'Generation', source: 'Paper',
  },
};
const colors = ['#2563eb', '#15803d', '#7c3aed', '#b45309'];
const defaultParameters: Record<TrackerAlgorithm, DemoParameterDraft> = {
  bytetrack: { ...DEMO_DEFAULT_PARAMETERS },
  ocsort: { ...DEMO_DEFAULT_PARAMETERS },
  deepsort: { ...DEMO_DEFAULT_PARAMETERS },
};
const parameterFields: Record<TrackerAlgorithm, readonly DemoParameterKey[]> = {
  bytetrack: ['lowScoreThreshold', 'highScoreThreshold', 'newTrackThreshold', 'minHits', 'maxLostMs'],
  ocsort: ['highScoreThreshold', 'newTrackThreshold', 'minHits', 'maxLostMs', 'ocmWeight', 'ocmDeltaMs', 'ocmHistoryLength', 'oruMaxReplaySteps'],
  deepsort: ['highScoreThreshold', 'newTrackThreshold', 'minHits', 'maxLostMs', 'maxCosineDistance', 'gallerySize'],
};
const parameterLabels: Record<DemoParameterKey, keyof typeof copy.zh> = {
  lowScoreThreshold: 'lowLabel', highScoreThreshold: 'highLabel', newTrackThreshold: 'newLabel', minHits: 'hitsLabel', maxLostMs: 'lostLabel',
  ocmWeight: 'ocmWeightLabel', ocmDeltaMs: 'ocmDeltaMsLabel', ocmHistoryLength: 'ocmHistoryLengthLabel', oruMaxReplaySteps: 'oruMaxReplayStepsLabel',
  maxCosineDistance: 'maxCosineDistanceLabel', gallerySize: 'gallerySizeLabel',
};
const algorithmInfo = {
  zh: {
    bytetrack: { detail: 'ByteTrack 高低分两阶段关联、恒速 Kalman 和全局分配。', defaults: '默认参数：低/高/新建分数 0.1 / 0.5 / 0.6；确认 2 次；丢失保留 1000 ms。', limitation: '无外观 ReID。低分框仅由 ByteTrack 用于续接，不要提前按高分阈值过滤。', source: 'ByteTrack', href: 'https://arxiv.org/abs/2110.06864' },
    ocsort: { detail: 'OC-SORT 的观测中心关联、观测中心恢复和遮挡重现机制，复用独立八维 Kalman 状态。', defaults: '默认参数：高/新建分数 0.5 / 0.6；确认 2 次；丢失保留 1000 ms；方向权重 0.2；历史间隔 300 ms；历史容量与最大重放均为 30。', limitation: '无外观 ReID，也不使用 ByteTrack 低分续接。与论文七维固定帧间隔实现不逐值兼容，未声明真实 MOT 精度。', source: 'OC-SORT', href: 'https://arxiv.org/abs/2203.14360' },
    deepsort: { detail: 'DeepSORT 外观最近邻图库、运动门控、新鲜度级联与有限 IoU 后备，使用调用者提供的外观向量。', defaults: '默认参数：最大余弦距离 0.2；每轨迹图库 30 个向量；高/新建分数 0.5 / 0.6；确认 2 次；丢失保留 1000 ms。', limitation: 'SDK 不内置 ReID 模型，也不从图片生成向量。IoU 后备仅用于未确认轨迹和本帧进入时仍为 tracked 的轨迹；已 lost 轨迹不能绕过外观门限。使用宽高状态、毫秒年龄与本项目噪声模型，不保证论文逐值复现或真实精度。', source: 'Deep SORT', href: 'https://arxiv.org/abs/1703.07402' },
  },
  en: {
    bytetrack: { detail: 'ByteTrack high/low-score association, constant-velocity Kalman filtering and global assignment.', defaults: 'Defaults: low/high/new score 0.1 / 0.5 / 0.6; 2 hits to confirm; lost retention 1000 ms.', limitation: 'No appearance ReID. Only ByteTrack uses low-score detections for continuation; do not pre-filter them at the high-score threshold.', source: 'ByteTrack', href: 'https://arxiv.org/abs/2110.06864' },
    ocsort: { detail: 'OC-SORT observation-centric association, recovery and re-association over the independent eight-dimensional Kalman state.', defaults: 'Defaults: high/new score 0.5 / 0.6; 2 hits; lost retention 1000 ms; direction weight 0.2; history interval 300 ms; history and replay limits 30.', limitation: 'No appearance ReID and no ByteTrack low-score continuation. It is not value-compatible with the paper\'s seven-dimensional fixed-frame implementation and makes no real-MOT accuracy claim.', source: 'OC-SORT', href: 'https://arxiv.org/abs/2203.14360' },
    deepsort: { detail: 'DeepSORT appearance nearest-neighbour galleries, motion gating, recency cascade and a limited IoU fallback over caller-provided appearance vectors.', defaults: 'Defaults: maximum cosine distance 0.2; 30 gallery vectors per track; high/new score 0.5 / 0.6; 2 hits; lost retention 1000 ms.', limitation: 'The SDK has no built-in ReID model and does not derive vectors from images. IoU fallback covers tentative tracks and tracks that entered the frame as tracked; lost tracks cannot bypass appearance matching. Width/height state, millisecond age and this SDK\'s noise model differ from the paper, with no value-level or real-data accuracy claim.', source: 'Deep SORT', href: 'https://arxiv.org/abs/1703.07402' },
  },
} as const;

export function App() {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const t = copy[language];
  const [session] = useState(() => new Playback(samples.straight));
  const [, render] = useState(0);
  const [selected, setSelected] = useState<string>('straight');
  const [playing, setPlaying] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<{ code: string; kind: 'invalid' | 'tooLarge' | 'failed' | 'optionsError' | 'exportFailed' } | null>(null);
  const [algorithm, setAlgorithm] = useState<TrackerAlgorithm>('bytetrack');
  const [parameters, setParameters] = useState<DemoParameterDraft>(defaultParameters.bytetrack);
  const importRequest = useRef(0);
  const refresh = () => render(v => v + 1);
  const current = session.results.at(-1);
  const frame = session.frames[Math.max(0, session.index)];
  const finished = session.index >= session.frames.length - 1;
  const status = error ? 'error' : playing ? 'running' : current ? 'success' : 'ready';
  const displayedAlgorithm = current?.algorithm ?? algorithm;
  const info = algorithmInfo[language][displayedAlgorithm];
  const step = () => {
    try { session.step(); setError(null); refresh(); }
    catch (e) { setPlaying(false); setError({ code: e instanceof TrackingError ? e.code : 'COMPUTATION_FAILED', kind: 'failed' }); }
  };
  useEffect(() => {
    if (!playing || finished) { if (finished) setPlaying(false); return; }
    // 浏览器定时只决定呈现速度；算法始终接收记录中的 timestampMs。
    const next = session.index + 1;
    const delay = next === 0 ? 0 : Math.min(2147483647, session.frames[next].timestampMs - session.frames[next - 1].timestampMs);
    const timer = window.setTimeout(step, delay);
    return () => window.clearTimeout(timer);
  }, [playing, session.index, finished]);
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; document.title = `${t.title} · PP-Tracking`; }, [language]);
  useEffect(() => () => { importRequest.current++; session.dispose(); }, [session]);
  function reset() { setPlaying(false); session.reset(); setError(null); refresh(); }
  async function switchAlgorithm(next: TrackerAlgorithm) {
    const nextParameters = defaultParameters[next];
    const request = ++importRequest.current;
    setPlaying(false); setReading(true);
    try {
      const input = { ...(session.featureSpace ? { featureSpace: session.featureSpace } : {}), frames: session.frames };
      const prepared = await prepareSequence(input, next, optionsFrom(next, nextParameters, session.featureSpace));
      if (request !== importRequest.current) return;
      session.configure(prepared.options);
      setAlgorithm(next); setParameters(nextParameters); setError(null); refresh();
    } catch (e) {
      if (request === importRequest.current) setError({ code: e instanceof TrackingError ? e.code : 'INVALID_SEQUENCE', kind: e instanceof TrackingError && e.code === 'INVALID_OPTIONS' ? 'optionsError' : 'invalid' });
    } finally { if (request === importRequest.current) setReading(false); }
  }
  async function switchSample(next: Sample) {
    const request = ++importRequest.current;
    setPlaying(false); setReading(true);
    try {
      const prepared = await prepareSequence({ featureSpace: SYNTHETIC_FEATURE_SPACE, frames: samples[next] }, algorithm, session.options);
      if (request !== importRequest.current) return;
      session.replace(prepared); setSelected(next); setError(null); refresh();
    } catch (e) {
      if (request === importRequest.current) setError({ code: e instanceof TrackingError ? e.code : 'INVALID_SEQUENCE', kind: 'invalid' });
    } finally { if (request === importRequest.current) setReading(false); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    const request = ++importRequest.current;
    setPlaying(false); setReading(true);
    try {
      if (file.size > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
      const prepared = await prepareSequence(JSON.parse(await file.text()), algorithm, session.options);
      if (request !== importRequest.current) return;
      session.replace(prepared); setSelected('imported'); setError(null); refresh();
    } catch (e) {
      if (request === importRequest.current) setError({ code: e instanceof Error && e.message === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'INVALID_SEQUENCE', kind: e instanceof Error && e.message === 'FILE_TOO_LARGE' ? 'tooLarge' : 'invalid' });
    } finally { if (request === importRequest.current) setReading(false); }
  }
  function download() {
    const output = { schemaVersion: 1, sdkVersion: '0.2.0-alpha.0', algorithm: current?.algorithm ?? session.options.algorithm ?? algorithm, sequence: selected, options: session.options, ...(session.featureSpace ? { featureSpace: session.featureSpace } : {}), frames: session.frames, startedAt: session.startedAt, exportedAt: new Date().toISOString(), processedFrames: session.results.length, totalFrames: session.frames.length, results: session.results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'pp-tracking-results.json'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadSequence() {
    try {
      const contents = serializeSequence(session.frames, session.featureSpace);
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'pp-tracking-input.json'; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(null);
    } catch (e) {
      setError({ code: e instanceof Error && e.message === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'EXPORT_FAILED', kind: 'exportFailed' });
    }
  }
  return <div className="shell">
    <header className="topbar"><div><h1>{t.title}</h1><div className="brand-note">{t.subtitle} <span>v0.2.0-alpha.0</span></div></div><nav><a className="planned" href="https://github.com/chenmohan123/web-sdk-PP-Tracking">GitHub</a><a className="planned" href="https://www.npmjs.com/package/web-sdk-pp-tracking">npm 0.1.0</a><button data-testid="language" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>{language === 'zh' ? 'English' : '中文'}</button></nav></header>
    <main>
      <aside className="panel controls"><h2>{t.sequence}</h2>
        <label htmlFor="algorithm">{t.algorithmSelect}</label><select id="algorithm" disabled={reading} value={algorithm} onChange={e => { void switchAlgorithm(e.target.value as TrackerAlgorithm); }}>
          <option value="bytetrack">{t.bytetrack}</option><option value="ocsort">{t.ocsort}</option><option value="deepsort">{t.deepsort}</option>
        </select>
        <label htmlFor="sample">{t.sample}</label><select id="sample" disabled={reading} value={selected} onChange={e => { void switchSample(e.target.value as Sample); }}>
          {Object.keys(samples).map(key => <option key={key} value={key}>{t[key as Sample]}</option>)}{selected === 'imported' && <option value="imported">{t.imported}</option>}
        </select>
        <p className="muted">{selected === 'imported' ? t.imported : algorithm === 'deepsort' ? t.syntheticAppearance : t.synthetic}</p>
        <label className="file-button">{t.upload}<input data-testid="import" type="file" accept="application/json,.json" disabled={reading} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <p className="muted small">{t.limits}</p>
        <div className="buttons"><button className="primary" disabled={reading || finished} onClick={() => { setError(null); setPlaying(v => !v); }}>{playing ? t.pause : t.play}</button><button disabled={reading || playing || finished} onClick={step}>{t.step}</button><button data-sdk-state-reset disabled={reading} onClick={reset}>{t.reset}</button></div>
        <label htmlFor="seek">{t.timeline} <b>{Math.max(0, session.index + 1)} / {session.frames.length}</b></label>
        <input id="seek" type="range" min="0" max={session.frames.length - 1} value={Math.max(0, session.index)} disabled={reading || playing} onChange={e => { setPlaying(false); try { session.seek(Number(e.target.value)); setError(null); refresh(); } catch { setError({ code: 'COMPUTATION_FAILED', kind: 'failed' }); refresh(); } }} />
        <div className="exports"><button className="export" disabled={reading || playing} onClick={downloadSequence}>{t.exportInput}</button><button className="export" disabled={!current || reading || playing} onClick={download}>{t.export}</button></div>
        <details className="parameters"><summary>{t.parameters}</summary><form onSubmit={e => {
          e.preventDefault(); setPlaying(false);
          try { session.configure(optionsFrom(algorithm, parameters, session.featureSpace)); setError(null); refresh(); }
          catch { setError({ code: 'INVALID_OPTIONS', kind: 'optionsError' }); }
        }}>
          {parameterFields[algorithm].map(key => <label key={key}>{t[parameterLabels[key]]}<input data-testid={key} type="number" step={key === 'ocmWeight' || key === 'maxCosineDistance' || key.includes('Threshold') ? '0.01' : '1'} value={parameters[key]} disabled={reading || playing} onChange={e => setParameters({ ...parameters, [key]: e.target.value })} /></label>)}
          <button disabled={reading || playing} type="submit">{t.apply}</button>
        </form></details><p className="privacy">{t.privacy}</p>
      </aside>
      <section className="panel workspace"><div className="section-title"><h2>{current ? t.result : t.preview}</h2><span className="runtime-chip">CPU / JavaScript / Main</span></div>
        <div className="status" role="status" data-state={status}><span>{reading ? t.reading : t[status]}</span><span data-testid="frame">{t.frame} {session.index + 1}/{session.frames.length} · {current?.timestampMs ?? frame.timestampMs} ms</span></div>
        {error && <div role="alert" className="error"><b>{error.code}</b> · {t[error.kind]}</div>}
        <svg className="stage" viewBox={`0 0 ${frame.imageSize.width} ${frame.imageSize.height}`} role="img" aria-label={t.result}>
          <defs><pattern id="grid" width={frame.imageSize.width / 16} height={frame.imageSize.height / 9} patternUnits="userSpaceOnUse"><path d={`M ${frame.imageSize.width / 16} 0 L 0 0 0 ${frame.imageSize.height / 9}`} fill="none" stroke="#e2e8f0" strokeWidth={frame.imageSize.width / 1280} /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {frame.detections.map((d, i) => <rect key={i} {...d.box} fill="none" stroke="#94a3b8" strokeWidth={frame.imageSize.width / 320} />)}
          {current?.tracks.map(track => {
            const color = colors[(track.id - 1) % colors.length];
            const points = session.results.slice(-100).flatMap(r => r.tracks.filter(tr => tr.id === track.id).map(tr => `${tr.box.x + tr.box.width / 2},${tr.box.y + tr.box.height / 2}`)).join(' ');
            return <g key={track.id} data-track-state={track.state} stroke={color}><polyline points={points} fill="none" strokeWidth={frame.imageSize.width / 320} opacity="0.6" /><rect {...track.box} fill={color} fillOpacity="0.07" strokeWidth={frame.imageSize.width / 210} strokeDasharray={track.observed ? undefined : `${frame.imageSize.width / 80} ${frame.imageSize.width / 128}`} /><text x={track.box.x} y={Math.max(frame.imageSize.height / 20, track.box.y - frame.imageSize.height / 45)} fontSize={frame.imageSize.width / 38} stroke="none" fill={color}>#{track.id} · {t[track.state]}</text></g>;
          })}
        </svg>
        <div className="legend"><span className="observed">━ {t.observation}</span><span>┄ {t.prediction}</span><span className="muted">□ {t.detection}</span></div>
      </section>
      <aside className="panel results"><h2>{t.active} <span>{current?.tracks.length ?? 0}</span></h2>
        <div className="track-list">{current?.tracks.length ? current.tracks.map(track => <article className="track" key={track.id}><div><b style={{ color: colors[(track.id - 1) % colors.length] }}>#{track.id}</b><span>{t[track.state]}</span></div><p>{t.class} {track.classId} · {t.score} {track.score?.toFixed(2) ?? '—'}</p><small>{track.observed ? t.observation : t.prediction} · {track.hits} hits</small></article>) : <p className="muted">{current ? t.noTracks : t.empty}</p>}</div>
        <div className="counts">{t.generation}: {current?.generation ?? '—'}<br />{t.removed}: {current?.removed.length ?? 0}<br />{t.dropped}: {current?.droppedDetections ?? 0}</div>
      </aside>
      <section className="details"><details data-sdk-runtime-info><summary>{t.runtime}</summary><p>requestedBackend: cpu · actualBackend: cpu · executionMode: main<br />web-sdk-pp-tracking@0.2.0-alpha.0</p><dl data-sdk-timing>{(['validationMs', 'predictionMs', 'associationMs', 'updateMs', 'totalMs'] as const).map(key => <div key={key}><dt>{key}</dt><dd>{current ? current.timings[key].toFixed(3) : '—'} ms</dd></div>)}</dl><p>{t.timing}</p><p>{t.verified}</p></details>
      <details data-sdk-algorithm-info><summary>{t.algorithm}</summary><p>{t.detail}</p><p>{info.detail}</p>{displayedAlgorithm === 'deepsort' && session.featureSpace && <p className="feature-space"><b>{t.featureSpace}：</b><code data-testid="feature-space">{session.featureSpace.id} · {session.featureSpace.dimension}D</code></p>}<p>{t.contract}</p><p>{info.defaults}</p><p>{info.limitation}</p><p>{t.resetInfo}</p><a href={info.href} target="_blank" rel="noreferrer">{t.source}: {info.source}</a></details></section>
    </main>
  </div>;
}
