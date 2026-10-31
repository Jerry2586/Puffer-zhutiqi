'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
// One allowlist drives both staging and electron-builder; never copy all of core/.
const APP_SOURCES=Object.freeze([
 'main.cjs','preload.cjs','core/local-service.cjs','core/authoring-kit.cjs',
 'core/offline-network.cjs','core/operations-preview.cjs',
 'core/zip.cjs','core/appearance.cjs','core/windows-shortcuts.cjs','assets','package.json',
 'README.md','ARCHITECTURE.md','PACKAGE-CONTRACT.md','NATIVE-INTEGRATION.md',
 'AUTHORING-KIT.md','THEME-AUTHORING.md',
 'shared-source/src/domain/skeleton-schema.json',
 'shared-source/src/domain/visual-schema.json','shared-source/server/native-api.openapi.json'
]);
const APP_FILES=Object.freeze(APP_SOURCES.map(name=>name==='assets'?'assets/**':name).concat('build-info.json'));
async function stageApp(source,destination){
 for(const name of APP_SOURCES){
  const target=path.join(destination,name);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.cp(path.join(source,name),target,{recursive:true,errorOnExist:true,force:false});
 }
}
module.exports={APP_SOURCES,APP_FILES,stageApp};
