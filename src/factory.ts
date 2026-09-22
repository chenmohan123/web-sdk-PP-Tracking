import { createBoTSortTracker } from './botsort/index.js';
import { createTracker as createCoreTracker } from './tracker.js';
import type { AnyTrackerOptions, BoTSortTrackerOptions, Tracker, TrackerOptions } from './types.js';
import type { BoTSortTracker } from './botsort/types.js';

export function createTracker(options: BoTSortTrackerOptions): BoTSortTracker;
export function createTracker(options?: TrackerOptions): Tracker;
export function createTracker(options: AnyTrackerOptions): Tracker | BoTSortTracker;
export function createTracker(options: AnyTrackerOptions = {}): Tracker | BoTSortTracker {
  const isPlainObject = options !== null && typeof options === 'object' && !Array.isArray(options) && Object.getPrototypeOf(options) === Object.prototype;
  if (isPlainObject && 'algorithm' in options && options.algorithm === 'botsort') {
    const botsort: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(options)) {
      if (typeof key !== 'string') return createCoreTracker(options as unknown as TrackerOptions);
      if (key !== 'algorithm') Object.defineProperty(botsort, key, { value: (options as unknown as Record<string, unknown>)[key], enumerable: true, configurable: true, writable: true });
    }
    return createBoTSortTracker(botsort as unknown as BoTSortTrackerOptions);
  }
  return createCoreTracker(options as TrackerOptions);
}
