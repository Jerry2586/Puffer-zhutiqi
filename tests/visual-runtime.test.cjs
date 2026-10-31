'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
let runtime;
async function visual(){
 if(!runtime)runtime=(async()=>{
  const root=path.resolve(__dirname,'../shared-source/src/domain');
  const schema=await fs.readFile(path.join(root,'visual-schema.json'),'utf8');
  const category='data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(await fs.readFile(path.join(root,'category.ts'),'utf8'))).toString('base64');
  const source=(await fs.readFile(path.join(root,'visual.ts'),'utf8')).replace("import schema from './visual-schema.json';",'const schema='+schema+';').replace("'./category'",JSON.stringify(category));
  return import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
 })();
 return runtime;
}
test('page appearance inherits globals without leaking overrides into another screen',async()=>{
 const {themeForPage,visualVariables}=await visual();
 const theme={colors:{background:'#000000',surface:'#111111',text:'#ffffff',muted:'#888888',accent:'#123456'},visual:{cards:{radius:11,size:14}},pageDesign:{category:{background:'#11223380',visual:{cards:{radius:20}}},player:{visual:{player:{progress:'#abcdef'}}}}};
 const before=JSON.stringify(theme);
 const category=themeForPage(theme,'category');
 assert.equal(category.colors.background,'#11223380');
 assert.equal(category.visual.cards.radius,20);
 assert.equal(category.visual.cards.size,14);
 assert.equal(themeForPage(theme,'home').visual.cards.radius,11);
 assert.equal(visualVariables(category)['--design-cards-radius'],'20px');
 assert.equal(visualVariables(themeForPage(theme,'player'))['--design-player-progress'],'#abcdef');
 assert.equal(JSON.stringify(theme),before);
 delete theme.pageDesign.category.visual.cards.radius;
 assert.equal(themeForPage(theme,'category').visual.cards.radius,11);
 theme.visual.cards.radius=16;
 assert.equal(themeForPage(theme,'category').visual.cards.radius,16);
});
test('film navigation uses detail and player appearance instead of originating page',async()=>{
 const {visualPageContext}=await visual();
 assert.equal(visualPageContext('home',false,false),'home');
 assert.equal(visualPageContext('category',true,false),'detail');
 assert.equal(visualPageContext('category',true,true),'player');
 assert.equal(visualPageContext('search',false,false),'search');
});
test('contextual editor avoids unrelated controls and returns independent lists',async()=>{
 const {visualGroupsForPage,visualSchema}=await visual();
 assert.ok(!visualGroupsForPage('category').includes('player'));
 assert.ok(visualGroupsForPage('player').includes('player'));
 assert.ok(!visualGroupsForPage('player').includes('carousel'));
 assert.deepEqual(visualGroupsForPage(),Object.keys(visualSchema));
 assert.deepEqual(visualGroupsForPage('unrecognized'),[]);
 const copy=visualGroupsForPage('home');copy.length=0;
 assert.ok(visualGroupsForPage('home').length>0);
});

test('every page property group is registered in the visual schema',async()=>{
 const {visualGroupsForPage,visualSchema}=await visual();
 const pages=['home','category','search','ranking','schedule','shortdrama','member','mine','library','history','settings','disclaimer','privacy','about','detail','player','login','downloads','feedback','orders','recharge','dialog','empty'];
 for(const page of pages)for(const group of visualGroupsForPage(page))assert.ok(Object.hasOwn(visualSchema,group),`${page}: unknown visual group ${group}`);
 assert.ok(visualGroupsForPage('category').includes('navigation'));
});

test('page carousel overrides inherit remaining fields without modifying global or other pages',async()=>{
 const {themeForPage}=await visual();
 const theme={colors:{background:'#000000'},visual:{},carousel:{height:200,radius:8,autoplay:true,slides:[{id:'one'}]},pageDesign:{home:{carouselDesign:{height:320,autoplay:false}},category:{carouselDesign:{radius:20}}}};
 const before=JSON.stringify(theme);
 assert.equal(themeForPage(theme,'home').carousel.height,320);
 assert.equal(themeForPage(theme,'home').carousel.autoplay,false);
 assert.equal(themeForPage(theme,'category').carousel.height,200);
 assert.equal(themeForPage(theme,'category').carousel.radius,20);
 assert.equal(themeForPage(theme,'home').carousel.radius,8);
 assert.deepEqual(themeForPage(theme,'home').carousel.slides,theme.carousel.slides);
 assert.equal(JSON.stringify(theme),before);
});


test('configured category entries keep order and stable appearance across rename and CMS rebinding',async()=>{
 const {categoryPages,categoryPageKey,themeForPage,pageDesignFor,visualGroupsForPage}=await visual();
 const theme={categories:[{id:'home',label:'首页',page:'home',enabled:true},{id:'series',label:'电视剧',page:'category',enabled:true},{id:'movie',label:'电影',page:'category',enabled:true},{id:'hidden',page:'category',enabled:false}],colors:{background:'#000000'},visual:{cards:{size:14}},carousel:{height:200,radius:8,autoplay:true},pageDesign:{category:{visual:{cards:{radius:12}},carouselDesign:{height:240,radius:10}},'category6d6f766965':{visual:{cards:{gap:17}},carouselDesign:{height:320},moduleOrder:['hero','category-content']}}};
 const before=JSON.stringify(theme);
 assert.deepEqual(categoryPages(theme).map(n=>n.id),['series','movie']);
 const movie=themeForPage(theme,categoryPageKey('movie'));
 assert.equal(movie.carousel.height,320);assert.equal(movie.carousel.radius,10);
 assert.equal(movie.visual.cards.radius,12);assert.equal(movie.visual.cards.gap,17);assert.equal(movie.visual.cards.size,14);
 assert.equal(themeForPage(theme,categoryPageKey('series')).carousel.height,240);
 assert.deepEqual(pageDesignFor(theme,'category6d6f766965').moduleOrder,['hero','category-content']);
 assert.deepEqual(visualGroupsForPage('category6d6f766965'),visualGroupsForPage('category'));
 assert.equal(JSON.stringify(theme),before);
 theme.categories[2].label='新的电影名称';theme.categories[2].categoryId='77';theme.categories.reverse();
 assert.equal(themeForPage(theme,categoryPageKey('movie')).carousel.height,320);
 assert.deepEqual(categoryPages(theme).map(n=>n.id),['movie','series']);
});

test('fixed module templates resolve all six styles and isolate category overrides',async()=>{
 const {fixedModule,pageDesignFor,categoryPageKey}=await visual();
 const theme={colors:{background:'#000000'},visual:{cards:{radius:12}},layout:{posterRadius:8},carousel:{},pageDesign:{category:{modules:{content:{style:'list',gap:9,showScore:false}}},[categoryPageKey('movie')]:{modules:{content:{columns:2,style:'mosaic'}}},home:{modules:{highlights:{style:'scroll',limit:10}}}}};
 const before=JSON.stringify(theme);
 assert.equal(fixedModule(theme,'home','home-highlights').limit,10);
 for(const style of ['grid2','grid3','scroll','list','ranking','mosaic']){
  theme.pageDesign.home.modules.highlights.style=style;
  assert.equal(fixedModule(theme,'home','home-highlights').style,style);
 }
 theme.pageDesign.home.modules.highlights.style='scroll';
 const movie=fixedModule(theme,categoryPageKey('movie'),'category-content');
 assert.equal(movie.style,'mosaic');assert.equal(movie.columns,2);assert.equal(movie.gap,9);assert.equal(movie.showScore,false);
 assert.equal(fixedModule(theme,categoryPageKey('series'),'category-content').style,'list');
 assert.equal(fixedModule(theme,'home','home-content').style,'grid3');
 assert.equal(JSON.stringify(theme),before);
});
