import { createTracker, type TrackerOptions, type TrackingFrame, type TrackingResult } from 'web-sdk-pp-tracking';

export class Playback {
  private tracker = createTracker();
  index = -1;
  results: TrackingResult[] = [];
  startedAt: string | null = null;
  options: TrackerOptions = {};
  constructor(public frames: TrackingFrame[]) {}
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
    this.tracker.dispose(); this.tracker = next; this.options = { ...options };
    this.index = -1; this.results = []; this.startedAt = null;
  }
  seek(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= this.frames.length) throw new Error('INVALID_SEEK');
    this.reset();
    while (this.index < index) this.step();
  }
  dispose() { this.tracker.dispose(); }
}
