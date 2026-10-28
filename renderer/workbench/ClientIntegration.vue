<script setup lang="ts">
import type {Platform} from '@/domain/types';
defineProps<{platform:Platform;busy:boolean;canExport:boolean;error:string}>();
const emit=defineEmits<{export:[]}>();
</script>
<template>
<section class="product-page integration-settings" aria-label="主题与打包接口设置">
 <header><span class="eyebrow">PACKAGE HANDOFF</span><h1>打包接口</h1><p>主题中心保存设计和素材，导出主题包后到打包器手动导入。</p></header>
 <view class="integration-card">
  <h2>主题包交付</h2>
  <view class="integration-contract"><text>主题包 · hetun-skeleton v2</text><text>打包协议 · hetun-package-v1</text><text>当前主题平台 · {{platform}}</text></view>
  <p>在骨架库打开需要交付的主题，再从这里或设计页导出 ZIP。独立骨架、外观配置和本机素材随主题包一起交付。</p>
  <button class="primary" :disabled="busy||!canExport" @click="emit('export')">导出主题包</button>
  <text v-if="!canExport" class="integration-note">请先在骨架库打开一个主题。</text>
  <text v-if="error" role="status" class="integration-error">{{error}}</text>
 </view>
 <view class="integration-help"><h2>打包流程</h2><p>导入已适配的基础 APK → 导入主题 ZIP → 设置后台地址和版本 → 使用自己的证书签名。</p><p>基础 APK 必须内含 assets/hetun-base.json，声明设备与已实现的主题字段。未实现的选项会阻止出包。</p><p>当前二次打包入口支持 Android APK。iOS、Windows 安装包适配尚未完成。</p></view>
</section>
</template>
<style scoped>
.integration-settings{height:100%;overflow:auto;color:var(--text)}h1{font-size:30px;margin:12px 0}h2{font-size:18px;margin:0 0 12px}p{font-size:14px;line-height:1.85;color:var(--muted);margin:8px 0}.integration-card{max-width:760px;padding:28px;margin:28px 0;border:1px solid var(--line-strong);border-radius:16px;background:var(--panel)}.integration-contract{display:flex;flex-direction:column;gap:8px;margin:16px 0;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.integration-card button{margin-top:20px;width:fit-content}.integration-note,.integration-error{display:block;font-size:12px;line-height:1.8;margin-top:12px;color:var(--muted)}.integration-error{color:#ed6060}.integration-help{max-width:760px;padding:4px 0 24px}@media(max-width:700px){.integration-card{padding:20px}}
</style>
