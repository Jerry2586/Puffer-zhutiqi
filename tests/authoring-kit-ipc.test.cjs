'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
async function desktop(){
 const handlers=new Map(),writes=[],dialogs=[],window={};
 const bytes=Buffer.from('fixed generated authoring kit');
 let result={canceled:false,filePath:path.join(root,'fixed-kit.zip')},builds=0;
 const app={getPath:name=>path.join(root,name),setPath(){},commandLine:{appendSwitch(){}},setAppUserModelId(){},getVersion:()=> 'test',requestSingleInstanceLock:()=>false,quit(){}};
 const electron={app,BrowserWindow:{fromWebContents:sender=>sender.window},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{showSaveDialog:async(win,options)=>{dialogs.push({win,options});return result;}},nativeTheme:{},Menu:{},shell:{},screen:{}};
 const modules={electron,'node:fs/promises':{writeFile:async(...args)=>writes.push(args)},'node:path':path,'./core/local-service.cjs':{},'./core/zip.cjs':{},'./core/authoring-kit.cjs':{buildAuthoringKit:async()=>{builds++;return {name:'hetun-authoring-kit-v1.zip',bytes};}},'./core/appearance.cjs':{createAppearance:()=>({})},'./core/windows-shortcuts.cjs':{appId:'test'}};
 const context=vm.createContext({require:name=>{assert.ok(Object.hasOwn(modules,name),name);return modules[name];},process:{env:{},platform:'win32',pid:1},__dirname:root,Buffer,URL});
 vm.runInContext(await fs.readFile(path.join(root,'main.cjs'),'utf8')+'\n globalThis.setDesktopState=(w,l)=>{win=w;local=l;};',context,{filename:'main.cjs'});
 context.setDesktopState(window,{origin:'http://127.0.0.1:60001'});
 const frame={url:'http://127.0.0.1:60001/#/pages/studio/index'},sender={mainFrame:frame,window};
 return {handler:handlers.get('theme:download-authoring-kit'),event:{senderFrame:frame,sender},writes,dialogs,window,bytes,get builds(){return builds;},setResult:value=>{result=value;},setState:context.setDesktopState};
}
test('桌面底座下载拒绝子框架、其他窗口、外站和未启动服务',async()=>{
 const h=await desktop(),event=h.event;
 const invalid=[{...event,senderFrame:{url:event.senderFrame.url}},{...event,sender:{...event.sender,window:{}}},{senderFrame:{url:'https://example.com/'},sender:null}];
 invalid[2].sender={mainFrame:invalid[2].senderFrame,window:h.window};
 const fakeOrigin={url:'http://127.0.0.1:60001.evil.example/'};invalid.push({senderFrame:fakeOrigin,sender:{mainFrame:fakeOrigin,window:h.window}});
 for(const e of invalid)await assert.rejects(h.handler(e),/无效的软件通信来源/);
 h.setState(h.window,null);await assert.rejects(h.handler(event),/无效的软件通信来源/);
 assert.equal(h.builds,0);assert.equal(h.dialogs.length,0);assert.equal(h.writes.length,0);
});
test('桌面取消保存或非ZIP目标不会写文件',async()=>{
 const h=await desktop();h.setResult({canceled:true});
 assert.equal((await h.handler(h.event)).saved,false);assert.equal(h.writes.length,0);
 h.setResult({canceled:false,filePath:path.join(root,'kit.exe')});
 await assert.rejects(h.handler(h.event),/请保存为.zip文件/);assert.equal(h.writes.length,0);
});
test('桌面只保存固定生成的资料包，不接受渲染端替换字节或文件名',async()=>{
 const h=await desktop(),target=path.join(root,'user-choice.ZIP');h.setResult({canceled:false,filePath:target});
 const result=await h.handler(h.event,{name:'injected.zip',data:'untrusted bytes'});
 assert.equal(result.saved,true);assert.equal(result.path,target);assert.equal(h.builds,1);
 assert.equal(h.writes.length,1);assert.equal(h.writes[0][0],target);assert.strictEqual(h.writes[0][1],h.bytes);
 assert.strictEqual(h.dialogs[0].win,h.window);assert.equal(h.dialogs[0].options.defaultPath,path.join(root,'downloads','hetun-authoring-kit-v1.zip'));
});
test('preload冻结接口且底座下载不转发调用者参数',async()=>{
 let exposed;const calls=[];
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'hetunTheme');exposed=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {saved:false};}}};
 vm.runInNewContext(await fs.readFile(path.join(root,'preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return electron;}});
 assert.ok(Object.isFrozen(exposed));await exposed.downloadAuthoringKit({name:'untrusted.zip',data:'untrusted'});
 assert.deepEqual(calls,[['theme:download-authoring-kit']]);
});
