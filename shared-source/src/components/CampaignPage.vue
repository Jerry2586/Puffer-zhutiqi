<script setup lang="ts">
import {computed} from 'vue';
import type {CampaignDesign,Theme,Vod,Section,AppPage} from '@/domain/types';
import {available} from '@/domain/presentation';
import {assetUrl} from '@/services/api';
import AppIcon from './AppIcon.vue';
const props=defineProps<{design:CampaignDesign;theme:Theme;items:Vod[];sections:Section[];sectionItems:Record<string,Vod[]>;editing?:boolean}>();
const emit=defineEmits<{open:[item:Vod];id:[id:string];navigate:[page:AppPage];select:[]}>();
const groups=computed(()=>props.design.groupIds.map(id=>props.sections.find(s=>s.id===id&&s.enabled)).filter((s):s is Section=>!!s));
function films(s:Section){const list=props.sectionItems[s.id]??(s.source==='category'||s.orderBy==='manual'?[]:props.items);return list.slice(0,s.limit);}
const featured=computed(()=>{const all=[...props.items,...Object.values(props.sectionItems).flat()];return props.design.featuredId?all.find(v=>v.id===props.design.featuredId):all[0];});
const canOpen=computed(()=>!!featured.value||!!props.design.featuredId);
const hasBannerAction=computed(()=>!!props.design.bannerLabel&&available(props.theme,props.design.bannerPage));
function feature(){if(props.editing){emit('select');return;}if(featured.value)emit('open',featured.value);else if(props.design.featuredId)emit('id',props.design.featuredId);}
</script>
<template>
 <view class="campaign-page" :class="'campaign-'+design.tone" data-campaign>
  <view class="campaign-hero" :class="{'has-artwork':!!design.artwork}">
   <image v-if="design.artwork" class="campaign-artwork" :src="assetUrl(design.artwork)" mode="aspectFill"/>
   <view class="campaign-heading"><text class="campaign-eyebrow">{{design.eyebrow}}</text><text class="campaign-title">{{design.title}}</text><view class="campaign-rule"/><text class="campaign-subtitle">{{design.subtitle}}</text></view>
  </view>
  <view class="campaign-body">
   <view class="featured-frame">
    <button class="featured-video" :disabled="!canOpen&&!editing" :aria-label="featured?'播放 '+featured.title:'活动推荐影片'" @click="feature">
     <image v-if="featured?.poster" :src="assetUrl(featured.poster)" mode="aspectFill"/>
     <view class="featured-shade"/>
     <view class="featured-caption"><text>{{featured?.title||(design.featuredId?'查看活动推荐影片':'活动推荐')}}</text><text>{{featured?.note||'本期精选 · 即刻发现'}}</text></view>
     <view class="featured-play"><AppIcon name="play" :size="27" color="#ffffff"/></view>
     <text v-if="!canOpen" class="featured-empty">连接内容服务后展示推荐影片</text>
    </button>
    <view class="featured-footer"><text>本期精选</text><text>{{featured?.category||'发现值得看的好故事'}}</text><text>↗</text></view>
   </view>
   <view v-if="design.bannerTitle" class="campaign-banner">
    <view><text class="banner-kicker">特别企划</text><text class="banner-title">{{design.bannerTitle}}</text><text class="banner-text">{{design.bannerText}}</text></view>
    <button v-if="hasBannerAction" @click="editing?emit('select'):emit('navigate',design.bannerPage)">{{design.bannerLabel}} <text>›</text></button>
   </view>
   <view v-for="(group,index) in groups" :key="group.id" class="campaign-group">
    <view class="group-heading"><text class="group-number">{{String(index+1).padStart(2,'0')}}</text><text>{{group.title}}</text><view class="group-spark"/></view>
    <text v-if="group.subtitle" class="group-subtitle">{{group.subtitle}}</text>
    <view v-if="films(group).length" class="campaign-grid">
     <button v-for="v in films(group)" :key="v.id" class="campaign-film" :aria-label="'查看 '+v.title" @click="editing?emit('select'):emit('open',v)">
      <view class="film-image"><image v-if="v.poster" :src="assetUrl(v.poster)" mode="aspectFill"/><text v-if="v.note" class="film-note">{{v.note}}</text></view>
      <text class="film-title">{{v.title}}</text><text class="film-meta">{{[v.year,v.area,v.category].filter(Boolean).join(' · ')}}</text>
     </button>
    </view>
    <view v-else class="campaign-empty"><AppIcon name="play" :size="24" :color="theme.colors.muted"/><text>片单内容待接入</text><text>已保留栏目排版，接入影片后自动呈现</text></view>
   </view>
   <view v-if="!groups.length" class="campaign-group"><view class="group-heading"><text class="group-number">01</text><text>活动片单</text><view class="group-spark"/></view><view class="campaign-empty"><text>为活动添加片单栏目</text><text>可在设置中的「骨架页面配置」选择栏目</text></view></view>
   <view class="campaign-end"><view/><text>好故事，值得相遇</text><view/></view>
  </view>
 </view>
</template>
<style scoped>
.campaign-page{--campaign-tone:var(--accent);--campaign-on-tone:var(--on-accent,#fff);background:var(--bg);color:var(--text);min-height:100%;overflow:hidden}
.campaign-crimson{--campaign-tone:#a44651;--campaign-on-tone:#fff}.campaign-midnight{--campaign-tone:var(--accent)}
.campaign-page button{margin:0;padding:0;border:0;border-radius:0;line-height:1.5;font:inherit;background:transparent;color:inherit;text-align:left;box-shadow:none;min-width:0;cursor:pointer}.campaign-page button::after{border:0}.campaign-page button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.campaign-page button:active{opacity:.75}.campaign-page button[disabled]{opacity:1;cursor:default}
.campaign-hero{position:relative;min-height:196px;display:flex;align-items:center;overflow:hidden;padding:30px 22px 42px;box-sizing:border-box;background:var(--surface);border-bottom:1px solid var(--mobile-line)}
.campaign-artwork{position:absolute;inset:0;width:100%;height:100%;opacity:.14}.campaign-heading{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:10px;z-index:1;max-width:100%}.campaign-eyebrow{font-size:10px;line-height:1.5;font-weight:650;letter-spacing:2px;color:var(--campaign-tone)}.campaign-title{font-size:30px;line-height:1.3;font-weight:750;letter-spacing:-.8px;overflow-wrap:anywhere;text-wrap:balance}.campaign-subtitle{font-size:12px;line-height:1.8;color:var(--muted);max-width:290px}.campaign-rule{width:24px;height:3px;background:var(--campaign-tone);border-radius:2px;margin:3px 0}
.campaign-body{position:relative;padding:0 18px 24px;margin-top:-18px}.featured-frame{border:1px solid var(--mobile-line);border-radius:16px;background:var(--surface);box-shadow:var(--mobile-shadow);overflow:hidden}.campaign-page .featured-video{width:100%;aspect-ratio:16/9;display:block;position:relative;overflow:hidden;background:#1d263c;color:#fff}.featured-video image{position:absolute;width:100%;height:100%}.featured-shade{position:absolute;inset:0;background:linear-gradient(120deg,#111b32a6,#24314f26 65%,#0003)}.featured-caption{position:absolute;left:16px;right:16px;top:15px;display:flex;flex-direction:column;gap:5px}.featured-caption>text:first-child{font-size:15px;font-weight:650}.featured-caption>text:last-child{font-size:11px;color:#c1cadb}.featured-play{position:absolute;left:50%;top:53%;transform:translate(-50%,-50%);display:grid;place-items:center;width:44px;height:44px;border:1px solid #ffffff40;border-radius:50%;background:#ffffff12}.featured-empty{position:absolute;bottom:14px;left:12px;right:12px;text-align:center;font-size:11px;color:#bdc8da}.featured-footer{color:var(--text);min-height:48px;display:flex;align-items:center;gap:12px;padding:8px 15px;box-sizing:border-box}.featured-footer>text:first-child{font-size:12px;font-weight:650}.featured-footer>text:nth-child(2){font-size:11px;color:var(--muted);flex:1;min-width:0}.featured-footer>text:last-child{font-size:20px;color:var(--campaign-tone)}
.campaign-banner{margin:18px 0 26px;padding:17px 15px;display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--mobile-line);border-radius:14px;color:var(--text)}.campaign-banner>view{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.banner-kicker{font-size:9px;letter-spacing:1.5px;color:var(--campaign-tone);font-weight:650}.banner-title{font-size:15px;font-weight:650;overflow-wrap:anywhere}.banner-text{font-size:11px;line-height:1.7;color:var(--muted)}.campaign-page .campaign-banner button{flex:none;max-width:40%;border-radius:9px;background:var(--campaign-tone);color:var(--campaign-on-tone);font-size:11px;padding:10px 12px;overflow-wrap:anywhere}
.campaign-group{margin:22px 0;padding:17px 14px;border:1px solid var(--mobile-line);border-radius:14px;background:var(--surface);color:var(--text)}.group-heading{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:17px;font-weight:650;line-height:1.5;overflow-wrap:anywhere}.group-heading>text:nth-child(2){flex:1;min-width:0}.group-number{font-size:10px;color:var(--campaign-tone);font-weight:650;letter-spacing:1px}.group-spark{width:5px;height:5px;border-radius:50%;background:var(--campaign-tone)}.group-subtitle{display:block;font-size:11px;line-height:1.7;margin-bottom:14px;color:var(--muted)}.campaign-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 12px}.campaign-film{width:100%;min-width:0}.film-image{aspect-ratio:16/10;background:var(--mobile-soft);border-radius:9px;position:relative;overflow:hidden}.film-image image{width:100%;height:100%}.film-note{position:absolute;bottom:0;right:0;max-width:100%;box-sizing:border-box;font-size:10px;padding:4px 7px;background:#0009;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.film-title{display:block;margin-top:8px;font-size:13px;line-height:1.6;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.film-meta{display:block;font-size:10px;line-height:1.7;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.campaign-empty{min-height:124px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;font-size:12px;color:var(--muted);background:var(--mobile-soft);border-radius:10px;padding:14px;box-sizing:border-box}.campaign-empty>text:last-child{font-size:11px;text-align:center;line-height:1.8}.campaign-end{display:flex;align-items:center;justify-content:center;gap:12px;font-size:10px;letter-spacing:1px;color:var(--muted);padding:8px 0}.campaign-end>view{width:24px;height:1px;background:var(--mobile-line)}
@media(max-width:360px){.campaign-body{padding:0 12px 20px}.campaign-title{font-size:27px}.campaign-banner{padding:13px;gap:8px}.banner-title{font-size:13px}}
</style>
