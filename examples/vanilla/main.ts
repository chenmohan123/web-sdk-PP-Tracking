import { createTracker } from 'web-sdk-pp-tracking';

const tracker = createTracker();
let frame = 0;
const result = document.querySelector<HTMLPreElement>('#result')!;
document.querySelector<HTMLButtonElement>('#step')!.onclick = () => {
  const output = tracker.update({ timestampMs: frame * 100, imageSize: { width: 640, height: 360 }, detections: [{ box: { x: 20 + frame % 40 * 8, y: 100, width: 60, height: 80 }, score: frame % 10 === 5 ? 0.25 : 0.9, classId: 0 }] });
  frame++;
  result.textContent = JSON.stringify(output, null, 2);
};
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => { tracker.reset(); frame = 0; result.textContent = '就绪 / Ready'; };
window.addEventListener('pagehide', () => tracker.dispose(), { once: true });
