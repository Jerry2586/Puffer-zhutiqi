import schema from './visual-schema.json';
import type {Theme} from './types';
export type AppearanceMode='system'|'light'|'dark';
export const appearanceAccents=[
 {id:'indigo',label:'鸢尾紫',light:'#5555cf',dark:'#9999ff'},
 {id:'blue',label:'澄净蓝',light:'#2563d9',dark:'#80adff'},
 {id:'emerald',label:'松石绿',light:'#087c69',dark:'#6cd6ba'},
 {id:'rose',label:'玫瑰红',light:'#b53c67',dark:'#f299b8'},
 {id:'slate',label:'石墨灰',light:'#526176',dark:'#b5c2d6'}
] as const;
export type AppearanceAccent=typeof appearanceAccents[number]['id'];
export interface AppearancePreference{mode:AppearanceMode;accent:AppearanceAccent}
export const appearanceStorageKey='hetun-app-appearance-v1';
export function normalizeAppearance(input:unknown):AppearancePreference{
 let value=input;if(typeof value==='string'){try{value=JSON.parse(value);}catch{value=null;}}
 const record=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return {mode:record.mode==='light'||record.mode==='dark'?record.mode:'system',accent:appearanceAccents.some(a=>a.id===record.accent)?record.accent as AppearanceAccent:'indigo'};
}
export function appearanceScheme(preference:AppearancePreference,systemDark:boolean):'light'|'dark'{return preference.mode==='system'?(systemDark?'dark':'light'):preference.mode;}
/** Runtime colors only: keep the imported skeleton, layout, routes and media configuration intact. */
export function appearanceTheme(theme:Theme,preference:AppearancePreference,systemDark:boolean):Theme{
 const dark=appearanceScheme(preference,systemDark)==='dark';
 const accent=appearanceAccents.find(a=>a.id===preference.accent)||appearanceAccents[0];
 const colors={...theme.colors,...(dark?{background:'#111318',surface:'#1b1e25',text:'#f0f1f5',muted:'#a0a7b5'}:{background:'#f7f8fa',surface:'#ffffff',text:'#202531',muted:'#727b8d'}),accent:dark?accent.dark:accent.light};
 const visual={...theme.visual};
 for(const [group,definition] of Object.entries(schema)){
  const fields={...visual[group]};
  for(const [key,field] of Object.entries(definition.fields)){
   const token=(field as {token?:keyof Theme['colors']}).token;
   if(token)fields[key]=colors[token];
  }
  visual[group]=fields;
 }
 visual.directory={...visual.directory,background:colors.background};
 visual.input={...visual.input,background:dark?'#242831':'#eef0f4'};
 return {...theme,colors,visual};
}
