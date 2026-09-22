// 探针只从本项目固定源码复制到忽略目录，插入局部钩子；不修改 src/dist 或 npm。
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const root='.tmp/botsort-feasibility';
await mkdir(root+'/code',{recursive:true});
const files=['tracker.ts','assignment.ts','deepsort.ts','ocsort.ts','kalman.ts','types.ts','errors.ts'];
const hashes={};
for(const f of files){const text=await readFile('src/'+f);hashes[f]=createHash('sha256').update(text).digest('hex');await copyFile('src/'+f,root+'/code/'+f);}
let source=await readFile(root+'/code/tracker.ts','utf8');
function replace(from,to){if(source.split(from).length!==2)throw Error('探针基线钩子不唯一');source=source.replace(from,to);}
replace("export function createTracker(input: TrackerOptions = {}): Tracker {","export function createTracker(input: TrackerOptions = {}, probe = {motion: false, appearance: false}): Tracker {");
replace("  const options = parseOptions(input);","  const options = parseOptions(input);");
replace("      const frame = validateFrame(inputFrame, timestamp, size, options);",`      const frame = validateFrame(inputFrame, timestamp, size, options);
      const matrix = probe.motion ? ((inputFrame as any).motionMatrix ?? [1,0,0,0,1,0]) : [1,0,0,0,1,0];
      if (probe.appearance) for (let i=0;i<frame.detections.length;i++) frame.detections[i].embedding=normalizeEmbedding(inputFrame.detections[i].embedding,512);`);
replace("      for (const entry of working) entry.filter = predict(entry.filter, dt);","      for (const entry of working) entry.filter = compensate(predict(entry.filter, dt), matrix);");
replace("threshold: number, recovery = false) => {","threshold: number, recovery = false, appearance = true) => {");
replace("          const rawValue = raw[row][column];",`          const rawValue = raw[row][column];
          if (probe.appearance && appearance && detection.score >= options.highScoreThreshold && rawValue >= 0.5 && entry.gallery.length) {
            const distance = minimumCosineDistance(detection.embedding!, entry.gallery);
            if (distance <= 0.25) return Math.max(rawValue,1-distance/2);
          }`);
replace("      const tracks = working.map(entry => snapshot(entry, time));",`      if (probe.appearance) for (const entry of working) {
        const d=matches.get(entry);
        if (d && d.score>=options.highScoreThreshold) entry.gallery=[entry.gallery.length ? normalizeEmbedding(entry.gallery[0].map((x,i)=>0.9*x+0.1*d.embedding![i]),512) : [...d.embedding!]];
      }
      const tracks = working.map(entry => snapshot(entry, time));`);
replace("gallery: options.algorithm === 'deepsort' ? [[...detection.embedding!]] : [],","gallery: options.algorithm === 'deepsort' || probe.appearance ? [[...detection.embedding!]] : [],");
source="import {compensate} from '../compensate.mjs';\n"+source;
await writeFile(root+'/code/tracker.ts',source);
await build({entryPoints:[root+'/code/tracker.ts'],bundle:true,platform:'browser',format:'esm',outfile:root+'/probe.js'});
await writeFile(root+'/baseline-hashes.json',JSON.stringify(hashes,null,2));
console.log('构建一次性 CMC / CMC+外观探针，src 与 dist 保持原样');
