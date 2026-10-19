const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCatalog}=require('../core/local-catalog.cjs');
test('主题库保存后写入索引，未变化不重复导出，失败保留旧索引',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-catalog-'));try{
 let templates=[{id:'test-mobile',platform:'mobile',version:1}],exports=0,fail=false;
 const catalog=createCatalog({root,load:async()=>templates,exportTheme:async()=>{exports++;if(fail)throw Error('导出失败');return {data:Buffer.from('fixture').toString('base64')};}});
 await Promise.all([catalog.sync(),catalog.sync()]);assert.equal(exports,1);const first=await fs.readFile(path.join(root,'catalog.json'),'utf8');assert.equal(JSON.parse(first).entries.length,1);
 await catalog.sync();assert.equal(exports,1);templates=[{...templates[0],version:2}];fail=true;await assert.rejects(catalog.sync(),/导出失败/);assert.equal(await fs.readFile(path.join(root,'catalog.json'),'utf8'),first);
 templates=[];await catalog.sync();assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'catalog.json'))).entries,[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
