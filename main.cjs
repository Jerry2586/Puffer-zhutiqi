'use strict';
const {app,BrowserWindow,Menu,ipcMain,dialog,shell,screen,nativeTheme,safeStorage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {startLocal}=require('./core/local-service.cjs'),{readZip}=require('./core/zip.cjs');
const root=process.env.HETUN_THEME_DATA||path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'HetunThemeCenter');
app.setPath('userData',path.join(root,'desktop'));
let win,local,authorization,quitting=false;
const {createDesktopAuthorization}=require('./core/desktop-authorization.cjs');
const {createAppearance}=require('./core/appearance.cjs'),{repairShortcuts,appId}=require('./core/windows-shortcuts.cjs');
const appearance=createAppearance({root,nativeTheme,getWindow:()=>win});
if(process.platform==='win32')app.setAppUserModelId(appId);
const resource=app.isPackaged?process.resourcesPath:process.env.HETUN_THEME_RESOURCE_ROOT;
let runtime={version:app.getVersion(),pid:process.pid,packaged:app.isPackaged,startedAt:new Date().toISOString(),phase:'starting',localAuthoring:true};
async function diagnostic(update){Object.assign(runtime,update,{updatedAt:new Date().toISOString()});try{await fs.mkdir(path.join(root,'logs'),{recursive:true});await fs.writeFile(path.join(root,'logs/runtime.json'),JSON.stringify(runtime,null,2));}catch{}}
function checkSender(event){const url=event.senderFrame?.url||'';if(event.senderFrame!==event.sender.mainFrame||BrowserWindow.fromWebContents(event.sender)!==win||!local||!url.startsWith(local.origin+'/'))throw Error('无效的软件通信来源');}
async function boot(){
 authorization.auth.assert();
 if(local){await local.stop();local=null;}
 local=await startLocal({node:process.execPath,frontend:path.join(resource,'frontend'),service:path.join(resource,'theme-service'),state:path.join(root,'theme-service'),config:{},key:'',localAuthoring:true,authorize:()=>authorization.auth.assert(),logFile:path.join(root,'logs/service.log')});
 await win.webContents.session.cookies.set({url:local.origin,name:'hetun_session',value:local.cookie,path:'/api',httpOnly:true,sameSite:'strict',secure:false});
 await win.loadURL(local.origin+'/#/pages/studio/index');win.show();
 await diagnostic({phase:'ready',origin:local.origin,api:local.api,servicePid:local.child.pid,windowVisible:win.isVisible(),title:win.getTitle()});
}
function windowOptions(){const {width,height}=screen.getPrimaryDisplay().workAreaSize;return {width:Math.min(1580,width),height:Math.min(1000,height),minWidth:Math.min(1100,width),minHeight:Math.min(520,height),autoHideMenuBar:true,title:'河豚主题中心',backgroundColor:appearance.get()==='dark'?'#101217':'#f2f4f7',icon:path.join(__dirname,'assets/theme-center.ico'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}};}
function secureWindow(w){
 w.on('show',()=>diagnostic({windowVisible:true}));
 w.webContents.on('will-prevent-unload',event=>{
  const choice=dialog.showMessageBoxSync(w,{type:'question',title:'还有未保存的主题修改',message:'主题修改尚未保存。',detail:'选择继续编辑，可以先保存草稿。离开将放弃本次未保存的修改。',buttons:['继续编辑','离开并放弃修改'],defaultId:0,cancelId:0,noLink:true});
  if(choice===1)event.preventDefault();
 });
 w.webContents.setWindowOpenHandler(({url})=>{try{if(new URL(url).protocol==='https:')shell.openExternal(url);}catch{}return {action:'deny'};});
 w.webContents.on('will-navigate',(e,url)=>{if(local&&url.startsWith(local.origin+'/'))return;e.preventDefault();});
 w.once('ready-to-show',()=>{w.show();diagnostic({windowVisible:w.isVisible()});});
 w.webContents.on('page-title-updated',(_e,title)=>diagnostic({title}));
 w.webContents.on('console-message',detail=>{if(detail?.level==='error')diagnostic({rendererError:String(detail.message).replace(/HTN_[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1000)});});
 w.webContents.on('did-finish-load',()=>diagnostic({lastLoaded:w.webContents.getURL(),title:w.getTitle()}));
 w.webContents.on('did-fail-load',(_e,code,description)=>diagnostic({loadError:{code,description}}));
 w.webContents.on('render-process-gone',(_e,detail)=>diagnostic({rendererExit:detail.reason}));
 w.webContents.session.setPermissionRequestHandler((_w,_p,done)=>done(false));
}
ipcMain.handle('theme:get-appearance',e=>{checkSender(e);return appearance.get();});
ipcMain.handle('theme:set-appearance',async(e,value)=>{checkSender(e);const mode=await appearance.set(value);await diagnostic({appearance:mode});return mode;});
ipcMain.handle('theme:save-export',async(e,v)=>{
 checkSender(e);authorization.auth.assert();if(!v||!/^[-a-z0-9]{3,101}\.zip$/.test(v.name)||typeof v.data!=='string'||v.data.length>17*1024*1024)throw Error('主题包无效');
 const bytes=Buffer.from(v.data,'base64'),entries=readZip(bytes);if(bytes.length>12*1024*1024||!entries.has('manifest.json'))throw Error('主题包无效');
 const r=await dialog.showSaveDialog(win,{title:'导出河豚主题包',defaultPath:path.join(app.getPath('downloads'),v.name),filters:[{name:'河豚主题包',extensions:['zip']}]});
 if(r.canceled)return {saved:false};if(path.extname(r.filePath).toLowerCase()!=='.zip')throw Error('请保存为.zip文件');await fs.writeFile(r.filePath,bytes);await authorization.auth.record('theme-export');return {saved:true,path:r.filePath};
});
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async()=>{
  if(!resource)throw Error('缺少主题软件运行资源，请重新安装。');
  await appearance.load();
  try{await diagnostic({shortcutsRepaired:await repairShortcuts({app,shell,root,sourceIcon:path.join(__dirname,'assets/theme-center.ico')})});}catch(e){await diagnostic({shortcutError:e.message});}
  await fs.mkdir(path.join(root,'logs'),{recursive:true});win=new BrowserWindow(windowOptions());secureWindow(win);win.on('closed',()=>win=null);
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'河豚主题中心',submenu:[{label:'授权与离线迁移',click:()=>authorization.show()},{label:'打开主题数据目录',click:()=>shell.openPath(root)},{type:'separator'},{label:'退出',role:'quit'}]},{label:'视图',submenu:[{role:'reload'},{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},{label:'帮助',submenu:[{label:'关于河豚主题中心',click:()=>dialog.showMessageBox(win,{type:'info',title:'河豚主题中心',message:'河豚主题中心 '+app.getVersion(),detail:'独立主题制作软件 · 品牌 / 骨架 / 排版 / 装饰\n保存、预览并导出河豚主题包。'})}]}]));
  try{authorization=await createDesktopAuthorization({app,BrowserWindow,ipcMain,dialog,safeStorage,root,product:'theme-center',parent:()=>win,onInvalid:async()=>{await local?.stop();local=null;win.hide();await authorization.show();if(authorization.auth.status().valid)await boot();else app.quit();}});await authorization.ready();await boot();}catch(e){await diagnostic({phase:'failed',error:e.message});await dialog.showMessageBox(win,{type:'error',title:'主题服务启动失败',message:e.message});app.quit();}
 }).catch(e=>{dialog.showErrorBox('河豚主题中心',e.message);app.quit();});
 app.on('window-all-closed',()=>app.quit());
 app.on('will-quit',e=>{if(quitting)return;authorization?.stop();e.preventDefault();quitting=true;Promise.resolve(local?.stop()).then(()=>diagnostic({phase:'stopped'})).finally(()=>app.quit());});
}
