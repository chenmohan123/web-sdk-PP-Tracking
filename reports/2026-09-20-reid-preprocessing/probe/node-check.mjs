// Node 用相同契约执行全部图像样本，与独立 Python 参考逐元素对照。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { preprocessRgba } from './preprocess.mjs';
const work=resolve(process.argv[2]??'.tmp/reid-preprocessing-20260920');
const assets=join(work,'assets');
const fixtures=JSON.parse(await readFile(join(assets,'fixtures.json'),'utf8'));
const rows=[];
for(const f of fixtures) {
  const rgba=await readFile(join(assets,f.rgba.path));
  const data=new Uint8ClampedArray(rgba);
  assert.equal(createHash('sha256').update(data).digest('hex'),f.rgba.sha256);
  const before=data.slice();
  const bytes=await readFile(join(assets,f.tensor.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.tensor.sha256);
  const expected=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const output=preprocessRgba({width:f.width,height:f.height,data},f.box);
  assert.deepEqual(data,before);
  assert.equal(output.tensor.length,expected.length);
  let maxAbs=0,different=0;
  for(let i=0;i<expected.length;i++) {assert(Number.isFinite(output.tensor[i]));maxAbs=Math.max(maxAbs,Math.abs(expected[i]-output.tensor[i]));different+=expected[i]!==output.tensor[i];}
  assert(maxAbs<=2e-6, f.name);
  rows.push({id:f.id,name:f.name,maxAbs,different,tensorSha256:createHash('sha256').update(new Uint8Array(output.tensor.buffer)).digest('hex')});
}
await writeFile(join(work,'node-result.json'),JSON.stringify({date:'2026-09-20',node:process.version,rows},null,2)+'\n');
console.log(JSON.stringify({passed:rows.length,maxAbs:Math.max(...rows.map(x=>x.maxAbs)),different:rows.reduce((sum,x)=>sum+x.different,0)}));
