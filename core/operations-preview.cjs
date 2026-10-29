'use strict';
const { randomBytes } = require('node:crypto');
const { request: httpRequest } = require('node:http');
const { request: httpsRequest } = require('node:https');
const { lookup } = require('node:dns');
const { isIP, BlockList } = require('node:net');
const { Transform, pipeline } = require('node:stream');
const { createPreviewProxyAgent } = require('./preview-proxy-agent.cjs');

const privateNetworks = new BlockList();
for (const [ip, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]]) privateNetworks.addSubnet(ip,prefix,'ipv4');
// BlockList applies IPv4 subnets to IPv4-mapped IPv6 too; blocking the whole
// ::ffff:0:0/96 range would also reject every public IPv4 image host.
for (const [ip, prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['2001:db8::',32]]) privateNetworks.addSubnet(ip,prefix,'ipv6');
function privateAddress(address) { const family = isIP(address); return !family || privateNetworks.check(address, family===6?'ipv6':'ipv4'); }
function remote(value, base) {
 const url = new URL(value, base);
 if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.hash || url.href.length>8192) throw Error('请输入不含账号密码的 HTTP(S) 地址');
 return url;
}
async function bounded(response, max) {
 const chunks=[]; let size=0;
 for await (const chunk of response.body) { size+=chunk.length; if(size>max) { response.body.destroy?.(); throw Error('运营响应过大'); } chunks.push(chunk); }
 return Buffer.concat(chunks);
}
function createOperationsPreview({ resolveProxy } = {}) {
 let base='', generation=0, controller=new AbortController();
 const tokens=new Map(), reverse=new Map();
 function json(res,status,value) { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); }
 function clear() { controller.abort(); controller=new AbortController(); base=''; generation++; tokens.clear(); reverse.clear(); }
 function media(value, origin) {
  if(!value) return '';
  let url; try { url=remote(value,origin); } catch { return ''; }
  const existing=reverse.get(url.href); if(existing) return '/api/preview/media/'+existing;
  if(tokens.size>=4096) throw Error('预览素材数量过多，请重新连接');
  const token=randomBytes(24).toString('hex'); tokens.set(token,url.href); reverse.set(url.href,token); return '/api/preview/media/'+token;
 }
 function rewrite(value,origin,key='') {
  if(Array.isArray(value)) return value.map(v=>rewrite(v,origin));
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,origin,k)]));
  if(typeof value==='string' && ['icon','activeIcon'].includes(key) && !/^(?:https?:|\/|\.\.?\/)|[\/.]/i.test(value)) return value;
  return typeof value==='string' && ['poster','image','video','asset','logo','icon','activeIcon','backgroundImage','url'].includes(key) ? media(value,origin) : value;
 }
 // Only the root address explicitly entered by the user may resolve to a private host.
 // DNS is checked by the connection's own lookup callback, so a second lookup cannot bypass it.
 async function requestOnce(url, options, signal) {
  const trusted=url.origin===base;
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  if(!trusted && isIP(hostname) && privateAddress(hostname)) return Promise.reject(Error('素材地址不允许访问其他本机或内网服务'));
  const checkedLookup=(host,opts,callback)=>{
   lookup(host,{...opts,all:true},(error,addresses)=>{
    if(error) return callback(error);
    if(!addresses.length || (!trusted && addresses.some(a=>privateAddress(a.address)))) return callback(Error('素材地址不允许访问其他本机或内网服务'));
    if(opts.all) callback(null,addresses); else callback(null,addresses[0].address,addresses[0].family);
   });
  };
  const proxyRule=resolveProxy?await resolveProxy(url.href):'DIRECT';
  signal.throwIfAborted();
  const agent=createPreviewProxyAgent(url,proxyRule,checkedLookup,signal);
  return new Promise((resolve,reject)=>{
   const outgoing=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{
    method:options.method||'GET', headers:options.headers||{}, signal,
    ...(agent?{agent}:{}), lookup:checkedLookup
   },incoming=>{
    if(agent) incoming.once('close',()=>agent.destroy());
    resolve({status:incoming.statusCode,ok:incoming.statusCode>=200&&incoming.statusCode<300,headers:new Headers(incoming.headers),body:incoming});
   });
   outgoing.setTimeout(30000,()=>outgoing.destroy(Error('运营服务响应超时')));
   outgoing.once('error',error=>{agent?.destroy();reject(error);}); if(options.body) outgoing.write(options.body); outgoing.end();
  });
 }
 async function get(url,options,signal,api=false) {
  let current=remote(url);
  for(let i=0;i<4;i++) {
   if(api && current.origin!==base) throw Error('运营接口不能重定向到其他服务');
   const response=await requestOnce(current,options,signal);
   if([301,302,303,307,308].includes(response.status)) {
    response.body.destroy();
    if(options.method==='POST') throw Error('播放接口不支持重定向');
    if(!response.headers.get('location')) throw Error('运营服务重定向无效');
    current=remote(response.headers.get('location'),current); continue;
   }
   return {r:response,url:current.href};
  }
  throw Error('运营服务重定向过多');
 }
 async function body(req) { const data=await bounded({body:req},16384); try { return JSON.parse(data.toString()); } catch { throw Error('请求格式无效'); } }
 async function handle(req,res,url,{authorized,origin}) {
  if(!url.pathname.startsWith('/api/preview/')) return false;
  const site=req.headers['sec-fetch-site'];
  if(!authorized || (req.headers.origin && req.headers.origin!==origin) || (site && site!=='same-origin' && site!=='none')) { json(res,403,{error:'本机会话无效'}); return true; }
  const local=new AbortController();
  const abort=()=>local.abort(); req.once('aborted',abort); res.once('close',abort);
  const signal=AbortSignal.any([controller.signal,local.signal]);
  try {
   if(url.pathname==='/api/preview/session') {
    if(req.method==='GET') { json(res,200,{connected:!!base,base}); return true; }
    if(req.method!=='PUT' || req.headers.origin!==origin) { json(res,405,{error:'请求方式无效'}); return true; }
    const input=await body(req); clear();
    if(input.base) { if(typeof input.base!=='string') throw Error('运营地址无效'); const u=remote(input.base.trim()); if(u.search || !['','/'].includes(u.pathname)) throw Error('请填写运营中心根地址'); base=u.origin; }
    json(res,200,{connected:!!base,base}); return true;
   }
   if(!base) throw Error('请先连接运营中心');
   const g=generation;
   if(url.pathname.startsWith('/api/preview/media/')) {
    if(!['GET','HEAD'].includes(req.method)) { json(res,405,{error:'请求方式无效'}); return true; }
    const source=tokens.get(url.pathname.slice('/api/preview/media/'.length));
    if(!source) { json(res,404,{error:'素材预览已失效'}); return true; }
    const headers={};
    if(req.headers.range) {
     const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
     if(!match || (!match[1]&&!match[2]) || (match[1]&&match[2]&&BigInt(match[2])<BigInt(match[1])) || (!match[1]&&BigInt(match[2])===0n)) throw Error('播放范围无效');
     headers.Range=req.headers.range;
    }
    const {r,url:final}=await get(source,{headers,method:req.method},signal);
    if(g!==generation) { r.body.destroy(); throw Error('预览连接已切换'); }
    if(!r.ok) { r.body.destroy(); json(res,502,{error:'运营素材暂时不可用'}); return true; }
    const type=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    const hls=['application/vnd.apple.mpegurl','application/x-mpegurl','audio/mpegurl','audio/x-mpegurl'].includes(type) || new URL(final).pathname.endsWith('.m3u8');
    if(hls && req.method==='GET') {
     const text=(await bounded(r,2*1024*1024)).toString('utf8');
     if(g!==generation || signal.aborted) throw Error('预览连接已切换');
     if(!text.trimStart().startsWith('#EXTM3U')) throw Error('播放清单无效');
     const output=text.split(/\r?\n/).map(line=>line.startsWith('#') ? line.replace(/URI="([^"\r\n]+)"/g,(_,v)=>'URI="'+media(v,final)+'"') : line.trim()?media(line.trim(),final):line).join('\n');
     res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(output); return true;
    }
    if(!/^(?:image\/(?:png|jpeg|webp|gif)|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/(?:octet-stream|mp4|vnd\.apple\.mpegurl|x-mpegurl))$/.test(type)) { r.body.destroy(); throw Error('预览不支持该素材格式'); }
    const length=Number(r.headers.get('content-length')||0);
    if(length>128*1024*1024) { r.body.destroy(); throw Error('素材范围过大'); }
    const out={'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    for(const key of ['content-range','accept-ranges','content-length']) if(r.headers.has(key)) out[key]=r.headers.get(key);
    res.writeHead(r.status,out);
    if(req.method==='HEAD') { r.body.destroy(); res.end(); return true; }
    let size=0;
    const limit=new Transform({transform(chunk,encoding,done){ size+=chunk.length; done(size>128*1024*1024?Error('素材范围过大'):null,chunk); }});
    pipeline(r.body,limit,res,()=>{}); return true;
   }
   const routes={'/api/preview/bootstrap':'/api/client/bootstrap','/api/preview/catalog':'/api/catalog','/api/preview/categories':'/api/catalog/categories','/api/preview/playback':'/api/playback'};
   const endpoint=routes[url.pathname];
   if(!endpoint) { json(res,404,{error:'不支持该预览接口'}); return true; }
   const playback=url.pathname.endsWith('/playback');
   if(req.method!==(playback?'POST':'GET')) { json(res,405,{error:'请求方式无效'}); return true; }
   const target=new URL(endpoint,base),allowed=['platform','os','version','contract','page','keyword','category','ids','orderBy'];
   for(const [key,value] of url.searchParams) { if(!allowed.includes(key)||value.length>1000) throw Error('预览参数无效'); target.searchParams.set(key,value); }
   const payload=playback?await body(req):undefined;
   if(payload && (!/^[\w-]{1,64}$/.test(payload.id)||!Number.isInteger(payload.sid)||payload.sid<1||!Number.isInteger(payload.nid)||payload.nid<1)) throw Error('播放参数无效');
   const {r,url:final}=await get(target,{method:req.method,headers:{Accept:'application/json',...(playback?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify({id:payload.id,sid:payload.sid,nid:payload.nid})}:{})},signal,true);
   const data=JSON.parse((await bounded(r,4*1024*1024)).toString());
   if(g!==generation || signal.aborted) throw Error('预览连接已切换');
   if(!r.ok) { json(res,r.status,{error:typeof data.error==='string'?data.error:'运营服务请求失败'}); return true; }
   json(res,200,rewrite(data,final));
  } catch(error) { if(!res.headersSent && !res.destroyed) json(res,502,{error:error.message||'运营预览请求失败'}); else res.destroy(); }
  return true;
 }
 return {handle,stop:clear};
}
module.exports={createOperationsPreview};
