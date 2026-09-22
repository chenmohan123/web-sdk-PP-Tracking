import { describe, expect, it } from 'vitest';
import { compensateMotion, validateMotionMatrix } from '../src/botsort/motion.js';
import type { GaussianState } from '../src/kalman.js';

const state = (): GaussianState => ({ mean: [50,80,20,100,3,4,1,2], covariance: Array.from({length:8}, (_,i) => Array.from({length:8}, (_,j) => Number(i === j))) });
describe('候选运动矩阵几何', () => {
  it('恒等不改变状态；平移只移动中心', () => {
    const original = state();
    expect(compensateMotion(original, [1,0,0,0,1,0])).toBe(original);
    expect(compensateMotion(original, [1,0,12,0,1,-8]).mean).toEqual([62,72,20,100,3,4,1,2]);
    expect(original.mean).toEqual([50,80,20,100,3,4,1,2]);
  });
  it('四角包络与协方差变换独立于带符号宽高', () => {
    const turned = compensateMotion(state(), [0,-1,0,1,0,0]);
    expect(turned.mean).toEqual([-80,50,100,20,-4,3,2,1]);
    expect(turned.covariance).toEqual(state().covariance);
    const scaled = compensateMotion(state(), [2,0,0,0,2,0]);
    expect(scaled.covariance[0][0]).toBe(4);
    const theta = Math.PI / 12;
    const rotated = compensateMotion(state(), [Math.cos(theta),-Math.sin(theta),0,Math.sin(theta),Math.cos(theta),0]);
    expect(rotated.mean[2]).toBeCloseTo(45.2004210360, 8);
    expect(rotated.mean[3]).toBeCloseTo(101.76896353096, 8);
  });
  it('长旋转包络可能增长但保持有限与对称非负协方差', () => {
    let current = state();
    const theta = Math.PI / 180;
    for (let i=0;i<120;i++) current = compensateMotion(current,[Math.cos(theta),-Math.sin(theta),0,Math.sin(theta),Math.cos(theta),0]);
    expect(current.mean[2]).toBeGreaterThan(20);
    expect(current.mean.every(Number.isFinite)).toBe(true);
    for(let i=0;i<8;i++) {
      expect(current.covariance[i][i]).toBeGreaterThanOrEqual(0);
      for(let j=0;j<8;j++) expect(current.covariance[i][j]).toBeCloseTo(current.covariance[j][i],10);
    }
    for(let k=0;k<20;k++) {
      const z=Array.from({length:8},(_,i)=>Math.sin(k+i));
      expect(z.reduce((sum,x,i)=>sum+x*current.covariance[i].reduce((t,y,j)=>t+y*z[j],0),0)).toBeGreaterThanOrEqual(-1e-8);
    }
  });
  it.each([
    [1,0,0,0,NaN,0], [1,0,0,0,1,Infinity], [1,2], Array(6), [0,0,0,0,0,0],
    [-1,0,0,0,1,0], [1.3,0,0,0,1.3,0], [.7,0,0,0,.7,0],
    [1,1,0,0,1,0], [0,-1,0,1,0,0], [1,0,201,0,1,0],
  ])('拒绝无法安全应用的矩阵 %j', (...matrix) => {
    expect(() => validateMotionMatrix(matrix,{width:640,height:480})).toThrowError(expect.objectContaining({code:'INVALID_INPUT'}));
  });
  it('接受边界平移并复制矩阵，拒绝数值溢出', () => {
    const matrix = [1,0,200,0,1,0];
    const parsed = validateMotionMatrix(matrix,{width:640,height:480});
    matrix[2]=0;
    expect(parsed[2]).toBe(200);
    const huge=state(); huge.mean[0]=Number.MAX_VALUE;
    expect(() => compensateMotion(huge,[2,0,0,0,2,0])).toThrowError(expect.objectContaining({code:'NUMERICAL_FAILURE'}));
  });
});
