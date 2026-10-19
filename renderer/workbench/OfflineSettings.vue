<script setup lang="ts">
const version='0.3.0';
</script>
<template>
<section class="offline-settings" aria-label="本机与离线设置">
 <header><span class="eyebrow">LOCAL WORKSPACE</span><h1>本机与离线</h1><p>主题制作的每一步，都在你的电脑上完成。</p></header>
 <div class="offline-card"><span class="offline-badge">全部离线</span><h2>打开即用，无需 Key</h2><p>无需登录或联网激活。编辑、保存、预览、安装主题和导出主题包均由本机服务完成。</p></div>
 <div class="offline-card"><h2>主题与素材保存在本机</h2><p>草稿保留在主题中心的数据目录。导出的 ZIP 包携带已上传的本机素材，可用于备份、迁移和交给打包器。</p><p>远程图片、视频和网页不会加载；需要预览的素材，请从本机上传。</p></div>
 <div class="offline-card"><h2>成品 App 接口单独配置</h2><p>“多端接入”中的 API 地址仅随主题保存和导出。主题中心不会连接该地址；成品 App 按协议对接运营网关和苹果 CMS。</p></div>
 <footer>河豚主题中心 {{version}} · 离线版<p>更新软件时，手动导入新版本安装包。</p></footer>
</section>
</template>
<style scoped>
.offline-settings{padding:42px 48px;max-width:1100px;margin:0 auto;width:100%;height:100%;overflow:auto;box-sizing:border-box;color:var(--text)}h1{font-size:30px;margin:12px 0}h2{font-size:18px;margin:12px 0}p{font-size:14px;line-height:1.85;color:var(--muted);margin:8px 0}.offline-card{padding:24px 28px;margin:20px 0;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.offline-badge{display:inline-block;color:var(--accent);font-size:12px;border:1px solid var(--line);border-radius:20px;padding:5px 12px}footer{font-size:12px;color:var(--muted);margin:28px 0}footer p{font-size:12px}@media(max-width:900px){.offline-settings{padding:24px}.offline-card{padding:20px}}
</style>
