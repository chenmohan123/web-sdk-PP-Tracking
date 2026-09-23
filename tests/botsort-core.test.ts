import { describe, expect, it } from 'vitest';
import { createBoTSortTracker } from '../src/botsort/index.js';
import type { BoTSortFrame, BoTSortResult } from '../src/botsort/types.js';
import { createTracker } from '../src/index.js';

const endpoint=(id:number)=>({frameId:id,timestampMs:id*100});
const frame=(id:number,x=50):BoTSortFrame=>({ ...endpoint(id),imageSize:{width:640,height:480},detections:[{box:{x,y:100,width:20,height:80},score:1,classId:0}],motion:id===0?{status:'initial',from:null,to:endpoint(id)}:{status:'identity',from:endpoint(id-1),to:endpoint(id)} });
const withoutTime=({timings,...value}:BoTSortResult)=>value;
const errorCode=(fn:()=>unknown,code='INVALID_INPUT')=>expect(fn).toThrowError(expect.objectContaining({code}));
describe('BoT-SORT 候选帧契约',()=>{
  it('平移保留ID，报告实际补偿及CPU候选身份',()=>{
    const tracker=createBoTSortTracker({minHits:1});
    expect(tracker.update(frame(0)).tracks[0].id).toBe(1);
    const moved=frame(1,100);
    moved.motion={status:'estimated',from:endpoint(0),to:endpoint(1),matrix:[1,0,50,0,1,0],source:'test',confidence:1};
    const result=tracker.update(moved);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({id:1,state:'tracked',box:{x:100}});
  expect(result).toMatchObject({algorithm:'botsort',frameId:1,motion:{status:'estimated',applied:true},runtime:{actualBackend:'cpu',runtimeVersion:'web-sdk-pp-tracking@0.2.0-rc.2'}});
    expect(Object.values(result.timings).every(x=>Number.isFinite(x)&&x>=0)).toBe(true);
  });
  it('恒等情况下轨迹和生命周期与现有ByteTrack相同',()=>{
    const candidate=createBoTSortTracker(),baseline=createTracker();
    for(let id=0;id<12;id++) {
      const input=frame(id,50+id);
      if(id===4||id===5) input.detections=[];
      if(id===8) input.detections[0].score=.2;
      const a=candidate.update(input),b=baseline.update(input);
      expect(a.tracks).toEqual(b.tracks);expect(a.removed).toEqual(b.removed);
      expect(a.generation).toBe(b.generation);expect(a.droppedDetections).toBe(b.droppedDetections);
    }
  });
  it('首帧、空轨迹、重置后均不能绕过运动校验',()=>{
    const tracker=createBoTSortTracker();
    const bad=frame(0);bad.detections=[];
    bad.motion={status:'estimated',from:endpoint(0),to:endpoint(0),matrix:[1,0,NaN,0,1,0],source:'test',confidence:1};
    errorCode(()=>tracker.update(bad));
    expect(tracker.update(frame(0)).generation).toBe(0);
    tracker.reset();errorCode(()=>tracker.update(bad));
    expect(tracker.update(frame(0)).generation).toBe(1);
  });
  it('空状态下逐项拒绝非法矩阵和稀疏槽位，失败后可继续',()=>{
    const tracker=createBoTSortTracker();const empty=frame(0);empty.detections=[];tracker.update(empty);
    for(const matrix of [[1,0,NaN,0,1,0],Array(6),[-1,0,0,0,1,0],[1,0,300,0,1,0],[1,1,0,0,1,0]]) {
      const next=frame(1);next.detections=[];next.motion={status:'estimated',from:endpoint(0),to:endpoint(1),matrix:matrix as never,source:'test',confidence:1};
      errorCode(()=>tracker.update(next));
    }
    expect(tracker.update(frame(1)).tracks[0].id).toBe(1);
  });
  it('错误from/to和取消不推进状态，正确重试与对照相同',()=>{
    const tracker=createBoTSortTracker(),control=createBoTSortTracker();
    tracker.update(frame(0));control.update(frame(0));
    const bad=frame(1);bad.motion={status:'identity',from:{frameId:9,timestampMs:0},to:endpoint(1)};
    errorCode(()=>tracker.update(bad));
    const aborted=new AbortController();aborted.abort();
    errorCode(()=>tracker.update(frame(1),{signal:aborted.signal}),'ABORTED');
    const wrongTo=frame(1);wrongTo.motion={status:'identity',from:endpoint(0),to:endpoint(2)};
    errorCode(()=>tracker.update(wrongTo));
    expect(withoutTime(tracker.update(frame(1)))).toEqual(withoutTime(control.update(frame(1))));
  });
  it('允许覆盖处理间隔的跳帧，拒绝相邻原视频帧矩阵',()=>{
    const tracker=createBoTSortTracker();tracker.update(frame(0));
    errorCode(()=>tracker.update(frame(3)));
    const skipped=frame(3);skipped.motion={status:'identity',from:endpoint(0),to:endpoint(3)};
    expect(tracker.update(skipped).frameId).toBe(3);
    errorCode(()=>tracker.update(frame(2)));
  });
  it('失败默认报错；显式identity降级保留失败原因',()=>{
    const fail=createBoTSortTracker(),fallback=createBoTSortTracker({motionFailure:'identity'});
    fail.update(frame(0));fallback.update(frame(0));
    const missing=frame(1);missing.motion={status:'unavailable',from:endpoint(0),to:endpoint(1),reason:'低支持'};
    errorCode(()=>fail.update(missing));
    expect(fallback.update(missing).motion).toMatchObject({status:'unavailable',reason:'低支持',applied:false});
    expect(fail.update(frame(1)).frameId).toBe(1);
  });
  it('大间隔、尺寸变化和seek要求reset，实例隔离及dispose幂等',()=>{
    const tracker=createBoTSortTracker(),other=createBoTSortTracker();tracker.update(frame(0));
    const gap=frame(30);gap.motion={status:'identity',from:endpoint(0),to:endpoint(30)};
    errorCode(()=>tracker.update(gap));
    const resized=frame(1);resized.imageSize={width:800,height:480};errorCode(()=>tracker.update(resized));
    tracker.reset();expect(tracker.update(frame(0))).toMatchObject({generation:1,tracks:[{id:1}]});
    expect(other.update(frame(0)).generation).toBe(0);
    tracker.dispose();tracker.dispose();errorCode(()=>tracker.update(frame(1)),'DISPOSED');errorCode(()=>tracker.reset(),'DISPOSED');
  });
  it('输入及返回值变更不污染帧身份和轨迹',()=>{
    const tracker=createBoTSortTracker(),control=createBoTSortTracker();
    const input=frame(0);const result=tracker.update(input);control.update(frame(0));
    input.motion.to.frameId=900;input.detections[0].box.x=500;result.motion.to.frameId=800;result.tracks[0].box.x=300;
    expect(withoutTime(tracker.update(frame(1)))).toEqual(withoutTime(control.update(frame(1))));
  });
  it('拒绝未知参数及未启用却传入的外观，避免忽略输入',()=>{
    errorCode(()=>createBoTSortTracker({algorithm:'botsort'} as never),'INVALID_OPTIONS');
    errorCode(()=>createBoTSortTracker({motionFailure:'silent'} as never),'INVALID_OPTIONS');
    const tracker=createBoTSortTracker(),input=frame(0);input.detections[0].embedding=[1,0];
    errorCode(()=>tracker.update(input));
    errorCode(()=>tracker.update({...frame(0),featureSpaceId:'unused'}));
    errorCode(()=>tracker.update({...frame(0),motionMatrix:[1,0,0,0,1,0]} as never));
  });
});
