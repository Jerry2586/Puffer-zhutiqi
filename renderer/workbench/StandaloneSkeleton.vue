<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref} from 'vue';
import AppExperience from '@/components/AppExperience.vue';
import SkeletonPageSettings from './SkeletonPageSettings.vue';
import SkeletonConnection from './SkeletonConnection.vue';
import {campaignEntry} from '@/domain/campaign';
import {categoryPageKey} from '@/domain/category';
import type {Theme,Vod,Category,AppPage} from '@/domain/types';
import {normalizeTheme} from '@/domain/normalize-theme';
import {api,request} from '@/services/api';
import {mergePreview,type PreviewBootstrap} from './operations-preview';

const theme=ref<Theme|null>(null),published=ref<PreviewBootstrap|null>(null);
const items=ref<Vod[]>([]),categories=ref<Category[]>([]),sectionItems=ref<Record<string,Vod[]>>({});
const templateId=ref(''),error=ref(''),loading=ref(true),currentPage=ref<AppPage>('home');
const connectionOpen=ref(false),connectionBusy=ref(false),connected=ref(false),syncVersion=ref(0);
const configureOpen=ref(false),saving=ref(false),saveError=ref(''),version=ref(0),initialEntry=ref(''),revision=ref(0);
const previewTheme=computed(()=>{
 if(!theme.value)return null;
 if(published.value)return mergePreview(theme.value,published.value,'mobile');
 return {...theme.value,carousel:{...theme.value.carousel,slides:[]}};
});
let generation=0;
let active=true,refreshing=false,timer:ReturnType<typeof setInterval>|undefined;
function clearContent(){published.value=null;items.value=[];categories.value=[];sectionItems.value={};}
async function refreshContent(force=false){
 if(!active||!theme.value||(!force&&(refreshing||connectionBusy.value)))return;
 refreshing=true;const current=++generation;
 try{
  const session=await request<{connected:boolean}>('/api/preview/session');
  if(!active||current!==generation)return;
  connected.value=session.connected;
  if(!session.connected){clearContent();error.value='';return;}
  const boot=await request<PreviewBootstrap>('/api/preview/bootstrap?contract=hetun-operations-v1&platform=mobile');
  if(!active||current!==generation)return;
  const merged=mergePreview(theme.value,boot,'mobile');
  const [catalog,list]=await Promise.all([api.catalog(),api.categories()]);
  if(!active||current!==generation)return;
  const groups:Record<string,Vod[]>={};
  const sections=merged.sections.filter(s=>s.enabled&&((s.source==='category'&&s.categoryId)||(s.orderBy==='manual'&&s.manualIds)||s.orderBy==='hot')).slice(0,40);
  let next=0;
  await Promise.all(Array.from({length:Math.min(4,sections.length)},async()=>{
   while(active&&current===generation&&next<sections.length){const s=sections[next++];groups[s.id]=(await api.catalog(1,'',s.source==='category'?s.categoryId:'',s.orderBy==='manual'?s.manualIds||'':'',s.orderBy)).items;}
  }));
  if(!active||current!==generation)return;
  syncVersion.value=boot.version;published.value=boot;items.value=catalog.items;categories.value=list.items;sectionItems.value=groups;error.value='';
 }catch(e){if(active&&current===generation){clearContent();error.value=(e as Error).message;}}
 finally{if(current===generation)refreshing=false;}
}
async function changeConnection(base:string){
 if(connectionBusy.value)return;
 connectionBusy.value=true;generation++;refreshing=false;clearContent();connected.value=false;syncVersion.value=0;error.value='';
 try{const session=await request<{connected:boolean}>('/api/preview/session','PUT',{base});if(!active)return;connected.value=session.connected;await refreshContent(true);}catch(e){if(active)error.value=(e as Error).message;}finally{connectionBusy.value=false;}
}
async function load(){
 loading.value=true;error.value='';
 try{
  const query=(window.location.hash.split('?')[1]||'');
  const params=new URLSearchParams(query);
  const requested=params.get('template')||'';
  const state=await api.state(requested);
  if(!active)return;
  const selected=state.templates.find(t=>t.id===state.selectedTemplate);
  if(!selected||selected.platform!=='mobile')throw Error('请先导入需要设计的手机骨架。');
  const draft=normalizeTheme(state.draft);
  theme.value=draft;templateId.value=selected.id;version.value=state.version;
  const requestedEntry=params.get('entry')||'';
  const entry=requestedEntry==='campaign'?campaignEntry(draft):requestedEntry;
  initialEntry.value=[...draft.categories,...draft.navigation].some(n=>n.id===entry&&n.enabled&&n.page==='category')?entry:'';
  currentPage.value=initialEntry.value?'category':'home';
  await refreshContent();
 }catch(e){if(active)error.value=(e as Error).message;}
 finally{if(active)loading.value=false;}
}
async function saveSettings(draft:Theme){
 if(saving.value)return;
 saving.value=true;saveError.value='';
 try{
  const state=await api.save(draft,version.value,templateId.value);
  if(!active)return;
  theme.value=normalizeTheme(state.draft);version.value=state.version;
  if(initialEntry.value&&![...theme.value.categories,...theme.value.navigation].some(n=>n.id===initialEntry.value&&n.enabled&&n.page==='category')){initialEntry.value='';currentPage.value='home';}revision.value++;configureOpen.value=false;
  await refreshContent(true);
 }catch(e){saveError.value=(e as Error).message;}
 finally{saving.value=false;}
}
onMounted(()=>{uni.setNavigationBarTitle({title:'骨架设计预览'});load();timer=setInterval(()=>refreshContent(),15000);});
onUnmounted(()=>{active=false;generation++;if(timer)clearInterval(timer);});
</script>

<template>
 <view class="skeleton-stage">
  <view v-if="theme" class="skeleton-phone">
   <AppExperience :key="templateId+revision" :page="currentPage" :category-entry="initialEntry" :theme="previewTheme!" :items="items" :categories="categories" :section-items="sectionItems" :error="error" platform="mobile" :studio="true" :template-key="templateId" @category="initialEntry=$event" @page="currentPage=$event;($event!=='category')&&(initialEntry='')" @connect="connectionOpen=true" @retry="refreshContent" @configure="saveError='';configureOpen=true"/>
   <SkeletonConnection v-if="connectionOpen" :busy="connectionBusy" :connected="connected" :version="syncVersion" :error="error" @close="connectionOpen=false" @change="changeConnection"/>
   <SkeletonPageSettings v-if="configureOpen" :theme="theme" :busy="saving" :error="saveError" @close="configureOpen=false" @save="saveSettings"/>
  </view>
  <view v-else class="skeleton-status" role="status">
   <text>{{loading?'正在打开骨架…':error}}</text>
   <button v-if="!loading" @click="load">重新打开</button>
  </view>
 </view>
</template>

<style scoped>
.skeleton-stage{width:100%;height:100vh;height:100dvh;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#eceef2;padding:24px;box-sizing:border-box}
.skeleton-phone{position:relative;width:414px;height:min(820px,calc(100vh - 48px));height:min(820px,calc(100dvh - 48px));max-width:100%;overflow:hidden;border:1px solid #20253112;border-radius:24px;background:#f7f8fa;box-shadow:0 16px 48px #2025310d,0 2px 6px #20253105;box-sizing:border-box}
.skeleton-status{display:flex;flex-direction:column;align-items:center;gap:16px;color:#596579;font-size:14px}.skeleton-status button{background:#fff;color:#334155;border:1px solid #d7dde7;border-radius:10px;padding:8px 20px}
@media(max-width:480px){.skeleton-stage{padding:0;background:#f6f7fb}.skeleton-phone{width:100%;height:100vh;height:100dvh;border:0;border-radius:0;box-shadow:none}}
</style>
