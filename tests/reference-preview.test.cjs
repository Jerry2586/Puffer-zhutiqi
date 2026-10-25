'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createRequire}=require('node:module');
const {deps}=require('../scripts/environment.cjs').environment();
const dependency=createRequire(path.join(deps,'package.json'));
const {createSSRApp,h}=dependency('vue');
const {renderToString}=dependency('@vue/server-renderer');
const {parse,compileScript}=dependency('@vue/compiler-sfc');
const esbuild=dependency('esbuild');
let compiled;
async function render(theme,page='home',categoryEntry=''){
 if(!compiled)compiled=(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-reference-render-'));
  const outfile=path.join(dir,'reference.cjs');
  try{
   await esbuild.build({entryPoints:[path.resolve(__dirname,'../renderer/workbench/ReferenceSkeleton.vue')],bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_HETUN_THEME_DESKTOP:'1'})},plugins:[{name:'actual-vue-components',setup(build){
    build.onResolve({filter:/^vue(?:\/server-renderer)?$/},args=>({path:dependency.resolve(args.path),external:true}));
    build.onResolve({filter:/^@\//},args=>({path:path.resolve(__dirname,'../shared-source/src',args.path.slice(2))+ (path.extname(args.path)?'':'.ts')}));
    build.onLoad({filter:/\.vue$/},async args=>{
     const source=await fs.readFile(args.path,'utf8');const {descriptor}=parse(source,{filename:args.path});
     const result=compileScript(descriptor,{id:'reference-test',inlineTemplate:true,templateOptions:{ssr:true,compilerOptions:{isCustomElement:tag=>/^[a-z]/.test(tag)}}});
     return {contents:result.content,loader:'ts',resolveDir:path.dirname(args.path)};
    });
   }}]});
   return require(outfile).default;
  }finally{await fs.rm(dir,{recursive:true,force:true});}
 })();
 const Component=await compiled;
 const app=createSSRApp(Component,{theme,page,categoryEntry,editing:true});
 // UniApp's swiper host is provided by the client runtime; preserve its slot for SSR checks.
 for(const name of ['swiper','swiper-item'])app.component(name,{setup:(_,ctx)=>()=>h(name,ctx.attrs,ctx.slots.default?.())});
 return renderToString(app);
}
function theme(){return structuredClone(require('../shared-source/src/domain/default-theme.json'));}
test('reference preview renders global carousel configuration and local reference artwork',async()=>{
 const t=theme();t.carousel.height=333;t.carousel.style='split';t.carousel.effect='fade';
 const html=await render(t);
 assert.match(html,/carousel-split/);assert.match(html,/height:333px/);
 assert.match(html,/\/static\/skeleton-reference\/front-hero.jpg/);
});
test('reference preview preserves uploaded carousel artwork and isolates category overrides',async()=>{
 const t=theme();t.carousel.height=210;t.carousel.effect='fade';
 const artwork='/api/assets/'+ 'a'.repeat(64)+'.png';
 t.carousel.slides=[{id:'uploaded',title:'Custom carousel artwork',image:artwork,video:'',vodId:'',page:'home'}];
 t.pageDesign={['category'+Buffer.from('movie').toString('hex')]:{carouselDesign:{height:280,style:'split'}}};
 const home=await render(t);const movie=await render(t,'category','movie');const series=await render(t,'category','series');
 for(const html of [home,movie,series]){assert.ok(html.includes(artwork));assert.ok(html.includes('Custom carousel artwork'));}
 assert.match(home,/height:210px/);assert.match(movie,/height:280px/);assert.match(movie,/carousel-split/);assert.match(series,/height:210px/);
});


test('reference player consumes page watermark opacity and brand',async()=>{
 const t=theme();t.brand.name='Player brand preview';t.pageDesign={player:{visual:{player:{watermarkOpacity:17}}}};
 const html=await render(t,'player');
 assert.match(html,/class="player-watermark"[^>]*>Player brand preview/);
 assert.match(html,/--design-player-watermarkOpacity:17/);
 assert.match(html,/投屏/);assert.match(html,/一起看/);
});
