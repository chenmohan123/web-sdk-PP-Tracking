const commonOptionNames = [
  'highScoreThreshold',
  'newTrackThreshold',
  'minHits',
  'matchIouThreshold',
  'maxLostMs',
  'largeGapMs',
  'maxDetections',
  'maxTracks',
];

export function selectEvaluationMode(input, defaultOptions) {
  const mode = input ?? 'historical';
  if (mode === 'historical') {
    return {
      mode,
      configurations: {
        default: { ...defaultOptions },
        'no-low': { ...defaultOptions, lowScoreThreshold: defaultOptions.highScoreThreshold },
      },
    };
  }
  if (mode === 'algorithms') {
    const common = Object.fromEntries(commonOptionNames.map(name => [name, defaultOptions[name]]));
    return {
      mode,
      configurations: {
        bytetrack: { ...defaultOptions, algorithm: 'bytetrack' },
        ocsort: { algorithm: 'ocsort', ...common },
      },
    };
  }
  throw new Error(`未知评测模式：${mode}`);
}
