<script setup lang="ts">
import {computed} from 'vue';
import type {ClientIntegration,Platform} from '@/domain/types';
import targets from '@/domain/native-targets.json';
const props=defineProps<{integration?:ClientIntegration;platform:Platform;busy:boolean;error:string}>();
const emit=defineEmits<{(e:'change',v:ClientIntegration):void;(e:'close'):void;(e:'save'):void;(e:'export'):void}>();
const labels:Record<string,string>={'android-phone':'安卓手机 · Kotlin','android-tablet':'安卓平板 · Kotlin','android-tv':'Android TV · Kotlin','ios-iphone':'iPhone · Swift','ios-ipad':'iPad · Swift',web:'网页'};
const supported=computed(()=>targets[props.platform]);
function setBase(e:any){emit('change',{version:1,apiBase:String(e.detail?.value??e.target?.value??'')});}
</script>
<template>
<view class="modal-backdrop" @click.self="!busy&&emit('close')">
 <view class="workbench-modal integration-modal" role="dialog" aria-modal="true" aria-label="多端接入与打包">
  <view class="modal-heading"><text>多端接入与打包</text><button :disabled="busy" aria-label="关闭多端接入" @click="emit('close')">×</button></view>
  <text class="modal-description">这套主题的接入配置随草稿保存，并写入导出包的 manifest.json。原生客户端与打包器需实现河豚客户端协议 v1。</text>
  <view class="integration-targets"><text v-for="target in supported" :key="target">{{labels[target]}}</text></view>
  <text class="modal-hint">目标端根据当前骨架确定。手机、平板、电视使用各自布局；这里标明适配目标，尚未代表原生客户端已通过验证。</text>
  <view class="field"><text>正式河豚 API 服务地址</text><input :value="integration?.apiBase||''" :disabled="busy" maxlength="2048" placeholder="https://api.example.com" @input="setBase"/></view>
  <text class="modal-hint">填写运营网关地址，程序会在其后追加 /api/catalog 等路径。苹果 CMS 在网关后配置；“连接内容”的地址只用于本机预览，不会自动填入这里。正式地址须为 HTTPS。</text>
  <view class="integration-contract">
   <text>固定协议 · hetun-client-contract v1</text>
   <text>GET /api/theme?platform={{platform}} · 获取已发布主题</text>
   <text>GET /api/catalog/categories · 分类</text>
   <text>GET /api/catalog · 列表、详情与搜索</text>
   <text>POST /api/playback · 按影片、线路、集数取得播放地址</text>
  </view>
  <text class="modal-hint">导出后：打包器读取协议 → 检查底包适配能力 → 注入主题与公开配置 → 编译与签名。安卓生成 APK/AAB；iOS 需 macOS、Xcode 与签名配置生成 IPA。</text>
  <text class="modal-hint">证书、私钥、密码留在打包器中。普通第三方 APK、未适配的底包不能仅靠导入主题完成换肤。网关登录与播放需要对应 CMS 扩展；支付另行适配。</text>
  <text v-if="!integration?.apiBase" class="integration-warning">尚未填写正式地址：仍可导出设计主题，打包器应阻止正式出包并要求补全地址。</text>
  <text v-if="error" class="modal-error">{{error}}</text>
  <view class="modal-actions"><button :disabled="busy" @click="emit('save')">保存接入配置</button><button class="primary" :disabled="busy" @click="emit('export')">保存并导出主题包</button></view>
 </view>
</view>
</template>
<style scoped>
.integration-modal{width:min(680px,90vw);max-height:85vh;overflow-y:auto}.integration-targets{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.integration-targets text{padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px}.integration-contract{display:flex;flex-direction:column;gap:8px;padding:14px;margin:16px 0;border:1px solid var(--line);border-radius:10px;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.integration-warning{display:block;margin-top:14px;color:var(--accent);font-size:12px;line-height:1.6}.integration-modal .modal-hint{display:block;line-height:1.7;margin:10px 0}.integration-modal .modal-heading{display:flex;justify-content:space-between;align-items:center;font-size:20px}
</style>
