<script setup lang="ts">
defineOptions({name:'EpisodeVipBadge'});
</script>
<template><text class="episode-vip" aria-label="VIP选集">VIP</text></template>
<style scoped>
.episode-vip{position:absolute;top:0;right:0;display:block;padding:2px 4px;border-radius:0 6px 0 5px;background:#e9ce8e;color:#4a3510;font-family:Arial,sans-serif;font-size:8px;font-weight:700;line-height:10px;letter-spacing:.2px;pointer-events:none}
</style>
