'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Authorization}=require('../core/authorization.cjs'),{ProductCenter}=require('../core/product-center.cjs');
async function fixture(t,mode='silent-local'){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'puffer-client-center-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const keys=crypto.generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({type:'spki',format:'pem'}),now=Date.now();let offline=false,denied=false,requests=0;
 const sign=p=>{const b=Buffer.from(JSON.stringify(p));return {algorithm:'Ed25519',payload:b.toString('base64url'),signature:crypto.sign(null,b,keys.privateKey).toString('base64url')};};
 const options={root:path.join(root,'auth'),product:'theme-center',version:'0.2.4',trust:{url:'http://127.0.0.1:8999',development:true,publicKey},clock:()=>now,encrypt:s=>Buffer.from(s),decrypt:b=>b.toString(),fetcher:async(url,opts)=>{
  requests++;if(offline)throw Error('offline');const b=JSON.parse(opts.body);
  if(denied)return new Response(JSON.stringify({denial:sign({type:'hetun-authorization-denial',nonce:b.nonce,product:b.product,binding:b.deviceId,issuer:'http://127.0.0.1:8999',iat:now/1000,licenseId:'license-a',policyRevision:'1.2',reason:'已删除授权'})}),{status:403});
  return new Response(JSON.stringify({lease:sign({schemaVersion:4,nonce:b.nonce,product:b.product,binding:b.deviceId,issuer:'http://127.0.0.1:8999',licenseId:'license-a',activationId:'activation-a',authorizationMode:mode,policyRevision:'1.1',iat:now/1000,exp:now/1000+86400,licenseExpiresAt:new Date(now+86400000).toISOString(),permissions:{theme:true},offlineMigration:true})}));
 }};
 const auth=await new Authorization(options).init();await auth.activate('HTN_'+'a'.repeat(43));
 return {root,auth,options,sign,now,get requests(){return requests;},offline:v=>offline=v,deny:()=>denied=true};
}
test('在线授权重新启动必须联网，失联后锁定',async t=>{const f=await fixture(t,'online'),second=await new Authorization(f.options).init();assert.equal(second.status().valid,false);await second.launch();assert.equal(second.status().valid,true);f.offline(true);await second.check();assert.equal(second.status().valid,false);});
test('静默本地每次启动后台询问，离线可用，可信撤销后锁定',async t=>{const f=await fixture(t),second=await new Authorization(f.options).init();f.offline(true);const before=f.requests;assert.equal((await second.launch()).valid,true);await second.queue;assert.ok(f.requests>before);assert.equal(second.status().valid,true);f.offline(false);f.deny();await second.check();assert.equal(second.status().valid,false);assert.match(second.status().message,/删除授权/);});
test('云端记录断网持久化、重启补传、等待确认、不同Key隔离',async t=>{
 const f=await fixture(t),auth=f.auth;let online=false,seen=[];
 auth.request=async(route,o)=>{if(!online)throw Error('offline');const v=JSON.parse(o.body);seen.push(v);return new Response(JSON.stringify({record:{id:v.eventId}}));};
 const root=path.join(f.root,'center');let center=await new ProductCenter({auth,root,version:'0.2.4'}).init();await center.record('template-install',{result:'installed'});assert.equal(center.state().pendingRecords,1);
 center=await new ProductCenter({auth,root,version:'0.2.4'}).init();assert.equal(center.state().pendingRecords,1);online=true;await center.flush();assert.equal(center.state().pendingRecords,0);assert.equal(center.state().recordHistory.length,1);assert.equal(seen.length,1);assert.equal(seen[0].type,'template-install');await center.flush();assert.equal(seen.length,1);auth.data.licenseId='other-key';assert.equal(center.state().recordHistory.length,0);
});
test('真实签名消息和强制更新，拒绝坏签名及错误摘要',async t=>{
 const f=await fixture(t),auth=f.auth,body=Buffer.from('fixture update'),id=crypto.randomUUID();let corrupt=false;
 const release={id,product:'theme-center',kind:'software',platform:'windows',arch:'any',version:'0.2.5',filename:'theme.zip',bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),downloadPath:'/v1/releases/'+id+'/download'};
 auth.request=async route=>{if(route===release.downloadPath)return new Response(corrupt?Buffer.from('bad data'):body);const p={schemaVersion:1,issuer:auth.base(),product:'theme-center',checkedAt:new Date(f.now).toISOString(),...(route.startsWith('/v1/notifications')?{activationId:'activation-a',items:[]}:{currentVersion:'0.2.4',updateAvailable:true,force:true,release})};return new Response(JSON.stringify(f.sign(p)));};
 const center=await new ProductCenter({auth,root:path.join(f.root,'center'),version:'0.2.4'}).init();await center.sync();assert.throws(()=>center.assertEditing(),/要求更新/);
 corrupt=true;await assert.rejects(center.download(),/大小不匹配|校验失败/);assert.equal(center.state().history.length,0);corrupt=false;const downloaded=await center.download();assert.equal(downloaded.saved,true);const file=await center.verifiedFile(id);await fs.writeFile(file.file,'tamper');await assert.rejects(center.verifiedFile(id),/已变化/);
 auth.request=async()=>new Response(JSON.stringify({algorithm:'Ed25519',payload:'e30',signature:'invalid'}));await center.sync();assert.match(center.state().error,/签名/);
});

 test('新在线签名允许72小时网络波动、重启不延长且可信撤销持久化',async t=>{
 const f=await fixture(t,'online');let clock=f.now;const old=f.options.fetcher;
 f.options.clock=()=>clock;f.options.fetcher=async(url,opts)=>{const r=await old(url,opts);const value=await r.json();if(value.lease){const p=JSON.parse(Buffer.from(value.lease.payload,'base64url'));p.onlineGraceSeconds=259200;p.exp=p.iat+259200;p.licenseExpiresAt=new Date(f.now+10*86400000).toISOString();value.lease=f.sign(p);}return new Response(JSON.stringify(value),{status:r.status});};
 let a=await new Authorization(f.options).init();await a.check();f.offline(true);clock=f.now+86400000;a=await new Authorization(f.options).init();await a.launch();assert.equal(a.status().valid,true);clock=f.now+259200000;assert.equal(a.status().valid,false);clock=f.now;f.offline(false);f.deny();await a.check();assert.equal(a.status().valid,false);a=await new Authorization(f.options).init();assert.equal(a.status().valid,false);assert.match(a.status().message,/删除授权/);
 });

test('升级后清除旧更新缓存，旧强制提示不阻止编辑',async t=>{
 const f=await fixture(t),root=path.join(f.root,'center');const old=await new ProductCenter({auth:f.auth,root,version:'0.2.4'}).init();old.scope();old.data.update={currentVersion:'0.2.4',updateAvailable:true,force:true,release:{version:'0.2.5'}};await old.save();
 const current=await new ProductCenter({auth:f.auth,root,version:'0.2.7'}).init();assert.equal(current.state().update,null);assert.doesNotThrow(()=>current.assertEditing());
});
test('签名有效也拒绝同版本或降级更新，禁止安装旧缓存包',async t=>{
 const f=await fixture(t),center=await new ProductCenter({auth:f.auth,root:path.join(f.root,'center'),version:'0.2.7'}).init();
 for(const version of ['0.2.6','0.2.7','0.2.7-beta.1']){f.auth.request=async()=>new Response(JSON.stringify(f.sign({schemaVersion:1,issuer:f.auth.base(),product:f.auth.product,checkedAt:new Date(f.now).toISOString(),currentVersion:'0.2.7',updateAvailable:true,release:{version}})));await assert.rejects(center.signed('/v1/updates','update'),/高于当前版本/);await assert.rejects(center.download(),/高于当前版本/);}
 for(const version of ['0.2.8','0.2.10','0.3.0']){f.auth.request=async()=>new Response(JSON.stringify(f.sign({schemaVersion:1,issuer:f.auth.base(),product:f.auth.product,checkedAt:new Date(f.now).toISOString(),currentVersion:'0.2.7',updateAvailable:true,release:{version}})));assert.equal((await center.signed('/v1/updates','update')).release.version,version);}
 const id=crypto.randomUUID();center.data.history=[{releaseId:id,status:'downloaded',version:'0.2.6'}];await assert.rejects(center.verifiedFile(id),/请先下载/);
});
