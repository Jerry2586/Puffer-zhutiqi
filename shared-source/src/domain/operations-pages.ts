import type {PageDesign,Theme} from './types';
import {categoryEntryFromPage} from './category';
const pages=['home','category','search','shortdrama','member','mine','ranking','schedule','library','history','settings','disclaimer','privacy','about'];
function object(v:any){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('运营页面配置无效');return v;}
function text(v:any,max:number){if(typeof v!=='string'||v.length>max)throw Error('运营页面文字无效');return v.trim();}
function id(v:any){const s=text(v,64);if(!/^[\w-]{1,64}$/.test(s))throw Error('运营页面编号无效');return s;}
function list(v:any,convert:(item:any)=>any){if(!Array.isArray(v)||v.length>20)throw Error('运营页面入口数量无效');const seen=new Set();return v.map(item=>{object(item);const key=id(item.id);if(seen.has(key))throw Error('运营页面入口编号重复');seen.add(key);return convert(item);});}
/** Operations may change content and routing; renderer-owned visuals remain in the skeleton. */
export function mergeOperationsPages(theme:Theme,input:any):Theme['pageDesign']{
 if(input===undefined)return theme.pageDesign;
 object(input);if(Object.keys(input).length>100)throw Error('运营页面数量无效');
 const result=JSON.parse(JSON.stringify(theme.pageDesign||{}));
 for(const [page,raw] of Object.entries(input)){
  if(!pages.includes(page)&&!categoryEntryFromPage(page))throw Error('运营页面编号无效');
  const value=object(raw),out:PageDesign=result[page]||{};
  if(value.categoryFilters!==undefined){
   if(!(page==='category'||page==='shortdrama'||categoryEntryFromPage(page)))throw Error('运营子分类位置无效');
   const bindings=new Set();out.categoryFilters=list(value.categoryFilters,f=>{const categoryId=text(f.categoryId,20),label=text(f.label,20);if(!categoryId||!label||bindings.has(categoryId))throw Error('运营子分类绑定无效或重复');bindings.add(categoryId);return {id:id(f.id),label,categoryId};});
  }
  for(const key of ['shortcuts','menu'] as const)if(value[key]!==undefined){
   if(key==='menu'?page!=='home':!(page==='category'||categoryEntryFromPage(page)))throw Error('运营入口位置无效');
   out[key]=list(value[key],link=>{const label=text(link.label,20),entryId=text(link.entryId??'',64);if(!label||!pages.includes(link.page)||typeof link.enabled!=='boolean'||entryId&&!/^[\w-]{1,64}$/.test(entryId))throw Error('运营入口目标无效');const linkId=id(link.id),original=out[key]?.find(n=>n.id===linkId);return {id:linkId,label,page:link.page,categoryId:text(link.categoryId??'',20),entryId,content:text(link.content??'',6000),icon:original?.icon||'',enabled:link.enabled};});
  }
  if(value.campaign!==undefined){
   const c=object(value.campaign);if(!out.campaign)throw Error('运营活动必须绑定已有骨架活动页');
   const campaign={...out.campaign};
   for(const [key,max]of Object.entries({title:40,subtitle:100,eyebrow:24,featuredId:30,bannerTitle:40,bannerText:100,bannerLabel:16}))if(c[key]!==undefined)(campaign as any)[key]=text(c[key],max);
   if(!campaign.title||campaign.featuredId&&!/^[\w-]{1,30}$/.test(campaign.featuredId))throw Error('运营活动文字或影片编号无效');
   if(c.bannerPage!==undefined){if(!['member','library','ranking','search'].includes(c.bannerPage))throw Error('运营活动目标无效');campaign.bannerPage=c.bannerPage;}
   if(c.groupIds!==undefined){if(!Array.isArray(c.groupIds)||c.groupIds.length>12)throw Error('运营活动片单无效');const groups=c.groupIds.map(id);if(new Set(groups).size!==groups.length)throw Error('运营活动片单无效');campaign.groupIds=groups;}
   out.campaign=campaign;
  }
  result[page]=out;
 }
 return result;
}
