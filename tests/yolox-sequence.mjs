const WIDTH = 320;
const HEIGHT = 240;

const PHASES = [
  {
    id: 'motion-start',
    timestampMs: 0,
    events: ['motion'],
    blocks: [
      { x: 36, y: 72, width: 52, height: 96, color: [236, 72, 58, 255] },
      { x: 232, y: 84, width: 44, height: 84, color: [52, 126, 232, 255] },
    ],
  },
  {
    id: 'motion-approach',
    timestampMs: 100,
    events: ['motion'],
    blocks: [
      { x: 76, y: 72, width: 52, height: 96, color: [236, 72, 58, 255] },
      { x: 192, y: 84, width: 44, height: 84, color: [52, 126, 232, 255] },
    ],
  },
  {
    id: 'crossing',
    timestampMs: 200,
    events: ['crossing'],
    blocks: [
      { x: 132, y: 72, width: 52, height: 96, color: [236, 72, 58, 224] },
      { x: 140, y: 84, width: 44, height: 84, color: [52, 126, 232, 224] },
    ],
  },
  {
    id: 'occlusion',
    timestampMs: 300,
    events: ['occlusion'],
    blocks: [
      { x: 112, y: 84, width: 44, height: 84, color: [52, 126, 232, 255] },
    ],
  },
  {
    id: 'reappearance',
    timestampMs: 400,
    events: ['reappearance'],
    blocks: [
      { x: 212, y: 72, width: 52, height: 96, color: [236, 72, 58, 255] },
      { x: 60, y: 84, width: 44, height: 84, color: [52, 126, 232, 255] },
    ],
  },
  {
    id: 'long-loss',
    timestampMs: 2601,
    events: ['long-loss'],
    blocks: [],
  },
  {
    id: 'sparse-resume',
    timestampMs: 5002,
    events: ['sparse-timestamp', 'reappearance'],
    blocks: [
      { x: 92, y: 68, width: 52, height: 96, color: [236, 72, 58, 255] },
      { x: 188, y: 88, width: 44, height: 84, color: [52, 126, 232, 255] },
    ],
  },
];

function createBackground(frameIndex) {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      data[offset] = 18 + ((x * 3 + y * 5 + frameIndex * 11) % 38);
      data[offset + 1] = 24 + ((x * 7 + y * 2 + frameIndex * 13) % 42);
      data[offset + 2] = 30 + ((x * 2 + y * 9 + frameIndex * 17) % 46);
      data[offset + 3] = 255;
    }
  }
  return data;
}

function drawBlock(data, block) {
  const [red, green, blue, alpha] = block.color;
  for (let y = block.y; y < block.y + block.height; y += 1) {
    for (let x = block.x; x < block.x + block.width; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = alpha;
    }
  }
}

export function createYoloxSyntheticSequence() {
  return PHASES.map((phase, frameIndex) => {
    const data = createBackground(frameIndex);
    for (const block of phase.blocks) drawBlock(data, block);
    return {
      id: phase.id,
      timestampMs: phase.timestampMs,
      events: [...phase.events],
      image: { width: WIDTH, height: HEIGHT, data },
    };
  });
}
