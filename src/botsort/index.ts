import { createTrackingCore } from '../tracker.js';
import { minimumCosineDistance, normalizeEmbedding } from '../deepsort.js';
import { TrackingError } from '../errors.js';
import type { Detection } from '../types.js';
import { compensateMotion } from './motion.js';
import { parseCandidateOptions, prepareCandidateFrame } from './contract.js';
import type { BoTSortOptions, BoTSortTracker, MotionEndpoint } from './types.js';
export type * from './types.js';
export function createBoTSortTracker(input: BoTSortOptions = {}): BoTSortTracker {
  const options=parseCandidateOptions(input);
  const appearance=options.appearance;
  let previous:MotionEndpoint|null=null;
  let prepared:ReturnType<typeof prepareCandidateFrame>|undefined;
  const core=createTrackingCore(options.tracking,{
    featureSpace:appearance?.featureSpace,
    prepareFrame(frame,_previousTimestamp,size) {
      prepared=prepareCandidateFrame(frame,previous,size,options);
      return prepared.frame;
    },
    transformPrediction:state=>compensateMotion(state,prepared!.matrix),
    ...(appearance ? {
      similarity(rawIou:number,detection:Detection,gallery:readonly (readonly number[])[]) {
        // 类别不同时rawIoU为-1，不能让外观越过类别与位置门控。
        if(rawIou<0 || rawIou<appearance.proximityIouThreshold || !gallery.length)return rawIou;
        const distance=minimumCosineDistance(detection.embedding!,gallery);
        return distance<=appearance.maxCosineDistance?Math.max(rawIou,1-distance/2):rawIou;
      },
      updateGallery(gallery:number[][],detection:Detection) {
        const latest=detection.embedding!;
        const blended=gallery.length?gallery[0].map((value,i)=>appearance.emaAlpha*value+(1-appearance.emaAlpha)*latest[i]):Array.from(latest);
        if(blended.every(value=>value===0))throw new TrackingError('NUMERICAL_FAILURE','外观EMA抵消为零，无法归一化');
        gallery.splice(0,gallery.length,normalizeEmbedding(blended,appearance.featureSpace.dimension));
      },
      initializeGallery:(detection:Detection)=>[Array.from(detection.embedding!)],
    }:{}),
  });
  return {
    update(frame,updateOptions) {
      const start=performance.now();
      try {
        const result=core.update(frame,updateOptions);
        // 后续构造只读取已校验的私有副本；成功后才推进候选帧身份。
        const validated=prepared!;
        const motion={...validated.motion,applied:validated.motion.status==='estimated'};
        const output={...result,algorithm:'botsort' as const,frameId:validated.frame.frameId,motion,runtime:{...result.runtime,runtimeVersion:'web-sdk-pp-tracking@0.2.0-rc.0+botsort-core.1' as const}};
        previous={frameId:validated.frame.frameId,timestampMs:validated.frame.timestampMs};
        output.timings.totalMs=performance.now()-start;
        return output;
      } finally {
        // 不跨调用保留调用者的输入帧/向量；dispose也只保留已释放的引擎闭包。
        prepared=undefined;
      }
    },
    reset(){core.reset();previous=null;},
    dispose(){core.dispose();previous=null;},
  };
}
