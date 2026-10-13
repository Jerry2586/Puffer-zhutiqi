'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../core/authorization-ui/app.js'), 'utf8');
function harness({valid=false, configured=true, reject=false}={}) {
  const elements = new Map(), calls = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {id, value:'', type:'password', hidden:false, disabled:false, textContent:'', firstChild:{textContent:''}, attributes:{}, listeners:{}, classList:{toggle(){}}, setAttribute(k,v){this.attributes[k]=v;}, addEventListener(k,v){this.listeners[k]=v;}, focus(){this.focused=true;}});
    return elements.get(id);
  }
  for (const id of ['activation','authorized-actions','status','intro','form-title','export','import','migration','activate','key','toggle-key','password','continue','check','error','notice']) element(id);
  let current = {valid, configured, message:valid?'在线授权':'请先联网输入 Key 激活', offlineMigration:false};
  const bridge = {onStatus(){}, async call(action,input) {
    calls.push({action,input});
    if (action==='activate') {
      if (reject) return {ok:false,error:'此 Key 未授权主题中心'};
      current={...current, valid:true, message:'在线授权'};
    }
    return {ok:true,value: action==='status'?current:{}};
  }};
  vm.runInNewContext(script, {window:{authorization:bridge}, document:{getElementById:element,querySelectorAll:()=>[...elements.values()].filter(x=>['export','import','activate','toggle-key','continue','check'].includes(x.id))}});
  return {element,calls,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('first activation rejects malformed keys locally and keeps protected entry hidden', async()=>{
  const h=harness();await h.settle();h.element('key').value='bad';h.element('activation').listeners.submit({preventDefault(){}});await h.settle();
  assert.match(h.element('error').textContent,/完整授权 Key/);assert.equal(h.calls.some(x=>x.action==='activate'),false);assert.equal(h.element('authorized-actions').hidden,true);
});
test('valid key is trimmed and enters only after backend confirms a valid local authorization', async()=>{
  const h=harness();await h.settle();const key='HTN_'+'a'.repeat(43);h.element('key').value=' '+key+' ';h.element('activation').listeners.submit({preventDefault(){}});await h.settle();
  assert.equal(h.calls.find(x=>x.action==='activate').input.key,key);assert.equal(h.calls.at(-1).action,'continue');assert.equal(h.element('key').value,'');assert.equal(h.element('activation').hidden,true);
});
test('denied activation displays backend error without opening software or leaving buttons locked',async()=>{
  const h=harness({reject:true});await h.settle();h.element('key').value='HTN_'+'b'.repeat(43);h.element('activation').listeners.submit({preventDefault(){}});await h.settle();
  assert.match(h.element('error').textContent,/未授权主题中心/);assert.equal(h.calls.some(x=>x.action==='continue'),false);assert.equal(h.element('activate').disabled,false);assert.equal(h.element('authorized-actions').hidden,true);
});
test('unconfigured installation disables activation and migration; migration requires password',async()=>{
  const h=harness({configured:false});await h.settle();assert.equal(h.element('activate').disabled,true);assert.equal(h.element('import').disabled,true);
  const configured=harness();await configured.settle();configured.element('import').listeners.click();assert.match(configured.element('error').textContent,/迁移包密码/);assert.equal(configured.calls.some(x=>x.action==='import'),false);
});
