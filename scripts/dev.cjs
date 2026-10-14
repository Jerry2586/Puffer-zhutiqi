'use strict';
// Local source preview only. This script is not included in the installed application.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {environment}=require('./environment.cjs'),{Authorization}=require('../core/authorization.cjs'),{ProductCenter}=require('../core/product-center.cjs'),{startLocal}=require('../core/local-service.cjs'),{loadTerminalTrust}=require('../core/terminal-trust.cjs');
async function main(){
 const env=environment(),root=path.join(env.root,'local-preview'),pkg=require('../package.json');await fs.mkdir(root,{recursive:true});
 console.log('正在编译当前源码预览（不生成安装包）…');
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'build.cjs'),'--frontend-only'],{cwd:env.source,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('预览编译失败，未启动旧版页面')));});
 const secretFile=path.join(root,'preview-secret.bin');let secret;try{secret=await fs.readFile(secretFile);}catch(e){if(e.code!=='ENOENT')throw e;secret=crypto.randomBytes(32);await fs.writeFile(secretFile,secret,{mode:0o600,flag:'wx'});}
 const encrypt=text=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secret,iv),body=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]);};
 const decrypt=b=>{const c=crypto.createDecipheriv('aes-256-gcm',secret,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');};
 const auth=await new Authorization({root:path.join(root,'authorization'),product:'theme-center',version:pkg.version,trust:await loadTerminalTrust({developmentTrustFile:process.env.HETUN_AUTH_TRUST_FILE}),encrypt,decrypt,machineFile:path.join(root,'machine-id')}).init();await auth.launch();auth.start();
 const center=await new ProductCenter({auth,root:path.join(root,'product-center'),version:pkg.version}).init();center.start();
 const latest=JSON.parse(await fs.readFile(path.join(env.root,'latest-frontend.json'),'utf8'));
 const frontend=path.join(root,'frontend');await fs.cp(path.join(latest.resource,'frontend'),frontend,{recursive:true});
 const local=await startLocal({node:process.execPath,frontend,service:path.join(latest.resource,'theme-service'),state:path.join(root,'theme-service'),localAuthoring:true,productCenter:center,browserPreview:true,authorize:()=>{if(auth.data.key)center.assertEditing();},logFile:path.join(root,'service.log')});
 const url=local.origin+'/#/pages/studio/index';await fs.writeFile(path.join(root,'preview.json'),JSON.stringify({pid:process.pid,url,root,startedAt:new Date().toISOString()},null,2));console.log('本地主题中心：'+url);console.log('源码预览可直接编辑；输入正式 Key 后执行终端授权规则。未激活时不会伪造云端记录。');
 let rebuilding=false,queued=false,debounce;const watchers=[];
 function rebuild(){if(rebuilding){queued=true;return;}rebuilding=true;console.log('检测到界面修改，正在重新编译前端（不生成安装包）…');const child=spawn(process.execPath,[path.join(__dirname,'build.cjs'),'--frontend-only'],{cwd:env.source,windowsHide:true,stdio:'inherit'});child.on('exit',async code=>{try{if(code===0){const next=JSON.parse(await fs.readFile(path.join(env.root,'latest-frontend.json'),'utf8'));await fs.cp(path.join(next.resource,'frontend'),frontend,{recursive:true});console.log('界面已更新，刷新当前网页即可查看。');}}finally{rebuilding=false;if(queued){queued=false;rebuild();}}});}
 const watch=require('node:fs').watch;watchers.push(watch(path.join(env.source,'renderer/workbench'),{recursive:true},()=>{clearTimeout(debounce);debounce=setTimeout(rebuild,700);}));
 let stopping=false;async function stop(){if(stopping)return;stopping=true;clearTimeout(debounce);for(const w of watchers)w.close();auth.stop();center.stop();await local.stop();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
