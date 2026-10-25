<script setup lang="ts">
import ColorPicker from './ColorPicker.vue';
import VisualInspector from './VisualInspector.vue';
import {normalizeVisual,pageDesignFor,fixedModule} from '@/domain/visual';
import {computed} from 'vue';
import type {Theme,Section} from '@/domain/types';
import Panel from '@/components/EditorPanel.vue';
import Choice from '@/components/EditorChoice.vue';
import {assetUrl} from '@/services/api';
import {carouselStyles,sectionStyles} from '@/domain/presentation';
const props=defineProps<{theme:Theme;tool:string;section?:Section;busy:boolean;visualGroup?:string;page?:string;sectionId?:string;pageOnly?:boolean;embedded?:boolean}>();
const emit=defineEmits<{upload:[target:Record<string,any>,key:string,video?:boolean];addSlide:[];removeModule:[];startup:[]}>();
const groupNames:Record<string,string>={brand:'品牌与风格',carousel:'轮播设计',module:'内容模块',navigation:'导航样式',colors:'主题配色',festival:'装饰设计',visual:'精细外观设计',player:'播放器设计'};
const fixedId=computed(()=>!props.section&&['home-highlights','home-recommendations','home-content','category-content'].includes(props.sectionId||'')?props.sectionId:'');
const section=computed(()=>props.section||(fixedId.value?new Proxy(fixedModule(props.theme,props.page||'home',fixedId.value),{
 get(_target,key){return Reflect.get(fixedModule(props.theme,props.page||'home',fixedId.value!),key);},
 set(_target,key,value){
  props.theme.pageDesign??={};const page=props.theme.pageDesign[props.page||'home']??={};page.modules??={};
  const module=page.modules[fixedId.value!.replace(/^(home|category)-/,'')]??={};
  module.style??=fixedModule(props.theme,props.page||'home',fixedId.value!).style;
  Reflect.set(module,key==='enabled'?'visible':key,value);return true;
 }
}):undefined));
const homeModuleNames:Record<string,string>={'home-highlights':'快捷入口 / 高亮推荐','home-recommendations':'今日专属推荐','home-content':'内容推荐'};
const carouselPage=computed(()=>pageDesignFor(props.theme,props.page||'home'));
function ensureCarouselPage(){props.theme.pageDesign??={};return props.theme.pageDesign[props.page||'home']??={};}
function toggleCarousel(){ensureCarouselPage().carousel=carouselPage.value.carousel===false;}
const carousel=computed(()=>{if(!props.pageOnly)return props.theme.carousel;return new Proxy(props.theme.carousel,{get(target,key){return (carouselPage.value.carouselDesign as any)?.[key]??Reflect.get(target,key);},set(_target,key,value){const page=ensureCarouselPage();page.carouselDesign??={};(page.carouselDesign as any)[key]=value;return true;}});});
const palette=[{name:'酷影 · 深色',colors:{background:'#080b12',surface:'#151a25',text:'#f5f7fb',muted:'#8b95a8',accent:'#38c7db'}},{name:'云白 · 浅色',colors:{background:'#f7f8fa',surface:'#ffffff',text:'#202735',muted:'#8a92a1',accent:'#209eb7'}},{name:'曜金 · 深色',colors:{background:'#11100e',surface:'#201e19',text:'#fff8e8',muted:'#a79d88',accent:'#e6be73'}}];
function applyPalette(colors:Theme['colors']){props.theme.colors={...colors};props.theme.visual=normalizeVisual(undefined,colors);}
function styleModule(style:string){if(!section.value)return;section.value.style=style as Section['style'];if(style==='grid2')section.value.columns=2;if(style==='grid3')section.value.columns=3;}
function addNavigation(){if(props.theme.navigation.length>=20)return;props.theme.navigation.push({id:'nav-'+crypto.randomUUID().slice(0,8),label:'自定义分类',page:'category',categoryId:'',enabled:true,icon:'▦',activeIcon:''});}
function move<T>(rows:T[],i:number,delta:number){const target=i+delta;if(target>=0&&target<rows.length)[rows[i],rows[target]]=[rows[target],rows[i]];}
</script>
<template>
<view v-if="!embedded" class="property-heading"><text class="eyebrow">DESIGN PROPERTIES</text><text class="property-title">{{pageOnly?'本页调节':groupNames[tool]||'设计属性'}}</text><text class="property-subtitle">{{tool==='module'?section?.title||homeModuleNames[sectionId||'']||'选择本页模块':'修改会立即显示在画布中'}}</text></view>
<view class="property-body" :class="{'inline-properties':embedded}">
<template v-if="tool==='visual'||tool==='player'"><VisualInspector :theme="theme" :group="tool==='player'?'player':visualGroup" :page="page" :page-only="pageOnly" @upload="(target,key)=>emit('upload',target,key)"/></template>
<template v-else-if="tool==='brand'">
<Panel title="品牌标识" :summary="theme.brand.name" :initial-open="true">
<view class="field"><text>应用名称</text><input v-model="theme.brand.name" maxlength="30" placeholder="你的品牌名称"/></view>
<view class="field"><text>品牌介绍</text><input v-model="theme.brand.tagline" maxlength="80" placeholder="一句品牌介绍"/></view>
<view class="asset-row"><image v-if="theme.brand.logo" :src="assetUrl(theme.brand.logo)" mode="aspectFit"/><view v-else class="asset-placeholder">LOGO</view><view><button :disabled="busy" @click="emit('upload',theme.brand,'logo')">上传品牌图</button><button v-if="theme.brand.logo" class="subtle" @click="theme.brand.logo=''">移除</button></view></view>
</Panel>
<Panel title="界面风格" :initial-open="true" summary="固定结构与页面样式">
<view class="field"><text>整体风格</text><text class="fixed-design">简约经典</text></view>
<view class="field"><text>顶部样式</text><Choice v-model="theme.pageStyles.header" :options="[{id:'search',label:'搜索栏'},{id:'brand',label:'品牌栏'}]"/></view>
<view class="field"><text>我的页面</text><Choice v-model="theme.pageStyles.mine" :options="[{id:'card',label:'分组卡片'},{id:'minimal',label:'简洁列表'}]"/></view>
<view class="field"><text>会员页视觉</text><Choice v-model="theme.pageStyles.member" :options="[{id:'gold',label:'香槟金'},{id:'violet',label:'星光紫'}]"/></view>
</Panel>
<Panel title="卡片与间距" :summary="'全局圆角 '+theme.layout.posterRadius+' px'">
<view class="field"><text>全局海报圆角</text><input type="number" v-model.number="theme.layout.posterRadius"/></view>
<view class="field"><text>页面密度</text><Choice v-model="theme.layout.density" :options="[{id:'comfortable',label:'舒适'},{id:'compact',label:'紧凑'}]"/></view>
</Panel>
<Panel title="整体主题颜色" summary="整套 UI 的全局颜色，修改后所有页面即时同步" :initial-open="true">
<view class="palette-list"><button v-for="p in palette" :key="p.name" class="palette-row" @click="applyPalette(p.colors)"><view class="palette-dots"><view v-for="(v,k) in p.colors" :key="k" :style="{background:v}"/></view><text>{{p.name}}</text><text>应用 ↗</text></button></view>
</Panel>
<Panel title="UI 色轮与颜色" summary="完整色轮 · 透明度 · 最近使用" :initial-open="true"><view v-for="(label,key) in {background:'页面背景',surface:'卡片背景',text:'主要文字',muted:'辅助文字',accent:'主题强调色'}" :key="key" class="field color-field"><text>{{label}}</text><ColorPicker v-model="theme.colors[key]" :label="label"/></view><view class="property-note">这里统一控制整套主题的基础颜色；单页外观只调节当前页面的布局、尺寸、图片与呈现方式。</view></Panel>
</template>
<template v-else-if="tool==='colors'">
<Panel title="配色方案" summary="快速应用，再逐项微调" :initial-open="true"><button v-for="p in palette" :key="p.name" class="palette-row" @click="applyPalette(p.colors)"><view class="palette-dots"><view v-for="(v,k) in p.colors" :key="k" :style="{background:v}"/></view><text>{{p.name}}</text><text>↗</text></button></Panel>
<Panel title="自定义颜色" summary="完整色轮 · 透明度 · 最近使用" :initial-open="true"><view v-for="(label,key) in {background:'页面背景',surface:'卡片背景',text:'主要文字',muted:'辅助文字',accent:'主题强调色'}" :key="key" class="field color-field"><text>{{label}}</text><ColorPicker v-model="theme.colors[key]" :label="label"/></view></Panel>
</template>
<template v-else-if="tool==='carousel'">
<Panel v-if="pageOnly" title="轮播位置" summary="仅修改这个页面" :initial-open="true"><view class="toggle-row"><text>显示轮播图</text><button class="toggle" :class="{on:carouselPage.carousel!==false}" :aria-pressed="carouselPage.carousel!==false" @click="toggleCarousel()"><view/></button></view></Panel>
<Panel title="轮播样式" :summary="carouselStyles.find(s=>s[0]===carousel.style)?.[1]" :initial-open="true"><view class="style-grid"><button v-for="[id,name] in carouselStyles" :key="id" :class="{chosen:carousel.style===id}" @click="carousel.style=id"><view class="carousel-mini" :class="id"><view/><view/><view/></view><text>{{name}}</text></button></view></Panel>
<Panel title="尺寸与外观" :summary="carousel.height+' px · 圆角 '+carousel.radius+' px'" :initial-open="true"><view class="fields-two"><view class="field"><text>轮播高度</text><input type="number" v-model.number="carousel.height"/></view><view class="field"><text>圆角</text><input type="number" v-model.number="carousel.radius"/></view></view><view class="field"><text>两侧边距</text><input type="number" v-model.number="carousel.margin"/></view><view class="field"><text>图片填充</text><Choice v-model="carousel.fit" :options="[{id:'cover',label:'铺满裁切'},{id:'contain',label:'完整显示'}]"/></view><view class="field"><text>标题位置</text><Choice v-model="carousel.titlePosition" :options="[{id:'bottom',label:'底部'},{id:'side',label:'侧边'},{id:'hidden',label:'隐藏'}]"/></view></Panel>
<Panel title="播放与指示器" :summary="carousel.autoplay?'自动轮播':'手动轮播'"><view class="toggle-row"><text>自动轮播</text><button class="toggle" :class="{on:carousel.autoplay}" :aria-pressed="carousel.autoplay" @click="carousel.autoplay=!carousel.autoplay"><view/></button></view><view class="field"><text>切换间隔（秒）</text><input type="number" v-model.number="carousel.interval"/></view><view class="field"><text>切换效果</text><Choice v-model="carousel.effect" :options="[{id:'slide',label:'平移'},{id:'fade',label:'淡入淡出'}]"/></view><view class="field"><text>指示器</text><Choice v-model="carousel.indicator" :options="[{id:'dots',label:'圆点'},{id:'numbers',label:'数字'},{id:'none',label:'隐藏'}]"/></view></Panel>
<VisualInspector :theme="theme" group="carousel" :page="pageOnly?page:undefined" :page-only="pageOnly"/><view class="property-note">此处设计轮播外观；影片、活动素材和跳转由运维中心管理。无内容时使用离线设计示意，不生成影片数据。</view>

</template>
<template v-else-if="tool==='module'&&section">
<Panel title="模块信息" :summary="section.title" :initial-open="true"><view class="field"><text>模块名称</text><input v-model="section.title" maxlength="40"/></view><view class="field"><text>副标题</text><input v-model="section.subtitle" maxlength="80"/></view><view class="toggle-row"><text>显示此模块</text><button class="toggle" :class="{on:section.enabled}" :aria-pressed="section.enabled" @click="section.enabled=!section.enabled"><view/></button></view></Panel>
<Panel title="模块样式" :summary="sectionStyles.find(s=>s[0]===section?.style)?.[1]" :initial-open="true"><view class="style-grid module-style"><button v-for="[id,name] in sectionStyles" :key="id" :class="{chosen:section.style===id}" @click="styleModule(id)"><view class="module-mini" :class="id"><view v-for="n in 6" :key="n"/></view><text>{{name}}</text></button></view></Panel>
<Panel title="尺寸与数量" :summary="section.limit+' 部 · '+section.columns+' 列'" :initial-open="true"><view class="fields-two"><view class="field"><text>影片数量</text><input type="number" v-model.number="section.limit" min="1" max="60"/></view><view class="field"><text>每行列数</text><input type="number" v-model.number="section.columns" min="1" max="6"/></view><view class="field"><text>卡片圆角</text><input type="number" v-model.number="section.radius" min="0" max="32"/></view><view class="field"><text>卡片间距</text><input type="number" v-model.number="section.gap" min="0" max="32"/></view></view><view class="field"><text>模块标题字号</text><input type="number" v-model.number="section.titleSize" min="10" max="32" placeholder="18"/></view><view class="field"><text>卡片比例</text><Choice v-model="section.ratio" :options="[{id:'2/3',label:'竖版 2:3'},{id:'3/4',label:'竖版 3:4'},{id:'16/9',label:'横版 16:9'},{id:'1/1',label:'方形 1:1'}]"/></view></Panel>
<view class="property-note">模块分类与影片来源在运维中心的「页面编排」中配置，当前主题保留已有绑定。</view>
<Panel title="卡片信息" summary="标题、评分与更新状态"><view v-for="[key,label] in [['showTitle','影片名称'],['showScore','评分'],['showNote','更新状态'],['showYear','年份'],['showMore','查看更多']]" :key="key" class="toggle-row"><text>{{label}}</text><button class="toggle" :class="{on:key==='showYear'?!!section.showYear:(section as any)[key]!==false}" :aria-pressed="key==='showYear'?!!section.showYear:(section as any)[key]!==false" @click="(section as any)[key]=key==='showYear'?!section.showYear:(section as any)[key]===false"><view/></button></view></Panel>
<button v-if="!fixedId" class="danger outline" @click="emit('removeModule')">删除当前模块</button>
</template>
<template v-else-if="tool==='navigation'">
<Panel title="一级目录" summary="顶部分类目录 · 外观设计与运营分类绑定" :initial-open="true">
<view class="property-note">首页及分类目录由运营后台创建、排序并绑定苹果 CMS 分类；此处设计目录样式，目录名称随运营配置展示。</view>
<view class="field"><text>骨架目录预览</text><view class="directory-preview"><text v-for="item in theme.categories.filter(n=>n.enabled)" :key="item.id">{{item.label}}</text><text v-if="!theme.categories.some(n=>n.enabled)">等待运营后台配置目录</text></view></view>
<VisualInspector :theme="theme" group="directory" embedded @upload="(target,key)=>emit('upload',target,key)"/>
</Panel>
<Panel title="底部导航" :summary="theme.navigation.length+' 个导航项目 · 图标、颜色与尺寸统一设置'" :initial-open="true">
<view class="field"><text>底部导航样式</text><Choice v-model="theme.pageStyles.navigation" :options="[{id:'icons',label:'图标与文字'},{id:'text',label:'纯文字'}]"/></view>
<VisualInspector :theme="theme" group="navigation" embedded @upload="(target,key)=>emit('upload',target,key)"/>
<Panel v-for="(item,index) in theme.navigation" :key="item.id" :title="(index+1)+' · '+item.label" summary="常态与选中态 · 点击编辑名称和图标">
 <view class="field"><text>显示名称</text><input v-model="item.label" maxlength="20" placeholder="导航名称"/></view>
 <view class="nav-icon-editors"><view v-for="entry in [{key:'icon',label:'未选中图标'},{key:'activeIcon',label:'选中图标'}]" :key="entry.key" class="nav-icon-editor"><text>{{entry.label}}</text><view class="nav-icon-preview"><image v-if="/^https?:|^\/api\/assets\//.test((item as any)[entry.key])" :src="assetUrl((item as any)[entry.key])" mode="aspectFit"/><text v-else>{{(item as any)[entry.key]||'继承常态'}}</text></view><button :disabled="busy" @click="emit('upload',item,entry.key)">替换图标</button><button class="inherit-button" v-if="(item as any)[entry.key]" @click="(item as any)[entry.key]=''">恢复默认</button></view></view>
 <view class="field"><text>常态图标 / 素材地址</text><input v-model="item.icon" placeholder="上传 SVG、PNG 或输入图标字符"/></view>
 <view class="field"><text>选中图标 / 素材地址</text><input v-model="item.activeIcon" placeholder="留空继承常态图标"/></view>
</Panel>
<button :disabled="theme.navigation.length>=20||busy" @click="addNavigation()">＋ 添加自定义导航分类</button>
<view class="property-note">此处设计导航名称和图标。自定义分类新增为分类页入口；内容分类绑定、上线开关及业务跳转由运维中心配置。SVG 支持静态矢量图形。</view>
</Panel>
</template>

<template v-else-if="tool==='festival'">
<Panel title="节日装饰" :summary="theme.festival.enabled?'已启用装饰':'日常主题'" :initial-open="true"><view class="toggle-row"><text>装饰效果</text><button class="toggle" :class="{on:theme.festival.enabled}" :aria-pressed="theme.festival.enabled" @click="theme.festival.enabled=!theme.festival.enabled"><view/></button></view><view class="field"><text>装饰样式</text><Choice v-model="theme.festival.kind" :options="[{id:'none',label:'无装饰'},{id:'spring',label:'新春'},{id:'christmas',label:'圣诞'},{id:'midautumn',label:'中秋'}]"/></view></Panel>
<view class="property-note">装饰随当前主题包保存，运营中心可选择使用这套主题。</view>
</template>

<view v-else class="property-note">选择左侧页面或画布中的模块，编辑它的设计属性。</view>
</view>
</template>

<style scoped>.directory-preview{display:flex;flex-wrap:wrap;gap:8px}.directory-preview>text{padding:6px 10px;border-radius:6px;background:var(--studio-input,#172329);font-size:12px}</style>
