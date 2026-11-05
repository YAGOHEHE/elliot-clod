// Abre la versión compilada en un navegador real, recorre todas las salas y hace capturas.
// Uso: node test/shots.mjs <carpeta-de-salida>
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] || '/tmp/oficina-shots';
const BROWSER = process.env.BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const root = fileURLToPath(new URL('../dist', import.meta.url));
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
const problems = [];

async function open(width, height, options = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...options });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${width}] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${width}] consola: ${m.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.oficina);
  await page.waitForTimeout(500);
  return page;
}

const showRoom = (page, id) =>
  page.evaluate((room) => {
    const { world } = window.oficina;
    world.player.stopRoutine();
    world.player.room = room;
    const r = world.room(room);
    world.player.x = r.doors[0].inner.x + 0.5;
    world.player.y = r.doors[0].inner.y + 0.5;
    world.showRoom(room);
  }, id);

const desk = await open(1440, 900);
for (const id of ['recepcion', 'trabajo', 'reuniones', 'cocina', 'despacho', 'chill', 'bano']) {
  await showRoom(desk, id);
  await desk.waitForTimeout(350);
  await desk.screenshot({ path: join(OUT, `sala-${id}.png`) });
}

const phone = await open(390, 844, { deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await phone.screenshot({ path: join(OUT, 'movil.png') });
const phoneWidth = await phone.evaluate(() => document.documentElement.scrollWidth);
if (phoneWidth > 390) problems.push(`scroll lateral en móvil: ${phoneWidth}`);

const tablet = await open(768, 1024);
await tablet.screenshot({ path: join(OUT, 'tablet.png') });

console.log(problems.length ? `PROBLEMAS:\n${problems.join('\n')}` : 'Sin errores de página.');
await browser.close();
server.close();
