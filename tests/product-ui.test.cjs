const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const source=fs.readFileSync('renderer/workbench/ProductCenter.vue','utf8');
function harness(fail=false){const code=source.slice(source.indexOf('function apply('),source.indexOf('const announcements=')).replaceAll(' as any','').replaceAll(':any','').replaceAll(':string','');const context={state:{value:{}},error:{value:''},detail:{value:null},downloaded:{value:''},busy:{value:false},key:{value:''},emit(){},desktop:false,updateDialog:{value:false},dismissedUpdate:{value:''},dismissedNotices:new Set(),force:{value:false},release:{value:null},computed:fn=>({get value(){return fn();}}),window:{},request:async action=>{if(fail&&action==='ack')throw Error('回执保存失败');return {items:[],history:[],error:'终端同步失败'};}};vm.createContext(context);vm.runInContext(code,context);return context;}
test('remote synchronization errors survive successful local polling',async()=>{const h=harness();await h.refresh();assert.equal(h.error.value,'终端同步失败');});
test('failed announcement confirmation leaves the announcement open',async()=>{const h=harness(true);h.detail.value={id:'notice',revision:1,requireConfirmation:true};await h.close();assert.equal(h.detail.value.id,'notice');assert.equal(h.error.value,'回执保存失败');});
test('successful announcement confirmation closes the announcement',async()=>{const h=harness();h.detail.value={id:'notice',revision:1,requireConfirmation:true};await h.close();assert.equal(h.detail.value,null);});


test('关闭强制更新弹窗只隐藏弹窗，不确认公告',()=>{const h=harness();h.force.value=true;h.release.value={id:'release-a'};h.updateDialog.value=true;h.dismiss();assert.equal(h.dismissedUpdate.value,'release-a');assert.equal(h.updateDialog.value,false);assert.equal(h.force.value,true);});
test('关闭公告不会伪造已确认回执，同一公告不立即再次弹出',()=>{const h=harness();h.detail.value={id:'notice',revision:1,requireConfirmation:true};h.dismiss();assert.equal(h.detail.value,null);assert.equal(h.dismissedNotices.has('notice:1'),true);});

test('桌面点击下载走校验后安装流程',async()=>{const h=harness();h.desktop=true;let actions=[];h.request=async name=>{actions.push(name);return name==='state'?{items:[],history:[]}:{};};await h.act('download');assert.deepEqual(actions,['update','state']);assert.equal(h.error.value,'');});
