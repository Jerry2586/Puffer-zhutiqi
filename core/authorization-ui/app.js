'use strict';
const $ = id => document.getElementById(id);
const bridge = window.authorization;
if (bridge?.customTitlebar) document.body?.classList.add('desktop-activation');
let busy = false, state = null;
function feedback(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
function render() {
  const valid = state?.valid === true;
  $('activation').hidden = valid;
  $('authorized-actions').hidden = !valid;
  $('status').classList.toggle('valid', valid);
  $('status').textContent = valid ? state.message : state?.configured === false ? '本机尚未配置授权服务，请联系发行方完成配置。' : '首次使用需激活，此 Key 必须包含主题中心权限。';
  $('intro').textContent = valid ? '本机授权已就绪，可以继续你的主题创作。' : '输入你的授权 Key，开启主题创作。';
  $('form-title').textContent = valid ? '欢迎回到主题中心' : '激活主题中心';
  $('export').hidden = !(valid && state.offlineMigration);
  $('import').hidden = valid;
  $('migration').hidden = valid && !state.offlineMigration;
  document.querySelectorAll('button').forEach(button => { button.disabled = busy || !bridge; });
  $('activate').disabled = busy || !bridge || state?.configured === false;
  $('import').disabled = busy || !bridge || state?.configured === false;
  $('activate').firstChild.textContent = busy ? '正在验证，请稍候… ' : '激活并进入主题中心 ';
  $('activation').setAttribute('aria-busy', String(busy));
}
async function call(action, input = {}) {
  const response = await bridge.call(action, input);
  if (!response.ok) throw Error(response.error || '操作未完成，请重试');
  return response.value;
}
async function refresh() { state = await call('status'); render(); }
async function run(action, input = {}) {
  if (busy || !bridge) return;
  busy = true; feedback('error'); feedback('notice'); render();
  try {
    const value = await call(action, input);
    if (value?.canceled) return;
    await refresh();
    if (action === 'activate' || action === 'import') {
      if (!state.valid) throw Error(state.message || '授权未生效');
      $('key').value = ''; $('password').value = '';
      await call('continue');
    } else if (value?.saved) feedback('notice', '迁移包已保存，请妥善保管并另行备份项目文件。');
    else if (action === 'check') feedback(state.valid ? 'notice' : 'error', state.message);
  } catch (error) { feedback('error', error.message || '连接失败，请稍后重试'); }
  finally { busy = false; render(); }
}
$('activation').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('key').value.trim();
  if (!/^HTN_[A-Za-z0-9_-]{43}$/.test(key)) { feedback('error', '请输入 HTN_ 开头的完整授权 Key，注意不要遗漏字符。'); $('key').focus(); return; }
  run('activate', {key});
});
$('toggle-key').addEventListener('click', () => {
  const visible = $('key').type === 'password';
  $('key').type = visible ? 'text' : 'password';
  $('toggle-key').textContent = visible ? '隐藏' : '显示';
  $('toggle-key').setAttribute('aria-label', visible ? '隐藏授权 Key' : '显示授权 Key');
  $('toggle-key').setAttribute('aria-pressed', String(visible));
});
for (const action of ['check', 'continue', 'export', 'import']) $(action).addEventListener('click', () => {
  if (['import', 'export'].includes(action) && !$('password').value) { feedback('error', '请先输入迁移包密码。'); $('password').focus(); return; }
  run(action, {password: $('password').value});
});
if (bridge) {
  bridge.onStatus(() => refresh().catch(error => feedback('error', error.message)));
  refresh().catch(error => { feedback('error', error.message); render(); });
} else {
  $('status').textContent = '本地界面预览 · 实际 Key 激活请在桌面软件中完成。';
  render();
  $('status').textContent = '本地界面预览 · 实际 Key 激活请在桌面软件中完成。';
}
