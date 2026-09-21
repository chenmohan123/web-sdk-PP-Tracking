import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
const run = promisify(execFile);
const out = 'reports/2026-09-21-02-release/remote';
await mkdir(out, {recursive:true});
const repo = 'repos/chenmohan123/web-sdk-PP-Tracking';
const endpoints = {
  repository: repo, branchRules: `${repo}/rulesets/23691947`, tagRules: `${repo}/rulesets/23691948`,
  pages: `${repo}/pages`, environments: `${repo}/environments`,
  release: `${repo}/releases/tags/v0.2.0-rc.0`, pull: `${repo}/pulls/3`,
  releaseRun: `${repo}/actions/runs/35574391794`, pagesRun: `${repo}/actions/runs/35574347075`,
  deployments: `${repo}/deployments?sha=041686f6c335a66dbe1f3796d6be5b5ae908c2cb&environment=github-pages&per_page=10`,
  tag: `${repo}/git/ref/tags/v0.2.0-rc.0`
};
const observations = await Promise.allSettled(Object.entries(endpoints).map(async ([name, endpoint])=>{
  const {stdout} = await run('C:/Program Files/GitHub CLI/gh.exe', ['api',endpoint], {maxBuffer:8*1024*1024});
  const data=JSON.parse(stdout);
  await writeFile(`${out}/${name}.json`, JSON.stringify(data,null,2)+'\n');
  return {name,endpoint,observedAt:new Date().toISOString(),data};
}));
const results=[];
for(const r of observations){if(r.status==='rejected') throw r.reason; const {data,...info}=r.value; results.push(info);}
const deployment=observations.find(r=>r.value?.name==='deployments').value.data[0];
if(!deployment) throw new Error('缺少部署');
for(const [name,endpoint] of [ ['deploymentStatuses',`${repo}/deployments/${deployment.id}/statuses`], ['tagObject',`${repo}/git/tags/${observations.find(r=>r.value?.name==='tag').value.data.object.sha}`] ]) {
  const {stdout}=await run('C:/Program Files/GitHub CLI/gh.exe',['api',endpoint]);
  await writeFile(`${out}/${name}.json`,JSON.stringify(JSON.parse(stdout),null,2)+'\n');
  results.push({name,endpoint,observedAt:new Date().toISOString()});
}
await writeFile(`${out}/queries.json`,JSON.stringify({operation:'复用宿主 gh 登录，只读 API',results},null,2)+'\n');
console.log(`保存 ${results.length} 份远程回执`);
