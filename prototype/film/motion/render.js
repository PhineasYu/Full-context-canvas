// Renders motion.src.html frame by frame (deterministic, 60fps) and encodes MP4.
// Fonts: same setup as ../director.js (Instrument Sans in $FCC_FONTS/package/files).
// node render.js preview  -> a few stills;  node render.js  -> full film
const fs = require('fs'), path = require('path'), { execFileSync, spawn } = require('child_process');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const here = __dirname, fonts = path.resolve(process.env.FCC_FONTS || path.join(here, '../fonts'), 'package/files');
const html = fs.readFileSync(path.join(here, 'motion.src.html'), 'utf8')
  .replace('/*LOGOS*/null', fs.readFileSync(path.join(here, 'logos.json'), 'utf8'))
  .replace("/*FONTDIR*/''", JSON.stringify('file://' + fonts));
fs.writeFileSync(path.join(here, 'motion.html'), html);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(here, 'motion.html'));
  await p.evaluate(() => window.ready);
  const { FPS, DURATION } = await p.evaluate(() => window.FILM);
  if (process.argv[2] === 'preview') {
    const times = (process.argv[3] || '1,2.6,4.6,6,7.9,8.6,9.4,11.5,13.5,16.8,18,20.8,22.6,25.5,27.8,30.5').split(',').map(Number);
    for (const t of times) { const d = await p.evaluate((i) => window.render(i), Math.round(t * FPS)); fs.writeFileSync(path.join(here, `pv_${t}.jpg`), Buffer.from(d.split(',')[1], 'base64')); }
    console.log(errs.join('\n') || 'no errors'); await b.close(); return;
  }
  const out = path.join(here, 'full-context-canvas-motion.mp4');
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  const total = Math.round(DURATION * FPS);
  for (let i = 0; i < total; i++) {
    const d = await p.evaluate((i) => window.render(i), i);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log(errs.join('\n') || 'no errors', total, 'frames ->', out); await b.close();
})();
