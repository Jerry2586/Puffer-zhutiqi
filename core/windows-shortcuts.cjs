'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const appId='com.hetun.theme-center';
async function repairShortcuts({app,shell,root,sourceIcon,exe=process.execPath,platform=process.platform}){
 if(platform!=='win32'||!app.isPackaged||process.env.HETUN_THEME_DATA)return [];
 const icon=path.join(root,'icons','theme-center-purple-'+app.getVersion()+'.ico');
 await fs.mkdir(path.dirname(icon),{recursive:true});await fs.copyFile(sourceIcon,icon);
 const files=[path.join(app.getPath('desktop'),'河豚主题中心.lnk')];
 if(process.env.APPDATA)files.push(path.join(process.env.APPDATA,'Microsoft','Windows','Start Menu','Programs','河豚主题中心.lnk'));
 const repaired=[];
 for(const file of files){try{
  const link=shell.readShortcutLink(file);
  if(path.resolve(link.target).toLowerCase()!==path.resolve(exe).toLowerCase())continue;
  if(link.icon!==icon||link.iconIndex!==0||link.appUserModelId!==appId){
   // Recreate the link rather than retaining stale shell metadata from an old install.
   const staging=path.join(root,'icons','shortcut-'+require('node:crypto').randomUUID()+'.lnk');
   try{
    if(shell.writeShortcutLink(staging,'create',{...link,icon,iconIndex:0,appUserModelId:appId})){
     await fs.rename(staging,file);repaired.push(file);
    }
   }finally{await fs.rm(staging,{force:true});}
  }
 }catch{}}
 return repaired;
}
module.exports={repairShortcuts,appId};
