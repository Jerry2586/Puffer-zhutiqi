'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('设置页和骨架库共用构建版本，禁止页面写死发布版本号',async()=>{
 const directory=path.join(root,'renderer/workbench');
 for(const name of ['OfflineSettings.vue','ThemeWorkbench.vue']){
  const source=await fs.readFile(path.join(directory,name),'utf8');
  assert.match(source,/import\s*\{appVersion\}\s*from\s*['"]\.\/app-version['"]/,name+' must use the shared version');
  assert.match(source,/\{\{appVersion\}\}/,name+' must display that version');
  assert.doesNotMatch(source,/['"]v?\d+\.\d+\.\d+['"]/,name+' must not hardcode a release version');
 }
 const source=await fs.readFile(path.join(directory,'app-version.ts'),'utf8');
 assert.doesNotMatch(source,/['"]v?\d+\.\d+\.\d+['"]/);
 for(const version of [require('../package.json').version,'1.2.345',undefined]){
  // Evaluate the same module with the environment supplied by the frontend compiler.
  const compiled=source.replace('import.meta.env',JSON.stringify({VITE_HETUN_APP_VERSION:version}));
  const actual=await import('data:text/javascript,'+encodeURIComponent(compiled));
  assert.equal(actual.appVersion,version||'开发版');
 }
});
