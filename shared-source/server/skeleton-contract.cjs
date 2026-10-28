'use strict';
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function keys(value,allowed,label){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('骨架'+label+'字段不受支持');}
function validateSkeleton(input,sections=[],schema){
 if(input===undefined)return undefined;
 keys(input,['version','id','name','pages'],'定义');
 if(input.version!==1)throw Error('骨架协议版本不支持');
 if(typeof input.id!=='string'||!/^[a-zA-Z][\w-]{0,63}$/.test(input.id))throw Error('骨架编号无效');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>60)throw Error('骨架名称无效');
 keys(input.pages,Object.keys(schema.pages),'页面');
 if(!Object.keys(input.pages).length)throw Error('骨架必须声明页面');
 const pages={};
 for(const [page,value] of Object.entries(input.pages)){
  keys(value,['blocks'],'页面');
  if(!Array.isArray(value.blocks)||!value.blocks.length||value.blocks.length>32)throw Error('骨架区域数量需为1到32');
  const seen=new Set(),bindings=new Set(),components=new Set();let allContent=false;
  const blocks=value.blocks.map(block=>{
   keys(block,['id','component','visible','gap','sectionId'],'区域');
   if(typeof block.id!=='string'||!/^[a-zA-Z][\w-]{0,63}$/.test(block.id)||seen.has(block.id))throw Error('骨架区域编号无效或重复');
   seen.add(block.id);
   if(!schema.pages[page].includes(block.component))throw Error('骨架组件不支持当前页面');
   if(block.visible!==undefined&&typeof block.visible!=='boolean')throw Error('骨架显示状态无效');
   if(block.gap!==undefined&&(!Number.isInteger(block.gap)||block.gap<0||block.gap>64))throw Error('骨架区域间距超出范围');
   if(block.component!=='content'&&block.sectionId!==undefined)throw Error('只有影片栏目允许绑定内容模块');
   if(block.component==='content'){
    if(block.sectionId!==undefined){const s=sections.find(s=>s.id===block.sectionId);if(!s||(s.page||'home')!==page||bindings.has(block.sectionId)||allContent)throw Error('骨架栏目绑定无效或重复');bindings.add(block.sectionId);}
    else{if(allContent||bindings.size)throw Error('骨架全部栏目不能重复或与单独栏目混用');allContent=true;}
   }else if(components.has(block.component))throw Error('骨架功能区域重复');else components.add(block.component);
   return {id:block.id,component:block.component,...(block.visible!==undefined?{visible:block.visible}:{}),...(block.gap!==undefined?{gap:block.gap}:{}),...(block.sectionId!==undefined?{sectionId:block.sectionId}:{})};
  });pages[page]={blocks};
 }
 return {version:1,id:input.id,name:input.name.trim(),pages};
}

module.exports={validateSkeleton};
