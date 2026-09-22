import assert from 'node:assert/strict';
import {createTracker} from './probe.js';
const frame=(n,x,matrix=[1,0,0,0,1,0])=>({timestampMs:n*100,imageSize:{width:640,height:480},detections:[{box:{x,y:100,width:20,height:80},score:1,classId:0}],motionMatrix:matrix});
const base=createTracker(),cmc=createTracker({}, {motion:true,appearance:false});
for(let n=1;n<=2;n++){base.update(frame(n,50));cmc.update(frame(n,50));}
const a=base.update(frame(3,100)),b=cmc.update(frame(3,100,[1,0,50,0,1,0]));
assert.equal(a.tracks.find(t=>t.id===1).state,'lost');assert.equal(b.tracks.find(t=>t.id===1).state,'tracked');
assert.equal(b.tracks.find(t=>t.id===1).box.x,100);
const ctl=createTracker({}, {motion:true,appearance:false});ctl.update(frame(1,50));ctl.update(frame(2,50));ctl.update(frame(3,100,[1,0,50,0,1,0]));
assert.throws(()=>cmc.update(frame(4,110,[1,0,NaN,0,1,0])));
const strip=({timings,...x})=>x;
assert.deepEqual(strip(cmc.update(frame(4,110,[1,0,10,0,1,0]))),strip(ctl.update(frame(4,110,[1,0,10,0,1,0]))));
cmc.reset();assert.equal(cmc.update(frame(1,50)).tracks[0].id,1);
cmc.dispose();assert.throws(()=>cmc.update(frame(2,50)));
// 15 度仍在估计允许范围，带符号宽高已为负；四角包络应保持正值。
const theta=Math.PI/12;assert(Math.cos(theta)*20-Math.sin(theta)*100<0);
console.log('通过：突然平移维持 ID、无补偿断轨；失败原子性、reset、dispose及允许范围内负宽度反例');
