import { createTracker, type AnyTrackerOptions, type BoTSortFrame, type BoTSortResult, type FeatureSpace, type TrackingResult } from 'web-sdk-pp-tracking';
import { DEMO_DEFAULT_OPTIONS, SYNTHETIC_FEATURE_SPACE, type DemoFrame, type PreparedSequence } from './data';

const cloneOptions = (options: AnyTrackerOptions): AnyTrackerOptions => structuredClone(options);

export class Playback {
  private tracker;
  index = -1;
  results: (TrackingResult | BoTSortResult)[] = [];
  startedAt: string | null = null;
  options: AnyTrackerOptions;
  featureSpace: FeatureSpace | undefined = { ...SYNTHETIC_FEATURE_SPACE };
  constructor(public frames: DemoFrame[], options: AnyTrackerOptions = DEMO_DEFAULT_OPTIONS.bytetrack) {
    this.options = cloneOptions(options);
    this.tracker = createTracker(this.options);
  }
  step() {
    if (this.index + 1 >= this.frames.length) return;
    const result = this.tracker.update(this.frames[this.index + 1] as BoTSortFrame);
    this.startedAt ??= new Date().toISOString();
    this.index++;
    this.results.push(result);
  }
  reset() { this.tracker.reset(); this.index = -1; this.results = []; this.startedAt = null; }
  configure(options: AnyTrackerOptions) {
    const next = createTracker(options);
    this.tracker.dispose(); this.tracker = next; this.options = cloneOptions(options);
    const featureSpace = options.algorithm === 'botsort' ? options.appearance?.featureSpace : options.featureSpace;
    if (featureSpace) this.featureSpace = { ...featureSpace };
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
