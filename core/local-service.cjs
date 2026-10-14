'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),net=require('node:net'),{spawn}=require('node:child_process');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
async function freePort(){const s=net.createServer();await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok);});const port=s.address().port;await new Promise(ok=>s.close(ok));return port;}
async function startLocal({node,frontend,service,state,config={},key,logFile,localAuthoring=false,authorize,productCenter,browserPreview=false}){
 await fs.mkdir(state,{recursive:true});const apiPort=await freePort(),api='http://127.0.0.1:'+apiPort;let sessionCookie='';
 const proxy=http.createServer(async(req,res)=>{try{
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){res.writeHead(403);return res.end('Invalid host');}
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/desktop/')){
   if(!sessionCookie||!req.headers.cookie?.split(';').some(x=>x.trim()==='hetun_session='+sessionCookie)){res.writeHead(401);return res.end();}
   if(!productCenter)throw Error('产品连接尚未初始化');
   if(url.pathname==='/desktop/download-file'&&req.method==='GET'){
    if(req.headers['sec-fetch-site']==='cross-site')throw Error('无效下载来源');
    const {file,name}=await productCenter.verifiedFile(url.searchParams.get('id'));
    const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(path.basename(name)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
   }
   if(req.method!=='POST'||req.headers.origin!=='http://'+req.headers.host){res.writeHead(403);return res.end();}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)throw Error('请求过大');}
   const input=JSON.parse(body||'{}'),route=url.pathname.slice(9);
   const value=route==='activate'?await productCenter.auth.activate(String(input.key||'')):await productCenter.command(route,input);
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(value));
  }
  if(url.pathname.startsWith('/api/')){
   authorize?.();const headers={...req.headers,host:'127.0.0.1:'+apiPort};delete headers.connection;
   const upstream=http.request(api+req.url,{method:req.method,headers},r=>{
    res.writeHead(r.statusCode,r.headers);r.pipe(res);
    if(productCenter&&r.statusCode>=200&&r.statusCode<300){
     // Only the real service's successful response creates a product record.
     let chunks=[],size=0;const install=url.pathname==='/api/admin/install'&&req.method==='POST',exported=url.pathname==='/api/admin/export'&&req.method==='GET';
     if(install||exported){r.on('data',chunk=>{size+=chunk.length;if(size<=64*1024*1024)chunks.push(chunk);});r.on('end',()=>{if(size>64*1024*1024)return;try{const value=JSON.parse(Buffer.concat(chunks));const details=exported?{result:'generated',themeId:url.searchParams.get('template')||'',name:String(value.name||'').slice(0,500)}:{result:'installed'};void productCenter.record(exported?'theme-export':'template-install',details).catch(()=>{});}catch{}});}
    }
   });
   upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'本机主题服务暂时不可用，请重启软件。'}));});req.pipe(upstream);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let rel=decodeURIComponent(url.pathname).slice(1)||'index.html';if(rel.includes('\\')||rel.split('/').some(v=>v==='..')||rel.includes(':'))throw Error('Invalid path');
  const file=path.resolve(frontend,rel),base=path.resolve(frontend);if(!file.startsWith(base+path.sep))throw Error('Invalid path');const bytes=await fs.readFile(file);
  res.writeHead(200,{...(browserPreview&&rel==='index.html'&&sessionCookie?{'Set-Cookie':'hetun_session='+sessionCookie+'; HttpOnly; SameSite=Strict; Path=/'}:{}),'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; media-src 'self' blob: https: http:; connect-src 'self' https: http:; font-src 'self' data:; frame-src https: http:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){if(!res.headersSent)res.writeHead(e.code==='ENOENT'?404:e.message==='Invalid path'||e instanceof URIError?400:403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.code==='ENOENT'?'页面不存在':e.message}));}});
 await new Promise((ok,no)=>{proxy.once('error',no);proxy.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+proxy.address().port;
 if(!localAuthoring){if(config.publicKey)await fs.writeFile(path.join(state,'trusted-public.pem'),config.publicKey,{mode:0o600});await fs.writeFile(path.join(state,'cloud-license.json'),JSON.stringify({key:key||''}),{mode:0o600});}
 const child=spawn(node,[path.join(service,'server/index.mjs')],{windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',HETUN_STATE_DIR:state,HETUN_HOST:'127.0.0.1',HETUN_PORT:String(apiPort),HETUN_PUBLIC_ORIGIN:origin,HETUN_PRODUCT_MODE:'theme-center',HETUN_LOCAL_THEME_AUTHORING:localAuthoring?'1':'0',HETUN_LICENSE_URL:config.url||'',HETUN_LICENSE_DOMAIN:config.domain||'127.0.0.1',HETUN_LICENSE_PUBLIC_KEY_FILE:config.publicKey?path.join(state,'trusted-public.pem'):''},stdio:['ignore','pipe','pipe']});
 let failure='',exited=false;child.once('error',e=>{failure=e.message;exited=true;});child.once('exit',()=>{exited=true;});for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{failure=(failure+b.toString()).slice(-8000);if(logFile)fs.appendFile(logFile,b).catch(()=>{});});
 let stopping;function stop(){if(stopping)return stopping;stopping=(async()=>{proxy.closeAllConnections();await new Promise(ok=>proxy.close(ok));if(!exited)await new Promise(ok=>{const timer=setTimeout(()=>{child.kill('SIGKILL');ok();},3000);child.once('exit',()=>{clearTimeout(timer);ok();});child.kill();});})();return stopping;}
 try{let ready=false;for(let i=0;i<100;i++){if(exited)throw Error('主题服务启动失败：'+failure);try{const r=await fetch(api+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,100));}if(!ready)throw Error('主题服务启动超时');
 const creds=JSON.parse(await fs.readFile(path.join(state,'admin-credentials.json'),'utf8'));const login=await fetch(api+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Hetun-Client':'studio'},body:JSON.stringify({username:creds.username,password:creds.password})});if(!login.ok)throw Error('本机主题会话初始化失败');const cookie=login.headers.get('set-cookie')?.match(/hetun_session=([^;]+)/)?.[1];if(!cookie)throw Error('本机会话缺失');sessionCookie=cookie;return {origin,api,cookie,child,stop};}catch(e){await stop();throw e;}
}
module.exports={startLocal};
