import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error 独立评测工具不属于包类型入口。
import { extractFrame, validateFeatureFrame, configurations, validateMerge } from '../scripts/evaluation/mot17-reid/core.mjs';
// @ts-expect-error 独立评测工具不属于包类型入口。
import { verifyFile, newOutput } from '../scripts/evaluation/mot17-reid/io.mjs';
const space = { id: '固定测试空间', dimension: 2 };
const frame = (n: number) => ({ timestampMs: 40, imageSize: { width: 200, height: 100 }, detections: Array.from({length:n}, (_,i) => ({box:{x:i,y:0,width:1,height:1},score:0.5,classId:0})) });
const extractor = { featureSpace: space, extract: async ({detections}: {detections: any[]}) => ({ featureSpace:space, detections:detections.map(d => ({...d,embedding:[d.box.x,1]})), timings:{totalMs:1} }) };
describe('真实序列全帧特征契约', () => {
  it('65个检测全部保序，提取完成后才整帧更新一次', async () => {
    const calls: number[] = [], updates: any[] = [];
    const e = {...extractor, extract: async (input: any) => {calls.push(input.detections.length); return extractor.extract(input);} };
    const result = await extractFrame(e, {}, frame(65), [ {update:(v:any) => updates.push(v)} ]);
    expect(calls).toEqual([64,1]); expect(updates).toHaveLength(1);
    expect(result.detections.map((d:any) => d.embedding[0])).toEqual(Array.from({length:65},(_,i)=>i));
    expect(updates[0]).toEqual(result);
  });
  it('第二块失败时不能推进任何跟踪器', async () => {
    const updates: any[] = []; let count=0;
    const e = {...extractor, extract: async (input: any) => { if (++count===2) throw new Error('故意提取失败'); return extractor.extract(input); } };
    await expect(extractFrame(e,{},frame(65),[{update:(v:any)=>updates.push(v)}])).rejects.toThrow('故意提取失败');
    expect(updates).toEqual([]);
  });
  it('零检测帧不调用模型且仍推进一次时间戳', async () => {
    const updates: any[] = [];
    const e = {...extractor, extract:async()=>{throw new Error('不应调用');}};
    const result=await extractFrame(e,{},frame(0),[{update:(v:any)=>updates.push(v)}]);
    expect(result).toEqual({...frame(0),featureSpaceId:space.id}); expect(updates).toEqual([result]);
  });
  it('错位、缺项、空间、维度与非有限数均拒绝', async () => {
    const input=frame(2), good=await extractFrame(extractor,{},input,[]);
    expect(()=>validateFeatureFrame(good,input,space)).not.toThrow();
    for(const bad of [ {...good,detections:[...good.detections].reverse()}, {...good,detections:good.detections.slice(1)}, {...good,featureSpaceId:'错空间'}, {...good,timestampMs:41}, {...good,detections:good.detections.map((d:any)=>({...d,embedding:[1]}))}, {...good,detections:good.detections.map((d:any)=>({...d,embedding:[NaN,1]}))} ]) expect(()=>validateFeatureFrame(bad,input,space)).toThrow();
  });
  it('三个算法同源公共参数，低分字段只属于ByteTrack', async () => {
    const lock=JSON.parse(await readFile('scripts/evaluation/mot17/lock.json','utf8'));
    const c=configurations(lock.defaultOptions,space);
    expect(c.bytetrack).toEqual({...lock.defaultOptions,algorithm:'bytetrack'});
    for(const name of ['ocsort','deepsort']) { expect(c[name]).not.toHaveProperty('lowScoreThreshold'); expect(c[name]).not.toHaveProperty('lowMatchIouThreshold'); expect(c[name].maxDetections).toBe(100); }
    expect(c.deepsort).toMatchObject({featureSpace:space,maxCosineDistance:0.2,gallerySize:30});
  });
});
describe('评测身份与落盘边界', () => {
  it('合并只允许完整、不重叠且构建和参数相同的七段', () => {
    const names=['a','b'], make=(name:string)=>({complete:true,subset:false,backend:'webgpu',identitySha256:'固定构建',configurations:{},sequences:{[name]:{frames:2,info:{length:2}}}});
    expect(()=>validateMerge([make('a'),make('b')],names)).not.toThrow();
    for(const bad of [[make('a')],[make('a'),make('a')],[make('a'),{...make('b'),subset:true}],[make('a'),{...make('b'),identitySha256:'另一个构建'}],[make('a'),{...make('b'),backend:'wasm'}],[make('a'),{...make('b'),sequences:{b:{frames:1,info:{length:2}}}}]]) expect(()=>validateMerge(bad,names)).toThrow();
  });
  it('未知模式及非固定子集在创建输出前拒绝', async () => {
    const folder=await mkdtemp(resolve('.tmp/reid-cli-test-'));
    for(const extra of [['--backend','cuda'],['--limit','31'],['--limit','30','--sequence','MOT17-04-FRCNN'],['--backend','wasm']]) {
      const result=spawnSync(process.execPath,['scripts/evaluation/mot17-reid/run.mjs','--out',resolve(folder,'run'),...extra],{encoding:'utf8'});
      expect(result.status).not.toBe(0); expect(result.stderr).toMatch(/未知后端|固定02前30帧/);
    }
  });
  it('错误模型和图片的SHA与长度拒绝，正确字节通过', async () => {
    await mkdir('.tmp',{recursive:true}); const folder=await mkdtemp(resolve('.tmp/reid-identity-test-'));
    const file=resolve(folder,'asset'); await writeFile(file,'abc');
    const pin={bytes:3,sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'};
    await expect(verifyFile(file,pin)).resolves.toBeDefined();
    for(const wrong of [{...pin,bytes:4},{...pin,sha256:'0'.repeat(64)}]) await expect(verifyFile(file,wrong)).rejects.toThrow(/身份/);
  });
  it('外部路径、已有目标、归档和junction逃逸在创建之前拒绝', async () => {
    const root=resolve('.'); await mkdir('.tmp',{recursive:true}); const folder=await mkdtemp(resolve('.tmp/reid-path-test-'));
    const alias=resolve(folder,'alias'); await symlink(resolve('reports'),alias,process.platform==='win32'?'junction':'dir');
    for(const bad of [root,resolve('reports/禁止写入'),folder,resolve(alias,'禁止写入')]) await expect(newOutput(root,bad)).rejects.toThrow(/\.tmp|EEXIST|归档/);
    await expect(newOutput(root,resolve(folder,'new'))).resolves.toBe(resolve(folder,'new'));
  });
});
