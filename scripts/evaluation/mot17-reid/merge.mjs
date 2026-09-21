import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { validateMerge } from './core.mjs';
import { hashFile, newOutput, readJson, save, sha256 } from './io.mjs';

const root = await fs.realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const { values } = parseArgs({ options: { run: { type:'string', multiple:true }, out:{type:'string'}, input:{type:'string'}, python:{type:'string'}, trackeval:{type:'string'} }, strict:true });
for (const key of ['run','out','input','python','trackeval']) if (!values[key]) throw new Error(`缺少 --${key}`);
const out = await newOutput(root,path.resolve(values.out));
const paths = values.run.map(value => path.resolve(value)), runs = await Promise.all(paths.map(folder => readJson(path.join(folder,'summary.json'))));
const lock = await readJson(path.join(root,'scripts/evaluation/mot17/lock.json'));
validateMerge(runs,lock.dataset.sequences);
const identity = await readJson(path.join(paths[0],'identity.json'));
assert.equal(sha256(JSON.stringify(identity)),runs[0].identitySha256);
for (const [file,pin] of Object.entries(identity.files)) assert.equal(await hashFile(path.join(root,file)),pin,`当前实现身份变化：${file}`);
// 在创建目录前核对所有来源特征、两次Node和浏览器输出，不能只信任完成标记。
for (const [i,run] of runs.entries()) {
  assert.deepEqual(await readJson(path.join(paths[i],'identity.json')),identity);
  for (const [name,sequence] of Object.entries(run.sequences)) {
    assert.equal(sequence.droppedDetections,0);
    assert.equal(await hashFile(path.join(paths[i],`features/${name}.jsonl`)),sequence.featureSha256);
    for (const algorithm of ['bytetrack','ocsort','deepsort']) for (const repetition of [1,2]) {
      const pin=sequence.node[algorithm][repetition-1]; assert(pin.browserEqual);
      assert.equal(await hashFile(path.join(paths[i],`node-${repetition}/${algorithm}/${name}.jsonl`)),pin.nonTimingSha256);
      assert.equal(await hashFile(path.join(paths[i],`browser/${algorithm}/${name}.jsonl`)),pin.nonTimingSha256);
      assert.equal(await hashFile(path.join(paths[i],`${repetition===1?'trackers':'trackers-repeat'}/${algorithm}/data/${name}.txt`)),pin.motSha256);
      assert.equal(await hashFile(path.join(paths[i],`browser/${algorithm}/${name}.txt`)),pin.motSha256);
    }
  }
}
await fs.mkdir(path.dirname(out),{recursive:true}); await fs.mkdir(await newOutput(root,out));
const write=(relative,value)=>save(root,path.join(out,relative),value);
const combined = { ...runs[0], testedAt:new Date().toISOString(), sequences:Object.assign({},...runs.map(run=>run.sequences)), sources:[] };
delete combined.browser;
for (const [index,run] of runs.entries()) {
  combined.sources.push({path:paths[index],summarySha256:await hashFile(path.join(paths[index],'summary.json'))});
  for (const name of Object.keys(run.sequences)) for (const algorithm of ['bytetrack','ocsort','deepsort']) await write(`trackers/${algorithm}/data/${name}.txt`,await fs.readFile(path.join(paths[index],`trackers/${algorithm}/data/${name}.txt`),'utf8'));
}
await write('identity.json',identity); await write('summary.json',combined);
const log=execFileSync(values.python,['-B',path.join(root,'scripts/evaluation/mot17-reid/score.py'),'--input',path.resolve(values.input),'--trackeval',path.resolve(values.trackeval),'--run',out],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
await write('score.log',log);
console.log(`合并和官方评分完成：${out}`);
