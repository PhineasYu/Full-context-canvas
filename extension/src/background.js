// Full Context Canvas — background service worker.
// Keeps an index of every Chrome bookmark (the originals are never modified), sorts new ones into
// overlapping groups with a reason and a confidence, and answers questions from the canvas page.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const BATCH = 60;
const PALETTE = ['#6B4FD6', '#2F7FC4', '#179AA6', '#45A85A', '#2E5A70', '#9A83D9', '#3C9FB8', '#7FA83A', '#5B6FA8', '#8A6FE0', '#1F7A6E', '#5AA7D6', '#B07CC6', '#7A8699'];
const zh = () => (chrome.i18n.getUILanguage() || '').toLowerCase().startsWith('zh');

/* ---------- storage ---------- */
async function load() {
  const { fcc } = await chrome.storage.local.get('fcc');
  return fcc || { items: [], groups: {}, version: 1 };
}
async function save(data) { data.updated = Date.now(); await chrome.storage.local.set({ fcc: data }); }
async function apiKey() { const { settings } = await chrome.storage.local.get('settings'); return settings?.apiKey || ''; }

/* ---------- bookmarks → index cards ---------- */
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function flatten(nodes, path = [], out = []) {
  for (const n of nodes) {
    if (n.url) {
      if (!/^https?:|^file:/.test(n.url)) continue;
      const loc = ['Chrome', ...path].join(' › ');
      out.push({
        id: `bm-${n.id}`, src: 'chrome', t: (n.title || host(n.url) || n.url).slice(0, 140), meta: [host(n.url), host(n.url)],
        when: n.dateAdded ? new Date(n.dateAdded).toISOString().slice(0, 10) : '', loc: [loc, loc], url: n.url,
        folder: path[path.length - 1] || 'Chrome', snip: `${n.title || ''} | ${host(n.url)} | folder: ${path.join('/')}`, g: {},
      });
    }
    if (n.children) flatten(n.children, n.title ? [...path, n.title] : path, out);
  }
  return out;
}

/* ---------- group layout: somas on a sunflower spiral ---------- */
function placeGroup(groups, id, name, def) {
  const i = Object.keys(groups).length;
  const a = i * 2.39996, r = i ? 820 * Math.sqrt(i) : 0;
  groups[id] = { name: [name, name], def: [def, def], c: PALETTE[i % PALETTE.length], hub: [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.8)] };
  return id;
}

/* ---------- sorting without a key: keyword rules, always flagged as unsure ---------- */
const RULES = [
  ['ai', ['AI 与 Agent', 'AI & agents'], ['ai', 'gpt', 'claude', 'llm', 'agent', 'prompt', 'mcp', 'gemini', 'openai', 'anthropic', '模型', '提示词']],
  ['design', ['设计', 'Design'], ['design', 'ui', 'ux', 'figma', 'icon', 'font', 'dribbble', 'behance', 'portfolio', '设计', '交互']],
  ['code', ['编程', 'Coding'], ['github', 'code', 'dev', 'api', 'docs', 'python', 'javascript', 'vercel', 'netlify', 'stack', '编程']],
  ['learn', ['学习', 'Learning'], ['learn', 'course', 'tutorial', 'guide', 'study', 'university', 'thesis', 'paper', '教程', '课程', '学习']],
  ['career', ['求职', 'Career'], ['job', 'jobs', 'career', 'hiring', 'resume', 'cv', 'linkedin', 'interview', 'salary', '招聘', '简历']],
  ['startup', ['创业', 'Startup'], ['startup', 'founder', 'pitch', 'ycombinator', 'vc', 'invest', 'launch', '创业', '融资']],
  ['life', ['生活', 'Life'], ['recipe', 'travel', 'hotel', 'flight', 'shop', 'amazon', 'movie', 'music', 'health', '旅行', '菜']],
];
function ruleSort(data, list) {
  for (const it of list) {
    const hay = ` ${[it.t, it.url, it.loc[0]].join(' ').toLowerCase()} `;
    const hits = RULES.map(([id, name, words]) => [id, name, words.filter((w) => (/^[a-z]+$/.test(w) ? new RegExp(`[^a-z]${w}[^a-z]`).test(hay) : hay.includes(w)))]).filter((x) => x[2].length).sort((a, b) => b[2].length - a[2].length).slice(0, 2);
    it.g = {};
    for (const [id, name, words] of hits) {
      if (!data.groups[id]) placeGroup(data.groups, id, zh() ? name[0] : name[1], zh() ? `标题或网址里出现 ${words.slice(0, 3).join('、')} 这类词的收藏。` : `Saves mentioning words like ${words.slice(0, 3).join(', ')}.`);
      const c = Math.min(0.58, 0.4 + 0.08 * words.length);
      it.g[id] = [c, `标题或网址里出现了「${words.slice(0, 2).join('」「')}」。(离线规则,不是 AI;连接 Claude 后会更准)`, `Mentions "${words.slice(0, 2).join('", "')}". (Offline rule, not AI; connect Claude for better sorting)`];
    }
    if (!hits.length) {
      if (!data.groups.misc) placeGroup(data.groups, 'misc', zh() ? '没看懂' : 'Unsorted', zh() ? '判断不了的,等你来放。' : 'Could not tell; waiting for you.');
      it.g.misc = [0.3, '标题和网址里没有能判断的线索,先放在这里等你。', 'No clues in the title or URL; parked here for you.'];
    }
  }
}

/* ---------- sorting with Claude: overlapping groups, a reason and a confidence for each ---------- */
const SORT_SCHEMA = {
  type: 'object',
  properties: {
    new_groups: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, definition: { type: 'string' } }, required: ['id', 'name', 'definition'], additionalProperties: false } },
    placements: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      groups: { type: 'array', items: { type: 'object', properties: { group: { type: 'string' }, why: { type: 'string' }, confidence: { type: 'number' } }, required: ['group', 'why', 'confidence'], additionalProperties: false } },
    }, required: ['id', 'groups'], additionalProperties: false } },
  },
  required: ['new_groups', 'placements'],
  additionalProperties: false,
};
function client(key) { return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }); }
function textOf(msg) { return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''); }
async function claudeSort(data, list, key) {
  const lang = zh() ? 'Simplified Chinese' : 'English';
  const anthropic = client(key);
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const existing = Object.entries(data.groups).map(([id, g]) => `${id}: ${g.name[0]} — ${g.def[0]}`).join('\n') || '(none yet)';
    const prompt = `You sort one person's saved bookmarks into overlapping topic groups for a canvas where every placement must be checkable by the person.

Existing groups (id: name — what belongs):
${existing}

Instructions:
- Give each bookmark 1 to 3 groups it genuinely belongs to. A bookmark may sit in several groups.
- Prefer existing groups. Create a new group only when at least five bookmarks in this batch or the existing library would share it, and keep the total under 14 groups. New group ids are short lowercase slugs; names are 1-4 words in ${lang}; the definition is one sentence in ${lang} saying what belongs there.
- For every placement, "why" is one short sentence in ${lang} citing something concrete from the bookmark (a word in the title, the site, or the folder it was saved in). If the original folder looks wrong for the content, say so.
- "confidence" is 0 to 1. Use below 0.6 when the title is too vague to judge, and say what is missing.

Bookmarks (id | title | site | original folder):
${batch.map((it) => `${it.id} | ${it.t} | ${it.meta[0]} | ${it.loc[0]}`).join('\n')}`;
    const msg = await anthropic.beta.messages.create({
      model: MODEL, max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SORT_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined this batch.');
    const out = JSON.parse(textOf(msg));
    for (const ng of out.new_groups || []) if (!data.groups[ng.id]) placeGroup(data.groups, ng.id, ng.name, ng.definition);
    const byId = Object.fromEntries(batch.map((it) => [it.id, it]));
    for (const p of out.placements || []) {
      const it = byId[p.id]; if (!it) continue;
      it.g = {};
      for (const x of p.groups.slice(0, 3)) if (data.groups[x.group]) it.g[x.group] = [Math.max(0, Math.min(1, x.confidence)), x.why, x.why];
    }
    for (const it of batch) if (!Object.keys(it.g).length) ruleSort(data, [it]);
  }
}
async function sortItems(data, list) {
  if (!list.length) return 'none';
  const key = await apiKey();
  if (key) {
    try { await claudeSort(data, list, key); data.mode = 'claude'; return 'claude'; }
    catch (e) { data.lastError = String(e?.message || e); }
  }
  ruleSort(data, list); data.mode = 'rules'; return 'rules';
}

/* ---------- sync: whole tree on install or on demand, single bookmarks as they happen ---------- */
let busy = Promise.resolve();
const serial = (fn) => (busy = busy.then(fn, fn));
function sync({ resort = false } = {}) {
  return serial(async () => {
    const data = await load();
    const tree = await chrome.bookmarks.getTree();
    const fresh = flatten(tree);
    const old = Object.fromEntries(data.items.map((it) => [it.id, it]));
    const items = fresh.map((it) => (old[it.id] && !resort ? { ...it, g: old[it.id].g } : it));
    if (resort) data.groups = {};
    const todo = items.filter((it) => !Object.keys(it.g).length);
    data.items = items;
    await chrome.storage.local.set({ status: { state: 'sorting', total: todo.length } });
    const how = await sortItems(data, todo);
    await save(data);
    await chrome.storage.local.set({ status: { state: 'idle', how, at: Date.now(), error: data.lastError || '' } });
  });
}
chrome.runtime.onInstalled.addListener(() => { sync(); chrome.tabs.create({ url: chrome.runtime.getURL('canvas.html') }); });
chrome.bookmarks.onCreated.addListener(() => sync());
chrome.bookmarks.onRemoved.addListener(() => sync());
chrome.bookmarks.onChanged.addListener(() => sync());
chrome.bookmarks.onMoved.addListener(() => sync());
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('canvas.html') }));

/* ---------- messages from the canvas and settings pages ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'resort') { sync({ resort: true }).then(() => reply({ ok: true })); return true; }
  if (msg?.type === 'sync') { sync().then(() => reply({ ok: true })); return true; }
  if (msg?.type === 'ask') {
    (async () => {
      const key = await apiKey();
      if (!key) return reply({ error: 'No Claude API key set', code: 'not_granted' });
      try {
        const res = await client(key).beta.messages.create({
          model: MODEL, max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          output_config: { effort: 'medium' },
          messages: [{ role: 'user', content: String(msg.prompt).slice(0, 180000) }],
        });
        if (res.stop_reason === 'refusal') return reply({ error: 'Claude declined this request', code: 'refused' });
        reply({ text: textOf(res) });
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) reply({ error: 'The Claude API key was rejected', code: 'not_granted' });
        else if (e instanceof Anthropic.RateLimitError) reply({ error: 'Rate limited; try again shortly', code: 'rate_limited' });
        else reply({ error: String(e?.message || e), code: 'upstream_error' });
      }
    })();
    return true;
  }
  if (msg?.type === 'save') { load().then((d) => save({ ...d, items: msg.data.items, groups: msg.data.groups })).then(() => reply({ ok: true })); return true; }
  return false;
});
