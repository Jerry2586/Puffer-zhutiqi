import type {Theme,CampaignDesign,NavItem,Section} from './types';
import {categoryPageKey} from './category';
export function createCampaign():CampaignDesign{return {title:'好戏 · 正当时',subtitle:'把值得看的故事，放在一起。',eyebrow:'SPECIAL COLLECTION',artwork:'',tone:'crimson',featuredId:'',bannerTitle:'好故事，不止一面',bannerText:'发现更多精彩内容与专属片单',bannerLabel:'去发现',bannerPage:'search',groupIds:[]};}
/** Read an existing entry without adding pages or changing the imported layout. */
export function campaignEntry(theme:Theme):string{return theme.categories.find(n=>n.enabled&&n.page==='category'&&theme.pageDesign?.[categoryPageKey(n.id)]?.campaign)?.id||'';}
/** Explicit authoring seed; opening an imported theme must never call this. */
export function prepareCampaign(theme:Theme):{theme:Theme;entryId:string}{
 const draft=JSON.parse(JSON.stringify(theme)) as Theme;
 const existing=draft.categories.find(n=>n.page==='category'&&draft.pageDesign?.[categoryPageKey(n.id)]?.campaign);
 if(existing)return {theme:draft,entryId:existing.id};
 if(draft.categories.length>=20||draft.sections.length>38)return {theme:draft,entryId:''};
 let id='campaign',suffix=1;while(draft.categories.some(n=>n.id===id))id='campaign-'+suffix++;
 const entry:NavItem={id,label:'活动',page:'category',categoryId:'',enabled:true,icon:'',activeIcon:''};
 draft.categories.splice(Math.min(1,draft.categories.length),0,entry);
 const design=createCampaign();
 for(const [index,title]of ['本期精选 · 值得一看','更多故事 · 继续探索'].entries()){
  let sid=id+'-group-'+(index+1);while(draft.sections.some(s=>s.id===sid))sid+='x';
  const section:Section={id:sid,title,subtitle:'',page:'category',categoryEntry:id,source:'latest',categoryId:'',orderBy:'manual',manualIds:'',kind:'landscape',limit:4,columns:2,enabled:true};
  draft.sections.push(section);design.groupIds.push(sid);
 }
 draft.pageDesign={...draft.pageDesign,[categoryPageKey(id)]:{...draft.pageDesign?.[categoryPageKey(id)],carousel:false,campaign:design}};
 return {theme:draft,entryId:id};
}
