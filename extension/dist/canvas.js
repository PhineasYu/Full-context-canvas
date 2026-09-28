
(() => {
'use strict';

/* ================= language ================= */
let LANG = 'zh';
try { LANG = localStorage.getItem('fcc-lang') || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'); } catch (e) {}
const L = (zh, en) => (LANG === 'zh' ? zh : en);
const tr = (v) => (Array.isArray(v) ? (LANG === 'zh' ? v[0] : v[1]) : v);

/* ================= sources & groups ================= */
const SRC = {
  claude:  { n: 'Claude',  m: 'Cl',  c: '#D97757', fg: '#fff',    kind: ['AI 聊天', 'AI chats'], home: 'https://claude.ai/recents',
             how: ['官方数据导出 conversations.json', 'Official data export, conversations.json'] },
  chatgpt: { n: 'ChatGPT', m: 'GPT', c: '#10A37F', fg: '#fff',    kind: ['AI 聊天', 'AI chats'], home: 'https://chatgpt.com/',
             how: ['官方数据导出 conversations.json', 'Official data export, conversations.json'] },
  gemini:  { n: 'Gemini',  m: 'Ge',  c: '#5B8DEF', fg: '#fff',    kind: ['AI 聊天', 'AI chats'], home: 'https://gemini.google.com/app',
             how: ['Google Takeout 的「我的活动」', 'Google Takeout, My Activity'] },
  chrome:  { n: 'Chrome',  m: 'Ch',  c: '#E0A100', fg: '#1B1B1B', kind: ['书签', 'Bookmarks'], home: null,
             how: ['浏览器插件实时同步书签', 'Browser extension syncs bookmarks live'] },
  youtube: { n: 'YouTube', m: 'YT',  c: '#E5372B', fg: '#fff',    kind: ['稍后观看和收藏', 'Watch later & saves'], home: 'https://www.youtube.com/playlist?list=WL',
             how: ['浏览器插件,在你点「保存」时接住', 'Browser extension catches each Save'] },
  reddit:  { n: 'Reddit',  m: 'R',   c: '#FF5A1F', fg: '#fff',    kind: ['已保存的帖子', 'Saved posts'], home: 'https://www.reddit.com/',
             how: ['Reddit 接口读取已保存列表', 'Reddit API, saved list'] },
  x:       { n: 'X',       m: 'X',   c: '#8492A6', fg: '#fff',    kind: ['书签', 'Bookmarks'], home: 'https://x.com/i/bookmarks',
             how: ['浏览器插件,在你点书签时接住', 'Browser extension catches each bookmark'] },
};
const SRC_IDS = Object.keys(SRC);

/* DATA:START — supplied at runtime by loader.js from the bookmark index */
const RTD = window.FCC_DATA;
const MODE = RTD.mode;
const GROUPS = RTD.groups;
const EXTRA_COLORS = ['#5AA7D6', '#7FA83A', '#8A6FE0', '#3C7F9A'];
const R = (c, zh, en) => [c, zh, en];
const SEED = RTD.items;
const INTAKE = [];
const CANNED = {};
const PRESETS = RTD.presets;
/* DATA:END */

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n) => String(n).padStart(2, '0');
const nowStamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const hm = (stamp) => (stamp || '').slice(11, 16) || (stamp || '').slice(5, 10);
const gName = (gid) => tr(S.groups[gid]?.name || gid);
const logo = (sid) => `<svg aria-hidden="true"><use href="#lg-${sid}"/></svg>`;
const srcChip = (sid) => `<span class="chip lg" title="${SRC[sid].n}" role="img" aria-label="${SRC[sid].n}">${logo(sid)}</span>`;
const gTag = (gid, q) => { const g = S.groups[gid]; if (!g) return ''; return `<span class="gtag${q ? ' q' : ''}"><i style="background:${g.c}"></i>${esc(tr(g.name))}</span>`; };
const isQ = (it) => Object.values(it.g).some((m) => m[0] < 0.6);
const maxConf = (it) => Math.max(0, ...Object.values(it.g).map((m) => m[0]));

/* ================= state ================= */
const S = {
  items: [], byId: {}, groups: {},
  sel: null,          // {type:'item'|'group'|'source'|'set', id, ids}
  keepPanel: false,   // citation clicks keep the synth panel open
  q: '', tab: 'log', log: [],
  tx: 0, ty: 0, s: 1,
  flying: new Set(), intake: 0,
  synth: null, forceCanned: false, busy: false,
  mode: 'canvas', blobHold: false, tour: null, synthPromise: null, focus: null, focusAll: false,
};
for (const [id, g] of Object.entries(GROUPS)) S.groups[id] = { ...g, id };

function addItem(raw, stampOverride) {
  const it = { ...raw, g: { ...raw.g }, trail: [], x: 0, y: 0 };
  const stamp = stampOverride || `${raw.when || nowStamp().slice(0, 10)} ${pad2(8 + Math.floor(hash(raw.id) * 13))}:${pad2(Math.floor(hash(raw.id + 'm') * 60))}`;
  it.stamp = stamp;
  it.trail.push({ k: 'recv', tm: stamp, zh: `从 ${SRC[it.src].n} 接收(${tr(SRC[it.src].how)})`, en: `Received from ${SRC[it.src].n} (${tr(SRC[it.src].how)})` });
  it.trail.push({ k: 'read', tm: stamp, zh: 'AI 读了标题和前 300 字,原件留在原处', en: 'AI read the title and first 300 characters; the original stays put' });
  it.trail.push({ k: 'place', tm: stamp, zh: placeText(it, 'zh'), en: placeText(it, 'en') });
  S.items.push(it); S.byId[it.id] = it;
  S.log.push({ tm: stamp, id: it.id, kind: 'place' });
  return it;
}
function placeText(it, lang) {
  const parts = Object.entries(it.g).map(([gid, m]) => `${S.groups[gid] ? S.groups[gid].name[lang === 'zh' ? 0 : 1] : gid} ${Math.round(m[0] * 100)}%`);
  return lang === 'zh' ? `放入:${parts.join('、')}` : `Placed in: ${parts.join(', ')}`;
}

/* ================= layout ================= */
const CW = 212, CH = 86, GAP = 16;
const SILO_DX = 244, SILO_Y0 = -380;
// Position of a card in the current view: 'silo' = one column per platform (before), 'canvas' = AI groups (after)
const P = (it) => (S.mode === 'silo' ? [it.sx, it.sy] : [it.x, it.y]);
const SILO_ROWS = 15;
function computeSilo() {
  // 'before' view: one column per platform, or per original folder, wrapping every SILO_ROWS cards
  const keyOf = (it) => (MODE.siloBy === 'folder' ? it.folder || '—' : it.src);
  const keys = MODE.siloBy === 'folder' ? [...new Set(S.items.map(keyOf))] : SRC_IDS.filter((sid) => S.items.some((it) => it.src === sid));
  const cols = []; let col = 0;
  for (const key of keys) {
    const arr = S.items.filter((it) => keyOf(it) === key);
    const first = col;
    arr.forEach((it, k) => { it.scol = first + Math.floor(k / SILO_ROWS); it.sy = SILO_Y0 + (k % SILO_ROWS) * 102; });
    cols.push({ key, first, n: arr.length, ids: arr.map((it) => it.id) });
    col += Math.max(1, Math.ceil(arr.length / SILO_ROWS));
  }
  const mid = (col - 1) / 2;
  for (const it of S.items) it.sx = (it.scol - mid) * SILO_DX;
  S.siloCols = cols.map((c) => ({ ...c, x: (c.first - mid) * SILO_DX }));
}
function sharedItems(a, b) { return S.items.filter((it) => it.g[a] && it.g[b]); }
function intersections() {
  const ids = Object.keys(S.groups); const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const sh = sharedItems(ids[i], ids[j]);
    if (sh.length) out.push({ a: ids[i], b: ids[j], items: sh, srcs: new Set(sh.map((it) => it.src)) });
  }
  return out.sort((x, y) => y.items.length - x.items.length || y.srcs.size - x.srcs.size);
}
// Overview layout: every save is a dot scattered around its group's soma (sunflower spiral with jitter);
// saves in several groups sit along the connection between those somas.
function memberCount(gid) { let n = 0; for (const it of S.items) if (it.g[gid]) n++; return n; }
const liveGroups = (it) => Object.keys(it.g).filter((g) => S.groups[g]).sort((a, b) => it.g[b][0] - it.g[a][0]);
function dotSizes() {
  const ts = S.items.map((it) => Date.parse(it.when || it.stamp || '') || 0).filter(Boolean);
  const lo = Math.min(...ts), hi = Math.max(...ts);
  for (const it of S.items) {
    const t = Date.parse(it.when || it.stamp || '') || lo;
    const rec = hi > lo ? (t - lo) / (hi - lo) : 0.5;
    it.d = Math.round(12 + 16 * Math.pow(rec, 1.6) + 4 * hash(it.id + 'd'));
    it.recent = rec > 0.93;
  }
}
function dotLayout(list) {
  const set = new Set(list);
  const singles = {};
  for (const it of S.items) { const gs = liveGroups(it); if (gs.length === 1) (singles[gs[0]] ||= []).push(it); }
  for (const [gid, arr] of Object.entries(singles)) {
    arr.sort((a, b) => b.d - a.d);
    const [hx, hy] = S.groups[gid].hub;
    arr.forEach((it, i) => {
      if (!set.has(it)) return;
      const r = 84 + 27 * Math.sqrt(i + 1) * (0.8 + 0.4 * hash(it.id + 'r'));
      const a = i * 2.39996 + (hash(it.id + 'a') - 0.5) * 0.7;
      it.x = hx + Math.cos(a) * r; it.y = hy + Math.sin(a) * r * 0.92;
    });
  }
  for (const it of list) {
    const gs = liveGroups(it);
    if (!gs.length) { it.x = 0; it.y = 0; continue; }
    if (gs.length === 1) continue;
    let cx = 0, cy = 0; for (const g of gs) { cx += S.groups[g].hub[0]; cy += S.groups[g].hub[1]; }
    cx /= gs.length; cy /= gs.length;
    const [ax, ay] = S.groups[gs[0]].hub, [bx, by] = S.groups[gs[1]].hub, len = Math.hypot(bx - ax, by - ay) || 1;
    const t = (hash(it.id + 't') - 0.5) * 0.45, off = (hash(it.id + 'o') - 0.5) * 110;
    it.x = cx + (bx - ax) * t * 0.5 - ((by - ay) / len) * off;
    it.y = cy + (by - ay) * t * 0.5 + ((bx - ax) / len) * off;
  }
  // nudge dots apart, and keep them off the somas
  const all = S.items;
  for (let k = 0; k < 20; k++) {
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], ma = set.has(a), mb = set.has(b);
      if (!ma && !mb) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = (a.d + b.d) / 2 + 9;
      if (d >= min) continue;
      const push = (min - d) / 2, ux = dx / d, uy = dy / d, wa = ma ? (mb ? 1 : 2) : 0, wb = mb ? (ma ? 1 : 2) : 0;
      a.x -= ux * push * wa; a.y -= uy * push * wa; b.x += ux * push * wb; b.y += uy * push * wb;
    }
    for (const it of list) for (const g of Object.values(S.groups)) {
      const dx = it.x - g.hub[0], dy = it.y - g.hub[1], d = Math.hypot(dx, dy) || 1;
      if (d < 70) { it.x = g.hub[0] + (dx / d) * 70; it.y = g.hub[1] + (dy / d) * 70; }
    }
  }
}
function layoutAll() { dotSizes(); dotLayout(S.items); }
function layoutSome(list) { dotSizes(); dotLayout(list); }
// Focus view: the chosen group's cards bloom around its soma on widening elliptical rings.
const BLOOM_FIRST = 12;
function computeBloom() {
  for (const it of S.items) it.bloom = null;
  S.bloomMore = 0; S.bloomRings = 0;
  if (!S.focus || S.mode === 'silo' || !S.groups[S.focus]) return;
  const [hx, hy] = S.groups[S.focus].hub;
  const mem = S.items.filter((it) => it.g[S.focus]).sort((a, b) => b.g[S.focus][0] - a.g[S.focus][0] || b.d - a.d);
  const shown = S.focusAll ? mem : mem.slice(0, BLOOM_FIRST);
  S.bloomMore = mem.length - shown.length;
  let i = 0, k = 0;
  while (i < shown.length) {
    const rx = 270 + k * 245, ry = 158 + k * 114;
    const per = Math.max(5, Math.floor((2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)) / 258));
    const n = Math.min(per, shown.length - i);
    for (let q = 0; q < n; q++, i++) {
      const a = -Math.PI / 2 + (q / n) * Math.PI * 2 + k * 0.45;
      shown[i].bloom = [hx + Math.cos(a) * rx, hy + Math.sin(a) * ry];
    }
    k++;
  }
  S.bloomRings = k;
  S.bloomBottom = hy + 158 + (k - 1) * 114 + CH / 2;
}
// Where a save is drawn right now, and whether it is a full card or a dot
const D = (it) => (S.mode === 'silo' ? [it.sx, it.sy] : it.bloom || [it.x, it.y]);
// members of the open group that have not bloomed yet stay tucked behind the "show more" button
const tucked = (it) => !!(S.focus && S.mode === 'canvas' && it.g[S.focus] && !it.bloom && !(S.sel?.type === 'item' && S.sel.id === it.id));
const asCard = (it) => S.mode === 'silo' || !!it.bloom || (S.sel?.type === 'item' && S.sel.id === it.id);
const place = (c, x, y, extra = '') => { c.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)${extra}`; };
function freeHub() {
  const hubs = Object.values(S.groups).map((g) => g.hub);
  let best = null, bestD = -1;
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    for (const r of [1250, 1500]) {
      const p = [Math.cos(ang) * r, Math.sin(ang) * r * 0.8];
      const d = Math.min(...hubs.map((h) => Math.hypot(h[0] - p[0], h[1] - p[1])));
      if (d > bestD) { bestD = d; best = p; }
    }
  }
  return best.map(Math.round);
}
function ensureGroup(id, name, def) {
  if (S.groups[id]) return id;
  const used = Object.values(S.groups).filter((g) => g.extra).length;
  S.groups[id] = { id, name: [name, name], def: [def || '由 AI 在导入时新建的组。', def || 'A group AI created during import.'], c: id === 'misc' ? '#8A93A6' : EXTRA_COLORS[used % EXTRA_COLORS.length], hub: freeHub(), extra: true };
  return id;
}

/* ================= DOM refs ================= */
const app = $('#app'), stage = $('#stage'), world = $('#world'), cardsEl = $('#cards'), hubsEl = $('#hubs'), blobsEl = $('#blobs'),
  threadsEl = $('#threads'), dock = $('#dock'), pbody = $('#pbody'), tabsEl = $('#tabs'), panel = $('#panel');

/* ================= render: static text ================= */
function renderChrome() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  $('#tagline').textContent = L('你只管收藏,它负责归位,并告诉你放在了哪', 'You save. It sorts, and shows you where everything went.');
  $('#pill-sample').textContent = MODE.label ? tr(MODE.label) : L('示例数据', 'Sample data');
  $('#q').placeholder = L('在所有平台里一起搜…', 'Search every platform at once…');
  $('#btn-intake-t').textContent = L('模拟一条新收藏', 'Simulate a new save');
  $('#btn-tour-t').textContent = L('演示导览', 'Guided tour');
  $('#btn-import-t').textContent = L('导入', 'Import');
  $('#btn-lang').textContent = LANG === 'zh' ? 'EN' : '中文';
  $('#hint-t').innerHTML = MODE.hint ? tr(MODE.hint) : L('<b>点一个神经元</b>展开这一组;点任意一个点,一根线会连回它原来的平台。第一次来?点上面的<b>「演示导览」</b>,90 秒看完整个故事。', '<b>Open a neuron</b> to see its cards; click any dot and a thread lights up back to its platform. First time here? Press <b>Guided tour</b> for the 90-second story.');
  renderModes(); renderTour();
  $('#ask-q').placeholder = L('问问你存过的全部东西…', 'Ask across everything you have saved…');
  $('#ask-go').textContent = L('生成', 'Ask');
  $('#presets').innerHTML = PRESETS.map((p) => `<button type="button" class="preset" data-preset="${p.k}">${esc(tr(p.q))}</button>`).join('');
  renderAIPill();
}
function renderAIPill() {
  const live = !!sampleFn && !S.forceCanned;
  $('#pill-ai').classList.toggle('live', live);
  $('#pill-ai-t').textContent = live ? L('AI 实时:Claude', 'Live AI: Claude') : window.FCC_DATA ? L('离线规则', 'Offline rules') : L('离线演示', 'Offline demo');
}

/* ================= render: dock ================= */
function renderDock() {
  const counts = {}; const hits = {};
  for (const it of S.items) { counts[it.src] = (counts[it.src] || 0) + 1; if (S.q && matches(it)) hits[it.src] = (hits[it.src] || 0) + 1; }
  const lit = new Set([...threadIds()].map((id) => S.byId[id]?.src));
  if (S.sel?.type === 'source') lit.add(S.sel.id);
  dock.innerHTML = `<div class="cap">${L('来源', 'Sources')}</div>` + SRC_IDS.map((sid) => {
    const s = SRC[sid];
    const on = !!S.sel && lit.has(sid);
    const n = S.q ? (hits[sid] || 0) : (counts[sid] || 0);
    return `<button type="button" class="node${on ? ' on' : ''}" data-src="${sid}" title="${esc(s.n)} · ${esc(tr(s.kind))}" aria-label="${esc(s.n)}">${logo(sid)}<span class="n${S.q ? ' q' : ''}${n ? '' : ' z'}">${n}</span></button>`;
  }).join('');
}

/* ================= render: canvas ================= */
function relatedIds() {
  const sel = S.sel; const ids = new Set(); const gs = new Set();
  if (S.q) { for (const it of S.items) if (matches(it)) ids.add(it.id); return { ids, gs, active: true }; }
  if (S.focus && S.mode === 'canvas') { gs.add(S.focus); for (const it of S.items) if (it.g[S.focus]) ids.add(it.id); }
  if (!sel) return { ids, gs, active: !!S.focus && S.mode === 'canvas' };
  if (sel.type === 'item') { const it = S.byId[sel.id]; if (it) { ids.add(it.id); Object.keys(it.g).forEach((g) => gs.add(g)); } }
  if (sel.type === 'group') { gs.add(sel.id); for (const it of S.items) if (it.g[sel.id]) ids.add(it.id); }
  if (sel.type === 'source') for (const it of S.items) if (it.src === sel.id) ids.add(it.id);
  if (sel.type === 'set') for (const id of sel.ids) ids.add(id);
  if (sel.type === 'inter') { gs.add(sel.a); gs.add(sel.b); for (const it of sharedItems(sel.a, sel.b)) ids.add(it.id); }
  return { ids, gs, active: true };
}
function renderCanvas() {
  const rel = relatedIds();
  world.classList.toggle('dim', rel.active);
  computeSilo(); computeBloom();
  // hubs (canvas) or platform column headers (silo)
  if (S.mode === 'silo') {
    const litSrc = new Set([...rel.ids].map((id) => S.byId[id]?.src));
    if (S.sel?.type === 'source') litSrc.add(S.sel.id);
    hubsEl.innerHTML = S.siloCols.map((c) => {
      if (MODE.siloBy === 'folder') {
        const lit = c.ids.some((id) => rel.ids.has(id));
        return `<button type="button" class="hub silo${lit ? ' hi' : ''}" data-folder="${esc(c.key)}" style="left:${c.x}px;top:${SILO_Y0 - 96}px">
          <div class="gn">${esc(c.key.split('/').pop() || c.key)}</div><div class="gm">${L(`${c.n} 条`, `${c.n} items`)}</div></button>`;
      }
      return `<button type="button" class="hub silo${litSrc.has(c.key) ? ' hi' : ''}" data-src="${c.key}" style="left:${c.x}px;top:${SILO_Y0 - 96}px">
        <div class="gn">${srcChip(c.key)}${esc(SRC[c.key].n)}</div><div class="gm">${L(`${c.n} 条 · 只在这里看得见`, `${c.n} items · only visible here`)}</div></button>`;
    }).join('');
  } else hubsEl.innerHTML = Object.values(S.groups).filter((g) => memberCount(g.id) > 0).map((g) => {
    const n = memberCount(g.id);
    const srcs = new Set(S.items.filter((it) => it.g[g.id]).map((it) => it.src)).size;
    return `<button type="button" class="hub${rel.gs.has(g.id) ? ' hi' : ''}${S.focus === g.id ? ' focus' : ''}" data-group="${g.id}" style="left:${g.hub[0]}px;top:${g.hub[1] - 46}px" aria-label="${esc(tr(g.name))}">
      <div class="gn">${esc(tr(g.name))}</div>
      <div class="gm">${L(`${n} 条 · 来自 ${srcs} 个平台`, `${n} ${n === 1 ? 'item' : 'items'} · from ${srcs} ${srcs === 1 ? 'platform' : 'platforms'}`)}</div></button>`;
  }).join('');
  // cards: keep elements to preserve transitions
  const existing = new Map([...cardsEl.children].map((c) => [c.dataset.id, c]));
  for (const it of S.items) {
    let c = existing.get(it.id);
    const [px, py] = D(it);
    if (!c) { c = document.createElement('button'); c.type = 'button'; c.className = 'card'; c.dataset.id = it.id; cardsEl.appendChild(c); if (!it.skipInit) place(c, px, py); }
    existing.delete(it.id);
    const s = SRC[it.src];
    const gs = Object.entries(it.g).filter(([g]) => S.groups[g]);
    const prim = gs.slice().sort((a, b) => b[1][0] - a[1][0])[0];
    c.style.setProperty('--dc', prim ? S.groups[prim[0]].c : 'var(--muted)');
    c.classList.toggle('q', isQ(it));
    c.classList.toggle('dot', !asCard(it));
    c.classList.toggle('tucked', tucked(it));
    c.tabIndex = tucked(it) ? -1 : 0;
    c.classList.toggle('recent', !!it.recent);
    c.style.setProperty('--d', `${it.d || 16}px`);
    c.classList.toggle('sel', !!(S.sel && S.sel.type === 'item' && S.sel.id === it.id) || ((S.sel?.type === 'set' || S.sel?.type === 'inter') && rel.ids.has(it.id)));
    c.classList.toggle('hi', rel.ids.has(it.id) || (S.sel?.type === 'item' && gs.some(([g]) => rel.gs.has(g)) && !S.q));
    c.setAttribute('aria-label', `${s.n}: ${it.t}`);
    c.innerHTML = `<div class="row">${srcChip(it.src)}<span class="meta">${esc(tr(it.meta))}</span></div>
      <div class="t">${esc(it.t)}</div>
      <div class="gs">${gs.map(([g, m]) => `<i style="background:${S.groups[g].c};opacity:${m[0] < 0.6 ? 0.45 : 1}" title="${esc(gName(g))}"></i>`).join('')}${isQ(it) ? `<span class="unsure">${L('拿不准', 'unsure')}</span>` : ''}</div>`;
    if (!it.flyingNow) place(c, px, py);
  }
  for (const c of existing.values()) c.remove();
  // floating label on an intersection
  const ov = $('#overlay');
  if (S.sel?.type === 'inter' && S.mode === 'canvas') {
    const sh = sharedItems(S.sel.a, S.sel.b);
    const cx = sh.reduce((a, it) => a + it.x, 0) / (sh.length || 1), top = Math.min(...sh.map((it) => it.y)) - CH / 2 - 14;
    ov.innerHTML = sh.length ? `<div class="xlabel" style="left:${cx}px;top:${top}px">${esc(gName(S.sel.a))} × ${esc(gName(S.sel.b))} · ${sh.length}</div>` : '';
  } else if (S.focus && S.bloomMore && S.mode === 'canvas') {
    ov.innerHTML = `<button type="button" class="more" style="left:${S.groups[S.focus].hub[0]}px;top:${S.bloomBottom + 34}px">${L(`再展开 ${S.bloomMore} 条`, `Show ${S.bloomMore} more`)}</button>`;
  } else ov.innerHTML = '';
  renderBlobs(rel);
}
// Groups are drawn as neurons: a soma at the hub and thin tapering dendrites to each member card.
const f1 = (v) => v.toFixed(1);
function taper(p0, c, p1, w0, w1, n = 16) {
  const a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    const x = m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], y = m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1];
    const dx = 2 * m * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), dy = 2 * m * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * Math.pow(t, 0.6)) / 2;
    a.push(`${f1(x - (dy / len) * w)},${f1(y + (dx / len) * w)}`); b.push(`${f1(x + (dy / len) * w)},${f1(y - (dx / len) * w)}`);
  }
  return `M${a.join('L')}L${b.reverse().join('L')}Z`;
}
function cardEdge(it, from) {
  const dx = from[0] - it.x, dy = from[1] - it.y;
  const k = Math.min((CW / 2 + 3) / (Math.abs(dx) || 1e-6), (CH / 2 + 3) / (Math.abs(dy) || 1e-6));
  return [it.x + dx * k, it.y + dy * k];
}
function blobPath(cx, cy, r0, rv, key, n = 11, squash = 0.88) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = r0 + hash(key + i) * rv; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash]); }
  let d = `M${f1((pts[0][0] + pts[n - 1][0]) / 2)},${f1((pts[0][1] + pts[n - 1][1]) / 2)}`;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; d += `Q${f1(p[0])},${f1(p[1])} ${f1((p[0] + q[0]) / 2)},${f1((p[1] + q[1]) / 2)}`; }
  return d + 'Z';
}
// Soma painted like watercolor: a soft bleed, pigment pooling toward a darker rim, a rough edge, a dark nucleus.
function soma(g) {
  const [hx, hy] = g.hub; const seed = (k) => hash(g.id + k);
  let stubs = '';
  for (let i = 0; i < 8; i++) {
    let a = seed('a' + i) * Math.PI * 2; if (Math.sin(a) > 0.45) a += Math.PI; // keep the label area under the soma clear
    const L = 56 + seed('l' + i) * 70, bend = (seed('b' + i) - 0.5) * 40;
    const p0 = [hx + Math.cos(a) * 22, hy + Math.sin(a) * 22], p1 = [hx + Math.cos(a) * L, hy + Math.sin(a) * L];
    const c = [(p0[0] + p1[0]) / 2 - Math.sin(a) * bend, (p0[1] + p1[1]) / 2 + Math.cos(a) * bend];
    stubs += `<path d="${taper(p0, c, p1, 7, 0.5, 10)}" fill="${g.c}" opacity=".5"/>`;
  }
  let spots = '';
  for (let i = 0; i < 3; i++) {
    const a = seed('s' + i) * Math.PI * 2, r = 6 + seed('d' + i) * 12;
    spots += `<circle cx="${f1(hx + Math.cos(a) * r)}" cy="${f1(hy + Math.sin(a) * r)}" r="${f1(2.5 + seed('z' + i) * 4)}" fill="${g.c}" opacity=".55"/>`;
  }
  return `<circle cx="${hx}" cy="${hy}" r="120" fill="url(#halo-${g.id})"/>
    <path d="${blobPath(hx + 5, hy + 3, 40, 20, g.id + 'bleed', 13)}" fill="${g.c}" opacity=".2" filter="url(#wc-bleed)"/>
    ${stubs}
    <g filter="url(#wc-edge)">
      <path d="${blobPath(hx, hy, 26, 13, g.id + 'body')}" fill="url(#pig-${g.id})" stroke="${g.c}" stroke-opacity=".6" stroke-width="3"/>
      ${spots}
      <circle cx="${f1(hx + 4)}" cy="${f1(hy - 4)}" r="6.5" fill="#0E1A33" opacity=".5"/>
    </g>`;
}
function renderBlobs(rel) {
  rel = rel || relatedIds();
  let defs = `<defs>
    <filter id="wc-edge" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="wc-bleed" x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="4"/></filter>`, body = '';
  const maxMembers = Math.max(1, ...Object.keys(S.groups).map(memberCount));
  for (const g of Object.values(S.groups)) {
    const mem = S.items.filter((it) => it.g[g.id] && !it.flyingNow);
    if (!mem.length) continue;
    defs += `<radialGradient id="pig-${g.id}" cx=".45" cy=".45" r=".6"><stop offset="0" stop-color="${g.c}" stop-opacity=".5"/><stop offset=".7" stop-color="${g.c}" stop-opacity=".78"/><stop offset="1" stop-color="${g.c}" stop-opacity=".95"/></radialGradient>`;
    defs += `<radialGradient id="halo-${g.id}"><stop offset="0" stop-color="${g.c}" stop-opacity=".28"/><stop offset="1" stop-color="${g.c}" stop-opacity="0"/></radialGradient>`;
    const [hx, hy] = g.hub;
    let nerves = '';
    for (const it of mem) {
      if (tucked(it)) continue;
      const [ex, ey] = D(it);
      let end;
      if (asCard(it)) end = cardEdge({ x: ex, y: ey }, g.hub);
      else { const ddx = hx - ex, ddy = hy - ey, dl = Math.hypot(ddx, ddy) || 1, r = (it.d || 16) / 2 + 2; end = [ex + (ddx / dl) * r, ey + (ddy / dl) * r]; }
      const dx = end[0] - hx, dy = end[1] - hy, len = Math.hypot(dx, dy) || 1;
      const bend = (hash(it.id + g.id) - 0.5) * 0.36 * len;
      const start = [hx + (dx / len) * 26, hy + (dy / len) * 26];
      const c = [(hx + end[0]) / 2 - (dy / len) * bend, (hy + end[1]) / 2 + (dx / len) * bend];
      const weak = it.g[g.id][0] < 0.6;
      nerves += `<path d="${taper(start, c, end, weak ? 2.2 : 3.6, 0.7)}" fill="${g.c}" class="${weak ? 'nv weak' : 'nv'}"/>`
        + (asCard(it) ? `<circle cx="${f1(end[0])}" cy="${f1(end[1])}" r="6" fill="${g.c}" opacity=".16"/><circle cx="${f1(end[0])}" cy="${f1(end[1])}" r="2.8" fill="${g.c}"/>` : '');
    }
    const hi = rel.gs.has(g.id) || (rel.active && mem.some((it) => rel.ids.has(it.id)));
    const k = 0.8 + 0.55 * Math.sqrt(mem.length / maxMembers);
    body += `<g class="blob${hi ? ' hi' : ''}">${nerves}<g transform="translate(${hx},${hy}) scale(${f1(k)}) translate(${-hx},${-hy})">${soma(g)}</g></g>`;
  }
  blobsEl.innerHTML = defs + '</defs>' + body;
  blobsEl.style.opacity = S.mode === 'silo' || S.blobHold ? '0' : '1';
}

/* ================= transform (pan/zoom) ================= */
function applyTransform() {
  world.style.transform = `translate(${S.tx}px,${S.ty}px) scale(${S.s})`;
  world.style.setProperty('--ls', String(Math.max(1, 0.72 / S.s)));
  world.style.setProperty('--lss', String(clamp(0.7 / S.s, 1, MODE.siloBy === 'folder' ? 2.6 : 1.25)));
  world.classList.toggle('far', S.s < 0.34 && S.mode === 'silo');
  const gs = 26 * S.s;
  stage.style.backgroundSize = `${gs}px ${gs}px`;
  stage.style.backgroundPosition = `${S.tx}px ${S.ty}px`;
}
function bounds(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of list) { const [x, y] = D(it); const w = asCard(it) ? CW / 2 : (it.d || 16) / 2 + 6, h = asCard(it) ? CH / 2 : w; x0 = Math.min(x0, x - w); y0 = Math.min(y0, y - h); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
  if (S.mode === 'silo') { y0 = Math.min(y0, SILO_Y0 - 130); return { x0, y0, x1, y1 }; }
  for (const g of Object.values(S.groups)) if (memberCount(g.id) && list === S.items) { x0 = Math.min(x0, g.hub[0] - 140); x1 = Math.max(x1, g.hub[0] + 140); y0 = Math.min(y0, g.hub[1] - 50); y1 = Math.max(y1, g.hub[1] + 50); }
  return { x0, y0, x1, y1 };
}
const padTop = () => (S.tour ? (window.innerWidth <= 860 ? 210 : 170) : 20);
const padBottom = () => (window.innerWidth <= 860 ? 130 : 110);
function fitTo(list, animate, minS = 0.18, maxS = 1.2) {
  const r = stage.getBoundingClientRect();
  const b = bounds(list);
  const pt = padTop(), pb = padBottom();
  const s = clamp(Math.min((r.width - 40) / (b.x1 - b.x0), (r.height - pb - pt) / (b.y1 - b.y0)), minS, maxS);
  animateTo(r.width / 2 - ((b.x0 + b.x1) / 2) * s, pt + (r.height - pb - pt) / 2 - ((b.y0 + b.y1) / 2) * s, s, animate);
}
function fit(animate) { fitTo(S.items, animate); }
// Frame the main groups at a readable zoom (the Life group sits off to the side)
function fitMain(animate) { if (S.mode === 'silo') return fit(animate); fitTo(S.items, animate, 0.2, 1.1); }
function fitBloom(animate) {
  const shown = S.items.filter((it) => it.bloom);
  const g = S.groups[S.focus]; if (!g) return;
  const first = shown.slice(0, BLOOM_FIRST);
  fitTo(first.length ? first : shown, animate, 0.32, 1.05);
}
// Open close enough to read the cards; the fit button (⤢) shows the whole board.
function initialView() { fitTo(S.items, false, 0.2, 1.1); }
function centerOn(it, minScale) {
  const r = stage.getBoundingClientRect();
  const [x, y] = D(it);
  const sx = S.tx + x * S.s, sy = S.ty + y * S.s;
  const inside = sx > 80 && sx < r.width - 80 && sy > padTop() + 40 && sy < r.height - 140;
  const s = Math.max(S.s, minScale || 0);
  if (inside && s === S.s) return;
  animateTo(r.width / 2 - x * s, (padTop() + r.height - 120) / 2 - y * s, s, true);
}
let animRaf = 0;
function animateTo(tx, ty, s, animate) {
  cancelAnimationFrame(animRaf);
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { S.tx = tx; S.ty = ty; S.s = s; applyTransform(); return; }
  const a = { tx: S.tx, ty: S.ty, s: S.s }, t0 = performance.now(), D = 520;
  const step = (t) => {
    const k = clamp((t - t0) / D, 0, 1), e = 1 - Math.pow(1 - k, 3);
    S.tx = a.tx + (tx - a.tx) * e; S.ty = a.ty + (ty - a.ty) * e; S.s = a.s + (s - a.s) * e;
    applyTransform();
    if (k < 1) animRaf = requestAnimationFrame(step);
  };
  animRaf = requestAnimationFrame(step);
}
function zoomAt(f, cx, cy) {
  const ns = clamp(S.s * f, 0.15, 1.8);
  const wx = (cx - S.tx) / S.s, wy = (cy - S.ty) / S.s;
  S.s = ns; S.tx = cx - wx * ns; S.ty = cy - wy * ns; applyTransform();
}

/* pointer handling */
const pointers = new Map(); let drag = null; let moved = false;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.ask,.zoom,.hint,.progress,.modes,.tour')) return;
  $('#tip').hidden = true;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stage.setPointerCapture(e.pointerId);
  moved = false;
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty, target: e.target };
  if (pointers.size === 2) { const [p, q] = [...pointers.values()]; drag = { pinch: Math.hypot(p.x - q.x, p.y - q.y), s: S.s }; }
});
stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!drag) return;
  if (drag.pinch && pointers.size === 2) {
    const [p, q] = [...pointers.values()]; const r = stage.getBoundingClientRect();
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    zoomAt((drag.s * d / drag.pinch) / S.s, (p.x + q.x) / 2 - r.left, (p.y + q.y) / 2 - r.top); moved = true; return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!moved && Math.hypot(dx, dy) < 4) return;
  moved = true; stage.classList.add('dragging');
  S.tx = drag.tx + dx; S.ty = drag.ty + dy; applyTransform();
});
const endPointer = (e) => {
  const wasDrag = drag; pointers.delete(e.pointerId); stage.classList.remove('dragging');
  if (pointers.size === 0) {
    if (!moved && wasDrag && wasDrag.target && e.type === 'pointerup') handleStageClick(wasDrag.target);
    drag = null;
  }
};
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
function handleStageClick(target) {
  const card = target.closest('.card'); const hub = target.closest('.hub');
  if (card) return select({ type: 'item', id: card.dataset.id });
  if (hub && hub.dataset.src) return select({ type: 'source', id: hub.dataset.src });
  if (hub && hub.dataset.folder) { const c = S.siloCols.find((x) => x.key === hub.dataset.folder); return select({ type: 'set', ids: c.ids }, { keepPanel: true }); }
  if (hub) return S.focus === hub.dataset.group ? unfocus() : select({ type: 'group', id: hub.dataset.group });
  if (target.closest('.more')) { S.focusAll = true; animateLayout(); renderCanvas(); return fitTo(S.items.filter((it) => it.bloom), true, 0.2, 1); }
  if (S.sel?.type === 'item' && S.focus) return select({ type: 'group', id: S.focus }, { noFit: true });
  if (S.sel || S.focus) unfocus();
}
function animateLayout(ms = 1000) {
  world.classList.add('anim');
  clearTimeout(animateLayout.t);
  animateLayout.t = setTimeout(() => world.classList.remove('anim'), ms);
}
function unfocus() {
  const had = !!S.focus;
  S.focus = null; S.focusAll = false;
  if (had) animateLayout();
  select(null);
  if (had) fitMain(true);
}
// keyboard activation of cards and hubs
cardsEl.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.card')) { e.preventDefault(); select({ type: 'item', id: e.target.closest('.card').dataset.id }); } });
hubsEl.addEventListener('keydown', (e) => { const h = e.target.closest('.hub'); if ((e.key === 'Enter' || e.key === ' ') && h) { e.preventDefault(); select(h.dataset.src ? { type: 'source', id: h.dataset.src } : { type: 'group', id: h.dataset.group }); } });

// hovering a dot shows what it is
const tip = $('#tip');
cardsEl.addEventListener('pointerover', (e) => {
  const c = e.target.closest('.card.dot'); if (!c || drag) return;
  const it = S.byId[c.dataset.id]; if (!it) return;
  const sr = stage.getBoundingClientRect(), r = c.getBoundingClientRect();
  tip.innerHTML = `<span class="meta">${srcChip(it.src)}${esc(tr(it.meta))}</span><span>${esc(it.t)}</span>`;
  tip.style.left = `${r.left + r.width / 2 - sr.left}px`; tip.style.top = `${r.top - sr.top}px`;
  tip.hidden = false;
});
cardsEl.addEventListener('pointerout', (e) => { if (e.target.closest('.card.dot')) tip.hidden = true; });

/* ================= threads ================= */
const threadEls = new Map();
function threadIds() {
  const ids = new Set(S.flying);
  if (!S.sel) return ids;
  if (S.sel.type === 'item') ids.add(S.sel.id);
  if (S.sel.type === 'source') for (const it of S.items) if (it.src === S.sel.id) ids.add(it.id);
  if (S.sel.type === 'set') for (const id of S.sel.ids) ids.add(id);
  if (S.sel.type === 'inter') for (const it of sharedItems(S.sel.a, S.sel.b)) ids.add(it.id);
  return ids;
}
function drawThreads() {
  const ids = threadIds();
  const appR = app.getBoundingClientRect();
  const horizontal = getComputedStyle(dock).flexDirection === 'row';
  const thin = ids.size > 3;
  threadsEl.classList.toggle('thin', thin);
  for (const [id, g] of threadEls) if (!ids.has(id)) { g.remove(); threadEls.delete(id); }
  for (const id of ids) {
    const it = S.byId[id]; if (!it) continue;
    const card = cardsEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const node = dock.querySelector(`[data-src="${it.src}"]`);
    if (!card || !node) continue;
    const cr = card.getBoundingClientRect(), nr = node.getBoundingClientRect();
    let d;
    if (horizontal) {
      const x2 = nr.left + nr.width / 2 - appR.left, y2 = nr.top - appR.top;
      const x1 = cr.left + cr.width / 2 - appR.left, y1 = cr.bottom - appR.top;
      const k = Math.max(60, Math.abs(y2 - y1) * 0.5);
      d = `M${x2},${y2} C${x2},${y2 - k} ${x1},${y1 + k} ${x1},${y1}`;
    } else {
      const x2 = nr.right - appR.left, y2 = nr.top + nr.height / 2 - appR.top;
      const x1 = cr.left - appR.left, y1 = cr.top + cr.height / 2 - appR.top;
      const k = Math.max(60, Math.abs(x1 - x2) * 0.45);
      d = `M${x2},${y2} C${x2 + k},${y2} ${x1 - k},${y1} ${x1},${y1}`;
    }
    let g = threadEls.get(id);
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = '<path class="thread-glow"/><path class="thread"/><path class="thread-pulse"/>';
      threadsEl.appendChild(g); threadEls.set(id, g);
    }
    for (const p of g.children) p.setAttribute('d', d);
  }
  requestAnimationFrame(drawThreads);
}

/* ================= selection ================= */
function select(sel, opts = {}) {
  const before = S.focus;
  if (sel?.type === 'group') { if (S.focus !== sel.id) S.focusAll = false; S.focus = sel.id; }
  else if (sel?.type === 'item') { if (S.focus && !S.byId[sel.id]?.g[S.focus]) S.focus = null; }
  else if (!(sel?.type === 'set' && opts.keepPanel && S.focus)) S.focus = null;
  if (before !== S.focus || sel?.type === 'item') animateLayout();
  S.sel = sel;
  S.keepPanel = !!opts.keepPanel;
  if (sel && !opts.keepPanel) panel.classList.add('open');
  if (sel && sel.type === 'item' && opts.center) centerOn(S.byId[sel.id], opts.minScale);
  renderDock(); renderCanvas(); renderPanel();
  if (sel?.type === 'group' && S.mode === 'canvas' && !opts.noFit) fitBloom(true);
  if (sel && sel.type === 'item') {
    const node = dock.querySelector(`[data-src="${S.byId[sel.id].src}"]`);
    if (node) { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); }
  }
}
dock.addEventListener('click', (e) => {
  const n = e.target.closest('.node'); if (!n) return;
  const sid = n.dataset.src;
  select(S.sel && S.sel.type === 'source' && S.sel.id === sid ? null : { type: 'source', id: sid });
});

/* ================= panel ================= */
function reviewList() {
  const out = [];
  for (const it of S.items) for (const [gid, m] of Object.entries(it.g)) if (m[0] < 0.6 && S.groups[gid]) out.push({ it, gid, m });
  return out;
}
function renderTabs() {
  const nq = reviewList().length;
  const tabs = [['log', L('整理日志', 'Activity')], ['review', L('待确认', 'Review'), nq], ['inv', L('盘点', 'Inventory')], ['synth', L('综合', 'Synthesize')]];
  tabsEl.innerHTML = tabs.map(([k, label, c]) => `<button type="button" role="tab" class="tab${S.tab === k && !detailMode() ? ' on' : ''}" data-tab="${k}" aria-selected="${S.tab === k}">${label}${c ? `<span class="c">${c}</span>` : ''}</button>`).join('') +
    `<button type="button" class="pcol" id="p-collapse" aria-label="${L('收起侧栏', 'Collapse panel')}" title="${L('收起侧栏', 'Collapse panel')}"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` +
    `<button type="button" class="mob-toggle" id="mob-toggle" aria-label="Toggle panel">${panel.classList.contains('open') ? '▾' : '▴'}</button>`;
  const cur = S.sel && !S.keepPanel ? L('详情', 'Details') : S.q ? L('搜索结果', 'Search results') : tabs.find((t) => t[0] === S.tab)[1];
  $('#prail').innerHTML = `<span class="ico"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${nq ? `<span class="c">${nq}</span>` : ''}<span class="vt">${esc(cur)}</span>`;
  $('#prail').setAttribute('aria-label', L('展开侧栏', 'Expand panel'));
}
const detailMode = () => !!(S.sel && !S.keepPanel && S.sel.type !== 'set') || (!!S.q && !S.sel);
function renderPanel() {
  renderTabs();
  let html = '';
  if (S.sel && !S.keepPanel && S.sel.type === 'item') html = itemView(S.byId[S.sel.id]);
  else if (S.sel && !S.keepPanel && S.sel.type === 'group') html = groupView(S.groups[S.sel.id]);
  else if (S.sel && !S.keepPanel && S.sel.type === 'source') html = sourceView(S.sel.id);
  else if (S.sel && !S.keepPanel && S.sel.type === 'inter') html = interView(S.sel.a, S.sel.b);
  else if (S.q && !S.sel) html = searchView();
  else html = ({ log: logView, review: reviewView, inv: invView, synth: synthView })[S.tab]();
  pbody.innerHTML = html;
  pbody.scrollTop = 0;
}
const backBtn = () => `<button type="button" class="back" data-act="back">← ${L('返回', 'Back')}</button>`;
function confBar(c, color) { return `<span class="conf"><span class="bar"><i style="width:${Math.round(c * 100)}%;background:${color}"></i></span>${Math.round(c * 100)}%</span>`; }
function itemView(it) {
  if (!it) return '';
  const s = SRC[it.src];
  const link = it.url || s.home;
  const others = Object.values(S.groups).filter((g) => !it.g[g.id]);
  return `${backBtn()}
  <div class="srcline">${srcChip(it.src)}<span>${esc(s.n)} · ${esc(tr(s.kind))}</span><span class="mono" style="margin-left:auto">${esc(tr(it.meta))}</span></div>
  <h2>${esc(it.t)}</h2>
  <div class="box loc">
    <span class="lbl">${L('原件位置', 'Original location')}</span>
    <span class="path">${esc(tr(it.loc))}</span>
    <div class="safe"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>${L('原件没有被移动或修改。画布上只是一张指向它的索引卡。', 'The original was not moved or changed. The canvas only holds an index card that points to it.')}</span></div>
    ${link ? `<a class="lnk" href="${esc(link)}" target="_blank" rel="noopener">${L('打开原件', 'Open original')} ↗</a>` : `<span class="note">${L('在 Chrome 书签管理器里打开', 'Open it in Chrome\'s bookmark manager')}</span>`}
  </div>
  <div class="lbl">${L('为什么在这些组里', 'Why it is in these groups')}</div>
  ${Object.entries(it.g).filter(([g]) => S.groups[g]).map(([gid, m]) => memBlock(it, gid, m)).join('')}
  ${others.length ? `<div class="addg"><select id="addg-sel" aria-label="${L('加入其他组', 'Add to another group')}"><option value="">${L('也属于另一个组?', 'Also belongs somewhere else?')}</option>${others.map((g) => `<option value="${g.id}">${esc(tr(g.name))}</option>`).join('')}</select><button type="button" class="btn sm" data-act="addg" data-id="${it.id}">${L('加入', 'Add')}</button></div>` : ''}
  <div class="lbl">${L('整理记录', 'Sorting trail')}</div>
  <ol class="trail">${it.trail.map((t) => `<li class="k-${t.k}"><span class="tm">${esc(t.tm)}</span>${esc(LANG === 'zh' ? t.zh : t.en)}</li>`).join('')}</ol>`;
}
function memBlock(it, gid, m) {
  const g = S.groups[gid]; const q = m[0] < 0.6; const you = m[3] === 'you';
  return `<div class="mem${q ? ' q' : ''}">
    <div class="hd"><span class="gdot" style="background:${g.c}"></span><b>${esc(tr(g.name))}</b>${q ? `<span class="flag">${L('拿不准', 'Unsure')}</span>` : ''}${you ? `<span class="flag you">${L('你确认过', 'You confirmed')}</span>` : ''}${confBar(m[0], g.c)}</div>
    <div class="why">${esc(LANG === 'zh' ? m[1] : m[2])}</div>
    <div class="acts">${you ? '' : `<button type="button" class="btn sm" data-act="confirm" data-id="${it.id}" data-g="${gid}">✓ ${L('对', 'Right')}</button>`}<button type="button" class="btn sm ghost" data-act="remove" data-id="${it.id}" data-g="${gid}">✕ ${L('不属于这里', 'Doesn\'t belong')}</button></div>
  </div>`;
}
// A context pack: the items of a group or intersection, with sources and reasons, ready to paste into any AI.
function contextPack(title, def, list, gids) {
  const lines = [`# ${title}`, def ? `\n${def}` : '', `\n${L(`来自 Full Context Canvas:${list.length} 条收藏,${new Set(list.map((it) => it.src)).size} 个平台。`, `From Full Context Canvas: ${list.length} saves across ${new Set(list.map((it) => it.src)).size} platform(s).`)}\n`];
  for (const it of list) {
    const why = gids.map((g) => it.g[g] && (LANG === 'zh' ? it.g[g][1] : it.g[g][2])).filter(Boolean).join(' / ');
    lines.push(`- ${it.url ? `[${it.t}](${it.url})` : it.t} — ${SRC[it.src].n}${it.when ? `, ${it.when}` : ''}${why ? `. ${why}` : ''}`);
  }
  return lines.join('\n');
}
async function copyPack(text) {
  try { await navigator.clipboard.writeText(text); toast(L('已复制。粘贴到 Claude、ChatGPT 或 Gemini 里就能用。', 'Copied. Paste it into Claude, ChatGPT or Gemini.')); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(L('已复制。', 'Copied.')); } catch (e2) { toast(L('复制失败,请手动选择文字。', 'Copy failed; select the text manually.')); } ta.remove(); }
}
const packBtn = (attrs) => `<button type="button" class="btn sm" ${attrs}>${L('复制为 AI 上下文', 'Copy as AI context')}</button>`;
function groupView(g) {
  if (!g) return '';
  const mem = S.items.filter((it) => it.g[g.id]);
  const bySrc = {}; for (const it of mem) (bySrc[it.src] ||= []).push(it);
  return `${backBtn()}
  <div class="srcline"><span class="gdot" style="background:${g.c}"></span><span>${L('AI 生成的组', 'Group made by AI')}</span></div>
  <h2>${esc(tr(g.name))}</h2>
  <div class="box"><div class="lbl" style="margin-bottom:6px">${L('这个组收什么', 'What belongs here')}</div>${esc(tr(g.def))}</div>
  <div style="display:flex;gap:8px;align-items:center">${packBtn(`data-act="pack-group" data-g="${g.id}"`)}<span class="note">${L('带上理由和链接,交给任何一个 AI', 'With reasons and links, for any AI')}</span></div>
  <div class="note">${L(`${mem.length} 条,来自 ${Object.keys(bySrc).length} 个平台。一条收藏可以同时属于好几个组,重叠的地方就是它们的交集。`, `${mem.length} items from ${Object.keys(bySrc).length} platforms. One save can belong to several groups; where the shapes overlap is the intersection.`)}</div>
  ${(() => { const xs = intersections().filter((x) => x.a === g.id || x.b === g.id); return xs.length ? `<div class="lbl">${L('和其他组的交汇', 'Where it meets other groups')}</div><div class="xlist">${xs.map(xRow).join('')}</div>` : ''; })()}
  ${Object.entries(bySrc).map(([sid, arr]) => `<div class="list"><div class="srcline" style="margin:4px 0">${srcChip(sid)}<b style="color:var(--ink)">${SRC[sid].n}</b><span>${arr.length}</span></div>${arr.map((it) => evtRow(it, null, [g.id])).join('')}</div>`).join('')}`;
}
function xRow(x) {
  return `<button type="button" class="xrow" data-act="inter" data-a="${x.a}" data-b="${x.b}"><span class="nm">${gTag(x.a)}<span style="color:var(--muted)">×</span>${gTag(x.b)}</span><span class="ct">${L(`${x.items.length} 条 · ${x.srcs.size} 个平台`, `${x.items.length} · ${x.srcs.size} platforms`)}</span></button>`;
}
function interView(a, b) {
  const sh = sharedItems(a, b); const srcs = new Set(sh.map((it) => it.src));
  return `${backBtn()}
  <div class="srcline"><span class="gdot" style="background:${S.groups[a].c}"></span><span class="gdot" style="background:${S.groups[b].c}"></span><span>${L('交汇点', 'Intersection')}</span></div>
  <h2>${esc(gName(a))} × ${esc(gName(b))}</h2>
  <div>${packBtn(`data-act="pack-inter" data-a="${a}" data-b="${b}"`)}</div>
  <p class="note" style="margin:0">${L(`${sh.length} 条收藏同时属于这两个组,来自 ${srcs.size} 个平台。交汇处常常是你还没说出口、但已经在琢磨的方向。`, `${sh.length} saves belong to both groups, from ${srcs.size} platforms. Intersections are often the idea you are already circling but have not said out loud.`)}</p>
  <div class="list">${sh.map((it) => `${evtRow(it)}<div class="note" style="padding:0 8px 8px 40px;font-size:12px">${esc(tr([it.g[a][1], it.g[a][2]]))} ${esc(tr([it.g[b][1], it.g[b][2]]))}</div>`).join('')}</div>`;
}
function sourceView(sid) {
  const s = SRC[sid]; const arr = S.items.filter((it) => it.src === sid);
  const q = arr.filter(isQ).length;
  const gcount = {}; for (const it of arr) for (const g of Object.keys(it.g)) gcount[g] = (gcount[g] || 0) + 1;
  return `${backBtn()}
  <div class="srcline">${srcChip(sid)}<span>${esc(tr(s.kind))}</span></div>
  <h2>${L(`${s.n} 上的 ${arr.length} 条收藏`, `${arr.length} saves from ${s.n}`)}</h2>
  <div class="sum"><div><b>${arr.length}</b><span>${L('已接收', 'Received')}</span></div><div><b>${arr.length - q}</b><span>${L('已理解', 'Understood')}</span></div><div class="w"><b>${q}</b><span>${L('拿不准', 'Unsure')}</span></div></div>
  <div class="box"><div class="lbl" style="margin-bottom:6px">${L('怎么接入的', 'How it connects')}</div>${esc(tr(s.how))}<div class="safe" style="margin-top:8px"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${L('只读。我们从不在原平台上删除、移动或改名。', 'Read-only. Nothing is ever deleted, moved or renamed on the original platform.')}</span></div></div>
  <div class="lbl">${L('它们去了哪些组', 'Where they went')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">${Object.entries(gcount).sort((a, b) => b[1] - a[1]).map(([g, n]) => S.groups[g] ? `<span class="gtag"><i style="background:${S.groups[g].c}"></i>${esc(gName(g))} <b class="mono">${n}</b></span>` : '').join('')}</div>
  <div class="list">${arr.map((it) => evtRow(it)).join('')}</div>`;
}
function evtRow(it, tm, onlyGroups) {
  const gs = Object.entries(it.g).filter(([g]) => S.groups[g] && (!onlyGroups || true));
  return `<button type="button" class="evt" data-act="open" data-id="${it.id}">
    ${tm ? `<span class="tm">${esc(tm)}</span>` : ''}${srcChip(it.src)}
    <span class="bd"><span class="tt">${esc(it.t)}</span>
    <span class="to">→ ${gs.map(([g, m]) => gTag(g, m[0] < 0.6)).join('')}</span></span></button>`;
}
function logView() {
  const total = S.items.length, q = S.items.filter(isQ).length;
  const days = {};
  const ordered = [...S.log].sort((a, b) => (a.tm < b.tm ? 1 : -1));
  for (const e of ordered.slice(0, 60)) (days[e.tm.slice(0, 10)] ||= []).push(e);
  return `<div class="sum"><div><b>${total}</b><span>${L('已接收', 'Received')}</span></div><div><b>${total - q}</b><span>${L('已理解', 'Understood')}</span></div><div class="w"><b>${q}</b><span>${L('拿不准,等你看', 'Unsure, for you')}</span></div></div>
  <p class="note" style="margin:0">${L('每一次整理都会留下记录:从哪来、放进了哪些组、有多大把握。点一条就能看到理由,也能改。', 'Every decision leaves a record: where it came from, which groups it went into, and how sure the AI was. Click one to see why, or change it.')}</p>
  ${Object.entries(days).map(([d, arr]) => `<div class="list"><div class="lbl" style="margin:6px 0 2px">${esc(d)}</div>${arr.map((e) => e.kind === 'fix' ? fixRow(e) : evtRow(S.byId[e.id], hm(e.tm))).join('')}</div>`).join('')}`;
}
function fixRow(e) {
  const it = S.byId[e.id]; if (!it) return '';
  return `<button type="button" class="evt" data-act="open" data-id="${it.id}"><span class="tm">${esc(hm(e.tm))}</span>${srcChip(it.src)}<span class="bd"><span class="tt">${esc(it.t)}</span><span class="to" style="color:var(--ok)">${esc(LANG === 'zh' ? e.zh : e.en)}</span></span></button>`;
}
function reviewView() {
  const list = reviewList();
  if (!list.length) return `<div class="box"><b>${L('都确认过了。', 'Nothing left to review.')}</b><p class="note" style="margin:6px 0 0">${L('AI 拿不准的东西会出现在这里,不会悄悄放错。', 'Anything the AI is unsure about shows up here instead of being quietly misfiled.')}</p></div>`;
  return `<p class="note" style="margin:0">${L(`这 ${list.length} 处 AI 拿不准。它先放了进去,但标了出来,等你一键确认或移出。你的每次纠正都会让它下次分得更准。`, `The AI is unsure about these ${list.length}. It placed them but flagged them, so you can confirm or remove with one click. Each correction teaches it.`)}</p>
  ${list.map(({ it, gid, m }) => `<div class="mem q"><div class="hd">${srcChip(it.src)}<b style="font-size:13px">${esc(it.t)}</b></div>
    <div style="display:flex;gap:6px;align-items:center">${gTag(gid, true)}${confBar(m[0], S.groups[gid].c)}</div>
    <div class="why">${esc(LANG === 'zh' ? m[1] : m[2])}</div>
    <div class="acts"><button type="button" class="btn sm" data-act="confirm" data-id="${it.id}" data-g="${gid}">✓ ${L('对,放这里', 'Yes, keep it')}</button><button type="button" class="btn sm ghost" data-act="remove" data-id="${it.id}" data-g="${gid}">✕ ${L('不属于这里', 'Doesn\'t belong')}</button><button type="button" class="btn sm ghost" data-act="open" data-id="${it.id}">${L('在画布上看', 'Show on canvas')}</button></div></div>`).join('')}`;
}
function invView() {
  const rows = SRC_IDS.map((sid) => { const arr = S.items.filter((it) => it.src === sid); const q = arr.filter(isQ).length; return { sid, n: arr.length, q }; });
  const total = S.items.length;
  const plats = rows.filter((r) => r.n).length;
  const groups = Object.values(S.groups).map((g) => { const mem = S.items.filter((it) => it.g[g.id]); return { g, n: mem.length, srcs: new Set(mem.map((it) => it.src)) }; }).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const multi = S.items.filter((it) => Object.keys(it.g).length > 1).length;
  return `<h2>${L(`你一共存了 ${total} 样东西,分散在 ${plats} 个平台`, `You have ${total} saved things across ${plats} platforms`)}</h2>
  <p class="note" style="margin:0">${L(`其中 ${multi} 条同时属于不止一个组。原件都还在原来的平台,这里只保存索引、标签和理由。`, `${multi} of them belong to more than one group. Every original is still on its platform; this canvas keeps only the index, tags and reasons.`)}</p>
  <div class="box" style="overflow-x:auto"><table class="inv"><thead><tr><th>${L('平台', 'Platform')}</th><th class="n">${L('接收', 'In')}</th><th class="n">${L('理解', 'Sorted')}</th><th class="n">${L('拿不准', 'Unsure')}</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td><span style="display:inline-flex;gap:6px;align-items:center">${srcChip(r.sid)}${SRC[r.sid].n}</span></td><td class="n">${r.n}</td><td class="n">${r.n - r.q}</td><td class="n" style="color:${r.q ? 'var(--warn)' : 'inherit'}">${r.q}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="lbl">${L('交汇最多的地方', 'Biggest intersections')}</div>
  <div class="xlist">${intersections().slice(0, 5).map(xRow).join('')}</div>
  <div class="lbl">${L('主题分布,以及它们横跨了哪些平台', 'Themes, and which platforms they span')}</div>
  <div class="box" style="overflow-x:auto"><table class="inv"><tbody>
  ${groups.map(({ g, n, srcs }) => `<tr><td><button type="button" class="gtag" data-act="group" data-g="${g.id}"><i style="background:${g.c}"></i>${esc(tr(g.name))}</button></td><td class="n">${n}</td><td><span class="spread">${SRC_IDS.map((sid) => `<i title="${SRC[sid].n}" style="${srcs.has(sid) ? 'background:var(--accent)' : ''}"></i>`).join('')}</span></td></tr>`).join('')}
  </tbody></table></div>`;
}
function synthView() {
  const sy = S.synth;
  const presets = `<div class="presetcol">${PRESETS.map((p) => `<button type="button" data-preset="${p.k}">${esc(tr(p.q))}<small>${esc(tr(p.sub))}</small></button>`).join('')}</div>`;
  const toggle = sampleFn ? `<label class="switch"><input type="checkbox" id="force-canned" ${S.forceCanned ? 'checked' : ''}> ${L('用离线演示答案(更快更稳)', 'Use offline demo answers (faster, predictable)')}</label>` : `<p class="note" style="margin:0">${L('这个视图里连不上实时 AI,下面会用预先写好的演示答案,引用的都是画布上的真实卡片。', 'Live AI is not available in this view, so these use prepared demo answers. Every citation points at a real card on the canvas.')}</p>`;
  if (!sy) return `<h2>${L('把散落的东西综合起来', 'Put the scattered pieces together')}</h2><p class="note" style="margin:0">${L('它会同时读 7 个平台上的收藏和 AI 聊天。每一句都带出处,点一下就能看到那张卡片和连回原平台的线。', 'It reads saves and AI chats from all 7 platforms at once. Every sentence carries a source; click one to see the card and its thread back to the platform.')}</p>${presets}${toggle}`;
  const cites = citeOrder(sy.text);
  const plats = new Set(cites.map((id) => S.byId[id]?.src).filter(Boolean));
  return `<div class="synth">
    <div class="srcline" style="margin-bottom:10px"><span class="lbl">${esc(sy.q)}</span>${sy.live ? `<span class="pill live" style="margin-left:auto"><span class="dot"></span>Claude</span>` : `<span class="pill" style="margin-left:auto">${L('演示答案', 'Demo answer')}</span>`}</div>
    ${sy.note ? `<p class="note warn">${esc(sy.note)}</p>` : ''}
    <div class="out">${sy.text ? md(sy.text, cites) : `<p class="note">${L('思考中…', 'Thinking…')}</p>`}${sy.done ? '' : '<span class="caret"></span>'}</div>
    ${sy.done ? `<div class="foot" style="margin-top:12px"><span class="note">${L(`用到 ${cites.length} 条来源,来自 ${plats.size} 个平台`, `${cites.length} sources from ${plats.size} platforms`)}</span><span style="display:flex;gap:4px">${[...plats].map(srcChip).join('')}</span>
      <button type="button" class="btn sm" data-act="showall" style="margin-left:auto">${L('在画布上连出全部来源', 'Light up all sources')}</button></div>` : `<div class="foot" style="margin-top:12px"><button type="button" class="btn sm" data-act="stop">${L('停止', 'Stop')}</button></div>`}
  </div>
  <div class="lbl">${L('再问一个', 'Ask another')}</div>${presets}${toggle}`;
}
function searchView() {
  const res = S.items.filter(matches);
  const bySrc = {}; for (const it of res) (bySrc[it.src] ||= []).push(it);
  return `<h2>${L(`「${esc(S.q)}」:在 ${Object.keys(bySrc).length} 个平台找到 ${res.length} 条`, `"${esc(S.q)}": ${res.length} results on ${Object.keys(bySrc).length} platforms`)}</h2>
  ${res.length ? '' : `<p class="note">${L('没找到。试试别的词,或者用下面的「问问」让 AI 帮你找。', 'Nothing matched. Try another word, or ask the AI below.')}</p>`}
  ${Object.entries(bySrc).map(([sid, arr]) => `<div class="list"><div class="srcline" style="margin:4px 0">${srcChip(sid)}<b style="color:var(--ink)">${SRC[sid].n}</b><span>${arr.length}</span></div>${arr.map((it) => evtRow(it)).join('')}</div>`).join('')}`;
}
function matches(it) {
  const q = S.q.trim().toLowerCase(); if (!q) return false;
  const hay = [it.t, tr(it.meta), it.snip, tr(it.loc), SRC[it.src].n, ...Object.keys(it.g).map((g) => S.groups[g] ? S.groups[g].name.join(' ') : '')].join(' ').toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/* markdown-lite with citations */
function citeOrder(text) {
  const out = []; const re = /\[([a-z]{1,3}\d{1,3}|i\d+)\]/g; let m;
  while ((m = re.exec(text))) if (S.byId[m[1]] && !out.includes(m[1])) out.push(m[1]);
  return out;
}
function md(text, order) {
  const lines = esc(text).split('\n');
  let html = '', inList = false;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([a-z]{1,3}\d{1,3}|i\d+)\]/g, (all, id) => {
    const it = S.byId[id]; if (!it) return all;
    const n = order.indexOf(id) + 1;
    const on = S.sel && S.sel.type === 'item' && S.sel.id === id;
    return `<button type="button" class="cite${on ? ' on' : ''}" data-act="cite" data-id="${id}" title="${esc(SRC[it.src].n + ': ' + it.t)}">${n}</button>`;
  });
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\s*[-*] /.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (/^### /.test(l)) html += `<h4>${inline(l.slice(4))}</h4>`;
    else if (/^## /.test(l)) html += `<h3>${inline(l.slice(3))}</h3>`;
    else if (/^# /.test(l)) html += `<h3>${inline(l.slice(2))}</h3>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

/* ================= panel events ================= */
tabsEl.addEventListener('click', (e) => {
  if (e.target.closest('#mob-toggle')) { panel.classList.toggle('open'); renderTabs(); return; }
  if (e.target.closest('#p-collapse')) return setPanelClosed(true);
  const t = e.target.closest('.tab'); if (!t) return;
  S.tab = t.dataset.tab; panel.classList.add('open');
  if (S.sel && !S.keepPanel) { S.sel = null; renderDock(); renderCanvas(); }
  if (S.q) { S.q = ''; $('#q').value = ''; renderDock(); renderCanvas(); }
  S.keepPanel = false;
  renderPanel();
});
pbody.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-preset]'); if (!b) return;
  if (b.dataset.preset) return runPreset(b.dataset.preset);
  const act = b.dataset.act, id = b.dataset.id, gid = b.dataset.g;
  if (act === 'back') return S.sel?.type === 'item' && S.focus ? select({ type: 'group', id: S.focus }, { noFit: true }) : unfocus();
  if (act === 'open') return select({ type: 'item', id }, { center: true });
  if (act === 'group') return select({ type: 'group', id: gid });
  if (act === 'inter') return focusInter(b.dataset.a, b.dataset.b);
  if (act === 'pack-group') { const g = S.groups[gid]; return copyPack(contextPack(tr(g.name), tr(g.def), S.items.filter((it) => it.g[gid]), [gid])); }
  if (act === 'pack-inter') { const a = b.dataset.a, c = b.dataset.b; return copyPack(contextPack(`${gName(a)} × ${gName(c)}`, '', sharedItems(a, c), [a, c])); }
  if (act === 'confirm') return confirmMem(id, gid);
  if (act === 'remove') return removeMem(id, gid);
  if (act === 'addg') { const v = $('#addg-sel').value; if (v) addMem(id, v); return; }
  if (act === 'cite') { const same = S.sel && S.sel.type === 'item' && S.sel.id === id; select(same ? null : { type: 'item', id }, { keepPanel: true, center: !same, minScale: 0.55 }); return; }
  if (act === 'showall') return showAllSources();
  if (act === 'stop') { synthCtl?.abort(); return; }
});
pbody.addEventListener('change', (e) => {
  if (e.target.id === 'force-canned') { S.forceCanned = e.target.checked; renderAIPill(); }
});

/* corrections: the AI learns (recorded in the trail) */
function logFix(it, zh, en) {
  const tm = nowStamp();
  it.trail.push({ k: 'you', tm, zh, en });
  S.log.push({ tm, id: it.id, kind: 'fix', zh, en });
}
function confirmMem(id, gid) {
  const it = S.byId[id]; const m = it.g[gid]; if (!m) return;
  it.g[gid] = [1, m[1], m[2], 'you'];
  logFix(it, `你确认了「${S.groups[gid].name[0]}」。类似内容以后会更有把握地放这里。`, `You confirmed "${S.groups[gid].name[1]}". Similar items will go here with more confidence.`);
  toast(`✓ ${L('已确认', 'Confirmed')}`, gid);
  rerenderAfterEdit(it);
}
function removeMem(id, gid) {
  const it = S.byId[id]; if (!it.g[gid]) return;
  const name = S.groups[gid].name;
  delete it.g[gid];
  if (!Object.keys(it.g).length) { ensureGroup('misc', L('没看懂', 'Unsorted'), L('AI 没能判断的东西,等你来放。', 'Things the AI could not place, waiting for you.')); it.g.misc = [0.3, '移出后没有别的组了,先放在这里等你。', 'No other group left after removal; parked here for you.']; }
  logFix(it, `你把它移出了「${name[0]}」。原件没动,只是换了标签。`, `You removed it from "${name[1]}". The original is untouched; only the tag changed.`);
  toast(`✕ ${L('已移出', 'Removed from')}`, gid);
  rerenderAfterEdit(it);
}
function addMem(id, gid) {
  const it = S.byId[id];
  it.g[gid] = [1, '你手动加进来的。', 'You added it by hand.', 'you'];
  if (it.g.misc && gid !== 'misc') delete it.g.misc;
  logFix(it, `你把它也加进了「${S.groups[gid].name[0]}」。`, `You also added it to "${S.groups[gid].name[1]}".`);
  toast(`+ ${L('已加入', 'Added to')}`, gid);
  rerenderAfterEdit(it);
}
// Hand the current placements to a host that stores them (the browser extension); no-op on the web demo.
function persist() {
  if (typeof window.FCC_SAVE !== 'function') return;
  const items = S.items.map(({ id, src, t, meta, when, loc, url, folder, snip, g }) => ({ id, src, t, meta, when, loc, url, folder, snip, g }));
  const groups = {}; for (const [k, g] of Object.entries(S.groups)) groups[k] = { name: g.name, def: g.def, c: g.c, hub: g.hub, extra: g.extra };
  try { window.FCC_SAVE({ items, groups }); } catch (e) {}
}
function rerenderAfterEdit(it) {
  persist();
  world.classList.add('anim');
  layoutSome([it]);
  renderCanvas(); renderDock(); renderPanel();
  setTimeout(() => { world.classList.remove('anim'); renderBlobs(); }, 1000);
}

function setPanelClosed(v) {
  app.classList.toggle('pclosed', v);
  try { localStorage.setItem('fcc-pclosed', v ? '1' : ''); } catch (e) {}
  if (!v) $('#p-collapse')?.focus(); else $('#prail').focus();
}
$('#prail').addEventListener('click', () => setPanelClosed(false));
try { if (localStorage.getItem('fcc-pclosed') === '1') app.classList.add('pclosed'); } catch (e) {}

/* ================= toasts & progress ================= */
function toast(text, gids) {
  const t = document.createElement('div'); t.className = 'toast';
  const tags = [].concat(gids || []).map((g) => gTag(g)).join('');
  t.innerHTML = `<span>${esc(text)}</span>${tags}`;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function progress(text) { const p = $('#progress'); p.hidden = !text; $('#progress-t').textContent = text || ''; }

/* ================= arrival animation ================= */
function dockWorldPoint(sid) {
  const node = dock.querySelector(`[data-src="${sid}"]`); const sr = stage.getBoundingClientRect();
  const nr = node.getBoundingClientRect();
  const sx = nr.left + nr.width / 2 - sr.left, sy = nr.top + nr.height / 2 - sr.top;
  return [(sx - S.tx) / S.s, (sy - S.ty) / S.s];
}
async function arrive(raw, opts = {}) {
  if (S.mode === 'silo') { setMode('canvas'); await sleep(1100); }
  if (S.focus) { S.focus = null; S.focusAll = false; S.sel = null; animateLayout(); renderCanvas(); }
  const it = addItem(raw, nowStamp());
  it.fresh = true;
  layoutSome([it]);
  it.fresh = false;
  const [dx, dy] = dockWorldPoint(it.src);
  const tx = it.x, ty = it.y;
  it.flyingNow = true; it.skipInit = true;
  renderCanvas();
  const c = cardsEl.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
  world.classList.remove('anim');
  place(c, dx, dy, ' scale(.4)');
  void c.offsetWidth;
  world.classList.add('anim');
  S.flying.add(it.id);
  place(c, tx, ty);
  c.classList.add('new');
  const node = dock.querySelector(`[data-src="${it.src}"]`); node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse');
  if (opts.center) centerOn(it);
  if (opts.toast !== false) toast(L(`${SRC[it.src].n} 新收藏 → `, `New from ${SRC[it.src].n} → `), Object.keys(it.g));
  renderDock(); if (!S.sel && !S.q) renderPanel(); else renderTabs();
  await sleep(1000);
  it.flyingNow = false; it.skipInit = false;
  S.flying.delete(it.id);
  renderBlobs();
  setTimeout(() => world.classList.remove('anim'), 50);
  return it;
}
async function intakeOne() {
  if (S.intake >= INTAKE.length) { toast(L('演示里的新收藏都到了。试试「导入」你自己的文件。', 'All demo saves have arrived. Try importing your own file.')); return; }
  const raw = INTAKE[S.intake++];
  S.tab = 'log';
  await arrive({ ...raw, when: nowStamp().slice(0, 10) }, { center: true });
  if (S.intake >= INTAKE.length) $('#btn-intake').disabled = true;
}
$('#btn-intake').addEventListener('click', intakeOne);

/* ================= live AI (artifact runtime) ================= */
let sampleFn = null;
try {
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('sample').then((f) => { if (f) { sampleFn = f; renderAIPill(); if (S.tab === 'synth' && !S.sel) renderPanel(); } }).catch(() => {});
  }
} catch (e) {}
// In the browser extension, Claude is reached through the background worker with the user's own key.
if (!sampleFn && typeof window.FCC_ASK === 'function') {
  const ask = async (prompt, o = {}) => { const r = await window.FCC_ASK(prompt); if (r && r.error) throw { code: r.code || 'upstream_error', message: r.error }; o.onText?.({ text: r.text, delta: r.text }); return { text: r.text, truncated: false }; };
  ask.json = async (prompt) => { const { text } = await ask(prompt + '\n\nReply with only the JSON value.'); const m = text.match(/[\[{][\s\S]*[\]}]/); if (!m) throw { code: 'invalid_json' }; return JSON.parse(m[0]); };
  sampleFn = ask;
}
const disableLive = (code) => ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code);

/* ================= synthesis ================= */
let synthCtl = null;
function runPreset(k, opts) {
  const p = PRESETS.find((x) => x.k === k);
  S.synthPromise = runSynth(tr(p.q), p, opts);
  return S.synthPromise;
}
$('#ask').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#ask-q').value.trim(); if (!q) return;
  const p = PRESETS.find((x) => x.q.some((s) => s === q));
  S.synthPromise = runSynth(q, p || null);
});
$('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) runPreset(b.dataset.preset); });

function itemsForPrompt() {
  return S.items.map((it) => `[${it.id}] ${SRC[it.src].n} ${tr(SRC[it.src].kind)} | groups: ${Object.keys(it.g).map((g) => S.groups[g]?.name[1] || g).join(', ')} | ${it.t} | ${(it.snip || '').slice(0, 220)}`).join('\n');
}
async function runSynth(q, preset, opts = {}) {
  synthCtl?.abort();
  S.tab = 'synth'; S.sel = null; S.keepPanel = false; S.q = ''; $('#q').value = '';
  panel.classList.add('open');
  renderDock(); renderCanvas();
  const useLive = sampleFn && !S.forceCanned && !opts.canned;
  S.synth = { q, text: '', done: false, live: !!useLive, note: '' };
  renderPanel();
  const ctl = new AbortController(); synthCtl = ctl;
  if (useLive) {
    const task = preset ? preset.task : `Answer the user's request using their saved items: "${q}"`;
    const prompt = `You are the synthesis layer of Full Context Canvas, an app that gathers a person's saves and AI chats from many platforms onto one canvas.
Task: ${task}
Rules:
- Use only the items below. Do not invent facts, numbers or employers that are not in them.
- After every sentence that relies on an item, cite it inline with its id in square brackets, like [c2] or [c2][y4]. Cite items from as many different platforms as are relevant.
- Write in ${LANG === 'zh' ? 'Simplified Chinese' : 'English'}.
- Format: start with a "## " heading, then short "### " sections with "- " bullets. Use **bold** sparingly. No preamble, no closing remarks. Keep it under 300 words.

Items (id, platform, groups, title, snippet):
${itemsForPrompt()}`;
    try {
      const res = await sampleFn(prompt, { signal: ctl.signal, onText: ({ text }) => { if (S.synth && synthCtl === ctl) { S.synth.text = text; paintSynth(); } } });
      if (synthCtl !== ctl) return;
      S.synth.text = res.text; S.synth.done = true;
      if (res.truncated) S.synth.note = L('答案被截断了,可以换个更具体的问题。', 'The answer was cut short; try a narrower question.');
      paintSynth(true);
      return;
    } catch (e) {
      if (synthCtl !== ctl) return;
      if (e && e.code === 'cancelled') { S.synth.text = e.text || S.synth.text; S.synth.done = true; paintSynth(true); return; }
      if (e && disableLive(e.code)) { sampleFn = null; renderAIPill(); }
      S.synth.live = false;
      S.synth.note = L('实时 AI 这次没有回应,下面换成离线演示答案。', 'Live AI did not respond this time, so this is the offline demo answer.');
      S.synth.text = '';
    }
  }
  if (!preset) {
    // offline free-form question: fall back to search across everything
    S.synth.done = true; S.synth.live = false;
    const hits = S.items.filter((it) => { S.q = q; const r = matches(it); S.q = ''; return r; });
    S.synth.text = hits.length
      ? (L(`## 和「${q}」相关的收藏\n`, `## Saves related to "${q}"\n`) + hits.map((it) => `- ${it.t} [${it.id}]`).join('\n'))
      : L(`## 离线模式\n在离线演示里只能回答上面三个示例问题。连上实时 AI 后,可以问任何问题。`, `## Offline mode\nThe offline demo answers the three example questions. With live AI connected you can ask anything.`);
    paintSynth(true); return;
  }
  if (!CANNED[preset.k]) {
    S.synth.done = true; S.synth.live = false;
    S.synth.text = L('## 需要连接 Claude\n在插件设置里填入 Claude API key,就能对你的全部收藏提问。', '## Connect Claude\nAdd a Claude API key in the extension settings to ask questions across everything you saved.');
    paintSynth(true); return;
  }
  const full = CANNED[preset.k][LANG === 'zh' ? 0 : 1];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; i <= full.length; i += reduce ? full.length : 4) {
    if (ctl.signal.aborted || synthCtl !== ctl) { if (synthCtl === ctl) { S.synth.done = true; paintSynth(true); } return; }
    S.synth.text = full.slice(0, i); paintSynth();
    await sleep(14);
  }
  S.synth.text = full; S.synth.done = true; paintSynth(true);
}
let paintQueued = false;
function paintSynth(force) {
  if (S.tab !== 'synth' || (S.sel && !S.keepPanel)) return;
  if (force) { const st = pbody.scrollTop; renderPanel(); pbody.scrollTop = st; return; }
  if (paintQueued) return; paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    const out = pbody.querySelector('.synth .out');
    if (!out) { renderPanel(); return; }
    const order = citeOrder(S.synth.text);
    out.innerHTML = (S.synth.text ? md(S.synth.text, order) : `<p class="note">${L('思考中…', 'Thinking…')}</p>`) + '<span class="caret"></span>';
  });
}

/* ================= import ================= */
const modal = $('#modal'); let pending = [];
function renderImportText() {
  $('#imp-h').textContent = L('把你的东西倒进来', 'Pour your stuff in');
  $('#imp-sub').textContent = L('文件只在你的浏览器里读取。整理时,只有标题和开头一小段会发给 AI。原文件不会被修改。', 'Files are read in your browser. When sorting, only titles and a short excerpt go to the AI. Your files are never changed.');
  $('#drop-t').textContent = L('拖文件到这里,或点这里选择', 'Drop files here, or click to choose');
  $('#drop-s').textContent = L('一次最多整理 60 条(原型限制)', 'Up to 60 items per import (prototype limit)');
  $('#fmt').innerHTML = [
    ['claude', L('Claude 数据导出', 'Claude data export'), 'conversations.json'],
    ['chatgpt', L('ChatGPT 数据导出', 'ChatGPT data export'), 'conversations.json'],
    ['gemini', L('Gemini(Google Takeout)', 'Gemini (Google Takeout)'), 'MyActivity.json'],
    ['chrome', L('浏览器书签导出', 'Browser bookmarks export'), 'bookmarks.html / Bookmarks'],
    ['reddit', L('任何链接列表(YouTube、Reddit、X 链接会自动识别)', 'Any list of links (YouTube, Reddit and X links are detected)'), '.txt / .csv'],
  ].map(([sid, a, b]) => `${srcChip(sid)}<span>${esc(a)} <span class="path">${esc(b)}</span></span>`).join('');
  $('#imp-sample').textContent = L('用示例书签文件试试', 'Try a sample bookmarks file');
  $('#imp-cancel').textContent = L('取消', 'Cancel');
  $('#imp-go').textContent = pending.length ? L(`开始整理 ${pending.length} 条`, `Sort ${pending.length} items`) : L('开始整理', 'Start sorting');
}
function openImport() { pending = []; $('#imp-result').innerHTML = ''; $('#imp-go').disabled = true; renderImportText(); modal.hidden = false; $('#imp-cancel').focus(); }
function closeImport() { modal.hidden = true; }
$('#btn-import').addEventListener('click', openImport);
$('#imp-cancel').addEventListener('click', closeImport);
modal.addEventListener('click', (e) => { if (e.target === modal) closeImport(); });
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
$('#file').addEventListener('change', (e) => handleFiles(e.target.files));
$('#imp-sample').addEventListener('click', () => { acceptParsed([parseText('bookmarks_sample.html', SAMPLE_BOOKMARKS)]); });
$('#imp-go').addEventListener('click', () => { const list = pending; closeImport(); organize(list); });

async function handleFiles(files) {
  const results = [];
  for (const f of files) {
    try { results.push(parseText(f.name, await f.text())); }
    catch (err) { results.push({ name: f.name, items: [], error: String(err.message || err) }); }
  }
  acceptParsed(results);
}
function acceptParsed(results) {
  const seen = new Set(S.items.map((it) => (it.url || it.t).toLowerCase()));
  pending = [];
  for (const r of results) for (const it of r.items) {
    const key = (it.url || it.t).toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    if (pending.length < 60) pending.push(it);
  }
  const total = results.reduce((a, r) => a + r.items.length, 0);
  $('#imp-result').innerHTML = results.map((r) => `<div class="box" style="display:flex;gap:8px;align-items:center">${r.src ? srcChip(r.src) : ''}<span><b>${esc(r.name)}</b> · ${r.error ? `<span class="note warn">${esc(L('读不懂这个文件:', 'Could not read this file: ') + r.error)}</span>` : esc(L(`${r.label || ''} 找到 ${r.items.length} 条`, `${r.label || ''} ${r.items.length} items found`))}</span></div>`).join('') +
    (total > pending.length ? `<p class="note">${L(`去重并截取后,这次整理 ${pending.length} 条。`, `After removing duplicates and capping, ${pending.length} will be sorted now.`)}</p>` : '');
  $('#imp-go').disabled = !pending.length;
  renderImportText();
}

let impSeq = 0;
function srcFromUrl(u) {
  const h = (() => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
  if (/youtube\.com|youtu\.be/.test(h)) return 'youtube';
  if (/reddit\.com/.test(h)) return 'reddit';
  if (/(^|\.)x\.com$|twitter\.com/.test(h)) return 'x';
  return 'chrome';
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const day = (v) => { if (!v) return ''; const d = typeof v === 'number' ? new Date(v > 1e12 ? v : v * 1000) : new Date(v); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
function mk(src, t, extra) { return { id: 'i' + (++impSeq), src, t: (t || 'Untitled').trim().slice(0, 140), g: {}, ...extra }; }
function parseText(name, text) {
  const trimmed = text.trim();
  if (/^<!DOCTYPE NETSCAPE-Bookmark/i.test(trimmed) || /<DT><A /i.test(trimmed)) return parseBookmarksHtml(name, text);
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed);
    if (data && data.roots) return parseChromeJson(name, data);
    const arr = Array.isArray(data) ? data : (data.conversations || []);
    const first = arr[0] || {};
    if (first.mapping) return parseChatGPT(name, arr);
    if (first.chat_messages || (first.uuid && 'name' in first)) return parseClaude(name, arr);
    if (first.header && first.title) return parseTakeout(name, arr);
    throw new Error(L('不认识的 JSON 结构', 'unrecognized JSON structure'));
  }
  const urls = [...text.matchAll(/https?:\/\/[^\s"'<>,)]+/g)].map((m) => m[0]);
  if (!urls.length) throw new Error(L('没有找到链接', 'no links found'));
  return { name, label: L('链接', 'Links'), src: 'chrome', items: urls.map((u) => { const s = srcFromUrl(u); return mk(s, host(u) + new URL(u).pathname.replace(/\/$/, ''), { url: u, meta: [host(u), host(u)], loc: [L(`导入的列表 · ${name}`, `Imported list · ${name}`), `Imported list · ${name}`], snip: u, when: '' }); }) };
}
function parseBookmarksHtml(name, text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const items = [];
  const walk = (dl, path) => {
    for (const dt of dl.children) {
      if (dt.tagName !== 'DT') continue;
      const a = dt.querySelector(':scope > a'); const h3 = dt.querySelector(':scope > h3'); const sub = dt.querySelector(':scope > dl');
      if (a) { const u = a.getAttribute('href') || ''; if (!/^https?:/.test(u)) continue; const s = srcFromUrl(u); const p = ['Chrome', ...path].join(' › ');
        items.push(mk(s, a.textContent || host(u), { url: u, meta: [host(u), host(u)], loc: [p, p], snip: `${a.textContent} ${u} folder: ${path.join('/')}`, when: day(Number(a.getAttribute('add_date'))) })); }
      if (h3 && sub) walk(sub, [...path, h3.textContent.trim()]);
    }
  };
  const top = doc.querySelector('dl'); if (top) walk(top, []);
  return { name, label: L('书签', 'Bookmarks'), src: 'chrome', items };
}
function parseChromeJson(name, data) {
  const items = [];
  const walk = (node, path) => {
    if (node.type === 'url') { const u = node.url; const s = srcFromUrl(u); const p = ['Chrome', ...path].join(' › ');
      items.push(mk(s, node.name || host(u), { url: u, meta: [host(u), host(u)], loc: [p, p], snip: `${node.name} ${u} folder: ${path.join('/')}`, when: '' })); }
    for (const c of node.children || []) walk(c, node.type === 'folder' && node.name ? [...path, node.name] : path);
  };
  for (const r of Object.values(data.roots)) if (r && typeof r === 'object') walk(r, r.name ? [r.name] : []);
  return { name, label: L('书签', 'Bookmarks'), src: 'chrome', items };
}
function parseClaude(name, arr) {
  return { name, label: 'Claude', src: 'claude', items: arr.map((c) => {
    const msgs = c.chat_messages || [];
    const firstHuman = msgs.find((m) => m.sender === 'human');
    const txt = firstHuman ? (firstHuman.text || (firstHuman.content || []).map((p) => p.text || '').join(' ')) : '';
    return mk('claude', c.name || txt.slice(0, 60) || 'Untitled chat', { meta: [`${msgs.length} 条消息`, `${msgs.length} messages`], loc: ['Claude › 导出的对话', 'Claude › Exported chats'], snip: txt.slice(0, 400), when: day(c.created_at), url: c.uuid ? `https://claude.ai/chat/${c.uuid}` : undefined });
  }) };
}
function parseChatGPT(name, arr) {
  return { name, label: 'ChatGPT', src: 'chatgpt', items: arr.map((c) => {
    const nodes = Object.values(c.mapping || {}).map((n) => n.message).filter(Boolean);
    const users = nodes.filter((m) => m.author && m.author.role === 'user').sort((a, b) => (a.create_time || 0) - (b.create_time || 0));
    const txt = users[0] ? (users[0].content?.parts || []).filter((p) => typeof p === 'string').join(' ') : '';
    const id = c.conversation_id || c.id;
    return mk('chatgpt', c.title || txt.slice(0, 60), { meta: [`${nodes.length} 条消息`, `${nodes.length} messages`], loc: ['ChatGPT › 导出的对话', 'ChatGPT › Exported chats'], snip: txt.slice(0, 400), when: day(c.create_time), url: id ? `https://chatgpt.com/c/${id}` : undefined });
  }) };
}
function parseTakeout(name, arr) {
  const items = arr.filter((a) => a.title).map((a) => {
    const hdr = a.header || '';
    const src = /gemini|bard/i.test(hdr) ? 'gemini' : /youtube/i.test(hdr) ? 'youtube' : 'chrome';
    const t = a.title.replace(/^(Prompted|Watched|Saved|Liked)\s+/i, '');
    return mk(src, t, { meta: [hdr, hdr], loc: [`Google Takeout › ${hdr}`, `Google Takeout › ${hdr}`], snip: t, when: day(a.time), url: a.titleUrl });
  });
  return { name, label: 'Google Takeout', src: items[0]?.src || 'gemini', items };
}

/* classification */
const KW = {
  ai: ['ai', 'gpt', 'claude', 'llm', 'agent', 'prompt', 'mcp', 'rag', 'gemini', 'model', 'machine learning', 'hugging', '智能', '模型', '提示词'],
  design: ['design', 'ui', 'ux', 'figma', 'typography', 'motion', 'material', 'nngroup', 'refactoring', 'interface', '设计', '交互', '动效', '界面'],
  learn: ['learn', 'course', 'tutorial', 'study', 'adhd', 'focus', 'habit', 'notes', 'read', '学习', '教程', '专注', '方法'],
  career: ['job', 'jobs', 'resume', 'résumé', 'career', 'hiring', 'salary', 'interview', 'portfolio', 'linkedin', 'wellfound', '简历', '求职', '面试', '作品集', '招聘'],
  startup: ['startup', 'founder', 'pitch', 'ycombinator', 'yc', 'investor', 'fundraising', 'growth', 'saas', '创业', '融资', '用户增长'],
  life: ['recipe', 'food', 'cook', 'travel', 'hotel', 'flight', 'fitness', 'goodfood', '菜', '食谱', '旅行', '健身'],
};
function heuristic(it) {
  const hay = ` ${[it.t, it.snip, it.url, tr(it.loc)].join(' ').toLowerCase()} `;
  const scored = [];
  for (const [gid, words] of Object.entries(KW)) {
    const hit = words.filter((w) => (/^[a-z]+$/.test(w) ? new RegExp(`[^a-z]${w}[^a-z]`).test(hay) : hay.includes(w)));
    if (hit.length) scored.push([gid, hit]);
  }
  scored.sort((a, b) => b[1].length - a[1].length);
  const out = {};
  for (const [gid, hit] of scored.slice(0, 2)) {
    const c = Math.min(0.82, 0.46 + 0.12 * hit.length);
    out[gid] = [c, `标题或内容里出现了「${hit.slice(0, 2).join('」「')}」。(离线规则,不是 AI)`, `Mentions "${hit.slice(0, 2).join('", "')}". (Offline rule, not AI)`];
  }
  if (!scored.length) { ensureGroup('misc', L('没看懂', 'Unsorted'), L('AI 没能判断的东西,等你来放。', 'Things the AI could not place, waiting for you.')); out.misc = [0.3, '没找到能判断的线索,先放在这里等你。', 'No clues to judge by; parked here for you.']; }
  return out;
}
async function classifyLive(batch) {
  const groups = Object.values(S.groups).filter((g) => g.id !== 'misc').map((g) => `${g.id}: ${g.name[1]} — ${g.def[1]}`).join('\n');
  const prompt = `You sort a person's saved items into overlapping groups on a canvas. Transparency matters: every placement needs a concrete reason the person can check.
Existing groups (id: name — what belongs):
${groups}

For each item choose 1 to 3 groups it genuinely belongs to. An item may belong to several groups. If none fits, you may create a new group: use id "new:<short-slug>" and give "newName" (2-4 words, ${LANG === 'zh' ? 'Simplified Chinese' : 'English'}). For each chosen group write "why": one short sentence in ${LANG === 'zh' ? 'Simplified Chinese' : 'English'} that cites something concrete in the item (a word, topic, site or folder). Give "conf" from 0 to 1; use below 0.6 when the item is too short or ambiguous to judge.

Reply with only a JSON array, one object per item, like:
[{"id":"i3","groups":[{"g":"design","why":"...","conf":0.9},{"g":"new:travel","newName":"Travel","why":"...","conf":0.8}]}]

Items (id | platform | folder or location | title | url | excerpt):
${batch.map((it) => `${it.id} | ${SRC[it.src].n} | ${tr(it.loc)} | ${it.t} | ${it.url || ''} | ${(it.snip || '').slice(0, 260)}`).join('\n')}`;
  const res = await sampleFn.json(prompt, { modelTier: 'quick' });
  if (!Array.isArray(res)) throw { code: 'invalid_json' };
  const map = {};
  for (const r of res) {
    if (!r || !r.id || !Array.isArray(r.groups)) continue;
    const g = {};
    for (const x of r.groups.slice(0, 3)) {
      if (!x || !x.g) continue;
      let gid = String(x.g);
      if (gid.startsWith('new:')) gid = ensureGroup(gid, String(x.newName || gid.slice(4)).slice(0, 30));
      if (!S.groups[gid]) continue;
      const why = String(x.why || '').slice(0, 200);
      g[gid] = [clamp(Number(x.conf) || 0.5, 0, 1), why, why];
    }
    if (Object.keys(g).length) map[r.id] = g;
  }
  return map;
}
async function organize(list) {
  if (!list.length) return;
  select(null); S.tab = 'log';
  let done = 0, live = !!sampleFn && !S.forceCanned, note = '';
  fit(true);
  await sleep(300);
  for (let i = 0; i < list.length; i += 20) {
    const batch = list.slice(i, i + 20);
    let map = {};
    progress(L(`AI 正在读 ${Math.min(i + 20, list.length)}/${list.length} 条…`, `AI is reading ${Math.min(i + 20, list.length)}/${list.length}…`));
    if (live) {
      try { map = await classifyLive(batch); }
      catch (e) {
        if (e && disableLive(e.code)) { sampleFn = null; renderAIPill(); }
        live = false; note = L('实时 AI 没有回应,剩下的用离线规则分类,并标成拿不准。', 'Live AI did not respond; the rest were sorted with offline rules and flagged for review.');
      }
    }
    for (const it of batch) {
      it.g = map[it.id] || heuristic(it);
      if (map[it.id]) it.how = 'ai';
      progress(L(`正在归位 ${++done}/${list.length}`, `Placing ${done}/${list.length}`));
      arrive(it, { toast: false });
      await sleep(list.length > 25 ? 120 : 260);
    }
  }
  await sleep(1100);
  progress('');
  fit(true);
  const q = list.filter((it) => S.byId[it.id] && isQ(S.byId[it.id])).length;
  persist();
  toast(L(`整理完了 ${list.length} 条。${q ? `${q} 条拿不准,在「待确认」里等你。` : ''}`, `Sorted ${list.length} items.${q ? ` ${q} need your review.` : ''}`));
  if (note) toast(note);
  renderPanel();
}

const SAMPLE_BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
<DT><H3>Bookmarks bar</H3>
<DL><p>
  <DT><H3>Design inspo</H3>
  <DL><p>
    <DT><A HREF="https://www.refactoringui.com/" ADD_DATE="1756000000">Refactoring UI</A>
    <DT><A HREF="https://m3.material.io/" ADD_DATE="1756100000">Material Design 3</A>
    <DT><A HREF="https://www.nngroup.com/articles/" ADD_DATE="1756200000">NN/g UX articles</A>
  </DL><p>
  <DT><H3>AI stuff</H3>
  <DL><p>
    <DT><A HREF="https://modelcontextprotocol.io/" ADD_DATE="1757000000">Model Context Protocol</A>
    <DT><A HREF="https://huggingface.co/learn" ADD_DATE="1757100000">Hugging Face Learn: free AI courses</A>
  </DL><p>
  <DT><A HREF="https://www.linkedin.com/jobs/" ADD_DATE="1757300000">LinkedIn Jobs</A>
  <DT><A HREF="https://wellfound.com/jobs" ADD_DATE="1757400000">Wellfound: startup jobs</A>
  <DT><A HREF="https://www.ycombinator.com/library" ADD_DATE="1757500000">YC Startup Library</A>
</DL><p>
<DT><H3>Other bookmarks</H3>
<DL><p>
  <DT><A HREF="https://www.bbcgoodfood.com/" ADD_DATE="1750000000">BBC Good Food recipes</A>
  <DT><A HREF="https://www.are.na/" ADD_DATE="1751000000">Are.na</A>
  <DT><A HREF="https://www.youtube.com/@veritasium" ADD_DATE="1752000000">Veritasium</A>
</DL><p>
</DL><p>`;

/* ================= before / after ================= */
function renderModes() {
  if (!S.siloCols) computeSilo();
  $('#modes').innerHTML = [['silo', L('整理前:7 个平台', 'Before: 7 silos')], ['canvas', L('整理后:一张白板', 'After: one canvas')]]
    .map(([m, label]) => [m, m === 'silo' && MODE.siloBy === 'folder' ? L(`整理前:${S.siloCols?.length || ''} 个文件夹`, `Before: ${S.siloCols?.length || ''} folders`) : label])
    .map(([m, label]) => `<button type="button" data-mode="${m}" class="${S.mode === m ? 'on' : ''}" aria-pressed="${S.mode === m}">${label}</button>`).join('');
}
function setMode(m) {
  if (S.mode === m) return;
  S.mode = m;
  if (m === 'silo') { S.focus = null; S.focusAll = false; }
  if (m === 'canvas') S.blobHold = true;
  computeSilo();
  world.classList.add('anim');
  cardsEl.querySelectorAll('.card').forEach((c) => { c.style.transitionDelay = `${Math.round(hash(c.dataset.id + m) * 420)}ms`; });
  renderCanvas(); renderModes(); fit(true);
  clearTimeout(setMode.t);
  setMode.t = setTimeout(() => {
    world.classList.remove('anim'); S.blobHold = false; renderBlobs();
    cardsEl.querySelectorAll('.card').forEach((c) => { c.style.transitionDelay = ''; });
  }, 1350);
}
$('#modes').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
function focusInter(a, b) {
  if (S.mode === 'silo') setMode('canvas');
  select({ type: 'inter', a, b });
  const sh = sharedItems(a, b);
  if (sh.length) fitTo(sh, true, 0.3, 0.8);
}
function showAllSources() {
  if (!S.synth) return;
  select({ type: 'set', ids: citeOrder(S.synth.text) }, { keepPanel: true });
  fitMain(true);
}

/* ================= guided tour ================= */
const TOUR = [
  { t: ['7 个平台,各自为政', '7 platforms, 7 silos'],
    b: ['这是一个人真实的处境:3 个 AI 的聊天记录,4 个平台的收藏,一共 41 样东西。每个 AI 只看得见自己那一列,人也记不住哪一列里有什么。', 'This is one person\'s reality: chats in 3 AIs and saves on 4 platforms, 41 things in total. Each AI sees only its own column, and nobody remembers what is in which one.'],
    run: () => { select(null); setMode('silo'); } },
  { t: ['AI 把它们放到一张白板上', 'AI puts it all on one canvas'],
    b: ['导入之后,AI 自动分组。每个神经元是一个组,每个点是一条收藏,越新的点越大。同时属于两个组的点,落在两个神经元之间。原件一样都没动。', 'After import, AI groups everything. Each neuron is a group and each dot is a save; newer dots are bigger. A dot in two groups sits between two neurons. No original was moved.'],
    run: () => { select(null); if (S.mode === 'canvas') fitMain(true); else { setMode('canvas'); fitMain(true); } } },
  { t: ['点开一个神经元', 'Open one neuron at a time'],
    b: ['默认只有神经元和点,不会一下子被几百张卡片淹没。点一个神经元,这一组的卡片才一圈圈绽放出来,其他组退到背景。', 'By default you see only neurons and dots, never hundreds of cards at once. Open a neuron and only its cards bloom around it; the rest steps back.'],
    run: () => { if (S.mode === 'silo') setMode('canvas'); select({ type: 'group', id: 'ai' }); } },
  { t: ['点一张卡片:它从哪来?', 'Click a card: where did it come from?'],
    b: ['一根线连回 YouTube,证明东西没被搬走。它同时在学习、AI、设计三个组里,右边写着每个组的理由和把握度。', 'A thread leads back to YouTube: the original never moved. It sits in Learning, AI and Design at once, and the panel gives the reason and confidence for each.'],
    run: () => { if (S.mode === 'silo') setMode('canvas'); select({ type: 'item', id: 'y5' }, { center: true, minScale: 0.62 }); } },
  { t: ['一个平台的全部', 'Everything from one platform'],
    b: ['点平台图标,这个平台的所有收藏一起亮起来,看得见每一条分别去了哪里。', 'Click a platform and all its saves light up, so you can see where each one went.'],
    run: () => { if (S.mode === 'silo') setMode('canvas'); fitMain(true); select({ type: 'source', id: 'reddit' }); } },
  { t: ['持续流入,不用多做一步', 'New saves sort themselves'],
    b: ['你照常在原平台点收藏。新内容自己飞进对应的组,右边留下一条记录。', 'You keep saving where you already save. New items fly into the right groups on their own and leave a record on the right.'],
    run: async () => { select(null); S.tab = 'log'; renderPanel(); if (!S.tour.intake && S.intake < INTAKE.length) { S.tour.intake = true; await intakeOne(); } } },
  { t: ['拿不准的,主动说出来', 'It tells you when it is unsure'],
    b: ['AI 把没把握的标出来,不会悄悄放错。一键确认或移出,每次纠正都写进整理记录。看得见它怎么想,才敢把东西交给它。', 'The AI flags what it is unsure about instead of quietly misfiling it. Confirm or remove with one click, and every correction is recorded. You can hand things over because you can see how it thinks.'],
    run: () => { select(null); S.tab = 'review'; panel.classList.add('open'); renderPanel(); } },
  { t: ['交汇处就是新想法', 'Intersections are where ideas come from'],
    b: ['「AI 工具」和「创业想法」的交集里,是同一个痛点在好几个平台上被反复收藏。交汇处常常就是你还没说出口的想法。', 'Inside "AI tools" × "Startup idea" is the same pain point, saved again and again on different platforms. Intersections are often the idea you have not said out loud yet.'],
    run: () => focusInter('ai', 'startup') },
  { t: ['把 7 个平台综合起来', 'Synthesize across all 7 platforms'],
    b: ['「帮我写一份简历」:它同时读 7 个平台的内容。任何单独一个 AI 都只看得见其中一部分。', '"Draft my résumé": it reads all 7 platforms at once. Any single AI would see only part of this.'],
    run: () => { if (S.mode === 'silo') setMode('canvas'); fitMain(true); runPreset('resume', { canned: true }); } },
  { t: ['每一句都追得到原件', 'Every sentence traces back'],
    b: ['每句话都带出处。点一个编号就能看到那张卡片;下面这一步把所有出处一起连回原平台。', 'Every sentence carries a source. Click a number to see its card; this step lights up every source back to its platform.'],
    run: async () => { if (!S.synth || S.synth.q !== tr(PRESETS[0].q)) runPreset('resume', { canned: true }); await S.synthPromise; if (S.tour) showAllSources(); } },
  { t: ['你只管收藏。', 'You just save.'],
    b: ['它负责归位,告诉你东西去了哪,并把散落的东西串成新想法。', 'It sorts, shows you where everything went, and turns scattered pieces into new ideas.'],
    end: true, run: () => { select(null); S.tab = 'inv'; renderPanel(); fitMain(true); } },
];
function renderTour() {
  const el = $('#tour');
  app.classList.toggle('touring', !!S.tour);
  if (!S.tour) { el.hidden = true; return; }
  const i = S.tour.i, st = TOUR[i];
  el.hidden = false;
  el.innerHTML = `<div class="st"><span>${i + 1} / ${TOUR.length}</span>${TOUR.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
    <h3>${esc(tr(st.t))}</h3><p>${esc(tr(st.b))}</p>
    <div class="tb">${st.end
      ? `<button type="button" data-t="import">${L('导入你自己的书签', 'Import your own bookmarks')}</button><button type="button" class="pri" data-t="exit">${L('自己逛逛', 'Explore on my own')}</button>`
      : `<button type="button" class="sp" data-t="exit">${L('退出导览', 'Exit tour')}</button>${i > 0 ? `<button type="button" data-t="prev">← ${L('上一步', 'Back')}</button>` : ''}<button type="button" class="pri" data-t="next">${L('下一步', 'Next')} →</button>`}</div>`;
}
function goTour(i) {
  if (!S.tour) return;
  S.tour.i = clamp(i, 0, TOUR.length - 1);
  renderTour();
  Promise.resolve().then(() => TOUR[S.tour.i].run()).catch(() => {});
}
function startTour() {
  synthCtl?.abort();
  S.q = ''; $('#q').value = '';
  S.tour = { i: 0, intake: false };
  app.classList.remove('pclosed');
  goTour(0);
}
function endTour() { S.tour = null; renderTour(); }
$('#btn-tour').addEventListener('click', () => (S.tour ? endTour() : startTour()));
if (!MODE.tour) $('#btn-tour').hidden = true;
if (!INTAKE.length) $('#btn-intake').hidden = true;
$('#tour').addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  const t = b.dataset.t;
  if (t === 'next') goTour(S.tour.i + 1);
  if (t === 'prev') goTour(S.tour.i - 1);
  if (t === 'exit') endTour();
  if (t === 'import') { endTour(); openImport(); }
});

/* ================= top-level events ================= */
$('#q').addEventListener('input', (e) => { S.q = e.target.value; if (S.q) { S.sel = null; panel.classList.add('open'); } renderDock(); renderCanvas(); renderPanel(); });
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); $('#q').focus(); }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (S.tour && !typing && modal.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); goTour(S.tour.i + (e.key === 'ArrowRight' ? 1 : -1)); return; }
  if (e.key === 'Escape') {
    if (!modal.hidden) return closeImport();
    if (S.tour) return endTour();
    if (S.q) { S.q = ''; $('#q').value = ''; renderDock(); renderCanvas(); renderPanel(); return; }
    if (S.sel) select(null);
  }
});
$('#btn-lang').addEventListener('click', () => {
  LANG = LANG === 'zh' ? 'en' : 'zh';
  try { localStorage.setItem('fcc-lang', LANG); } catch (e) {}
  renderChrome(); renderDock(); renderCanvas(); renderPanel(); if (!modal.hidden) renderImportText();
});
// Share the link with #tour at the end to open straight into the guided tour.
if (MODE.tour && location.hash === '#tour') setTimeout(startTour, 600);
$('#hint-x').addEventListener('click', () => { $('#hint').hidden = true; });
$('#z-in').addEventListener('click', () => { const r = stage.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
$('#z-out').addEventListener('click', () => { const r = stage.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
$('#z-fit').addEventListener('click', () => fit(true));

/* ================= live updates from the host (browser extension) ================= */
window.FCC_APPLY = async (data) => {
  if (!data || !Array.isArray(data.items)) return;
  for (const [k, g] of Object.entries(data.groups || {})) if (!S.groups[k]) S.groups[k] = { ...g, id: k };
  const incoming = new Set(data.items.map((it) => it.id));
  const gone = S.items.filter((it) => !incoming.has(it.id));
  if (gone.length) { S.items = S.items.filter((it) => incoming.has(it.id)); for (const it of gone) delete S.byId[it.id]; renderCanvas(); renderDock(); renderPanel(); }
  for (const raw of data.items) {
    const cur = S.byId[raw.id];
    if (!cur) await arrive(raw, { center: true });
    else if (JSON.stringify(cur.g) !== JSON.stringify(raw.g) && !Object.values(cur.g).some((m) => m[3] === 'you')) { cur.g = raw.g; rerenderAfterEdit(cur); }
  }
};

/* ================= boot ================= */
for (const raw of SEED) addItem(raw);
layoutAll();
renderChrome(); renderDock(); renderCanvas(); renderPanel();
requestAnimationFrame(() => { initialView(); cardsEl.querySelectorAll('.card').forEach((c) => c.tabIndex = 0); });
drawThreads();
})();
