// Builds the unpacked extension into dist/: the canvas page is generated from prototype/app.html,
// the background worker is bundled with the Anthropic SDK.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist, { recursive: true });

// --- canvas page from the prototype ---
let app = readFileSync(join(here, '../prototype/app.html'), 'utf8');
const style = app.match(/<style>([\s\S]*?)<\/style>/)[1];
const scriptMatch = app.match(/<script>([\s\S]*?)<\/script>\s*$/);
let script = scriptMatch[1];
const body = app.slice(app.indexOf('</style>') + 8, scriptMatch.index).replace(/<link[^>]*>\s*/g, '');
const a = script.indexOf('/* DATA:START'), b = script.indexOf('/* DATA:END */') + '/* DATA:END */'.length;
script = script.slice(0, a) + `/* DATA:START — supplied at runtime by loader.js from the bookmark index */
const RTD = window.FCC_DATA;
const MODE = RTD.mode;
const GROUPS = RTD.groups;
const EXTRA_COLORS = ['#5AA7D6', '#7FA83A', '#8A6FE0', '#3C7F9A'];
const R = (c, zh, en) => [c, zh, en];
const SEED = RTD.items;
const INTAKE = [];
const CANNED = {};
const PRESETS = RTD.presets;
/* DATA:END */` + script.slice(b);
const fonts = [400, 500, 600].map((w) => `@font-face{font-family:"Instrument Sans";font-weight:${w};font-display:swap;src:url(fonts/instrument-sans-latin-${w}-normal.woff2) format("woff2")}`).join('\n');
writeFileSync(join(dist, 'canvas.css'), fonts + '\n*,*::before,*::after{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}\n' + style);
writeFileSync(join(dist, 'canvas.js'), script);
writeFileSync(join(dist, 'canvas.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Full Context Canvas</title><link rel="stylesheet" href="canvas.css"><link rel="icon" href="icons/icon-32.png">
</head><body>
${body.replace(/<title>[^<]*<\/title>/, '')}
<script src="loader.js"></script>
</body></html>
`);

// --- background worker with the Anthropic SDK bundled in ---
await build({ entryPoints: [join(here, 'src/background.js')], bundle: true, format: 'esm', platform: 'browser', target: 'chrome120', outfile: join(dist, 'background.js'), logLevel: 'warning' });

// --- static files ---
for (const f of ['loader.js', 'options.html', 'options.js']) cpSync(join(here, 'src', f), join(dist, f));
cpSync(join(here, 'static/fonts'), join(dist, 'fonts'), { recursive: true });
cpSync(join(here, 'static/icons'), join(dist, 'icons'), { recursive: true });
const icons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };
writeFileSync(join(dist, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'Full Context Canvas',
  version: JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')).version,
  description: 'Your bookmarks on one canvas, sorted into overlapping groups with a reason for every placement. Originals are never changed.',
  permissions: ['bookmarks', 'storage', 'unlimitedStorage'],
  host_permissions: ['https://api.anthropic.com/*'],
  background: { service_worker: 'background.js', type: 'module' },
  action: { default_title: 'Open Full Context Canvas', default_icon: icons },
  options_page: 'options.html',
  icons,
}, null, 2));
console.log('built extension/dist');
