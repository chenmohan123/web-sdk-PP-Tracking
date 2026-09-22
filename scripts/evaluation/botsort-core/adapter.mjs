// 只接收冻结的检测/外观/矩阵，不读取真值或在此估计相机运动。
export function candidateFrame(features,row,previous,appearance=true,mode='full') {
  const to={frameId:row.frameNumber,timestampMs:features.timestampMs};
  const from=previous?{frameId:previous.frameId,timestampMs:previous.timestampMs}:null;
  let motion;
  if(!from)motion={status:'initial',from:null,to};
  else if(mode==='identity')motion={status:'identity',from,to};
  else if(row.status==='estimated')motion={status:'estimated',from,to,matrix:mode==='translation'?[1,0,row.matrix[2],0,1,row.matrix[5]]:row.matrix,source:'固定ORB研究归档',confidence:row.support.inlierRatio};
  else motion={status:'unavailable',from,to,reason:row.status};
  const frame={frameId:to.frameId,timestampMs:features.timestampMs,imageSize:features.imageSize,detections:features.detections.map(({embedding,...detection})=>appearance?{...detection,embedding}:detection),motion};
  if(appearance)frame.featureSpaceId=features.featureSpaceId;
  return frame;
}
