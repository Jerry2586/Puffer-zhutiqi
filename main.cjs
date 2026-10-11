'use strict';
const {app,BrowserWindow,Menu,ipcMain,dialog,shell}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {startLocal}=require('./core/local-service.cjs'),{readZip}=require('./core/zip.cjs');
const root=process.env.HETUN_THEME_DATA||path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'HetunThemeCenter');
app.setPath('userData',path.join(root,'desktop'));
let win,local,quitting=false;
const resource=app.isPackaged?process.resourcesPath:process.env.HETUN_THEME_RESOURCE_ROOT;
let runtime={version:app.getVersion(),pid:process.pid,packaged:app.isPackaged,startedAt:new Date().toISOString(),phase:'starting',localAuthoring:true};
async function diagnostic(update){Object.assign(runtime,update,{updatedAt:new Date().toISOString()});try{await fs.mkdir(path.join(root,'logs'),{recursive:true});await fs.writeFile(path.join(root,'logs/runtime.json'),JSON.stringify(runtime,null,2));}catch{}}
function checkSender(event){const url=event.senderFrame?.url||'';if(event.senderFrame!==event.sender.mainFrame||BrowserWindow.fromWebContents(event.sender)!==win||!local||!url.startsWith(local.origin+'/'))throw Error('无效的软件通信来源');}
async function boot(){
 if(local){await local.stop();local=null;}
 local=await startLocal({node:process.execPath,frontend:path.join(resource,'frontend'),service:path.join(resource,'theme-service'),state:path.join(root,'theme-service'),config:{},key:'',localAuthoring:true,logFile:path.join(root,'logs/service.log')});
 await win.webContents.session.cookies.set({url:local.origin,name:'hetun_session',value:local.cookie,path:'/api',httpOnly:true,sameSite:'strict',secure:false});
 await win.loadURL(local.origin+'/#/pages/studio/index');win.show();
 await diagnostic({phase:'ready',origin:local.origin,api:local.api,servicePid:local.child.pid,windowVisible:win.isVisible(),title:win.getTitle()});
}
function windowOptions(){return {width:1580,height:1000,minWidth:1100,minHeight:760,title:'河豚主题中心',backgroundColor:'#10131a',icon:path.join(__dirname,'assets/theme-center.ico'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}};}
function secureWindow(w){
 w.on('show',()=>diagnostic({windowVisible:true}));
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
ipcMain.handle('theme:save-export',async(e,v)=>{
 checkSender(e);if(!v||!/^[-a-z0-9]{3,101}\.zip$/.test(v.name)||typeof v.data!=='string'||v.data.length>17*1024*1024)throw Error('主题包无效');
 const bytes=Buffer.from(v.data,'base64'),entries=readZip(bytes);if(bytes.length>12*1024*1024||!entries.has('manifest.json'))throw Error('主题包无效');
 const r=await dialog.showSaveDialog(win,{title:'导出河豚主题包',defaultPath:path.join(app.getPath('downloads'),v.name),filters:[{name:'河豚主题包',extensions:['zip']}]});
 if(r.canceled)return {saved:false};if(path.extname(r.filePath).toLowerCase()!=='.zip')throw Error('请保存为.zip文件');await fs.writeFile(r.filePath,bytes);return {saved:true,path:r.filePath};
});
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async()=>{
  if(!resource)throw Error('缺少主题软件运行资源，请重新安装。');
  await fs.mkdir(path.join(root,'logs'),{recursive:true});win=new BrowserWindow(windowOptions());secureWindow(win);win.on('closed',()=>win=null);
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'河豚主题中心',submenu:[{label:'打开主题数据目录',click:()=>shell.openPath(root)},{type:'separator'},{label:'退出',role:'quit'}]},{label:'视图',submenu:[{role:'reload'},{role:'togglefullscreen'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},{label:'帮助',submenu:[{label:'关于河豚主题中心',click:()=>dialog.showMessageBox(win,{type:'info',title:'河豚主题中心',message:'河豚主题中心 '+app.getVersion(),detail:'独立主题制作软件 · 品牌 / 骨架 / 排版 / 装饰\n保存、预览并导出河豚主题包。'})}]}]));
  try{await boot();}catch(e){await diagnostic({phase:'failed',error:e.message});await dialog.showMessageBox(win,{type:'error',title:'主题服务启动失败',message:e.message});app.quit();}
 }).catch(e=>{dialog.showErrorBox('河豚主题中心',e.message);app.quit();});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',e=>{if(quitting)return;e.preventDefault();quitting=true;Promise.resolve(local?.stop()).then(()=>diagnostic({phase:'stopped'})).finally(()=>app.quit());});
}
