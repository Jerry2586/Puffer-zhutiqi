'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
function createAppearance({root,nativeTheme,getWindow}){
 const file=path.join(root,'desktop-appearance.json');let mode='dark',pending=Promise.resolve();
 function apply(value){mode=value;nativeTheme.themeSource=value;getWindow()?.setBackgroundColor(value==='dark'?'#101217':'#f2f4f7');}
 return {
  async load(){try{const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.mode==='light'||data.mode==='dark')mode=data.mode;}catch{}apply(mode);return mode;},
  get(){return mode;},
  async set(value){if(value!=='dark'&&value!=='light')throw Error('无效的明暗模式');apply(value);const json=JSON.stringify({mode:value});pending=pending.catch(()=>{}).then(async()=>{await fs.mkdir(root,{recursive:true});await fs.writeFile(file+'.tmp',json);await fs.rename(file+'.tmp',file);});await pending;return value;}
 };
}
module.exports={createAppearance};
