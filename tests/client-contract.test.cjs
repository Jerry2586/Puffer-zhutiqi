'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../shared-source');
const load=name=>import(pathToFileURL(path.join(root,'server',name)).href);
test('接入配置严格校验，不把密钥或本机预览地址带入客户端',async()=>{
 const {validateIntegration}=await load('client-contract.mjs');
 assert.deepEqual(validateIntegration(undefined),{version:1,apiBase:''});
 assert.deepEqual(validateIntegration({version:1,apiBase:' https://api.example.com/gateway/ '}),{version:1,apiBase:'https://api.example.com/gateway'});
 for(const apiBase of ['http://api.example.com','https://user:password@api.example.com','https://api.example.com?token=secret','https://api.example.com/#secret','https://localhost','https://127.1','https://[::1]','https://0.0.0.0','not a url'])assert.throws(()=>validateIntegration({version:1,apiBase}));
 for(const input of [null,[],{version:2,apiBase:''},{version:1,apiBase:42},{version:1,apiBase:'',privateKey:'secret'}])assert.throws(()=>validateIntegration(input));
});
test('各端固定映射到自己的布局，接口参数与实际网关一致',async()=>{
 const {createClientContract}=await load('client-contract.mjs');
 for(const [platform,targets]of Object.entries({mobile:['android-phone','ios-iphone'],tablet:['android-tablet','ios-ipad'],tv:['android-tv'],web:['web']})){
  const c=createClientContract(platform,{version:1,apiBase:'https://api.example.com'});
  assert.deepEqual(c.targets,targets);assert.equal(c.endpoints.theme.query.platform,platform);assert.equal(c.version,1);assert.equal(c.readiness.configured,true);assert.equal(c.readiness.nativeAdapter,'required');
  assert.equal(c.endpoints.playback.method,'POST');assert.match(c.endpoints.playback.request.sid,/>= 1/);assert.equal(c.endpoints.catalog.path,'/api/catalog');
 }
 assert.equal(createClientContract('mobile').readiness.configured,false);
 for(const platform of ['ios','__proto__','constructor'])assert.throws(()=>createClientContract(platform));
});
test('旧包可回导，但主题导出不携带后台配置与伪造交接协议',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-contract-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const {defaultTheme,validateTheme}=await load('theme.mjs'),{exportTheme}=await load('export-theme.mjs'),{installPackage,readPackage}=await load('packages.mjs');
 const legacy={format:'hetun-skeleton',version:2,renderer:'hetun-v2',id:'legacy-theme',name:'旧主题',platform:'tablet',theme:structuredClone(defaultTheme),clientContract:{targets:['arbitrary-apk'],apiBase:'https://wrong.example'}};
 const old=await installPackage({data:Buffer.from(JSON.stringify(legacy)).toString('base64')},dir);
 assert.deepEqual(old.draft.integration,{version:1,apiBase:''});
 old.draft.integration={version:1,apiBase:'https://api.example.com/gateway/'};
 const draft=validateTheme(old.draft);assert.equal(draft.integration.apiBase,'https://api.example.com/gateway');
 const bytes=await exportTheme({...old,draft},dir),manifest=JSON.parse(readPackage(bytes).get('manifest.json'));
 assert.equal(manifest.version,2);assert.equal(manifest.renderer,'hetun-v2');assert.deepEqual(manifest.clientContract.targets,['android-tablet','ios-ipad']);assert.equal(manifest.clientContract.apiBase,'');assert.equal(manifest.theme.integration,undefined);
 assert.equal(readPackage(bytes).size,1);assert.ok(!bytes.includes(Buffer.from('wrong.example')));
 const again=await installPackage({data:bytes.toString('base64')},dir);assert.deepEqual(again.draft.integration,{version:1,apiBase:''});
 again.draft.integration={version:2,apiBase:'https://secret.example'};const clean=await exportTheme(again,dir);assert.ok(!clean.includes(Buffer.from('secret.example')));
});

test('导出 OpenAPI 的模型与真实 CMS 转换结果一致，部署前缀独立保留',async t=>{
 const http=require('node:http'),{once}=require('node:events');
 const {createClientContract}=await load('client-contract.mjs'),{listCms,categoriesCms}=await load('cms.mjs');
 const c=createClientContract('mobile',{version:1,apiBase:'https://api.example.com/gateway'}),spec=c.apiSchema;
 assert.equal(spec.openapi,'3.1.0');assert.equal(spec.servers[0].url,'https://api.example.com/gateway');
 const seen=[];const cms=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');seen.push(u);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({page:2,pagecount:3,total:5,class:[{type_id:7,type_name:'电影'}],list:u.searchParams.get('ac')==='detail'?[{vod_id:9,vod_name:'测试电影',vod_pic:'/poster.jpg',type_id:7,type_name:'电影',vod_play_from:'direct',vod_play_url:'第1集$https://media.example.com/1.mp4#第2集$https://media.example.com/2.mp4'}]:[]}));});
 cms.listen(0,'127.0.0.1');await once(cms,'listening');t.after(()=>new Promise(resolve=>cms.close(resolve)));
 const base='http://127.0.0.1:'+cms.address().port;
 function matches(value,schema){
  if(schema.$ref)schema=spec.components.schemas[schema.$ref.split('/').pop()];
  if(schema.type==='object'){assert.equal(typeof value,'object');assert.ok(value&&!Array.isArray(value));for(const key of schema.required||[])assert.ok(Object.hasOwn(value,key),'缺少 '+key);for(const [k,s]of Object.entries(schema.properties||{}))if(Object.hasOwn(value,k))matches(value[k],s);}
  else if(schema.type==='array'){assert.ok(Array.isArray(value));for(const item of value)matches(item,schema.items);}
  else if(schema.type==='integer')assert.ok(Number.isInteger(value));else if(typeof schema.type==='string')assert.equal(typeof value,schema.type);
  if(Object.hasOwn(schema,'const'))assert.equal(value,schema.const);
 }
 const catalog=await listCms(base,{page:2,keyword:'测试',category:'7',ids:'9'},true);
 matches(catalog,spec.components.schemas.Catalog);assert.equal(catalog.items[0].sources[0].episodes.length,2);assert.equal(catalog.items[0].sources[0].episodes[0].url,'');
 matches({items:await categoriesCms(base,true)},spec.paths['/api/catalog/categories'].get.responses[200].content['application/json'].schema);
 assert.equal(seen[0].searchParams.get('wd'),'测试');assert.equal(seen[0].searchParams.get('pg'),'2');assert.equal(seen[0].searchParams.get('ids'),'9');assert.equal(seen[1].searchParams.get('ac'),'list');
 c.apiSchema.info.version='mutated';assert.equal(createClientContract('mobile').apiSchema.info.version,'1.0.0');
});
