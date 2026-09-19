import { createTracker, type FeatureSpace, type TrackerOptions, type TrackingFrame, type TrackingResult } from 'web-sdk-pp-tracking';
import { DEMO_DEFAULT_OPTIONS, SYNTHETIC_FEATURE_SPACE, type PreparedSequence } from './data';

const cloneOptions = (options: TrackerOptions): TrackerOptions => ({
  ...options,
  ...(options.featureSpace ? { featureSpace: { ...options.featureSpace } } : {}),
});

export class Playback {
  private tracker;
  index = -1;
  results: TrackingResult[] = [];
  startedAt: string | null = null;
  options: TrackerOptions;
  featureSpace: FeatureSpace | undefined = { ...SYNTHETIC_FEATURE_SPACE };
  constructor(public frames: TrackingFrame[], options: TrackerOptions = DEMO_DEFAULT_OPTIONS.bytetrack) {
    this.options = cloneOptions(options);
    this.tracker = createTracker(this.options);
  }
  step() {
    if (this.index + 1 >= this.frames.length) return;
    const result = this.tracker.update(this.frames[this.index + 1]);
    this.startedAt ??= new Date().toISOString();
    this.index++;
    this.results.push(result);
  }
  reset() { this.tracker.reset(); this.index = -1; this.results = []; this.startedAt = null; }
  configure(options: TrackerOptions) {
    const next = createTracker(options);
    this.tracker.dispose(); this.tracker = next; this.options = cloneOptions(options);
    if (options.featureSpace) this.featureSpace = { ...options.featureSpace };
    this.index = -1; this.results = []; this.startedAt = null;
  }
  replace(prepared: PreparedSequence) {
    const next = createTracker(prepared.options);
    this.tracker.dispose();
    this.tracker = next;
    this.frames = prepared.frames;
    this.options = cloneOptions(prepared.options);
    this.featureSpace = prepared.featureSpace ? { ...prepared.featureSpace } : undefined;
    this.index = -1; this.results = []; this.startedAt = null;
  }
  seek(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= this.frames.length) throw new Error('INVALID_SEEK');
    this.reset();
    while (this.index < index) this.step();
  }
  dispose() { this.tracker.dispose(); }
}
