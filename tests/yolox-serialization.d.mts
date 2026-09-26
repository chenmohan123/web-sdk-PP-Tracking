export interface YoloxSerializationResult {
  droppedDetections: number;
  detections: Array<{
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    score: number;
    classId: number;
  }>;
}

interface TrackingSerializationTrack {
  id: number;
  classId: number;
  state: 'tentative' | 'tracked' | 'lost' | 'removed';
  observed: boolean;
  score: number | null;
  ageMs: number;
  hits: number;
  missedMs: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TrackingSerializationResult {
  generation: number;
  algorithm: string;
  timestampMs: number;
  droppedDetections: number;
  tracks: TrackingSerializationTrack[];
  removed: TrackingSerializationTrack[];
}

export function serializeYoloxDetections(
  result: YoloxSerializationResult,
): string;

export function serializeYoloxDetectionsUnordered(
  result: YoloxSerializationResult,
): string;

export function serializeTrackingResult(
  result: TrackingSerializationResult,
): string;
