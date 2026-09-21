import { TrackingError } from './errors.js';
import { correct, predict, type GaussianState } from './kalman.js';
import type { Box } from './types.js';

export interface Observation {
  timestampMs: number;
  box: Box;
  score: number;
}
type Point = [number, number];
type Segment = [Point, Point];

const centre = (box: Box): Point => [box.x + box.width / 2, box.y + box.height / 2];

export function observationCentres(first: Box, second: Box): Segment {
  return [centre(first), centre(second)];
}

function direction(segment: Segment): number | null {
  const dx = segment[1][0] - segment[0][0];
  const dy = segment[1][1] - segment[0][1];
  return dx === 0 && dy === 0 ? null : Math.atan2(dy, dx);
}

export function directionDifferenceRadians(track: Segment, intention: Segment): number {
  const trackDirection = direction(track);
  const intentionDirection = direction(intention);
  if (trackDirection === null || intentionDirection === null) return 0;
  const difference = Math.abs(trackDirection - intentionDirection);
  return Math.min(difference, Math.PI * 2 - difference);
}

export function ocmAssociationScore(iouValue: number, angleRadians: number, weight: number): number {
  return iouValue - weight * angleRadians / Math.PI;
}

export function ocmScoreFromHistory(
  iouValue: number,
  history: readonly Observation[],
  detection: Box,
  weight: number,
  deltaMs: number,
): number {
  if (history.length < 2) return iouValue;
  const latest = history[history.length - 1];
  const prior = [...history].reverse().slice(1).find(item => latest.timestampMs - item.timestampMs >= deltaMs);
  if (!prior) return iouValue;
  const trackDirection = observationCentres(prior.box, latest.box);
  const intentionDirection = observationCentres(latest.box, detection);
  return ocmAssociationScore(iouValue, directionDifferenceRadians(trackDirection, intentionDirection), weight);
}

export function interpolateObservationBox(start: Box, end: Box, timestampMs: number, startMs: number, endMs: number): Box {
  if (endMs <= startMs || timestampMs <= startMs) return { ...start };
  if (timestampMs >= endMs) return { ...end };
  const ratio = (timestampMs - startMs) / (endMs - startMs);
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
    width: start.width + (end.width - start.width) * ratio,
    height: start.height + (end.height - start.height) * ratio,
  };
}

const measurement = (box: Box): number[] => [box.x + box.width / 2, box.y + box.height / 2, box.width, box.height];

export function replayObservationFilter(
  initial: GaussianState,
  start: Observation,
  current: Observation,
  missingTimestamps: readonly number[],
  maxReplaySteps: number,
): GaussianState {
  if (missingTimestamps.length > maxReplaySteps) throw new TrackingError('NUMERICAL_FAILURE', 'OC-SORT 缺失重放超过上限');
  let state: GaussianState = { mean: [...initial.mean], covariance: initial.covariance.map(row => [...row]) };
  let previousMs = start.timestampMs;
  for (const timestampMs of missingTimestamps) {
    if (!(timestampMs > previousMs && timestampMs < current.timestampMs)) throw new TrackingError('NUMERICAL_FAILURE', 'OC-SORT 缺失时间戳顺序非法');
    state = predict(state, (timestampMs - previousMs) / 1000);
    state = correct(state, measurement(interpolateObservationBox(start.box, current.box, timestampMs, start.timestampMs, current.timestampMs)));
    previousMs = timestampMs;
  }
  state = predict(state, (current.timestampMs - previousMs) / 1000);
  return correct(state, measurement(current.box));
}
