import {ref,computed,onMounted,onUnmounted} from 'vue';
import {normalizeAppearance,appearanceScheme,appearanceStorageKey,type AppearancePreference} from '@/domain/appearance';
export function useAppearance(){
 let stored:unknown;try{stored=uni.getStorageSync(appearanceStorageKey);}catch{}
 const preference=ref(normalizeAppearance(stored)),systemDark=ref(false),saveError=ref('');
 let media:MediaQueryList|undefined;
 const onSystem=(event:{theme?:string})=>{systemDark.value=event.theme==='dark';};
 const onMedia=(event:MediaQueryListEvent)=>{systemDark.value=event.matches;};
 // #ifdef H5
 if(typeof window!=='undefined'&&typeof window.matchMedia==='function'){media=window.matchMedia('(prefers-color-scheme: dark)');systemDark.value=media.matches;}
 // #endif
 // #ifdef APP-PLUS
 try{systemDark.value=uni.getSystemInfoSync().theme==='dark';}catch{}
 // #endif
 onMounted(()=>{
  if(media?.addEventListener)media.addEventListener('change',onMedia);else media?.addListener(onMedia);
  // #ifdef APP-PLUS
  if(typeof uni.onThemeChange==='function')uni.onThemeChange(onSystem);
  // #endif
 });
 onUnmounted(()=>{
  if(media?.removeEventListener)media.removeEventListener('change',onMedia);else media?.removeListener(onMedia);
  // #ifdef APP-PLUS
  if(typeof uni.offThemeChange==='function')uni.offThemeChange(onSystem);
  // #endif
 });
 function updateAppearance(value:AppearancePreference){
  preference.value=normalizeAppearance(value);saveError.value='';
  try{uni.setStorageSync(appearanceStorageKey,preference.value);}catch{saveError.value='当前外观已生效，但未能保存到本机。';}
 }
 return {preference,systemDark,saveError,scheme:computed(()=>appearanceScheme(preference.value,systemDark.value)),updateAppearance};
}
