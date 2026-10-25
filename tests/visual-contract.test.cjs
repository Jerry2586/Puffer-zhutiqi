'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const service=path.resolve(__dirname,'../shared-source/server');
test('visual controls validate and survive theme ZIP export and reimport',async t=>{
 const {defaultTheme,validateTheme}=await import(pathToFileURL(path.join(service,'theme.mjs')).href);
 const {exportTheme}=await import(pathToFileURL(path.join(service,'export-theme.mjs')).href);
 const {installPackage}=await import(pathToFileURL(path.join(service,'packages.mjs')).href);
 const theme=validateTheme(structuredClone(defaultTheme));
 assert.equal(theme.visual.player.watermarkOpacity,45);
 theme.visual.player.progress='#123abc';theme.visual.carousel.duration=800;theme.visual.cards.size=19;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-visual-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const assets=path.join(root,'assets');await fs.mkdir(assets);
 const validated=validateTheme(theme);
 const zip=await exportTheme({id:'visual-test',name:'外观回归',platform:'mobile',draft:validated},assets);
 const restored=await installPackage({data:zip.toString('base64')},path.join(root,'import'),async()=>{});
 assert.deepEqual(restored.draft.visual,validated.visual);
 for(const value of ['red','#123']){const bad=structuredClone(theme);bad.visual.player.progress=value;assert.throws(()=>validateTheme(bad),/颜色/);}
 for(const value of [NaN,Infinity,'500',149,1201]){const bad=structuredClone(theme);bad.visual.carousel.duration=value;assert.throws(()=>validateTheme(bad),/范围/);}
});

const {startLocal}=require('../core/local-service.cjs');
test('visual draft persists through real service save and restart with optimistic version protection',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-visual-service-'));let local;
 t.after(async()=>{await local?.stop();await fs.rm(root,{recursive:true,force:true});});
 const frontend=path.join(root,'front'),state=path.join(root,'state');await fs.mkdir(frontend);await fs.writeFile(path.join(frontend,'index.html'),'<html>theme test</html>');
 async function boot(){local=await startLocal({node:process.execPath,frontend,service:path.resolve('shared-source'),state,linkDirectory:path.join(root,'link'),localAuthoring:true,browserPreview:true});}
 function headers(){return {Cookie:'hetun_session='+local.cookie,Origin:local.origin,'X-Hetun-Client':'studio','Content-Type':'application/json'};}
 async function read(){const response=await fetch(local.origin+'/api/admin/state',{headers:headers()});assert.equal(response.status,200);return response.json();}
 await boot();const initial=await read();const theme=structuredClone(initial.draft);theme.visual.player.progress='#eb4278';theme.visual.carousel.duration=720;theme.pageDesign={home:{carouselDesign:{height:300,autoplay:false},modules:{content:{title:'本页推荐',columns:2,gap:10}},moduleOrder:['home-content','hero']},category:{carouselDesign:{height:220}},together:{background:'#234567'}};
 const input={template:initial.selectedTemplate,version:initial.version,theme};
 const saved=await fetch(local.origin+'/api/admin/draft',{method:'PUT',headers:headers(),body:JSON.stringify(input)});assert.equal(saved.status,200);const result=await saved.json();assert.equal(result.version,initial.version+1);
 const stale=await fetch(local.origin+'/api/admin/draft',{method:'PUT',headers:headers(),body:JSON.stringify(input)});assert.equal(stale.status,409);
 await local.stop();await boot();const restored=await read();assert.equal(restored.draft.visual.player.progress,'#eb4278');assert.equal(restored.draft.visual.carousel.duration,720);assert.equal(restored.version,result.version);assert.deepEqual(restored.draft.pageDesign,theme.pageDesign);
});
test('native package refuses new appearance fields until its renderer declares support',async()=>{
 const {defaultTheme,validateTheme}=await import(pathToFileURL(path.join(service,'theme.mjs')).href);
 const {CONTRACT,requirements,compatibility}=require('../shared-source/server/package-contract.cjs');
 const theme=validateTheme(structuredClone(defaultTheme));const manifest={format:'hetun-skeleton',version:2,renderer:'hetun-v2',platform:'mobile',theme};
 const fields=requirements(manifest).fields;const descriptor={format:'hetun-base-apk',version:1,contract:CONTRACT,runtime:'hetun-runtime-v1',theme:'hetun-skeleton-v2',assetRoot:'assets/',os:'android',packageName:'tv.hetun.test',devices:['mobile'],renderer:'test-renderer',themeFields:fields.filter(field=>!field.startsWith('visual.'))};
 const unsupported=compatibility(descriptor,manifest,'mobile');assert.equal(unsupported.ready,false);assert.ok(unsupported.missing.includes('visual.player.progress'));
 descriptor.themeFields=fields;assert.equal(compatibility(descriptor,manifest,'mobile').ready,true);
});
