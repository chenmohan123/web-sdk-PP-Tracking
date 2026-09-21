// 一次性研究函数：从原图轴对齐框四角包络的线性映射推导，不复制第三方跟踪代码。
export function compensate(state,matrix){
  if(!Array.isArray(matrix)||matrix.length!==6||!matrix.every(Number.isFinite))throw Error('无效仿射矩阵');
  const [a,b,tx,c,d,ty]=matrix;
  if(Math.abs(a*d-b*c)<1e-8)throw Error('奇异仿射矩阵');
  if(matrix.every((x,i)=>x===[1,0,0,0,1,0][i]))return state;
  const M=[[a,b],[c,d]],B=M.map(row=>row.map(Math.abs));
  const J=Array.from({length:8},()=>Array(8).fill(0));
  for(let block=0;block<4;block++)for(let i=0;i<2;i++)for(let j=0;j<2;j++)J[2*block+i][2*block+j]=(block%2===0?M:B)[i][j];
  const mean=J.map(row=>row.reduce((s,x,j)=>s+x*state.mean[j],0));mean[0]+=tx;mean[1]+=ty;
  const product=J.map(row=>state.covariance[0].map((_,j)=>row.reduce((s,x,k)=>s+x*state.covariance[k][j],0)));
  const covariance=product.map(row=>J.map(col=>row.reduce((s,x,k)=>s+x*col[k],0)));
  if(!mean.every(Number.isFinite)||!covariance.flat().every(Number.isFinite)||mean[2]<=0||mean[3]<=0)throw Error('运动补偿不可表示');
  return {mean,covariance};
}
