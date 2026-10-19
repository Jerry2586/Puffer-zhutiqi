<script setup lang="ts">
import type {ClientIntegration,Platform} from '@/domain/types';
defineProps<{integration?:ClientIntegration;platform:Platform;busy:boolean;error:string}>();
const emit=defineEmits<{(e:'close'):void;(e:'export'):void}>();
</script>
<template>
<view class="modal-backdrop" @click.self="!busy&&emit('close')">
 <view class="workbench-modal integration-modal" role="dialog" aria-modal="true" aria-label="主题与打包接口">
  <view class="modal-heading"><text>主题与打包接口</text><button :disabled="busy" aria-label="关闭" @click="emit('close')">×</button></view>
  <text class="modal-description">主题中心制作界面、保存素材和导出主题包。后台地址、基础安装包、版本和签名统一在打包器配置。</text>
  <view class="integration-contract"><text>主题包 · hetun-skeleton v2</text><text>打包协议 · hetun-package-v1</text><text>当前主题平台 · {{platform}}</text><text>基础 APK 必须内含 assets/hetun-base.json，明确声明设备与已实现的主题字段。</text><text>本地自动传递 ZIP，并按基础包声明检查字段与取值；未实现的选项会阻止出包。</text></view>
  <text class="modal-hint">日常流程：在打包器导入已适配的基础 APK → 选择主题 → 设置后台与版本 → 使用自己的证书签名。基础包源码的首次构建属于独立开发流程。</text>
  <text class="modal-hint">当前实际二次打包入口支持 Android APK。iOS、Windows 的安装包适配尚未完成；保存这些平台的主题不代表可以生成对应安装包。</text>
  <text v-if="error" class="modal-error">{{error}}</text>
  <view class="modal-actions"><button :disabled="busy" @click="emit('close')">关闭</button><button class="primary" :disabled="busy" @click="emit('export')">导出主题包</button></view>
 </view>
</view>
</template>
<style scoped>
.integration-modal{width:min(680px,90vw);max-height:85vh;overflow-y:auto}.integration-contract{display:flex;flex-direction:column;gap:8px;padding:14px;margin:16px 0;border:1px solid var(--line);border-radius:10px;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.integration-modal .modal-hint{display:block;line-height:1.7;margin:10px 0}.integration-modal .modal-heading{display:flex;justify-content:space-between;align-items:center;font-size:20px}
</style>
