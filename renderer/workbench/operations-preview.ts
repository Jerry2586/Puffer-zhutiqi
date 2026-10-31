import type {Theme,Platform} from '@/domain/types';
import {mergeOperationsPages} from '@/domain/operations-pages';
import {categoryPageKey} from '@/domain/category';
export interface PreviewBootstrap {contract:string;schemaVersion:number;themeContract:string;platform:Platform;version:number;pollSeconds?:number;config:Record<string,any>}
const listFields:Record<string,string[]>={sections:['id','enabled','page','categoryEntry','title','subtitle','source','categoryId','limit','orderBy','manualIds'],navigation:['id','label','enabled','page','categoryId'],categories:['id','label','enabled','page','categoryId'],ads:['id','name','slot','enabled','media','asset','page','url','start','end','duration','skipAfter','frequency'],schedule:['id','vodId','title','date','categoryId','categoryEntry']};
const booleans=['enabled','notifyOnLaunch','forceUpdate'];const numbers=['limit','duration','skipAfter'];
function fields(value:any,allowed:string[]){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('运营配置格式无效');const out:Record<string,any>={};for(const key of allowed)if(Object.hasOwn(value,key)){const v=value[key];if(booleans.includes(key)?typeof v!=='boolean':numbers.includes(key)?!Number.isInteger(v)||v<0||v>60:typeof v!=='string'||v.length>6000)throw Error('运营字段格式无效：'+key);out[key]=v;}return out;}
export function mergePreview(theme:Theme,response:PreviewBootstrap,platform:Platform):Theme{
 if(response.contract!=='hetun-operations-v1'||response.schemaVersion!==1||response.themeContract!=='hetun-runtime-v1'||response.platform!==platform||!Number.isSafeInteger(response.version)||response.version<1)throw Error('运营协议或设备不匹配');
 const out=JSON.parse(JSON.stringify(theme)),config=response.config;if(!config||typeof config!=='object'||Array.isArray(config))throw Error('运营内容格式无效');
 for(const [key,allowed]of Object.entries(listFields))if(config[key]!==undefined){const list=config[key],seen=new Set();if(!Array.isArray(list)||list.length>(key==='sections'?40:key==='schedule'?100:20))throw Error('运营条目数量无效');out[key]=list.map((v:any)=>{const item=fields(v,allowed);if(!/^[A-Za-z0-9_-]{1,64}$/.test(item.id)||seen.has(item.id))throw Error('运营条目编号无效或重复');seen.add(item.id);const originals=(theme as any)[key]||[];return {...(originals.find((s:any)=>s.id===item.id)||(key==='sections'?{kind:'poster',columns:3,style:'grid3',showMore:true}:['navigation','categories'].includes(key)?{icon:'',activeIcon:''}:{})||{}),...item};});}
 for(const [key,allowed]of Object.entries({clientSettings:['disclaimer','privacy','about','latestVersion','updateNotes','androidUrl','iosUrl','notifyOnLaunch','forceUpdate'],announcement:['enabled','text','title','image','frequency','actionLabel','page','url']}))if(config[key]!==undefined)out[key]={...out[key],...fields(config[key],allowed)};
 if(config.features){out.features={...out.features};for(const key of ['serviceMenu','member','shortdrama','schedule','ranking','memberCard'])if(Object.hasOwn(config.features,key)){if(typeof config.features[key]!=='boolean')throw Error('运营功能开关无效');out.features[key]=config.features[key];}}
 // A bootstrap without a carousel binding must not revive artwork embedded in the imported theme.
 out.carousel={...out.carousel,slides:[]};
 if(config.carousel!==undefined){const slides=config.carousel.slides,seen=new Set();if(!Array.isArray(slides)||slides.length>20)throw Error('运营轮播无效');out.carousel={...out.carousel,slides:slides.map((v:any)=>{const s=fields(v,['id','vodId','title','image','video','page']);if(!/^[A-Za-z0-9_-]{1,64}$/.test(s.id)||seen.has(s.id))throw Error('运营轮播编号无效');seen.add(s.id);return s;})};}
 // Campaign entries and their groups are layout slots owned by the skeleton.
 // Matching operations records still override content and enabled state.
 const campaigns=theme.categories.filter(n=>n.page==='category'&&theme.pageDesign?.[categoryPageKey(n.id)]?.campaign);
 const groupIds=new Set(campaigns.flatMap(n=>theme.pageDesign![categoryPageKey(n.id)].campaign!.groupIds));
 for(const [key,slots,max] of [['categories',campaigns,20],['sections',theme.sections.filter(s=>groupIds.has(s.id)),40]] as const){
  if(config[key]===undefined)continue;
  for(const slot of slots)if(!out[key].some((s:{id:string})=>s.id===slot.id))out[key].push(JSON.parse(JSON.stringify(slot)));
  if(out[key].length>max)throw Error('运营条目与活动栏目合计超过数量上限，请减少条目后重试');
 }
 out.pageDesign=mergeOperationsPages(out,config.pageDesign);
 return out;
}
