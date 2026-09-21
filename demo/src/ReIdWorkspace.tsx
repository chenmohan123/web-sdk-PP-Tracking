import { useEffect, useRef, useState } from 'react';
import { clearReIdCache, createReIdExtractor, estimateReIdCache, getReIdModelSource } from 'web-sdk-pp-tracking/reid';
import { decodeImage, ImageSelection, ReIdController } from './reid-controller';

const copy = {
  zh: {
    controls: '图像 + 检测框', image: '选择图像', source: '模型来源', backend: '模型后端', boxes: '本帧人体检测框（JSON）', run: '提取并跟踪', cancel: '取消', reset: '复位轨迹', clear: '清理模型', cache: '模型缓存', estimate: '刷新用量',
    ready: '就绪', loading: '加载模型', running: '提取中', success: '已处理', error: '处理失败', decoding: '解码图像', cancelled: '已取消', clearing: '释放与清理中',
    preview: '图像与轨迹', empty: '选择图像，并填写调用者提供的人体检测框', tracks: '活动轨迹', frame: '成功帧', model: '当前模型', runtime: '运行与分层耗时', algorithm: '关联算法与状态',
    limits: '≤20 MiB · 每边≤8192 · ≤1677万像素', contract: '像素 xywh、score、classId；最多32框，不自动检测。', privacy: '图片仅本机处理，不上传。仅下载模型；清理按钮清除此 SDK 的全部模型缓存（当前仅一个模型）。',
    state: '同尺寸换图保留轨迹；尺寸变化请先复位。每成功帧推进100 ms，失败/取消不推进。切换来源或后端会复位并释放模型。',
    modelInfo: '人体 ReID · FP32 / ONNX opset17 · 512维 · 33,704,835 bytes · 参数量未核实。采用官方仓库 Apache-2.0 作为权重转换分发依据，训练披露限制见模型卡。',
    algorithmInfo: 'DeepSORT 独立实现 · Apache-2.0 · 像素框+模型向量→轨迹/状态。关联始终 CPU/main；ID 不等于人的身份。',
    timing: '毫秒；加载、图像解码、模型提取、CPU关联分开计时。冷启动=新实例首次加载/首帧；热运行=复用模型和轨迹。',
    verified: '2026-09-21 本机 Chromium 153 / Windows 11：双源 WASM/WebGPU 通过；其他浏览器、移动设备未验证。',
    errorHelp: '检查图像、JSON、网络及所选后端。IMAGE_SIZE_CHANGED：先复位轨迹。', local: '本地候选 0.2.0-alpha.0 · 线上 npm 0.1.0',
  },
  en: {
    controls: 'Image + detections', image: 'Choose image', source: 'Model source', backend: 'Model backend', boxes: 'Person detections for this frame (JSON)', run: 'Extract & track', cancel: 'Cancel', reset: 'Reset tracks', clear: 'Clear model', cache: 'Model cache', estimate: 'Refresh usage',
    ready: 'Ready', loading: 'Loading model', running: 'Extracting', success: 'Processed', error: 'Failed', decoding: 'Decoding image', cancelled: 'Cancelled', clearing: 'Releasing & clearing',
    preview: 'Image & tracks', empty: 'Choose an image and enter caller-provided person boxes', tracks: 'Active tracks', frame: 'Successful frames', model: 'Current model', runtime: 'Runtime & layered timings', algorithm: 'Association & state',
    limits: '≤20 MiB · each side ≤8192 · ≤16,777,216 pixels', contract: 'Pixel xywh, score, classId; up to 32 boxes. No automatic detection.', privacy: 'Images stay local. Only the model is downloaded. Clear removes all model caches for this SDK (one current model).',
    state: 'Same-size images preserve tracks; reset before changing dimensions. Successful frames advance by 100 ms; failure/cancel does not. Source/backend changes reset tracks and release the model.',
    modelInfo: 'Person ReID · FP32 / ONNX opset17 · 512D · 33,704,835 bytes · parameter count unverified. Distribution relies on the official repository Apache-2.0 license; see model card for training disclosure limits.',
    algorithmInfo: 'Independent DeepSORT · Apache-2.0 · pixel boxes + model vectors → tracks/states. Association always CPU/main; track IDs are not personal identities.',
    timing: 'Milliseconds; load, image decode, extraction and CPU association are separate. Cold = new-instance load/first frame; warm = reused model and tracks.',
    verified: '2026-09-21 local Chromium 153 / Windows 11: both sources on WASM/WebGPU passed. Other browsers and mobile devices unverified.',
    errorHelp: 'Check image, JSON, network and backend. IMAGE_SIZE_CHANGED: reset tracks first.', local: 'Local candidate 0.2.0-alpha.0 · npm 0.1.0',
  },
};
type Status = 'ready' | 'loading' | 'running' | 'success' | 'error' | 'decoding' | 'cancelled' | 'clearing';
const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'INVALID_INPUT';

export default function ReIdWorkspace({ language }: { language: 'zh' | 'en' }) {
  const t = copy[language];
  const [, render] = useState(0);
  const mounted = useRef(true);
  const request = useRef(0);
  const refresh = () => { if (mounted.current) render(value => value + 1); };
  const [controller] = useState(() => new ReIdController({ create: (source, backend) => createReIdExtractor({ modelId: 'pplcnet-reid-fp32', source, backend }), clear: clearReIdCache }, refresh));
  const [images] = useState(() => new ImageSelection({ decode: decodeImage, url: URL.createObjectURL, revoke: URL.revokeObjectURL }));
  const [status, setStatus] = useState<Status>('ready');
  const [error, setError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState('[]');
  const [reading, setReading] = useState(false);
  const [decodeMs, setDecodeMs] = useState(0);
  const [cache, setCache] = useState<number | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [previewResult, setPreviewResult] = useState(false);
  const image = images.current;
  const result = controller.tracking;
  const locked = controller.busy || reading;
  const modelSource = getReIdModelSource(controller.source);
  useEffect(() => () => { mounted.current = false; request.current++; images.dispose(); void controller.dispose(); }, [controller, images]);
  async function usage() {
    setCacheBusy(true);
    try { const info = await estimateReIdCache(); if (mounted.current) setCache(info.bytes); }
    catch { if (mounted.current) setCache(null); }
    finally { if (mounted.current) setCacheBusy(false); }
  }
  async function select(file?: File) {
    if (!file) return;
    const id = ++request.current; controller.cancel(); setReading(true); setStatus('decoding'); setError(null);
    const start = performance.now();
    try {
      const accepted = await images.select(file);
      if (mounted.current && id === request.current && accepted) { setDecodeMs(performance.now() - start); setPreviewResult(false); setStatus('ready'); refresh(); }
    } catch (error) { if (mounted.current && id === request.current) { setError(errorCode(error)); setStatus('error'); } }
    finally { if (mounted.current && id === request.current) setReading(false); }
  }
  async function action(kind: 'run' | 'reset' | 'clear' | 'configure', source = controller.source, backend = controller.backend) {
    const id = ++request.current; setError(null);
    try {
      if (kind === 'run') {
        if (!image) return;
        const detections: unknown = JSON.parse(boxes);
        if (!Array.isArray(detections) || detections.length > 32) throw new Error('INVALID_INPUT');
        const previous = controller.frameCount;
        setStatus(controller.loadResult ? 'running' : 'loading');
        await controller.run(image.image, detections);
        if (id === request.current && mounted.current) { setStatus(controller.frameCount > previous ? 'success' : 'cancelled'); setPreviewResult(controller.frameCount > previous); }
      } else {
        setTransitioning(true); images.cancel(); setReading(false); setStatus(kind === 'clear' ? 'clearing' : 'ready');
        if (kind === 'clear') await controller.clear();
        else if (kind === 'reset') await controller.reset();
        else await controller.configure(source, backend);
        if (mounted.current && id === request.current) { setPreviewResult(false); setStatus('ready'); }
      }
      if (mounted.current && id === request.current) await usage();
    } catch (error) { if (mounted.current && id === request.current) { setError(errorCode(error)); setStatus('error'); } }
    finally { if (mounted.current && kind !== 'run') setTransitioning(false); refresh(); }
  }
  function cancel() { request.current++; images.cancel(); controller.cancel(); setReading(false); setStatus('cancelled'); }
  return <main className="reid-workspace">
    <aside className="panel controls"><h2>{t.controls}</h2>
      <label htmlFor="reid-source">{t.source}</label><select id="reid-source" value={controller.source} disabled={transitioning} onChange={event => void action('configure', event.target.value as typeof controller.source)}><option value="modelscope">ModelScope</option><option value="huggingface">Hugging Face</option></select>
      <label htmlFor="reid-backend">{t.backend}</label><select id="reid-backend" value={controller.backend} disabled={transitioning} onChange={event => void action('configure', controller.source, event.target.value as typeof controller.backend)}><option value="wasm">CPU (WASM)</option><option value="webgpu">GPU (WebGPU)</option></select>
      <label className="file-button">{t.image}<input data-testid="reid-image" type="file" accept="image/*" disabled={controller.busy} onChange={event => { void select(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <p className="muted small">{t.limits}</p>
      <label htmlFor="reid-boxes">{t.boxes}</label><textarea id="reid-boxes" value={boxes} disabled={locked} onChange={event => setBoxes(event.target.value)} spellCheck={false} placeholder={'[{"box":{"x":0,"y":0,"width":80,"height":160},"score":0.9,"classId":0}]'} />
      <p className="muted small">{t.contract}</p>
      <div className="buttons"><button className="primary" data-testid="reid-run" disabled={locked || !image} onClick={() => void action('run')}>{t.run}</button><button data-testid="reid-cancel" disabled={!locked || transitioning} onClick={cancel}>{t.cancel}</button><button data-testid="reid-reset" disabled={transitioning} data-sdk-state-reset onClick={() => void action('reset')}>{t.reset}</button></div>
      <div data-sdk-cache-clear="all"><button className="export" data-testid="reid-clear" data-sdk-cache-clear="current" disabled={transitioning || cacheBusy} onClick={() => void action('clear')}>{t.clear}</button></div>
      <p className="muted small">{t.cache}: {cache === null ? '—' : `${(cache / 1048576).toFixed(2)} MiB`} <button className="compact" disabled={cacheBusy || locked} onClick={() => void usage()}>{t.estimate}</button></p>
      <p className="privacy">{t.privacy}</p>
    </aside>
    <section className="panel workspace"><div className="section-title"><h2>{t.preview}</h2><span className="runtime-chip">ReID: {controller.backend === 'wasm' ? 'CPU (WASM)' : 'GPU (WebGPU)'} · DeepSORT: CPU</span></div>
      <div className="status" role="status" data-state={status}><span>{t[status]}</span><span data-testid="reid-frame">{t.frame}: {controller.frameCount} · {result?.timestampMs ?? '—'} ms</span></div>
      {controller.busy && controller.progress && <p className="load-progress">{controller.progress.stage} · {controller.progress.status} {controller.progress.loaded !== undefined ? `${(controller.progress.loaded / 1048576).toFixed(1)} / ${((controller.progress.total ?? 0) / 1048576).toFixed(1)} MiB` : ''}</p>}
      {error && <div role="alert" className="error"><b>{error}</b> · {t.errorHelp}</div>}
      {image ? <svg className="stage reid-stage" viewBox={`0 0 ${image.image.width} ${image.image.height}`} role="img" aria-label={t.preview}>
        <image href={image.url} width={image.image.width} height={image.image.height} />
        {previewResult && result?.tracks.map(track => <g key={track.id} data-track-state={track.state} stroke="var(--action)"><rect {...track.box} fill="none" strokeWidth={image.image.width / 220} /><text x={track.box.x} y={Math.max(image.image.height / 20, track.box.y)} fontSize={image.image.width / 30} fill="var(--action)" stroke="none">#{track.id}</text></g>)}
      </svg> : <div className="image-empty">{t.empty}</div>}
    </section>
    <aside className="panel results"><h2>{t.tracks}<span>{result?.tracks.length ?? 0}</span></h2><div className="track-list">{result?.tracks.map(track => <article className="track" key={track.id}><div><b>#{track.id}</b><span>{track.state}</span></div><p>{track.classId} · {track.score?.toFixed(2)} · {track.hits} hits</p></article>)}</div><p className="muted small">{t.state}</p></aside>
    <section className="details">
      <details data-sdk-runtime-info><summary>{t.runtime}</summary><p>ReID: requestedBackend={controller.backend} · actualBackend={controller.model?.runtime.actualBackend ?? controller.loadResult?.runtime.actualBackend ?? '—'} · main · ORT {controller.loadResult?.runtime.ortVersion ?? '1.27.0'}<br />DeepSORT: requestedBackend=cpu · actualBackend=cpu · main</p>
        <div data-sdk-timing>{[[language === 'zh' ? '加载' : 'Load', controller.loadResult?.timings], [language === 'zh' ? '图像解码' : 'Image decode', { decodeMs }], [language === 'zh' ? '模型提取' : 'Extraction', controller.model?.timings], ['CPU DeepSORT', result?.timings]].map(([label, timings]) => <div key={String(label)}><b>{String(label)}</b><dl>{Object.entries(timings ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Number(value).toFixed(2)} ms</dd></div>)}</dl></div>)}</div><p>{t.timing}</p><p>{t.verified}</p>
      </details>
      <details data-sdk-model-info><summary>{t.model} · PP-LCNet ReID</summary><p>{t.modelInfo}</p><p>{t.local}</p><a href={modelSource.downloadUrl} target="_blank" rel="noreferrer">{modelSource.kind} · {modelSource.revision}</a><p>SHA256: {modelSource.sha256}</p></details>
      <details data-sdk-algorithm-info><summary>{t.algorithm}</summary><p>{t.algorithmInfo}</p><a href="https://arxiv.org/abs/1703.07402" target="_blank" rel="noreferrer">Deep SORT</a><p>{t.state}</p></details>
    </section>
  </main>;
}
