'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {createOperationsPreview}=require('../core/operations-preview.cjs');
async function serve(handler){const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');return {server,base:'http://127.0.0.1:'+server.address().port};}
async function fixture(t){
 const seen=[];let closed=false;
 const upstream=await serve((req,res)=>{
  seen.push({url:req.url,headers:req.headers,method:req.method});
  if(req.url==='/poster'){res.writeHead(200,{'Content-Type':'image/png'});res.end('image');return;}
  if(req.url==='/stream.m3u8'){res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl'});res.end('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nclip.ts\n');return;}
  if(req.url==='/clip.ts'){res.writeHead(206,{'Content-Type':'video/mp2t','Content-Range':'bytes 0-3/9','Accept-Ranges':'bytes'});res.end('clip');return;}
  if(req.url==='/key.bin'){res.writeHead(200,{'Content-Type':'application/octet-stream'});res.end('key');return;}
  if(req.url==='/wrong'){res.writeHead(200,{'Content-Type':'image/png-bad'});res.end('bad');return;}
  if(req.url==='/slow'){req.on('close',()=>{closed=true;});res.writeHead(200,{'Content-Type':'video/mp4'});res.write('x');return;}
  if(req.url.startsWith('/api/playback')){res.writeHead(303,{Location:'/api/catalog'});res.end();return;}
  if(req.url.includes('keyword=redirect')){res.writeHead(302,{Location:'http://127.0.0.1:1/private'});res.end();return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:[{id:'one',poster:'/poster',url:'/stream.m3u8',video:'/slow',image:'/wrong',asset:'http://127.0.0.1:1/private'}]}));
 });
 const proxy=createOperationsPreview();let origin;
 const local=await serve((req,res)=>proxy.handle(req,res,new URL(req.url,origin),{authorized:req.headers.cookie==='session=ok',origin}));origin=local.base;
 t.after(async()=>{proxy.stop();local.server.closeAllConnections();upstream.server.closeAllConnections();await Promise.all([new Promise(r=>local.server.close(r)),new Promise(r=>upstream.server.close(r))]);});
 const call=(route,options={})=>fetch(origin+'/api/preview/'+route,{...options,headers:{Cookie:'session=ok',Origin:origin,...options.headers}});
 const connect=()=>call('session',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({base:upstream.base})});
 return {call,connect,seen,upstream,origin,isClosed:()=>closed};
}
test('运营代理仅允许已登录同源会话、受限接口，且不转发本机凭据',async t=>{
 const f=await fixture(t);
 assert.equal((await f.call('session',{headers:{Cookie:''}})).status,403);
 assert.equal((await f.call('session',{headers:{Origin:'http://foreign.invalid'}})).status,403);
 assert.equal((await f.call('session',{headers:{'Sec-Fetch-Site':'same-site'}})).status,403);
 assert.equal((await f.connect()).status,200);
 const result=await f.call('catalog',{headers:{Authorization:'Bearer LOCAL_SECRET'}});assert.equal(result.status,200);
 assert.equal(f.seen[0].headers.cookie,undefined);assert.equal(f.seen[0].headers.authorization,undefined);
 assert.equal((await f.call('catalog?target=http://other.invalid')).status,502);
 assert.equal((await f.call('admin')).status,404);
 assert.equal((await f.call('catalog?keyword=redirect')).status,502);
 const before=f.seen.length;assert.equal((await f.call('playback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'one',sid:1,nid:1})})).status,502);assert.equal(f.seen.length,before+1);
});
test('媒体使用会话令牌；HLS、Range、格式检查、断开连接都实际生效',async t=>{
 const f=await fixture(t);await f.connect();
 const item=(await (await f.call('catalog')).json()).items[0];assert.match(item.poster,/^\/api\/preview\/media\/[a-f0-9]{48}$/);
 const fetchMedia=(url,headers={})=>fetch(f.origin+url,{headers:{Cookie:'session=ok',...headers}});
 assert.equal(await (await fetchMedia(item.poster)).text(),'image');
 assert.equal((await fetchMedia(item.poster,{Range:'bytes=-'})).status,502);
 assert.equal((await fetchMedia(item.poster,{Range:'bytes=8-2'})).status,502);
 assert.equal((await fetchMedia(item.image)).status,502);
 assert.equal((await fetchMedia(item.asset)).status,502);
 const playlist=await (await fetchMedia(item.url)).text();assert.match(playlist,/#EXTM3U/);assert.doesNotMatch(playlist,/clip.ts|key.bin/);
 const token=playlist.split('\n').find(line=>line.startsWith('/api/preview/media/'));
 const clip=await fetchMedia(token,{Range:'bytes=0-3'});assert.equal(clip.status,206);assert.equal(clip.headers.get('content-range'),'bytes 0-3/9');assert.equal(await clip.text(),'clip');
 const abort=new AbortController();const playing=await fetch(f.origin+item.video,{headers:{Cookie:'session=ok'},signal:abort.signal});await playing.body.getReader().read();abort.abort();
 for(let i=0;i<20&&!f.isClosed();i++)await new Promise(r=>setTimeout(r,10));assert.equal(f.isClosed(),true);
 await f.call('session',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"base":""}'});assert.equal((await fetchMedia(item.poster)).status,502);
});
