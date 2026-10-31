<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import type {Vod} from '@/domain/types';
import AppIcon from './AppIcon.vue';
import EpisodeVipBadge from './EpisodeVipBadge.vue';
const props=defineProps<{film:Vod;source:number;episode:number;colors:{muted:string;text:string}}>();
const emit=defineEmits<{episode:[index:number]}>();
const expanded=ref(false);
const episodes=computed(()=>props.film.sources[props.source]?.episodes||[]);
watch(()=>props.film.id,()=>{expanded.value=false;});
function chooseEpisode(index:number){expanded.value=false;emit('episode',index);}
</script>
<template>
 <view v-if="film.sources.length" class="episode-list">
  <view class="episode-heading"><text>选集</text><text class="episode-note">{{film.note}}</text><button class="all-episodes" aria-label="打开全部选集" @click="expanded=true">全部 <AppIcon name="chevron" :size="12" :color="colors.muted"/></button></view>
  <scroll-view scroll-x class="episode-scroll" :show-scrollbar="false" :scroll-into-view="'detail-episode-'+episode"><view class="episode-row"><button v-for="(row,index) in episodes" :id="'detail-episode-'+index" :key="index" :class="{chosen:episode===index}" :aria-label="'播放'+row.name" @click="chooseEpisode(index)"><text class="episode-label">{{row.name}}</text><EpisodeVipBadge v-if="row.vip===true"/></button></view></scroll-view>
  <view v-if="!episodes.length" class="episode-empty">暂无可播放集数。</view>
  <view v-if="expanded" class="episode-mask" @click="expanded=false"><view class="episode-sheet" role="dialog" aria-label="全部选集" @click.stop><view class="sheet-head"><text>{{film.title}}</text><button aria-label="关闭全部选集" @click="expanded=false"><AppIcon name="close" :size="18" :color="colors.text"/></button></view><scroll-view scroll-y class="sheet-scroll"><view class="episode-grid"><button v-for="(row,index) in episodes" :key="index" :class="{chosen:episode===index}" :aria-label="'播放'+row.name" @click="chooseEpisode(index)"><text class="episode-label">{{row.name}}</text><EpisodeVipBadge v-if="row.vip===true"/></button></view><text v-if="!episodes.length" class="episode-empty">暂无可播放集数。</text></scroll-view></view></view>
 </view>
</template>
<style scoped>
.episode-heading{display:flex;align-items:center;gap:8px;font-size:14px;padding:15px 0 8px}.episode-note{flex:1;font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.all-episodes,.sheet-head button{padding:0;margin:0;background:transparent;color:var(--muted);font-size:10px;line-height:24px;display:flex;align-items:center;gap:2px;border:0;flex-shrink:0}.all-episodes::after,.sheet-head button::after,.episode-row>button::after,.episode-grid>button::after{border:0}.episode-scroll{width:100%;white-space:nowrap}.episode-row{display:flex;align-items:stretch;gap:6px;padding:7px 0;min-width:max-content}.episode-row>button,.episode-grid>button{position:relative;margin:0;padding:8px 11px 0;color:var(--muted);background:var(--surface);border:0;border-radius:7px;font-size:11px;line-height:34px;flex-shrink:0;white-space:nowrap;box-sizing:border-box}.episode-row>button{min-width:48px}.episode-label{display:block;overflow:hidden;text-overflow:ellipsis}.episode-row>.chosen,.episode-grid>.chosen{color:var(--accent);background:var(--surface)}.episode-empty{padding:12px 0;font-size:11px;color:var(--muted)}.episode-mask{position:absolute;inset:0;z-index:75;background:#0009;display:flex;align-items:flex-end}.episode-sheet{width:100%;max-height:65%;display:flex;flex-direction:column;background:var(--bg);border-radius:12px 12px 0 0;padding:16px 12px;box-sizing:border-box}.sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;padding-bottom:12px}.sheet-head>text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sheet-scroll{max-height:320px}.episode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.episode-grid>button{width:100%;min-width:0;padding:8px 4px 0}
</style>
