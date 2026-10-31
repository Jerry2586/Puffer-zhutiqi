'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createRequire}=require('node:module'),{createHash}=require('node:crypto');
const {buildAuthoringKit,AUTHORING_KIT_NAME}=require('../core/authoring-kit.cjs');
const {readZip}=require('../core/zip.cjs'),{stageApp,APP_FILES}=require('../scripts/stage-app.cjs');
const root=path.resolve(__dirname,'..'),hash=b=>createHash('sha256').update(b).digest('hex');
const expected=['README.md','THEME-AUTHORING.md','PACKAGE-CONTRACT.md','theme/cinema-standard.zip','contracts/skeleton-schema.json','contracts/visual-schema.json','contracts/native-api.openapi.json','kit-manifest.json'];
test('制作底座只含固定文档和原版主题，逐项摘要及字节一致',async()=>{
 const bundle=await buildAuthoringKit(),entries=readZip(bundle.bytes),manifest=JSON.parse(entries.get('kit-manifest.json'));
 assert.equal(bundle.name,AUTHORING_KIT_NAME);assert.deepEqual([...entries.keys()].sort(),expected.slice().sort());assert.equal(manifest.installable,false);
 assert.deepEqual([...Object.keys(manifest.files)].sort(),expected.filter(x=>x!=='kit-manifest.json').sort());
 for(const [name,info] of Object.entries(manifest.files)){assert.equal(entries.get(name).length,info.size);assert.equal(hash(entries.get(name)),info.sha256);}
 const original=await fs.readFile(path.join(root,'assets/authoring-base.zip'));assert.deepEqual(entries.get(manifest.baseline.path),original);
 assert.equal(hash(original),'ce59037880cee7c4bdeed61ca8b2c90530934bd3c183020bc765dcbf4eeeac8f');
 assert.ok(readZip(original).has('manifest.json'));assert.ok(!entries.has('manifest.json'));assert.equal(manifest.protocols.packaging,'hetun-package-v1');
});
test('真实 staging 独立生成底座，阻止遗漏资源与篡改定稿，不带外围 core 文件',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-kit-stage-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await stageApp(root,dir);assert.ok(APP_FILES.includes('core/authoring-kit.cjs'));assert.ok(APP_FILES.includes('AUTHORING-KIT.md'));
 assert.deepEqual((await fs.readdir(path.join(dir,'core'))).sort(),['local-service.cjs','authoring-kit.cjs','offline-network.cjs','operations-preview.cjs','zip.cjs','appearance.cjs','windows-shortcuts.cjs'].sort());
 const staged=createRequire(path.join(dir,'package.json'))('./core/authoring-kit.cjs');assert.deepEqual((await staged.buildAuthoringKit()).bytes,(await buildAuthoringKit()).bytes);
 const base=path.join(dir,'assets/authoring-base.zip'),original=await fs.readFile(base);await fs.writeFile(base,Buffer.from('wrong baseline'));
 await assert.rejects(staged.buildAuthoringKit(),/定稿不一致/);await fs.writeFile(base,original);
 await fs.unlink(path.join(dir,'shared-source/src/domain/visual-schema.json'));await assert.rejects(staged.buildAuthoringKit(),{code:'ENOENT'});
});
async function serviceHarness(t,localAuthoring=true){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-kit-http-')),front=path.join(dir,'front');await fs.mkdir(front);await fs.writeFile(path.join(front,'index.html'),'<html>preview</html>');
 let offset=0,broken=false;const realRequire=createRequire(path.join(root,'core/local-service.cjs'));
 const context={require:name=>name==='./authoring-kit.cjs'?{buildAuthoringKit:()=>broken?Promise.reject(Error('private filesystem path')):buildAuthoringKit()}:realRequire(name),module:{exports:{}},__dirname:path.join(root,'core'),process,Buffer,URL,fetch,AbortSignal,setTimeout,clearTimeout,Date:class extends Date{static now(){return Date.now()+offset;}}};
 vm.runInNewContext(await fs.readFile(path.join(root,'core/local-service.cjs'),'utf8'),context);
 const local=await context.module.exports.startLocal({node:process.execPath,frontend:front,service:path.join(root,'shared-source'),state:path.join(dir,'state'),localAuthoring,browserPreview:true});
 t.after(async()=>{await local.stop();await fs.rm(dir,{recursive:true,force:true});});
 const headers={Cookie:local.cookieName+'='+local.cookie,Origin:local.origin};
 return {local,headers,breakKit:()=>{broken=true;},expire:()=>{offset=8*60*60*1000;},request:(options={})=>fetch(local.origin+'/api/admin/authoring-kit'+(options.query||''),{method:options.method||'POST',headers:{...headers,...options.headers},...(options.body===undefined?{}:{body:options.body})})};
}
test('真实 HTTP 下载：限定本机会话、来源、方法、空请求；错误不泄露资源路径',async t=>{
 const h=await serviceHarness(t),r=await h.request();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('content-disposition'),/hetun-authoring-kit-v1.zip/);
 assert.deepEqual(Buffer.from(await r.arrayBuffer()),(await buildAuthoringKit()).bytes);
 let denied=await h.request({method:'GET'});assert.equal(denied.status,405);assert.equal(denied.headers.get('allow'),'POST');
 for(const Cookie of ['',h.local.cookieName+'=wrong','hetun_session='+h.local.cookie])assert.equal((await h.request({headers:{Cookie}})).status,401);
 for(const Origin of ['','https://example.invalid'])assert.equal((await h.request({headers:{Origin}})).status,403);
 assert.equal((await h.request({query:'?name=anything'})).status,400);assert.equal((await h.request({body:'extra'})).status,400);
 h.breakKit();denied=await h.request();assert.equal(denied.status,500);assert.match((await denied.json()).error,/资源缺失或与定稿不一致/);
 h.expire();assert.equal((await h.request()).status,401);
});
test('非本地制作模式不提供下载端点',async t=>{const h=await serviceHarness(t,false);assert.equal((await h.request()).status,404);});
