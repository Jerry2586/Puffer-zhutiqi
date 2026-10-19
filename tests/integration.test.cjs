'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),http=require('node:http'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url'),{spawn}=require('node:child_process');
const {startLocal}=require('../core/local-service.cjs'),{LicenseClient,verifyLease}=require('../core/license.cjs'),{makeZip,readZip}=require('../core/zip.cjs');
const film=process.env.HETUN_FILM_SOURCE||path.resolve(__dirname,'../shared-source'),cloud=process.env.HETUN_CLOUD_SOURCE||path.resolve(__dirname,'fixtures/license-server');
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function stop(p){if(p.exitCode!==null)return;await new Promise(r=>{const timer=setTimeout(()=>{p.kill('SIGKILL');r();},3000);p.once('exit',()=>{clearTimeout(timer);r();});p.kill();});}
async function ready(url,p){for(let i=0;i<100;i++){if(p.exitCode!==null)throw Error('测试服务启动失败');try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('测试服务超时');}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHuoAAAAASUVORK5CYII=','base64');
test('实际素材导出、授权前校验、主题包回导与损坏包拒绝',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-theme-export-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const {defaultTheme}=await import(pathToFileURL(path.join(film,'server/theme.mjs')).href),{exportTheme}=await import(pathToFileURL(path.join(film,'server/export-theme.mjs')).href),{installPackage}=await import(pathToFileURL(path.join(film,'server/packages.mjs')).href);
 const assets=path.join(root,'assets');await fs.mkdir(assets);const name=crypto.createHash('sha256').update(png).digest('hex')+'.png';await fs.writeFile(path.join(assets,name),png);
 const theme=structuredClone(defaultTheme);theme.brand.logo='/api/assets/'+name;theme.brand.name='导出测试';
 const pack=await exportTheme({id:'test-theme',name:'测试主题',platform:'mobile',draft:theme},assets),entries=readZip(pack),manifest=JSON.parse(entries.get('manifest.json'));
 assert.equal(manifest.theme.brand.logo,'assets/'+name);assert.deepEqual(entries.get('assets/'+name),png);assert.equal(entries.size,2);
 let checked=false;const imported=await installPackage({data:pack.toString('base64')},path.join(root,'import'),async id=>{assert.equal(id,'test-theme');checked=true;});assert.ok(checked);assert.equal(imported.draft.brand.logo,theme.brand.logo);assert.equal(imported.draft.brand.name,'导出测试');
 await assert.rejects(installPackage({data:pack.toString('base64')},path.join(root,'denied'),async()=>{throw Error('未授权');}),/未授权/);await assert.rejects(fs.stat(path.join(root,'denied')),{code:'ENOENT'});
 await fs.unlink(path.join(assets,name));await assert.rejects(exportTheme({id:'test-theme',name:'测试',platform:'mobile',draft:theme},assets),{code:'ENOENT'});
 const broken=Buffer.from(pack);broken[45]^=1;assert.throws(()=>readZip(broken));assert.throws(()=>readZip(makeZip(new Map([['../outside',png]]))));
});
test('真实云端主题独立授权、桌面服务保存发布导出、接口边界与服务退出',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-theme-integration-')),cp=await port(),origin='http://127.0.0.1:'+cp;
 const cloudProcess=spawn(process.execPath,[path.join(cloud,'server/index.mjs')],{windowsHide:true,env:{...process.env,HETUN_CLOUD_STATE:path.join(root,'cloud'),HETUN_CLOUD_HOST:'127.0.0.1',HETUN_CLOUD_PORT:String(cp),HETUN_CLOUD_ORIGIN:origin,HETUN_CLOUD_EXECUTION_ENABLED:'0'},stdio:'ignore'});
 const locals=[];t.after(async()=>{for(const l of locals)await l.stop();await stop(cloudProcess);await fs.rm(root,{recursive:true,force:true});});
 await ready(origin+'/v1/license/health',cloudProcess);const health=await(await fetch(origin+'/v1/license/health')).json();const cred=await fs.readFile(path.join(root,'cloud/bootstrap-admin.txt'),'utf8');const password=cred.match(/密码：([^\n]+)/)[1];
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password})});assert.equal(login.status,200);const {csrf}=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
 const headers={Origin:origin,Cookie:cookie,'X-Hetun-CSRF':csrf,'Content-Type':'application/json'};
 async function issue(overrides={}){const r=await fetch(origin+'/api/licenses',{method:'POST',headers,body:JSON.stringify({name:'测试主题授权',domains:['127.0.0.1'],scopes:['theme'],themes:['*'],expiresAt:new Date(Date.now()+3600000).toISOString(),...overrides})});assert.equal(r.status,201);return r.json();}
 const authorized=await issue(),config={url:origin,domain:'127.0.0.1',publicKey:health.publicKey,key:authorized.key};
 const client=new LicenseClient(config);const lease=await client.require('theme');assert.equal(lease.licenseExpiresAt,authorized.license.expiresAt);await assert.rejects(client.require('film-center'),/未授权产品/);await assert.rejects(new LicenseClient({...config,domain:'wrong.example'}).require('theme'),/域名/);
 const limited=await issue({themes:['another-theme']});await assert.rejects(new LicenseClient({...config,key:limited.key}).require('theme','hetun-kuying-mobile'),/此主题未授权/);
 const expired=await issue({expiresAt:new Date(Date.now()-1000).toISOString()});await assert.rejects(new LicenseClient({...config,key:expired.key}).require('theme'),/到期/);
 const disabled=await issue({enabled:false});await assert.rejects(new LicenseClient({...config,key:disabled.key}).require('theme'),/停用/);
 const frontend=path.join(root,'frontend');await fs.mkdir(frontend);await fs.writeFile(path.join(frontend,'index.html'),'<h1>实际静态服务测试</h1>');
 const local=await startLocal({node:process.execPath,frontend,service:film,state:path.join(root,'editor'),config,key:authorized.key});locals.push(local);
 async function request(route,method='GET',body){return fetch(local.origin+route,{method,headers:{Origin:local.origin,Cookie:'hetun_session='+local.cookie,'X-Hetun-Client':'studio','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
 const response=await request('/api/admin/state');assert.equal(response.status,200);let state=await response.json();assert.equal(state.templates.length,1);assert.equal(state.templates[0].platform,'mobile');
 const id=state.selectedTemplate;state.draft.brand.name='独立桌面测试';const save=await request('/api/admin/draft','PUT',{template:id,version:state.version,theme:state.draft});assert.equal(save.status,200);state=await save.json();
 const publish=await request('/api/admin/publish','POST',{template:id,version:state.version});assert.equal(publish.status,200);const preview=await request('/api/theme?platform=mobile');assert.equal(preview.status,200);assert.equal((await preview.json()).theme.brand.name,'独立桌面测试');
 assert.equal((await request('/api/theme?platform=tablet')).status,404);assert.equal((await request('/api/admin/export?template='+id)).status,200);
 assert.equal((await request('/api/admin/member')).status,404);assert.equal((await request('/api/member/login','POST',{})).status,404);
 const foreign=await fetch(local.origin+'/api/admin/draft',{method:'PUT',headers:{Origin:'http://127.0.0.1:5173',Cookie:'hetun_session='+local.cookie,'X-Hetun-Client':'studio','Content-Type':'application/json'},body:'{}'});assert.equal(foreign.status,403);
 assert.equal((await fetch(local.origin)).status,200);assert.equal((await fetch(local.origin+'/%2e%2e%5coutside')).status,400);
 const hostile=await new Promise((resolve,reject)=>{const req=http.get(local.origin,{headers:{Host:'malicious.example'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});req.on('error',reject);});assert.equal(hostile,403);
 const filmOnly=await issue({scopes:['film-center'],themes:[]});const blocked=await startLocal({node:process.execPath,frontend,service:film,state:path.join(root,'blocked'),config,key:filmOnly.key});locals.push(blocked);const blockedResponse=await fetch(blocked.origin+'/api/admin/state',{headers:{Cookie:'hetun_session='+blocked.cookie}});assert.equal(blockedResponse.status,403);
 await local.stop();await assert.rejects(fetch(local.api+'/api/health',{signal:AbortSignal.timeout(1000)}));await assert.rejects(fetch(local.origin,{signal:AbortSignal.timeout(1000)}));
});
test('签名响应篡改和签名已过期响应都无法解锁',()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),now=Date.now(),sec=Math.floor(now/1000),config={publicKey:publicKey.export({type:'spki',format:'pem'}),issuer:'http://127.0.0.1:1234',scope:'theme',hostname:'127.0.0.1',nonce:'test',now};
 const base={issuer:config.issuer,scope:'theme',domain:config.hostname,nonce:'test',iat:sec,exp:sec+300,licenseExpiresAt:new Date(now+3600000).toISOString(),themes:['*'],licenseId:'test'};
 function sign(p){const bytes=Buffer.from(JSON.stringify(p));return {payload:bytes.toString('base64url'),signature:crypto.sign(null,bytes,privateKey).toString('base64url')};}
 assert.equal(verifyLease(sign(base),config).scope,'theme');assert.throws(()=>verifyLease(sign({...base,exp:sec-1}),config),/到期/);assert.throws(()=>verifyLease({...sign(base),payload:Buffer.from(JSON.stringify({...base,scope:'packer'})).toString('base64url')},config),/签名/);
});

test('无Key本地作者模式实际保存发布导出，并保留会话与来源校验',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-local-author-'));let local;
 t.after(async()=>{await local?.stop();await fs.rm(root,{recursive:true,force:true});});
 const frontend=path.join(root,'frontend');await fs.mkdir(frontend);await fs.writeFile(path.join(frontend,'index.html'),'<html>local</html>');
 const stateDir=path.join(root,'state');await fs.mkdir(stateDir);const previous='{ "key": "existing-value" }';await fs.writeFile(path.join(stateDir,'cloud-license.json'),previous);
 local=await startLocal({node:process.execPath,frontend,service:film,state:stateDir,config:{},key:'',localAuthoring:true});
 const headers={Cookie:'hetun_session='+local.cookie,Origin:local.origin,'X-Hetun-Client':'studio','Content-Type':'application/json'};
 assert.equal((await fetch(local.origin+'/api/admin/state')).status,401);
 const status=await(await fetch(local.origin+'/api/admin/license',{headers})).json();assert.equal(status.localAuthoring,true);assert.equal(status.products.theme.valid,false);
 const first=await fetch(local.origin+'/api/admin/state',{headers});assert.equal(first.status,200);const state=await first.json();assert.ok(state.templates.length);assert.ok(state.templates.every(v=>v.platform==='mobile'));
 state.draft.brand.name='本地作者测试';state.draft.integration={version:1,apiBase:'https://api.example.com/gateway'};const saved=await fetch(local.origin+'/api/admin/draft',{method:'PUT',headers,body:JSON.stringify({template:state.selectedTemplate,version:state.version,theme:state.draft})});assert.equal(saved.status,200);const next=await saved.json();assert.equal(next.draft.brand.name,'本地作者测试');assert.equal(next.draft.integration.apiBase,'https://api.example.com/gateway');
 const foreign=await fetch(local.origin+'/api/admin/draft',{method:'PUT',headers:{...headers,Origin:'https://wrong.example'},body:'{}'});assert.equal(foreign.status,403);
 assert.equal((await fetch(local.origin+'/api/admin/state',{headers:{...headers,Origin:'https://wrong.example'}})).status,403);
 const published=await fetch(local.origin+'/api/admin/publish',{method:'POST',headers,body:JSON.stringify({template:next.selectedTemplate,version:next.version})});assert.equal(published.status,200);
 const exported=await fetch(local.origin+'/api/admin/export?template='+next.selectedTemplate,{headers});assert.equal(exported.status,200);const bundle=await exported.json();const manifest=JSON.parse(readZip(Buffer.from(bundle.data,'base64')).get('manifest.json'));assert.equal(manifest.theme.brand.name,'本地作者测试');assert.equal(manifest.clientContract.apiBase,'https://api.example.com/gateway');assert.deepEqual(manifest.clientContract.targets,['android-phone','ios-iphone']);
 assert.equal((await fetch(local.origin+'/api/theme?platform=tablet')).status,404);
 assert.equal((await fetch(local.origin+'/api/member/plans',{headers})).status,404);
 assert.equal(await fs.readFile(path.join(stateDir,'cloud-license.json'),'utf8'),previous);
});
test('运营中心不接受本地作者标志，仍要求真实云授权',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-author-boundary-')),apiPort=await port(),origin='http://127.0.0.1:'+apiPort;
 const child=spawn(process.execPath,[path.join(film,'server/index.mjs')],{windowsHide:true,env:{...process.env,HETUN_STATE_DIR:root,HETUN_HOST:'127.0.0.1',HETUN_PORT:String(apiPort),HETUN_PUBLIC_ORIGIN:origin,HETUN_PRODUCT_MODE:'operations-center',HETUN_LOCAL_THEME_AUTHORING:'1',HETUN_LICENSE_URL:'',HETUN_LICENSE_PUBLIC_KEY_FILE:''},stdio:'ignore'});
 t.after(async()=>{await stop(child);await fs.rm(root,{recursive:true,force:true});});await ready(origin+'/api/health',child);
 const creds=JSON.parse(await fs.readFile(path.join(root,'admin-credentials.json'),'utf8'));const headers={Origin:origin,'X-Hetun-Client':'studio','Content-Type':'application/json'};
 const login=await fetch(origin+'/api/admin/login',{method:'POST',headers,body:JSON.stringify({username:creds.username,password:creds.password})});assert.equal(login.status,200);headers.Cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(origin+'/api/admin/state',{headers})).status,403);const status=await(await fetch(origin+'/api/admin/license',{headers})).json();assert.equal(status.localAuthoring,false);assert.equal(status.products['film-center'].valid,false);
});
