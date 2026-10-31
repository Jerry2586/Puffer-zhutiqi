import type {Category,Theme,Vod} from './types';

/** Include real CMS descendants and the manually bound children of a primary directory. */
export function categoryScopeIds(root:string,categories:Category[],manualIds:string[]=[]):Set<string> {
 const ids=new Set<string>();if(!root)return ids;
 for(const id of [root,...manualIds])if(id)ids.add(id);
 let changed=true;
 while(changed){changed=false;for(const c of categories)if(c.parentId&&ids.has(c.parentId)&&!ids.has(c.id)){ids.add(c.id);changed=true;}}
 return ids;
}
export function categorySchedule(rows:Theme['schedule'],items:Vod[],entryId:string,ids:Set<string>,includeEntryRows=true):Theme['schedule'] {
 if(!ids.size)return [];
 const byId=new Map(items.map(v=>[v.id,v.categoryId]));
 return rows.filter(row=>{
  if(row.categoryEntry&&row.categoryEntry!==entryId)return false;
  const category=row.categoryId||byId.get(row.vodId);
  return category?ids.has(category):!!row.categoryEntry&&includeEntryRows;
 }).slice().sort((a,b)=>a.date.localeCompare(b.date));
}
/** Keep detail lookups within the catalog endpoint's 80-character ID limit. */
export function scheduleIdBatches(rows:Theme['schedule']):string[] {
 const batches:string[]=[];
 for(const id of new Set(rows.filter(r=>!r.categoryId).map(r=>r.vodId).filter(Boolean))){
  if(id.length>80)continue;
  const last=batches.length-1;if(last>=0&&batches[last].length+id.length+1<=80)batches[last]+=','+id;else batches.push(id);
 }
 return batches;
}
