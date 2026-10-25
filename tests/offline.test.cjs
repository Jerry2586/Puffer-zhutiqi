'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const {startLocal}=require('../core/local-service.cjs');
test('离线服务拒绝CMS/播放/授权/云端接口，忽略旧联网配置并保留本机数据',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-offline-'));let local;let hits=0;
 const upstream=http.createServer((_q,r)=>{hits++;r.end('{}');});await new Promise(ok=>upstream.listen(0,'127.0.0.1',ok));
 t.after(async()=>{await local?.stop();await new Promise(ok=>upstream.close(ok));await fs.rm(root,{recursive:true,force:true});});
 const front=path.join(root,'front'),state=path.join(root,'state');await fs.mkdir(front);await fs.mkdir(state);await fs.writeFile(path.join(front,'index.html'),'<html>offline</html>');
 // A corrupt, obsolete key file must never be read by offline authoring.
 await fs.writeFile(path.join(state,'cloud-license.json'),'old-invalid-key-cache');
 async function boot(){local=await startLocal({node:process.execPath,frontend:front,service:path.resolve('shared-source'),state,linkDirectory:path.join(root,'test-local-link'),localAuthoring:true,browserPreview:true});}
 await boot();let stored=JSON.parse(await fs.readFile(path.join(state,'theme-state.json'),'utf8'));stored.cmsBase='http://127.0.0.1:'+upstream.address().port+'/api.php/provide/vod/';await local.stop();await fs.writeFile(path.join(state,'theme-state.json'),JSON.stringify(stored));await boot();
 const headers={Cookie:'hetun_session='+local.cookie,Origin:local.origin,'X-Hetun-Client':'studio','Content-Type':'application/json'};
 for(const [route,method] of [['/api/admin/cms/status','GET'],['/api/admin/cms/check','POST'],['/api/admin/cms','PUT'],['/api/admin/license','GET'],['/api/admin/license','PUT'],['/api/catalog','GET'],['/api/catalog/categories','GET'],['/api/playback','POST'],['/api/member/config','GET'],['/desktop/state','POST'],['/desktop/activate','POST']]){
  for(const origin of route.startsWith('/desktop/')?[local.origin]:[local.origin,local.api]){const response=await fetch(origin+route,{method,headers,body:method==='GET'?undefined:JSON.stringify({base:stored.cmsBase,key:'unused'})});assert.equal(response.status,404,origin+route);assert.equal((await response.json()).code,'OFFLINE_ONLY');}
 }
 const page=await fetch(local.origin);const csp=page.headers.get('content-security-policy');assert.match(csp,/connect-src 'self';/);assert.match(csp,/img-src 'self' data:;/);assert.match(csp,/media-src 'self' blob:;/);assert.match(csp,/frame-src 'none'/);assert.ok(!csp.includes('https:'));assert.ok(page.headers.get('set-cookie').includes('HttpOnly'));
 const health=await(await fetch(local.api+'/api/health')).json();assert.equal(health.offline,true);assert.equal(health.cmsConfigured,false);
 assert.equal((await fetch(local.origin+'/api/admin/state',{headers})).status,200);assert.equal(hits,0);assert.equal(await fs.readFile(path.join(state,'cloud-license.json'),'utf8'),'old-invalid-key-cache');
});
test('离线子进程在fetch、HTTP和socket层阻断出站连接',async()=>{
 const guard=path.resolve('core/offline-network.cjs');const script= "const assert=require('node:assert/strict');(async()=>{await assert.rejects(fetch('https://example.com'),{code:'OFFLINE_ONLY'});assert.throws(()=>require('node:http').get('http://127.0.0.1:1'),{code:'OFFLINE_ONLY'});assert.throws(()=>require('node:net').connect(1,'127.0.0.1'),{code:'OFFLINE_ONLY'});const http=await import('node:http');assert.throws(()=>http.get('http://127.0.0.1:1'),{code:'OFFLINE_ONLY'});})().catch(e=>{console.error(e);process.exitCode=1;});";
 const child=spawn(process.execPath,['--require',guard,'-e',script],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',v=>output+=v);const code=await new Promise((ok,no)=>{child.once('error',no);child.once('exit',ok);});assert.equal(code,0,output);
});
test('两个本地预览共享浏览器Cookie时仍可独立使用，无需手动登录',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-preview-sessions-'));const locals=[];
 t.after(async()=>{await Promise.all(locals.map(local=>local.stop()));await fs.rm(root,{recursive:true,force:true});});
 const frontend=path.join(root,'front');await fs.mkdir(frontend);await fs.writeFile(path.join(frontend,'index.html'),'<html>preview</html>');
 const jar=new Map();
 for(let i=0;i<2;i++){
  const local=await startLocal({node:process.execPath,frontend,service:path.resolve('shared-source'),state:path.join(root,'state'+i),linkDirectory:path.join(root,'link'+i),localAuthoring:true,browserPreview:true});locals.push(local);
  const page=await fetch(local.origin);const cookie=page.headers.get('set-cookie').split(';')[0];const separator=cookie.indexOf('=');jar.set(cookie.slice(0,separator),cookie.slice(separator+1));
 }
 assert.equal(jar.size,2,'不同端口的预览必须使用不同Cookie名称');
 // Include an unrelated old preview cookie, including a more-specific /api cookie.
 const cookie='hetun_session=stale-api-session; '+[...jar].map(([name,value])=>name+'='+value).join('; ')+'; hetun_session=stale-root-session';
 for(const local of locals){
  for(const route of ['/api/admin/state','/api/admin/local-packer']){
   const response=await fetch(local.origin+route,{headers:{Cookie:cookie}});assert.equal(response.status,200,route);
  }
  assert.equal((await fetch(local.origin+'/api/admin/state')).status,401,'未建立本机会话的请求仍需拒绝');
  assert.equal((await fetch(local.origin+'/api/admin/state',{headers:{Cookie:cookie,Origin:'https://foreign.example'}})).status,403);
 }
});
