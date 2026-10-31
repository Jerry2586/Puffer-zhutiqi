'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
const definition=()=>({version:1,id:'cinema-next',name:'新骨架',pages:{home:{blocks:[{id:'feature',component:'carousel',gap:12},{id:'catalog',component:'content',sectionId:'one'},{id:'top',component:'header'}]},category:{blocks:[{id:'category-hero',component:'carousel'},{id:'category-list',component:'content'}]},player:{blocks:[{id:'video',component:'player'},{id:'episodes',component:'episodes'},{id:'metadata',component:'filmInfo'}]}}});
test('skeleton definitions validate without new editor branches and reject unsupported capabilities',async()=>{
 const {validateSkeleton}=await import(pathToFileURL(path.resolve('shared-source/server/skeleton.mjs')));const sections=[{id:'one',page:'home'}];
 assert.deepEqual(validateSkeleton(definition(),sections),definition());
 for(const mutate of [d=>d.version=2,d=>d.pages.home.blocks[0].component='arbitrary-script',d=>d.pages.home.blocks[0].gap=65,d=>d.pages.home.blocks[1].sectionId='missing',d=>d.pages.home.blocks.push({id:'dup',component:'content'}),d=>d.pages.player.blocks.push({id:'dup',component:'player'}),d=>d.pages.home.script='alert(1)']){const d=definition();mutate(d);assert.throws(()=>validateSkeleton(d,sections));}
});
test('published operations override content without changing skeleton or visual geometry',async()=>{
 const os=require('node:os'),deps=createRequire(path.join(require('../scripts/environment.cjs').environment().deps,'package.json')),dir=await fs.mkdtemp(path.join(os.tmpdir(),'skeleton-operations-')),outfile=path.join(dir,'module.cjs');
 let mergePreview;
 try{await deps('esbuild').build({entryPoints:[path.resolve('renderer/workbench/operations-preview.ts')],bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent',plugins:[{name:'aliases',setup(build){build.onResolve({filter:/^@\//},a=>({path:path.resolve('shared-source/src',a.path.slice(2))+'.ts'}));}}]});({mergePreview}=require(outfile));}finally{await fs.rm(dir,{recursive:true,force:true});}
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));theme.skeleton.definition=definition();theme.sections=[{...theme.sections[0],id:'one',columns:2}];const before=structuredClone(theme);
 const boot={contract:'hetun-operations-v1',schemaVersion:1,themeContract:'hetun-runtime-v1',platform:'mobile',version:2,config:{schedule:[{id:'anime-mon',vodId:'77',title:'周一更新',date:'2026-11-02',categoryId:'anime-child',categoryEntry:'anime'}],skeleton:{definition:{version:999}},carousel:{height:999,slides:[{id:'live',title:'已发布轮播',image:'/api/preview/media/'+ 'a'.repeat(48),video:'',vodId:'1',page:'home'}]},sections:[{id:'one',title:'真实栏目',source:'category',categoryId:'2',limit:6,enabled:true}]}};
 const merged=mergePreview(theme,boot,'mobile');assert.deepEqual(theme,before);assert.deepEqual(merged.skeleton,theme.skeleton);assert.deepEqual(merged.schedule,boot.config.schedule);assert.equal(merged.carousel.height,theme.carousel.height);assert.equal(merged.sections[0].columns,2);assert.equal(merged.sections[0].title,'真实栏目');assert.equal(merged.carousel.slides[0].title,'已发布轮播');assert.throws(()=>mergePreview(theme,boot,'tv'));assert.throws(()=>mergePreview(theme,{...boot,version:0},'mobile'));
});

test('independent skeleton survives validation, ZIP export and import with no editor changes',async()=>{
 const os=require('node:os');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-skeleton-roundtrip-'));
 try{
  const {validateTheme}=await import(pathToFileURL(path.resolve('shared-source/server/theme.mjs')));
  const {exportTheme}=await import(pathToFileURL(path.resolve('shared-source/server/export-theme.mjs')));
  const {installPackage,readPackage}=await import(pathToFileURL(path.resolve('shared-source/server/packages.mjs')));
  const draft=structuredClone(require('../shared-source/src/domain/default-theme.json'));draft.sections=[{...draft.sections[0],id:'one',page:'home'}];draft.skeleton.definition=definition();
  const normalized=validateTheme(draft);assert.deepEqual(normalized.skeleton.definition,definition());
  const bytes=await exportTheme({id:'independent-roundtrip',name:'独立骨架往返验证',platform:'mobile',draft:normalized},dir);
  const manifest=JSON.parse(readPackage(bytes).get('manifest.json'));assert.deepEqual(manifest.theme.skeleton.definition,definition());
  assert.ok(manifest.packaging.fields.includes('skeleton.definition.pages[].blocks[].component'));
  const imported=await installPackage({data:bytes.toString('base64')},dir);assert.deepEqual(imported.draft.skeleton.definition,definition());
  assert.equal(imported.draft.skeleton.definition.pages.player.blocks[1].component,'episodes');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('both example skeletons import into the unchanged editor contract',async()=>{
 const os=require('node:os');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-skeleton-examples-'));
 try{const {installPackage}=await import(pathToFileURL(path.resolve('shared-source/server/packages.mjs')));
 for(const id of ['cinema-standard','cinema-feature-first']){const bytes=await fs.readFile('examples/skeletons/'+id+'.json');const imported=await installPackage({data:bytes.toString('base64')},dir);assert.equal(imported.draft.skeleton.definition.id,id);assert.equal(imported.draft.carousel.slides.length,0);}}
 finally{await fs.rm(dir,{recursive:true,force:true});}
});
