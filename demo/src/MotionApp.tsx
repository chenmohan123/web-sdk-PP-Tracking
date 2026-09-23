import { useEffect, useRef, useState } from 'react';
import { estimateMotion, type MotionAlgorithm, type MotionEstimateResult } from 'web-sdk-pp-tracking/motion';

const algorithms: MotionAlgorithm[] = ['translation', 'sparse-flow', 'feature-match'];
const labels = {
  zh: { title: '运动估计实验', subtitle: 'PP-Tracking · 相邻帧运动', experiment: '实验能力：结果不会自动接入默认跟踪。', previous: '上一帧', current: '当前帧', algorithm: '算法', run: '运行当前', runAll: '运行全部', reset: '重置', export: '导出 JSON', synthetic: '原创合成纹理 · 平移 4 × 3 px', upload: '选择本地图片', result: '估计结果', empty: '运行后显示矩阵、质量与耗时', runtime: '运行与耗时', detail: 'CPU 主线程实验入口；图片只在本机内存处理。', confidence: '置信度', inliers: '内点', residual: '残差', failure: '失败原因' },
  en: { title: 'Motion estimation lab', subtitle: 'PP-Tracking · Adjacent-frame motion', experiment: 'Experimental capability: results are not automatically connected to default tracking.', previous: 'Previous frame', current: 'Current frame', algorithm: 'Algorithm', run: 'Run selected', runAll: 'Run all', reset: 'Reset', export: 'Export JSON', synthetic: 'Original synthetic texture · 4 × 3 px translation', upload: 'Choose local image', result: 'Estimation results', empty: 'Run to show matrices, quality, and timings', runtime: 'Runtime & timings', detail: 'CPU main-thread experiment; images stay in local memory.', confidence: 'Confidence', inliers: 'Inliers', residual: 'Residual', failure: 'Failure reason' },
};

function synthetic(width = 320, height = 180, shiftX = 0, shiftY = 0): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceX = x - shiftX, sourceY = y - shiftY;
    const value = sourceX >= 0 && sourceY >= 0 && sourceX < width && sourceY < height
      ? Math.sin(sourceX * 0.23) * 35 + Math.cos(sourceY * 0.19) * 35 + ((sourceX * 17 + sourceY * 13) % 41) * 3 + 90 : 0;
    const index = (y * width + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value)); data[index + 3] = 255;
  }
  return new ImageData(data, width, height);
}

async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 16 || bitmap.height < 16 || bitmap.width * bitmap.height > 16_777_216) throw new Error('INVALID_IMAGE');
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('CANVAS_UNAVAILABLE');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally { bitmap.close(); }
}

function FrameCanvas({ image, label }: { image: ImageData; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const canvas = ref.current; if (!canvas) return; canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d')?.putImageData(image, 0, 0); }, [image]);
  return <figure><figcaption>{label}</figcaption><canvas ref={ref} /></figure>;
}

export function MotionApp() {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [algorithm, setAlgorithm] = useState<MotionAlgorithm>('translation');
  const [previous, setPrevious] = useState(() => synthetic());
  const [current, setCurrent] = useState(() => synthetic(320, 180, 4, 3));
  const [results, setResults] = useState<Partial<Record<MotionAlgorithm, MotionEstimateResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const t = labels[language];
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);

  async function run(selected: readonly MotionAlgorithm[]) {
    setError(null);
    if (previous.width !== current.width || previous.height !== current.height) { setError(language === 'zh' ? '两张图片尺寸必须一致' : 'Images must have matching dimensions'); return; }
    try {
      const entries = await Promise.all(selected.map(async name => [name, await estimateMotion({ previous: { image: previous, frameId: 0, timestampMs: 0 }, current: { image: current, frameId: 1, timestampMs: 33 }, imageSize: { width: previous.width, height: previous.height } }, { algorithm: name })] as const));
      setResults(old => ({ ...old, ...Object.fromEntries(entries) }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  async function upload(which: 'previous' | 'current', file?: File) {
    if (!file) return;
    try { const image = await fileToImageData(file); which === 'previous' ? setPrevious(image) : setCurrent(image); setResults({}); setError(null); }
    catch { setError(language === 'zh' ? '图片无法读取或超出限制' : 'The image cannot be read or exceeds limits'); }
  }
  function download() {
    const payload = { schemaVersion: 1, generatedAt: new Date().toISOString(), imageSize: { width: previous.width, height: previous.height }, results: algorithms.flatMap(name => {
      const result = results[name];
      if (!result) return [];
      const { algorithm: _algorithm, ...detail } = result;
      return [{ algorithm: name, ...detail }];
    }) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pp-tracking-motion.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="shell motion-page">
    <header className="topbar"><div><h1>{t.title}</h1><div className="brand-note">{t.subtitle} <span>v0.2.0-rc.2 · lab</span></div></div><nav><a className="planned" href="./">Tracking Demo</a><button data-testid="language" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>{language === 'zh' ? 'English' : '中文'}</button></nav></header>
    <p className="experiment-note"><b>{language === 'zh' ? '实验能力' : 'Experimental capability'}</b>：{t.experiment.replace(/^实验能力：|^Experimental capability: /, '')}</p>
    <main className="motion-main">
      <aside className="panel motion-controls"><label htmlFor="motion-algorithm">{t.algorithm}</label><select id="motion-algorithm" value={algorithm} onChange={event => setAlgorithm(event.target.value as MotionAlgorithm)}>{algorithms.map(name => <option value={name} key={name}>{name}</option>)}</select><p className="muted">{t.synthetic}</p><label className="file-button">{t.previous} · {t.upload}<input type="file" accept="image/*" onChange={event => { void upload('previous', event.target.files?.[0]); event.target.value = ''; }} /></label><label className="file-button">{t.current} · {t.upload}<input type="file" accept="image/*" onChange={event => { void upload('current', event.target.files?.[0]); event.target.value = ''; }} /></label><div className="motion-buttons"><button className="primary" onClick={() => void run([algorithm])}>{t.run}</button><button onClick={() => void run(algorithms)}>{t.runAll}</button><button data-sdk-state-reset onClick={() => { setResults({}); setError(null); }}>{t.reset}</button><button disabled={!Object.keys(results).length} onClick={download}>{t.export}</button></div></aside>
      <section className="panel motion-workspace"><div className="section-title"><h2>{t.result}</h2><span className="runtime-chip">CPU / JavaScript / Main</span></div>{error && <div role="alert" className="error">{error}</div>}<div className="motion-frames"><FrameCanvas image={previous} label={t.previous} /><FrameCanvas image={current} label={t.current} /></div></section>
      <aside className="panel motion-results"><h2>{t.result}</h2>{!Object.keys(results).length && <p className="muted">{t.empty}</p>}{algorithms.flatMap(name => { const result = results[name]; if (!result) return []; const residual = result.status === 'failed' ? undefined : result.residual; return <article key={name} data-motion-row data-status={result.status}><b>{name}</b><span className="motion-status">{result.status}</span>{result.status !== 'failed' && <code>[{result.matrix.map(value => value.toFixed(3)).join(', ')}]</code>}<small>{t.confidence}: {result.confidence.toFixed(3)} · {t.inliers}: {result.inlierCount}{residual === undefined ? '' : ` · ${t.residual}: ${residual.toFixed(3)}`}</small>{result.status === 'failed' && <small data-testid="motion-failure">{t.failure}: {result.reason}</small>}<small>{result.timings.preprocessMs.toFixed(2)} / {result.timings.estimateMs.toFixed(2)} / {result.timings.totalMs.toFixed(2)} ms</small></article>; })}</aside>
      <section className="details"><details open data-sdk-runtime-info><summary>{t.runtime}</summary><p>requestedBackend: cpu · actualBackend: cpu · executionMode: main<br />web-sdk-pp-tracking/motion@0.2.0-rc.2</p><div data-sdk-timing><p>preprocessMs / estimateMs / totalMs</p></div><p>{t.detail}</p></details><details data-sdk-algorithm-info><summary>{language === 'zh' ? '算法与限制' : 'Algorithms & limits'}</summary><p>{t.experiment}</p><p>translation / sparse-flow / feature-match · Windows 11 + Chromium 153 · CPU/main</p></details></section>
    </main>
  </div>;
}
