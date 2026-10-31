import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {installPackage, readPackage} from './packages.mjs';
import {validateVisual} from './theme.mjs';
import {validatePageDesign} from './page-design.mjs';

// Use the production importer, with all writes confined to a disposable directory.
export async function inspectThemeImport(bytes) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hetun-theme-check-'));
  try {
    const installed = await installPackage({data: bytes.toString('base64')}, directory);
    const files = readPackage(bytes);
    const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
    const differences = [];
    function compare(expected, actual, field) {
      if (typeof expected === 'string' && expected.startsWith('assets/')) {
        const data = files.get(expected);
        expected = '/api/assets/' + createHash('sha256').update(data).digest('hex') + path.extname(expected);
      }
      if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || expected.length !== actual.length) { differences.push(field); return; }
        expected.forEach((value, index) => compare(value, actual[index], field + '[' + index + ']'));
      } else if (expected && typeof expected === 'object') {
        if (!actual || typeof actual !== 'object' || Array.isArray(actual)) { differences.push(field); return; }
        for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
          compare(expected[key], actual?.[key], field + '.' + key);
        }
      } else if (expected !== actual) differences.push(field);
    }
    // The connection belongs to the host, never to a transferable theme.
    const expected = structuredClone(manifest.theme);
    delete expected.integration;
    // Legacy drafts omit these optional containers. Their absence already means
    // the validator's default visual values and an empty page design. Only fill
    // whole absent containers; partial values and unknown fields remain checked.
    if (!Object.hasOwn(expected, 'visual')) expected.visual = validateVisual(undefined, expected.colors);
    if (!Object.hasOwn(expected, 'pageDesign')) expected.pageDesign = validatePageDesign(undefined);
    const actual = structuredClone(installed.draft);
    delete actual.integration;
    compare(expected, actual, 'theme');
    for (const key of ['id', 'name', 'platform', 'renderer']) compare(manifest[key], installed[key], key);
    return {manifest, differences};
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
}

export async function assertThemeImport(bytes) {
  const result = await inspectThemeImport(bytes);
  if (result.differences.length) throw new Error('主题导入会改写或丢失配置：' + result.differences.join('、'));
  return result;
}
