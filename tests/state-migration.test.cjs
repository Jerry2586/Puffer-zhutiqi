const test = require('node:test');
const assert = require('node:assert/strict');

test('persisted page designs migrate legacy top-level fields without weakening the theme contract', async () => {
  const {migratePersistedState} = await import('../shared-source/server/state-migration.mjs');
  const {defaultTheme, validateTheme} = await import('../shared-source/server/theme.mjs');
  const persisted = {
    draft: {...structuredClone(defaultTheme), pageDesign: {
      category: {carousel: true, campaign: {title: '旧活动'}, visual: {cards: {radius: 18}}},
      category6d6f766965: {campaign: {title: '旧活动'}, moduleOrder: ['hero']}
    }},
    published: {...structuredClone(defaultTheme), pageDesign: {home: {campaign: {title: '旧活动'}, background: '#112233'}}},
    templates: [{
      id: 'legacy',
      draft: {...structuredClone(defaultTheme), pageDesign: {category: {campaign: {title: '旧活动'}, carousel: false}}},
      published: {...structuredClone(defaultTheme), pageDesign: {category: {campaign: {title: '旧活动'}, modules: {content: {style: 'grid2'}}}}}
    }]
  };
  const original = structuredClone(persisted);
  const result = migratePersistedState(persisted);
  assert.equal(result.changed, true);
  assert.deepEqual(persisted, original);
  assert.equal(result.state.draft.pageDesign.category.campaign, undefined);
  assert.equal(result.state.draft.pageDesign.category.carousel, true);
  assert.deepEqual(result.state.draft.pageDesign.category.visual, {cards: {radius: 18}});
  assert.equal(result.state.published.pageDesign.home.campaign, undefined);
  assert.equal(result.state.templates[0].draft.pageDesign.category.campaign, undefined);
  assert.deepEqual(result.state.templates[0].published.pageDesign.category.modules, {content: {style: 'grid2'}});
  assert.doesNotThrow(() => validateTheme(result.state.draft));
  assert.throws(() => validateTheme({...structuredClone(defaultTheme), pageDesign: {category: {campaign: {title: '新输入'}}}}), /页面设计包含未知字段/);
});

test('persisted state without legacy page fields is unchanged', async () => {
  const {migratePersistedState} = await import('../shared-source/server/state-migration.mjs');
  const {defaultTheme} = await import('../shared-source/server/theme.mjs');
  const persisted = {draft: structuredClone(defaultTheme), published: structuredClone(defaultTheme), templates: []};
  const result = migratePersistedState(persisted);
  assert.equal(result.changed, false);
  assert.deepEqual(result.state, persisted);
});

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {startLocal} = require('../core/local-service.cjs');

async function legacyFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hetun-state-migration-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const {defaultTheme} = await import('../shared-source/server/theme.mjs');
  const draft = structuredClone(defaultTheme);
  draft.brand.logo = '/api/assets/' + 'a'.repeat(64) + '.png';
  draft.pageDesign = {category63616d706169676e: {campaign: {title: '旧活动'}, carousel: false, background: '#112233'}};
  const state = {version: 7, publishedVersion: 3, cmsBase: '', draft: structuredClone(defaultTheme), published: structuredClone(defaultTheme), templates: [{id: 'user-theme', name: '用户主题', platform: 'mobile', renderer: 'hetun-v2', version: 7, publishedVersion: 3, draft, published: structuredClone(defaultTheme)}], selectedTemplate: 'user-theme', activeTemplates: {mobile: 'user-theme'}};
  const stateFile = path.join(root, 'theme-state.json');
  const original = JSON.stringify(state, null, 2) + '\n';
  await fs.writeFile(stateFile, original);
  return {root, stateFile, original, state};
}

test('service backs up legacy state before migration and restarts without changing themes or assets', async t => {
  const fixture = await legacyFixture(t);
  const frontend = path.join(fixture.root, 'front');
  await fs.mkdir(frontend);
  await fs.writeFile(path.join(frontend, 'index.html'), '<html>migration test</html>');
  const assetName = 'a'.repeat(64) + '.png';
  await fs.mkdir(path.join(fixture.root, 'assets'));
  await fs.writeFile(path.join(fixture.root, 'assets', assetName), 'retained-logo-bytes');
  let local;
  t.after(async () => { await local?.stop(); });
  async function boot() {
    local = await startLocal({node: process.execPath, frontend, service: path.resolve('shared-source'), state: fixture.root, localAuthoring: true, browserPreview: true});
    const health = await fetch(local.api + '/api/health');
    assert.equal(health.status, 200);
  }
  await boot();
  const migratedText = await fs.readFile(fixture.stateFile, 'utf8');
  const migrated = JSON.parse(migratedText);
  const expected = structuredClone(fixture.state);
  delete expected.templates[0].draft.pageDesign.category63616d706169676e.campaign;
  assert.deepEqual(migrated, expected);
  const backups = await fs.readdir(path.join(fixture.root, 'migrations'));
  assert.equal(backups.length, 1);
  assert.equal(await fs.readFile(path.join(fixture.root, 'migrations', backups[0]), 'utf8'), fixture.original);
  assert.equal(await (await fetch(local.origin + '/api/assets/' + assetName)).text(), 'retained-logo-bytes');
  const headers = {Cookie: 'hetun_session=' + local.cookie, Origin: local.origin, 'X-Hetun-Client': 'studio', 'Content-Type': 'application/json'};
  const rejected = await fetch(local.origin + '/api/admin/draft', {method: 'PUT', headers, body: JSON.stringify({template: 'user-theme', theme: fixture.state.templates[0].draft})});
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /页面设计包含未知字段/);
  await local.stop();
  local = null;
  await boot();
  assert.equal(await fs.readFile(fixture.stateFile, 'utf8'), migratedText);
  assert.deepEqual(await fs.readdir(path.join(fixture.root, 'migrations')), backups);
  assert.equal(await fs.readFile(path.join(fixture.root, 'assets', assetName), 'utf8'), 'retained-logo-bytes');
});

test('startup preserves original state when backup fails or an unknown field is encountered', async t => {
  for (const failure of ['backup-path', 'backup-ENOENT', 'unknown-field']) {
    await t.test(failure, async t => {
      const fixture = await legacyFixture(t);
      let original = fixture.original;
      if (failure === 'backup-path') await fs.writeFile(path.join(fixture.root, 'migrations'), 'blocked');
      if (failure === 'unknown-field') {
        fixture.state.templates[0].draft.pageDesign.category63616d706169676e.futureField = true;
        original = JSON.stringify(fixture.state);
        await fs.writeFile(fixture.stateFile, original);
      }
      const entry = pathToFileURL(path.resolve('shared-source/server/index.mjs')).href;
      const prelude = failure === 'backup-ENOENT' ? "const fs=await import('node:fs/promises');const mkdir=fs.default.mkdir;fs.default.mkdir=async(p,...a)=>{if(String(p).endsWith('migrations'))throw Object.assign(Error('simulated backup failure'),{code:'ENOENT'});return mkdir(p,...a);};" : '';
      const child = spawn(process.execPath, ['--input-type=module', '-e', prelude + 'await import(' + JSON.stringify(entry) + ');'], {env: {...process.env, HETUN_STATE_DIR: fixture.root}, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
      let output = '';
      child.stdout.on('data', b => { output += b; });
      child.stderr.on('data', b => { output += b; });
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 8000);
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }).finally(() => clearTimeout(timeout));
      assert.equal(timedOut, false, output);
      assert.notEqual(code, 0, output);
      assert.match(output, failure === 'unknown-field' ? /页面设计包含未知字段/ : failure === 'backup-ENOENT' ? /simulated backup failure/ : /EEXIST/);
      assert.equal(await fs.readFile(fixture.stateFile, 'utf8'), original);
    });
  }
});
