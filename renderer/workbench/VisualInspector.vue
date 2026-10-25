<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import type {Theme} from '@/domain/types';
import {visualSchema,normalizeVisual,themeForPage,visualGroupsForPage} from '@/domain/visual';
import Panel from '@/components/EditorPanel.vue';
import ColorPicker from './ColorPicker.vue';
const props=defineProps<{theme:Theme;group?:string;page?:string;embedded?:boolean;pageOnly?:boolean}>();
const emit=defineEmits<{upload:[target:Record<string,any>,key:string]}>();
const scope=ref<'global'|'page'>(props.page?'page':'global');
watch(()=>[props.page,props.pageOnly],()=>{scope.value=props.page?'page':'global';});
type StyleField={label:string;default:string|number;type:string;min?:number;max?:number};
const schema:Record<string,{label:string;fields:Record<string,StyleField>}>=visualSchema;
const effective=computed(()=>normalizeVisual((scope.value==='page'?themeForPage(props.theme,props.page||''):props.theme).visual,props.theme.colors));
const groups=computed(()=>{if(props.pageOnly&&!props.group)return [];const available=visualGroupsForPage(scope.value==='page'?props.page:undefined);return Object.entries(schema).filter(([key])=>available.includes(key)&&(!props.pageOnly||!['navigation','directory'].includes(key))&&(!props.group||key===props.group));});
function visibleFields(fields:Record<string,StyleField>){return props.pageOnly?Object.fromEntries(Object.entries(fields).filter(([,field])=>field.type!=='color')):fields;}
function pageConfig(){props.theme.pageDesign??={};return props.theme.pageDesign[props.page!]??={};}
function setField(group:string,key:string,value:string|number){if(scope.value==='global'){props.theme.visual??=normalizeVisual(undefined,props.theme.colors);props.theme.visual[group][key]=value;}else{const config=pageConfig();config.visual??={};config.visual[group]??={};config.visual[group][key]=value;}}
function restore(group:string,key:string){const fields=props.theme.pageDesign?.[props.page||'']?.visual?.[group];if(fields){delete fields[key];if(!Object.keys(fields).length)delete props.theme.pageDesign![props.page!].visual![group];}}
function customized(group:string,key:string){return scope.value==='page'&&props.theme.pageDesign?.[props.page||'']?.visual?.[group]?.[key]!==undefined;}
function number(group:string,key:string,event:any){const field=schema[group].fields[key],raw=event.detail?.value??event.target?.value;if(raw==='')return;const value=Number(raw);if(Number.isFinite(value))setField(group,key,Math.min(field.max!,Math.max(field.min!,value)));}
let colorSnapshot:Theme['pageDesign'];
let globalColorSnapshot:Theme['visual'];
function beginColor(){globalColorSnapshot=props.theme.visual===undefined?undefined:JSON.parse(JSON.stringify(props.theme.visual));colorSnapshot=props.theme.pageDesign===undefined?undefined:JSON.parse(JSON.stringify(props.theme.pageDesign));}
function cancelColor(){if(scope.value==='page'){if(colorSnapshot===undefined)delete props.theme.pageDesign;else props.theme.pageDesign=colorSnapshot;}else{if(globalColorSnapshot===undefined)delete props.theme.visual;else props.theme.visual=globalColorSnapshot;}}
function background(value:string){pageConfig().background=value;}
</script>
<template>
<view v-if="!embedded&&!pageOnly" class="scope-switch"><button :class="{active:scope==='global'}" @click="scope='global'">整个主题</button><button v-if="page" :class="{active:scope==='page'}" @click="scope='page'">当前页面</button></view>
<view v-if="!embedded&&!pageOnly" class="scope-note">{{scope==='global'?'统一设置所有页面；已单独设计的属性保留。':'未单独设计的属性跟随主题，可逐项恢复。'}}</view>
<Panel v-if="scope==='page'&&!group" title="页面背景" :initial-open="true" summary="仅作用于这个页面">
 <view v-if="!pageOnly" class="field"><text>页面背景</text><ColorPicker :model-value="theme.pageDesign?.[page!]?.background||theme.colors.background" label="页面背景" @begin="beginColor" @cancel="cancelColor" @update:model-value="background"/><button v-if="theme.pageDesign?.[page!]?.background" class="inherit-button" @click="delete theme.pageDesign![page!].background">恢复主题背景</button></view>
 <view class="field"><text>背景图片</text><button @click="emit('upload',pageConfig(),'backgroundImage')">选择本机图片</button><button v-if="theme.pageDesign?.[page!]?.backgroundImage" class="inherit-button" @click="delete theme.pageDesign![page!].backgroundImage">移除背景图片</button></view>
</Panel>
<component :is="embedded?'view':Panel" v-for="[key,section] in groups" :key="key" :title="section.label" :initial-open="true" summary="修改立即显示在画布中"><view v-for="(field,id) in visibleFields(section.fields)" :key="id" class="field"><view class="field-heading"><text>{{field.label}}</text><button v-if="customized(key,String(id))" class="inherit-button" @click="restore(key,String(id))">恢复继承</button></view><ColorPicker v-if="field.type==='color'" :model-value="String(effective[key][id])" :label="field.label" @begin="beginColor" @cancel="cancelColor" @update:model-value="setField(key,String(id),$event)"/><view v-else class="design-range"><slider :min="field.min" :max="field.max" :value="Number(effective[key][id])" :step="1" activeColor="#8171ed" :block-size="14" @changing="number(key,String(id),$event)" @change="number(key,String(id),$event)"/><input class="design-number" :aria-label="field.label" type="number" :min="field.min" :max="field.max" :value="effective[key][id]" @input="number(key,String(id),$event)"/></view></view></component>
</template>
<style scoped>.scope-switch{display:flex;gap:4px;padding:4px;border:1px solid #8882;border-radius:10px}.scope-switch button{flex:1;margin:0;background:transparent;min-height:32px!important;font-size:12px;padding:6px!important;border:0}.scope-switch button.active{background:#8171ed22;color:#9280ef}.scope-note{font-size:11px;line-height:1.7;opacity:.6;padding:12px 0}.field-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.inherit-button{background:transparent!important;border:0!important;padding:2px 0!important;font-size:10px!important;min-height:22px!important;color:#8d7be6!important;margin:0!important}.design-range{display:flex;gap:10px;align-items:center}.design-range slider{flex:1;min-width:0;margin:10px 0}.design-number{width:65px!important;flex:none!important}</style>
