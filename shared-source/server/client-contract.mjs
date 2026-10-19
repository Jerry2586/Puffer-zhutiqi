import {readFileSync} from 'node:fs';
const apiSchema=JSON.parse(readFileSync(new URL('./native-api.openapi.json',import.meta.url),'utf8'));
export const nativeTargets=JSON.parse(readFileSync(new URL('../src/domain/native-targets.json',import.meta.url),'utf8'));
export function validateIntegration(input){
 if(input===undefined)return {version:1,apiBase:''};
 if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1)throw Error('客户端接入协议版本不支持。');
 if(Object.keys(input).some(k=>!['version','apiBase'].includes(k)))throw Error('接入配置只允许协议版本和服务地址，请勿放入密钥或证书。');
 if(typeof input.apiBase!=='string'||input.apiBase.length>2048)throw Error('正式服务地址无效。');
 const base=input.apiBase.trim();if(!base)return {version:1,apiBase:''};
 let url;try{url=new URL(base);}catch{throw Error('请输入完整的 HTTPS 正式服务地址。');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('正式服务地址须为 HTTPS，不能携带账号、密码、查询参数或片段。');
 const host=url.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.localhost')||/^127\./.test(host)||['[::1]','0.0.0.0','[::]'].includes(host))throw Error('正式服务地址不能使用本机回环地址。');
 return {version:1,apiBase:url.toString().replace(/\/+$/,'')};
}
export function createClientContract(platform,integration){
 if(!Object.hasOwn(nativeTargets,platform))throw Error('不支持的客户端平台。');
 const config=validateIntegration(integration);
 return {
  format:'hetun-client-contract',version:1,contentProvider:'maccms-v10',transport:'https-json',
  apiBase:config.apiBase,platform,targets:[...nativeTargets[platform]],
  apiSchema:{...structuredClone(apiSchema),servers:config.apiBase?[{url:config.apiBase}]:[]},
  readiness:{configured:!!config.apiBase,nativeAdapter:'required',gateway:'requires-deployment-verification',packer:'requires-contract-v1-adapter'},
  theme:{format:'hetun-skeleton',version:2,renderer:'hetun-v2',schemaVersion:2,assetBase:'package-root',remoteAssets:'https-required-for-native'},
  authentication:{scheme:'Bearer',source:'POST /api/member/login (operations gateway only)',embedCredentials:false,tokenLifetimeSeconds:28800},
  endpoints:{
   memberLogin:{method:'POST',path:'/api/member/login',request:{username:'string',password:'string'},response:{token:'string',profile:'object'},availability:'operations gateway with CMS member API; unavailable in local theme service'},
   memberLogout:{method:'POST',path:'/api/member/logout',authentication:'required bearer',response:{ok:'boolean'},availability:'operations gateway only'},
   theme:{method:'GET',path:'/api/theme',query:{platform},response:{theme:'Theme',version:'integer',template:'string',publishedAt:'string|null'}},
   categories:{method:'GET',path:'/api/catalog/categories',response:{items:'Category[]'}},
   catalog:{method:'GET',path:'/api/catalog',query:{page:'integer >= 1',keyword:'string',category:'string',ids:'comma-separated IDs'},response:{items:'Vod[]',page:'integer',pages:'integer',total:'integer'}},
   playback:{method:'POST',path:'/api/playback',request:{id:'string',sid:'integer >= 1 (source index)',nid:'integer >= 1 (episode index)'},response:{url:'http(s) string; native TLS policy applies',name:'string'},authentication:'optional bearer; CMS decides viewing permission',requires:'河豚 CMS 播放适配文件'}
  },
  models:{
   Category:{id:'string',name:'string'},
   Vod:{id:'string',title:'string',poster:'string',category:'string',categoryId:'string',year:'string',area:'string',note:'string',score:'string',description:'string',actors:'string',director:'string',protected:'boolean',sources:'Source[]'},
   Source:{name:'string',episodes:'Episode[]'},Episode:{name:'string',url:'empty string; resolve through playback'}
  },
  errors:{shape:{error:'string'},handling:'Check HTTP status before decoding; handle 401/403/404 and other non-2xx responses.'},
  build:{input:'native-source-or-supported-base-template',android:'compile resources, align and sign APK/AAB',ios:'macOS + Xcode + provisioning + signing; output IPA',secrets:'keystore, passwords, p12 and provisioning profiles stay in packer secure storage'},
  limitations:['Native renderers must implement hetun-v2 theme fields; theme center does not provide Kotlin/Swift renderers.','Targets describe intended adapters, not certified compatibility with arbitrary APKs.','MacCMS collection API alone cannot provide all login, payment or playback permission features.']
 };
}
