'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const {environment}=require('./environment.cjs');
async function main(){
 if(Number(process.versions.node.split('.')[0])!==22)throw Error('请使用包含npm的Node.js 22环境');
 const {source,shared,film,uni,electron}=environment();
 const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
 let npm;for(const item of candidates){try{await fs.access(item);npm=item;break;}catch{}}
 if(!npm)throw Error('未找到npm，请使用完整Node.js 22安装包');
 const cache=path.join(shared,'cache/npm');
 for(const [target,manifest,lock] of [[uni,path.join(film,'package.json'),path.join(film,'package-lock.json')],[electron,path.join(source,'scripts/dependencies/electron.package.json'),path.join(source,'scripts/dependencies/electron.package-lock.json')]]){
  await fs.mkdir(target,{recursive:true});await fs.copyFile(manifest,path.join(target,'package.json'));await fs.copyFile(lock,path.join(target,'package-lock.json'));
  console.log('安装外部依赖：'+target);
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[npm,'ci','--no-audit','--no-fund'],{cwd:target,windowsHide:true,stdio:'inherit',env:{...process.env,npm_config_cache:cache,electron_config_cache:path.join(shared,'cache/electron')}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('依赖安装失败：'+code)));});
 }
 console.log('安装外部Electron运行程序：'+electron);
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(electron,'node_modules/electron/install.js')],{cwd:electron,windowsHide:true,stdio:'inherit',env:{...process.env,electron_config_cache:path.join(shared,'cache/electron')}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Electron运行程序安装失败：'+code)));});
 console.log('环境准备完成，源码目录未安装运行依赖。');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
