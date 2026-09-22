import { TrackingError } from '../errors.js';
import type { FeatureSpace, TrackerOptions, TrackingFrame } from '../types.js';
import { IDENTITY, validateMotionMatrix } from './motion.js';
import type { AffineMatrix, BoTSortFrame, BoTSortOptions, CameraMotion, MotionEndpoint } from './types.js';

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value;
const ownKeys=(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(key=>Object.hasOwn(value,key))&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&(required.includes(key)||optional.includes(key)));
const commonKeys=['lowScoreThreshold','highScoreThreshold','newTrackThreshold','minHits','matchIouThreshold','lowMatchIouThreshold','maxLostMs','largeGapMs','maxDetections','maxTracks'];
export interface CandidateOptions {
  tracking: TrackerOptions; motionFailure:'error'|'identity';
  appearance: {featureSpace:FeatureSpace;proximityIouThreshold:number;maxCosineDistance:number;emaAlpha:number}|null;
}
export function parseCandidateOptions(value:BoTSortOptions):CandidateOptions {
  const fail=()=>{throw new TrackingError('INVALID_OPTIONS','BoT-SORT候选参数非法或包含无效字段');};
  if(!record(value)||!ownKeys(value,[],[...commonKeys,'motionFailure','appearance']))return fail();
  const motionFailure=Object.hasOwn(value,'motionFailure')?value.motionFailure:'error';
  if(motionFailure!=='error'&&motionFailure!=='identity')return fail();
  const tracking:TrackerOptions={};
  for(const key of commonKeys)if(Object.hasOwn(value,key))Object.assign(tracking,{[key]:value[key]});
  let appearance:CandidateOptions['appearance']=null;
  if(Object.hasOwn(value,'appearance')) {
    const input=value.appearance;
    if(!record(input)||!ownKeys(input,['featureSpace'],['proximityIouThreshold','maxCosineDistance','emaAlpha']))return fail();
    const space=input.featureSpace;
    if(!record(space)||!ownKeys(space,['id','dimension'])||!text(space.id)||typeof space.dimension!=='number'||!Number.isSafeInteger(space.dimension)||space.dimension<1||space.dimension>2048)return fail();
    const proximity=Object.hasOwn(input,'proximityIouThreshold')?input.proximityIouThreshold:.5;
    const cosine=Object.hasOwn(input,'maxCosineDistance')?input.maxCosineDistance:.25;
    const alpha=Object.hasOwn(input,'emaAlpha')?input.emaAlpha:.9;
    if(!finite(proximity)||proximity<0||proximity>1||!finite(cosine)||cosine<0||cosine>2||!finite(alpha)||alpha<0||alpha>=1)return fail();
    appearance={featureSpace:{id:space.id,dimension:space.dimension},proximityIouThreshold:proximity,maxCosineDistance:cosine,emaAlpha:alpha};
  }
  return {tracking,motionFailure,appearance};
}

function endpoint(value:unknown):MotionEndpoint {
  if(!record(value)||!ownKeys(value,['frameId','timestampMs'])||typeof value.frameId!=='number'||!Number.isSafeInteger(value.frameId)||value.frameId<0||!finite(value.timestampMs)||value.timestampMs<0)throw new TrackingError('INVALID_INPUT','帧身份或时间戳非法');
  return {frameId:value.frameId,timestampMs:value.timestampMs};
}
export function prepareCandidateFrame(value:TrackingFrame,previous:MotionEndpoint|null,size:TrackingFrame['imageSize']|null,options:CandidateOptions):{frame:BoTSortFrame;motion:CameraMotion;matrix:AffineMatrix} {
  const fail=()=>{throw new TrackingError('INVALID_INPUT','运动信息必须连接上一次成功处理帧；首次、跳转、尺寸变化或大间隔请reset');};
  if(!record(value)||!ownKeys(value,['frameId','timestampMs','imageSize','detections','motion'],['featureSpaceId']))return fail();
  const current=endpoint({frameId:value.frameId,timestampMs:value.timestampMs});
  if(!record(value.imageSize)||!ownKeys(value.imageSize,['width','height']))return fail();
  const {width,height}=value.imageSize;
  if(typeof width!=='number'||typeof height!=='number'||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>32768||height>32768)return fail();
  if(size&&(size.width!==width||size.height!==height))return fail();
  if(previous&&(current.frameId<=previous.frameId||current.timestampMs<=previous.timestampMs||current.timestampMs-previous.timestampMs>(options.tracking.largeGapMs??2000)))return fail();
  const supplied=value.motion;
  if(!record(supplied))return fail();
  const to=endpoint(supplied.to);
  if(to.frameId!==current.frameId||to.timestampMs!==current.timestampMs)return fail();
  let matrix=IDENTITY,motion:CameraMotion;
  if(previous===null) {
    if(!ownKeys(supplied,['status','from','to'])||supplied.status!=='initial'||supplied.from!==null)return fail();
    motion={status:'initial',from:null,to};
  } else {
    const from=endpoint(supplied.from);
    if(from.frameId!==previous.frameId||from.timestampMs!==previous.timestampMs)return fail();
    switch(supplied.status) {
      case 'identity':
        if(!ownKeys(supplied,['status','from','to']))return fail();
        motion={status:'identity',from,to};break;
      case 'estimated':
        if(!ownKeys(supplied,['status','from','to','matrix','source','confidence'])||!text(supplied.source)||!finite(supplied.confidence)||supplied.confidence<0||supplied.confidence>1)return fail();
        matrix=validateMotionMatrix(supplied.matrix,{width,height});
        motion={status:'estimated',from,to,matrix,source:supplied.source,confidence:supplied.confidence};break;
      case 'unavailable':
        if(!ownKeys(supplied,['status','from','to','reason'])||!text(supplied.reason)||options.motionFailure==='error')return fail();
        motion={status:'unavailable',from,to,reason:supplied.reason};break;
      default:return fail();
    }
  }
  if(!Array.isArray(value.detections)||value.detections.length>(options.tracking.maxDetections??100))return fail();
  // 未启用外观时拒绝向量；启用后的维数、空间和有限值由共享帧校验统一处理。
  if(!options.appearance&&(Object.hasOwn(value,'featureSpaceId')||value.detections.some(d=>record(d)&&Object.hasOwn(d,'embedding'))))return fail();
  return {frame:{...value,...current,imageSize:{width,height},motion} as BoTSortFrame,motion,matrix};
}
