import schema from './skeleton-schema.json';
import type {Theme} from './types';
import {categoryEntryFromPage} from './category';
export type SkeletonPage=keyof typeof schema.pages;
export type SkeletonComponent=keyof typeof schema.labels;
export interface SkeletonBlock {id:string;component:SkeletonComponent;visible?:boolean;gap?:number;sectionId?:string}
export interface SkeletonDefinition {version:1;id:string;name:string;pages:Partial<Record<string,{blocks:SkeletonBlock[]}>>}
export const skeletonLabels=schema.labels;
export function skeletonPage(page:string):SkeletonPage {return (categoryEntryFromPage(page)?'category':page) as SkeletonPage;}
export function skeletonBlocks(theme:Theme,page:string):SkeletonBlock[]{
 const key=skeletonPage(page),defined=theme.skeleton?.definition?.pages[page]??theme.skeleton?.definition?.pages[key];
 if(defined){
  const blocks=[...defined.blocks];
  // Older imported category skeletons put this row before the carousel.
  const filters=blocks.findIndex(b=>b.component==='filters'),carousel=blocks.findIndex(b=>b.component==='carousel');
  if(key==='category'&&filters>=0&&carousel>filters){const [row]=blocks.splice(filters,1);blocks.splice(carousel,0,row);}
  return blocks;
 }
 const defaults:Partial<Record<SkeletonPage,SkeletonComponent[]>>={home:['header','channels','notice','carousel','content','ads'],category:['header','channels','notice','carousel','filters','content','ads'],shortdrama:['header','channels','filters','notice','carousel','content','ads'],mine:['profileHeader','profile','shortcuts','history','ads','services'],player:['player','filmInfo','ads','episodes','recommendations'],detail:['player','filmInfo','ads','episodes','recommendations']};
 return (defaults[key]||[]).map(component=>({id:component,component}));
}
export function skeletonBlockForSelection(theme:Theme,page:string,id:string):SkeletonBlock|undefined {
 const blocks=skeletonBlocks(theme,page);
 const direct=blocks.find(b=>b.id===id||b.sectionId===id);if(direct)return direct;
 const key=skeletonPage(page);
 const entry=categoryEntryFromPage(page);
 const section=theme.sections.some(s=>s.id===id&&(s.page||'home')===key&&(!s.categoryEntry||s.categoryEntry===entry));
 const fixed=key==='home'&&['home-highlights','home-recommendations','home-content'].includes(id)||key==='category'&&id==='category-content';
 return section||fixed?blocks.find(b=>b.component==='content'&&!b.sectionId):undefined;
}
export function ensureSkeletonPage(theme:Theme,page:string){
 const key=skeletonPage(page);if(!(key in schema.pages))return;
 const blocks=skeletonBlocks(theme,page).map(b=>({...b}));
 theme.skeleton.definition??={version:1,id:'custom-layout',name:'自定义骨架',pages:{}};
 return theme.skeleton.definition.pages[page]??=( {blocks} );
}
