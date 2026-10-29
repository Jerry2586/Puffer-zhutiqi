'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const net=require('node:net');
const {createPreviewProxyAgent}=require('../core/preview-proxy-agent.cjs');
async function fixture(t,status=200){
 const seen=[];const sockets=new Set();
 const upstream=http.createServer((req,res)=>{seen.push({url:req.url,host:req.headers.host});res.setHeader('Content-Type','image/jpeg');res.end(Buffer.from([255,216,255,217]));});
 const proxy=http.createServer();
 for(const server of [upstream,proxy]){server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
 proxy.on('connect',(req,socket)=>{seen.push({connect:req.url});if(status!==200){socket.end('HTTP/1.1 '+status+' Rejected\r\n\r\n');return;} const target=net.connect(upstream.address().port,'127.0.0.1',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');socket.pipe(target).pipe(socket);});sockets.add(target);target.on('close',()=>sockets.delete(target));target.on('error',()=>socket.destroy());socket.on('error',()=>target.destroy());});
 t.after(async()=>{for(const s of sockets)s.destroy();await Promise.all([upstream,proxy].map(server=>new Promise(r=>server.close(r))));});
 return {rule:'PROXY 127.0.0.1:'+proxy.address().port,seen};
}
function lookup(_host,_options,done){done(null,[{address:'104.21.17.152',family:4}]);}
function request(url,agent,signal){return new Promise((resolve,reject)=>{http.get(url,{agent,signal},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,bytes:Buffer.concat(chunks)}));res.on('error',reject);}).on('error',reject);});}
test('系统代理 CONNECT 固定到已校验的 IP，保留原始 Host 并实际返回图片字节',async t=>{
 const f=await fixture(t);const c=new AbortController();const url=new URL('http://posters.example/image.jpg');const agent=createPreviewProxyAgent(url,f.rule,lookup,c.signal);t.after(()=>agent.destroy());
 const result=await request(url,agent,c.signal);assert.equal(result.status,200);assert.deepEqual([...result.bytes],[255,216,255,217]);assert.deepEqual(f.seen,[{connect:'104.21.17.152:80'},{url:'/image.jpg',host:'posters.example'}]);
});
test('私网策略拒绝后不会向代理发起 CONNECT',async t=>{
 const f=await fixture(t);const c=new AbortController();const url=new URL('http://posters.example/image.jpg');const agent=createPreviewProxyAgent(url,f.rule,(_h,_o,done)=>done(Error('private denied')),c.signal);t.after(()=>agent.destroy());
 await assert.rejects(request(url,agent,c.signal),/private denied/);assert.equal(f.seen.length,0);
});
test('代理拒绝连接和取消请求都会收敛为错误',async t=>{
 const f=await fixture(t,403);const c=new AbortController();const url=new URL('http://posters.example/image.jpg');const agent=createPreviewProxyAgent(url,f.rule,lookup,c.signal);t.after(()=>agent.destroy());
 await assert.rejects(request(url,agent,c.signal),/系统代理连接失败/);
 const other=new AbortController();const pendingAgent=createPreviewProxyAgent(url,f.rule,()=>{},other.signal);t.after(()=>pendingAgent.destroy());const pending=request(url,pendingAgent,other.signal);other.abort();await assert.rejects(pending,/aborted|取消/i);
});
test('DIRECT 不创建代理，代理配置不可带凭据或路径',()=>{
 const url=new URL('https://posters.example/image.jpg');const c=new AbortController();assert.equal(createPreviewProxyAgent(url,'DIRECT',lookup,c.signal),undefined);
 for(const rule of ['PROXY user:secret@localhost:1080','PROXY localhost:1080/path','SOCKS5 localhost:1080'])assert.throws(()=>createPreviewProxyAgent(url,rule,lookup,c.signal));
});
