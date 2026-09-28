const ZH = (chrome.i18n.getUILanguage() || '').toLowerCase().startsWith('zh');
const T = (zh, en) => (ZH ? zh : en);
const $ = (id) => document.getElementById(id);
$('h').textContent = T('Full Context Canvas 设置', 'Full Context Canvas settings');
$('kl').textContent = T('Claude API key', 'Claude API key');
$('kn').textContent = T('只保存在这台电脑的浏览器里。整理时,书签的标题、网址和所在文件夹会发给 Claude;你的书签本身不会被修改。没有 key 时用离线规则整理,并全部标成「拿不准」。',
  'Stored only in this browser. When sorting, bookmark titles, URLs and folders are sent to Claude; your bookmarks themselves are never changed. Without a key, offline rules are used and every placement is marked unsure.');
$('save').textContent = T('保存', 'Save'); $('test').textContent = T('测试连接', 'Test connection');
$('rl').textContent = T('重新整理', 'Sort again');
$('rn').textContent = T('清空现有分组,按当前设置把全部书签重新整理一遍。你手动确认过的也会被重排。', 'Clears the current groups and sorts every bookmark again with the current settings, including ones you confirmed.');
$('resort').textContent = T('重新整理全部书签', 'Sort all bookmarks again'); $('open').textContent = T('打开画布', 'Open the canvas');
chrome.storage.local.get('settings').then(({ settings }) => { $('key').value = settings?.apiKey || ''; });
const msg = (t, color) => { $('msg').textContent = t; $('msg').style.color = color || ''; };
$('save').onclick = async () => { await chrome.storage.local.set({ settings: { apiKey: $('key').value.trim() } }); msg(T('已保存。', 'Saved.'), 'var(--ok)'); };
$('test').onclick = async () => {
  await chrome.storage.local.set({ settings: { apiKey: $('key').value.trim() } });
  msg(T('正在连接 Claude…', 'Contacting Claude…'));
  const r = await chrome.runtime.sendMessage({ type: 'ask', prompt: 'Reply with just: OK' });
  r?.text ? msg(T('连接成功。', 'Connected.'), 'var(--ok)') : msg(`${T('连接失败:', 'Failed: ')}${r?.error || ''}`, 'var(--warn)');
};
$('resort').onclick = async () => { $('resort').disabled = true; msg(T('正在重新整理,可能需要一两分钟…', 'Sorting again; this can take a minute or two…')); await chrome.runtime.sendMessage({ type: 'resort' }); $('resort').disabled = false; msg(T('整理完成。', 'Done.'), 'var(--ok)'); };
$('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('canvas.html') });
