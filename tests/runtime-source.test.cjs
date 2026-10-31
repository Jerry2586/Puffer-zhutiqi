'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {authoringFiles, adapters, policyId, policySha256, checkRuntimeSnapshot} = require('../scripts/runtime-source.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function put(root, file, text) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), {recursive:true});
  await fs.writeFile(target, text);
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hetun-runtime-test-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const source = path.join(root, 'source'), client = path.join(root, 'client');
  const files = [...adapters, 'src/pages/skeleton/index.vue', 'src/components/AppExperience.vue'];
  const records = [];
  for (const file of files) {
    const canonical = 'source:' + file;
    const native = adapters.has(file) ? 'native:' + file : canonical;
    await put(source, file, canonical);
    await put(client, file, native);
    records.push({path:file, sha256:hash(native)});
  }
  const write = (value = {format:'hetun-client-source-snapshot-v1',policyId,policySha256,files:records}) =>
    fs.writeFile(path.join(client, 'provenance.json'), JSON.stringify(value));
  await write();
  return {root, source, client, records, write, check:() => checkRuntimeSnapshot(source, client)};
}
test('平台适配可不同但摘要必须真实，所有页面仍需与设计源码一致', async t => {
  const f = await fixture(t);
  assert.equal((await f.check()).passed, true);
  await put(f.client, 'src/pages/skeleton/index.vue', 'old UI');
  let result = await f.check();
  assert.ok(result.issues.some(i => i.file === 'src/pages/skeleton/index.vue' && i.reason.includes('源码不同')));
  const adapter = [...adapters][0];
  await put(f.client, adapter, 'changed adapter');
  result = await f.check();
  assert.ok(result.issues.some(i => i.file === adapter && i.reason.includes('快照摘要')));
  await fs.unlink(path.join(f.client, adapter));
  f.records.splice(f.records.findIndex(r => r.path === adapter), 1); await f.write();
  result = await f.check();
  assert.ok(result.issues.some(i => i.file === adapter && i.reason.includes('缺少共享')));
  assert.ok(result.issues.some(i => i.file === adapter && i.reason.includes('未登记')));
});
test('只排除明确的编辑器与演示文件，未知新依赖必须进入成品', async t => {
  const f = await fixture(t), editor = [...authoringFiles][0];
  await put(f.source, editor, 'authoring only');
  assert.equal((await f.check()).passed, true);
  await put(f.client, editor, 'authoring only');
  f.records.push({path:editor,sha256:hash('authoring only')}); await f.write();
  assert.ok((await f.check()).issues.some(i => i.file === editor && i.reason.includes('不允许进入')));
  await put(f.source, 'src/pages/new-screen/index.vue', 'new page');
  const result = await f.check();
  assert.ok(result.issues.some(i => i.file === 'src/pages/new-screen/index.vue' && i.reason.includes('缺少共享')));
  assert.ok(result.issues.some(i => i.file === 'src/pages/new-screen/index.vue' && i.reason.includes('未登记')));
});
test('拒绝畸形清单、重复项、路径穿越和非字符串摘要', async t => {
  const f = await fixture(t);
  const bad = [null, {}, {format:'hetun-client-source-snapshot-v1',files:[]},
    ...['src/../secret','src//file.ts','src/./file.ts','SRC/file.ts','src/file.ts/','src\\file.ts'].map(p =>
      ({format:'hetun-client-source-snapshot-v1',files:[{path:p,sha256:'a'.repeat(64)}]})),
    {format:'hetun-client-source-snapshot-v1',files:[{path:'src/valid.ts',sha256:1}]},
    {format:'hetun-client-source-snapshot-v1',files:[f.records[0], f.records[0]]}];
  for (const value of bad) {
    await f.write(value);
    await assert.rejects(f.check(), /记录无效|缺少有效/);
  }
});
test('策略身份失配与登记不存在的文件不能通过交付', async t => {
  const f = await fixture(t);
  await f.write({format:'hetun-client-source-snapshot-v1',policyId:'old',policySha256:'0'.repeat(64),files:[...f.records,{path:'src/missing.ts',sha256:'0'.repeat(64)}]});
  const result = await f.check();
  assert.equal(result.passed, false);
  assert.ok(result.issues.some(i => i.reason.includes('标识不匹配')));
  assert.ok(result.issues.some(i => i.reason.includes('策略摘要不匹配')));
  assert.ok(result.issues.some(i => i.file === 'src/missing.ts' && i.reason.includes('不存在')));
});
test('源码根、客户端根、祖先目录和记录均拒绝目录链接', async t => {
  const f = await fixture(t);
  const link = path.join(f.root, 'linked-source');
  await fs.symlink(f.source, link, 'junction');
  await assert.rejects(checkRuntimeSnapshot(link, f.client), /符号链接/);
  await assert.rejects(checkRuntimeSnapshot(f.source, link), /符号链接/);
  await assert.rejects(checkRuntimeSnapshot(path.join(link,'src'),f.client), /符号链接/);
  const provenance = path.join(f.client, 'provenance.json');
  await fs.unlink(provenance);
  await fs.symlink(f.source, provenance, 'junction');
  await assert.rejects(f.check(), /快照记录不允许符号链接/);
  await fs.rmdir(provenance); await f.write();
  await fs.symlink(f.source, path.join(f.client, 'src/linked'), 'junction');
  await assert.rejects(f.check(), /符号链接/);
});
test('源码文件及快照记录拒绝文件符号链接', async t => {
  const f = await fixture(t);
  const target = path.join(f.root, 'external.txt');
  await fs.writeFile(target, 'external secret');
  const linkedFile = path.join(f.client, 'src/linked.ts');
  try {
    await fs.symlink(target, linkedFile, 'file');
  } catch (error) {
    if (os.platform() === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('当前 Windows 无文件符号链接权限；目录 junction 拒绝另测通过，文件链接分支未验证');
      return;
    }
    throw error;
  }
  await assert.rejects(f.check(), /符号链接/);
  await fs.unlink(linkedFile);
  const provenance = path.join(f.client, 'provenance.json');
  await fs.unlink(provenance);
  await fs.symlink(target, provenance, 'file');
  await assert.rejects(f.check(), /快照记录不允许符号链接/);
});
