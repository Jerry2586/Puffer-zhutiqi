import {ref,computed,watch,onMounted,onUnmounted} from 'vue';
import type {Theme,Template,StudioState,Platform,AppPage,Section,Category,Vod} from '@/domain/types';
import {api,request,chooseLocalFile} from '@/services/api';
import {normalizeTheme} from '@/domain/normalize-theme';
import {mergePreview,type PreviewBootstrap} from './operations-preview';
import defaults from '@/domain/default-theme.json';
import {ensureSkeletonPage,skeletonBlocks} from '@/domain/skeleton';
import {pageNames,available} from '@/domain/presentation';
export const devices=[{id:'mobile',name:'手机',short:'PHONE',width:414,height:820},{id:'tablet',name:'平板',short:'TABLET',width:834,height:1112},{id:'tv',name:'电视',short:'TV',width:1280,height:720},{id:'web',name:'电脑',short:'WEB',width:1440,height:900}] as const;
export const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
type Cached={theme:Theme;version:number;signature:string;history:string[];cursor:number};
export function useWorkbench(){
 const view=ref<'library'|'editor'>('library'),device=ref<Platform>('mobile'),search=ref(''),theme=ref<Theme>(normalizeTheme(copy(defaults) as Theme));
 const templates=ref<Template[]>([]),currentId=ref(''),version=ref(0),signature=ref(''),busy=ref(false),loading=ref(true),error=ref(''),message=ref('');
 const previewState=ref({base:'',connected:false,version:0,updatedAt:''}),previewBusy=ref(false),previewEpoch=ref(0),published=ref<PreviewBootstrap|null>(null);let previewGeneration=0,previewTimer:ReturnType<typeof setInterval>|undefined;
 const previewTheme=computed(()=>published.value?.platform===device.value?mergePreview(theme.value,published.value,device.value):theme.value);
 const serviceReady=ref(false);
 const mode=ref<'dark'|'light'>(uni.getStorageSync('hetun-theme-workbench-mode')==='light'?'light':'dark');
 const categoryEntry=ref('');
 const page=ref<AppPage>('home'),tool=ref('brand'),selected=ref('brand'),interactive=ref(true);
 const items=ref<Vod[]>([]),categories=ref<Category[]>([]),sectionItems=ref<Record<string,Vod[]>>({}),contentError=ref('');
 const dialog=ref<'import'|'rename'|'remove'|'duplicate'|'guide'|''>(''),dialogName=ref(''),dialogTarget=ref<Template|null>(null);
 const startupPreview=ref(0),announcementPreview=ref(0),updatePreview=ref(0),fullPreview=ref(false);
 const cache=new Map<string,Cached>();const history=ref<string[]>([]),cursor=ref(0);let replay=false,historyTimer:ReturnType<typeof setTimeout>|undefined;
 const current=computed(()=>templates.value.find(t=>t.id===currentId.value));
 const locked=computed(()=>!serviceReady.value||!current.value||current.value.platform!==device.value);
 const dirty=computed(()=>!!current.value&&JSON.stringify(theme.value)!==signature.value);
 const filtered=computed(()=>templates.value.filter(t=>t.platform===device.value&&t.name.toLowerCase().includes(search.value.toLowerCase())));
 const pageList=computed(()=>Object.entries(pageNames).map(([id,name])=>({id:id as AppPage,name,enabled:available(theme.value,id)})));
 const pageSections=computed(()=>theme.value.sections.filter(s=>(s.page||'home')===page.value&&(!s.categoryEntry||s.categoryEntry===categoryEntry.value)));
 const selectedSection=computed(()=>pageSections.value.find(s=>s.id===selected.value));
 const canUndo=computed(()=>cursor.value>0),canRedo=computed(()=>cursor.value<history.value.length-1);
 const activeDevice=computed(()=>devices.find(d=>d.id===device.value)!);
 const bridge=()=> (window as any).hetunTheme;
 function notify(text:string){message.value=text;error.value='';}
 function fail(e:unknown){error.value=(e as Error).message;message.value='';}
 function toggleMode(){mode.value=mode.value==='dark'?'light':'dark';uni.setStorageSync('hetun-theme-workbench-mode',mode.value);bridge()?.setAppearance?.(mode.value).catch(fail);}
 function commitHistory(){if(historyTimer){clearTimeout(historyTimer);historyTimer=undefined;}if(replay||!currentId.value)return;const next=JSON.stringify(theme.value);if(history.value[cursor.value]===next)return;history.value=history.value.slice(0,cursor.value+1);history.value.push(next);if(history.value.length>60)history.value.shift();cursor.value=history.value.length-1;}
 function retain(){commitHistory();if(currentId.value)cache.set(currentId.value,{theme:copy(theme.value),version:version.value,signature:signature.value,history:[...history.value],cursor:cursor.value});}
 function hydrate(s:StudioState,useCache=true){templates.value=s.templates;currentId.value=s.selectedTemplate;const c=useCache?cache.get(s.selectedTemplate):undefined;replay=true;theme.value=normalizeTheme(copy(c?.theme||s.draft));version.value=c?.version??s.version;signature.value=c?.signature??JSON.stringify(theme.value);history.value=c?.history||[JSON.stringify(theme.value)];cursor.value=c?.cursor??0;replay=false;}
 function undo(){if(locked.value||busy.value)return;commitHistory();if(cursor.value<1)return;replay=true;theme.value=JSON.parse(history.value[--cursor.value]);replay=false;}
 function redo(){if(busy.value)return;if(locked.value||!canRedo.value)return;replay=true;theme.value=JSON.parse(history.value[++cursor.value]);replay=false;}
 watch(theme,()=>{if(replay||locked.value)return;if(historyTimer)clearTimeout(historyTimer);historyTimer=setTimeout(commitHistory,220);},{deep:true,flush:'sync'});
 async function loadWorkspace(){loading.value=true;error.value='';try{const s=await api.state(currentId.value);hydrate(s);serviceReady.value=true;device.value=current.value?.platform||'mobile';await refreshContent();}catch(e){serviceReady.value=false;fail(e);}finally{loading.value=false;}}
 async function openTemplate(t:Template){if(busy.value||!serviceReady.value)return;retain();busy.value=true;error.value='';try{hydrate(await api.state(t.id));device.value=t.platform;view.value='editor';page.value='home';tool.value='brand';selected.value='brand';interactive.value=true;await refreshContent();}catch(e){fail(e);}finally{busy.value=false;}}
 function library(){if(busy.value)return;retain();view.value='library';fullPreview.value=false;}
 function chooseDevice(p:Platform){if(busy.value)return;retain();device.value=p;search.value='';view.value='library';}
 async function saveInternal(){commitHistory();const snapshot=copy(theme.value),id=currentId.value;const s=await api.save(snapshot,version.value,id);templates.value=s.templates;version.value=s.version;if(JSON.stringify(theme.value)===JSON.stringify(snapshot)){replay=true;theme.value=normalizeTheme(copy(s.draft));replay=false;history.value[cursor.value]=JSON.stringify(theme.value);}signature.value=JSON.stringify(normalizeTheme(copy(s.draft)));cache.delete(id);retain();}
 async function save(){if(busy.value||locked.value)return;busy.value=true;error.value='';try{await saveInternal();notify('主题草稿已保存。');}catch(e){fail(e);}finally{busy.value=false;}}
 async function downloadAuthoringKit(){
  if(busy.value)return;
  busy.value=true;error.value='';
  try{
   const desktop=bridge();
   if(desktop?.downloadAuthoringKit){
    const result=await desktop.downloadAuthoringKit();
    if(result?.saved)notify('制作底座已下载。请解压后，将 theme/cinema-standard.zip 导入主题中心。');
   }else{
    const response=await fetch('/api/admin/authoring-kit',{method:'POST',credentials:'same-origin'});
    if(!response.ok){const problem=await response.json().catch(()=>null);throw Error(problem?.error||'制作底座下载失败，请重试。');}
    const url=URL.createObjectURL(await response.blob());
    try{const a=document.createElement('a');a.href=url;a.download='hetun-authoring-kit-v1.zip';a.click();}
    finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
    notify('制作底座已下载。请解压后，将 theme/cinema-standard.zip 导入主题中心。');
   }
  }catch(e){fail(e);}finally{busy.value=false;}
 }
 async function exportPackage(){if(busy.value||locked.value)return;busy.value=true;error.value='';try{if(dirty.value)await saveInternal();const bundle=await api.exportTheme(currentId.value);if(bridge()){const r=await bridge().saveExport(bundle);if(r?.saved)notify('主题包已导出，请在打包器中手动导入。');}else{const bytes=Uint8Array.from(atob(bundle.data),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download=bundle.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('主题包已下载，请在打包器中手动导入。');}}catch(e){fail(e);}finally{busy.value=false;}}
 function manage(t:Template,type:'rename'|'remove'|'duplicate'){if(busy.value)return;retain();dialogTarget.value=t;dialogName.value=type==='duplicate'?t.name+' 副本':t.name;dialog.value=type;error.value='';}
 function importDialog(){if(busy.value)return;dialogName.value='';dialog.value='import';error.value='';}
 async function commitDialog(){if(busy.value||!serviceReady.value)return;const name=dialogName.value.trim();if(dialog.value!=='remove'&&!name){error.value='请填写主题名称。';return;}busy.value=true;error.value='';try{let s:StudioState;const t=dialogTarget.value;
 if(dialog.value==='import'){const f=await chooseLocalFile('.zip,.json');retain();s=await api.install(name,f.data);}else if(dialog.value==='rename'&&t){s=await api.renameTemplate(t.id,name,t.version);const c=cache.get(t.id);if(c)c.version=s.version;}else if(dialog.value==='remove'&&t){s=await api.removeTemplate(t.id,t.version,false);cache.delete(t.id);}else if(dialog.value==='duplicate'&&t){const state=await api.state(t.id);const source=cache.get(t.id)?.theme||state.draft;const id='theme-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);const p={format:'hetun-skeleton',version:2,renderer:'hetun-v2',id,name,platform:t.platform,theme:source};const bytes=new TextEncoder().encode(JSON.stringify(p));let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));s=await api.install(name,btoa(raw));}else return;
 hydrate(s);device.value=current.value?.platform||device.value;dialog.value='';notify('主题库已更新。');}catch(e){fail(e);}finally{busy.value=false;}}
 function selectElement(id:string){selected.value=id;tool.value=id==='brand'?'brand':id==='hero'?'carousel':(['home-highlights','home-recommendations','home-content'].includes(id)?'module':(id==='navigation'||id==='categories')?'navigation':'module');}
 function selectPage(p:AppPage){page.value=p;selected.value=theme.value.sections.find(s=>(s.page||'home')===p)?.id||'hero';tool.value=selected.value==='hero'?'carousel':'module';}
 function addModule(){if(busy.value)return;if(locked.value||theme.value.sections.length>=40||!['home','category','shortdrama'].includes(page.value))return;const existing=skeletonBlocks(theme.value,page.value);if(existing.length>=32&&!existing.some(b=>b.component==='content'&&!b.sectionId)){notify('骨架区域已达32个，请先调整现有布局。');return;}const id='module-'+Date.now().toString(36);const layout=ensureSkeletonPage(theme.value,page.value);if(layout&&!layout.blocks.some(b=>b.component==='content'&&!b.sectionId)&&layout.blocks.length<32)layout.blocks.push({id,component:'content',sectionId:id});theme.value.sections.push({id,...(page.value==='category'&&categoryEntry.value?{categoryEntry:categoryEntry.value}:{}),title:'新内容模块',subtitle:'',page:page.value,kind:'poster',source:'latest',categoryId:'',limit:6,columns:3,enabled:true,style:'grid3',orderBy:'latest',radius:8,gap:10,ratio:'2/3',showScore:true,showTitle:true,showNote:true,showMore:true});selectElement(id);}
 function moveModule(s:Section,d:number){if(busy.value)return;if(locked.value)return;const same=pageSections.value,i=same.findIndex(x=>x.id===s.id),other=same[i+d];if(!other)return;const a=theme.value.sections.indexOf(s),b=theme.value.sections.indexOf(other);[theme.value.sections[a],theme.value.sections[b]]=[theme.value.sections[b],theme.value.sections[a]];}
 function removeModule(){if(busy.value)return;if(locked.value||!selectedSection.value)return;theme.value.sections=theme.value.sections.filter(s=>s.id!==selected.value);for(const layout of Object.values(theme.value.skeleton.definition?.pages||{}))if(layout){const remaining=layout.blocks.filter(b=>b.sectionId!==selected.value);layout.blocks=remaining.length?remaining:[{id:'content',component:'content'}];}selected.value=pageSections.value[0]?.id||'';tool.value=selected.value?'module':'visual';}
 function addSlide(){if(busy.value)return;if(locked.value||theme.value.carousel.slides.length>=20)return;theme.value.carousel.slides.push({id:'slide-'+Date.now().toString(36),vodId:'',title:'新轮播',image:'',video:'',page:'home'});}
 async function upload(target:Record<string,any>,key:string,video=false){if(busy.value||locked.value)return;busy.value=true;error.value='';try{const f=await chooseLocalFile(video?'.mp4':'.png,.jpg,.jpeg,.webp,.svg');target[key]=(await api.asset(f.name,f.data)).url;notify('素材已添加到当前主题。');}catch(e){fail(e);}finally{busy.value=false;}}
 function clearPreview(){published.value=null;items.value=[];categories.value=[];sectionItems.value={};previewState.value={...previewState.value,version:0,updatedAt:''};previewEpoch.value++;}
 watch(device,()=>{previewGeneration++;previewBusy.value=false;clearPreview();},{flush:'sync'});
 async function connectOperations(base:string){if(previewBusy.value)return;previewGeneration++;clearPreview();contentError.value='';previewBusy.value=true;try{previewState.value=await request<any>('/api/preview/session','PUT',{base});}catch(e){previewState.value={base:'',connected:false,version:0,updatedAt:''};contentError.value=(e as Error).message;previewBusy.value=false;return;}previewBusy.value=false;await refreshContent();}
 async function disconnectOperations(){previewGeneration++;previewBusy.value=false;clearPreview();contentError.value='';previewState.value={base:'',connected:false,version:0,updatedAt:''};try{await request<any>('/api/preview/session','PUT',{base:''});}catch(e){contentError.value=(e as Error).message;}}
 async function refreshContent(){const generation=++previewGeneration;contentError.value='';previewBusy.value=true;try{const session=await request<any>('/api/preview/session');if(generation!==previewGeneration)return;previewState.value={...previewState.value,...session};if(!session.connected){clearPreview();return;}const boot=await request<PreviewBootstrap>('/api/preview/bootstrap?contract=hetun-operations-v1&platform='+device.value);if(generation!==previewGeneration)return;const merged=mergePreview(theme.value,boot,device.value);const [catalog,list]=await Promise.all([api.catalog(),api.categories()]);if(generation!==previewGeneration)return;const groups:Record<string,Vod[]>={},sections=merged.sections.filter(s=>s.enabled&&((s.source==='category'&&s.categoryId)||(s.orderBy==='manual'&&s.manualIds)||s.orderBy==='hot')).slice(0,40);let next=0;await Promise.all(Array.from({length:Math.min(4,sections.length)},async()=>{while(next<sections.length){if(generation!==previewGeneration)return;const s=sections[next++];groups[s.id]=(await api.catalog(1,'',s.source==='category'?s.categoryId:'',s.orderBy==='manual'?s.manualIds||'':'',s.orderBy)).items;}}));if(generation!==previewGeneration)return;published.value=boot;items.value=catalog.items;categories.value=list.items;sectionItems.value=groups;previewState.value={...previewState.value,version:boot.version,updatedAt:new Date().toLocaleTimeString()};}catch(e){if(generation===previewGeneration){clearPreview();contentError.value=(e as Error).message;}}finally{if(generation===previewGeneration)previewBusy.value=false;}}

 function beforeLeave(e:BeforeUnloadEvent){retain();if([...cache.values()].some(c=>JSON.stringify(c.theme)!==c.signature)){e.preventDefault();e.returnValue='';}}
 function keydown(e:KeyboardEvent){if(!(e.ctrlKey||e.metaKey)||view.value!=='editor'||dialog.value)return;if(e.key.toLowerCase()==='s'){e.preventDefault();save();}else if(e.key.toLowerCase()==='z'&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)){e.preventDefault();e.shiftKey?redo():undo();}}
 onMounted(()=>{bridge()?.getAppearance?.().then((value:'dark'|'light')=>{if(value==='dark'||value==='light'){mode.value=value;uni.setStorageSync('hetun-theme-workbench-mode',value);}}).catch(fail);uni.setNavigationBarTitle({title:'河豚主题中心'});loadWorkspace();previewTimer=setInterval(()=>{if(view.value==='editor'&&previewState.value.connected&&!previewBusy.value)refreshContent();},15000);window.addEventListener('beforeunload',beforeLeave);window.addEventListener('keydown',keydown);});
 onUnmounted(()=>{previewGeneration++;if(previewTimer)clearInterval(previewTimer);if(historyTimer)clearTimeout(historyTimer);window.removeEventListener('beforeunload',beforeLeave);window.removeEventListener('keydown',keydown);});
 return {previewEpoch,previewState,previewBusy,previewTheme,connectOperations,disconnectOperations,view,device,search,theme,templates,currentId,current,version,busy,loading,error,message,serviceReady,mode,page,categoryEntry,tool,selected,interactive,items,categories,sectionItems,contentError,dialog,dialogName,dialogTarget,startupPreview,announcementPreview,updatePreview,fullPreview,locked,dirty,filtered,pageList,pageSections,selectedSection,activeDevice,canUndo,canRedo,notify,toggleMode,undo,redo,loadWorkspace,openTemplate,library,chooseDevice,save,exportPackage,downloadAuthoringKit,manage,importDialog,commitDialog,selectElement,selectPage,addModule,moveModule,removeModule,addSlide,upload,refreshContent};
}
