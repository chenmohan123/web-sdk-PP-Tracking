// 透明PNG单独诊断：Canvas可能丢失透明像素隐藏颜色，不能宣称所有RGBA逐字节一致。
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
const work=resolve(process.argv[2]??'.tmp/reid-preprocessing-20260920');
const fixture=JSON.parse(await readFile(join(work,'assets/alpha-diagnostic.json'),'utf8'));
const raw=fixture.rawRgba;
const png=await readFile(join(work,'assets',fixture.png.path));
assert.equal(createHash('sha256').update(png).digest('hex'),fixture.png.sha256);
const browser=await chromium.launch({channel:'chromium',headless:true});
try {
  const page=await browser.newPage();
  const decoded=await page.evaluate(async data=>{
    const bitmap=await createImageBitmap(new Blob([new Uint8Array(data)],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
    try {
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});
      ctx.drawImage(bitmap,0,0);
      return Array.from(ctx.getImageData(0,0,canvas.width,canvas.height,{colorSpace:'srgb'}).data);
    } finally {bitmap.close();}
  },Array.from(png));
  const differences=decoded.map((x,i)=>Math.abs(x-raw[i]));
  const result={date:'2026-09-20',browserVersion:browser.version(),sourcePng:fixture.png,
    rawRgba:Array.from(raw),decodedRgba:decoded,maxAbs:Math.max(...differences),different:differences.filter(x=>x!==0).length,
    byteExact:differences.every(x=>x===0),scope:'仅诊断透明PNG解码；透明度合成规则的数值验收使用调用者已解码的raw RGBA，不能扩展为原PNG隐藏颜色保真承诺。'};
  await writeFile(join(work,'decode-diagnostics.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally {await browser.close();}
