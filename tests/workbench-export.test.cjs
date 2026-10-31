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
 return {w:context.workbench,calls,options,context,getSaved:()=>state.draft};
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

test('制作底座在未加载主题时可独立下载，取消和失败不触发主题保存导出',async()=>{
 const h=harness();h.context.window.hetunTheme.downloadAuthoringKit=async()=>{h.calls.push('kit');return {saved:true};};
 await h.w.downloadAuthoringKit();assert.deepEqual(h.calls,['kit']);assert.equal(h.w.message.value,'制作底座已下载。请解压后，将 theme/cinema-standard.zip 导入主题中心。');assert.equal(h.w.busy.value,false);
 h.w.message.value='';h.context.window.hetunTheme.downloadAuthoringKit=async()=>({saved:false});await h.w.downloadAuthoringKit();assert.equal(h.w.message.value,'');
 h.context.window.hetunTheme.downloadAuthoringKit=async()=>{throw Error('写入失败');};await h.w.downloadAuthoringKit();assert.equal(h.w.error.value,'写入失败');assert.equal(h.w.busy.value,false);assert.deepEqual(h.calls,['kit']);
});
test('制作底座下载防止重复提交，完成后解除忙碌',async()=>{
 const h=harness();let finish;h.context.window.hetunTheme.downloadAuthoringKit=()=>{h.calls.push('kit');return new Promise(r=>{finish=r;});};
 const pending=h.w.downloadAuthoringKit();await h.w.downloadAuthoringKit();assert.deepEqual(h.calls,['kit']);assert.equal(h.w.busy.value,true);finish({saved:true});await pending;assert.equal(h.w.busy.value,false);
});
test('浏览器下载使用同源空 POST、固定文件名并释放 Blob，错误允许重试',async()=>{
 const h=harness(),requests=[],events=[];h.context.window.hetunTheme=undefined;
 h.context.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,blob:async()=>({zip:true})};};
 h.context.URL={createObjectURL:blob=>{assert.equal(blob.zip,true);events.push('create');return 'blob:kit';},revokeObjectURL:url=>{assert.equal(url,'blob:kit');events.push('revoke');}};
 h.context.document={createElement:tag=>{assert.equal(tag,'a');const a={click(){assert.equal(a.href,'blob:kit');assert.equal(a.download,'hetun-authoring-kit-v1.zip');events.push('click');}};return a;}};
 const timers=[];h.context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
 await h.w.downloadAuthoringKit();assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/admin/authoring-kit');assert.deepEqual(JSON.parse(JSON.stringify(requests[0].options)),{method:'POST',credentials:'same-origin'});assert.deepEqual(events,['create','click']);assert.equal(h.w.message.value,'制作底座已下载。请解压后，将 theme/cinema-standard.zip 导入主题中心。');
 const cleanup=timers.find(x=>x.ms===1000);assert.ok(cleanup);cleanup.fn();assert.deepEqual(events,['create','click','revoke']);assert.equal(h.w.busy.value,false);assert.deepEqual(h.calls,[]);
 h.context.fetch=async()=>({ok:false,json:async()=>({error:'本机会话已失效'})});await h.w.downloadAuthoringKit();assert.equal(h.w.error.value,'本机会话已失效');assert.equal(h.w.busy.value,false);
 h.context.fetch=async()=>({ok:false,json:async()=>{throw Error('non-json');}});await h.w.downloadAuthoringKit();assert.match(h.w.error.value,/下载失败/);
});
