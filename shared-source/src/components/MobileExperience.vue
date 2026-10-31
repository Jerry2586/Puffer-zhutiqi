<script setup lang="ts">
import {computed} from 'vue';
import type {Theme,Vod,Category,Section,AppPage,NavItem,AppLink} from '@/domain/types';
import {pageDesignFor,categoryPageKey,fixedModule,normalizeVisual} from '@/domain/visual';
import {skeletonBlocks,type SkeletonBlock} from '@/domain/skeleton';
import {available} from '@/domain/presentation';
import {categoryRoot} from '@/domain/category';
import {categoryShortcuts} from '@/domain/category-shortcuts';
import {assetUrl} from '@/services/api';
import AppIcon from './AppIcon.vue';
import PufferMark from './PufferMark.vue';
import ThemeCarousel from './ThemeCarousel.vue';
import FilmModule from './FilmModule.vue';
import CampaignPage from './CampaignPage.vue';
import MobileEpisodeList from './MobileEpisodeList.vue';
import EpisodeVipBadge from './EpisodeVipBadge.vue';
const props=withDefaults(defineProps<{
 theme:Theme;page:AppPage;layoutPage?:string;items:Vod[];categories:Category[];sections:Section[];
 sectionItems:Record<string,Vod[]>;categoryEntry?:string;categoryId?:string;rootCategoryId?:string;editing?:boolean;studio?:boolean;
 film:Vod|null;playerPreview?:boolean;playUrl:string;source:number;episode:number;
 favorite:boolean;loading:boolean;profile?:{user_name?:string;user_points?:number;member_name?:string}|null;
 history:Vod[];services:{page:AppPage;label:string;icon:string}[];
}>(),{categoryEntry:'',playerPreview:false});
const emit=defineEmits<{
 select:[id:string];navigate:[page:AppPage];category:[item:NavItem];filter:[id:string];open:[item:Vod];id:[id:string];
 previewPlayer:[];play:[];episode:[index:number];ended:[];videoError:[];
 remember:[];close:[];favorite:[];account:[membership:boolean];menu:[];browse:[id?:string];shortcut:[link:AppLink];
}>();
const visual=computed(()=>normalizeVisual(props.theme.visual,props.theme.colors));
const pageKey=computed(()=>props.page==='category'&&props.categoryEntry?categoryPageKey(props.categoryEntry):props.page);
const layout=computed(()=>pageDesignFor(props.theme,pageKey.value));
const campaign=computed(()=>!props.film&&!props.playerPreview&&props.page==='category'?layout.value.campaign:undefined);
const blocks=computed(()=>skeletonBlocks(props.theme,props.film||props.playerPreview?(props.layoutPage||'player'):pageKey.value).filter(b=>b.visible!==false&&(!campaign.value||['header','channels'].includes(b.component))));
function blockRows(block:SkeletonBlock){return block.sectionId?rows.value.filter(s=>s.id===block.sectionId):rows.value;}
const shortcuts=computed(()=>categoryShortcuts(props.theme,layout.value,rootCategory.value,props.categoryEntry));
const rootCategory=computed(()=>props.rootCategoryId??(props.page==='shortdrama'?props.theme.categories.find(n=>n.enabled&&n.page==='shortdrama')?.categoryId||'':categoryRoot(props.theme,props.categoryEntry)));
const channels=computed(()=>props.theme.categories.filter(n=>n.enabled&&available(props.theme,n.page)));
const rows=computed(()=>{
 const fallbackId=props.page==='home'?'home-content':'category-content';
 const fallback=fixedModule(props.theme,pageKey.value,fallbackId);
 const rows=(props.sections.length?props.sections:[fallback]).filter(s=>s.enabled);
 const order=layout.value.moduleOrder||[];
 const rank=(id:string,index:number)=>order.includes(id)?order.indexOf(id):order.length+index;
 return rows.map((s,i)=>({s,rank:rank(s.id,i)})).sort((a,b)=>a.rank-b.rank).map(r=>r.s);
});
const carouselOrder=computed(()=>{const order=layout.value.moduleOrder||[];const i=order.indexOf('carousel');return i<0?-1:i;});
const episodes=computed(()=>props.film?.sources[props.source]?.episodes||[]);
const recommendations=computed(()=>props.items.filter(v=>v.id!==props.film?.id));
function moduleItems(s:Section){if(s.id==='category-content')return props.items;if(s.source==='category'||s.orderBy==='manual')return props.sectionItems[s.id]||[];return props.page==='category'?props.items:(props.sectionItems[s.id]||props.items);}
function select(id:string,action:()=>void){if(props.editing)emit('select',id);else action();}
</script>
<template>
<view class="reference-app" :class="{'home-page':page==='home','player-page':!!film||playerPreview}">
 <slot name="status"/>
 <view v-for="block in blocks" :key="block.id" class="skeleton-region" @click="editing&&emit('select',block.id)" :class="{'play-info':['filmInfo','episodes','recommendations'].includes(block.component)}" :data-region="block.id" :style="{paddingBottom:(block.gap||0)+'px'}">
 <template v-if="block.component==='player'">
  <view class="video-frame" @click="editing&&emit('select','visual-player')">
   <video v-if="film&&playUrl" class="real-video" :key="film.id+'-'+source+'-'+episode" :src="playUrl" :poster="assetUrl(film.poster)" :title="film.title" autoplay controls object-fit="contain" :show-fullscreen-btn="true" :enable-progress-gesture="true" @play="emit('remember')" @ended="emit('ended')" @error="emit('videoError')"/>
   <template v-else>
    <image v-if="film?.poster" class="player-scene" :src="assetUrl(film.poster)" mode="aspectFill"/>
    <view class="video-shade"/>
    <button class="video-center" :disabled="loading||!film" aria-label="播放影片" @click="emit('play')"><AppIcon name="play" :size="40" :color="String(visual.empty.color)"/><text>{{loading?'正在读取':film?'播放':'播放器排版预览'}}</text></button>
   </template>
   <view class="video-top"><button aria-label="返回影片列表" @click="emit('close')"><AppIcon name="back" :size="23" :color="String(visual.player.controls)"/></button><text class="player-caption">{{film?.title||'播放器'}} {{episodes[episode]?.name||''}}</text></view>
   <view class="player-watermark"><image v-if="theme.brand.logo" :src="assetUrl(theme.brand.logo)" mode="aspectFit"/><text>{{theme.brand.name}}</text></view>
  </view>
 </template>
 <template v-if="block.component==='filmInfo'">
   <view class="info-tabs"><text class="active">视频</text><text>影片信息</text><view class="spacer"/><button v-if="playUrl" @click="emit('close')">返回 ›</button></view>
   <view class="title-row"><text class="film-title">{{film?.title||'影片标题'}}</text></view>
   <view v-if="film" class="metadata"><text v-for="(tag,i) in [film.score&&film.score+'分',film.year,film.area,film.category,film.note].filter(Boolean)" :key="i">{{tag}}</text></view>
   <view v-else class="metadata layout-metadata" data-player-layout><text v-for="tag in ['评分','年份','地区','分类','更新状态']" :key="tag">{{tag}}</text></view><view class="film-actions"><button :disabled="!film" @click="select('visual-cards',()=>emit('favorite'))"><AppIcon name="favorite" :size="24" :color="favorite?theme.colors.accent:theme.colors.text"/><text>{{favorite?'已收藏':'收藏'}}</text></button><button @click="select('visual-cards',()=>emit('navigate','history'))"><AppIcon name="history" :size="24" :color="theme.colors.text"/><text>观看历史</text></button></view>
   <text class="film-description">{{film?.description||(film?'暂无影片简介':'影片简介区域 · 接入后显示真实内容')}}</text>
   <text v-if="film?.actors" class="film-description">主演：{{film.actors}}</text>
   <text v-if="film?.director" class="film-description">导演：{{film.director}}</text>
 </template>
 <template v-if="block.component==='episodes'">
   <MobileEpisodeList v-if="film" :film="film" :source="source" :episode="episode" :colors="theme.colors" @episode="emit('episode',$event)"/>
   <view v-else class="episode-layout" data-episode-layout><view class="episode-layout-heading"><text>选集</text><text>VIP 角标示意 · 以运营配置为准</text></view><view class="episode-layout-strip"><view v-for="n in 6" :key="n" class="episode-layout-slot"><text>选集</text><EpisodeVipBadge v-if="n>2"/></view></view></view>
 </template>
 <template v-if="block.component==='recommendations'">
   <FilmModule v-if="recommendations.length||studio||editing" :layout-preview="studio||editing" @preview="emit('previewPlayer')" :theme="theme" :section="{...fixedModule(theme,'home','home-content'),title:'相关推荐',showMore:false}" :items="recommendations" :editing="editing" @select="emit('select',$event)" @open="emit('open',$event)"/>
 </template>
 <template v-if="block.component==='profileHeader'">
  <view class="profile-top"><view class="spacer"/><button aria-label="观看历史" @click="select('visual-appbar',()=>emit('navigate','history'))"><AppIcon name="history" :size="22" :color="theme.colors.text"/></button><button aria-label="应用设置" @click="select('visual-appbar',()=>emit('navigate','settings'))"><AppIcon name="settings" :size="22" :color="theme.colors.text"/></button></view>
 </template>
 <template v-if="block.component==='profile'">
  <view class="membership"><button class="profile-identity" aria-label="打开账户" @click="select('visual-cards',()=>emit('account',false))"><view class="avatar"><image v-if="theme.brand.logo" :src="assetUrl(theme.brand.logo)" mode="aspectFit"/><PufferMark v-else :size="35" :color="theme.colors.accent"/></view><view class="profile-copy"><text class="profile-name">{{profile?.user_name||'登录 / 注册'}}</text><text class="coins">积分 {{profile?.user_points??'—'}}</text></view><text class="profile-chevron" aria-hidden="true">›</text></button><view v-if="theme.features.memberCard" class="vip-bottom"><view class="vip-description"><text class="vip-heading">{{profile?.member_name||'VIP 会员'}}</text><text class="vip-caption">专属权益</text></view><button class="gold-button" @click.stop="select('visual-cards',()=>emit('account',true))">{{profile?'立即续费':'开通会员'}}</button></view></view>
 </template>
 <template v-if="block.component==='shortcuts'">
  <view class="profile-shortcuts"><button @click="select('visual-cards',()=>emit('navigate','history'))"><AppIcon name="history" :size="25" :color="theme.colors.text"/><text>观看历史</text></button><button @click="select('visual-cards',()=>emit('navigate','library'))"><AppIcon name="favorite" :size="25" :color="theme.colors.text"/><text>我的收藏</text></button><button v-if="theme.features.schedule" @click="select('visual-cards',()=>emit('navigate','schedule'))"><AppIcon name="schedule" :size="25" :color="theme.colors.text"/><text>影片排期</text></button><button @click="select('visual-cards',()=>emit('navigate','category'))"><AppIcon name="menu" :size="25" :color="theme.colors.text"/><text>影片分类</text></button></view>
 </template>
 <template v-if="block.component==='history'">
  <view v-if="history.length" class="history-list"><button v-for="v in history.slice(0,6)" :key="v.id" @click="select('visual-cards',()=>emit('open',v))"><view class="history-cover"><image :src="assetUrl(v.poster)" mode="aspectFill"/></view><text class="history-caption">{{v.title}}</text></button></view><text v-else class="profile-note">暂无观看记录，看过的影片会保存在这里</text>
 </template>
 <template v-if="block.component==='services'">
  <view class="profile-services"><button v-for="s in services" :key="s.page" @click="select('visual-cards',()=>s.page==='member'?emit('account',true):emit('navigate',s.page))"><AppIcon :name="s.icon" :size="23" :color="theme.colors.text"/><text>{{s.label}}</text><text>›</text></button></view>
 </template>
 <template v-if="block.component==='header'">
  <view class="category-search"><button v-if="theme.features.serviceMenu" aria-label="打开服务菜单" @click="select('visual-appbar',()=>emit('menu'))"><AppIcon name="menu" :size="20" :color="String(visual.appbar.text)"/></button><button class="search-box" @click="select('visual-appbar',()=>emit('navigate','search'))"><AppIcon name="search" :size="15" :color="String(visual.input.text)"/><text>搜索影片</text></button></view>
 </template>
 <template v-if="block.component==='channels'">
  <view class="channel-tabs"><button v-for="n in channels" :key="n.id" :class="{active:page==='home'?n.page==='home':n.id===categoryEntry}" @click="select('categories',()=>emit('category',n))">{{n.label}}</button></view>
 </template>
 <template v-if="block.component==='filters'">
  <scroll-view v-if="page==='category'" scroll-x :show-scrollbar="false" class="shortcut-scroll" aria-label="分类快捷入口"><view class="category-filters"><button @click="select('filters',()=>emit('browse',rootCategory))"><AppIcon name="category" :size="14" :color="theme.colors.muted"/><text>全部</text></button><button v-for="link in shortcuts" :key="link.id" @click="select('filters',()=>emit('shortcut',link))"><AppIcon :name="link.icon||link.page" :size="14" :color="theme.colors.muted"/><text>{{link.label}}</text></button><text v-if="editing&&!shortcuts.length">点击配置快捷入口</text></view></scroll-view>
 </template>
 <template v-if="block.component==='carousel'">
   <ThemeCarousel v-if="layout.carousel!==false" :page="page" class="page-carousel" :style="{order:carouselOrder}" :theme="theme" :items="items" :layout-preview="studio||editing" native-mobile :editing="editing" @open="emit('open',$event)" @id="emit('id',$event)" @page="emit('navigate',$event as AppPage)" @select="emit('select',$event)"/>
 </template>
 <template v-if="block.component==='content'">
   <FilmModule v-for="(s,index) in blockRows(block)" :key="s.id" :style="{order:(layout.moduleOrder||[]).includes(s.id)?layout.moduleOrder!.indexOf(s.id):(layout.moduleOrder||[]).length+index}" :theme="theme" :section="{...s,showMore:false}" :items="moduleItems(s)" :layout-preview="studio||editing" :editing="editing" @preview="emit('previewPlayer')" @open="emit('open',$event)" @select="emit('select',$event)"/>
 </template>
 <slot v-if="block.component==='notice'" name="home-notice"/>
 <template v-if="block.component==='ads'"><slot v-if="film||playerPreview" name="player-ads"/><slot v-else-if="page==='mine'" name="mine-ads"/><slot v-else name="catalog-footer"/></template>
 </view>
 <CampaignPage v-if="campaign" :design="campaign" :theme="theme" :items="items" :sections="theme.sections" :section-items="sectionItems" :editing="editing" @open="emit('open',$event)" @id="emit('id',$event)" @navigate="emit('navigate',$event)" @select="emit('select','categories')"/>
</view>
</template>
<style scoped>
.reference-app{min-height:100%;color:var(--text);font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Microsoft YaHei',sans-serif;background:transparent}.reference-app button{padding:0;margin:0;border:0;background:transparent;color:inherit;font:inherit;line-height:1.4;cursor:pointer;min-width:0;border-radius:0}.reference-app button::after{border:0}.reference-app button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.reference-app button:active{opacity:.7}.reference-app image{display:block;width:100%;height:100%}.spacer{flex:1}.page-modules{display:flex;flex-direction:column}.page-carousel{min-width:0}
.category-search,.profile-top{box-sizing:border-box;min-height:var(--design-appbar-height);color:var(--design-appbar-text);background:linear-gradient(90deg,var(--design-appbar-background),var(--design-appbar-end))}.category-search{display:flex;gap:12px;align-items:center;min-height:clamp(52px,var(--design-appbar-height),64px);padding:10px 20px 8px}.category-search>button{display:flex;align-items:center}.category-search>button:not(.search-box){justify-content:center;width:36px;height:40px;flex-shrink:0}.reference-app .search-box{flex:1;max-width:280px;height:36px;min-height:0;background:var(--design-input-background);border:1px solid var(--mobile-line,#80808018);border-radius:10px;padding:0 12px;display:flex;gap:7px;color:var(--design-input-text);font-size:13px;font-weight:400;box-sizing:border-box}.search-box>text:first-of-type{flex:1;text-align:left;white-space:nowrap;overflow:hidden}.search-filter{border-left:1px solid var(--mobile-line,#80808018);padding-left:6px;font-size:10px}.channel-tabs{display:flex;gap:var(--design-directory-gap);min-height:var(--design-directory-height);background:var(--design-directory-background);align-items:center;overflow:auto;white-space:nowrap;padding:0 18px;scrollbar-width:none}.channel-tabs button{color:var(--design-directory-text);font-size:var(--design-directory-size);flex:none}.channel-tabs .active{font-weight:650;font-size:var(--design-directory-activeSize);color:var(--design-directory-active)}
.shortcut-scroll{display:block;width:100%;min-width:0}.category-filters{display:flex;gap:7px;padding:10px 18px 14px;white-space:nowrap;scrollbar-width:none}.category-filters button{display:flex;align-items:center;justify-content:center;gap:5px;flex:none;margin:0;color:var(--text);background:var(--surface);border:1px solid var(--mobile-line,#8090ac20);border-radius:7px;padding:0 11px;font-size:12px;font-weight:500;line-height:32px;min-height:32px}.category-filters button::after{border:0}.category-filters button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.category-filters button.active{color:var(--accent);border-color:var(--accent)}
.video-frame{position:relative;background:var(--design-player-background);color:var(--design-player-controls);aspect-ratio:1.78}.real-video{width:100%;height:100%;position:absolute;inset:0}.player-scene,.video-shade{position:absolute;inset:0}.video-shade{background:linear-gradient(#0008,transparent 38%,transparent 65%,#000b)}.video-top{position:absolute;left:8px;right:8px;top:7px;display:flex;align-items:center;gap:9px}.video-top{pointer-events:none;z-index:2}.video-top button{pointer-events:auto;display:grid;place-items:center;width:24px;height:30px}.video-center{position:absolute;inset:45px 0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;width:100%;color:var(--design-empty-color)}.player-caption{font-size:calc(var(--design-appbar-size) - 6px)}.player-watermark{display:flex;align-items:center;gap:5px;position:absolute;right:14px;bottom:58px;font-size:12px;color:var(--design-player-controls);opacity:calc(var(--design-player-watermarkOpacity) / 100);pointer-events:none}.reference-app .player-watermark image{width:28px;height:28px}.play-info{padding:0 13px 24px;color:var(--design-cards-text)}.info-tabs{display:flex;align-items:center;gap:13px;padding:10px 0 15px;color:var(--design-cards-muted);font-size:14px}.info-tabs .active{font-weight:650;color:var(--design-cards-text)}.title-row{display:flex;align-items:center;gap:9px}.film-title{font-size:calc(var(--design-cards-size) + 5px);font-weight:700}.metadata{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;font-size:12px;color:var(--design-cards-muted)}.metadata>text{background:#8882;border-radius:20px;padding:2px 6px}.film-actions{display:flex;justify-content:space-around;margin:20px 0 18px}.film-actions button{display:flex;align-items:center;flex-direction:column;gap:5px}.film-description{display:block;font-size:14px;line-height:1.8;color:var(--design-cards-muted);margin-bottom:10px}
.profile-top{display:flex;gap:14px;align-items:center;padding:16px 18px}.profile-top button{display:flex}.membership{margin:4px 18px 12px;padding:18px 18px 0;color:#fff;box-sizing:border-box;border-radius:18px;overflow:hidden;background:linear-gradient(120deg,#30243f 0%,#493065 55%,#694193 100%);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 24%,#24202e) 0%,color-mix(in srgb,var(--accent) 46%,#30243f) 55%,color-mix(in srgb,var(--accent) 76%,#4a3264) 100%);border:1px solid #ffffff14;box-shadow:0 8px 24px #24143712}.reference-app .profile-identity{display:flex;gap:12px;align-items:center;width:100%;padding:0 0 18px;text-align:left;color:#fff}.reference-app .avatar{display:grid;place-items:center;width:50px;height:50px;border:2px solid #ffffff70;box-sizing:border-box;border-radius:50%;overflow:hidden;flex:none;background:#fff;box-shadow:0 3px 10px #160c2520}.profile-copy{display:flex;align-items:flex-start;flex-direction:column;gap:7px;min-width:0}.profile-name{font-size:18px;line-height:1.35;font-weight:650;letter-spacing:-.3px;overflow-wrap:anywhere}.coins{padding:3px 8px;border-radius:20px;background:#ffffff12;font-size:11px;line-height:1.4;color:#ffffffc7}.profile-chevron{margin-left:auto;font-size:24px;font-weight:300;color:#ffffff80}.vip-bottom{display:flex;align-items:center;justify-content:space-between;padding:14px 0 16px;gap:12px;border-top:1px solid #ffffff1c}.vip-description{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}.vip-heading{font-size:15px;line-height:1.4;font-weight:650;letter-spacing:.2px;color:#f4dfbd}.vip-caption{font-size:11px;color:#ffffffa8}.reference-app .gold-button{min-height:34px;background:linear-gradient(110deg,#f6e6ce,#f2d8ac);color:#49364c;border:1px solid #fff4;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:650;white-space:nowrap;flex:none;box-shadow:0 2px 6px #190d2412}.profile-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:16px 18px}.profile-shortcuts button{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px}.history-list{display:flex;overflow:auto;gap:7px;padding:8px 0 10px;border-top:1px solid var(--mobile-line,#8881);scrollbar-width:none}.history-list>button{width:30%;min-width:115px;text-align:left;flex:none;overflow:hidden}.history-cover{height:65px;overflow:hidden;border-radius:var(--design-cards-radius)}.history-caption{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:5px}.profile-note{display:block;color:var(--muted);font-size:11px;padding:18px 12px;text-align:center}.profile-services{padding:8px 18px 24px}.profile-services button{display:flex;align-items:center;gap:12px;width:100%;padding:17px 0;border-bottom:1px solid var(--mobile-line,#8882)}.profile-services button>text:first-of-type{flex:1;text-align:left}
.layout-metadata{opacity:.72}.reference-app button:disabled{cursor:default;opacity:.55}.episode-layout{padding:2px 0 8px}.episode-layout-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;font-size:14px;font-weight:600}.episode-layout-heading>text:last-child{font-size:10px;font-weight:400;color:var(--muted)}.episode-layout-strip{display:flex;gap:8px;overflow:hidden}.episode-layout-slot{position:relative;padding-top:8px;box-sizing:border-box;display:grid;place-items:center;flex:0 0 48px;height:42px;border-radius:8px;background:var(--surface);border:1px solid var(--border,#80808020);font-size:11px;color:var(--muted)}
</style>
