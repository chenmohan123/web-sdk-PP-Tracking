import type { GaussianState } from '../kalman.js';
import type { AffineMatrix } from './types.js';
import { TrackingError } from '../errors.js';

export const IDENTITY: AffineMatrix = [1, 0, 0, 0, 1, 0];

export function validateMotionMatrix(value: unknown, size: {width:number;height:number}): AffineMatrix {
  const fail = () => { throw new TrackingError('INVALID_INPUT', '运动矩阵须为有限、保向且在允许范围内的原图仿射变换'); };
  if (!Array.isArray(value) || value.length !== 6) return fail();
  for (let i=0;i<6;i++) if (!Object.hasOwn(value,i) || typeof value[i] !== 'number' || !Number.isFinite(value[i])) return fail();
  const [a,b,tx,c,d,ty] = value as number[];
  const determinant = a*d-b*c;
  // MᵀM 的两个特征值开方即奇异值；有界输入同时限制剪切和条件数。
  const x=a*a+c*c, y=b*b+d*d, z=a*b+c*d;
  const delta=Math.hypot(x-y,2*z);
  const minimum=Math.sqrt((x+y-delta)/2), maximum=Math.sqrt((x+y+delta)/2);
  const angle=Math.abs(Math.atan2(c-b,a+d));
  const epsilon=1e-10;
  if (!(determinant > 0) || !Number.isFinite(maximum) || !Number.isFinite(minimum) || minimum < .8-epsilon || maximum > 1.25+epsilon || angle > Math.PI/12+epsilon || Math.hypot(tx,ty) > .25*Math.hypot(size.width,size.height)+epsilon) return fail();
  return [a,b,tx,c,d,ty];
}

export function compensateMotion(state: GaussianState, matrix: AffineMatrix): GaussianState {
  if (matrix.every((value,i)=>value===IDENTITY[i])) return state;
  const [a,b,tx,c,d,ty]=matrix;
  const linear=[[a,b],[c,d]], envelope=linear.map(row=>row.map(Math.abs));
  const jacobian=Array.from({length:8},()=>Array<number>(8).fill(0));
  for(let block=0;block<4;block++) for(let i=0;i<2;i++) for(let j=0;j<2;j++) jacobian[block*2+i][block*2+j]=(block%2===0?linear:envelope)[i][j];
  const mean=jacobian.map(row=>row.reduce((sum,value,j)=>sum+value*state.mean[j],0));
  mean[0]+=tx;mean[1]+=ty;
  const product=jacobian.map(row=>state.covariance[0].map((_,j)=>row.reduce((sum,value,k)=>sum+value*state.covariance[k][j],0)));
  const covariance=product.map(row=>jacobian.map(column=>row.reduce((sum,value,k)=>sum+value*column[k],0)));
  if (!mean.every(Number.isFinite) || mean[2]<=0 || mean[3]<=0 || !covariance.every(row=>row.every(Number.isFinite)) || covariance.some((row,i)=>row[i]<0)) throw new TrackingError('NUMERICAL_FAILURE','运动补偿状态或协方差不可表示');
  return {mean,covariance};
}
