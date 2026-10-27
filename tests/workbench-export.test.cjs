'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../renderer/workbench/useWorkbench.ts'),'utf8');
const executable=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,'').replace(/^export /gm,''));
function harness(options={}){
 const calls=[],bundle={name:'theme.zip',data:Buffer.from('zip fixture').toString('base64')};
 const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../shared-source/src/domain/default-theme.json'),'utf8'));
 let state={selectedTemplate:'test-theme',version:1,draft,templates:[{id:'test-theme',name:'测试主题',platform:'mobile',version:1,published:true}]};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const api={state:async()=>clone(state),save:async(theme,version,id)=>{calls.push('save');assert.equal(version,state.version);assert.equal(id,state.selectedTemplate);if(options.saveError)throw Error('保存失败');state={...state,draft:clone(theme),version:version+1};return clone(state);},exportTheme:async id=>{calls.push('export');assert.equal(id,state.selectedTemplate);if(options.exportError)throw Error('导出失败');return bundle;},publish:async()=>{throw Error('导出不应触发发布');}};
 const context={api,defaults:draft,normalizeTheme:clone,chooseLocalFile:async()=>{throw Error('unexpected file picker');},ref:value=>({value}),computed:fn=>({get value(){return fn();}}),watch(){},onMounted(){},onUnmounted(){},uni:{getStorageSync(){}},window:{hetunTheme:{saveExport:async value=>{calls.push('download');assert.deepEqual(value,bundle);return {saved:!options.cancel};}}},pageNames:{home:'首页'},available:()=>true,setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(executable+';globalThis.workbench=useWorkbench();',context);
 return {w:context.workbench,calls,options,getSaved:()=>state.draft};
}
test('主题导出先保存当前草稿，再导出并交给下载，不调用发布',async()=>{
 const h=harness();await h.w.loadWorkspace();h.w.theme.value.brand.name='最新草稿';assert.equal(h.w.dirty.value,true);
 await h.w.exportPackage();assert.deepEqual(h.calls,['save','export','download']);assert.equal(h.getSaved().brand.name,'最新草稿');assert.equal(h.w.dirty.value,false);assert.equal(h.w.busy.value,false);assert.match(h.w.message.value,/打包器中手动导入/);assert.equal(h.w.publishPreview,undefined);
});
test('已保存主题可直接导出，无需重复保存或发布',async()=>{
 const h=harness();await h.w.loadWorkspace();await h.w.exportPackage();assert.deepEqual(h.calls,['export','download']);assert.equal(h.w.error.value,'');
});
test('保存失败时停止导出，保留未保存修改并解除忙碌状态',async()=>{
 const h=harness({saveError:true});await h.w.loadWorkspace();h.w.theme.value.brand.name='未保存';await h.w.exportPackage();assert.deepEqual(h.calls,['save']);assert.equal(h.w.theme.value.brand.name,'未保存');assert.equal(h.w.dirty.value,true);assert.equal(h.w.busy.value,false);assert.equal(h.w.error.value,'保存失败');
});
test('导出失败后保留已保存草稿，重试不重复保存',async()=>{
 const h=harness({exportError:true});await h.w.loadWorkspace();h.w.theme.value.brand.name='已保存的修改';await h.w.exportPackage();assert.equal(h.w.dirty.value,false);assert.equal(h.getSaved().brand.name,'已保存的修改');assert.equal(h.w.error.value,'导出失败');assert.equal(h.w.busy.value,false);
 h.options.exportError=false;await h.w.exportPackage();assert.deepEqual(h.calls,['save','export','export','download']);assert.equal(h.w.error.value,'');
});
test('用户取消文件保存时不显示导出成功',async()=>{
 const h=harness({cancel:true});await h.w.loadWorkspace();await h.w.exportPackage();assert.deepEqual(h.calls,['export','download']);assert.equal(h.w.message.value,'');assert.equal(h.w.busy.value,false);
});
