import { describe, expect, it } from 'vitest';
import { createBoTSortTracker } from '../src/botsort/index.js';
import type { BoTSortFrame } from '../src/botsort/types.js';

const space={id:'test-appearance',dimension:2};
const point=(id:number)=>({frameId:id,timestampMs:id*100});
const make=(id:number,rows:[number,number[],number][]):BoTSortFrame=>({...point(id),imageSize:{width:640,height:480},featureSpaceId:space.id,detections:rows.map(([x,embedding,score])=>({box:{x,y:100,width:20,height:80},embedding,score,classId:0})),motion:id===0?{status:'initial',from:null,to:point(id)}:{status:'identity',from:point(id-1),to:point(id)}});
const strip=({timings,...value}:ReturnType<ReturnType<typeof createBoTSortTracker>['update']>)=>value;
describe('BoT-SORT 候选门控外观融合',()=>{
  it('近邻高分歧义用特征分配身份',()=>{
    const tracker=createBoTSortTracker({minHits:1,appearance:{featureSpace:space}});
    tracker.update(make(0,[[50,[1,0],1],[50,[0,1],1]]));
    const result=tracker.update(make(1,[[52,[0,1],.8],[54,[1,0],.9]]));
    expect(result.tracks.map(t=>[t.id,t.score])).toEqual([[1,.9],[2,.8]]);
  });
  it('IoU门控外和余弦门控外不能改变纯几何分配',()=>{
    for(const appearance of [{featureSpace:space,proximityIouThreshold:.95},{featureSpace:space,maxCosineDistance:0}]) {
      const tracker=createBoTSortTracker({minHits:1,appearance});
      tracker.update(make(0,[[50,[1,0],1],[50,[0,1],1]]));
      const result=tracker.update(make(1,[[52,[.2,.98],.8],[54,[.98,.2],.9]]));
      expect(result.tracks.map(t=>t.score)).toEqual([.8,.9]);
    }
  });
  it('类别硬约束不能被同特征绕过，远框不能外观复活',()=>{
    const tracker=createBoTSortTracker({minHits:1,appearance:{featureSpace:space}});
    tracker.update(make(0,[[50,[1,0],1]]));
    const mismatch=make(1,[[50,[1,0],1]]);mismatch.detections[0].classId=1;
    expect(tracker.update(mismatch).tracks.map(t=>[t.id,t.state])).toEqual([[1,'lost'],[2,'tracked']]);
    expect(tracker.update(make(2,[[150,[1,0],1]])).tracks.at(-1)?.id).toBe(3);
  });
  it('低分错向量不参与关联也不污染EMA',()=>{
    const tracker=createBoTSortTracker({minHits:1,appearance:{featureSpace:space,emaAlpha:0}});
    const control=createBoTSortTracker({minHits:1,appearance:{featureSpace:space,emaAlpha:0}});
    tracker.update(make(0,[[50,[1,0],1],[50,[0,1],1]]));control.update(make(0,[[50,[1,0],1],[50,[0,1],1]]));
    tracker.update(make(1,[[50,[0,1],.2],[50,[1,0],.2]]));control.update(make(1,[[50,[1,0],.2],[50,[0,1],.2]]));
    const next=make(2,[[52,[0,1],.8],[54,[1,0],.9]]);
    expect(strip(tracker.update(next))).toEqual(strip(control.update(next)));
    expect(control.update(make(3,[[52,[0,1],.8],[54,[1,0],.9]])).tracks.map(t=>t.score)).toEqual([.9,.8]);
  });
  it('高分更新EMA，alpha为0时使用最新特征',()=>{
    const tracker=createBoTSortTracker({minHits:1,appearance:{featureSpace:space,emaAlpha:0}});
    tracker.update(make(0,[[50,[1,0],1]]));
    tracker.update(make(1,[[50,[0,1],1]]));
    const result=tracker.update(make(2,[[52,[1,0],.8],[54,[0,1],.9]]));
    expect(result.tracks[0]).toMatchObject({id:1,score:.9});
  });
  it('空间、零向量和混合零范数失败不推进图库/轨迹',()=>{
    const options={minHits:1,appearance:{featureSpace:space,emaAlpha:.5}};
    const tracker=createBoTSortTracker(options),control=createBoTSortTracker(options);
    tracker.update(make(0,[[50,[1,0],1]]));control.update(make(0,[[50,[1,0],1]]));
    for(const input of [{...make(1,[[50,[1,0],1]]),featureSpaceId:'wrong'},make(1,[[50,[0,0],1]]),make(1,[[50,[-1,0],1]])]) expect(()=>tracker.update(input)).toThrow();
    expect(strip(tracker.update(make(1,[[50,[1,0],1]])))).toEqual(strip(control.update(make(1,[[50,[1,0],1]]))));
  });
  it('外观参数/输入被复制，稀疏与无穷向量拒绝',()=>{
    const options={minHits:1,appearance:{featureSpace:{...space}}};
    const tracker=createBoTSortTracker(options);options.appearance.featureSpace.id='mutated';
    for(const vector of [Array(2),[Infinity,0],[1]]) expect(()=>tracker.update(make(0,[[50,vector,1]]))).toThrow();
    const first=make(0,[[50,[1,0],1]]);tracker.update(first);(first.detections[0].embedding as number[])[0]=-1;
    expect(tracker.update(make(1,[[52,[0,1],.8],[54,[1,0],.9]])).tracks[0].score).toBe(.9);
    for(const appearance of [{featureSpace:space,emaAlpha:1},{featureSpace:space,maxCosineDistance:3},{featureSpace:{...space,dimension:2049}},{featureSpace:space,extra:true}]) expect(()=>createBoTSortTracker({appearance})).toThrowError(expect.objectContaining({code:'INVALID_OPTIONS'}));
  });
});
