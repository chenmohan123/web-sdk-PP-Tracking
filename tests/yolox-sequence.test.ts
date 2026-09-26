import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createYoloxSyntheticSequence } from './yolox-sequence.mjs';

const hash = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

describe('createYoloxSyntheticSequence', () => {
  it('creates isolated deterministic frames covering the tracking stress phases', () => {
    const sequence = createYoloxSyntheticSequence();

    expect(sequence.map(frame => frame.id)).toEqual([
      'motion-start',
      'motion-approach',
      'crossing',
      'occlusion',
      'reappearance',
      'long-loss',
      'sparse-resume',
    ]);
    expect(sequence.map(frame => frame.timestampMs)).toEqual([
      0,
      100,
      200,
      300,
      400,
      2601,
      5002,
    ]);
    expect(new Set(sequence.flatMap(frame => frame.events))).toEqual(
      new Set([
        'motion',
        'crossing',
        'occlusion',
        'reappearance',
        'long-loss',
        'sparse-timestamp',
      ]),
    );
    expect(
      sequence.every(
        frame =>
          frame.image.width === 320 &&
          frame.image.height === 240 &&
          frame.image.data.byteLength === 320 * 240 * 4,
      ),
    ).toBe(true);
    expect(new Set(sequence.map(frame => hash(frame.image.data))).size).toBe(
      sequence.length,
    );

    const second = createYoloxSyntheticSequence();
    sequence[0].image.data[0] ^= 0xff;
    expect(hash(sequence[0].image.data)).not.toBe(hash(second[0].image.data));
    expect(sequence[1].image.data).not.toBe(sequence[0].image.data);
  });
});
