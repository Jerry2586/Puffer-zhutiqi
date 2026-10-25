const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const service=path.resolve(__dirname,'../shared-source/server');
const load=name=>import(pathToFileURL(path.join(service,name)).href);
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#8171ed" d="M2 12 L12 2 L22 12 V22 H2 Z"/></svg>');
test('navigation SVG, active artwork and icon size survive validation and ZIP round trip',async t=>{
 const {storeAsset,installPackage,readPackage}=await load('packages.mjs');
 const {validateTheme,defaultTheme}=await load('theme.mjs');
 const {exportTheme}=await load('export-theme.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-nav-'));t.after(()=>fs.rm(root,{force:true,recursive:true}));
 const url=await storeAsset(svg,'navigation.svg',path.join(root,'assets'));
 const theme=validateTheme(structuredClone(defaultTheme));theme.navigation[0].icon=url;theme.navigation[0].activeIcon=url;theme.visual.navigation.iconSize=32;
 theme.navigation.push({id:'custom-test',label:'自定义分类',page:'category',categoryId:'',enabled:true,icon:url,activeIcon:''});
 const draft=validateTheme(theme);const zip=await exportTheme({id:'nav-svg-test',name:'导航图标回归',platform:'mobile',draft},path.join(root,'assets'));
 const files=readPackage(zip);assert.equal([...files.keys()].filter(n=>n.endsWith('.svg')).length,1);
 const restored=await installPackage({data:zip.toString('base64')},path.join(root,'restored'));
 assert.deepEqual(restored.draft.navigation,draft.navigation);assert.equal(restored.draft.visual.navigation.iconSize,32);
 assert.deepEqual(await fs.readFile(path.join(root,'restored',path.basename(url))),svg);
});
test('SVG upload rejects active and external content and accepts static gradients',async()=>{
 const {isStaticSvg}=await load('svg.mjs');assert.equal(isStaticSvg(svg),true);
 for(const inner of ['<script>alert(1)</script>','<image href="https://example.com/a.png"/>','<path onload="alert(1)"/>','<foreignObject/>','<use href="https://example.com/a.svg#x"/>','<path style="fill:red"/>','<path fill="url(https://example.com)"/>','<path/>unexpected text']){
 assert.equal(isStaticSvg(Buffer.from('<svg>'+inner+'</svg>')),false,inner);
 }
 for(const source of ['<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///a">]><svg/>','<svg><g></svg>','<svg/><svg/>','<svg width="24" width="25"/>'])assert.equal(isStaticSvg(Buffer.from(source)),false);
 assert.equal(isStaticSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a"><stop offset="0%" stop-color="#fff"/></linearGradient></defs><path fill="url(#a)" d="M0 0"/></svg>')),true);
});
