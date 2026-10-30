<script setup lang="ts">
const appVersion=import.meta.env.VITE_HETUN_APP_VERSION||'开发版';
import SkeletonPage from './SkeletonPage.vue';
import {skeletonBlocks,skeletonLabels,ensureSkeletonPage,skeletonBlockForSelection} from '@/domain/skeleton';
import OperationsPreview from './OperationsPreview.vue';
import WorkbenchNavIcon from './WorkbenchNavIcon.vue';
import {reactive,ref,computed,onMounted,onUnmounted,watch,nextTick} from 'vue';
import type {Template,Platform} from '@/domain/types';
import {assetUrl} from '@/services/api';
import {pageNames} from '@/domain/presentation';
import AppExperience from '@/components/AppExperience.vue';
import PufferMark from '@/components/PufferMark.vue';
import ThemeStudioMark from './ThemeStudioMark.vue';
import AppearanceToggle from './AppearanceToggle.vue';
import Inspector from './ThemeInspector.vue';
import {useWorkbench,devices} from './useWorkbench';
import './workbench.css';
import './ui-design.css';
import {visualSchema,visualGroupsForPage,categoryPages,categoryPageKey} from '@/domain/visual';
import OfflineSettings from './OfflineSettings.vue';
import ClientIntegration from './ClientIntegration.vue';
const productPage=ref('');
const settingsPage=ref<'local'|'operations'|'packaging'>('local');
function resumeEditor(){productPage.value='';if(w.view!=='editor'&&w.current)w.openTemplate(w.current);}
const skeletonOpen=ref(false),skeletonCollapsed=ref(false);
const designPage=ref(''),designState=ref('normal'),visualGroup=ref('');
const skeletonPages=[{id:'player',name:'播放器'},{id:'together',name:'一起看房间'},{id:'detail',name:'影片详情'},{id:'login',name:'登录 / 注册'},{id:'downloads',name:'下载管理'},{id:'feedback',name:'意见反馈'},{id:'orders',name:'订单记录'},{id:'recharge',name:'充值续费'},{id:'dialog',name:'通用弹窗'},{id:'empty',name:'空态与加载'}];
function openDesign(id:string){skeletonOpen.value=true;pageTab.value='page';designPage.value=id;designState.value='normal';w.selected='';visualGroup.value=id==='player'?'player':id==='login'||id==='feedback'?'input':id==='dialog'?'dialog':id==='empty'?'empty':'cards';w.tool='visual';}
function selectVisual(group:string){
 if(['navigation','directory','brand','ads','home-ad'].includes(group))return;
 skeletonOpen.value=true;
 pageTab.value='page';
 const component=group==='carousel'?'hero':group==='cards'&&!designPage.value?(w.page==='category'?'category-content':w.page==='home'?'home-content':'cards'):group;
 if(pageComponents.value.some(item=>item.id===component)){selectComponent(component);return;}
 visualGroup.value=component;
 w.selected='';w.tool='visual';
 if(!expandedRegions.value.includes(component))expandedRegions.value.push(component);
}

const w=reactive(useWorkbench());
const selectedCategory=computed({get:()=>w.categoryEntry,set:(id:string)=>{w.categoryEntry=id;}});
const configuredCategories=computed(()=>categoryPages(w.previewTheme));
watch(()=>configuredCategories.value.map(n=>n.id),ids=>{if(!ids.includes(selectedCategory.value))selectedCategory.value=ids[0]||'';},{immediate:true});
const appearancePage=computed(()=>designPage.value||(w.page==='category'&&selectedCategory.value?categoryPageKey(selectedCategory.value):w.page));
function chooseCategory(id:string){if(!configuredCategories.value.some(n=>n.id===id))return;selectedCategory.value=id;choosePage('category');}
const previewTheme=computed(()=>w.previewTheme);
const layoutPage=computed(()=>designPage.value||w.page);
const pageComponents=computed(()=>skeletonBlocks(w.theme,layoutPage.value).map(b=>({...b,title:skeletonLabels[b.component]})));
function changeBlock(id:string,key:'visible'|'gap',value:boolean|number){const b=ensureSkeletonPage(w.theme,layoutPage.value)?.blocks.find(b=>b.id===id);if(b)(b as any)[key]=value;}
function blockTool(component:string){return component==='carousel'?'carousel':['channels','filters'].includes(component)?'navigation':'visual';}
function blockGroup(component:string){return ({header:'appbar',player:'player',notice:'cards',ads:'cards',profile:'cards',profileHeader:'appbar',shortcuts:'cards',history:'cards',services:'cards',filmInfo:'cards',episodes:'player',recommendations:'cards'} as Record<string,string>)[component]||'cards';}
const expandedRegions=ref<string[]>(['hero']);
function toggleRegion(id:string){expandedRegions.value=expandedRegions.value.includes(id)?expandedRegions.value.filter(key=>key!==id):[...expandedRegions.value,id];}
function selectComponent(id:string){pageTab.value='page';visualGroup.value='';const block=skeletonBlockForSelection(w.theme,layoutPage.value,id);const regionId=block?.id||id;if(!expandedRegions.value.includes(regionId))expandedRegions.value.push(regionId);w.selectElement(block?.sectionId||id);}
function removeComponent(id:string){w.selected=id;w.removeModule();}
watch(appearancePage,()=>{expandedRegions.value=[pageComponents.value[0]?.id||'appbar'];});
watch(()=>w.selected,id=>{if(id&&skeletonOpen.value&&!expandedRegions.value.includes(id))expandedRegions.value.push(id);});
function movePageComponent(index:number,delta:number){if(w.locked)return;const blocks=ensureSkeletonPage(w.theme,layoutPage.value)?.blocks;const target=index+delta;if(!blocks||target<0||target>=blocks.length)return;[blocks[index],blocks[target]]=[blocks[target],blocks[index]];}
watch(()=>w.currentId,()=>{designPage.value='';});
const canvas=ref<any>(null),canvasWidth=ref(900),canvasHeight=ref(850),zoom=ref('fit');
let observer:ResizeObserver|undefined;
let canvasElement:HTMLElement|undefined;
const zoomPresets=[.25,.5,.75,1,1.25,1.5,2];
const customZoom=computed(()=>zoom.value!=='fit'&&!zoomPresets.includes(Number(zoom.value)));
function zoomCanvas(event:WheelEvent){
 if(!event.ctrlKey)return;
 event.preventDefault();event.stopPropagation();
 if(!event.deltaY)return;
 const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvasHeight.value:1);
 zoom.value=String(Math.round(Math.max(.15,Math.min(2,scale.value*Math.exp(-Math.max(-120,Math.min(120,delta))*.002)))*1000)/1000);
}
function releaseCanvas(){observer?.disconnect();canvasElement?.removeEventListener('wheel',zoomCanvas,true);canvasElement=undefined;}
const pageSearch=ref('');
const currentPageTitle=computed(()=>designPage.value?skeletonPages.find(p=>p.id===designPage.value)?.name:w.page==='category'?configuredCategories.value.find(n=>n.id===selectedCategory.value)?.label||'分类页':pageNames[w.page]);
const applicationPages=computed(()=>w.pageList.flatMap(p=>p.id==='category'?configuredCategories.value.map(n=>({id:p.id,name:n.label,enabled:true,key:categoryPageKey(n.id),category:n.id})):[{...p,key:p.id,category:''}]));
const visiblePages=computed(()=>applicationPages.value.filter(p=>p.name.includes(pageSearch.value.trim())));
const visibleDesignPages=computed(()=>skeletonPages.filter(p=>p.name.includes(pageSearch.value.trim())));
const pageTab=ref('page');
const activeDesignTab=computed(()=>skeletonOpen.value?pageTab.value:'theme');
const appearanceGroups=computed(()=>visualGroupsForPage(designPage.value||w.page).filter(id=>!['navigation','directory'].includes(id)&&(id!=='carousel'||['home','category'].includes(designPage.value||w.page))).map(id=>({id,name:(visualSchema as Record<string,{label:string}>)[id]?.label||id})));
const themeTools=[{id:'brand',name:'品牌与风格',hint:'品牌、Logo、页头和整体识别'},{id:'navigation',name:'导航与目录',hint:'导航视觉、图标和分类外观'},{id:'carousel',name:'轮播图',hint:'轮播布局、尺寸和切换动效'},{id:'festival',name:'装饰插件',hint:'节日装饰和可选视觉插件'}];
function choosePage(p:typeof w.page){skeletonOpen.value=true;pageTab.value='page';designPage.value='';w.selectPage(p);w.tool='visual';visualGroup.value='';}
function openSkeleton(){skeletonOpen.value=true;pageTab.value='page';designPage.value='';w.tool='visual';visualGroup.value='';}
function closeSkeleton(){skeletonOpen.value=false;designPage.value='';visualGroup.value='';w.tool='brand';}


const scale=computed(()=>{if(zoom.value!=='fit')return Number(zoom.value);const width=(canvasWidth.value-56)/w.activeDevice.width;const height=(canvasHeight.value-48)/w.activeDevice.height;return Math.max(.15,Math.min(1.1,Math.min(width,height)));});
const canvasStyle=computed(()=>({width:w.activeDevice.width+'px',height:w.activeDevice.height+'px',transform:'scale('+scale.value+')'}));
const holderStyle=computed(()=>({width:w.activeDevice.width*scale.value+'px',height:w.activeDevice.height*scale.value+'px'}));
const dialogTitles:Record<string,string>={import:'安装主题骨架',rename:'修改主题名称',duplicate:'复制为新主题',remove:'删除主题',guide:'制作与交付流程'};
function selectCanvasElement(id:string){if(skeletonBlockForSelection(w.theme,layoutPage.value,id)){skeletonOpen.value=true;selectComponent(id);return;}if(id.startsWith('visual-')){selectVisual(id.slice(7));return;}if(['brand','navigation','categories','ads','notice'].includes(id))return;skeletonOpen.value=true;pageTab.value='page';selectComponent(id);}
function inspect(id:string){skeletonOpen.value=false;designPage.value='';w.tool=id;w.selected=id==='carousel'?'hero':id;if(id==='carousel'||id==='navigation')w.page='home';}
function thumbnail(t:Template){return t.draft.carousel.slides.find(s=>s.image)?.image||'';}
function sizeCanvas(){releaseCanvas();const el=canvas.value?.$el||canvas.value;if(!el)return;canvasElement=el;el.addEventListener('wheel',zoomCanvas,{passive:false,capture:true});observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;canvasWidth.value=r.width;canvasHeight.value=r.height;});observer.observe(el);}
watch(()=>[w.view,w.fullPreview,productPage.value],async()=>{await nextTick();sizeCanvas();});
onMounted(()=>nextTick(sizeCanvas));onUnmounted(releaseCanvas);
</script>
<template>
<view class="workbench" :class="[w.mode,{fullscreen:w.fullPreview}]">
<view class="app-rail"><view class="rail-brand"><ThemeStudioMark :size="38"/></view><button class="rail-button" :class="{active:!productPage&&w.view==='library'}" title="骨架库" aria-label="骨架库" @click="productPage='';w.library()"><WorkbenchNavIcon name="library"/><span class="rail-label">骨架库</span></button><button class="rail-button" :disabled="!w.current||!w.serviceReady" :class="{active:!productPage&&w.view==='editor'}" title="UI设计" aria-label="UI设计" @click="resumeEditor()"><WorkbenchNavIcon name="editor"/><span class="rail-label">UI设计</span></button><view class="rail-spacer"/><button class="rail-button" :class="{active:productPage==='settings'}" title="设置" aria-label="设置" @click="productPage='settings'"><WorkbenchNavIcon name="settings"/><span class="rail-label">设置</span></button></view>
<view class="workbench-main">
<view class="product-host" :class="{'settings-layout':productPage==='settings'}">
<aside v-if="productPage==='settings'" class="settings-navigation" aria-label="设置导航">
<div class="settings-heading"><div><span class="eyebrow">PREFERENCES</span><h1>设置</h1></div><AppearanceToggle :mode="w.mode" @toggle="w.toggleMode()"/></div>
<p class="settings-intro">管理你的主题中心</p>
<nav class="settings-links"><button :class="{selected:settingsPage==='local'}" :aria-current="settingsPage==='local'?'page':undefined" @click="settingsPage='local'"><WorkbenchNavIcon name="settings"/><span><strong>本机与离线</strong><small>本地保存、素材与导出</small></span></button><button :class="{selected:settingsPage==='operations'}" :aria-current="settingsPage==='operations'?'page':undefined" @click="settingsPage='operations'"><WorkbenchNavIcon name="settings"/><span><strong>运营中心连接</strong><small>地址、连接与真实数据预览</small></span></button><button :class="{selected:settingsPage==='packaging'}" :aria-current="settingsPage==='packaging'?'page':undefined" @click="settingsPage='packaging'"><WorkbenchNavIcon name="editor"/><span><strong>打包接口</strong><small>主题导出与手动交付</small></span></button><button @click="w.dialog='guide'"><WorkbenchNavIcon name="help"/><span><strong>使用指南</strong><small>从安装主题到导出使用</small></span><b aria-hidden="true">↗</b></button></nav>
<div class="settings-footer"><ThemeStudioMark/><span>河豚主题中心<small>让每一份创作，都有自己的风格。</small></span></div>
</aside>
<template v-if="productPage==='settings'">
<OfflineSettings v-if="settingsPage==='local'"/>
<OperationsPreview v-else-if="settingsPage==='operations'" :state="w.previewState" :busy="w.previewBusy" :error="w.contentError" @connect="w.connectOperations" @refresh="w.refreshContent" @disconnect="w.disconnectOperations"/>
<ClientIntegration v-else :platform="w.device" :busy="w.busy" :can-export="!!w.current&&w.serviceReady" :error="w.error" @export="w.exportPackage()"/>
</template>
</view>
<view v-if="!productPage&&w.view==='library'" class="library-page">
<view class="library-header"><view><text class="eyebrow">HETUN THEME STUDIO</text><text class="library-title">河豚主题中心<text class="version-tag">{{appVersion}}</text></text><text class="library-subtitle">把你的品牌，做成一套完整的影视体验。</text></view><view class="header-actions"><AppearanceToggle :mode="w.mode" @toggle="w.toggleMode()"/><button class="primary" @click="w.importDialog()" :disabled="!w.serviceReady||w.busy">＋ 安装骨架包</button></view></view>
<view class="library-controls"><view class="platform-tabs"><button v-for="d in devices" :key="d.id" :class="{active:w.device===d.id}" @click="w.chooseDevice(d.id)"><text>{{d.name}}</text><text class="tab-count">{{w.templates.filter(t=>t.platform===d.id).length}}</text></button></view><view class="library-search"><text>⌕</text><input v-model="w.search" placeholder="搜索主题名称" maxlength="60"/><button v-if="w.search" aria-label="清除搜索" @click="w.search=''">×</button></view></view>
<view class="library-summary"><text>{{w.activeDevice.name}}主题<text class="summary-count">{{w.filtered.length}} 套</text></text><text>每套骨架拥有自己的页面结构与设计草稿</text></view>
<view v-if="w.loading" class="library-empty"><view class="empty-symbol">◌</view><text>正在读取骨架库…</text></view>
<view v-else-if="!w.serviceReady" class="library-empty"><view class="empty-symbol">↻</view><text class="empty-title">骨架库暂时无法读取</text><text>请重试读取，或重新启动主题中心。</text><button class="primary" @click="w.loadWorkspace()">重新读取</button></view>
<view v-else-if="!w.filtered.length" class="library-empty"><view class="empty-symbol">▦</view><text class="empty-title">{{w.search?'没有匹配的主题':'还没有安装'+w.activeDevice.name+'骨架'}}</text><text>{{w.search?'换一个名称搜索，或清除搜索条件。':'上传该端的主题包，识别安装后即可编辑。'}}</text><button v-if="!w.search" class="primary" @click="w.importDialog()">安装{{w.activeDevice.name}}主题包</button></view>
<view v-else class="theme-grid"><view v-for="t in w.filtered" :key="t.id" class="theme-card"><button class="theme-cover" :style="{'--cover-bg':t.draft.colors.background,'--cover-accent':t.draft.colors.accent}" :disabled="w.busy" @click="w.openTemplate(t)"><view class="cover-top"><text class="cover-dot"/><text>{{t.draft.brand.name}}</text><text class="cover-label">{{w.activeDevice.short}}</text></view><view class="cover-art"><image v-if="thumbnail(t)" :src="assetUrl(thumbnail(t))" mode="aspectFill"/><view v-else class="cover-original"><PufferMark :size="58"/><text>{{t.draft.brand.name}}</text><text class="cover-original-sub">{{t.draft.brand.tagline||'YOUR CINEMA. YOUR STYLE.'}}</text></view></view><view class="cover-lines"><view v-for="n in 3" :key="n"><view/><view/></view></view><view class="cover-open">打开编辑器 ↗</view></button><view class="theme-info"><view><text class="theme-name">{{t.name}}</text><text class="theme-meta">{{w.activeDevice.name}}骨架 · {{t.draft.sections.length}} 个内容模块</text></view><text class="draft-badge">主题草稿</text></view><view class="theme-actions"><button class="open-editor" :disabled="w.busy" @click="w.openTemplate(t)">设计骨架 →</button><button :disabled="w.busy" @click="w.manage(t,'rename')">改名</button><button :disabled="w.busy" @click="w.manage(t,'duplicate')">复制</button><button class="danger subtle" :disabled="w.busy" @click="w.manage(t,'remove')">删除</button></view></view><button class="theme-add" @click="w.importDialog()"><text class="add-symbol">＋</text><text>安装新骨架</text><text class="theme-meta">ZIP / JSON 主题包</text></button></view>
<view class="library-footer"><view><text class="status-dot" :class="{online:w.serviceReady}"/>{{w.serviceReady?'本机骨架库已就绪':'正在连接本机服务'}}</view><text>骨架设计 → 外观编辑 → 导出 ZIP → 手动导入打包器</text><button class="subtle" @click="w.dialog='guide'">了解交付流程 ↗</button></view>
</view>
<template v-else-if="!productPage">
<view class="editor-command"><view class="editor-identity"><button class="back-button" @click="w.library()">← 骨架库</button><view class="command-divider"/><view><text class="editor-name">{{w.current?.name}}</text><text class="editor-sub">{{w.activeDevice.name}}骨架 <text class="unsaved" v-if="w.dirty">· 未保存</text><text v-else>· 已保存</text></text></view></view><view class="editor-actions"><AppearanceToggle :mode="w.mode" @toggle="w.toggleMode()"/><button class="icon-button" :disabled="!w.canUndo||w.locked||w.busy" title="撤销 Ctrl+Z" aria-label="撤销" @click="w.undo()">↶</button><button class="icon-button" :disabled="!w.canRedo||w.locked||w.busy" title="重做 Ctrl+Shift+Z" aria-label="重做" @click="w.redo()">↷</button><view class="command-divider"/><button :disabled="w.locked||w.busy" @click="w.save()">保存草稿</button><button class="primary" :disabled="w.locked||w.busy" @click="w.exportPackage()">导出主题包 ↗</button></view></view>
<view class="editor-workspace ui-design" :class="{'skeleton-collapsed':skeletonCollapsed}">
<view class="structure-panel ui-pages" :class="{collapsed:skeletonCollapsed}">
 <button class="skeleton-collapse" :aria-label="skeletonCollapsed?'展开骨架页面':'收起骨架页面'" :title="skeletonCollapsed?'展开骨架页面':'收起骨架页面'" @click="skeletonCollapsed=!skeletonCollapsed"><text>{{skeletonCollapsed?'›':'‹'}}</text><text v-if="skeletonCollapsed" class="skeleton-collapse-label">骨架</text></button>
 <view class="ui-pages-heading"><text class="ui-kicker">SKELETON</text><text class="ui-pages-title">骨架页面</text><text class="ui-pages-caption">{{w.activeDevice.name}} · {{applicationPages.length+skeletonPages.length}} 个页面与状态</text></view>
 <input v-model="pageSearch" class="ui-page-search" placeholder="搜索骨架页面" aria-label="搜索骨架页面"/>
 <view class="structure-scroll">
  <view class="tree-heading">应用页面 <text>{{applicationPages.length}}</text></view>
  <button v-for="p in visiblePages" :key="p.key" class="page-node" :class="{active:skeletonOpen&&!designPage&&w.page===p.id&&(!p.category||selectedCategory===p.category)}" @click="p.category?chooseCategory(p.category):choosePage(p.id)"><text class="page-icon">▤</text><text>{{p.name}}</text><text class="node-muted">{{p.enabled?'':'未启用'}}</text></button>
  <view class="tree-heading">内页与组件状态 <text>{{skeletonPages.length}}</text></view>
  <button v-for="p in visibleDesignPages" :key="p.id" class="page-node" :class="{active:skeletonOpen&&designPage===p.id}" @click="openDesign(p.id)"><text class="page-icon">◇</text><text>{{p.name}}</text></button>
  <view v-if="!visiblePages.length&&!visibleDesignPages.length" class="tree-empty">没有匹配的页面</view>
 </view>
 <view class="structure-foot"><text class="status-dot"/><text>选择骨架页面进行设计</text></view>
</view>
<view class="inspector-panel ui-design-sheet" :class="{disabled:w.locked||w.busy}">
 <view class="ui-main-tools" role="tablist" aria-label="主题主功能"><button v-for="t in themeTools" :key="t.id" role="tab" :aria-selected="!skeletonOpen&&w.tool===t.id" :class="{active:!skeletonOpen&&w.tool===t.id}" @click="inspect(t.id)">{{t.name}}</button></view>
 <view class="ui-sheet-heading"><view><text class="ui-kicker">{{skeletonOpen?'SKELETON PAGE':'THEME UI DESIGN'}}</text><text class="ui-sheet-title">{{skeletonOpen?(currentPageTitle||'选择一个骨架页面'):(themeTools.find(t=>t.id===w.tool)?.name||'整套主题设计')}}</text></view><text class="ui-live-tag"><text class="status-dot"/>即时呈现</text></view>
 <view v-if="skeletonOpen" class="ui-design-scope"><text class="ui-design-scope-label">单页外观</text><text class="ui-design-scope-caption">展开页面区域，直接编辑布局与样式</text></view>
 <view class="ui-page-adjustments">
 <view v-if="skeletonOpen" class="page-composer" :key="appearancePage">
  <view class="page-composer-intro"><text>页面布局与样式</text><text>按页面从上到下编辑，展开区域即可调整。</text></view>
  <view v-for="region in [{id:'background',name:'页面背景',hint:'背景图片'},{id:'appbar',name:'顶部应用栏',hint:'高度、边距与显示尺寸'}]" :key="region.id" class="page-region" :class="{expanded:expandedRegions.includes(region.id)}">
   <button class="page-region-toggle" :aria-expanded="expandedRegions.includes(region.id)" @click="toggleRegion(region.id)"><view><text class="page-region-name">{{region.name}}</text><text class="page-region-hint">{{region.hint}}</text></view><text>{{expandedRegions.includes(region.id)?'收起 −':'编辑 ＋'}}</text></button>
   <view v-if="expandedRegions.includes(region.id)" class="page-region-body"><Inspector :theme="w.theme" tool="visual" :visual-group="region.id==='background'?'':'appbar'" :page="appearancePage" page-only embedded :busy="w.busy" @upload="w.upload"/></view>
  </view>
  <view v-for="(item,i) in pageComponents" :key="item.id" class="page-region" :class="{expanded:expandedRegions.includes(item.id)}">
   <view class="page-region-header"><button class="page-region-toggle" :aria-expanded="expandedRegions.includes(item.id)" @click="toggleRegion(item.id)"><text class="page-region-number">{{String(i+1).padStart(2,'0')}}</text><view><text class="page-region-name">{{item.title}}</text><text class="page-region-hint">{{item.component}} · {{item.visible===false?'已隐藏':'已显示'}}</text></view><text>{{expandedRegions.includes(item.id)?'收起 −':'编辑 ＋'}}</text></button><view class="page-region-order"><button :aria-label="item.title+'上移'" :disabled="i===0||w.locked" @click="movePageComponent(i,-1)">↑</button><button :aria-label="item.title+'下移'" :disabled="i===pageComponents.length-1||w.locked" @click="movePageComponent(i,1)">↓</button></view></view>
   <view v-if="expandedRegions.includes(item.id)" class="page-region-body"><label><input type="checkbox" :checked="item.visible!==false" @change="changeBlock(item.id,'visible',($event.target as HTMLInputElement).checked)"/> 显示此区域</label><label class="field">区域下方间距 <input type="number" min="0" max="64" :value="item.gap||0" @change="changeBlock(item.id,'gap',Number(($event.target as HTMLInputElement).value))"/></label><template v-if="item.component==='content'"><view v-for="s in w.pageSections.filter(s=>!item.sectionId||s.id===item.sectionId)" :key="s.id"><text>{{s.title}}</text><Inspector :theme="w.theme" tool="module" :page="appearancePage" :section="s" :section-id="s.id" page-only embedded :busy="w.busy" @upload="w.upload" @remove-module="removeComponent(s.id)"/></view></template><Inspector v-else :theme="w.theme" :tool="blockTool(item.component)" :visual-group="blockGroup(item.component)" :page="appearancePage" page-only embedded :busy="w.busy" @upload="w.upload"/></view>
  </view>
  <button v-if="!designPage&&['home','category','shortdrama'].includes(w.page)" class="page-add-region" :disabled="w.locked||w.theme.sections.length>=40" @click="w.addModule()">＋ 添加视频内容板块</button>
  <view v-for="g in appearanceGroups.filter(g=>!['appbar','carousel','cards'].includes(g.id)||(!pageComponents.length&&g.id==='cards'))" :key="g.id" class="page-region" :class="{expanded:expandedRegions.includes(g.id)}"><button class="page-region-toggle" :aria-expanded="expandedRegions.includes(g.id)" @click="toggleRegion(g.id)"><view><text class="page-region-name">{{g.name}}</text><text class="page-region-hint">本页组件的尺寸与显示样式</text></view><text>{{expandedRegions.includes(g.id)?'收起 −':'编辑 ＋'}}</text></button><view v-if="expandedRegions.includes(g.id)" class="page-region-body"><Inspector :theme="w.theme" tool="visual" :visual-group="g.id" :page="appearancePage" page-only embedded :busy="w.busy" @upload="w.upload"/></view></view>
 </view>
 <Inspector v-else :key="w.tool+':'+w.selected" :theme="w.theme" :tool="w.tool" :visual-group="visualGroup" :page="appearancePage" :section="w.selectedSection" :section-id="w.selected" :busy="w.busy" @upload="w.upload" @add-slide="w.addSlide()" @remove-module="w.removeModule()" @startup="w.startupPreview++"/>
 </view>
</view>
<view class="canvas-panel"><view class="canvas-toolbar"><view class="canvas-location"><text class="ui-preview-label">实时预览</text><text v-if="w.device==='mobile'&&(['player','together'].includes(designPage)||(!designPage&&['home','mine','category','shortdrama'].includes(w.page)))" class="canvas-size">{{w.previewState.connected?'运营数据 · 实时预览':'骨架预览 · 未连接运营数据'}}</text><text>{{currentPageTitle}}</text><text class="canvas-size">{{w.activeDevice.width}} × {{w.activeDevice.height}}</text></view><view class="canvas-tools"><select v-if="designPage&&!['player','detail'].includes(designPage)" v-model="designState" aria-label="设计状态"><option value="normal">正常 / 暂停</option><option value="loading">加载中</option><option value="empty">空内容</option><option value="error">失败状态</option></select><view class="mode-segment"><button :class="{active:w.interactive}" @click="w.interactive=true">交互预览</button><button :class="{active:!w.interactive}" @click="w.interactive=false">选取编辑</button></view><select v-model="zoom" aria-label="画布缩放" title="按住 Ctrl 并滚动鼠标滚轮缩放画布"><option value="fit">适应画布</option><option v-if="customZoom" :value="zoom">{{Math.round(scale*100)}}%</option><option v-for="preset in zoomPresets" :key="preset" :value="String(preset)">{{Math.round(preset*100)}}%</option></select><button class="icon-button" :title="w.fullPreview?'退出大画布':'放大画布'" :aria-label="w.fullPreview?'退出大画布':'放大画布'" @click="w.fullPreview=!w.fullPreview">{{w.fullPreview?'⊡':'⛶'}}</button></view></view><view class="canvas-area" ref="canvas" title="Ctrl + 鼠标滚轮缩放画布"><view class="canvas-holder" :class="w.device" :style="holderStyle"><view class="canvas-screen" :class="w.device" :style="canvasStyle"><SkeletonPage v-if="designPage&&!['player','detail'].includes(designPage)" :theme="previewTheme" :page="designPage" :state="designState" @group="selectVisual"/><AppExperience v-else :key="w.currentId+':'+w.device+':'+w.previewEpoch" :theme="previewTheme" :items="w.items" :categories="w.categories" :preview-page="designPage" :category-entry="selectedCategory" @category="chooseCategory" :section-items="w.sectionItems" :demo="false" :editing="!w.interactive" :selected="w.selected" :page="w.page" :platform="w.device" :error="w.contentError" :startup-preview="w.startupPreview" :announcement-preview="w.announcementPreview" :update-preview="w.updatePreview" :studio="true" :template-key="w.currentId" @select="selectCanvasElement" @page="choosePage($event)" @retry="w.refreshContent()"/></view></view></view><view class="canvas-status"><text>{{w.interactive?'可直接点击页面、搜索、分类和影片':'点击画布模块，选择要编辑的设计属性'}}</text><text>{{Math.round(scale*100)}}% · {{w.activeDevice.name}}</text></view></view>
</view>
</template>
<view v-if="w.error||w.message" class="feedback" :class="{error:!!w.error}" role="status"><text>{{w.error||w.message}}</text><button aria-label="关闭提示" @click="w.error='';w.message=''">×</button></view>
<view v-if="w.busy" class="busy-line"/>
</view>
<view v-if="w.dialog" class="modal-backdrop"><view class="workbench-modal" role="dialog" aria-modal="true" :aria-label="dialogTitles[w.dialog]"><view class="modal-heading"><view><text class="eyebrow">HETUN THEME STUDIO</text><text>{{dialogTitles[w.dialog]}}</text></view><button aria-label="关闭窗口" :disabled="w.busy" @click="w.dialog=''">×</button></view><template v-if="w.dialog==='guide'"><view class="guide-step"><text>01</text><view><text>选择或安装骨架</text><text>手机、平板、电视、电脑分别安装和管理。未安装的端显示空状态。</text></view></view><view class="guide-step"><text>02</text><view><text>设计与真实数据预览</text><text>编辑品牌、轮播、模块外观、导航样式与装饰。在“设置 → 运营中心连接”中填写地址，读取已发布内容；没有连接时显示空状态。</text></view></view><view class="guide-step"><text>03</text><view><text>保存和导出</text><text>保存草稿保留修改，导出 ZIP 带上主题配置与本机素材，再到打包器手动导入。</text></view></view><view class="guide-step"><text>04</text><view><text>导入打包器</text><text>在打包器手动导入导出的主题 ZIP 和已适配的基础 APK，校验能力后注入主题、配置后台并签名。</text></view></view><button class="primary wide" @click="w.dialog=''">开始制作</button></template><template v-else-if="w.dialog==='remove'"><text class="modal-description">删除「{{w.dialogTarget?.name}}」及其本机草稿。已导出的主题包不会受影响。</text><view class="modal-actions"><button :disabled="w.busy" @click="w.dialog=''">取消</button><button class="danger filled" :disabled="w.busy||!w.serviceReady" @click="w.commitDialog()">确认删除</button></view></template><template v-else><text class="modal-description">{{w.dialog==='import'?'填写名称，再选择 ZIP 或 JSON 骨架包。安装时读取包内平台信息。':w.dialog==='duplicate'?'复制为独立主题，原主题与它的草稿继续保留。':'为主题设置一个容易辨认的名称。'}}</text><view class="field"><text>主题名称</text><input v-model="w.dialogName" maxlength="60" placeholder="例如：河豚酷影主题" @confirm="w.commitDialog()"/></view><text v-if="w.dialog==='import'" class="modal-hint">支持 hetun-skeleton v2。包内平台决定它所属的端。</text><view class="modal-actions"><button :disabled="w.busy" @click="w.dialog=''">取消</button><button class="primary" :disabled="w.busy||!w.serviceReady" @click="w.commitDialog()">{{w.dialog==='import'?'选择文件并安装':'确认'}}</button></view></template><text v-if="w.error" class="modal-error">{{w.error}}</text></view></view>
</view>
</template>
