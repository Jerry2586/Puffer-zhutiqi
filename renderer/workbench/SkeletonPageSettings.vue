<script setup lang="ts">
import {computed,ref} from 'vue';
import type {Theme,CampaignDesign,NavItem,Section,AppLink,AppPage} from '@/domain/types';
import {categoryPageKey,categoryRoot} from '@/domain/category';
import {pageDesignFor} from '@/domain/visual';
import {categoryShortcutDefaults} from '@/domain/category-shortcuts';
import {createCampaign} from '@/domain/campaign';
import {api,assetUrl,chooseLocalFile} from '@/services/api';
const props=defineProps<{theme:Theme;busy:boolean;error:string}>();
const emit=defineEmits<{close:[];save:[theme:Theme]}>();
const draft=ref(JSON.parse(JSON.stringify(props.theme)) as Theme),tab=ref('categories'),selected=ref(draft.value.categories.find(n=>draft.value.pageDesign?.[categoryPageKey(n.id)]?.campaign)?.id||''),uploading=ref(false),uploadError=ref('');
const design=computed(()=>draft.value.pageDesign?.[categoryPageKey(selected.value)]?.campaign);
const linkPages:{id:AppPage;label:string}[]=[{id:'category',label:'分类'},{id:'ranking',label:'排行榜'},{id:'schedule',label:'排期'},{id:'search',label:'搜索'},{id:'shortdrama',label:'短剧'},{id:'member',label:'会员'},{id:'settings',label:'设置'},{id:'about',label:'关于'}];
function layout(id:string){draft.value.pageDesign??={};const entry=draft.value.categories.find(n=>n.id===id);const key=entry?.page==='shortdrama'?'shortdrama':categoryPageKey(id);return draft.value.pageDesign[key]??={};}
function shortcutLinks(id:string){const page=layout(id);return page.shortcuts??=((pageDesignFor(draft.value,categoryPageKey(id)).shortcuts??categoryShortcutDefaults(categoryRoot(draft.value,id))).map(link=>({...link})));}
function homeLayout(){draft.value.pageDesign??={};return draft.value.pageDesign.home??={};}
function addFilter(id:string){const page=layout(id),list=page.categoryFilters??=[];if(list.length<20)list.push({id:uniqueId('filter',list.map(n=>n.id)),label:'新子分类',categoryId:''});}
function addLink(id?:string){const page=id?layout(id):homeLayout(),list=(id?shortcutLinks(id):page.menu??=[]);if(list.length<20)list.push({id:uniqueId('link',list.map(n=>n.id)),label:'新入口',page:'ranking',categoryId:'',entryId:'',content:'',icon:'',enabled:true});}
function move<T>(list:T[],index:number,delta:number){const next=index+delta;if(next>=0&&next<list.length)[list[index],list[next]]=[list[next],list[index]];}
const activityEntries=computed(()=>draft.value.categories.filter(n=>n.page==='category'));
const groups=computed(()=>design.value?.groupIds.map(id=>draft.value.sections.find(s=>s.id===id)).filter((s):s is Section=>!!s)||[]);
function checked(event:unknown){return !!(event as {detail?:{value?:boolean}}).detail?.value;}
function toggleEnabled(n:NavItem,event:unknown){n.enabled=!!(event as {detail?:{value?:boolean}}).detail?.value;}
function uniqueId(prefix:string,ids:string[]){let id=prefix+'-'+Date.now().toString(36),suffix=1;while(ids.includes(id))id=prefix+'-'+Date.now().toString(36)+'-'+suffix++;return id;}
function addDirectory(){if(draft.value.categories.length>=20)return;const id=uniqueId('entry',draft.value.categories.map(n=>n.id));draft.value.categories.push({id,label:'新分类',page:'category',categoryId:'',enabled:true,icon:'',activeIcon:''});selected.value=id;}
function enableCampaign(){const id=selected.value;if(!id)return;draft.value.pageDesign??={};draft.value.pageDesign[categoryPageKey(id)]={...draft.value.pageDesign[categoryPageKey(id)],campaign:createCampaign()};}
function removeDirectory(id:string){draft.value.categories=draft.value.categories.filter(n=>n.id!==id);if(selected.value===id)selected.value=activityEntries.value[0]?.id||'';}
function addGroup(){if(!design.value||design.value.groupIds.length>=12||draft.value.sections.length>=40)return;const id=uniqueId('activity',draft.value.sections.map(s=>s.id));draft.value.sections.push({id,title:'新片单',subtitle:'',page:'category',categoryEntry:selected.value,kind:'landscape',source:'latest',categoryId:'',orderBy:'manual',manualIds:'',limit:4,columns:2,enabled:true});design.value.groupIds.push(id);}
function removeGroup(id:string){if(design.value)design.value.groupIds=design.value.groupIds.filter(x=>x!==id);}
function moveGroup(index:number,delta:number){if(!design.value)return;const ids=design.value.groupIds,other=index+delta;if(other<0||other>=ids.length)return;[ids[index],ids[other]]=[ids[other],ids[index]];}
async function upload(){const target=design.value;if(!target||uploading.value)return;uploading.value=true;uploadError.value='';try{const file=await chooseLocalFile('.png,.jpg,.jpeg,.webp,.svg');target.artwork=(await api.asset(file.name,file.data)).url;}catch(e){uploadError.value=(e as Error).message;}finally{uploading.value=false;}}
</script>
<template>
 <view class="config-overlay" role="dialog" aria-modal="true" aria-label="骨架页面配置" @keydown.esc="!busy&&!uploading&&emit('close')">
  <view class="config-head"><view><text class="config-title">骨架页面配置</text><text class="config-caption">目录、快捷入口、活动和菜单</text></view><button :disabled="busy||uploading" aria-label="关闭配置" @click="emit('close')">×</button></view>
  <view class="config-tabs"><button :class="{active:tab==='activity'}" @click="tab='activity'">活动页面</button><button :class="{active:tab==='categories'}" @click="tab='categories'">一级目录</button><button :class="{active:tab==='menu'}" @click="tab='menu'">侧边菜单</button></view>
  <scroll-view scroll-y class="config-scroll">
   <view v-if="tab==='categories'" class="config-content">
    <text class="config-hint">名称自行设置，CMS 编号用于绑定主站分类。</text>
    <view v-for="(n,index) in draft.categories" :key="n.id" class="config-card">
     <view class="config-row"><text>目录名称</text><button :disabled="index===0" aria-label="目录上移" @click="move(draft.categories,index,-1)">↑</button><button :disabled="index===draft.categories.length-1" aria-label="目录下移" @click="move(draft.categories,index,1)">↓</button><switch :checked="n.enabled" @change="toggleEnabled(n,$event)"/></view>
     <input v-model="n.label" maxlength="20" placeholder="目录名称" :aria-label="'目录名称 '+n.id"/>
     <view class="config-row"><button :class="{chosen:n.page==='category'}" @click="n.page='category'">分类页</button><button :class="{chosen:n.page==='home'}" @click="n.page='home'">首页</button><button :class="{chosen:n.page==='shortdrama'}" @click="n.page='shortdrama'">短剧</button></view>
     <input v-if="n.page==='category'||n.page==='shortdrama'" v-model="n.categoryId" maxlength="20" placeholder="苹果 CMS 分类编号（可后续绑定）"/>
     <template v-if="n.page==='category'||n.page==='shortdrama'">
      <text class="card-title">手动子分类</text><text class="config-hint">填写名称和真实 CMS 编号，显示在共享筛选页中。</text>
      <view v-for="(filter,fi) in layout(n.id).categoryFilters||[]" :key="filter.id" class="config-card sub-card"><input v-model="filter.label" maxlength="20" placeholder="子分类名称"/><input v-model="filter.categoryId" maxlength="20" placeholder="CMS 分类编号（必填）"/><view class="config-row"><button :disabled="fi===0" @click="move(layout(n.id).categoryFilters!,fi,-1)">↑</button><button :disabled="fi===(layout(n.id).categoryFilters?.length||0)-1" @click="move(layout(n.id).categoryFilters!,fi,1)">↓</button><button class="danger" @click="layout(n.id).categoryFilters!.splice(fi,1)">移除子分类</button></view></view>
      <button class="outline" :disabled="(layout(n.id).categoryFilters?.length||0)>=20" @click="addFilter(n.id)">＋ 添加子分类</button>
     </template>
     <template v-if="n.page==='category'&&!layout(n.id).campaign">
      <text class="card-title">分类快捷栏</text><text class="config-hint">显示在轮播下方。“全部”进入共享筛选页，其余入口可改名、排序、隐藏，专题可指向自己的分类或活动页。</text>
      <view v-for="(link,li) in shortcutLinks(n.id)" :key="link.id" class="config-card sub-card"><input v-model="link.label" maxlength="20" placeholder="入口名称"/><view class="entry-options"><button v-for="target in linkPages" :key="target.id" :class="{chosen:link.page===target.id}" @click="link.page=target.id">{{target.label}}</button></view><view v-if="link.page==='category'" class="entry-options"><button v-for="target in activityEntries" :key="target.id" :class="{chosen:link.entryId===target.id}" @click="link.entryId=target.id;link.categoryId=target.categoryId">{{target.label}}</button></view><view class="config-row"><switch :checked="link.enabled" @change="link.enabled=checked($event)"/><button :disabled="li===0" @click="move(layout(n.id).shortcuts!,li,-1)">↑</button><button :disabled="li===(layout(n.id).shortcuts?.length||0)-1" @click="move(layout(n.id).shortcuts!,li,1)">↓</button><button class="danger" @click="layout(n.id).shortcuts!.splice(li,1)">移除入口</button></view></view>
      <button class="outline" :disabled="(layout(n.id).shortcuts?.length||0)>=20" @click="addLink(n.id)">＋ 添加快捷入口</button>
     </template>
     <view class="config-row"><button v-if="n.page==='category'" @click="selected=n.id;tab='activity'">配置活动页 ›</button><button class="danger" @click="removeDirectory(n.id)">移除目录</button></view>
    </view>
    <button class="outline" :disabled="draft.categories.length>=20" @click="addDirectory">＋ 添加一级目录</button>
   </view>
   <view v-else-if="tab==='menu'" class="config-content">
    <view class="config-card"><view class="config-row"><text>显示左侧三条杠菜单</text><switch :checked="draft.features.serviceMenu" @change="draft.features.serviceMenu=checked($event)"/></view><text class="config-hint">入口名称、目标、正文和显示状态均可配置。正文填写后打开独立内容页。</text></view>
    <view v-for="(link,li) in homeLayout().menu||[]" :key="link.id" class="config-card"><input v-model="link.label" maxlength="20" placeholder="菜单名称"/><view class="entry-options"><button v-for="target in linkPages" :key="target.id" :class="{chosen:link.page===target.id}" @click="link.page=target.id">{{target.label}}</button></view><view v-if="link.page==='category'" class="entry-options"><button v-for="target in activityEntries" :key="target.id" :class="{chosen:link.entryId===target.id}" @click="link.entryId=target.id;link.categoryId=target.categoryId">{{target.label}}</button></view><textarea v-model="link.content" maxlength="6000" placeholder="自定义内容（留空跳转目标页面）"/><view class="config-row"><switch :checked="link.enabled" @change="link.enabled=checked($event)"/><button :disabled="li===0" @click="move(homeLayout().menu!,li,-1)">↑</button><button :disabled="li===(homeLayout().menu?.length||0)-1" @click="move(homeLayout().menu!,li,1)">↓</button><button class="danger" @click="homeLayout().menu!.splice(li,1)">移除入口</button></view></view>
    <button class="outline" :disabled="(homeLayout().menu?.length||0)>=20" @click="addLink()">＋ 添加菜单入口</button><button class="danger" @click="homeLayout().menu=[]">清空自定义菜单</button>
   </view>
   <view v-else class="config-content">
    <text class="field-label">选择活动所属目录</text><view class="entry-options"><button v-for="n in activityEntries" :key="n.id" :class="{chosen:selected===n.id}" @click="selected=n.id">{{n.label}}</button></view>
    <button v-if="selected&&!design" class="outline" @click="enableCampaign">为此目录启用活动页面</button>
    <text v-if="!selected" class="config-hint">先添加一个分类目录，再配置活动页面。</text>
    <template v-if="design"><button class="danger" @click="delete layout(selected).campaign">停用活动，恢复分类页面</button>
     <view class="config-card"><text class="card-title">活动主视觉</text><text class="field-label">标题</text><input v-model="design.title" maxlength="40" placeholder="活动标题"/><text class="field-label">副标题</text><input v-model="design.subtitle" maxlength="100" placeholder="副标题"/><text class="field-label">顶部小标题</text><input v-model="design.eyebrow" maxlength="24" placeholder="顶部小标题"/>
      <view class="config-row"><button :class="{chosen:design.tone==='crimson'}" @click="design.tone='crimson'">暖红</button><button :class="{chosen:design.tone==='midnight'}" @click="design.tone='midnight'">深蓝</button></view>
      <image v-if="design.artwork" class="artwork-preview" :src="assetUrl(design.artwork)" mode="aspectFill"/><view class="config-row"><button class="outline" :disabled="uploading" @click="upload">{{uploading?'正在上传…':'上传主视觉图片'}}</button><button v-if="design.artwork" @click="design.artwork=''">移除图片</button></view>
      <text class="field-label">推荐影片编号</text><input v-model="design.featuredId" maxlength="30" placeholder="留空时展示当前片库首个真实影片"/>
     </view>
     <view class="config-card"><text class="card-title">宣传横幅</text><input v-model="design.bannerTitle" maxlength="40" placeholder="横幅标题（留空隐藏）"/><input v-model="design.bannerText" maxlength="100" placeholder="横幅说明"/><input v-model="design.bannerLabel" maxlength="16" placeholder="按钮名称（留空隐藏按钮）"/><view class="entry-options"><button v-for="p in [{id:'search',label:'搜索'},{id:'member',label:'会员'},{id:'library',label:'收藏'},{id:'ranking',label:'排行榜'}]" :key="p.id" :class="{chosen:design.bannerPage===p.id}" @click="design.bannerPage=p.id as CampaignDesign['bannerPage']">{{p.label}}</button></view></view>
     <view v-for="(group,index) in groups" :key="group.id" class="config-card">
      <view class="config-row"><text class="card-title">片单 {{index+1}}</text><button :disabled="index===0" aria-label="片单上移" @click="moveGroup(index,-1)">↑</button><button :disabled="index===groups.length-1" aria-label="片单下移" @click="moveGroup(index,1)">↓</button></view>
      <input v-model="group.title" maxlength="40" placeholder="栏目标题"/><input v-model="group.subtitle" maxlength="80" placeholder="栏目说明"/>
      <text class="field-label">指定影片编号（多个用逗号分隔）</text><input v-model="group.manualIds" maxlength="1000" placeholder="例如：123,456" @input="group.orderBy='manual';group.source='latest'"/>
      <text class="field-label">或绑定 CMS 分类</text><input v-model="group.categoryId" maxlength="20" placeholder="CMS 分类编号" @input="group.source='category';group.orderBy='latest'"/>
      <text class="config-hint">当前使用：{{group.source==='category'?'CMS 分类':'指定影片'}}</text><button class="danger" @click="removeGroup(group.id)">从活动移除此片单</button>
     </view>
     <button class="outline" :disabled="design.groupIds.length>=12||draft.sections.length>=40" @click="addGroup">＋ 添加片单</button>
    </template>
   </view>
  </scroll-view>
  <view class="config-foot"><text v-if="error||uploadError" class="config-error" role="alert">{{error||uploadError}}</text><button class="save-button" :disabled="busy||uploading" @click="emit('save',draft)">{{busy?'正在保存…':'保存并查看页面'}}</button></view>
 </view>
</template>
<style scoped>
.config-overlay{position:absolute;inset:0;z-index:110;background:#f5f6f8;color:#242936;display:flex;flex-direction:column;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.config-overlay button{font:inherit;line-height:1.4;min-height:32px;padding:6px 10px;margin:0;border:0;border-radius:6px;background:transparent;color:inherit}.config-overlay button::after{border:0}.config-overlay button:focus-visible{outline:2px solid #6558db}.config-overlay button[disabled]{opacity:.4}.config-head{display:flex;align-items:center;justify-content:space-between;padding:20px 18px 14px;background:#fff}.config-head>view{display:flex;flex-direction:column;gap:5px}.config-title{font-size:18px;font-weight:650}.config-caption{font-size:11px;color:#7b8495}.config-head>button{font-size:24px}.config-tabs{display:flex;gap:8px;padding:0 18px 12px;background:#fff;border-bottom:1px solid #e5e7eb}.config-tabs .active{background:#efedff;color:#5849c8;font-weight:600}.config-scroll{height:0;flex:1;min-height:0}.config-content{padding:16px;display:flex;flex-direction:column;gap:12px}.config-card{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid #e3e6ed;background:#fff;border-radius:10px}.config-overlay textarea{width:100%;min-height:110px;padding:10px;box-sizing:border-box;background:#f6f7fb;border:1px solid #dce0e8;border-radius:8px}.sub-card{padding:10px;background:#f9fafc}.config-overlay input{border:1px solid #dce0e8;border-radius:6px;font-size:13px;height:38px;padding:0 10px;box-sizing:border-box;background:#fff;color:#242936;min-width:0}.config-overlay input:focus-within{border-color:#8476db}.config-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.config-row>.card-title,.config-row>text:first-child{flex:1}.field-label{font-size:11px;color:#707a8c}.card-title{font-size:13px;font-weight:650}.config-hint{font-size:11px;color:#8991a0;line-height:1.6}.config-overlay .chosen{background:#eeebff;color:#5a49bd}.entry-options{display:flex;flex-wrap:wrap;gap:6px}.config-overlay .outline{border:1px solid #d8dce6;background:#fff}.config-overlay .danger{font-size:11px;color:#aa4850;align-self:flex-start}.artwork-preview{width:100%;height:110px;border-radius:6px}.config-foot{padding:12px 16px max(12px,env(safe-area-inset-bottom));border-top:1px solid #e2e5ec;background:#fff}.config-overlay .save-button{width:100%;background:#6251c9;color:#fff;padding:12px;font-weight:600;border-radius:8px}.config-error{display:block;font-size:11px;color:#ad3444;line-height:1.6;margin-bottom:8px}
</style>
