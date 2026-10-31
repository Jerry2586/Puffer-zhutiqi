'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module');
const deps=createRequire(path.join(require('../scripts/environment.cjs').environment().deps,'package.json'));
const {createRenderer,nextTick}=deps('vue');
const {parse,compileScript}=deps('@vue/compiler-sfc');
async function load(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-shortdrama-')),outfile=path.join(dir,'controller.cjs');
 try{await deps('esbuild').build({stdin:{contents:"export {default as Controller} from './components/MobileShortDrama.vue';export {api} from './services/api';",resolveDir:path.resolve(__dirname,'../shared-source/src')},bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_HETUN_THEME_DESKTOP:'1'})},plugins:[{name:'shortdrama-harness',setup(build){
  build.onResolve({filter:/^vue$/},()=>({path:deps.resolve('vue'),external:true}));
  build.onResolve({filter:/^@\//},args=>({path:path.resolve(__dirname,'../shared-source/src',args.path.slice(2))+(path.extname(args.path)?'':'.ts')}));
  build.onLoad({filter:/\.vue$/},async args=>{
   if(!args.path.endsWith('MobileShortDrama.vue'))return {contents:'export default {}',loader:'ts'};
   const {descriptor}=parse(await fs.readFile(args.path,'utf8'),{filename:args.path});
   return {contents:compileScript(descriptor,{id:'shortdrama-test'}).content,loader:'ts',resolveDir:path.dirname(args.path)};
  });
 }}]});return require(outfile);}finally{await fs.rm(dir,{recursive:true,force:true});}
}
async function flush(){await nextTick();await Promise.resolve();await nextTick();}
test('empty shortdrama source clears media and rejects an earlier playback response',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};
 const {Controller,api}=await load();Controller.render=()=>null;
 const film={id:'short-1',title:'实际短剧',sources:[{name:'有效线路',episodes:[{name:'第一集'}]},{name:'空线路',episodes:[]}]};
 const pending=[];api.catalog=async()=>({items:[film]});api.playback=()=>new Promise(resolve=>pending.push(resolve));
 const renderer=createRenderer({createComment:()=>({}),insert:()=>{},remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
 const app=renderer.createApp(Controller,{item:film,bound:true,loading:false,favorite:false,ranking:false});
 const vm=app.mount({}),state=vm.$.setupState;
 try{
  await flush();assert.equal(pending.length,1);
  const address='/api/preview/media/'+'a'.repeat(48);
  pending[0]({url:address});await flush();assert.equal(state.url,address);
  state.source=1;state.playSelected();await flush();assert.equal(state.url,'');assert.equal(state.playing,false);assert.equal(state.pending,false);assert.match(state.error,/没有可播放集数/);
  state.source=0;state.playSelected();await flush();assert.equal(pending.length,2);
  state.source=1;state.playSelected();await flush();pending[1]({url:address});await flush();
  assert.equal(state.url,'');assert.match(state.error,/没有可播放集数/);
 }finally{app.unmount();}
});

test('shortdrama starts immediately, advances real episodes and only vertical feed gestures switch videos',async()=>{
 global.uni={getStorageSync:()=>[],setStorageSync:()=>{}};
 const {Controller,api}=await load();Controller.render=()=>null;const steps=[],calls=[];
 const film={id:'short-2',title:'选集短剧',sources:[{name:'线路一',episodes:[{name:'第一集'},{name:'第二集'}]}]};
 api.catalog=async()=>({items:[film]});api.playback=async(...args)=>{calls.push(args);return {url:'/api/preview/media/'+'b'.repeat(48)};};
 const renderer=createRenderer({createComment:()=>({}),insert:()=>{},remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
 const app=renderer.createApp(Controller,{item:film,bound:true,loading:false,favorite:false,ranking:false,onStep:by=>steps.push(by)}),vm=app.mount({}),state=vm.$.setupState;
 const point=(x,y)=>({changedTouches:[{clientX:x,clientY:y}]});
 try{
  await flush();assert.deepEqual(calls[0],['short-2',1,1]);assert.ok(state.url);
  state.ended(state.mediaToken);await flush();assert.equal(state.episode,1);assert.deepEqual(calls.at(-1),['short-2',1,2]);
  state.ended(state.mediaToken);await flush();assert.equal(calls.length,2);
  await state.chooseEpisodes();assert.equal(state.picker,true);state.touchStart(point(20,200));state.touchEnd(point(20,50));assert.deepEqual(steps,[]);
  state.chooseEpisode(0);await flush();assert.equal(state.picker,false);assert.deepEqual(calls.at(-1),['short-2',1,1]);
  state.touchStart(point(20,200));state.touchEnd(point(20,50));state.touchStart(point(20,50));state.touchEnd(point(20,200));assert.deepEqual(steps,[1,-1]);
  state.touchStart(point(20,200));state.touchEnd(point(170,120));assert.deepEqual(steps,[1,-1]);
  const oldToken=state.mediaToken;state.chooseEpisode(1);await flush();state.playbackStarted(oldToken);assert.equal(state.playing,false);
 }finally{app.unmount();delete global.uni;}
});

test('shortdrama episode picker delegates source routing to the polling player',async()=>{
 const source=await fs.readFile(path.resolve(__dirname,'../shared-source/src/components/MobileShortDrama.vue'),'utf8');
 assert.doesNotMatch(source,/chooseSource|short-source-chips|选择其他线路/);
 assert.match(source,/@click="chooseEpisode\(index\)"/);
});
