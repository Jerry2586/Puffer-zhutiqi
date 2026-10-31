'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const center = path.resolve(__dirname, '..');

async function readLimited(file, maximum) {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximum) throw Error('不是文件或文件大小超过限制');
    return await handle.readFile();
  } finally { await handle.close(); }
}

async function checkSnapshot(packager) {
  const {checkRuntimeSnapshot} = require('./runtime-source.cjs');
  return checkRuntimeSnapshot(path.join(center, 'shared-source'), path.join(packager, 'native/client'));
}

async function checkDelivery(options) {
  const report = {format: 'hetun-theme-delivery-check-v1', checkedAt: new Date().toISOString(), mode: options.importsOnly ? 'imports-only' : 'delivery-preflight', checks: [], acceptanceVerified: false,
    acceptance: '真实安装、界面、运营资源及签名成品运行仍需单独验收；解析和能力声明不能替代验收'};
  let bytes, parsed;
  async function check(name, run) {
    try {
      const detail = await run();
      const passed = detail?.passed !== false;
      report.checks.push({name, status: passed ? 'passed' : 'failed', ...detail});
    } catch (error) { report.checks.push({name, status: 'failed', error: error.message}); }
  }
  await check('candidate', async () => {
    if (!options.theme) throw Error('缺少 --theme 实际交付文件');
    bytes = await readLimited(options.theme, 12 * 1024 * 1024);
    report.candidate = {path: path.resolve(options.theme), bytes: bytes.length, sha256: hash(bytes)};
    return {};
  });
  // Keep independent failures independent: a rejected import must not hide a
  // stale client snapshot or a missing base APK from this same report.
  await check('theme-center-import', async () => {
    if (!bytes) throw Error('没有可检查的主题字节');
    const {inspectThemeImport} = await import(pathToFileURL(path.join(center, 'shared-source/server/check-export.mjs')).href);
    const result = await inspectThemeImport(bytes);
    return {passed: !result.differences.length, changedFields: result.differences};
  });
  await check('packager-import', async () => {
    if (!bytes) throw Error('没有可检查的主题字节');
    if (!options.packager) throw Error('缺少 --packager 打包器源码目录');
    const {parseTheme} = require(path.resolve(options.packager, 'core/themes.cjs'));
    parsed = parseTheme(bytes, path.extname(options.theme));
    return {platform: parsed.manifest.platform, themeId: parsed.manifest.id};
  });
  if (!options.importsOnly) {
    await check('shared-renderer-snapshot', async () => {
      if (!options.packager) throw Error('缺少 --packager 打包器源码目录');
      return checkSnapshot(path.resolve(options.packager));
    });
    await check('actual-base-compatibility', async () => {
      if (!options.base) throw Error('未提供 --base 实际基础APK，不能判定可打包');
      if (!options.packager) throw Error('缺少 --packager 打包器源码目录');
      const {parseBase} = require(path.resolve(options.packager, 'core/base-apk.cjs'));
      const baseBytes = await readLimited(options.base, 512 * 1024 * 1024);
      const base = parseBase(baseBytes);
      if (!parsed) throw Error('基础APK结构已解析，但主题未通过打包器解析，无法核对兼容性');
      const {compatibility} = require(path.resolve(options.packager, 'core/package-contract.cjs'));
      const result = compatibility(base.descriptor, parsed.manifest, options.device || parsed.manifest.platform);
      return {passed: result.ready, sha256: hash(baseBytes), errors: result.errors, missing: result.missing,
        limit: '只检查实际APK结构和声明能力，未证明其渲染代码与预览一致'};
    });
  }
  report.importsPassed = ['candidate', 'theme-center-import', 'packager-import'].every(name => report.checks.some(c => c.name === name && c.status === 'passed'));
  report.checksPassed = report.checks.every(c => c.status === 'passed');
  return report;
}

async function main(argv) {
  const options = {};
  const values = {'--theme': 'theme', '--packager': 'packager', '--base': 'base', '--device': 'device', '--report': 'report'};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--imports-only' && !options.importsOnly) { options.importsOnly = true; continue; }
    const key = values[argv[i]];
    if (!key || options[key] || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('参数无效。用法：node scripts/check-theme-delivery.cjs --theme <ZIP> --packager <目录> [--base <APK>] [--device mobile|tablet|tv] [--report <新JSON文件>] [--imports-only]');
    options[key] = argv[++i];
  }
  if (options.device && !['mobile', 'tablet', 'tv'].includes(options.device)) throw Error('设备只能是 mobile、tablet 或 tv');
  const report = await checkDelivery(options);
  const output = JSON.stringify(report, null, 2) + '\n';
  if (options.report) await fs.writeFile(options.report, output, {flag: 'wx'});
  process.stdout.write(output);
  if (!report.checksPassed) process.exitCode = 1;
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {checkDelivery, checkSnapshot};
