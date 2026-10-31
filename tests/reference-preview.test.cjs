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
async function render(theme,page='home',categoryEntry='',extra={}){
 if(!compiled)compiled=(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-reference-render-'));
  const outfile=path.join(dir,'reference.cjs');
  try{
   await esbuild.build({stdin:{contents:`export {default as Component} from './components/MobileExperience.vue';export {default as Catalog} from './components/MobileCatalog.vue';export {themeForPage,categoryPageKey} from './domain/visual';export {skeletonBlocks,skeletonBlockForSelection} from './domain/skeleton';`,resolveDir:path.resolve(__dirname,'../shared-source/src'),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_HETUN_THEME_DESKTOP:'1'})},plugins:[{name:'actual-vue-components',setup(build){
    build.onResolve({filter:/^vue(?:\/server-renderer)?$/},args=>({path:dependency.resolve(args.path),external:true}));
    build.onResolve({filter:/^@\//},args=>({path:path.resolve(__dirname,'../shared-source/src',args.path.slice(2))+ (path.extname(args.path)?'':'.ts')}));
    build.onLoad({filter:/\.vue$/},async args=>{
     const source=await fs.readFile(args.path,'utf8');const {descriptor}=parse(source,{filename:args.path});
     const result=compileScript(descriptor,{id:'reference-test',inlineTemplate:true,templateOptions:{ssr:true,compilerOptions:{isCustomElement:tag=>/^[a-z]/.test(tag)}}});
     return {contents:result.content,loader:'ts',resolveDir:path.dirname(args.path)};
    });
   }}]});
   return require(outfile);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
 })();
 const {Component,themeForPage,categoryPageKey}=await compiled;
 theme=themeForPage(theme,page==='category'&&categoryEntry?categoryPageKey(categoryEntry):page);
 const app=createSSRApp(Component,{theme,page:page==='player'?'home':page,categoryEntry,playerPreview:page==='player',editing:true,items:[],categories:[],sections:[],sectionItems:{},film:null,playUrl:'',source:0,episode:0,favorite:false,loading:false,history:[],services:[],...extra});
 // UniApp's swiper host is provided by the client runtime; preserve its slot for SSR checks.
 for(const name of ['swiper','swiper-item','scroll-view'])app.component(name,{setup:(_,ctx)=>()=>h(name,ctx.attrs,ctx.slots.default?.())});
 return renderToString(app);
}
function theme(){return structuredClone(require('../shared-source/src/domain/default-theme.json'));}
test('shared mobile home uses configured carousel without fabricated films',async()=>{
 const t=theme();t.carousel.height=333;t.carousel.style='split';t.carousel.effect='fade';
 const html=await render(t);
 assert.match(html,/carousel-split/);assert.match(html,/height:333px/);
 assert.doesNotMatch(html,/front-hero|skeleton-reference|独行月球|共16集|投屏|一起看/);
});
test('shared mobile preview preserves uploaded carousel artwork and category overrides',async()=>{
 const t=theme();t.carousel.height=210;t.carousel.effect='fade';
 const artwork='/api/assets/'+ 'a'.repeat(64)+'.png';
 t.carousel.slides=[{id:'uploaded',title:'Custom carousel artwork',image:artwork,video:'',vodId:'',page:'home'}];
 const key='category'+Buffer.from('movie').toString('hex');
 t.pageDesign={[key]:{carousel:true,carouselDesign:{height:280,style:'split'}}};
 const categoryArtwork='/api/assets/'+'d'.repeat(64)+'.png';
 const home=await render(t);const movie=await render(t,'category','movie',{items:[{...film(),poster:categoryArtwork}]});
 assert.ok(home.includes(artwork));assert.ok(movie.includes(categoryArtwork));assert.ok(movie.includes(artwork));
 assert.match(home,/height:210px/);assert.match(movie,/height:280px/);assert.match(movie,/carousel-split/);
});
function film(){return {id:'r029-film',title:'真实接口影片',poster:'/assets/film.png',category:'电影',categoryId:'1',year:'2026',area:'中国',note:'更新2集',score:9.1,description:'来自影片详情的简介',actors:'主演甲',director:'导演乙',sources:[{name:'实际线路',episodes:[{name:'资源第一集',url:'https://media.example/1.mp4'},{name:'资源第二集',url:'https://media.example/2.mp4'}]}]};}
test('shared player displays actual film metadata and exact episode count',async()=>{
 const t=theme();t.brand.name='上传品牌';
 const html=await render(t,'player','',{film:film(),playUrl:'https://media.example/2.mp4',episode:1});
 for(const text of ['真实接口影片','来自影片详情的简介','资源第一集','资源第二集','https://media.example/2.mp4','上传品牌'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/共16集|共30集|投屏|一起看|实际线路|切换播放线路/);
});
test('shared home omits header brand shortcut while mine keeps uploaded logo and actual member state',async()=>{
 const t=theme();t.brand.logo='/api/assets/'+'b'.repeat(64)+'.png';
 const home=await render(t);const mine=await render(t,'mine','',{profile:{user_name:'实际用户',user_points:73,member_name:'年度会员'},history:[film()]});
 assert.doesNotMatch(home,/brand-dot/);assert.ok(mine.includes(t.brand.logo));
 for(const text of ['实际用户','73','年度会员','真实接口影片'])assert.ok(mine.includes(text),text);
});
test('editor and packaged client use the shared actual data renderer',async()=>{
 const editor=await fs.readFile(path.resolve(__dirname,'../renderer/workbench/ThemeWorkbench.vue'),'utf8');
 const controller=await fs.readFile(path.resolve(__dirname,'../shared-source/src/components/AppExperience.vue'),'utf8');
 assert.match(editor,/<AppExperience v-else/);assert.doesNotMatch(editor,/<ReferenceSkeleton/);assert.match(editor,/@category="chooseCategory"/);
 assert.match(controller,/<MobileExperience v-if="sharedMobile"/);
 assert.match(controller,/nativePhone=computed\(\(\)=>mobileClient.value\)/);
});

test('configured home modules do not add duplicate default rows or substitute latest films for missing manual data',async()=>{
 const t=theme();t.pageDesign={home:{carousel:false}};
 const sections=[{id:'manual',title:'精选手动栏目',enabled:true,source:'latest',orderBy:'manual',manualIds:'missing-id',style:'grid3',limit:6,columns:3}];
 const html=await render(t,'home','',{sections,items:[film()]});
 assert.match(html,/精选手动栏目/);assert.doesNotMatch(html,/快捷入口|今日给您的专属推荐|内容推荐|真实接口影片/);
});
test('category content uses currently filtered catalog instead of stale section data',async()=>{
 const t=theme();t.pageDesign={category:{carousel:false}};
 const section={id:'category-content',title:'筛选结果',enabled:true,source:'latest',style:'grid3',limit:6,columns:3};
 const stale={...film(),id:'stale',title:'过期分类数据'};
 const html=await render(t,'category','',{sections:[section],items:[film()],sectionItems:{'category-content':[stale]}});
 assert.match(html,/真实接口影片/);assert.doesNotMatch(html,/过期分类数据/);
});

test('imported definitions reorder the same live renderer and enable category carousels',async()=>{
 const t=theme();t.carousel.effect='fade';t.carousel.slides=[{id:'banner',title:'实际运营轮播',image:'/api/assets/'+ 'c'.repeat(64)+'.png',video:'',vodId:'1',page:'home'}];t.pageDesign={category:{carousel:false}};
 const def=(order)=>({version:1,id:'layout-'+order[0],name:'布局',pages:{category:{blocks:order.map(component=>({id:'region-'+component,component}))}}});
 t.skeleton.definition=def(['carousel','header','content']);const disabled=await render(t,'category','',{items:[film()]});assert.doesNotMatch(disabled,/class="carousel /);
 t.pageDesign.category.carousel=true;const first=await render(t,'category','',{items:[film()]});
 t.skeleton.definition=def(['header','content','carousel']);const second=await render(t,'category','',{items:[film()]});
 assert.ok(first.indexOf('data-region="region-carousel"')<first.indexOf('data-region="region-header"'));
 assert.ok(second.indexOf('data-region="region-header"')<second.indexOf('data-region="region-carousel"'));
 for(const html of [first,second]){assert.match(html,/真实接口影片/);assert.match(html,/实际运营轮播/);assert.doesNotMatch(html,/离线排版示意/);}
});

test('content selection maps section clicks to generic or explicitly bound skeleton blocks',async()=>{
 await render(theme());const {skeletonBlockForSelection,skeletonBlocks}=await compiled;
 const t=theme();t.sections=[{...t.sections[0],id:'custom-section',page:'home'}];
 assert.equal(skeletonBlockForSelection(t,'home','home-content').id,'content');
 assert.equal(skeletonBlockForSelection(t,'home','custom-section').id,'content');
 assert.equal(skeletonBlockForSelection(t,'category','custom-section'),undefined);
 t.skeleton.definition={version:1,id:'bound-layout',name:'独立骨架',pages:{home:{blocks:[{id:'bound',component:'content',sectionId:'custom-section'}]}}};
 assert.equal(skeletonBlockForSelection(t,'home','custom-section').id,'bound');
 assert.equal(skeletonBlockForSelection(t,'home','home-content'),undefined);
 assert.ok(skeletonBlocks(t,'shortdrama').some(b=>b.component==='carousel'));
 const controller=await fs.readFile(path.resolve(__dirname,'../shared-source/src/components/AppExperience.vue'),'utf8');
 assert.ok(controller.includes("page==='shortdrama'"));assert.ok(controller.includes('<MobileShortDrama'));
});


test('category layouts, filters and scoped modules remain independent',async()=>{
 await render(theme());const {skeletonBlocks,skeletonBlockForSelection}=await compiled;const t=theme();
 t.pageDesign={category:{categoryFilters:[{id:'generic',label:'通用子分类',categoryId:'8'}]},category6d6f766965:{categoryFilters:[{id:'action',label:'电影动作',categoryId:'6'}]},category736572696573:{categoryFilters:[]}};
 t.skeleton.definition={version:1,id:'isolated',name:'分类独立布局',pages:{category:{blocks:[{id:'fallback',component:'content'},{id:'filters',component:'filters'}]},category6d6f766965:{blocks:[{id:'movie-header',component:'header'},{id:'filters',component:'filters'},{id:'movies',component:'content'}]}}};
 t.sections=[{...t.sections[0],id:'only-movie',page:'category',categoryEntry:'movie'}];
 assert.equal(skeletonBlocks(t,'category6d6f766965')[0].id,'movie-header');assert.equal(skeletonBlocks(t,'category736572696573')[0].id,'fallback');
 assert.equal(skeletonBlockForSelection(t,'category736572696573','only-movie'),undefined);
 assert.equal(skeletonBlockForSelection(t,'category6d6f766965','only-movie').id,'movies');
 const movie=await render(t,'category','movie');const series=await render(t,'category','series');
 assert.doesNotMatch(movie,/电影动作|通用子分类/);assert.doesNotMatch(series,/电影动作|通用子分类/);assert.match(movie,/全部/);
 const {Catalog}=await compiled;const catalogApp=createSSRApp(Catalog,{theme:t,page:'category',items:[],discovery:[],categories:[],categoryId:'',query:'',attempted:false,loading:false,error:'',sections:[],sectionItems:{},manualFilters:t.pageDesign.category6d6f766965.categoryFilters,categoryEntry:'movie'});catalogApp.component('scroll-view',{setup:(_,ctx)=>()=>h('scroll-view',ctx.attrs,ctx.slots.default?.())});const filterHtml=await renderToString(catalogApp);assert.match(filterHtml,/电影动作/);assert.doesNotMatch(filterHtml,/通用子分类/);
});

test('campaign replaces generic category blocks and uses only the requested real films',async()=>{
 const t=theme();const id='activity',key='category6163746976697479';
 const film={id:'123',title:'实际推荐影片',poster:'/api/assets/'+ 'a'.repeat(64)+'.png',note:'已更新',year:'2026',area:'中国',category:'电影'};
 t.pageDesign={...t.pageDesign,[key]:{campaign:{title:'活动主题',subtitle:'精选内容',eyebrow:'特别企划',artwork:'',tone:'crimson',featuredId:'missing',bannerTitle:'发现好片',bannerText:'',bannerLabel:'搜索',bannerPage:'search',groupIds:['activity-group']}}};
 t.sections.push({id:'activity-group',title:'活动指定片单',subtitle:'专题内容',page:'category',categoryEntry:id,source:'latest',categoryId:'',orderBy:'manual',manualIds:'123',kind:'landscape',limit:4,columns:2,enabled:true});
 let html=await render(t,'category',id,{items:[film],sectionItems:{'activity-group':[film]},editing:false});
 assert.match(html,/data-campaign/);assert.match(html,/活动主题/);assert.match(html,/活动指定片单/);assert.match(html,/实际推荐影片/);
 assert.match(html,/查看活动推荐影片/);assert.doesNotMatch(html,/theme-carousel|content-grid|category-filter/);
 assert.equal((html.match(/campaign-film\b/g)||[]).length,1);
 html=await render(t,'category',id,{items:[],sectionItems:{},editing:false});
 assert.match(html,/片单内容待接入/);assert.doesNotMatch(html,/实际推荐影片/);
 const home=await render(t);assert.doesNotMatch(home,/data-campaign/);
});
