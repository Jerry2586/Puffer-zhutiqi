<script setup lang="ts">
import {ref,watch} from 'vue';
const props=defineProps<{state:{base:string;connected:boolean;version?:number;updatedAt?:string};busy:boolean;error:string}>();
const emit=defineEmits<{connect:[base:string];refresh:[];disconnect:[]}>();
const address=ref(props.state.base);
watch(()=>props.state.base,value=>address.value=value);
function connect(){if(!props.busy&&address.value.trim())emit('connect',address.value.trim());}
</script>
<template>
<section class="product-page connection-settings" aria-label="运营中心连接设置">
 <header><span class="eyebrow">CONNECTION</span><h1>运营中心连接</h1><p>连接已发布的运营内容，在主题画布中查看实际 App 效果。</p></header>
 <view class="connection-card">
  <view class="connection-heading"><text>运营中心地址</text><text class="connection-status" :class="{connected:state.connected}">{{state.connected?'已连接':'未连接'}}</text></view>
  <input v-model="address" placeholder="https://你的运营中心域名" aria-label="运营中心地址" :disabled="busy" @confirm="connect()"/>
  <text class="operations-note">填写运营中心的服务地址，读取已发布的分类、轮播、影片与播放列表。</text>
  <view class="operations-actions"><button class="primary" :disabled="busy||!address.trim()" @click="connect()">{{busy?'读取中…':state.connected?'重新连接':'连接'}}</button><button :disabled="busy||!state.connected" @click="emit('refresh')">刷新</button><button :disabled="busy||!state.connected" @click="emit('disconnect')">断开</button></view>
  <text class="operations-note">{{state.connected?'已发布版本 '+(state.version||'读取中')+' · 每15秒刷新':'未连接时，画布显示空内容。'}}{{state.updatedAt?' · 最近读取 '+state.updatedAt:''}}</text>
  <text v-if="error" role="status" class="operations-error">{{error}}</text>
 </view>
 <view class="connection-help"><h2>连接后回到 UI 设计</h2><p>调整骨架与外观时直接查看运营内容。切换设置和设计页会保留当前连接。</p><p>地址仅用于本次预览会话。成品 App 的后台地址在打包器中配置；主题包仍通过导出 ZIP 手动交付。</p></view>
</section>
</template>
<style scoped>
.connection-settings{height:100%;overflow:auto;color:var(--text)}h1{font-size:30px;margin:12px 0}h2{font-size:18px;margin:0 0 10px}p{font-size:14px;line-height:1.85;color:var(--muted);margin:8px 0}.connection-card{max-width:760px;margin:28px 0;padding:28px;border:1px solid var(--line-strong);border-radius:16px;background:var(--panel);display:flex;flex-direction:column;gap:16px}.connection-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:15px;font-weight:600}.connection-status{font-size:12px;font-weight:400;color:var(--muted)}.connection-status.connected{color:var(--accent)}.operations-actions{display:flex;flex-wrap:wrap;gap:10px}.operations-note{font-size:12px;line-height:1.8;color:var(--muted)}.operations-error{font-size:13px;color:#ed6060;overflow-wrap:anywhere}.connection-help{max-width:760px;padding:4px 0 24px}@media(max-width:700px){.connection-card{padding:20px}}
</style>
