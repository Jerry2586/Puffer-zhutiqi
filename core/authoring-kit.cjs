'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {makeZip}=require('./zip.cjs');
const AUTHORING_KIT_NAME='hetun-authoring-kit-v1.zip';
const BASE_SHA256='ce59037880cee7c4bdeed61ca8b2c90530934bd3c183020bc765dcbf4eeeac8f';
const files=Object.freeze([
 ['README.md','AUTHORING-KIT.md'],
 ['THEME-AUTHORING.md','THEME-AUTHORING.md'],
 ['PACKAGE-CONTRACT.md','PACKAGE-CONTRACT.md'],
 ['theme/cinema-standard.zip','assets/authoring-base.zip'],
 ['contracts/skeleton-schema.json','shared-source/src/domain/skeleton-schema.json'],
 ['contracts/visual-schema.json','shared-source/src/domain/visual-schema.json'],
 ['contracts/native-api.openapi.json','shared-source/server/native-api.openapi.json']
]);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function buildAuthoringKit(){
 const root=path.resolve(__dirname,'..'),entries=new Map();
 for(const [name,source] of files)entries.set(name,await fs.readFile(path.join(root,source)));
 if(sha256(entries.get('theme/cinema-standard.zip'))!==BASE_SHA256)throw Error('制作底座与定稿不一致，已停止下载');
 const manifest={format:'hetun-authoring-kit',version:1,installable:false,
  protocols:{theme:'hetun-skeleton',version:2,renderer:'hetun-v2',skeletonDefinition:1,packaging:'hetun-package-v1'},
  baseline:{path:'theme/cinema-standard.zip',sha256:BASE_SHA256},
  files:Object.fromEntries([...entries].map(([name,bytes])=>[name,{size:bytes.length,sha256:sha256(bytes)}]))};
 entries.set('kit-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 return {name:AUTHORING_KIT_NAME,bytes:makeZip(entries)};
}
module.exports={buildAuthoringKit,AUTHORING_KIT_NAME};
