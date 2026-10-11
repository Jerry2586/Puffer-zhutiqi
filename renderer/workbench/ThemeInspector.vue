<script setup lang="ts">
import {computed} from 'vue';
import type {Theme,Section} from '@/domain/types';
import Panel from '@/components/EditorPanel.vue';
import Choice from '@/components/EditorChoice.vue';
import {assetUrl} from '@/services/api';
import {carouselStyles,sectionStyles} from '@/domain/presentation';
const props=defineProps<{theme:Theme;tool:string;section?:Section;busy:boolean}>();
const emit=defineEmits<{upload:[target:Record<string,any>,key:string,video?:boolean];addSlide:[];removeModule:[];startup:[]}>();
const groupNames:Record<string,string>={brand:'品牌与界面',carousel:'轮播设计',module:'内容模块',navigation:'导航样式',colors:'主题配色',festival:'装饰设计',startup:'开机页面'};
const section=computed(()=>props.section);
const palette=[{name:'酷影 · 深色',colors:{background:'#080b12',surface:'#151a25',text:'#f5f7fb',muted:'#8b95a8',accent:'#38c7db'}},{name:'云白 · 浅色',colors:{background:'#f7f8fa',surface:'#ffffff',text:'#202735',muted:'#8a92a1',accent:'#209eb7'}},{name:'曜金 · 深色',colors:{background:'#11100e',surface:'#201e19',text:'#fff8e8',muted:'#a79d88',accent:'#e6be73'}}];
function styleModule(style:string){if(!section.value)return;section.value.style=style as Section['style'];if(style==='grid2')section.value.columns=2;if(style==='grid3')section.value.columns=3;}
function move<T>(rows:T[],i:number,delta:number){const target=i+delta;if(target>=0&&target<rows.length)[rows[i],rows[target]]=[rows[target],rows[i]];}
</script>
<template>
<view class="property-heading"><text class="eyebrow">DESIGN PROPERTIES</text><text class="property-title">{{groupNames[tool]||'设计属性'}}</text><text class="property-subtitle">{{tool==='module'?section?.title||'选择左侧的内容模块':'修改会立即显示在画布中'}}</text></view>
<view class="property-body">
<template v-if="tool==='brand'">
<Panel title="品牌标识" :summary="theme.brand.name" :initial-open="true">
<view class="field"><text>应用名称</text><input v-model="theme.brand.name" maxlength="30" placeholder="你的品牌名称"/></view>
<view class="field"><text>品牌介绍</text><input v-model="theme.brand.tagline" maxlength="80" placeholder="一句品牌介绍"/></view>
<view class="asset-row"><image v-if="theme.brand.logo" :src="assetUrl(theme.brand.logo)" mode="aspectFit"/><view v-else class="asset-placeholder">LOGO</view><view><button :disabled="busy" @click="emit('upload',theme.brand,'logo')">上传品牌图</button><button v-if="theme.brand.logo" class="subtle" @click="theme.brand.logo=''">移除</button></view></view>
</Panel>
<Panel title="界面风格" :initial-open="true" summary="固定结构与页面样式">
<view class="field"><text>整体风格</text><Choice v-model="theme.pageStyles.design" :options="[{id:'youku',label:'酷影影院'},{id:'classic',label:'简约经典'}]"/></view>
<view class="field"><text>顶部样式</text><Choice v-model="theme.pageStyles.header" :options="[{id:'search',label:'搜索栏'},{id:'brand',label:'品牌栏'}]"/></view>
<view class="field"><text>我的页面</text><Choice v-model="theme.pageStyles.mine" :options="[{id:'card',label:'分组卡片'},{id:'minimal',label:'简洁列表'}]"/></view>
<view class="field"><text>会员页视觉</text><Choice v-model="theme.pageStyles.member" :options="[{id:'gold',label:'香槟金'},{id:'violet',label:'星光紫'}]"/></view>
</Panel>
<Panel title="卡片与间距" :summary="'全局圆角 '+theme.layout.posterRadius+' px'">
<view class="field"><text>全局海报圆角</text><input type="number" v-model.number="theme.layout.posterRadius"/></view>
<view class="field"><text>页面密度</text><Choice v-model="theme.layout.density" :options="[{id:'comfortable',label:'舒适'},{id:'compact',label:'紧凑'}]"/></view>
</Panel>
</template>
<template v-else-if="tool==='colors'">
<Panel title="配色方案" summary="快速应用，再逐项微调" :initial-open="true"><button v-for="p in palette" :key="p.name" class="palette-row" @click="theme.colors={...p.colors}"><view class="palette-dots"><view v-for="(v,k) in p.colors" :key="k" :style="{background:v}"/></view><text>{{p.name}}</text><text>↗</text></button></Panel>
<Panel title="自定义颜色" summary="支持输入十六进制颜色值" :initial-open="true"><view v-for="(label,key) in {background:'页面背景',surface:'卡片背景',text:'主要文字',muted:'辅助文字',accent:'主题强调色'}" :key="key" class="field color-field"><text>{{label}}</text><view class="color-input"><view class="color-dot" :style="{background:theme.colors[key]}"/><input v-model="theme.colors[key]" maxlength="7"/></view></view></Panel>
</template>
<template v-else-if="tool==='carousel'">
<Panel title="轮播样式" :summary="carouselStyles.find(s=>s[0]===theme.carousel.style)?.[1]" :initial-open="true"><view class="style-grid"><button v-for="[id,name] in carouselStyles" :key="id" :class="{chosen:theme.carousel.style===id}" @click="theme.carousel.style=id"><view class="carousel-mini" :class="id"><view/><view/><view/></view><text>{{name}}</text></button></view></Panel>
<Panel title="尺寸与外观" :summary="theme.carousel.height+' px · 圆角 '+theme.carousel.radius+' px'" :initial-open="true"><view class="fields-two"><view class="field"><text>轮播高度</text><input type="number" v-model.number="theme.carousel.height"/></view><view class="field"><text>圆角</text><input type="number" v-model.number="theme.carousel.radius"/></view></view><view class="field"><text>两侧边距</text><input type="number" v-model.number="theme.carousel.margin"/></view><view class="field"><text>图片填充</text><Choice v-model="theme.carousel.fit" :options="[{id:'cover',label:'铺满裁切'},{id:'contain',label:'完整显示'}]"/></view><view class="field"><text>标题位置</text><Choice v-model="theme.carousel.titlePosition" :options="[{id:'bottom',label:'底部'},{id:'side',label:'侧边'},{id:'hidden',label:'隐藏'}]"/></view></Panel>
<Panel title="播放与指示器" :summary="theme.carousel.autoplay?'自动轮播':'手动轮播'"><view class="toggle-row"><text>自动轮播</text><button class="toggle" :class="{on:theme.carousel.autoplay}" :aria-pressed="theme.carousel.autoplay" @click="theme.carousel.autoplay=!theme.carousel.autoplay"><view/></button></view><view class="field"><text>切换间隔（毫秒）</text><input type="number" v-model.number="theme.carousel.interval"/></view><view class="field"><text>切换效果</text><Choice v-model="theme.carousel.effect" :options="[{id:'slide',label:'平移'},{id:'fade',label:'淡入淡出'}]"/></view><view class="field"><text>指示器</text><Choice v-model="theme.carousel.indicator" :options="[{id:'dots',label:'圆点'},{id:'numbers',label:'数字'},{id:'none',label:'隐藏'}]"/></view></Panel>
<Panel title="轮播素材" :summary="theme.carousel.slides.length+' 张轮播'"><template #actions><button class="small-action" @click="emit('addSlide')">＋</button></template><Panel v-for="(slide,i) in theme.carousel.slides" :key="slide.id" :title="slide.title||'轮播 '+(i+1)" :summary="slide.image?'已有图片':'等待添加图片'"><view class="field"><text>标题</text><input v-model="slide.title" maxlength="80"/></view><view class="field"><text>绑定影片 ID</text><input v-model="slide.vodId"/></view><view class="field"><text>图片地址</text><input v-model="slide.image" placeholder="https://…"/></view><button @click="emit('upload',slide,'image')">上传图片</button><button v-if="theme.carousel.style==='video'" @click="emit('upload',slide,'video',true)">上传视频</button><view class="inline-actions"><button :disabled="i===0" @click="move(theme.carousel.slides,i,-1)">上移</button><button :disabled="i===theme.carousel.slides.length-1" @click="move(theme.carousel.slides,i,1)">下移</button><button class="danger" @click="theme.carousel.slides.splice(i,1)">删除</button></view></Panel></Panel>
</template>
<template v-else-if="tool==='module'&&section">
<Panel title="模块信息" :summary="section.title" :initial-open="true"><view class="field"><text>模块名称</text><input v-model="section.title" maxlength="40"/></view><view class="field"><text>副标题</text><input v-model="section.subtitle" maxlength="80"/></view><view class="toggle-row"><text>显示此模块</text><button class="toggle" :class="{on:section.enabled}" :aria-pressed="section.enabled" @click="section.enabled=!section.enabled"><view/></button></view></Panel>
<Panel title="模块样式" :summary="sectionStyles.find(s=>s[0]===section?.style)?.[1]" :initial-open="true"><view class="style-grid module-style"><button v-for="[id,name] in sectionStyles" :key="id" :class="{chosen:section.style===id}" @click="styleModule(id)"><view class="module-mini" :class="id"><view v-for="n in 6" :key="n"/></view><text>{{name}}</text></button></view></Panel>
<Panel title="尺寸与数量" :summary="section.limit+' 部 · '+section.columns+' 列'" :initial-open="true"><view class="fields-two"><view class="field"><text>影片数量</text><input type="number" v-model.number="section.limit"/></view><view class="field"><text>每行列数</text><input type="number" v-model.number="section.columns"/></view><view class="field"><text>卡片圆角</text><input type="number" v-model.number="section.radius"/></view><view class="field"><text>卡片间距</text><input type="number" v-model.number="section.gap"/></view></view><view class="field"><text>卡片比例</text><Choice v-model="section.ratio" :options="[{id:'2/3',label:'竖版 2:3'},{id:'3/4',label:'竖版 3:4'},{id:'16/9',label:'横版 16:9'}]"/></view></Panel>
<view class="property-note">模块分类与影片来源在运维中心的「页面编排」中配置，当前主题保留已有绑定。</view>
<Panel title="卡片信息" summary="标题、评分与更新状态"><view v-for="[key,label] in [['showTitle','影片名称'],['showScore','评分'],['showNote','更新状态'],['showYear','年份'],['showMore','查看更多']]" :key="key" class="toggle-row"><text>{{label}}</text><button class="toggle" :class="{on:(section as any)[key]!==false}" :aria-pressed="(section as any)[key]!==false" @click="(section as any)[key]=(section as any)[key]===false"><view/></button></view></Panel>
<button class="danger outline" @click="emit('removeModule')">删除当前模块</button>
</template>
<template v-else-if="tool==='navigation'">
<Panel title="导航外观" summary="随当前主题保存" :initial-open="true"><view class="field"><text>底部导航样式</text><Choice v-model="theme.pageStyles.navigation" :options="[{id:'icons',label:'图标与文字'},{id:'text',label:'纯文字'}]"/></view></Panel>
<view class="property-note">首页分类、底部导航的名称、图标、排序、显示开关和页面跳转，在运维中心的「导航与分类绑定」中管理。</view>
</template>
<template v-else-if="tool==='festival'">
<Panel title="节日装饰" :summary="theme.festival.enabled?'已启用装饰':'日常主题'" :initial-open="true"><view class="toggle-row"><text>装饰效果</text><button class="toggle" :class="{on:theme.festival.enabled}" :aria-pressed="theme.festival.enabled" @click="theme.festival.enabled=!theme.festival.enabled"><view/></button></view><view class="field"><text>装饰样式</text><Choice v-model="theme.festival.kind" :options="[{id:'none',label:'无装饰'},{id:'spring',label:'新春'},{id:'christmas',label:'圣诞'},{id:'midautumn',label:'中秋'}]"/></view></Panel>
<view class="property-note">装饰随当前主题包保存，运营中心可选择使用这套主题。</view>
</template>
<template v-else-if="tool==='startup'">
<Panel title="品牌开机页" :summary="theme.startup.enabled?'已启用':'未启用'" :initial-open="true"><view class="toggle-row"><text>显示品牌开机页</text><button class="toggle" :class="{on:theme.startup.enabled}" :aria-pressed="theme.startup.enabled" @click="theme.startup.enabled=!theme.startup.enabled"><view/></button></view><view class="field"><text>背景颜色</text><input v-model="theme.startup.background"/></view><view class="field"><text>停留时间（秒）</text><input type="number" v-model.number="theme.startup.duration"/></view><view class="field"><text>背景图片</text><input v-model="theme.startup.image" placeholder="https://…"/></view><button @click="emit('upload',theme.startup,'image')">上传开机图片</button><button class="primary outline" @click="emit('startup')">在画布中查看</button></Panel>
</template>
<view v-else class="property-note">选择左侧页面或画布中的模块，编辑它的设计属性。</view>
</view>
</template>
