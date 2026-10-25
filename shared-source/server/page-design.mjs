import {readFileSync} from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../src/domain/visual-schema.json',import.meta.url),'utf8'));
export const designPages=['home','category','search','shortdrama','member','mine','ranking','schedule','library','history','settings','disclaimer','privacy','about','player','together','detail','login','downloads','feedback','orders','recharge','dialog','empty'];
export function validatePageDesign(input){
 if(input===undefined)return {};
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('页面设计格式无效');
 const result={};
 for(const [page,config]of Object.entries(input)){
  if(!(designPages.includes(page)||/^category(?:[0-9a-f]{2}){1,64}$/.test(page))||!config||typeof config!=='object'||Array.isArray(config))throw Error('页面设计编号或内容无效');
  if(Object.keys(config).some(k=>!['background','backgroundImage','visual','carousel','carouselDesign','moduleOrder','modules'].includes(k)))throw Error('页面设计包含未知字段');
  const value={};
  if(config.background!==undefined){if(!/^#(?:[a-f0-9]{6}|[a-f0-9]{8})$/i.test(config.background))throw Error('页面背景颜色无效');value.background=config.background;}
  if(config.backgroundImage!==undefined){if(typeof config.backgroundImage!=='string'||config.backgroundImage&&!/^\/api\/assets\/[a-f0-9]{64}\.(png|jpg|webp|svg)$/.test(config.backgroundImage))throw Error('页面背景图片须为本机上传图片');value.backgroundImage=config.backgroundImage;}
  if(config.carousel!==undefined){if(typeof config.carousel!=='boolean')throw Error('轮播位置状态无效');value.carousel=config.carousel;}
  if(config.carouselDesign!==undefined){
   const c=config.carouselDesign;
   if(!c||typeof c!=='object'||Array.isArray(c))throw Error('页面轮播设计格式无效');
   const ranges={height:[120,560],radius:[0,40],margin:[0,36],interval:[2,30]};
   const choices={style:['full','inset','peek','poster','split','video'],fit:['cover','contain'],titlePosition:['bottom','side','hidden'],indicator:['dots','numbers','none'],effect:['slide','fade']};
   value.carouselDesign={};
   for(const [k,v] of Object.entries(c)){
    if(Object.hasOwn(ranges,k)){const [min,max]=ranges[k];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('页面轮播尺寸无效');}
    else if(Object.hasOwn(choices,k)){if(!choices[k].includes(v))throw Error('页面轮播样式无效');}
    else if(['autoplay','muted'].includes(k)){if(typeof v!=='boolean')throw Error('页面轮播状态无效');}
    else throw Error('未知页面轮播属性');
    value.carouselDesign[k]=v;
   }
  }
  if(config.moduleOrder!==undefined){
   if(!Array.isArray(config.moduleOrder)||config.moduleOrder.length>44||new Set(config.moduleOrder).size!==config.moduleOrder.length||config.moduleOrder.some(id=>typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(id)))throw Error('页面模块顺序无效');
   value.moduleOrder=[...config.moduleOrder];
  }
  if(config.modules!==undefined){
   const modules=config.modules;
   if(!modules||typeof modules!=='object'||Array.isArray(modules)||Object.keys(modules).length>3||!(page==='home'||page==='category'||/^category(?:[0-9a-f]{2}){1,64}$/.test(page)))throw Error('页面模块设置无效');
   value.modules={};
   for(const [id,settings] of Object.entries(modules)){
    if(!(page==='home'?['highlights','recommendations','content']:['content']).includes(id)||!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('未知页面模块');
    const clean={};
    for(const [k,v] of Object.entries(settings)){
     if(k==='title'){if(typeof v!=='string'||v.length>40)throw Error('模块标题无效');}
     else if(k==='subtitle'){if(typeof v!=='string'||v.length>80)throw Error('模块副标题无效');}
     else if(k==='style'){if(!['grid2','grid3','scroll','list','ranking','mosaic'].includes(v))throw Error('模块样式无效');}
     else if(k==='limit'){if(!Number.isInteger(v)||v<1||v>60)throw Error('模块数量无效');}
     else if(['visible','showTitle','showScore','showNote','showYear','showMore'].includes(k)){if(typeof v!=='boolean')throw Error('模块状态无效');}
     else if(k==='columns'){if(!Number.isInteger(v)||v<1||v>6)throw Error('模块列数无效');}
     else if(['background','textColor'].includes(k)){if(typeof v!=='string'||!/^#(?:[a-f0-9]{6}|[a-f0-9]{8})$/i.test(v))throw Error('模块颜色无效');}
     else if(k==='ratio'){if(!['2/3','3/4','16/9','1/1'].includes(v))throw Error('模块图片比例无效');}
     else if(k==='radius'){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>40)throw Error('模块圆角无效');}
     else if(k==='titleSize'){if(typeof v!=='number'||!Number.isFinite(v)||v<10||v>32)throw Error('模块字号无效');}
     else if(k==='gap'){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>40)throw Error('模块间距无效');}
     else throw Error('未知模块设置');
     clean[k]=v;
    }
    value.modules[id]=clean;
   }
  }
  if(config.visual!==undefined){
   if(!config.visual||typeof config.visual!=='object'||Array.isArray(config.visual))throw Error('页面外观格式无效');
   value.visual={};
   for(const [group,fields]of Object.entries(config.visual)){
    if(!Object.hasOwn(schema,group)||!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('未知页面组件');
    const validated={};
    for(const [key,v]of Object.entries(fields)){
     if(!Object.hasOwn(schema[group].fields,key))throw Error('未知页面设计属性');const f=schema[group].fields[key];
     if(f.type==='color'?(typeof v!=='string'||!/^#(?:[a-f0-9]{6}|[a-f0-9]{8})$/i.test(v)):(typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max))throw Error('页面设计属性无效：'+group+'.'+key);
     validated[key]=v;
    }value.visual[group]=validated;
   }
  }result[page]=value;
 }return result;
}
