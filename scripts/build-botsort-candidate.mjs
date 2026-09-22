// 候选仅输出到忽略目录；不修改正式exports、版本或Demo。
import { build } from 'esbuild';
import { mkdir, writeFile, readFile, mkdtemp, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const output='.tmp/botsort-core/build';
await mkdir(output,{recursive:true});
for(const [format,extension] of [['esm','js'],['cjs','cjs']]) await build({entryPoints:['src/botsort/index.ts'],outfile:`${output}/index.${extension}`,bundle:true,platform:'neutral',format,target:'es2022'});
const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--strict','--skipLibCheck','--declaration','--emitDeclarationOnly','--newLine','lf','--rootDir','src','--outDir',output+'/types','src/botsort/index.ts'],{encoding:'utf8'});
assert.equal(compile.status,0,compile.stdout+compile.stderr);
await writeFile(output+'/package.json',JSON.stringify({name:'tracking-botsort-local-candidate',private:true,type:'module',exports:{'.':{types:'./types/botsort/index.d.ts',import:'./index.js',require:'./index.cjs'}}},null,2));
const consumer=await mkdtemp(join(tmpdir(),'tracking-botsort-consumer-'));
await mkdir(join(consumer,'node_modules'),{recursive:true});
await cp(output,join(consumer,'node_modules/tracking-botsort-local-candidate'),{recursive:true});
for(const format of ['mjs','cjs']) {
  const code=`${format==='mjs'?"import {createBoTSortTracker} from 'tracking-botsort-local-candidate';":"const {createBoTSortTracker}=require('tracking-botsort-local-candidate');"}
const tracker=createBoTSortTracker({minHits:1});
const result=tracker.update({frameId:0,timestampMs:0,imageSize:{width:640,height:480},detections:[{box:{x:50,y:100,width:20,height:80},score:1,classId:0}],motion:{status:'initial',from:null,to:{frameId:0,timestampMs:0}}});
if(result.algorithm!=='botsort'||result.tracks[0].id!==1||result.runtime.actualBackend!=='cpu')throw Error('候选消费失败');
tracker.dispose();`;
  const file=join(consumer,'consumer.'+format);await writeFile(file,code);
  const result=spawnSync(process.execPath,[file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
}
for(const extension of ['mts','cts']) {
  const file=join(consumer,'consumer.'+extension);
  await writeFile(file,`import {createBoTSortTracker,type BoTSortFrame,type BoTSortResult} from 'tracking-botsort-local-candidate';
const frame:BoTSortFrame={frameId:0,timestampMs:0,imageSize:{width:640,height:480},detections:[],motion:{status:'initial',from:null,to:{frameId:0,timestampMs:0}}};
const result:BoTSortResult=createBoTSortTracker().update(frame);
const algorithm:'botsort'=result.algorithm;
// @ts-expect-error estimated状态必须带矩阵及来源。
const invalid:BoTSortFrame={...frame,motion:{status:'estimated',from:{frameId:0,timestampMs:0},to:{frameId:1,timestampMs:100}}};
// @ts-expect-error 不能传入其他算法的图库配置。
createBoTSortTracker({gallerySize:3});
void algorithm;void invalid;
`);
  const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',file],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
}
const hashes={};
for(const file of ['index.js','index.cjs'])hashes[file]=createHash('sha256').update(await readFile(output+'/'+file)).digest('hex');
await writeFile('.tmp/botsort-core/build-result.json',JSON.stringify({testedAt:new Date().toISOString(),output:resolve(output),hashes,checks:['ESM实际消费','CJS实际消费','NodeNext mts/cts类型消费','无模型依赖']},null,2));
console.log('BoT-SORT候选ESM/CJS与类型消费通过，仅输出到.tmp/botsort-core/build');
