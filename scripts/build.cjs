'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {createRequire}=require('node:module'),{spawn,execFileSync}=require('node:child_process');
function run(exe,args,cwd,env){return new Promise((ok,no)=>{const p=spawn(exe,args,{cwd,env,windowsHide:true,stdio:'inherit'});p.once('error',no);p.once('exit',code=>code===0?ok():no(Error('构建失败，退出码 '+code)));});}
async function main(){
 const {source,film,shared,root,deps,electron:electronDev}=require('./environment.cjs').environment();
 for(const location of [path.join(film,'src'),path.join(deps,'vue-tsc/bin/vue-tsc.js'),path.join(electronDev,'node_modules/electron/package.json')]){try{await fs.access(location);}catch{throw Error('缺少源码或外部依赖，请先执行 node scripts/setup.cjs：'+location);}}
 let revision='local';try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:source,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 const pkg=JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'));
 const batch=path.join(root,'builds',pkg.version+'-'+Date.now()),compiler=path.join(batch,'compiler'),stage=path.join(batch,'app'),resource=path.join(batch,'resources');
 await fs.mkdir(compiler,{recursive:true});await fs.mkdir(stage,{recursive:true});
 for(const name of ['src','package.json','tsconfig.json','shims-uni.d.ts','index.html'])await fs.cp(path.join(film,name),path.join(compiler,name),{recursive:true});
 await fs.cp(path.join(source,'renderer/workbench'),path.join(compiler,'src/desktop'),{recursive:true});
 await fs.writeFile(path.join(compiler,'src/pages/studio/index.vue'),'<script setup lang="ts">import ThemeWorkbench from "@/desktop/ThemeWorkbench.vue";</script><template><ThemeWorkbench/></template>\n');
 const manifestPath=path.join(compiler,'src/manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.h5={...manifest.h5,title:'河豚主题中心'};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));
 const htmlFile=path.join(compiler,'index.html');
 let html=await fs.readFile(htmlFile,'utf8');
 html=html.replace(/<script>[^]*?<\/script>/g,'<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />').replace(/<title>[^]*?<\/title>/,'<title>河豚主题中心</title>');
 await fs.writeFile(htmlFile,html);
 await fs.symlink(deps,path.join(compiler,'node_modules'),'junction');
 await fs.writeFile(path.join(compiler,'vite.config.ts'),"import {defineConfig} from 'vite';import uni from '@dcloudio/vite-plugin-uni';export default defineConfig({base:'/',plugins:[uni()]});\n");
 const frontend=path.join(resource,'frontend');
 const env={...process.env,VITE_HETUN_THEME_DESKTOP:'1',VITE_HETUN_SERVICE_BASE:'',UNI_INPUT_DIR:path.join(compiler,'src'),UNI_OUTPUT_DIR:frontend,UNI_PLATFORM:'h5',NODE_ENV:'production'};
 for(const k of Object.keys(env))if(k.startsWith('VITE_')&&!['VITE_HETUN_THEME_DESKTOP','VITE_HETUN_SERVICE_BASE'].includes(k))delete env[k];
 await run(process.execPath,[path.join(deps,'vue-tsc/bin/vue-tsc.js'),'--noEmit'],compiler,env);
 await run(process.execPath,[path.join(deps,'@dcloudio/vite-plugin-uni/bin/uni.js'),'build','-p','h5'],compiler,env);
 // uni-app injects CDN title-bar shadows; packaged CSS must not load remote resources.
 for(const file of await fs.readdir(frontend,{recursive:true})){if(!file.endsWith('.css'))continue;const location=path.join(frontend,file),css=await fs.readFile(location,'utf8');await fs.writeFile(location,css.replace(/url\(\s*(['"]?)(?:https?:)?\/\/[^'")\s]+\1\s*\)/gi,'none'));}
 await fs.cp(path.join(film,'server'),path.join(resource,'theme-service/server'),{recursive:true});
 await fs.mkdir(path.join(resource,'theme-service/src/domain'),{recursive:true});
 for(const file of ['default-theme.json','native-targets.json'])await fs.copyFile(path.join(film,'src/domain',file),path.join(resource,'theme-service/src/domain',file));
 const {startLocal}=require('../core/local-service.cjs');
 const smoke=await startLocal({node:process.execPath,frontend,service:path.join(resource,'theme-service'),state:path.join(batch,'smoke-state'),config:{},key:'',linkDirectory:path.join(batch,'smoke-local-link'),localAuthoring:true,logFile:path.join(batch,'service-smoke.log')});
 try{if(!(await fetch(smoke.origin)).ok)throw Error('主题编译页面无法读取');const editable=await fetch(smoke.origin+'/api/admin/state',{headers:{Cookie:'hetun_session='+smoke.cookie}});if(!editable.ok||!(await editable.json()).templates.length)throw Error('无Key本地主题库无法编辑');await fs.writeFile(path.join(batch,'service-smoke.json'),JSON.stringify({ok:true,defaultSkeleton:true,health:true,frontend:true,linkDirectory:path.join(root,'test-local-link'),localAuthoring:true,editable:true}));}finally{await smoke.stop();}
 console.log('已验证独立运行资源：主题服务、默认骨架和编译页面。');
 if(process.argv.includes('--frontend-only')){await fs.writeFile(path.join(root,'latest-frontend.json'),JSON.stringify({version:pkg.version,batch,compiler,resource},null,2));console.log(JSON.stringify({version:pkg.version,resource},null,2));return;}
 for(const name of ['main.cjs','preload.cjs','core','renderer','assets','package.json','README.md','ARCHITECTURE.md'])await fs.cp(path.join(source,name),path.join(stage,name),{recursive:true});
 await fs.writeFile(path.join(stage,'build-info.json'),JSON.stringify({version:pkg.version,builtAt:new Date().toISOString(),sourceRevision:revision},null,2));
 const req=createRequire(path.join(electronDev,'package.json')),{build,Platform,Arch}=req('electron-builder'),electronPkg=req('electron/package.json');
 const release=path.join(root,'release','v'+pkg.version);await fs.mkdir(release,{recursive:true});
 process.env.ELECTRON_BUILDER_CACHE=path.join(shared,'cache/electron-builder');process.env.CSC_IDENTITY_AUTO_DISCOVERY='false';
 const artifacts=await build({projectDir:stage,targets:Platform.WINDOWS.createTarget(['dir','portable','nsis'],Arch.x64),config:{
  appId:'com.hetun.theme-center',productName:'河豚主题中心',electronVersion:electronPkg.version,electronDist:path.join(electronDev,'node_modules/electron/dist'),
  directories:{app:stage,output:release,buildResources:path.join(stage,'assets')},asar:true,npmRebuild:false,
  files:['main.cjs','preload.cjs','core/local-service.cjs','core/local-link.cjs','core/local-catalog.cjs','core/offline-network.cjs','core/zip.cjs','core/appearance.cjs','core/windows-shortcuts.cjs','assets/**','package.json','README.md','ARCHITECTURE.md','build-info.json'],
  extraResources:[{from:path.join(resource,'frontend'),to:'frontend'},{from:path.join(resource,'theme-service'),to:'theme-service'}],
  win:{icon:path.join(stage,'assets/theme-center.ico'),signAndEditExecutable:true},
  portable:{requestExecutionLevel:'user',artifactName:'Hetun-Theme-Center-'+pkg.version+'-x64.exe'},
  nsis:{artifactName:'Hetun-Theme-Center-'+pkg.version+'-x64-Setup.exe',oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,deleteAppDataOnUninstall:false,createDesktopShortcut:true,shortcutName:'河豚主题中心',runAfterFinish:false},publish:null
 }});
 await require('./release-manifest.cjs').writeManifest(release,pkg.version,revision);
 await fs.writeFile(path.join(root,'latest-build.json'),JSON.stringify({version:pkg.version,revision,release,resource,stage,artifacts},null,2));
 console.log(JSON.stringify({version:pkg.version,release,artifacts},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
