// Records a product film of the Full Context Canvas prototype.
// Usage: node prototype/film/director.js zh|en
// Needs: Playwright with Chromium, `pip install imageio-ffmpeg` (for an ffmpeg with libx264), and fonts in
// $FCC_FONTS (default prototype/film/fonts): `npm pack @fontsource/instrument-sans` unpacked to fonts/package,
// `npm pack @fontsource/noto-sans-sc` unpacked to fonts/sc/package. Output goes to prototype/film/out/.
// The page runs at 1/K speed (CSS animations + JS timers); frames are captured via CDP screencast
// and sped back up by ffmpeg, which gives smooth 30fps output on a slow headless machine.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const LANG = process.argv[2] || 'zh';
const K = 2;
const DIR = path.join(__dirname, 'out'); fs.mkdirSync(DIR, { recursive: true });
const OUT = path.join(DIR, `frames-${LANG}`);
const FONTS = path.resolve(process.env.FCC_FONTS || path.join(__dirname, 'fonts'));
const APP = 'file://' + path.resolve(__dirname, '../index.html');
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

const T = {
  zh: {
    t1: '你存了很多东西。', t2: '但它们散在 7 个平台上,<br>你已经记不住哪里有什么。',
    c1: '3 个 AI,4 个收藏平台,各自为政',
    c2: 'Full Context Canvas 把它们放到一张白板上',
    c3: '每个点是一条收藏,越新的越大',
    c4: '点开一个神经元,只看这一组',
    c5: '一根线连回原平台,原件从不移动',
    c6: '你照常收藏,它自己归位',
    c7: '拿不准的,它会主动告诉你',
    c8: '把 7 个平台综合成一份简历',
    c9: '每一句都追得到原件',
    e1: '你只管收藏。', e2: '它负责归位,告诉你东西在哪,<br>并把散落的想法连在一起。',
  },
  en: {
    t1: 'You save a lot.', t2: 'But it is scattered across 7 platforms,<br>and you no longer remember what is where.',
    c1: '3 AIs, 4 bookmark apps, none of them talking',
    c2: 'Full Context Canvas puts it all on one board',
    c3: 'Each dot is a save. Newer ones are bigger',
    c4: 'Open one neuron, see one topic',
    c5: 'A thread back to the source. Nothing is moved',
    c6: 'Keep saving as usual. It sorts itself',
    c7: 'When it is unsure, it tells you',
    c8: 'Seven platforms, one résumé',
    c9: 'Every sentence traces back to its source',
    e1: 'You just save.', e2: 'It sorts, shows you where everything went,<br>and connects the dots.',
  },
}[LANG];

function fontCss() {
  let css = '';
  for (const w of [400, 500, 600]) css += `@font-face{font-family:"Instrument Sans";font-weight:${w};font-display:block;src:url(file://${FONTS}/package/files/instrument-sans-latin-${w}-normal.woff2) format("woff2");}\n`;
  for (const w of [400, 500]) css += fs.readFileSync(`${FONTS}/sc/package/chinese-simplified-${w}.css`, 'utf8').replace(/url\(\.\/files\//g, `url(file://${FONTS}/sc/package/files/`);
  const stack = '"Instrument Sans","Noto Sans SC",sans-serif';
  return css + `:root{--f-display:${stack}!important;--f-body:${stack}!important;--f-mono:${stack}!important}
  #pill-ai{display:none!important}
  #film{position:fixed;inset:0;pointer-events:none;z-index:1000;font-family:${stack}}
  #film .full{position:absolute;inset:0;background:#FAFBFD;display:grid;place-items:center;opacity:0;transition:opacity .8s ease}
  #film .full.on{opacity:1}
  #film .full .in{display:flex;flex-direction:column;align-items:center;gap:26px;text-align:center}
  #film h1{margin:0;font-weight:500;font-size:74px;line-height:1.2;letter-spacing:-.02em;color:#151B28}
  #film h2{margin:0;font-weight:400;font-size:40px;line-height:1.45;color:#687386}
  #film .brand{display:flex;align-items:center;gap:18px;font-size:34px;font-weight:500;color:#151B28;letter-spacing:-.01em}
  #film .cap{position:absolute;left:810px;top:96px;transform:translate(-50%,10px);opacity:0;transition:opacity .5s ease,transform .5s ease;padding:18px 32px;border-radius:18px;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);box-shadow:0 14px 44px rgba(20,30,60,.16);font-size:36px;font-weight:500;color:#151B28;white-space:nowrap;letter-spacing:-.01em}
  #film .cap.on{opacity:1;transform:translate(-50%,0)}
  #film .cur{position:absolute;left:0;top:0;width:30px;height:30px;transform:translate(960px,540px);filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))}
  #film .ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #3D5CE0;opacity:0}
  #film .ring.go{animation:ring .6s ease-out}
  @keyframes ring{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.6)}}`;
}
const MARK = `<svg width="64" height="64" viewBox="0 0 26 26"><rect x="1" y="1" width="24" height="24" rx="7" fill="none" stroke="#151B28" stroke-width="1.6"/><circle cx="9" cy="10" r="3.2" fill="#6B4FD6"/><circle cx="17" cy="16" r="3.2" fill="#45A85A"/><path d="M9 10 C 13 10, 13 16, 17 16" stroke="#151B28" stroke-width="1.3" fill="none"/></svg>`;

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: LANG === 'zh' ? 'zh-CN' : 'en-US' });
  await ctx.addInitScript(({ k, lang }) => {
    try { localStorage.setItem('fcc-lang', lang); localStorage.removeItem('fcc-pclosed'); } catch (e) {}
    const pn = performance.now.bind(performance), t0 = pn();
    performance.now = () => t0 + (pn() - t0) / k;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => cb(t0 + (t - t0) / k));
    const st = window.setTimeout.bind(window); window.setTimeout = (f, d, ...a) => st(f, (d || 0) * k, ...a);
    const si = window.setInterval.bind(window); window.setInterval = (f, d, ...a) => si(f, (d || 0) * k, ...a);
  }, { k: K, lang: LANG });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.addStyleTag({ content: fontCss() });
  await page.evaluate(async ({ T, MARK }) => {
    const f = document.createElement('div'); f.id = 'film';
    f.innerHTML = `<div class="full on" id="fA"><div class="in"><h1 id="fA1"></h1></div></div>
      <div class="cap" id="cap"></div>
      <div class="full" id="fE"><div class="in"><div class="brand">${MARK}Full Context Canvas</div><h1>${T.e1}</h1><h2>${T.e2}</h2></div></div>
      <div class="ring" id="ring"></div>
      <svg class="cur" id="cur" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L9 19z" fill="#151B28" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(f);
    document.addEventListener('mousemove', (e) => { document.getElementById('cur').style.transform = `translate(${e.clientX - 5}px,${e.clientY - 3}px)`; }, true);
    document.addEventListener('mousedown', (e) => { const r = document.getElementById('ring'); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }, true);
    await document.fonts.ready;
  }, { T, MARK });
  const hint = page.locator('#hint-x'); if (await hint.isVisible()) await hint.click();
  await page.locator('#modes [data-mode="silo"]').click();
  await page.waitForTimeout(3000 * K);

  // ---------- capture ----------
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / K });
  const frames = []; let n = 0;
  cdp.on('Page.screencastFrame', async (fr) => {
    const file = path.join(OUT, `f${String(n++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(fr.data, 'base64'));
    frames.push({ file, ts: fr.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: fr.sessionId }); } catch (e) {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });

  // ---------- helpers (durations in film seconds) ----------
  const wait = (s) => page.waitForTimeout(s * 1000 * K);
  let mx = 960, my = 540;
  async function moveTo(x, y, s = 0.8) {
    const steps = Math.max(8, Math.round(s * 40)), x0 = mx, y0 = my;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      await page.waitForTimeout((s * 1000 * K) / steps);
    }
    mx = x; my = y;
  }
  async function center(sel) { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; }
  async function click(sel, s = 0.8) { const [x, y] = await center(sel); await moveTo(x, y, s); await wait(0.15); await page.mouse.down(); await page.mouse.up(); }
  const set = (id, html) => page.evaluate(([id, html]) => { document.getElementById(id).innerHTML = html; }, [id, html]);
  const on = (id, v) => page.evaluate(([id, v]) => document.getElementById(id).classList.toggle('on', v), [id, v]);
  async function caption(text) { await on('cap', false); await wait(0.35); await set('cap', text); await on('cap', true); }

  // ---------- the film ----------
  await wait(0.4);
  await set('fA1', T.t1); await wait(2.2);
  await page.evaluate(() => { document.getElementById('fA1').style.opacity = 0; }); await wait(0.4);
  await set('fA1', T.t2); await page.evaluate(() => { const h = document.getElementById('fA1'); h.style.transition = 'opacity .6s'; h.style.opacity = 1; }); await wait(2.8);
  await on('fA', false); await wait(0.6);
  await caption(T.c1); await moveTo(700, 600, 1.4); await moveTo(1100, 420, 1.2); await wait(0.8);

  await caption(T.c2); await wait(0.6);
  await click('#modes [data-mode="canvas"]', 0.9); await wait(2.6);

  await caption(T.c3);
  for (const id of ['r3', 'c1', 'x3']) { const [x, y] = await center(`.card[data-id="${id}"]`); await moveTo(x, y, 0.7); await wait(0.9); }
  await moveTo(900, 700, 0.5);

  await caption(T.c4); await click('.hub[data-group="ai"]', 0.9); await wait(2.4);

  await caption(T.c5); await click('.card[data-id="y5"]', 0.9); await wait(2.8);

  await caption(T.c6); await click('#btn-intake', 1.0); await wait(2.6);

  await caption(T.c7); await click('.tab[data-tab="review"]', 1.0); await wait(1.2);
  await click('#pbody [data-act="confirm"]', 0.8); await wait(1.4);

  await caption(T.c8); await click('.preset[data-preset="resume"]', 1.1); await wait(5.2);
  await caption(T.c9); await click('#pbody [data-act="showall"]', 1.0); await wait(3.4);

  await on('cap', false); await on('fE', true); await moveTo(1700, 1000, 0.6); await wait(4.2);

  await cdp.send('Page.stopScreencast');
  await browser.close();

  // ---------- encode ----------
  const list = [];
  for (let i = 0; i < frames.length; i++) {
    const d = i + 1 < frames.length ? frames[i + 1].ts - frames[i].ts : 0.1;
    list.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
  }
  list.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(path.join(DIR, `list-${LANG}.txt`), list.join('\n'));
  const out = path.join(DIR, `full-context-canvas-${LANG}.mp4`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(DIR, `list-${LANG}.txt`),
    '-vf', `setpts=PTS/${K},fps=30,scale=1920:1080:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', out]);
  console.log('frames', frames.length, '->', out);
})();
