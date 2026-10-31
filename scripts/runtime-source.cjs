'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Exact exclusions: additions elsewhere default to runtime and must be delivered.
const authoringFiles = new Set([
  ...['CinemaDemo.vue','CinemaHome.vue','CmsCategoryBinding.vue','CmsConnectionReport.vue','EditorChoice.vue','EditorPanel.vue','LicenseCenter.vue','ThemeEditor.vue'].map(x => 'src/components/' + x),
  ...['demo.ts','feature-navigation.ts','studio-navigation.ts','reference-layout.ts'].map(x => 'src/domain/' + x),
  ...['detail/index.vue','tv/index.vue','studio/index.vue','demo/index.vue'].map(x => 'src/pages/' + x),
  ...['tide.svg','summer.svg','snow.svg','orbit.svg','forest.svg','city.svg'].map(x => 'src/static/posters/' + x),
  ...[
    'README.md','ad.jpg','anime-hero.jpg','anime-poster-0.jpg','anime-poster-1.jpg','anime-poster-2.jpg','avatar.jpg',
    'front-hero.jpg','front-highlight-0.jpg','front-highlight-1.jpg','front-poster-0.jpg','front-poster-1.jpg','front-poster-2.jpg',
    'hero.jpg','history-0.jpg','history-1.jpg','history-2.jpg','home-hero.jpg','home-poster-0.jpg','home-poster-1.jpg','home-poster-2.jpg',
    'movie-hero.jpg','movie-poster-0.jpg','movie-poster-1.jpg','movie-poster-2.jpg','player-scene.jpg',
    'poster-0.jpg','poster-1.jpg','poster-2.jpg','poster-3.jpg','poster-4.jpg','poster-5.jpg','shortdrama-scene.jpg',
    'variety-hero.jpg','variety-poster-0.jpg','variety-poster-1.jpg','variety-poster-2.jpg'
  ].map(x => 'src/static/skeleton-reference/' + x)
]);
const adapters = new Set(['src/services/api.ts','src/pages/index/index.vue','src/pages.json']);
const policyId = 'hetun-runtime-source-v1';
const policySha256 = hash(JSON.stringify({authoring:[...authoringFiles].sort(), adapters:[...adapters].sort()}));
function canonical(file) {
  if (typeof file !== 'string') return false;
  const segments = file.split('/');
  return segments.length > 1 && segments[0] === 'src' &&
    segments.slice(1).every(segment => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(segment));
}

async function directoryWithoutLinks(directory) {
  const absolute = path.resolve(directory), parent = path.dirname(absolute);
  if (parent !== absolute) await directoryWithoutLinks(parent);
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('源码目录不允许符号链接或非目录：' + absolute);
}
async function inventory(root) {
  await directoryWithoutLinks(root);
  const result = new Set();
  async function walk(relative) {
    const stat = await fs.lstat(path.join(root, relative));
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('源码快照不允许符号链接或非目录：' + relative);
    for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes:true})) {
      const file = relative + '/' + entry.name;
      if (entry.isSymbolicLink()) throw Error('源码快照不允许符号链接：' + file);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && canonical(file)) result.add(file);
      else throw Error('源码快照不允许特殊文件或非规范路径：' + file);
    }
  }
  await walk('src');
  return result;
}
async function checkRuntimeSnapshot(source, client) {
  // Inventory and reject links before reading any recorded target or provenance.
  const sourceFiles = await inventory(source), clientFiles = await inventory(client);
  const provenanceFile = path.join(client, 'provenance.json');
  const stat = await fs.lstat(provenanceFile);
  if (stat.isSymbolicLink() || !stat.isFile()) throw Error('客户端快照记录不允许符号链接或非文件');
  const bytes = await fs.readFile(provenanceFile), provenance = JSON.parse(bytes);
  if (!provenance || provenance.format !== 'hetun-client-source-snapshot-v1' || !Array.isArray(provenance.files) || !provenance.files.length) throw Error('缺少有效客户端源码快照记录');
  const records = new Map(), issues = [];
  const issue = (file, reason) => issues.push({file, reason});
  for (const record of provenance.files) {
    if (!record || !canonical(record.path) || typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256) || records.has(record.path)) throw Error('客户端源码快照记录无效');
    records.set(record.path, record.sha256);
  }
  if (provenance.policyId !== undefined && provenance.policyId !== policyId) issue('provenance.json', '运行源码策略标识不匹配');
  if (provenance.policySha256 !== undefined && provenance.policySha256 !== policySha256) issue('provenance.json', '运行源码策略摘要不匹配');
  const runtime = new Set([...sourceFiles].filter(file => !authoringFiles.has(file)));
  for (const file of adapters) runtime.add(file);
  for (const file of new Set([...clientFiles, ...records.keys()])) {
    if (authoringFiles.has(file)) issue(file, '设计器或演示文件不允许进入客户端快照');
    else if (!runtime.has(file)) issue(file, '客户端存在未在标准运行源码中定义的文件');
  }
  const digests = [];
  for (const file of runtime) {
    if (!records.has(file)) issue(file, '共享渲染依赖未登记到客户端快照');
    if (!clientFiles.has(file)) issue(file, '打包客户端缺少共享渲染依赖');
    if (!sourceFiles.has(file)) issue(file, '标准运行源码缺少平台适配文件');
    const approvedHash = sourceFiles.has(file) ? hash(await fs.readFile(path.join(source, file))) : undefined;
    if (approvedHash) digests.push({file, sha256:approvedHash});
    if (clientFiles.has(file)) {
      const nativeHash = hash(await fs.readFile(path.join(client, file)));
      if (records.has(file) && nativeHash !== records.get(file)) issue(file, '客户端文件与快照摘要不一致');
      if (!adapters.has(file) && approvedHash && nativeHash !== approvedHash) issue(file, '预览与打包客户端源码不同');
    }
  }
  // Extra records also need a real inventoried file; never follow record paths.
  for (const file of records.keys()) if (!runtime.has(file) && !clientFiles.has(file)) issue(file, '客户端快照登记了不存在的文件');
  digests.sort((a,b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return {passed:!issues.length, policyId, policySha256, provenanceSha256:hash(bytes), sourceSetSha256:hash(JSON.stringify(digests)), filesChecked:runtime.size, issues,
    limit:'完整运行源码及快照清单核对；明确排除设计器与演示文件；不证明已编译APK或正式安装程序包含此源码'};
}
module.exports = {authoringFiles, adapters, policyId, policySha256, inventory, checkRuntimeSnapshot};
