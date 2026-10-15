'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');

// electron-builder NSIS handles the existing install directory and relaunch.
// Keep arguments separate from the executable: no shell or interpolated command.
function launchInstaller(file,spawnProcess=spawn){
 if(!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.exe')return Promise.reject(Error('更新安装程序路径无效'));
 return new Promise((resolve,reject)=>{
  let child;
  try{child=spawnProcess(file,['/S','--updated','--force-run'],{detached:true,stdio:'ignore',windowsHide:true,shell:false});}catch(error){reject(error);return;}
  child.once('error',reject);
  child.once('spawn',()=>{child.unref();resolve({started:true});});
 });
}
function createDesktopUpdater({app,platform=process.platform,spawnProcess=spawn}){
 let pending=null;
 return {
  install(file){
   if(platform!=='win32'||!app.isPackaged)return Promise.reject(Error('自动安装请使用 Windows 正式桌面程序；本地开发只预览更新'));
   if(pending)return Promise.reject(Error('更新安装正在准备'));
   return new Promise((resolve,reject)=>{pending={file,resolve,reject};app.quit();});
  },
  acceptQuit(){pending?.resolve({scheduled:true});},
  cancel(){if(pending){const item=pending;pending=null;item.reject(Error('已取消安装，请先保存主题修改后重试'));}},
  async finish(){
   const item=pending;pending=null;if(!item)return;
   try{const result=await launchInstaller(item.file,spawnProcess);item.resolve(result);return result;}
   catch(error){item.reject(error);throw error;}
  }
 };
}
module.exports={launchInstaller,createDesktopUpdater};
