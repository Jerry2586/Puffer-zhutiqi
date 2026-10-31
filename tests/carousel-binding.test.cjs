'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module');
const dependency=createRequire(path.join(require('../scripts/environment.cjs').environment().deps,'package.json'));
const {createSSRApp,h}=dependency('vue'),{renderToString}=dependency('@vue/server-renderer'),{parse,compileScript}=dependency('@vue/compiler-sfc');
let compiled;
async function runtime(){
 if(!compiled)compiled=(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-carousel-')),outfile=path.join(dir,'runtime.cjs');
  try{
   await dependency('esbuild').build({stdin:{contents:"export {default as Carousel} from './shared-source/src/components/ThemeCarousel.vue';export {default as FilmModule} from './shared-source/src/components/FilmModule.vue';export {default as MobileExperience} from './shared-source/src/components/MobileExperience.vue';export {mergePreview} from './renderer/workbench/operations-preview';",resolveDir:path.resolve(__dirname,'..')},bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'actual-carousel',setup(build){
    build.onResolve({filter:/^vue(?:\/.*)?$/},args=>({path:dependency.resolve(args.path),external:true}));
    build.onResolve({filter:/^@\//},args=>({path:path.resolve(__dirname,'../shared-source/src',args.path.slice(2))+(path.extname(args.path)?'':'.ts')}));
    build.onLoad({filter:/\.vue$/},async args=>{
     const {descriptor}=parse(await fs.readFile(args.path,'utf8'),{filename:args.path});
     return {contents:compileScript(descriptor,{id:'carousel-test',inlineTemplate:true,templateOptions:{ssr:true,compilerOptions:{isCustomElement:tag=>/^[a-z]/.test(tag)}}}).content,loader:'ts',resolveDir:path.dirname(args.path)};
    });
   }}]});return require(outfile);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
 })();return compiled;
}
const theme=()=>{const value=structuredClone(require('../shared-source/src/domain/default-theme.json'));value.carousel.autoplay=false;return value;};
const film={id:'film-a',title:'不得自动作为轮播的影片',poster:'/film-poster.jpg',categoryId:'6'};
async function render(t,extra={}){const {Carousel}=await runtime();return renderToString(createSSRApp(Carousel,{theme:t,items:[film],...extra}));}
test('a populated film feed does not generate carousel slides or leave an empty carousel region',async()=>{
 const t=theme();t.carousel.slides=[];
 for(const page of ['home','category'])for(const effect of ['fade','slide']){t.carousel.effect=effect;const html=await render(t,{page});assert.doesNotMatch(html,/class="carousel|film-poster|不得自动作为轮播|精彩即将呈现/);}
});
test('explicitly bound slides render on category pages, and clearing the binding hides them',async()=>{
 const t=theme();t.carousel.effect='fade';t.carousel.slides=[{id:'bound',title:'运营绑定横幅',image:'/operations-banner.jpg',video:'',vodId:'film-a',page:'home'}];
 const html=await render(t,{page:'category'});assert.match(html,/运营绑定横幅/);assert.match(html,/operations-banner.jpg/);assert.doesNotMatch(html,/film-poster.jpg/);
 t.carousel.slides=[];assert.doesNotMatch(await render(t,{page:'category'}),/class="carousel/);
});
test('editor-only placeholders remain available without appearing in the live experience',async()=>{
 const t=theme();t.carousel.slides=[];t.carousel.effect='fade';
 const preview=await render(t,{designPreview:true});assert.match(preview,/data-carousel-layout/);assert.doesNotMatch(preview,/离线排版示意|design-art|光影之间|发现好故事|轮播图区域/);assert.doesNotMatch(await render(t),/class="carousel/);
});
test('operations bootstrap owns carousel content and never inherits imported theme slides',async()=>{
 const {mergePreview}=await runtime(),t=theme();const slide={id:'bound',title:'绑定',image:'/bound.jpg',video:'',vodId:'film-a',page:'home'};t.carousel.slides=[{...slide,id:'old',image:'/old.jpg'}];
 const boot=config=>({contract:'hetun-operations-v1',schemaVersion:1,themeContract:'hetun-runtime-v1',platform:'mobile',version:1,config});
 assert.deepEqual(mergePreview(t,boot({}),'mobile').carousel.slides,[]);
 assert.deepEqual(mergePreview(t,boot({carousel:{slides:[slide]}}),'mobile').carousel.slides,[slide]);
 assert.deepEqual(mergePreview(t,boot({carousel:{slides:[]}}),'mobile').carousel.slides,[]);
 assert.equal(t.carousel.slides[0].id,'old');
});

test('layout preview preserves the empty carousel frame and its configured dimensions without binding films',async()=>{
 const t=theme();t.carousel.slides=[];t.carousel.height=216;t.carousel.radius=14;
 for(const effect of ['fade','slide']){t.carousel.effect=effect;const html=await render(t,{layoutPreview:true});assert.match(html,/data-carousel-layout/);assert.match(html,/height:216px/);assert.match(html,/--radius:14px/);assert.doesNotMatch(html,/轮播排版预览|轮播图区域|高度 216px/);assert.doesNotMatch(html,/film-poster|不得自动作为轮播|离线排版示意|<swiper/);}
});
async function renderFilms(section,extra={}){const {FilmModule}=await runtime();return renderToString(createSSRApp(FilmModule,{theme:theme(),section:{id:'layout',title:'影片栏目',subtitle:'',kind:'poster',source:'latest',categoryId:'',enabled:true,...section},items:[],...extra}));}
test('empty design sections display the configured number of cards and columns',async()=>{
 for(const [columns,limit] of [[2,4],[3,6],[4,8]]){const html=await renderFilms({columns,limit,style:'grid3'},{layoutPreview:true});assert.equal((html.match(/data-layout-placeholder/g)||[]).length,limit);assert.match(html,new RegExp('--cols:'+columns));assert.doesNotMatch(html,/排版预览|影片标题|更新状态|播放页预览|layout-number/);assert.equal((html.match(/title-slot/g)||[]).length,limit);assert.doesNotMatch(html,/这里暂时还没有影片/);}
});
test('layout cards stay out of live empty states and disappear once real films are available',async()=>{
 const section={columns:2,limit:4,style:'grid2'};
 const live=await renderFilms(section);assert.doesNotMatch(live,/data-layout-placeholder|排版预览/);assert.match(live,/这里暂时还没有影片/);
 const populated=await renderFilms(section,{layoutPreview:true,items:[film]});assert.match(populated,/不得自动作为轮播的影片/);assert.doesNotMatch(populated,/data-layout-placeholder|排版预览/);
 const editing=await renderFilms(section,{editing:true});assert.equal((editing.match(/data-layout-placeholder/g)||[]).length,4);
});
test('empty preview counts stay bounded while retaining the configured list layout',async()=>{
 const html=await renderFilms({columns:99,limit:1000,style:'list'},{layoutPreview:true});assert.equal((html.match(/data-layout-placeholder/g)||[]).length,60);assert.match(html,/style-list/);assert.match(html,/--cols:6/);assert.doesNotMatch(html,/排版预览|layout-caption/);
});

async function renderPlayer(extra={}){const {MobileExperience}=await runtime();const app=createSSRApp(MobileExperience,{theme:theme(),page:'home',items:[],categories:[],sections:[],sectionItems:{},film:null,playerPreview:true,playUrl:'',source:0,episode:0,favorite:false,loading:false,history:[],services:[],studio:true,...extra});app.component('scroll-view',{setup:(_,ctx)=>()=>h('scroll-view',ctx.attrs,ctx.slots.default?.())});return renderToString(app);}
test('player layout preview shows the full player, metadata and neutral episode strip without inventing a film',async()=>{
 const html=await renderPlayer();assert.match(html,/video-frame/);assert.match(html,/返回影片列表/);assert.match(html,/播放器排版预览/);assert.match(html,/影片标题/);assert.match(html,/data-player-layout/);assert.match(html,/data-episode-layout/);assert.equal((html.match(/class="episode-layout-slot"/g)||[]).length,6);assert.equal((html.match(/aria-label="VIP选集"/g)||[]).length,4);assert.match(html,/VIP 角标示意/);assert.doesNotMatch(html,/<video|播放第1集|立即续费|播放线路|线路名称/);
});
test('real movie metadata and actual episodes replace player layout placeholders while playback keeps its back button',async()=>{
 const actual={...film,year:'2026',area:'测试地区',category:'电影',score:'8.5',note:'更新至2集',description:'真实接口简介',sources:[{name:'真实线路',episodes:[{name:'正片上',url:'https://media.example/a.mp4'},{name:'正片下',url:'https://media.example/b.mp4'}]}]};
 const html=await renderPlayer({film:actual,playerPreview:false,playUrl:'https://media.example/a.mp4'});assert.match(html,/<video/);assert.ok(html.includes('src="https://media.example/a.mp4"'));assert.match(html,/返回影片列表/);assert.match(html,/真实接口简介/);assert.doesNotMatch(html,/真实线路|切换播放线路|line-row/);assert.match(html,/正片上/);assert.match(html,/正片下/);assert.doesNotMatch(html,/data-player-layout|data-episode-layout|播放器排版预览/);
});
test('design card metadata respects the same visibility settings as populated cards',async()=>{
 const html=await renderFilms({limit:2,showTitle:false,showScore:false,showNote:false,showYear:true},{layoutPreview:true});assert.equal((html.match(/year-slot/g)||[]).length,2);assert.doesNotMatch(html,/title-slot|年份 · 分类/);assert.match(html,/查看播放页面排版/);assert.doesNotMatch(html,/影片标题|评分|更新状态/);
});

test('real episode VIP badges require explicit metadata and never infer membership from protected delivery',async()=>{
 const actual={...film,protected:true,note:'',sources:[{name:'运营自动选择',episodes:[{name:'免费一',url:''},{name:'免费二',url:'',vip:false},{name:'会员三',url:'',vip:true}]}]};
 const html=await renderPlayer({film:actual,playerPreview:false});assert.equal((html.match(/aria-label="VIP选集"/g)||[]).length,1);assert.match(html,/免费一/);assert.match(html,/免费二/);assert.match(html,/会员三/);assert.doesNotMatch(html,/运营自动选择|VIP 角标示意/);
 actual.sources[0].episodes[2].vip=false;assert.doesNotMatch(await renderPlayer({film:actual,playerPreview:false}),/aria-label="VIP选集"/);
});
test('mobile recommendation headings keep their cards while hiding More even for imported sections that enable it',async()=>{
 const section={id:'home-content',title:'今日给您的专属推荐',subtitle:'',enabled:true,kind:'poster',source:'latest',style:'grid3',columns:3,limit:6,showMore:true};
 const html=await renderPlayer({playerPreview:false,sections:[section]});assert.match(html,/今日给您的专属推荐/);assert.equal((html.match(/data-layout-placeholder/g)||[]).length,6);assert.doesNotMatch(html,/更多 ›|class="more"/);
});

test('bound carousel metadata is preserved without invented media or playback actions',async()=>{
 const t=theme();t.carousel.slides=[{id:'empty-bound',title:'运营标题',image:'',video:'',vodId:'',page:'home'}];t.carousel.effect='fade';
 const html=await render(t,{designPreview:true});assert.match(html,/运营标题/);assert.doesNotMatch(html,/<image|design-art|轮播素材尚未配置|立即观看/);
});
test('profile membership visibility and account identity survive the lighter layout',async()=>{
 const t=theme();t.features.memberCard=true;
 const html=await renderPlayer({theme:t,page:'mine',playerPreview:false,profile:{user_name:'真实用户',user_points:36,member_name:'年度会员'}});
 assert.match(html,/真实用户/);assert.match(html,/年度会员/);assert.match(html,/立即续费/);assert.match(html,/aria-label="打开账户"/);
 t.features.memberCard=false;const hidden=await renderPlayer({theme:t,page:'mine',playerPreview:false});assert.ok(hidden.includes('登录 / 注册'));assert.doesNotMatch(hidden,/vip-bottom|开通会员/);
});
