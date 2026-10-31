'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module');
const deps=createRequire(path.join(require('../scripts/environment.cjs').environment().deps,'package.json'));
let loaded;async function domain(){return loaded??=(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'category-scope-')),outfile=path.join(dir,'scope.cjs');try{await deps('esbuild').build({entryPoints:[path.resolve(__dirname,'../shared-source/src/domain/category-scope.ts')],bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent'});return require(outfile);}finally{await fs.rm(dir,{recursive:true,force:true});}})();}
test('category scope includes CMS descendants and manual children without leaking unbound roots',async()=>{
 const {categoryScopeIds}=await domain();const categories=[{id:'6',parentId:'1'},{id:'9',parentId:'6'},{id:'2'},{id:'10',parentId:'8'},{id:'1',parentId:'9'}];
 assert.deepEqual([...categoryScopeIds('1',categories,['8'])].sort(),['1','10','6','8','9']);
 assert.deepEqual([...categoryScopeIds('6',categories)].sort(),['1','6','9']);
 assert.equal(categoryScopeIds('',categories,['8']).size,0);
});
test('schedules classify legacy videos, isolate directory bindings and honor child filters',async()=>{
 const {categoryScopeIds,categorySchedule}=await domain();const rows=[
 {id:'m',vodId:'m',date:'2026-11-03',title:'电影'},
 {id:'s',vodId:'s',date:'2026-11-01',title:'电视剧'},
 {id:'child',vodId:'child',date:'2026-11-02',title:'动作',categoryEntry:'movie'},
 {id:'entry',vodId:'unknown',date:'2026-11-05',title:'待确认',categoryEntry:'movie'},
 {id:'wrong',vodId:'child',date:'2026-11-01',title:'另一个入口',categoryEntry:'series'},
 {id:'explicit',vodId:'direct',date:'2026-11-04',title:'直接绑定',categoryId:'6'},
 {id:'unclassified',vodId:'missing',date:'2026-11-01',title:'未知'}];
 const items=[{id:'m',categoryId:'1'},{id:'s',categoryId:'2'},{id:'child',categoryId:'6'}];
 assert.deepEqual(categorySchedule(rows,items,'movie',categoryScopeIds('1',[],['6'])).map(r=>r.id),['child','m','explicit','entry']);
 assert.deepEqual(categorySchedule(rows,items,'movie',new Set(['6']),false).map(r=>r.id),['child','explicit']);
 assert.deepEqual(categorySchedule(rows,items,'series',new Set(['2'])).map(r=>r.id),['s']);
 assert.deepEqual(categorySchedule(rows,items,'movie',new Set()),[]);
 assert.deepEqual(rows.map(r=>r.id),['m','s','child','entry','wrong','explicit','unclassified']);
});
test('schedule lookups include entry-bound legacy IDs, deduplicate and respect endpoint limits',async()=>{
 const {scheduleIdBatches}=await domain();const ids=Array.from({length:30},(_,i)=>String(100000+i));
 const rows=ids.map(vodId=>({vodId,categoryEntry:'movie'}));rows.push(rows[0],{vodId:'already-bound',categoryId:'1'});
 const batches=scheduleIdBatches(rows);assert.ok(batches.every(v=>v.length<=80));assert.deepEqual(batches.flatMap(v=>v.split(',')),ids);
});
