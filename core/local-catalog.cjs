'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {MAX,linkRoot,atomic}=require('./local-link.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function createCatalog({load,exportTheme,root=linkRoot()}){
 let previous='',running;
 async function sync(){
  if(running)return running;
  running=(async()=>{
   const templates=await load();if(!Array.isArray(templates)||templates.length>80)throw Error('本机主题库无效');
   const revision=hash(JSON.stringify(templates));if(revision===previous)return;
   const entries=[];await fs.mkdir(path.join(root,'catalog'),{recursive:true});
   for(const t of templates){
    const bundle=await exportTheme(t.id);
    if(typeof bundle.data!=='string'||bundle.data.length>Math.ceil(MAX/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(bundle.data))throw Error('主题库导出包无效');
    const bytes=Buffer.from(bundle.data,'base64');if(!bytes.length||bytes.length>MAX)throw Error('主题库导出包超过限制');
    const sha256=hash(bytes),file=path.join(root,'catalog',sha256+'.zip');
    try{await fs.writeFile(file,bytes,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
    entries.push({id:t.id,platform:t.platform,sha256});
   }
   await atomic(path.join(root,'catalog.json'),{protocol:'hetun-local-catalog',version:1,entries});previous=revision;
  })().finally(()=>{running=null;});return running;
 }
 return {sync};
}
module.exports={createCatalog};
