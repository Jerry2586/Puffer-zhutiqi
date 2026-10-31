'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module');
const deps=createRequire(path.join(require('../scripts/environment.cjs').environment().deps,'package.json'));
const {createRenderer,h,reactive,nextTick}=deps('vue');
const {parse,compileScript}=deps('@vue/compiler-sfc');
let loaded;
async function controller(){
 if(!loaded)loaded=(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-category-')),outfile=path.join(dir,'controller.cjs');
  try{await deps('esbuild').build({stdin:{contents:"export {default as Controller} from './components/AppExperience.vue';export {api} from './services/api';",resolveDir:path.resolve(__dirname,'../shared-source/src')},bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_HETUN_THEME_DESKTOP:'1'})},plugins:[{name:'controller-harness',setup(build){
   build.onResolve({filter:/^vue$/},()=>({path:deps.resolve('vue'),external:true}));
   build.onResolve({filter:/^@\//},args=>({path:path.resolve(__dirname,'../shared-source/src',args.path.slice(2))+(path.extname(args.path)?'':'.ts')}));
   build.onLoad({filter:/\.vue$/},async args=>{
    if(!args.path.endsWith('AppExperience.vue'))return {contents:'export default {name:'+JSON.stringify(path.basename(args.path,'.vue'))+',inheritAttrs:false,setup:(_,ctx)=>()=>null}',loader:'ts'};
    const source=(await fs.readFile(args.path,'utf8')).replace(/\/\/ #ifdef APP-PLUS[\s\S]*?\/\/ #endif/g,'');
    const {descriptor}=parse(source,{filename:args.path});
    return {contents:compileScript(descriptor,{id:'category-controller',inlineTemplate:true,templateOptions:{compilerOptions:{isCustomElement:tag=>/^[a-z]/.test(tag)}}}).content,loader:'ts',resolveDir:path.dirname(args.path)};
   });
  }}]});return require(outfile);}finally{await fs.rm(dir,{recursive:true,force:true});}
 })();return loaded;
}
function host(){return createRenderer({createElement:type=>({type,children:[]}),createText:text=>({text}),createComment:text=>({text}),setText:(n,text)=>n.text=text,setElementText:(n,text)=>{n.text=text;n.children=[];},parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1]||null,patchProp:()=>{},insert(n,p,anchor){if(n.parent){const old=n.parent.children.indexOf(n);if(old>=0)n.parent.children.splice(old,1);}n.parent=p;const index=anchor?p.children.indexOf(anchor):-1;if(index<0)p.children.push(n);else p.children.splice(index,0,n);},remove(n){if(n.parent){const index=n.parent.children.indexOf(n);if(index>=0)n.parent.children.splice(index,1);n.parent=null;}}});}
async function flush(){await nextTick();await Promise.resolve();await nextTick();}
test('category navigation keeps manual filters across polling and discards obsolete requests',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller();const original=api.catalog;const pending=[];
 api.catalog=(page,keyword,category)=>new Promise(resolve=>pending.push({page,category,resolve}));
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));
 theme.categories=[{id:'movie',label:'电影',page:'category',categoryId:'1',enabled:true,icon:'',activeIcon:''},{id:'series',label:'剧集',page:'category',categoryId:'2',enabled:true,icon:'',activeIcon:''}];
 theme.pageDesign={category6d6f766965:{categoryFilters:[{id:'action',label:'动作',categoryId:'6'}]}};
 const props=reactive({theme,items:[],categories:[],page:'category',categoryEntry:'movie',platform:'mobile',editing:true});
 let instance;const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>instance=v})});
 app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 try{
  await flush();assert.equal(pending[0].category,'1');
  const view=()=>instance.$.subTree.children[0].children[0];
  view().props.onFilter('6');await flush();assert.equal(pending[1].category,'6');
  pending[1].resolve({items:[{id:'action-result'}],page:1,pages:1});await flush();
  pending[0].resolve({items:[{id:'stale-movie'}],page:1,pages:1});await flush();
  assert.equal(view().props.items[0].id,'action-result');
  props.items=[{id:'poll'}];await flush();assert.equal(pending[2].category,'6');
  pending[2].resolve({items:[{id:'refreshed-action'}],page:1,pages:1});await flush();
  assert.equal(view().props['category-id'],'6');
  view().props.onFilter('999');await flush();assert.equal(pending.length,3);
  props.categoryEntry='series';await flush();assert.equal(pending[3].category,'2');assert.deepEqual(view().props.items,[]);
  pending[3].resolve({items:[],page:1,pages:1});await flush();
  assert.equal(view().props['root-category-id'],'2');assert.equal(view().props['category-id'],'2');
  props.theme.categories[1].categoryId='3';await flush();assert.equal(pending[4].category,'3');
  pending[4].resolve({items:[],page:1,pages:1});await flush();
  props.categoryEntry='movie';await flush();pending[5].resolve({items:[],page:1,pages:1});await flush();
  view().props.onFilter('6');await flush();pending[6].resolve({items:[{id:'removed-child'}],page:1,pages:1});await flush();
  props.theme.pageDesign.category6d6f766965.categoryFilters=[];await flush();assert.equal(pending[7].category,'1');assert.deepEqual(view().props.items,[]);
  pending[7].resolve({items:[],page:1,pages:1});await flush();
  props.theme.categories[0].enabled=false;await flush();assert.equal(view().props.page,'home');
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});

function findView(vm,name){const walk=n=>{if(!n||typeof n!=='object')return;if(n.type?.name===name)return n;for(const child of Array.isArray(n.children)?n.children:[]){const found=walk(child);if(found)return found;}};const node=walk(vm.$.subTree);assert.ok(node,'Missing '+name);return node;}
test('ranking retains child scope, switches directories and restores category on back',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller(),original=api.catalog,pending=[];api.catalog=(...args)=>new Promise(resolve=>pending.push({args,resolve}));
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));theme.features.ranking=true;theme.features.schedule=true;
 theme.categories=[{id:'movie',label:'电影',page:'category',categoryId:'1',enabled:true},{id:'series',label:'电视剧',page:'category',categoryId:'2',enabled:true}];
 theme.pageDesign={category6d6f766965:{categoryFilters:[{id:'action',label:'动作',categoryId:'6'}]}};
 const props=reactive({theme,items:[],categories:[],page:'category',categoryEntry:'movie',platform:'mobile',editing:true});let vm;
 const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>vm=v})});app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 const done=async(index,items=[])=>{pending[index].resolve({items,page:1,pages:1});await flush();};
 try{
  await flush();await done(0);findView(vm,'MobileExperience').props.onFilter('6');await flush();await done(1);
  vm.go('ranking','6','movie');await flush();assert.equal(pending[2].args[2],'6');assert.equal(pending[2].args[4],'score');await done(2,[{id:'ranked',categoryId:'6',score:9}]);
  let ranking=findView(vm,'MobileCatalog');assert.equal(ranking.props['category-id'],'6');assert.equal(ranking.props['category-entry'],'movie');assert.deepEqual(ranking.props.sections,[]);
  props.items=[];await flush();assert.equal(pending[3].args[2],'6');await done(3);
  vm.back();await flush();assert.equal(pending.at(-1).args[2],'6');assert.equal(findView(vm,'MobileExperience').props['category-id'],'6');await done(pending.length-1);
  vm.go('ranking','999','movie');await flush();assert.equal(pending.at(-1).args[2],'1');await done(pending.length-1);
  findView(vm,'MobileCatalog').props.onDirectory(theme.categories[1]);await flush();assert.equal(pending.at(-1).args[2],'2');await done(pending.length-1);
  ranking=findView(vm,'MobileCatalog');assert.equal(ranking.props.page,'ranking');assert.equal(ranking.props['category-entry'],'series');
  props.theme.categories[1].categoryId='3';await flush();assert.equal(pending.at(-1).args[2],'3');await done(pending.length-1);
  vm.back();await flush();assert.equal(findView(vm,'MobileExperience').props['category-entry'],'series');assert.equal(findView(vm,'MobileExperience').props['root-category-id'],'3');
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});
test('unbound ranking never requests a global feed and shortdrama ranking keeps its real CMS category',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller(),original=api.catalog,calls=[];api.catalog=async(...args)=>{calls.push(args);return {items:[],page:1,pages:1};};
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));theme.features.ranking=true;theme.features.shortdrama=true;theme.categories=[];theme.navigation=[];
 let vm;const props=reactive({theme,items:[],categories:[],page:'home',platform:'mobile',editing:true});const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>vm=v})});app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 try{await flush();vm.go('ranking');await flush();assert.equal(calls.length,0);
  props.theme.categories=[{id:'short',label:'短剧',page:'shortdrama',categoryId:'',enabled:true}];props.categories=[{id:'80',name:'短剧'}];await flush();vm.go('shortdrama');await flush();assert.equal(calls.at(-1)[2],'80');
  findView(vm,'MobileShortDrama').props.onNavigate('ranking');await flush();assert.equal(calls.at(-1)[2],'80');assert.equal(findView(vm,'MobileCatalog').props['category-entry'],'short');
  vm.back();await flush();assert.ok(findView(vm,'MobileShortDrama'));assert.equal(calls.at(-1)[2],'80');
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});

test('schedule isolates root and child rows, switches directories and ignores stale metadata',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller(),original=api.catalog,pending=[];api.catalog=(...args)=>new Promise(resolve=>pending.push({args,resolve}));
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));theme.features.schedule=true;
 theme.categories=[{id:'movie',label:'电影',page:'category',categoryId:'1',enabled:true},{id:'series',label:'电视剧',page:'category',categoryId:'2',enabled:true}];theme.navigation=[];
 theme.pageDesign={category6d6f766965:{categoryFilters:[{id:'action',label:'动作',categoryId:'6'}]}};
 theme.schedule=[{id:'a',vodId:'a',title:'电影动作排期',date:'2026-10-30',categoryId:'6'},{id:'b',vodId:'b',title:'电视剧排期',date:'2026-10-30',categoryId:'2'},{id:'c',vodId:'c',title:'旧电影排期',date:'2026-10-30'},{id:'d',vodId:'d',title:'电影目录排期',date:'2026-10-30',categoryEntry:'movie'},{id:'e',vodId:'e',title:'其他目录排期',date:'2026-10-30',categoryId:'6',categoryEntry:'series'}];
 const props=reactive({theme,items:[],categories:[],page:'category',categoryEntry:'movie',platform:'mobile',editing:true});let vm;
 const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>vm=v})});app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 const text=()=>{const parts=[];const walk=n=>{if(!n||typeof n!=='object')return;if(n.children&&typeof n.children==='string')parts.push(n.children);for(const child of Array.isArray(n.children)?n.children:[])walk(child);};walk(vm.$.subTree);return parts.join('|');};
 try{
  await flush();pending[0].resolve({items:[],page:1,pages:1});await flush();vm.go('schedule','1','movie');await flush();
  assert.match(text(),/电影动作排期/);assert.doesNotMatch(text(),/电视剧排期|其他目录排期/);
  pending[1].resolve({items:[{id:'c',categoryId:'1'},{id:'d',categoryId:'1'}]});await flush();assert.match(text(),/旧电影排期/);
  findView(vm,'CategoryScopeBar').props.onCategory('6');await flush();assert.match(text(),/电影动作排期/);assert.doesNotMatch(text(),/旧电影排期|电影目录排期/);
  findView(vm,'CategoryScopeBar').props.onDirectory(theme.categories[1]);await flush();assert.match(text(),/电视剧排期/);assert.doesNotMatch(text(),/电影动作排期/);
  pending[2].resolve({items:[{id:'c',categoryId:'2'}]});await flush();assert.doesNotMatch(text(),/旧电影排期/);
  pending[3].resolve({items:[{id:'c',categoryId:'1'}]});await flush();assert.doesNotMatch(text(),/旧电影排期/);
  props.items=[];await flush();assert.equal(findView(vm,'CategoryScopeBar').props['category-id'],'2');
  vm.back();await flush();assert.equal(findView(vm,'MobileExperience').props['category-entry'],'series');assert.equal(findView(vm,'MobileExperience').props['root-category-id'],'2');
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});


test('each primary directory requests and displays its own bound films, while unbound entries stay empty',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller(),original=api.catalog,calls=[];
 api.catalog=async(...args)=>{calls.push(args);return {items:[{id:'film-'+args[2],categoryId:args[2],title:'Film '+args[2]}],page:1,pages:1};};
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));
 theme.categories=[['movie','电影','1'],['series','电视剧','2'],['variety','综艺','3'],['anime','动漫','4'],['unbound','未绑定','']].map(([id,label,categoryId])=>({id,label,categoryId,page:'category',enabled:true}));theme.navigation=[];
 const props=reactive({theme,items:[{id:'global-film',categoryId:'99'}],categories:[],page:'category',categoryEntry:'movie',platform:'mobile',editing:true});let vm;
 const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>vm=v})});app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 try{
  await flush();
  for(const entry of theme.categories.slice(0,4)){
   if(entry.id!=='movie'){props.categoryEntry=entry.id;await flush();}
   const view=findView(vm,'MobileExperience');assert.equal(calls.at(-1)[2],entry.categoryId);assert.equal(view.props['root-category-id'],entry.categoryId);assert.deepEqual(view.props.items.map(v=>v.id),['film-'+entry.categoryId]);
  }
  const count=calls.length;props.categoryEntry='unbound';await flush();assert.equal(calls.length,count);assert.deepEqual(findView(vm,'MobileExperience').props.items,[]);
  props.items=[{id:'another-global-film',categoryId:'99'}];await flush();assert.equal(calls.length,count);assert.deepEqual(findView(vm,'MobileExperience').props.items,[]);
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});

test('demo primary directories include CMS descendants and configured children without mixing other directories',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller(),original=api.catalog;let calls=0;api.catalog=async()=>{calls++;return {items:[],page:1,pages:1};};
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));theme.navigation=[];
 theme.categories=[{id:'movie',label:'电影',page:'category',categoryId:'1',enabled:true},{id:'series',label:'电视剧',page:'category',categoryId:'2',enabled:true}];
 theme.pageDesign={category6d6f766965:{categoryFilters:[{id:'manual',label:'手动子分类',categoryId:'8'}]}};
 const props=reactive({theme,demo:true,items:[{id:'root',categoryId:'1'},{id:'child',categoryId:'6'},{id:'grandchild',categoryId:'7'},{id:'manual',categoryId:'8'},{id:'series',categoryId:'2'}],categories:[{id:'1',name:'电影'},{id:'6',name:'动作',parentId:'1'},{id:'7',name:'动作子类',parentId:'6'},{id:'2',name:'电视剧'}],page:'category',categoryEntry:'movie',platform:'mobile',editing:true});let vm;
 const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>vm=v})});app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 try{
  await flush();assert.deepEqual(findView(vm,'MobileExperience').props.items.map(v=>v.id),['root','child','grandchild','manual']);
  props.categoryEntry='series';await flush();assert.deepEqual(findView(vm,'MobileExperience').props.items.map(v=>v.id),['series']);assert.equal(calls,0);
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});

test('local player layout opens only in studio, returns to the same category filter, and clears when a real film opens',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};global.window={addEventListener:()=>{},removeEventListener:()=>{}};
 const {Controller,api}=await controller(),original=api.catalog,pending=[];api.catalog=(...args)=>new Promise(resolve=>pending.push({args,resolve}));
 const theme=structuredClone(require('../shared-source/src/domain/default-theme.json'));theme.startup.enabled=false;theme.navigation=[];
 theme.categories=[{id:'movie',label:'电影',page:'category',categoryId:'1',enabled:true}];theme.pageDesign={category6d6f766965:{categoryFilters:[{id:'action',label:'动作',categoryId:'6'}]}};
 const props=reactive({theme,items:[],categories:[],page:'category',categoryEntry:'movie',platform:'mobile',studio:true});let vm;
 const app=host().createApp({render:()=>h(Controller,{...props,ref:v=>vm=v})});app.component('scroll-view',{render:()=>null});app.mount({children:[]});
 const view=()=>findView(vm,'MobileExperience');
 try{
  await flush();view().props.onFilter('6');await flush();view().props.onPreviewPlayer();await flush();assert.equal(view().props['player-preview'],true);assert.equal(view().props.film,null);assert.equal(view().props['layout-page'],'player');
  pending[1].resolve({items:[{id:'obsolete'}],page:1,pages:1});await flush();assert.deepEqual(view().props.items,[]);
  assert.equal(vm.back(),true);await flush();assert.equal(view().props['player-preview'],false);assert.equal(view().props['category-id'],'6');assert.equal(view().props['category-entry'],'movie');
  view().props.onPreviewPlayer();await flush();const actual={id:'actual',title:'真实影片',sources:[]};const opening=view().props.onOpen(actual);await flush();assert.equal(view().props['player-preview'],false);assert.equal(view().props.film.id,'actual');
  pending.at(-1).resolve({items:[{...actual,title:'接口详情'}]});await opening;await flush();assert.equal(view().props.film.title,'接口详情');vm.back();await flush();assert.equal(view().props['player-preview'],false);assert.equal(view().props.film,null);
  props.studio=false;await flush();view().props.onPreviewPlayer();await flush();assert.equal(view().props['player-preview'],false);
 }finally{app.unmount();api.catalog=original;delete global.uni;delete global.window;}
});
