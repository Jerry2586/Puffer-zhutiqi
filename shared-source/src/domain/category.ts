import type {Theme} from './types';

/** Page identity is stable when the CMS binding or displayed label changes. */
export function categoryPageKey(id:string):string {
 return 'category'+Array.from(id,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
}
export function categoryEntryFromPage(page:string):string|undefined {
 if(!/^category(?:[0-9a-f]{2}){1,64}$/.test(page))return;
 const id=(page.slice(8).match(/../g)||[]).map(c=>String.fromCharCode(parseInt(c,16))).join('');
 return /^[\w-]{1,64}$/.test(id)?id:undefined;
}
export function categoryRoot(theme:Theme,entryId:string):string {
 return [...theme.categories,...theme.navigation].find(n=>n.enabled&&n.page==='category'&&n.id===entryId)?.categoryId||'';
}
