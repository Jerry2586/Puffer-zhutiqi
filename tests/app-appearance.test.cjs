'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../shared-source/src');
const asUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64');
let domainUrl;
async function appearance(){
 if(!domainUrl){const schema=await fs.readFile(path.join(root,'domain/visual-schema.json'),'utf8');const source=(await fs.readFile(path.join(root,'domain/appearance.ts'),'utf8')).replace("import schema from './visual-schema.json';",'const schema='+schema+';');domainUrl=asUrl(source);}
 return import(domainUrl);
}
test('invalid and old local preferences recover safely',async()=>{
 const {normalizeAppearance}=await appearance();
 for(const value of [null,undefined,'broken',[],{},42,{mode:'sepia',accent:'unknown'}])assert.deepEqual(normalizeAppearance(value),{mode:'system',accent:'indigo'});
 assert.deepEqual(normalizeAppearance('{"mode":"dark","accent":"emerald"}'),{mode:'dark',accent:'emerald'});
});
test('explicit mode wins over device changes; system follows device',async()=>{
 const {appearanceScheme}=await appearance();
 for(const systemDark of [true,false]){assert.equal(appearanceScheme({mode:'light'},systemDark),'light');assert.equal(appearanceScheme({mode:'dark'},systemDark),'dark');assert.equal(appearanceScheme({mode:'system'},systemDark),systemDark?'dark':'light');}
});
test('appearance preserves skeleton, layout, category order, media and source theme',async()=>{
 const {appearanceTheme,appearanceAccents}=await appearance();
 const theme={colors:{background:'#abc',surface:'#def',text:'#333',muted:'#777',accent:'#123'},visual:{cards:{radius:9,size:14,gap:11},player:{background:'#000',controls:'#fff',height:222}},skeleton:{kind:'custom'},layout:{density:'compact'},categories:[{id:'anime'},{id:'movie'}],carousel:{height:220,slides:[{image:'real.jpg'}]},pageDesign:{category:{moduleOrder:['hero','category-shortcuts','category-content']}},brand:{logo:'logo.png'}};
 const before=JSON.stringify(theme);
 for(const mode of ['light','dark'])for(const accent of appearanceAccents){const result=appearanceTheme(theme,{mode,accent:accent.id},false);assert.equal(JSON.stringify(theme),before);for(const key of ['skeleton','layout','categories','carousel','pageDesign','brand'])assert.strictEqual(result[key],theme[key]);assert.equal(result.visual.cards.radius,9);assert.equal(result.visual.cards.gap,11);assert.equal(result.visual.player.background,'#000');assert.equal(result.visual.player.controls,'#fff');assert.equal(result.visual.player.height,222);assert.equal(result.colors.accent,accent[mode]);assert.equal(result.visual.navigation.active,accent[mode]);assert.equal(result.visual.cards.background,result.colors.surface);}
});
async function serviceHarness(platform,storageFails=false){
 await appearance();
 const state={mount:[],unmount:[],writes:[],matches:true,mediaHandlers:[],nativeHandlers:[]};
 globalThis.__appearanceHarness=state;
 state.uni={getStorageSync:()=>({mode:'system',accent:'blue'}),setStorageSync:(...args)=>{if(storageFails)throw Error('quota');state.writes.push(args);},getSystemInfoSync:()=>({theme:'dark'}),onThemeChange:fn=>state.nativeHandlers.push(fn),offThemeChange:fn=>state.nativeHandlers.splice(state.nativeHandlers.indexOf(fn),1)};
 state.media={matches:true,addEventListener:(_,fn)=>state.mediaHandlers.push(fn),removeEventListener:(_,fn)=>state.mediaHandlers.splice(state.mediaHandlers.indexOf(fn),1)};
 let source=await fs.readFile(path.join(root,'services/appearance.ts'),'utf8');
 source=source.replace("import {ref,computed,onMounted,onUnmounted} from 'vue';",'const harness=globalThis.__appearanceHarness; const uni=harness.uni; const window={matchMedia:()=>harness.media}; const ref=value=>({value}); const computed=fn=>({get value(){return fn();}}); const onMounted=fn=>harness.mount.push(fn); const onUnmounted=fn=>harness.unmount.push(fn);');
 source=source.replace("'@/domain/appearance'",JSON.stringify(domainUrl));
 source=source.replace(/\/\/ #ifdef (H5|APP-PLUS)([\s\S]*?)\/\/ #endif/g,(_,target,body)=>target===platform?body:'');
 const {useAppearance}=await import(asUrl(source+'\n//'+platform+storageFails));
 state.instance=useAppearance();state.mount.forEach(fn=>fn());return state;
}
test('H5 reacts to system color changes, persists choice and cleans its listener',async()=>{
 const state=await serviceHarness('H5');assert.equal(state.instance.scheme.value,'dark');assert.equal(state.mediaHandlers.length,1);state.mediaHandlers[0]({matches:false});assert.equal(state.instance.scheme.value,'light');state.instance.updateAppearance({mode:'dark',accent:'rose'});assert.equal(state.instance.scheme.value,'dark');assert.equal(state.writes.length,1);state.unmount.forEach(fn=>fn());assert.equal(state.mediaHandlers.length,0);
});
test('native mode observes system appearance and unsubscribes on exit',async()=>{
 const state=await serviceHarness('APP-PLUS');assert.equal(state.instance.scheme.value,'dark');state.nativeHandlers[0]({theme:'light'});assert.equal(state.instance.scheme.value,'light');state.unmount.forEach(fn=>fn());assert.equal(state.nativeHandlers.length,0);
});
test('storage errors leave current choice usable and show a truthful save error',async()=>{
 const state=await serviceHarness('H5',true);state.instance.updateAppearance({mode:'light',accent:'slate'});assert.equal(state.instance.scheme.value,'light');assert.ok(state.instance.saveError.value);state.unmount.forEach(fn=>fn());
});
