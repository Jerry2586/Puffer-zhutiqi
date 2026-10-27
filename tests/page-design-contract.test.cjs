'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const service=path.resolve(__dirname,'../shared-source/server');
async function themeModule(){return import(pathToFileURL(path.join(service,'theme.mjs')).href);}

test('page design is sparse, isolated, and validated before persistence',async()=>{
 const {defaultTheme,validateTheme}=await themeModule();
 const input=structuredClone(defaultTheme);
 input.pageDesign={category:{background:'#11223380',visual:{cards:{radius:17},carousel:{duration:700}},carousel:true}};
 const result=validateTheme(input);
 assert.deepEqual(result.pageDesign,input.pageDesign);
 assert.equal(result.visual.cards.radius,validateTheme(defaultTheme).visual.cards.radius);
 assert.equal(result.pageDesign.home,undefined);
 for(const config of [{unknown:true},{background:'red'},{backgroundImage:'https://outside.test/bg.png'},{carousel:'true'},{visual:{cards:{radius:Infinity}}},{visual:{cards:{unknown:1}}},{visual:{constructor:{radius:1}}},{visual:{cards:JSON.parse('{"__proto__":1}')}}]){
  assert.throws(()=>validateTheme({...input,pageDesign:{category:config}}));
 }
 assert.throws(()=>validateTheme({...input,pageDesign:{missing:{}}}));
});

test('page overrides and local background asset survive actual ZIP export and import',async t=>{
 const {defaultTheme,validateTheme}=await themeModule();
 const {storeAsset,installPackage,readPackage}=await import(pathToFileURL(path.join(service,'packages.mjs')).href);
 const {exportTheme}=await import(pathToFileURL(path.join(service,'export-theme.mjs')).href);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-page-design-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const assets=path.join(root,'assets');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6juAAAAAASUVORK5CYII=','base64');
 const image=await storeAsset(png,'background.png',assets);
 const draft=validateTheme({...structuredClone(defaultTheme),pageDesign:{category:{background:'#11223380',backgroundImage:image,carousel:true,carouselDesign:{height:280,effect:'fade',autoplay:false},moduleOrder:['category-content','hero'],visual:{cards:{radius:17}}},home:{modules:{content:{style:'mosaic',limit:9,subtitle:'统一模板',showScore:false,showMore:true,title:'精选推荐',columns:2,gap:12,visible:true,radius:18,ratio:'16/9',background:'#12345680',textColor:'#abcdef',titleSize:22}},moduleOrder:['home-content','hero']},together:{background:'#123456'},player:{visual:{player:{progress:'#12ab3450'}}}}});
 draft.pageDesign['category6d6f766965']={carouselDesign:{height:310},visual:{cards:{radius:19}},moduleOrder:['hero','category-content']};
 draft.sections.push({...draft.sections[0],id:'movie-only',page:'category',categoryEntry:'movie'});
 const zip=await exportTheme({id:'page-design-test',name:'页面设计回归',platform:'mobile',draft},assets);
 const manifest=JSON.parse(readPackage(zip).get('manifest.json'));
 assert.match(manifest.theme.pageDesign.category.backgroundImage,/^assets\//);
 assert.ok(manifest.packaging.fields.includes('pageDesign[].visual.cards.radius'));
 const restored=await installPackage({data:zip.toString('base64')},path.join(root,'restored'));
 assert.deepEqual(restored.draft.pageDesign,draft.pageDesign);
 assert.equal(restored.draft.sections.find(s=>s.id==='movie-only').categoryEntry,'movie');
 assert.deepEqual(await fs.readFile(path.join(root,'restored',path.basename(image))),png);
});

 test('page module and carousel settings reject invalid payloads',async()=>{
 const {defaultTheme,validateTheme}=await themeModule();
 for(const config of [{carouselDesign:{height:Infinity}},{carouselDesign:{height:119}},{carouselDesign:{slides:[]}},{carouselDesign:{autoplay:'true'}},{carouselDesign:{style:'bad'}},{moduleOrder:['hero','hero']},{moduleOrder:['x.y']},{modules:{content:{columns:0}}},{modules:{content:{gap:41}}},{modules:{content:{visible:1}}},{modules:{unknown:{}}},{modules:{content:{radius:41}}},{modules:{content:{ratio:'bad'}}},{modules:{content:{textColor:'red'}}},{modules:{content:{titleSize:33}}}])assert.throws(()=>validateTheme({...structuredClone(defaultTheme),pageDesign:{home:config}}));
 assert.throws(()=>validateTheme({...structuredClone(defaultTheme),pageDesign:{category:{modules:{highlights:{}}}}}));
 });


test('category page IDs and module bindings are validated without merging categories',async()=>{
 const {defaultTheme,validateTheme}=await themeModule();
 const draft=structuredClone(defaultTheme);
 draft.pageDesign={'category6d6f766965':{carouselDesign:{height:300}},'category736572696573':{carousel:false}};
 const result=validateTheme(draft);
 assert.deepEqual(result.pageDesign,draft.pageDesign);
 for(const id of ['category:','category:../../x','category:'+ 'x'.repeat(65)])assert.throws(()=>validateTheme({...draft,pageDesign:{[id]:{}}}));
 for(const binding of ['',1,'../../x','x'.repeat(65)])assert.throws(()=>validateTheme({...draft,sections:[{...draft.sections[0],page:'category',categoryEntry:binding}]}));
 assert.throws(()=>validateTheme({...draft,sections:[{...draft.sections[0],page:'home',categoryEntry:'movie'}]}));
 const valid=validateTheme({...draft,sections:[{...draft.sections[0],page:'category',categoryEntry:'movie'}]});
 assert.equal(valid.sections[0].categoryEntry,'movie');
});

test('fixed video slots persist every selectable style and reject unsupported fields',async()=>{
 const {defaultTheme,validateTheme}=await themeModule();
 for(const style of ['grid2','grid3','scroll','list','ranking','mosaic']){
  const module={style,title:'同一模块',subtitle:'统一样式',limit:12,columns:3,radius:20,gap:10,ratio:'1/1',visible:true,showTitle:true,showScore:false,showNote:true,showYear:true,showMore:false};
  const pageDesign={home:{modules:{highlights:module,recommendations:module,content:module}},category:{modules:{content:module}},category6d6f766965:{modules:{content:{...module,columns:2}}}};
  assert.deepEqual(validateTheme({...structuredClone(defaultTheme),pageDesign}).pageDesign,pageDesign);
 }
 for(const bad of [{style:'fake'},{limit:0},{limit:61},{limit:2.5},{showYear:'yes'},{columns:7},{subtitle:'x'.repeat(81)},{source:'category'}])
  assert.throws(()=>validateTheme({...structuredClone(defaultTheme),pageDesign:{home:{modules:{content:bad}}}}));
});
