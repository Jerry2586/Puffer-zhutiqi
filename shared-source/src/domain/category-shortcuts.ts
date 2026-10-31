import type {Theme,PageDesign,AppLink} from './types';
import {available} from './presentation';

/** Missing configuration gets usable defaults; an explicit empty list stays empty. */
export function categoryShortcutDefaults(categoryId=''):AppLink[] {
 return [
  {id:'category-ranking',label:'排行榜',page:'ranking',icon:'ranking',categoryId,entryId:'',content:'',enabled:true},
  {id:'category-schedule',label:'排期表',page:'schedule',icon:'schedule',categoryId,entryId:'',content:'',enabled:true},
  {id:'category-search',label:'找影片',page:'search',icon:'search',categoryId,entryId:'',content:'',enabled:true}
 ];
}
export function categoryShortcuts(theme:Theme,layout:PageDesign,categoryId='',entryId=''):AppLink[] {
 return (layout.shortcuts??categoryShortcutDefaults(categoryId)).filter(link=>link.enabled&&available(theme,link.page)).map(link=>['ranking','schedule'].includes(link.page)?{...link,categoryId,entryId,content:''}:link);
}
