'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {makeZip} = require('../shared-source/server/archive.cjs');
const {checkDelivery, checkSnapshot} = require('../scripts/check-theme-delivery.cjs');
const {authoringFiles, inventory} = require('../scripts/runtime-source.cjs');
const packager = process.env.HETUN_TEST_PACKAGER ? path.resolve(process.env.HETUN_TEST_PACKAGER) : path.resolve(__dirname, '../.compat/packager');
const source = path.resolve(__dirname, '../shared-source');
const load = name => import(pathToFileURL(path.join(source, 'server', name)).href);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hetun-delivery-test-'));
  t.after(() => fs.rm(dir, {recursive:true, force:true}));
  return dir;
}
async function fixture() {
  const {defaultTheme, validateTheme} = await load('theme.mjs');
  return {id:'delivery-test', name:'交付检查', platform:'mobile', draft:validateTheme(structuredClone(defaultTheme))};
}
async function archive(t, bytes) {
  const file = path.join(await temporary(t), 'theme.zip');
  await fs.writeFile(file, bytes);
  return file;
}
test('真实导出同时通过两端导入；检查不冒充成品验收', async t => {
  const {exportTheme} = await load('export-theme.mjs');
  const bytes = await exportTheme(await fixture(), await temporary(t));
  const report = await checkDelivery({theme:await archive(t, bytes), packager, importsOnly:true});
  assert.equal(report.importsPassed, true, JSON.stringify(report));
  assert.equal(report.checksPassed, true);
  assert.equal(report.acceptanceVerified, false);
  assert.equal(report.candidate.sha256, digest(bytes));
  assert.equal(report.checks.length, 3);
});
test('导出拒绝会被导入器悄悄丢弃的字段和截断的名称', async t => {
  const {exportTheme} = await load('export-theme.mjs');
  const template = await fixture();
  template.draft.brand.notSupported = '不允许静默消失';
  await assert.rejects(exportTheme(template, await temporary(t)), /theme\.brand\.notSupported/);
  template.draft.brand.notSupported = {};
  await assert.rejects(exportTheme(template, await temporary(t)), /theme\.brand\.notSupported/);
  delete template.draft.brand.notSupported;
  delete template.draft.brand.tagline;
  await assert.rejects(exportTheme(template, await temporary(t)), /theme\.brand\.tagline/);
  template.draft.brand.tagline = '';
  template.name = '长'.repeat(41);
  await assert.rejects(exportTheme(template, await temporary(t)), /改写或丢失配置：name/);
});
test('导出在交付前拒绝损坏素材、单素材超限及不存在的素材', async t => {
  const {exportTheme} = await load('export-theme.mjs');
  const dir = await temporary(t), template = await fixture();
  const filename = 'a'.repeat(64) + '.png';
  template.draft.brand.logo = '/api/assets/' + filename;
  await fs.writeFile(path.join(dir, filename), 'not png');
  await assert.rejects(exportTheme(template, dir), /素材内容与扩展名不符/);
  const large = Buffer.alloc(10 * 1024 * 1024 + 1); large.set([137,80,78,71,13,10,26,10]);
  await fs.writeFile(path.join(dir, filename), large);
  await assert.rejects(exportTheme(template, dir), /不支持的路径、文件或加密内容/);
  await fs.unlink(path.join(dir, filename));
  await assert.rejects(exportTheme(template, dir), /ENOENT/);
});
test('源码备份被两端拒绝，并仍报告客户端差异和缺少实际底包', async t => {
  const zip = makeZip(new Map([['src/components/MobileExperience.vue', Buffer.from('<template/>')]]));
  const report = await checkDelivery({theme:await archive(t, zip), packager});
  assert.equal(report.checks.length, 5);
  assert.equal(report.importsPassed, false);
  assert.equal(report.checksPassed, false);
  for (const name of ['theme-center-import','packager-import','actual-base-compatibility']) assert.equal(report.checks.find(c => c.name === name).status, 'failed');
  assert.match(report.checks.find(c => c.name === 'actual-base-compatibility').error, /实际基础APK/);
  assert.ok(report.checks.some(c => c.name === 'shared-renderer-snapshot'));
});
test('静态SVG在主题中心保真往返，并明确报告正式打包器0.7.5不支持', async t => {
  const {exportTheme} = await load('export-theme.mjs');
  const {storeAsset} = await load('packages.mjs');
  const dir = await temporary(t), template = await fixture();
  template.draft.brand.logo = await storeAsset(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L8 8"/></svg>'), 'logo.svg', dir);
  const report = await checkDelivery({theme:await archive(t, await exportTheme(template, dir)), packager, importsOnly:true});
  assert.equal(report.checks.find(c => c.name === 'theme-center-import').status, 'passed');
  assert.equal(JSON.parse(await fs.readFile(path.join(packager, 'package.json'), 'utf8')).version, '0.7.5');
  assert.equal(report.checks.find(c => c.name === 'packager-import').status, 'failed');
  assert.match(report.checks.find(c => c.name === 'packager-import').error, /路径|文件|格式|素材/);
  assert.equal(report.importsPassed, false);
  assert.equal(report.acceptanceVerified, false);
});
test('隔离检查保留源ZIP字节，拒绝CRC损坏和缺失素材', async t => {
  const {exportTheme} = await load('export-theme.mjs');
  const {inspectThemeImport} = await load('check-export.mjs');
  const {readPackage} = await load('packages.mjs');
  const bytes = await exportTheme(await fixture(), await temporary(t));
  const before = digest(bytes);
  await inspectThemeImport(bytes);
  assert.equal(digest(bytes), before);
  const broken = Buffer.from(bytes); broken[45] ^= 1;
  await assert.rejects(inspectThemeImport(broken), /ZIP/);
  const files = readPackage(bytes), manifest = JSON.parse(files.get('manifest.json'));
  manifest.theme.brand.logo = 'assets/missing.png';
  files.set('manifest.json', Buffer.from(JSON.stringify(manifest)));
  await assert.rejects(inspectThemeImport(makeZip(files)), /缺少素材/);
});
test('客户端快照核对真实共享依赖、摘要及缺失文件', async t => {
  const root = await temporary(t), client = path.join(root, 'native/client');
  await fs.mkdir(client, {recursive:true});
  const records = [];
  for (const file of await inventory(source)) {
    if (authoringFiles.has(file)) continue;
    const target = path.join(client, file);
    await fs.mkdir(path.dirname(target), {recursive:true});
    await fs.copyFile(path.join(source, file), target);
    records.push({path:file, sha256:digest(await fs.readFile(target))});
  }
  const write = () => fs.writeFile(path.join(client, 'provenance.json'), JSON.stringify({format:'hetun-client-source-snapshot-v1', files:records}));
  await write();
  const valid = await checkSnapshot(root);
  assert.equal(valid.passed, true, JSON.stringify(valid.issues));
  await fs.appendFile(path.join(client, 'src/components/MobileExperience.vue'), '\n<!-- stale -->');
  const stale = await checkSnapshot(root);
  assert.ok(stale.issues.some(i => i.file.endsWith('MobileExperience.vue') && i.reason.includes('快照摘要')));
  assert.ok(stale.issues.some(i => i.file.endsWith('MobileExperience.vue') && i.reason.includes('源码不同')));
  await fs.writeFile(path.join(client, 'src/unused-runtime.ts'), 'export const unused = true;');
  const extra = await checkSnapshot(root);
  assert.ok(extra.issues.some(i => i.file === 'src/unused-runtime.ts'));
  records.splice(records.findIndex(r => r.path === 'src/components/AppIcon.vue'), 1);
  await fs.unlink(path.join(client, 'src/components/AppIcon.vue')); await write();
  const missing = await checkSnapshot(root);
  assert.ok(missing.issues.some(i => i.file === 'src/components/AppIcon.vue' && i.reason.includes('未登记')));
  assert.ok(missing.issues.some(i => i.file === 'src/components/AppIcon.vue' && i.reason.includes('缺少共享')));
});

test('固定制作底座原样通过两端导入，活动页配置经真实导出仍保留', async t => {
  const {buildAuthoringKit} = require('../core/authoring-kit.cjs');
  const {readZip} = require('../core/zip.cjs');
  const {installPackage, readPackage} = await load('packages.mjs');
  const {exportTheme} = await load('export-theme.mjs');
  const kit = readZip((await buildAuthoringKit()).bytes);
  const bytes = kit.get('theme/cinema-standard.zip');
  assert.equal(digest(bytes), 'ce59037880cee7c4bdeed61ca8b2c90530934bd3c183020bc765dcbf4eeeac8f');
  const report = await checkDelivery({theme:await archive(t, bytes), packager, importsOnly:true});
  assert.equal(report.importsPassed, true, JSON.stringify(report));
  const assets = await temporary(t);
  const installed = await installPackage({data:bytes.toString('base64')}, assets);
  const exported = await exportTheme(installed, assets);
  const original = JSON.parse(readPackage(bytes).get('manifest.json'));
  const restored = JSON.parse(readPackage(exported).get('manifest.json'));
  assert.deepEqual(restored.theme.pageDesign, original.theme.pageDesign);
  assert.deepEqual(restored.theme.skeleton, original.theme.skeleton);
});
test('底座活动配置仍严格拒绝未知字段、远端图片与错位页面', async () => {
  const {validatePageDesign} = await load('page-design.mjs');
  const {readPackage} = await load('packages.mjs');
  const base = JSON.parse(readPackage(await fs.readFile(path.resolve(__dirname, '../assets/authoring-base.zip'))).get('manifest.json'));
  const [page, config] = Object.entries(base.theme.pageDesign)[0];
  assert.deepEqual(validatePageDesign({[page]:config}), {[page]:config});
  for (const change of [{unsupported:true}, {title:''}, {artwork:'https://outside.invalid/image.png'}, {groupIds:['duplicate','duplicate']}]) {
    assert.throws(() => validatePageDesign({[page]:{...config, campaign:{...config.campaign,...change}}}));
  }
  assert.throws(() => validatePageDesign({home:config}));
  assert.throws(() => validatePageDesign({categoryff:config}));
});
