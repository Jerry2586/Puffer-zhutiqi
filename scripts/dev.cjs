'use strict';
// Local source preview only. This script is not included in the installed application.
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const {environment}=require('./environment.cjs'),{startLocal}=require('../core/local-service.cjs');
async function main(){
 const env=environment(),root=path.join(env.root,'local-preview');await fs.mkdir(root,{recursive:true});
 console.log('正在编译当前源码预览（不生成安装包）…');
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'build.cjs'),'--frontend-only'],{cwd:env.source,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('预览编译失败，未启动旧版页面')));});
 const latest=JSON.parse(await fs.readFile(path.join(env.root,'latest-frontend.json'),'utf8'));
 const frontend=path.join(root,'frontend');await fs.cp(path.join(latest.resource,'frontend'),frontend,{recursive:true});
 const local=await startLocal({node:process.execPath,frontend,service:path.join(latest.resource,'theme-service'),state:path.join(root,'theme-service'),localAuthoring:true,browserPreview:true,logFile:path.join(root,'service.log')});
 const url=local.origin+(process.argv.includes('--skeleton')?'/#/pages/skeleton/index':'/#/pages/studio/index');await fs.writeFile(path.join(root,'preview.json'),JSON.stringify({pid:process.pid,url,root,startedAt:new Date().toISOString()},null,2));console.log('本地主题中心：'+url);console.log('全部离线：无需 Key，主题、草稿和素材仅保存在本机。');
 let rebuilding=false,queued=false,debounce;const watchers=[];
 function rebuild(){if(rebuilding){queued=true;return;}rebuilding=true;console.log('检测到界面修改，正在重新编译前端（不生成安装包）…');const child=spawn(process.execPath,[path.join(__dirname,'build.cjs'),'--frontend-only'],{cwd:env.source,windowsHide:true,stdio:'inherit'});child.on('exit',async code=>{try{if(code===0){const next=JSON.parse(await fs.readFile(path.join(env.root,'latest-frontend.json'),'utf8'));await fs.cp(path.join(next.resource,'frontend'),frontend,{recursive:true});console.log('界面已更新，刷新当前网页即可查看。');}}finally{rebuilding=false;if(queued){queued=false;rebuild();}}});}
 const watch=require('node:fs').watch;for(const directory of ['renderer/workbench','shared-source/src'])watchers.push(watch(path.join(env.source,directory),{recursive:true},()=>{clearTimeout(debounce);debounce=setTimeout(rebuild,700);}));
 let stopping=false;async function stop(){if(stopping)return;stopping=true;clearTimeout(debounce);for(const w of watchers)w.close();await local.stop();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
