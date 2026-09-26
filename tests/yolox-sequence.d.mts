export interface YoloxSyntheticFrame {
  id: string;
  timestampMs: number;
  events: string[];
  image: {
    width: number;
    height: number;
    data: Uint8Array;
  };
}

export function createYoloxSyntheticSequence(): YoloxSyntheticFrame[];
