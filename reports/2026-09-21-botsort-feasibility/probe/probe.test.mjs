import assert from 'node:assert/strict';
import { compensate } from './compensate.mjs';
const base={mean:[50,80,20,100,3,4,1,2],covariance:Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>+(i===j)))};
assert.deepEqual(compensate(base,[1,0,0,0,1,0]),base);
assert.deepEqual(compensate(base,[1,0,12,0,1,-8]).mean,[62,72,20,100,3,4,1,2]);
const turned=compensate(base,[0,-1,0,1,0,0]);
assert.deepEqual(turned.mean,[-80,50,100,20,-4,3,2,1]);
assert.deepEqual(turned.covariance,base.covariance);
const scale=compensate(base,[2,0,0,0,2,0]);
assert.equal(scale.covariance[0][0],4);
for(const bad of [[1,0,0,0,NaN,0],[0,0,0,0,0,0],[1,2]])assert.throws(()=>compensate(base,bad));
const shear=compensate(base,[1,.2,5,-.1,1,6]);
for(let k=0;k<40;k++){
  const z=Array.from({length:8},(_,i)=>Math.sin(i+k));
  const q=z.reduce((s,x,i)=>s+x*shear.covariance[i].reduce((t,p,j)=>t+p*z[j],0),0);
  assert(q>=-1e-12);
}
// 论文将同一带符号 M 用于宽高：此处会产生 -100 宽；原图轴对齐框契约需要四角包络。
assert.equal(0*base.mean[2]-base.mean[3],-100);
console.log('通过：identity/平移/旋转四角包络/尺度协方差/非法矩阵/PSD；记录论文带符号宽高反例');
