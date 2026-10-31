<script setup lang="ts">
import {computed,getCurrentInstance,onUnmounted,ref,watch} from 'vue';
import type {AppPage,Vod} from '@/domain/types';
import {validPlaybackAddress} from '@/domain/playback';
import {nativeRuntime} from '@/services/client-runtime';
import {api,assetUrl} from '@/services/api';
import {remember} from '@/services/library';
import AppIcon from './AppIcon.vue';
import ShortDramaVideo from './ShortDramaVideo.vue';
import AppEmptyState from './AppEmptyState.vue';
const props=defineProps<{item?:Vod;bound:boolean;loading:boolean;favorite:boolean;ranking:boolean;editing?:boolean;demo?:boolean;blocked?:boolean;feedError?:string}>();
const emit=defineEmits<{navigate:[page:AppPage];step:[by:number];favorite:[];select:[]}>();
const detail=ref<Vod|null>(null),source=ref(0),episode=ref(0),url=ref(''),pending=ref(false),error=ref(''),picker=ref(false),muted=ref(true),playing=ref(false);
const episodes=computed(()=>detail.value?.sources[source.value]?.episodes||[]);
const video=ref<{play:()=>void;pause:()=>void}|null>(null);let generation=0,touchY=0,touchX=0;
const mediaToken=ref(0);let detailRequest:{id:string;promise:Promise<Vod|null>}|null=null;
const videoId='hetun-short-'+getCurrentInstance()?.uid;
watch(()=>[props.item?.id,props.blocked,props.editing],()=>{generation++;mediaToken.value++;detailRequest=null;detail.value=null;source.value=0;episode.value=0;url.value='';pending.value=false;error.value='';picker.value=false;playing.value=false;if(props.item&&!props.blocked&&!props.editing)playSelected();},{immediate:true});
onUnmounted(()=>{generation++;mediaToken.value++;});
async function resolveDetail(){
 if(detail.value?.id===props.item?.id)return detail.value;
 if(!props.item||props.blocked)return null;
 if(detailRequest?.id===props.item.id)return detailRequest.promise;
 if(props.editing){emit('select');return null;}
 if(props.demo){error.value='请连接内容服务后观看短剧。';return null;}
 const token=++generation,id=props.item.id;pending.value=true;error.value='';
 const promise=(async()=>{try{const response=await api.catalog(1,'','',id);if(token!==generation||props.item?.id!==id)return null;
  const result=response.items.find(v=>v.id===id);if(!result)throw new Error('该短剧已下架或暂不可用。');detail.value=result;return result;
 }catch(e){if(token===generation){error.value=(e as Error).message;detailRequest=null;}return null;}
 finally{if(token===generation)pending.value=false;}
 })();detailRequest={id,promise};return promise;
}
async function playSelected(){
 if(props.blocked)return;
 const film=await resolveDetail();if(!film)return;
 mediaToken.value++;const token=++generation;url.value='';playing.value=false;pending.value=false;error.value='';
 if(!episodes.value[episode.value]){error.value='当前短剧没有可播放集数。';return;}
 const id=film.id,sid=source.value,nid=episode.value;pending.value=true;
 try{const response=await api.playback(id,sid+1,nid+1);if(token!==generation||props.item?.id!==id)return;
  if(!validPlaybackAddress(response.url,import.meta.env.VITE_HETUN_THEME_DESKTOP==='1',!!nativeRuntime()))throw new Error('播放地址不受支持。');url.value=response.url;
 }catch(e){if(token===generation)error.value=(e as Error).message;}
 finally{if(token===generation)pending.value=false;}
}
async function chooseEpisodes(){if(await resolveDetail())picker.value=true;}
function chooseEpisode(index:number){episode.value=index;picker.value=false;playSelected();}
function playbackStarted(token:number){if(token!==mediaToken.value)return;playing.value=true;if(detail.value)remember(detail.value);}
function playbackError(token:number){if(token!==mediaToken.value)return;playing.value=false;error.value='视频加载失败，请重试或切换集数。';}
function togglePlayback(){if(!url.value){playSelected();return;}if(playing.value)video.value?.pause();else video.value?.play();}
function ended(token:number){if(token!==mediaToken.value)return;playing.value=false;if(episode.value+1<episodes.value.length){episode.value++;playSelected();}}
function touchStart(e:any){touchY=e.changedTouches?.[0]?.clientY||0;touchX=e.changedTouches?.[0]?.clientX||0;}
function touchEnd(e:any){const delta=(e.changedTouches?.[0]?.clientY||0)-touchY;const dx=(e.changedTouches?.[0]?.clientX||0)-touchX;if(Math.abs(delta)>65&&Math.abs(delta)>Math.abs(dx)*1.5&&!picker.value)emit('step',delta>0?-1:1);}
</script>
<template>
 <view class="shortdrama" @touchstart="touchStart" @touchend="touchEnd">
  <image v-if="item&&!url" class="short-cover" :src="assetUrl(item.poster)" mode="aspectFill"/>
  <ShortDramaVideo v-if="url" ref="video" :id="videoId+'-'+mediaToken" :key="mediaToken" :token="mediaToken" :url="url" :title="item?.title" :muted="muted" @play="playbackStarted" @pause="token=>{if(token===mediaToken)playing=false}" @ended="ended" @error="playbackError"/>
  <view class="short-gradient"/>
  <view class="short-tabs" @touchstart.stop @touchend.stop><text @click="emit('navigate','history')">看过</text><text class="active">短剧</text><text v-if="ranking" @click="emit('navigate','ranking')">排行榜</text><text @click="emit('navigate','category')">剧场</text><view role="button" aria-label="搜索短剧" @click="emit('navigate','search')"><AppIcon name="search" :size="23" color="#ffffff"/></view></view>
  <view v-if="item&&!url" class="short-center" role="button" aria-label="播放短剧" @click="playSelected"><AppIcon name="play" :size="48" color="#ffffff"/></view>
  <view v-if="item" class="short-actions" @touchstart.stop @touchend.stop>
   <view role="button" aria-label="收藏短剧" @click="emit('favorite')"><AppIcon name="favorite" :size="29" :color="favorite?'#ffe08c':'#ffffff'"/><text>{{favorite?'已收藏':'收藏'}}</text></view>
   <view v-if="url" role="button" aria-label="切换短剧声音" @click="muted=!muted"><text class="short-action-label">{{muted?'静音':'有声'}}</text></view>
   <view v-if="url" role="button" aria-label="切换短剧播放状态" @click="togglePlayback"><text class="short-action-label">{{playing?'暂停':'播放'}}</text></view>
   <view role="button" aria-label="下一部短剧" @click="emit('step',1)"><AppIcon name="chevron" :size="29" color="#ffffff"/><text>下一部</text></view>
  </view>
  <AppEmptyState v-if="!item&&!loading" class="short-empty" :title="feedError?'短剧暂时无法加载':bound?'暂无短剧内容':'短剧暂未开放'" :description="feedError||(bound?'暂时没有可观看的短剧，稍后再来看看':'开放后可在这里直接观看短剧')"/>
  <view v-if="pending||loading" class="short-message">正在加载…</view>
  <view v-if="error" class="short-error" @touchstart.stop @touchend.stop><text>{{error}}</text><text @click="playSelected">重试</text></view>
  <view v-if="item" class="short-overlay" @touchstart.stop @touchend.stop><text class="short-author">{{item.title}}</text><text class="short-description">{{item.description||'查看分集，继续观看'}}</text><view class="short-episodes" role="button" aria-label="短剧选集" @click="chooseEpisodes"><text>▶ {{url?episodes[episode]?.name:item.note||'观看 / 选集'}}</text><text>选集 ›</text></view></view>
  <view v-if="picker" class="short-picker-mask" @touchstart.stop @touchend.stop @click="picker=false"><view class="short-picker" role="dialog" aria-label="短剧选集面板" @click.stop><view class="picker-heading"><text>{{item?.title}}</text><text role="button" aria-label="关闭短剧选集" @click="picker=false">关闭</text></view><scroll-view scroll-y class="picker-scroll"><view class="short-episode-chips"><text v-for="(row,index) in episodes" :key="index" role="button" :aria-label="'播放短剧'+row.name" :class="{chosen:episode===index}" @click="chooseEpisode(index)">{{row.name}}</text></view><text v-if="!episodes.length">当前短剧没有可播放集数。</text></scroll-view></view></view>
 </view>
</template>
<style scoped>
.shortdrama{flex:1;min-height:450px;height:100%;position:relative;overflow:hidden;background:#111;color:#fff}
.short-cover,.short-gradient{position:absolute;inset:0;width:100%;height:100%}.short-gradient{background:linear-gradient(#0008,transparent 26%,transparent 54%,#000b);pointer-events:none}
.short-tabs{position:absolute;top:12px;left:16px;right:16px;display:flex;align-items:center;gap:14px;font-size:14px;color:#ffffffb3;z-index:2}.short-tabs>text,.short-tabs>view{cursor:pointer;min-height:44px;display:flex;align-items:center}.short-tabs .active{font-size:14px;color:#fff;font-weight:600}.short-tabs>view{margin-left:auto}
.short-center{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);cursor:pointer;opacity:.8}.short-actions{position:absolute;right:12px;bottom:125px;display:flex;flex-direction:column;gap:18px}.short-actions>view{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer}.short-actions text{font-size:9px}.short-actions .short-action-label{font-size:11px;padding:6px 4px;background:#0005;border-radius:3px}
.short-overlay{position:absolute;left:18px;right:66px;bottom:24px;display:flex;flex-direction:column;gap:7px;pointer-events:none}.short-author{font-size:17px;font-weight:600}.short-description{font-size:13px;line-height:20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.short-episodes{display:flex;justify-content:space-between;padding:12px;background:#ffffff20;font-size:13px;border-radius:10px;pointer-events:auto;cursor:pointer}
.short-empty{position:absolute;left:10px;right:10px;top:30%}.short-message{position:absolute;top:45%;width:100%;text-align:center;font-size:12px;pointer-events:none}.short-error{position:absolute;top:52%;left:24px;right:24px;display:flex;flex-direction:column;align-items:center;gap:12px;font-size:12px;background:#000b;padding:14px;border-radius:3px}.short-error>text:last-child{color:#45d4ef;cursor:pointer}
.short-picker-mask{position:absolute;inset:0;background:#0008;z-index:5;display:flex;align-items:flex-end}.short-picker{width:100%;max-height:65%;display:flex;flex-direction:column;background:#191919;border-radius:10px 10px 0 0;padding:16px 12px;box-sizing:border-box}.picker-heading{display:flex;justify-content:space-between;font-size:13px;gap:12px;margin-bottom:15px}.picker-heading>text:last-child{color:#bbb;cursor:pointer}.picker-scroll{max-height:280px}.short-episode-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.short-episode-chips>text{background:#ffffff0d;font-size:12px;padding:10px 13px;border-radius:3px;cursor:pointer}.chosen{color:#46d7ec}
</style>
