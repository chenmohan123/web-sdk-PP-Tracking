import fs from 'node:fs/promises';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import path from 'node:path';
import { options, writeReport, sdkRoot as defaultRoot } from './options.mjs';
const args = options({ sdk: defaultRoot, out: path.join(defaultRoot, '.tmp/evaluation-benchmark.json') });
const sdkRoot = args.sdk;
const entry=await fs.readFile(sdkRoot+'/dist/index.js');
const server=http.createServer((req,res)=>{
  if(req.url==='/index.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(entry);}
  else if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html lang="zh-CN"><title>跟踪性能验收</title></html>');}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async()=>{
    const {createTracker}=await import('/index.js');
    const makeFrame=(count,frame)=>({timestampMs:frame*1000/30,imageSize:{width:1000,height:1000},detections:Array.from({length:count},(_,i)=>({classId:0,score:0.9,box:{x:20+(i%10)*90+3*Math.sin(frame/25),y:20+Math.floor(i/10)*90,width:35,height:45}}))});
    const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.ceil((sorted.length-1)*.95)],min:sorted[0],max:sorted.at(-1)};};
    const measurements=[];
    // 预热浏览器JIT；每个规模的cold仍指新建算法实例，不能等同进程首次加载。
    const warmup=createTracker();for(let f=0;f<30;f++)warmup.update(makeFrame(100,f));warmup.dispose();
    for(const count of [10,50,100]){
      const cold=[],warm=[];
      for(let repetition=0;repetition<3;repetition++){
        const first=makeFrame(count,0);
        const begin=performance.now();const tracker=createTracker();const firstResult=tracker.update(first);
        cold.push({totalWithCreationMs:performance.now()-begin,timings:firstResult.timings});
        for(let f=1;f<=200;f++){
          const frame=makeFrame(count,f);const start=performance.now();const output=tracker.update(frame);
          const outerMs=performance.now()-start;
          if(output.tracks.length!==count||output.tracks.some(t=>!t.observed))throw new Error('测量场景发生非预期丢失');
          warm.push({repetition,frame:f,outerMs,timings:output.timings});
        }
        tracker.dispose();
      }
      measurements.push({count,cold,warm,summary:{cold:summarize(cold.map(x=>x.totalWithCreationMs)),warm:summarize(warm.map(x=>x.timings.totalMs)),outer:summarize(warm.map(x=>x.outerMs))}});
    }
    return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,timeOrigin:performance.timeOrigin,measurements};
  });
  const report={verifiedAt:new Date().toISOString(),browser:browser.version(),os:{platform:os.platform(),release:os.release()},cpu:os.cpus()[0].model,commit:execFileSync('git',['-C',sdkRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),entrySha256:createHash('sha256').update(entry).digest('hex'),scope:'Chromium headless CPU/main；原创规则网格+缓慢正弦平移，全部classId=0；30帧JIT预热，cold为新算法实例，非浏览器进程冷启动；warm每规模3×200帧；输入生成在计时范围外；不是视频精度/最坏情况/手机性能。',...result};
  await writeReport(args.out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({browser:report.browser,cpu:report.cpu,measurements:result.measurements.map(({count,summary})=>({count,summary}))},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
