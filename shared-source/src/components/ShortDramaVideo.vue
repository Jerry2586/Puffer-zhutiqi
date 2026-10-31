<script setup lang="ts">
import {getCurrentInstance} from 'vue';
const instance=getCurrentInstance()?.proxy;
const props=defineProps<{id:string;token:number;url:string;title?:string;muted:boolean}>();
const emit=defineEmits<{play:[token:number];pause:[token:number];ended:[token:number];error:[token:number]}>();
// A keyed instance keeps its original identity even if its final media events arrive late.
const token=props.token;
defineExpose({play:()=>uni.createVideoContext(props.id,instance).play(),pause:()=>uni.createVideoContext(props.id,instance).pause()});
</script>
<template><video :id="id" class="short-video" :src="url" :title="title" :autoplay="true" :muted="muted" :controls="true" object-fit="contain" :show-fullscreen-btn="false" @play="emit('play',token)" @pause="emit('pause',token)" @ended="emit('ended',token)" @error="emit('error',token)"/></template>
<style scoped>.short-video{position:absolute;inset:0;width:100%;height:100%}</style>
