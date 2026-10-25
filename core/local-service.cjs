'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),net=require('node:net'),{spawn}=require('node:child_process');
const {queueTheme,readStatus,atomic,linkRoot,readCapabilities}=require('./local-link.cjs');
const {createCatalog}=require('./local-catalog.cjs');
const {randomBytes}=require('node:crypto');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
async function freePort(){const s=net.createServer();await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok);});const port=s.address().port;await new Promise(ok=>s.close(ok));return port;}
async function startLocal({node,frontend,service,state,config={},key,logFile,localAuthoring=false,browserPreview=false,linkDirectory=linkRoot()}){
 await fs.mkdir(state,{recursive:true});const apiPort=await freePort(),api='http://127.0.0.1:'+apiPort;let sessionCookie='',sessionExpiresAt=0,refreshSession=async()=>false;
 const cookieName='hetun_local_'+randomBytes(12).toString('hex');
 function backendCookie(raw=''){const entries=raw.split(';').map(v=>v.trim());const scoped=entries.find(v=>v.startsWith(cookieName+'='));return scoped?'hetun_session='+scoped.slice(cookieName.length+1):raw;}
 const proxy=http.createServer(async(req,res)=>{try{
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){res.writeHead(403);return res.end('Invalid host');}
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/admin/local-packer'){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   const cookie=backendCookie(req.headers.cookie).split(';').map(v=>v.trim()).find(v=>v.startsWith('hetun_session='))?.slice(14);
   if(!localAuthoring||!sessionCookie||cookie!==sessionCookie){res.writeHead(401);return res.end(JSON.stringify({error:'本机会话无效'}));}
   if(req.method==='GET'){res.writeHead(200);return res.end(JSON.stringify({...await readStatus(url.searchParams.get('id'),linkDirectory),...(!url.searchParams.get('id')?{capabilities:await readCapabilities(linkDirectory)}:{})}));}
   if(req.method!=='POST'){res.writeHead(405);return res.end();}
   if(req.headers.origin!==origin||req.headers['x-hetun-client']!=='studio'||!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(403);return res.end(JSON.stringify({error:'本机请求来源无效'}));}
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('请求过大');body+=chunk.toString();}const input=JSON.parse(body);
   if(typeof input.template!=='string'||!input.template||input.template.length>100)throw Error('请选择主题');
   const exported=await fetch(api+'/api/admin/export?template='+encodeURIComponent(input.template),{headers:{Cookie:'hetun_session='+sessionCookie},signal:AbortSignal.timeout(10000)});const bundle=await exported.json();if(!exported.ok)throw Error(bundle.error||'主题导出失败');
   if(input.action&&input.action!=='check')throw Error('本机操作无效');
   const peer=await readCapabilities(linkDirectory);let report={ready:false,errors:[peer?.error||'请启动打包器并选择基础 APK'],missing:[],renderer:'',contract:'hetun-package-v1'};
   if(peer?.base){try{const {readZip}=require('./zip.cjs'),{compatibility}=require(path.join(service,'server/package-contract.cjs'));const manifest=JSON.parse(readZip(Buffer.from(bundle.data,'base64')).get('manifest.json'));report=compatibility(peer.base,manifest,peer.app?.device);}catch(e){report={...report,errors:[e.message]};}}
   if(input.action==='check'){res.writeHead(200);return res.end(JSON.stringify({report,baseDigest:peer?.baseDigest||'',app:peer?.app||null}));}
   const result={...await queueTheme(bundle,linkDirectory),compatibility:report};res.writeHead(200);return res.end(JSON.stringify(result));
  }
  if(url.pathname.startsWith('/desktop/')){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'离线主题中心不提供云端功能。',code:'OFFLINE_ONLY'}));}
  if(url.pathname.startsWith('/api/')){
   const incomingCookie=backendCookie(req.headers.cookie);
   const authorized=localAuthoring&&url.pathname.startsWith('/api/admin/')&&incomingCookie.split(';').some(value=>value.trim()==='hetun_session='+sessionCookie);
   const sessionRotated=authorized?await refreshSession():false;
   const headers={...req.headers,host:'127.0.0.1:'+apiPort,cookie:authorized?'hetun_session='+sessionCookie:incomingCookie};delete headers.connection;
   const upstream=http.request(api+req.url,{method:req.method,headers},r=>{
    const responseHeaders={...r.headers};
    if(sessionRotated)responseHeaders['set-cookie']=[cookieName+'='+sessionCookie+'; HttpOnly; SameSite=Strict; Path=/'];
    if(responseHeaders['set-cookie'])responseHeaders['set-cookie']=responseHeaders['set-cookie'].map(value=>value.replace(/^hetun_session=/,cookieName+'='));
    res.writeHead(r.statusCode,responseHeaders);r.pipe(res);

   });
   upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'本机主题服务暂时不可用，请重启软件。'}));});req.pipe(upstream);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let rel=decodeURIComponent(url.pathname).slice(1)||'index.html';if(rel.includes('\\')||rel.split('/').some(v=>v==='..')||rel.includes(':'))throw Error('Invalid path');
  const file=path.resolve(frontend,rel),base=path.resolve(frontend);if(!file.startsWith(base+path.sep))throw Error('Invalid path');const bytes=await fs.readFile(file);
  res.writeHead(200,{...(browserPreview&&rel==='index.html'&&sessionCookie?{'Set-Cookie':cookieName+'='+sessionCookie+'; HttpOnly; SameSite=Strict; Path=/'}:{}),'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self' data:; frame-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){if(!res.headersSent)res.writeHead(e.code==='ENOENT'?404:e.message==='Invalid path'||e instanceof URIError?400:403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.code==='ENOENT'?'页面不存在':e.message}));}});
 await new Promise((ok,no)=>{proxy.once('error',no);proxy.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+proxy.address().port;
 if(!localAuthoring){if(config.publicKey)await fs.writeFile(path.join(state,'trusted-public.pem'),config.publicKey,{mode:0o600});await fs.writeFile(path.join(state,'cloud-license.json'),JSON.stringify({key:key||''}),{mode:0o600});}
 const child=spawn(node,[...(localAuthoring?['--require',path.join(__dirname,'offline-network.cjs')]:[]),path.join(service,'server/index.mjs')],{windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',HETUN_STATE_DIR:state,HETUN_HOST:'127.0.0.1',HETUN_PORT:String(apiPort),HETUN_PUBLIC_ORIGIN:origin,HETUN_PRODUCT_MODE:'theme-center',HETUN_LOCAL_THEME_AUTHORING:localAuthoring?'1':'0',HETUN_LICENSE_URL:config.url||'',HETUN_LICENSE_DOMAIN:config.domain||'127.0.0.1',HETUN_LICENSE_PUBLIC_KEY_FILE:config.publicKey?path.join(state,'trusted-public.pem'):''},stdio:['ignore','pipe','pipe']});
 let failure='',exited=false;child.once('error',e=>{failure=e.message;exited=true;});child.once('exit',()=>{exited=true;});for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{failure=(failure+b.toString()).slice(-8000);if(logFile)fs.appendFile(logFile,b).catch(()=>{});});
 let catalogTimer,catalogWork;
 let stopping;function stop(){if(stopping)return stopping;stopping=(async()=>{clearInterval(catalogTimer);await catalogWork?.catch(()=>{});proxy.closeAllConnections();await new Promise(ok=>proxy.close(ok));if(!exited)await new Promise(ok=>{const timer=setTimeout(()=>{child.kill('SIGKILL');ok();},3000);child.once('exit',()=>{clearTimeout(timer);ok();});child.kill();});})();return stopping;}
 try{let ready=false;for(let i=0;i<100;i++){if(exited)throw Error('主题服务启动失败：'+failure);try{const r=await fetch(api+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,100));}if(!ready)throw Error('主题服务启动超时');
 const creds=JSON.parse(await fs.readFile(path.join(state,'admin-credentials.json'),'utf8'));
 async function loginLocalSession(){const login=await fetch(api+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Hetun-Client':'studio'},body:JSON.stringify({username:creds.username,password:creds.password})});if(!login.ok)throw Error('本机主题会话初始化失败');const cookie=login.headers.get('set-cookie')?.match(/hetun_session=([^;]+)/)?.[1];if(!cookie)throw Error('本机会话缺失');sessionCookie=cookie;sessionExpiresAt=Date.now()+7*60*60*1000;return true;}
 await loginLocalSession();
 refreshSession=async()=>{if(!localAuthoring||Date.now()<sessionExpiresAt)return false;return loginLocalSession();};
 if(localAuthoring){
  const read=async route=>{const response=await fetch(api+route,{headers:{Cookie:'hetun_session='+sessionCookie},signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw Error(data.error||'本机主题库读取失败');return data;};
  const catalog=createCatalog({root:linkDirectory,load:async()=>(await read('/api/admin/state')).templates,exportTheme:id=>read('/api/admin/export?template='+encodeURIComponent(id))});
  const refresh=()=>{catalogWork=(async()=>{let syncError='';try{await catalog.sync();}catch(e){syncError=e.message;if(logFile)fs.appendFile(logFile,'本机主题库同步失败：'+e.message+'\n').catch(()=>{});}await atomic(path.join(linkDirectory,'theme-center.json'),{protocol:1,updatedAt:new Date().toISOString(),syncError});})().catch(()=>{});return catalogWork;};
  await refresh();catalogTimer=setInterval(refresh,2000);catalogTimer.unref?.();
 }
 return {origin,api,cookie:sessionCookie,cookieName,child,stop};}catch(e){await stop();throw e;}
}
module.exports={startLocal};
