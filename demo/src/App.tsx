import { useEffect, useRef, useState } from 'react';
import { TrackingError } from 'web-sdk-pp-tracking';
import { MAX_BYTES, parseSequence, samples, type Sample } from './data';
import { Playback } from './playback';

const copy = {
  zh: {
    title: '目标跟踪', subtitle: 'PP-Tracking · ByteTrack 机制', sample: '示例', parameters: '跟踪参数', apply: '应用并重新开始', lowLabel: '低分门限', highLabel: '高分门限', newLabel: '新建门限', hitsLabel: '确认命中次数', lostLabel: '丢失保留（ms）', parameterNote: '应用后新建实例并清空结果。须低 ≤ 高 ≤ 新建；丢失保留 ≤ 2000 ms。', optionsError: '参数不满足约束；原参数、序列和结果已保留。',
    sequence: '输入序列', straight: '匀速直行', low: '低分关联', occlusion: '短时遮挡', crossing: '交叉与掉头', imported: '已导入序列',
    synthetic: '原创合成数据 · 非真实视频测评', upload: '导入 JSON', limits: '≤ 5 MiB · 3000 帧 · 100 框/帧',
    play: '播放', pause: '暂停', step: '单步', reset: '重新开始', export: '导出本轮结果', timeline: '跳转到帧',
    ready: '就绪', running: '播放中', success: '已处理', error: '输入或计算错误', reading: '读取文件中',
    result: '跟踪结果', preview: '输入预览', frame: '帧', observation: '观测', prediction: '预测 / 丢失', detection: '输入检测框',
    empty: '暂无轨迹，单步或播放开始跟踪', noTracks: '本帧无活动轨迹', active: '活动轨迹', removed: '本帧移除', dropped: '容量跳过',
    tracked: '跟踪中', tentative: '待确认', lost: '丢失', score: '分数', class: '类别', runtime: '运行与耗时',
    algorithm: '算法与限制', privacy: '文件仅在本机内存处理，不上传；刷新即清空。',
    detail: '独立实现高低分两阶段关联、恒速 Kalman 和全局分配。Apache-2.0；算法版本 0.1.0。',
    contract: '输入：像素 xywh 检测框、分数、类别及严格递增的毫秒时间。输出：轨迹、状态、代次及耗时。',
    limitation: '无外观 ReID。交叉与掉头可能换 ID；轨迹 ID 不是人的身份。低分框应保留，不要提前按高分阈值过滤。',
    resetInfo: '重播、切换序列或跳转会 reset 并清空历史；跳转按顺序重算。语言切换保留状态。',
    defaults: '默认参数：低/高/新建分数 0.1 / 0.5 / 0.6；确认 2 次；丢失保留 1000 ms。',
    timing: '毫秒；冷启动=新实例首帧，热运行=复用状态。复位清除运动状态。',
    verified: '2026-09-19 本地验证：Chromium 153.0.8010.12 / Windows 11 / Intel i5-10400F，CPU main。390px仅为桌面视口测试，其他浏览器与移动设备未验证。',
    invalid: 'JSON 须包含有效 frames 数组，时间递增、尺寸一致、框在范围内。原序列与结果已保留。',
    tooLarge: '文件超过 5 MiB；原序列与结果已保留。', failed: '计算未完成，请重新开始或检查输入。', generation: '代次', source: '论文来源',
  },
  en: {
    title: 'Object tracking', subtitle: 'PP-Tracking · ByteTrack mechanism', sample: 'Example', parameters: 'Tracking parameters', apply: 'Apply & restart', lowLabel: 'Low-score threshold', highLabel: 'High-score threshold', newLabel: 'New-track threshold', hitsLabel: 'Confirmation hits', lostLabel: 'Lost retention (ms)', parameterNote: 'Applying creates a new instance and clears results. Require low ≤ high ≤ new; lost retention ≤ 2000 ms.', optionsError: 'Invalid parameters. Previous options, input and results preserved.',
    sequence: 'Input sequence', straight: 'Straight motion', low: 'Low-score association', occlusion: 'Brief occlusion', crossing: 'Crossing & turning', imported: 'Imported sequence',
    synthetic: 'Original synthetic data · no real-video evaluation', upload: 'Import JSON', limits: '≤ 5 MiB · 3000 frames · 100 boxes/frame',
    play: 'Play', pause: 'Pause', step: 'Step', reset: 'Restart', export: 'Export this run', timeline: 'Seek to frame',
    ready: 'Ready', running: 'Playing', success: 'Processed', error: 'Input or computation error', reading: 'Reading file',
    result: 'Tracking result', preview: 'Input preview', frame: 'Frame', observation: 'Observed', prediction: 'Predicted / lost', detection: 'Input detections',
    empty: 'No tracks yet. Step or play to start.', noTracks: 'No active tracks in this frame', active: 'Active tracks', removed: 'Removed now', dropped: 'Capacity skipped',
    tracked: 'Tracked', tentative: 'Tentative', lost: 'Lost', score: 'Score', class: 'Class', runtime: 'Runtime & timings',
    algorithm: 'Algorithm & limitations', privacy: 'Files stay in local memory; no upload. Refresh clears all data.',
    detail: 'Independent high/low-score association, constant-velocity Kalman and global assignment. Apache-2.0; algorithm version 0.1.0.',
    contract: 'Input: pixel xywh boxes, scores, classes and strictly increasing millisecond timestamps. Output: tracks, states, generation and timings.',
    limitation: 'No appearance ReID. Crossing and turning may switch IDs; track IDs are not personal identities. Preserve low-score detections before tracking.',
    resetInfo: 'Restart, sequence changes and seek reset state and history. Seek replays in order. Language changes preserve state.',
    defaults: 'Defaults: low/high/new score 0.1 / 0.5 / 0.6; 2 hits to confirm; lost retention 1000 ms.',
    timing: 'Milliseconds; cold = first frame of a new instance, warm = reused state. Reset clears motion state.',
    verified: 'Local verification 2026-09-19: Chromium 153.0.8010.12 / Windows 11 / Intel i5-10400F, CPU main. 390px is a desktop viewport test; other browsers and mobile devices are unverified.',
    invalid: 'JSON must contain valid frames, increasing timestamps, consistent sizes and in-bounds boxes. Previous input and results preserved.',
    tooLarge: 'File exceeds 5 MiB. Previous input and results preserved.', failed: 'Computation failed. Restart or check the input.', generation: 'Generation', source: 'Paper',
  },
};
const colors = ['#2563eb', '#15803d', '#7c3aed', '#b45309'];

export function App() {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const t = copy[language];
  const [session] = useState(() => new Playback(samples.straight));
  const [, render] = useState(0);
  const [selected, setSelected] = useState<string>('straight');
  const [playing, setPlaying] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<{ code: string; kind: 'invalid' | 'tooLarge' | 'failed' | 'optionsError' } | null>(null);
  const [parameters, setParameters] = useState({ lowScoreThreshold: '0.1', highScoreThreshold: '0.5', newTrackThreshold: '0.6', minHits: '2', maxLostMs: '1000' });
  const importRequest = useRef(0);
  const refresh = () => render(v => v + 1);
  const current = session.results.at(-1);
  const frame = session.frames[Math.max(0, session.index)];
  const finished = session.index >= session.frames.length - 1;
  const status = error ? 'error' : playing ? 'running' : current ? 'success' : 'ready';
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
  async function importFile(file?: File) {
    if (!file) return;
    const request = ++importRequest.current;
    setPlaying(false); setReading(true);
    try {
      if (file.size > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
      const frames = parseSequence(JSON.parse(await file.text()));
      if (request !== importRequest.current) return;
      session.reset(); session.frames = frames; setSelected('imported'); setError(null); refresh();
    } catch (e) {
      if (request === importRequest.current) setError({ code: e instanceof Error && e.message === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'INVALID_SEQUENCE', kind: e instanceof Error && e.message === 'FILE_TOO_LARGE' ? 'tooLarge' : 'invalid' });
    } finally { if (request === importRequest.current) setReading(false); }
  }
  function download() {
    const output = { schemaVersion: 1, sdkVersion: '0.1.0', sequence: selected, options: session.options, startedAt: session.startedAt, exportedAt: new Date().toISOString(), processedFrames: session.results.length, totalFrames: session.frames.length, results: session.results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'pp-tracking-results.json'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="shell">
    <header className="topbar"><div><h1>{t.title}</h1><div className="brand-note">{t.subtitle} <span>v0.1.0</span></div></div><nav><a className="planned" href="https://github.com/chenmohan123/web-sdk-PP-Tracking">GitHub</a><a className="planned" href="https://www.npmjs.com/package/web-sdk-pp-tracking">npm</a><button data-testid="language" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>{language === 'zh' ? 'English' : '中文'}</button></nav></header>
    <main>
      <aside className="panel controls"><h2>{t.sequence}</h2>
        <label htmlFor="sample">{t.sample}</label><select id="sample" disabled={reading} value={selected} onChange={e => { reset(); setSelected(e.target.value); session.frames = samples[e.target.value as Sample]; }}>
          {Object.keys(samples).map(key => <option key={key} value={key}>{t[key as Sample]}</option>)}{selected === 'imported' && <option value="imported">{t.imported}</option>}
        </select>
        <p className="muted">{selected === 'imported' ? t.imported : t.synthetic}</p>
        <label className="file-button">{t.upload}<input data-testid="import" type="file" accept="application/json,.json" disabled={reading} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <p className="muted small">{t.limits}</p>
        <div className="buttons"><button className="primary" disabled={reading || finished} onClick={() => { setError(null); setPlaying(v => !v); }}>{playing ? t.pause : t.play}</button><button disabled={reading || playing || finished} onClick={step}>{t.step}</button><button data-sdk-state-reset disabled={reading} onClick={reset}>{t.reset}</button></div>
        <label htmlFor="seek">{t.timeline} <b>{Math.max(0, session.index + 1)} / {session.frames.length}</b></label>
        <input id="seek" type="range" min="0" max={session.frames.length - 1} value={Math.max(0, session.index)} disabled={reading || playing} onChange={e => { setPlaying(false); try { session.seek(Number(e.target.value)); setError(null); refresh(); } catch { setError({ code: 'COMPUTATION_FAILED', kind: 'failed' }); refresh(); } }} />
        <button className="export" disabled={!current || reading || playing} onClick={download}>{t.export}</button>
        <details className="parameters"><summary>{t.parameters}</summary><form onSubmit={e => {
          e.preventDefault(); setPlaying(false);
          try { session.configure(Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)]))); setError(null); refresh(); }
          catch { setError({ code: 'INVALID_OPTIONS', kind: 'optionsError' }); }
        }}>
          {([['lowScoreThreshold', 'lowLabel'], ['highScoreThreshold', 'highLabel'], ['newTrackThreshold', 'newLabel'], ['minHits', 'hitsLabel'], ['maxLostMs', 'lostLabel']] as const).map(([key, label]) => <label key={key}>{t[label]}<input data-testid={key} type="number" step={key.includes('Threshold') ? '0.01' : '1'} value={parameters[key]} disabled={reading || playing} onChange={e => setParameters({ ...parameters, [key]: e.target.value })} /></label>)}
          <p>{t.parameterNote}</p><button disabled={reading || playing} type="submit">{t.apply}</button>
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
      <section className="details"><details data-sdk-runtime-info><summary>{t.runtime}</summary><p>requestedBackend: cpu · actualBackend: cpu · executionMode: main<br />web-sdk-pp-tracking@0.1.0</p><dl data-sdk-timing>{(['validationMs', 'predictionMs', 'associationMs', 'updateMs', 'totalMs'] as const).map(key => <div key={key}><dt>{key}</dt><dd>{current ? current.timings[key].toFixed(3) : '—'} ms</dd></div>)}</dl><p>{t.timing}</p><p>{t.verified}</p></details>
      <details data-sdk-algorithm-info><summary>{t.algorithm}</summary><p>{t.detail}</p><p>{t.contract}</p><p>{t.defaults}</p><p>{t.limitation}</p><p>{t.resetInfo}</p><a href="https://arxiv.org/abs/2110.06864" target="_blank" rel="noreferrer">{t.source}: ByteTrack</a></details></section>
    </main>
  </div>;
}
