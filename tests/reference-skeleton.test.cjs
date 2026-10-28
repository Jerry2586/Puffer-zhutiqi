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

test('each category retains its own banner and six poster cards',async()=>{
 const t=theme();t.categories=[{id:'series',label:'电视剧',page:'category',enabled:true},{id:'movie',label:'电影',page:'category',enabled:true},{id:'anime',label:'动漫',page:'category',enabled:true},{id:'variety',label:'综艺',page:'category',enabled:true}];
 for(const [id,key,title] of [['series','home','秘密花园'],['movie','movie','虎影奇锋'],['anime','anime','开心锤锤世界'],['variety','variety','超正的我们']]){
  const html=await render(t,'category',id);
  assert.ok(html.includes('/static/skeleton-reference/'+key+'-hero.jpg'),id);
  assert.ok(html.includes(title),id);
  assert.equal((html.match(/class="film-card"/g)||[]).length,6,id);
  assert.ok(html.includes('/static/skeleton-reference/'+key+'-poster-0.jpg'),id);
 }
});
test('hiding one category carousel preserves its content and other category banners',async()=>{
 const t=theme();t.pageDesign={['category'+Buffer.from('movie').toString('hex')]:{carousel:false}};
 const movie=await render(t,'category','movie'),series=await render(t,'category','series');
 assert.doesNotMatch(movie,/class="page-carousel"/);assert.match(movie,/poster-grid category-grid/);
 assert.match(series,/class="page-carousel"/);
});
test('category modules stay scoped to the selected category',async()=>{
 const t=theme();const base={enabled:true,page:'category',source:'latest',style:'grid3',limit:3,columns:3};
 t.sections=[{...base,id:'movie-only',title:'电影专属模块',categoryEntry:'movie'},{...base,id:'series-only',title:'剧集专属模块',categoryEntry:'series'}];
 const movie=await render(t,'category','movie'),series=await render(t,'category','series');
 assert.match(movie,/电影专属模块/);assert.doesNotMatch(movie,/剧集专属模块/);
 assert.match(series,/剧集专属模块/);assert.doesNotMatch(series,/电影专属模块/);
});
test('approved player retains episode list and short drama retains its layout',async()=>{
 const player=await render(theme(),'player'),short=await render(theme(),'shortdrama');
 assert.match(player,/16集全/);assert.match(player,/player-scene.jpg/);
 assert.equal((player.match(/aria-label="第\d+集"/g)||[]).length,16);
 assert.match(short,/shortdrama-scene.jpg/);assert.match(short,/观看完整短剧·30集/);
});
