'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {productionTrust,loadTerminalTrust}=require('../core/terminal-trust.cjs');
const {bundleTrust}=require('../scripts/authorization-trust.cjs');
const {Authorization}=require('../core/authorization.cjs');
async function directory(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-terminal-trust-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
test('默认绑定正式终端且公钥指纹固定',async()=>{
 const trust=await loadTerminalTrust();assert.equal(trust.url,'https://sq.appgog.com');assert.equal(trust.keyId,'63c206204d3d3abb');assert.ok(Object.isFrozen(trust));
 assert.equal(crypto.createPublicKey(trust.publicKey).asymmetricKeyType,'ed25519');
 assert.equal(crypto.createHash('sha256').update(trust.publicKey).digest('hex').slice(0,16),trust.keyId);
});
test('安装版忽略环境配置路径，构建始终封装固定终端',async t=>{
 const root=await directory(t),file=path.join(root,'hostile.json');await fs.writeFile(file,JSON.stringify({url:'https://other.example',publicKey:'invalid'}));
 assert.deepEqual(await loadTerminalTrust({isPackaged:true,developmentTrustFile:file}),productionTrust());
 await bundleTrust(root);assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'authorization-trust.json'),'utf8')),productionTrust());
});
test('源程序调试只允许显式本机授权服务',async t=>{
 const root=await directory(t),file=path.join(root,'development.json'),trust=productionTrust();
 await fs.writeFile(file,JSON.stringify({...trust,url:'http://127.0.0.1:8796',development:true}));assert.equal((await loadTerminalTrust({developmentTrustFile:file})).development,true);
 await fs.writeFile(file,JSON.stringify({...trust,url:'https://other.example',development:true}));await assert.rejects(loadTerminalTrust({developmentTrustFile:file}),/仅允许本机/);
 await fs.writeFile(file,JSON.stringify(trust));await assert.rejects(loadTerminalTrust({developmentTrustFile:file}),/正式终端已内置/);
});
test('激活请求发往固定终端，伪造租约和迁移地址不能解锁',async t=>{
 const root=await directory(t),foreign=crypto.generateKeyPairSync('ed25519'),sign=p=>{const bytes=Buffer.from(JSON.stringify(p));return {algorithm:'Ed25519',payload:bytes.toString('base64url'),signature:crypto.sign(null,bytes,foreign.privateKey).toString('base64url')};};
 let requested=false;
 const auth=await new Authorization({root,product:'theme-center',version:'0.2.4',trust:productionTrust(),encrypt:s=>Buffer.from(s),decrypt:b=>b.toString(),fetcher:async(url,options)=>{
  requested=true;assert.equal(url,'https://sq.appgog.com/v1/license/activate');assert.equal(JSON.parse(options.body).product,'theme-center');
  return new Response(JSON.stringify({lease:sign({nonce:JSON.parse(options.body).nonce})}),{status:200});
 }}).init();
 await assert.rejects(auth.activate('HTN_'+'a'.repeat(43)),/签名不可信/);assert.ok(requested);assert.equal(auth.status().valid,false);assert.equal(auth.data.key,undefined);
 await assert.rejects(auth.recovery(sign({type:'hetun-terminal-config',revision:1,primary:'https://other.example',fallbacks:[]})),/签名不可信/);assert.equal(auth.base(),'https://sq.appgog.com');
});
