<script setup lang="ts">
import {onMounted,ref} from 'vue';
import {request} from '@/services/api';
const props=defineProps<{busy:boolean;error:string;connected:boolean;version:number}>();
const emit=defineEmits<{close:[];change:[base:string]}>();
const base=ref(''),reading=ref(true),loadError=ref('');
onMounted(async()=>{try{const session=await request<{base:string;connected:boolean}>('/api/preview/session');base.value=session.base||'';}catch(e){loadError.value=(e as Error).message;}finally{reading.value=false;}});
</script>
<template>
 <view class="connection" role="dialog" aria-modal="true" aria-label="运营连接">
  <view class="connection-head"><button aria-label="返回设置" @click="emit('close')">‹</button><text>运营连接</text><view/></view>
  <scroll-view scroll-y class="connection-body"><view class="connection-content">
   <text class="eyebrow">内容来源</text><text class="heading">连接你的运营中心</text><text class="description">分类、轮播、影片和片单使用运营中心发布的真实内容。</text>
   <view class="connection-card"><text class="label">运营服务地址</text><input v-model="base" :disabled="busy||reading" placeholder="https://运营服务域名" aria-label="运营服务地址"/><text class="description">填写运营服务根地址。连接仅用于本机设计预览，地址不会写入导出的骨架。</text><button class="primary" :disabled="busy||reading||!base.trim()" @click="emit('change',base.trim())">{{busy?'正在同步…':connected?'重新连接并同步':'连接并读取内容'}}</button></view>
   <view class="connection-card status"><text :class="{online:connected}">{{connected?'已连接':'尚未连接'}}</text><text v-if="connected&&version" class="description">运营配置版本 {{version}} · 每 15 秒同步</text><button v-if="connected" :disabled="busy" @click="emit('change','')">断开连接</button></view>
   <text v-if="error||loadError" class="error" role="alert">{{error||loadError}}</text>
  </view></scroll-view>
 </view>
</template>
<style scoped>
.connection{position:absolute;inset:0;z-index:110;background:#f6f7fb;color:#1c2434;display:flex;flex-direction:column;font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.connection button{font:inherit;border:0;margin:0;line-height:1.5;cursor:pointer}.connection button::after{border:0}.connection button[disabled]{opacity:.45}.connection-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border-bottom:1px solid #e8ebf1;min-height:40px;font-weight:600}.connection-head>button{font-size:30px;background:transparent;width:36px;color:#536174}.connection-head>view{width:36px}.connection-body{flex:1;height:0;min-height:0}.connection-content{padding:30px 20px;display:flex;flex-direction:column;gap:14px}.eyebrow{font-size:11px;letter-spacing:2px;color:#5264e8}.heading{font-size:25px;font-weight:650;letter-spacing:-.5px}.description{font-size:12px;color:#778295;line-height:1.8;display:block}.connection-card{margin-top:8px;padding:20px 16px;background:#fff;border:1px solid #e4e8f0;border-radius:14px;display:flex;flex-direction:column;gap:14px}.label{font-size:12px;font-weight:600}.connection input{font-size:16px;height:44px;border:1px solid #dce1ed;border-radius:8px;padding:0 10px;color:#1c2434;background:#fafbfe}.connection .primary{background:#5264e8;color:#fff;border-radius:9px;padding:12px}.status{font-size:13px}.online{color:#23755d}.status button{color:#a44d54;background:#fff6f5;padding:9px;border-radius:8px}.error{font-size:12px;line-height:1.8;color:#ac4854}
</style>
