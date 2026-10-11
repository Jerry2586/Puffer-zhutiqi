<script setup lang="ts">
defineProps<{mode:'dark'|'light'}>();
defineEmits<{toggle:[]}>();
</script>
<template>
<button class="appearance-toggle" :title="mode==='dark'?'切换到浅色模式':'切换到深色模式'" :aria-label="mode==='dark'?'切换到浅色模式':'切换到深色模式'" @click="$emit('toggle')">
<svg v-if="mode==='dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5 8.5 8.5 0 1 0 20.5 13.2Z"/></svg>
</button>
</template>
