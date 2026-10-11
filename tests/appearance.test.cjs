'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createAppearance}=require('../core/appearance.cjs'),{repairShortcuts}=require('../core/windows-shortcuts.cjs');
test('appearance persists rapid selections, rejects invalid values and restores before a window exists',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-appearance-'));try{
  const nativeTheme={},colors=[],prefs=createAppearance({root,nativeTheme,getWindow:()=>({setBackgroundColor:c=>colors.push(c)})});
  assert.equal(await prefs.load(),'dark');assert.equal(nativeTheme.themeSource,'dark');
  await Promise.all([prefs.set('light'),prefs.set('dark'),prefs.set('light')]);
  assert.equal(nativeTheme.themeSource,'light');assert.equal(colors.at(-1),'#f2f4f7');
  await assert.rejects(prefs.set('system'));assert.equal(prefs.get(),'light');
  const restored=createAppearance({root,nativeTheme,getWindow:()=>null});assert.equal(await restored.load(),'light');
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'desktop-appearance.json'))).mode,'light');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('shortcut repair updates only existing shortcuts targeting this installed executable',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hetun-shortcut-'));const previous=process.env.HETUN_THEME_DATA;delete process.env.HETUN_THEME_DATA;
 try{
  const icon=path.join(root,'source.ico');await fs.copyFile(path.join(__dirname,'../assets/theme-center.ico'),icon);
  await fs.writeFile(path.join(root,'河豚主题中心.lnk'),'old shortcut');
  const updates=[],exe=path.join(root,'installed.exe');const shell={readShortcutLink:file=>({target:file.startsWith(root)?exe:path.join(root,'other.exe'),icon:'old.ico',iconIndex:0}),writeShortcutLink:(file,op,options)=>{updates.push({file,op,options});require('node:fs').writeFileSync(file,'fresh shortcut');return true;}};
  const args={root,sourceIcon:icon,exe,platform:'win32',app:{isPackaged:true,getVersion:()=> '0.2.4',getPath:()=>root},shell};
  assert.equal((await repairShortcuts(args)).length,1);assert.equal(updates[0].op,'create');assert.equal(await fs.readFile(path.join(root,'河豚主题中心.lnk'),'utf8'),'fresh shortcut');assert.equal(updates[0].options.target,exe);assert.equal(updates[0].options.appUserModelId,'com.hetun.theme-center');
  assert.deepEqual(await fs.readFile(updates[0].options.icon),await fs.readFile(icon));
  shell.readShortcutLink=()=>({target:path.join(root,'other.exe')});assert.deepEqual(await repairShortcuts(args),[]);assert.equal(updates.length,1);
  process.env.HETUN_THEME_DATA=root;assert.deepEqual(await repairShortcuts(args),[]);
 }finally{if(previous===undefined)delete process.env.HETUN_THEME_DATA;else process.env.HETUN_THEME_DATA=previous;await fs.rm(root,{recursive:true,force:true});}
});
