'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),net=require('node:net'),{spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {buildAuthoringKit}=require('./authoring-kit.cjs');
const {createOperationsPreview}=require('./operations-preview.cjs');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
async function freePort(){const s=net.createServer();await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok);});const port=s.address().port;await new Promise(ok=>s.close(ok));return port;}
async function startLocal({node,frontend,service,state,config={},key,logFile,localAuthoring=false,browserPreview=false,resolveProxy}){
 await fs.mkdir(state,{recursive:true});const apiPort=await freePort(),api='http://127.0.0.1:'+apiPort;let sessionCookie='',sessionExpiresAt=0,refreshSession=async()=>false;
 const preview=createOperationsPreview({resolveProxy});
 const cookieName='hetun_local_'+randomBytes(12).toString('hex');
 function backendCookie(raw=''){const entries=raw.split(';').map(v=>v.trim());const scoped=entries.find(v=>v.startsWith(cookieName+'='));return scoped?'hetun_session='+scoped.slice(cookieName.length+1):raw;}
 const proxy=http.createServer(async(req,res)=>{try{
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){res.writeHead(403);return res.end('Invalid host');}
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/admin/authoring-kit'){
   const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
   const reject=(status,error,extra={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});req.resume();res.end(JSON.stringify({error}));};
   if(!localAuthoring)return reject(404,'页面不存在');
   if(req.method!=='POST')return reject(405,'请使用 POST 下载制作底座',{Allow:'POST'});
   const cookies=(req.headers.cookie||'').split(';').map(v=>v.trim());
   if(!sessionCookie||Date.now()>=sessionExpiresAt||!cookies.includes(cookieName+'='+sessionCookie))return reject(401,'本机会话已失效，请重新打开主题中心');
   if(req.headers.origin!=='http://'+req.headers.host)return reject(403,'无效的下载来源');
   if(url.search||req.headers['transfer-encoding']||(req.headers['content-length']&&req.headers['content-length']!=='0'))return reject(400,'制作底座下载不接受参数或请求内容');
   let bundle;
   try{bundle=await buildAuthoringKit();}catch{return reject(500,'骨架制作底座资源缺失或与定稿不一致，请检查软件安装。');}
   res.writeHead(200,{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+bundle.name+'"','Content-Length':bundle.bytes.length});
   return res.end(bundle.bytes);
  }
  if(localAuthoring&&await preview.handle(req,res,url,{authorized:!!sessionCookie&&backendCookie(req.headers.cookie).split(';').some(v=>v.trim()==='hetun_session='+sessionCookie),origin:'http://'+req.headers.host}))return;
  if(url.pathname==='/api/admin/local-packer'){res.writeHead(410,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'主题中心独立运行，请导出主题包后在打包器手动导入。',code:'INDEPENDENT_APPS'}));}
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
 let stopping;function stop(){if(stopping)return stopping;stopping=(async()=>{preview.stop();proxy.closeAllConnections();await new Promise(ok=>proxy.close(ok));if(!exited)await new Promise(ok=>{const timer=setTimeout(()=>{child.kill('SIGKILL');ok();},3000);child.once('exit',()=>{clearTimeout(timer);ok();});child.kill();});})();return stopping;}
 try{let ready=false;for(let i=0;i<100;i++){if(exited)throw Error('主题服务启动失败：'+failure);try{const r=await fetch(api+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,100));}if(!ready)throw Error('主题服务启动超时');
 const creds=JSON.parse(await fs.readFile(path.join(state,'admin-credentials.json'),'utf8'));
 async function loginLocalSession(){const login=await fetch(api+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Hetun-Client':'studio'},body:JSON.stringify({username:creds.username,password:creds.password})});if(!login.ok)throw Error('本机主题会话初始化失败');const cookie=login.headers.get('set-cookie')?.match(/hetun_session=([^;]+)/)?.[1];if(!cookie)throw Error('本机会话缺失');sessionCookie=cookie;sessionExpiresAt=Date.now()+7*60*60*1000;return true;}
 await loginLocalSession();
 refreshSession=async()=>{if(!localAuthoring||Date.now()<sessionExpiresAt)return false;return loginLocalSession();};
 return {origin,api,cookie:sessionCookie,cookieName,child,stop};}catch(e){await stop();throw e;}
}
module.exports={startLocal};
