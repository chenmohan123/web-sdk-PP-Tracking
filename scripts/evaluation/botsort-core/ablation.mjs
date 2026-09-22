// 仅定位09退步：固定检测、阈值与原矩阵，比较恒等/平移/完整仿射；不读取GT调参。
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createBoTSortTracker } from '../../../.tmp/botsort-core/build/index.js';
import { adaptDetections, parseSequenceInfo, exportMot } from '../mot17/adapter.mjs';
import { hashFile } from '../mot17-reid/io.mjs';
import { candidateFrame } from './adapter.mjs';
const name='MOT17-09-FRCNN',out='.tmp/botsort-core/ablation-verified';
const parent=JSON.parse(await readFile('.tmp/botsort-core/run/summary.json','utf8'));
const candidateSha256=await hashFile('.tmp/botsort-core/build/index.js');
assert.equal(candidateSha256,parent.hashes.candidate,'消融候选必须与主评测相同');
await mkdir(out);
const root='.tmp/mot17-ocsort-c036be8/input/'+name;
for(const file of ['seqinfo.ini','det/det.txt'])assert.equal(await hashFile(root+'/'+file),parent.inputs[name][file].sha256);
const motionPath='.tmp/botsort-feasibility/motion/'+name+'.jsonl';assert.equal(await hashFile(motionPath),parent.sequences[name].motionSha256);
const motion=(await readFile(motionPath,'utf8')).trim().split('\n').map(JSON.parse);
const sequence=adaptDetections(await readFile(root+'/det/det.txt','utf8'),parseSequenceInfo(await readFile(root+'/seqinfo.ini','utf8')));
const results={},configurations={};
for(const mode of ['identity','translation','full']) {
  const options=parent.configurations.cmc;configurations[mode]=options;
  const tracker=createBoTSortTracker(options);let previous=null,mot='',lostFrames=0,maxLostWidth=0;
  for(let i=0;i<sequence.frames.length;i++) {
    const frame=candidateFrame(sequence.frames[i],motion[i],previous,false,mode);
    const result=tracker.update(frame);assert.equal(result.droppedDetections,0);mot+=exportMot(i+1,result);previous=frame;
    for(const track of result.tracks)if(track.state==='lost'){lostFrames++;maxLostWidth=Math.max(maxLostWidth,track.box.width);}
  }
  tracker.dispose();const motSha256=createHash('sha256').update(mot).digest('hex');
  if(mode!=='translation')assert.equal(motSha256,parent.sequences[name].results[mode==='full'?'cmc':'identity'][0].motSha256);
  await mkdir(`${out}/trackers/${mode}/data`,{recursive:true});await writeFile(`${out}/trackers/${mode}/data/${name}.txt`,mot);
  results[mode]=[{motSha256,lostTrackFrames:lostFrames,maxLostWidth}];
}
const percentile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
const estimated=motion.filter(row=>row.status==='estimated');
const stats={};
for(const [key,values] of Object.entries({translationPx:estimated.map(row=>Math.hypot(row.matrix[2],row.matrix[5])),absoluteRotationDegrees:estimated.map(row=>Math.abs(Math.atan2(row.matrix[3]-row.matrix[1],row.matrix[0]+row.matrix[4])*180/Math.PI)),scale:estimated.map(row=>Math.sqrt(row.matrix[0]*row.matrix[4]-row.matrix[1]*row.matrix[3]))}))stats[key]={min:Math.min(...values),p50:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values)};
const summary={testedAt:new Date().toISOString(),complete:true,configurations,inputs:{[name]:parent.inputs[name]},sequences:{[name]:{frames:sequence.frames.length,results}},motionSha256:parent.sequences[name].motionSha256,candidateSha256,diagnostics:{estimated:estimated.length,stats},scope:'仅09冻结参数消融；不能按结果选择新默认或归因单个真实运动误差'};
await writeFile(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary.diagnostics,null,2));
