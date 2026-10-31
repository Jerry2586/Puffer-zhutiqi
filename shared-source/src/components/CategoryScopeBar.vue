<script setup lang="ts">
import type {NavItem,CategoryFilter} from '@/domain/types';
defineProps<{entries:NavItem[];entryId:string;categoryId:string;rootId:string;filters:CategoryFilter[]}>();
const emit=defineEmits<{directory:[item:NavItem];category:[id:string]}>();
</script>
<template>
 <view class="category-scope" aria-label="当前分类">
  <scroll-view scroll-x :show-scrollbar="false"><view class="scope-row directories"><button v-for="entry in entries" :key="entry.id" :class="{active:entryId===entry.id}" @click="emit('directory',entry)">{{entry.label}}</button></view></scroll-view>
  <scroll-view v-if="filters.length" scroll-x :show-scrollbar="false"><view class="scope-row"><button :class="{active:categoryId===rootId}" @click="emit('category',rootId)">全部</button><button v-for="filter in filters" :key="filter.id" :class="{active:categoryId===filter.categoryId}" @click="emit('category',filter.categoryId)">{{filter.label}}</button></view></scroll-view>
 </view>
</template>
<style scoped>
.category-scope{min-width:0}.scope-row{display:flex;align-items:center;gap:8px;padding:7px 0;white-space:nowrap}.scope-row button{flex:none;margin:0;padding:7px 12px;line-height:1.5;font-size:12px;color:var(--muted);border:0;background:transparent;border-radius:8px;cursor:pointer}.scope-row button::after{border:0}.scope-row button.active{color:var(--accent);background:var(--accent-soft,#8090ac12);font-weight:600}.directories{border-bottom:1px solid var(--mobile-line,#8090ac20)}.directories button{font-size:14px}
</style>
