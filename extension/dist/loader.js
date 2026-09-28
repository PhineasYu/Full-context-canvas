// Canvas page bootstrap: read the bookmark index from extension storage, hand it to the canvas,
// and keep the canvas live as bookmarks change.
const ZH = (chrome.i18n.getUILanguage() || '').toLowerCase().startsWith('zh');
const T = (zh, en) => (ZH ? zh : en);
const PRESETS = [
  { k: 'cross', q: ['我的收藏在哪里交汇?', 'Where do my saves meet?'], sub: ['跨组、跨文件夹反复出现的主题', 'Themes that repeat across groups and folders'],
    task: "Find the 3-4 places where this person's saves intersect across groups and original folders. For each, say what repeats and where it was scattered. End with one concrete next step." },
  { k: 'clean', q: ['哪些可以清理?', 'What can I clean up?'], sub: ['用完的页面、重复、本地链接、放错的', 'Used-up pages, duplicates, local links, misfiled'],
    task: 'List saves this person can clean up: used-up pages (baskets, checkouts, confirmations, empty searches), duplicates, local-only links (file:// or localhost), and ones in the wrong original folder. Say that nothing is deleted automatically.' },
  { k: 'lately', q: ['我最近在关注什么?', 'What have I been into lately?'], sub: ['按收藏时间看最近的主题', 'Recent themes by save date'],
    task: 'Look at the saves with the most recent dates. Describe the 3 themes this person has been focused on lately, with the saves that show it, and suggest what to do with each.' },
];
function status(s) {
  let el = document.getElementById('fcc-status');
  if (!el) {
    el = document.createElement('div'); el.id = 'fcc-status';
    el.style.cssText = 'position:fixed;right:388px;top:112px;z-index:30;display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:12px;background:var(--card,#fff);border:1px solid var(--line,#e1e6ee);box-shadow:0 4px 14px rgba(20,30,60,.08);font:13px/1.3 "Instrument Sans",system-ui,sans-serif;color:var(--muted,#687386)';
    document.body.appendChild(el);
  }
  const how = s?.how === 'claude' ? T('由 Claude 整理', 'Sorted by Claude') : T('离线规则整理,连接 Claude 会更准', 'Sorted by offline rules; connect Claude for better sorting');
  el.innerHTML = s?.state === 'sorting'
    ? `<span>${T(`正在整理 ${s.total} 条…`, `Sorting ${s.total}…`)}</span>`
    : `<span>${how}${s?.error ? ` · <span style="color:#A8700F">${T('上次调用 Claude 失败', 'Last Claude call failed')}</span>` : ''}</span><a href="options.html" target="_blank" style="color:var(--accent,#3D5CE0);text-decoration:none">${T('设置', 'Settings')}</a>`;
}
function waiting(text) {
  document.body.insertAdjacentHTML('beforeend', `<div id="fcc-wait" style="position:fixed;inset:0;display:grid;place-items:center;background:#FAFBFD;z-index:50;font:16px 'Instrument Sans',system-ui,sans-serif;color:#687386">${text}</div>`);
}
(async () => {
  let { fcc, status: st } = await chrome.storage.local.get(['fcc', 'status']);
  if (!fcc || !fcc.items?.length) {
    waiting(T('正在读取和整理你的书签…', 'Reading and sorting your bookmarks…'));
    chrome.runtime.sendMessage({ type: 'sync' });
    fcc = await new Promise((res) => { const on = (ch) => { if (ch.fcc?.newValue?.items?.length) { chrome.storage.onChanged.removeListener(on); res(ch.fcc.newValue); } }; chrome.storage.onChanged.addListener(on); });
    document.getElementById('fcc-wait')?.remove();
  }
  const n = fcc.items.length, folders = new Set(fcc.items.map((it) => it.folder)).size;
  window.FCC_DATA = {
    mode: { tour: false, siloBy: 'folder', label: ['你的 Chrome 书签', 'Your Chrome bookmarks'],
      hint: [`这是你 Chrome 里的 <b>${n} 条书签</b>。以后照常收藏,新书签会自己飞进来。右上角「整理前」能看到原来的 ${folders} 个文件夹。`,
             `These are your <b>${n} Chrome bookmarks</b>. Keep bookmarking as usual; new ones fly in on their own. "Before" at the top right shows your original ${folders} folders.`] },
    groups: fcc.groups, items: fcc.items, presets: PRESETS,
  };
  let lastSaved = '';
  window.FCC_SAVE = (d) => { lastSaved = JSON.stringify(d.items.map((it) => [it.id, it.g])); chrome.runtime.sendMessage({ type: 'save', data: d }); };
  // live AI only when a Claude key is set; changing the key reloads the page
  const { settings } = await chrome.storage.local.get('settings');
  if (settings?.apiKey) window.FCC_ASK = (prompt) => chrome.runtime.sendMessage({ type: 'ask', prompt });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.settings && !!ch.settings.newValue?.apiKey !== !!ch.settings.oldValue?.apiKey) location.reload();
    if (ch.status) status(ch.status.newValue);
    const nv = ch.fcc?.newValue;
    if (nv && JSON.stringify(nv.items.map((it) => [it.id, it.g])) !== lastSaved) window.FCC_APPLY?.(nv);
  });
  const s = document.createElement('script'); s.src = 'canvas.js';
  s.onload = () => status(st);
  document.body.appendChild(s);
})();
