import http from 'node:http';
import {licensing} from './licensing.mjs';
import {exportTheme} from './export-theme.mjs';
const themeOnly=process.env.HETUN_PRODUCT_MODE==='theme-center';
const operationsOnly=process.env.HETUN_PRODUCT_MODE==='operations-center';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { defaultTheme, validateTheme } from './theme.mjs';
import {createMobileTemplate,mergeBundledMobileTemplates} from './mobile-template.mjs';
import { cmsEndpoint, categoriesCms, listCms } from './cms.mjs';
import { createCmsChecker } from './cms-health.mjs';
import {installPackage,storeAsset} from './packages.mjs';
import {createMemberService,cmsMemberRequest} from './member.mjs';
const dataDir = process.env.HETUN_STATE_DIR;
if (!dataDir || !path.isAbsolute(dataDir)) throw new Error('请通过外部运行环境设置绝对路径 HETUN_STATE_DIR，禁止在项目内保存运行数据。');
const projectRoot = path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const resolvedData=path.resolve(dataDir);
const comparableRoot=process.platform==='win32'?projectRoot.toLowerCase():projectRoot;
const comparableData=process.platform==='win32'?resolvedData.toLowerCase():resolvedData;
if (comparableData === comparableRoot || comparableData.startsWith(comparableRoot + path.sep)) throw new Error('状态目录必须在项目目录之外。');
await fs.mkdir(dataDir,{recursive:true});
const statePath=path.join(dataDir,'theme-state.json');
const credentialsPath=path.join(dataDir,'admin-credentials.json');
const atomicWrite=async (file,data) => { const temp=file+'.'+randomBytes(5).toString('hex')+'.tmp'; await fs.writeFile(temp,JSON.stringify(data,null,2),'utf8'); await fs.rename(temp,file); };
let state;
try { state=JSON.parse(await fs.readFile(statePath,'utf8')); state.draft=validateTheme(state.draft); state.published=validateTheme(state.published); } catch(e) {
  if(e.code !== 'ENOENT') throw e;
  state={version:1,publishedVersion:1,draft:structuredClone(defaultTheme),published:structuredClone(defaultTheme),cmsBase:'',updatedAt:new Date().toISOString(),publishedAt:new Date().toISOString()};
  await atomicWrite(statePath,state);
}
// Template library and one-time consolidation of the original mobile pair.
const assetDir=path.join(dataDir,'assets');await fs.mkdir(assetDir,{recursive:true});
if(!state.templates){const t=createMobileTemplate(state);state.templates=[t];state.activeTemplates={mobile:t.id};state.selectedTemplate=t.id;await atomicWrite(statePath,state);}
for(const t of state.templates){t.draft=validateTheme(t.draft);if(t.published)t.published=validateTheme(t.published);}
const consolidated=mergeBundledMobileTemplates(state);
if(consolidated){
  const backupDir=path.join(dataDir,'migrations');await fs.mkdir(backupDir,{recursive:true});
  await atomicWrite(path.join(backupDir,'before-kuying-'+Date.now()+'.json'),state);
  for(const t of consolidated.templates){t.draft=validateTheme(t.draft);if(t.published)t.published=validateTheme(t.published);}
  await atomicWrite(statePath,consolidated);state=consolidated;
}
const checkCms=createCmsChecker(process.env.HETUN_ALLOW_PRIVATE_CMS==='1');
const member=createMemberService(()=>state.cmsBase,process.env.HETUN_ALLOW_PRIVATE_CMS==='1');
let credentials;
try { credentials=JSON.parse(await fs.readFile(credentialsPath,'utf8')); } catch(e) {
  if(e.code !== 'ENOENT') throw e;
  const password=randomBytes(18).toString('base64url'); const salt=randomBytes(16).toString('hex');
  credentials={username:'admin',password,salt,hash:scryptSync(password,salt,32).toString('hex')};
  await atomicWrite(credentialsPath,credentials);
}
const sessions=new Map(); const attempts=new Map();
let mutation=Promise.resolve();
async function changeState(change) { const task=mutation.then(async () => { const next=await change(structuredClone(state)); await atomicWrite(statePath,next); state=next; return next; }); mutation=task.catch(()=>{}); return task; }
const configuredOrigin=process.env.HETUN_PUBLIC_ORIGIN;
const allowedOrigins=new Set([...((themeOnly||operationsOnly)?[]:['http://127.0.0.1:5173','http://localhost:5173']), ...(configuredOrigin?[configuredOrigin]:[])]);
const host=process.env.HETUN_HOST || '127.0.0.1'; const port=Number(process.env.HETUN_PORT || 8787);
// Local authoring is only enabled by the loopback desktop launcher; deployment licensing stays independent.
const localAuthoring=themeOnly&&process.env.HETUN_LOCAL_THEME_AUTHORING==='1'&&host==='127.0.0.1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(configuredOrigin||'');
const cloudLicense=localAuthoring?null:await licensing(dataDir);
const license=localAuthoring?{require:async()=>({themes:['*']})}:{...cloudLicense,status:async()=>({...await cloudLicense.status(),localAuthoring:false})};
// Offline authoring exposes only local storage and theme package operations.
const offlineRoutes=new Set(['/api/health','/api/admin/login','/api/admin/logout','/api/admin/state','/api/admin/install','/api/admin/template/rename','/api/admin/template/remove','/api/admin/asset','/api/admin/draft','/api/admin/export']);
if(host !== '127.0.0.1' && !configuredOrigin) throw new Error('开放远程服务前必须设置 HETUN_PUBLIC_ORIGIN 为实际 HTTPS 前端地址。');
function send(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(data)); }
async function body(req,maxBytes=256*1024) {
  const chunks=[]; let bytes=0;
  for await (const chunk of req) { bytes+=chunk.length; if(bytes>maxBytes) { const e=new Error('请求内容过大。'); e.status=413; throw e; } chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('JSON 格式错误。'); }
}
function auth(req) {
  const token=/hetun_session=([^;]+)/.exec(req.headers.cookie || '')?.[1]; const session=sessions.get(token);
  if (!session || session.expires<Date.now()) { if(token) sessions.delete(token); const e=new Error('请先登录主题工作台。'); e.status=401; throw e; }
  return token;
}
function templateIn(current,id){const t=current.templates.find(t=>t.id===id);if(!t){const e=new Error('模板未安装。');e.status=404;throw e;}return t;}
async function studioState(id=''){const grant=await license.require('theme');const permitted=state.templates.filter(t=>grant.themes.includes('*')||grant.themes.includes(t.id));if(id)await license.require('theme',id);const t=permitted.find(t=>t.id===(id||state.selectedTemplate))||permitted[0];const activeTemplates=Object.fromEntries(Object.entries(state.activeTemplates).filter(([,value])=>permitted.some(t=>t.id===value)));if(!t)return {draft:structuredClone(defaultTheme),published:structuredClone(defaultTheme),version:0,publishedVersion:0,cmsBase:state.cmsBase,updatedAt:state.updatedAt,publishedAt:state.publishedAt,selectedTemplate:'',templates:[],activeTemplates};return {draft:t.draft,published:t.published||t.draft,version:t.version,publishedVersion:t.publishedVersion,cmsBase:state.cmsBase,updatedAt:state.updatedAt,publishedAt:state.publishedAt,selectedTemplate:t.id,templates:permitted,activeTemplates};}
const server=http.createServer(async (req,res) => {
  const origin=req.headers.origin;
  if(origin && allowedOrigins.has(origin)) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Access-Control-Allow-Credentials','true'); res.setHeader('Vary','Origin'); }
  if(req.method==='OPTIONS') { res.setHeader('Access-Control-Allow-Methods','GET, PUT, POST'); res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Hetun-Client, Authorization'); res.writeHead(204);res.end();return; }
  try {
    const url=new URL(req.url,'http://local'); const route=url.pathname;
    if(localAuthoring&&(req.headers.host!=='127.0.0.1:'+port||(origin&&!allowedOrigins.has(origin)))){send(res,403,{error:'请求来源未授权。'});return;}
    if(localAuthoring&&route.startsWith('/api/')&&!offlineRoutes.has(route)&&!route.startsWith('/api/assets/')){send(res,404,{error:'主题中心仅提供本地编辑、保存和主题包导入导出。',code:'OFFLINE_ONLY'});return;}
    if (!['GET','HEAD'].includes(req.method) && ((route.startsWith('/api/admin/') && (!origin || !allowedOrigins.has(origin) || req.headers['x-hetun-client']!=='studio')) || (!route.startsWith('/api/admin/') && origin && !allowedOrigins.has(origin)))) { send(res,403,{error:'请求来源未授权。'});return; }
    if(route==='/api/health') { send(res,200,{status:'ok',service:'hetun',cmsConfigured:!localAuthoring&&!!state.cmsBase,offline:localAuthoring});return; }
    if(route==='/api/admin/login' && req.method==='POST') {
      const key=req.socket.remoteAddress; const record=attempts.get(key) || {count:0,start:Date.now()};
      if(Date.now()-record.start>15*60*1000) { record.count=0; record.start=Date.now(); }
      if(record.count>=8) { send(res,429,{error:'登录尝试过多，请 15 分钟后重试。'});return; }
      const input=await body(req); const supplied=scryptSync(String(input.password || '').slice(0,200),credentials.salt,32);
      if(input.username!==credentials.username || !timingSafeEqual(supplied,Buffer.from(credentials.hash,'hex'))) { record.count++;attempts.set(key,record);send(res,401,{error:'账号或密码错误。'});return; }
      attempts.delete(key); const token=randomBytes(32).toString('hex'); sessions.set(token,{expires:Date.now()+8*60*60*1000});
      res.setHeader('Set-Cookie','hetun_session='+token+'; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800'+(configuredOrigin?.startsWith('https:')?'; Secure':''));
      send(res,200,{ok:true});return;
    }
    if(route.startsWith('/api/admin/')) {
      const token=auth(req);
      if(route==='/api/admin/logout' && req.method==='POST') {sessions.delete(token);res.setHeader('Set-Cookie','hetun_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');send(res,200,{ok:true});return;}
      if(route==='/api/admin/license' && req.method==='GET'){send(res,200,await license.status());return;}
      if(route==='/api/admin/license' && req.method==='PUT'){const input=await body(req);send(res,200,input.clear===true?await license.clear():await license.activate(input.key));return;}
      if(themeOnly&&!['/api/admin/state','/api/admin/install','/api/admin/template/rename','/api/admin/template/remove','/api/admin/asset','/api/admin/draft','/api/admin/publish','/api/admin/export','/api/admin/cms','/api/admin/cms/check','/api/admin/cms/status'].includes(route)){send(res,404,{error:'此功能不属于主题制作软件。'});return;}
      await license.require(themeOnly?'theme':'film-center');
      if(['/api/admin/state','/api/admin/install','/api/admin/template/rename','/api/admin/template/remove','/api/admin/asset','/api/admin/draft','/api/admin/publish'].includes(route))await license.require('theme');
      if(route==='/api/admin/state' && req.method==='GET') {const id=url.searchParams.get('template')||'';send(res,200,await studioState(id));return;}
      if(operationsOnly&&route==='/api/admin/export'){send(res,404,{error:'主题制作与导出请使用独立主题中心。'});return;}
      if(route==='/api/admin/export' && req.method==='GET'){const id=url.searchParams.get('template')||state.selectedTemplate;await license.require('theme',id);const t=templateIn(state,id),bytes=await exportTheme(t,assetDir);send(res,200,{name:t.id+'.zip',data:bytes.toString('base64')});return;}
      if(route==='/api/admin/install' && req.method==='POST') {
        const input=await body(req,18*1024*1024);const template=await installPackage(input,assetDir,id=>license.require('theme',id));
        await changeState(current=>{if(current.templates.length>=80)throw new Error('模板库最多80套。');if(current.templates.some(t=>t.id===template.id))throw new Error('模板标识已存在，请使用新的包标识以保留原模板。');current.templates.push(template);return current;});send(res,200,await studioState(template.id));return;
      }
      if(route==='/api/admin/template/rename' && req.method==='PUT') {
        const input=await body(req);await license.require('theme',input.template);const name=String(input.name||'').trim();if(!name||name.length>40)throw new Error('骨架名称为1–40个字符。');
        await changeState(current=>{const t=templateIn(current,input.template);if(input.version!==t.version){const e=new Error('骨架已更新，请重新加载再操作。');e.status=409;throw e;}t.name=name;t.version++;current.updatedAt=new Date().toISOString();return current;});send(res,200,await studioState(input.template));return;
      }
      if(route==='/api/admin/template/remove' && req.method==='POST') {
        const input=await body(req);await license.require('theme',input.template);let nextId='';await changeState(current=>{const t=templateIn(current,input.template);if(input.version!==t.version){const e=new Error('骨架已更新，请重新加载再操作。');e.status=409;throw e;}if(current.activeTemplates[t.platform]===t.id){if(!localAuthoring&&input.unpublish!==true)throw new Error('此骨架正在发布使用，请明确确认停止发布后再删除。');delete current.activeTemplates[t.platform];}current.templates=current.templates.filter(v=>v.id!==t.id);nextId=current.templates.find(v=>v.platform===t.platform)?.id||current.templates[0]?.id||'';if(current.selectedTemplate===t.id)current.selectedTemplate=nextId;current.updatedAt=new Date().toISOString();return current;});send(res,200,await studioState());return;
      }
      if(route==='/api/admin/asset' && req.method==='POST') {const input=await body(req,15*1024*1024);send(res,200,{url:await storeAsset(Buffer.from(String(input.data||''),'base64'),String(input.name||''),assetDir)});return;}
      if(route==='/api/admin/draft' && req.method==='PUT') {
        const input=await body(req);const draft=validateTheme(input.theme);const id=input.template||state.selectedTemplate;await license.require('theme',id);
        await changeState(current=>{const t=templateIn(current,id);if(input.version!==t.version){const e=new Error('此模板已在其他窗口更新。请重新加载草稿。');e.status=409;throw e;}t.draft=draft;t.version++;current.updatedAt=new Date().toISOString();return current;});send(res,200,await studioState(id));return;
      }
      if(route==='/api/admin/publish' && req.method==='POST') {
        const input=await body(req);const id=input.template||state.selectedTemplate;await license.require('theme',id);
        await changeState(current=>{const t=templateIn(current,id);if(input.version!==t.version){const e=new Error('模板版本已变化，请重新保存。');e.status=409;throw e;}t.published=structuredClone(t.draft);t.publishedVersion++;current.activeTemplates[t.platform]=t.id;current.publishedAt=new Date().toISOString();return current;});send(res,200,await studioState(id));return;
      }
      if(route==='/api/admin/cms/status' && req.method==='GET') {send(res,200,await checkCms(state.cmsBase));return;}
      if(route==='/api/admin/cms/check' && req.method==='POST') {const input=await body(req);send(res,200,await checkCms(input.base));return;}
      if(route==='/api/admin/cms' && req.method==='PUT') {
        const input=await body(req);const cmsBase=input.base ? cmsEndpoint(String(input.base)).toString() : '';
        const cmsStatus=await checkCms(cmsBase);
        if(cmsBase&&!cmsStatus.ok){send(res,400,{error:cmsStatus.checks.filter(v=>!v.ok).map(v=>v.label+'：'+v.error).join('；')||cmsStatus.message,cmsStatus});return;}
        await changeState(current => ({...current,cmsBase}));send(res,200,{...await studioState(),cmsStatus});return;
      }
    }
    if(themeOnly&&route.startsWith('/api/')&&!['/api/theme','/api/catalog','/api/catalog/categories','/api/playback'].includes(route)&&!route.startsWith('/api/assets/')){send(res,404,{error:'此功能不属于主题制作软件。'});return;}
    if(route.startsWith('/api/'))await license.require(themeOnly?'theme':'film-center');
    if(route.startsWith('/api/assets/') && req.method==='GET'){const name=route.slice('/api/assets/'.length);if(!/^[a-f0-9]{64}\.(png|jpg|webp|svg|mp4)$/.test(name)){send(res,404,{error:'素材不存在。'});return;}try{const bytes=await fs.readFile(path.join(assetDir,name));res.writeHead(200,{'Content-Type':{'png':'image/png','jpg':'image/jpeg','webp':'image/webp','svg':'image/svg+xml','mp4':'video/mp4'}[name.split('.').pop()],'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});res.end(bytes);}catch(e){if(e.code!=='ENOENT')throw e;send(res,404,{error:'素材不存在。'});}return;}
    if(route.startsWith('/api/checkout/')&&req.method==='GET'){const id=route.slice('/api/checkout/'.length);if(!/^[a-f0-9]{64}$/.test(id)){send(res,404,{error:'收银台不存在。'});return;}const doc=member.checkout(id);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':doc.csp,'X-Content-Type-Options':'nosniff'});res.end(doc.html);return;}
    if(route.startsWith('/api/member/')){const name=route.slice('/api/member/'.length);const result=await member.handle(name,req.method,req,req.method==='GET'?Object.fromEntries(url.searchParams):await body(req));send(res,200,result);return;}
    if(route==='/api/playback' && req.method==='POST'){const input=await body(req);const result=await member.playback(input,req);send(res,200,result);return;}
    if(route==='/api/theme' && req.method==='GET'){const platform=url.searchParams.get('platform')||'mobile';const t=state.templates.find(t=>t.id===state.activeTemplates[platform]&&t.platform===platform);if(!t?.published){send(res,404,{error:'该端模板尚未安装并发布。',locked:true});return;}await license.require('theme',t.id);send(res,200,{theme:t.published,version:t.publishedVersion,template:t.id,publishedAt:state.publishedAt});return;}
    if(route==='/api/catalog/categories' && req.method==='GET') {send(res,200,{items:await categoriesCms(state.cmsBase,process.env.HETUN_ALLOW_PRIVATE_CMS==='1')});return;}
    if(route==='/api/catalog' && req.method==='GET') {send(res,200,await listCms(state.cmsBase,{page:Math.min(10000,Math.max(1,Number(url.searchParams.get('page'))||1)),keyword:(url.searchParams.get('keyword')||'').slice(0,100),category:(url.searchParams.get('category')||'').slice(0,20),ids:(url.searchParams.get('ids')||'').slice(0,80)},process.env.HETUN_ALLOW_PRIVATE_CMS==='1'));return;}
    send(res,404,{error:'没有找到这个接口。'});
  } catch(e) { send(res,e.status || 400,{error:e.message || '操作失败。',code:e.code||''}); }
});
server.listen(port,host,() => console.log('河豚配置服务：http://'+host+':'+port+'；状态目录位于外部运行环境。'));
