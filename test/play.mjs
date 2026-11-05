// Juega de verdad con ratón y toque sobre la versión compilada y comprueba cada interacción.
// Uso: node test/play.mjs <carpeta-de-capturas>
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] || '/tmp/oficina-play';
const BROWSER = process.env.BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const root = fileURLToPath(new URL('../dist', import.meta.url));
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: BROWSER, headless: true });

let failures = 0;
const errors = [];
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${name}${extra ? ` (${extra})` : ''}`);
  if (!ok) failures++;
};

async function open(width, height, options = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...options });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${width}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${width}] ${m.text()}`));
  await page.goto(url);
  await page.waitForFunction(() => window.oficina);
  await page.waitForTimeout(400);
  return page;
}

// Posición en pantalla (CSS) de un punto de la sala, en coordenadas de baldosa.
const clientOf = (page, x, y, z = 0) =>
  page.evaluate(([tx, ty, tz]) => {
    const { renderer } = window.oficina;
    const r = renderer.canvas.getBoundingClientRect();
    const sx = renderer.vx + (tx - ty) * 32;
    const sy = renderer.vy + (tx + ty) * 16 - tz;
    return { x: r.left + (sx * r.width) / renderer.canvas.width, y: r.top + (sy * r.height) / renderer.canvas.height };
  }, [x, y, z]);

const clickTile = async (page, x, y, z = 0) => {
  const p = await clientOf(page, x + 0.5, y + 0.5, z);
  await page.mouse.click(p.x, p.y);
};
const state = (page) =>
  page.evaluate(() => {
    const { world } = window.oficina;
    const p = world.player;
    return { room: p.room, view: world.view, x: p.x, y: p.y, pose: p.pose, seat: !!p.seat, hidden: p.hidden, walking: p.walking, held: p.held, items: world.inventory.items, bubbles: p.bubbles.map((b) => b.text) };
  });
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);
const teleport = (page, room, x, y) =>
  page.evaluate(([r, tx, ty]) => {
    const { world, renderer } = window.oficina;
    const p = world.player;
    p.locked = false;
    p.stopRoutine();
    if (p.seat) {
      p.seat.furn.sitters[p.seat.index] = null;
      p.seat = null;
    }
    p.pose = 'stand';
    p.room = r;
    p.x = tx + 0.5;
    p.y = ty + 0.5;
    world.showRoom(r);
    renderer.resetPan();
  }, [room, x, y]);

const page = await open(1440, 900);
await page.waitForTimeout(300);

// 1. Caminar haciendo clic y rodear muebles.
await teleport(page, 'recepcion', 0, 5);
await page.waitForTimeout(200);
await clickTile(page, 6, 5);
check('al hacer clic en una baldosa, empieza a caminar', await until(page, () => window.oficina.world.player.walking, null, 2000));
check('llega a la baldosa', await until(page, () => { const p = window.oficina.world.player; return Math.floor(p.x) === 6 && Math.floor(p.y) === 5 && !p.walking; }));

// Rodea el mostrador: de delante (y=4) a detrás (y=2) sin pisarlo nunca.
await teleport(page, 'recepcion', 2, 5);
await page.waitForTimeout(200);
await clickTile(page, 0, 1);
let touched = false;
for (let i = 0; i < 60; i++) {
  const s = await state(page);
  if (s.y >= 3 && s.y < 4 && s.x >= 1 && s.x < 4) touched = true;
  if (Math.floor(s.x) === 0 && Math.floor(s.y) === 1 && !s.walking) break;
  await page.waitForTimeout(100);
}
const after = await state(page);
check('el camino rodea el mostrador', !touched && Math.floor(after.x) === 0 && Math.floor(after.y) === 1, `${after.x},${after.y}`);

// 2. Profundidad: delante y detrás de un mueble.
const hitsOrder = (p) => p.evaluate(() => window.oficina.renderer.hits.map((h) => (h.target.look ? (h.target.isPlayer ? 'YO' : h.target.name) : h.target.type)));
const order = await hitsOrder(page);
check('el avatar se dibuja detrás del mostrador cuando está detrás', order.indexOf('YO') < order.indexOf('counter_reception'), order.join(' '));
await teleport(page, 'recepcion', 2, 5);
await page.waitForTimeout(120);
const order2 = await hitsOrder(page);
check('y delante cuando está delante', order2.indexOf('YO') > order2.indexOf('counter_reception'));

// 3. Chat.
await page.fill('#chat-input', '¡Hola a todos! ¿Qué tal el café de hoy?');
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
check('el chat crea una burbuja', (await state(page)).bubbles.length === 1);
check('el campo de chat se vacía', (await page.inputValue('#chat-input')) === '');
await page.screenshot({ path: join(OUT, '01-chat.png') });

// 4. Sentarse en silla libre.
await teleport(page, 'trabajo', 3, 7);
await page.waitForTimeout(250);
const freeChair = await page.evaluate(() => {
  const f = window.oficina.world.room('trabajo').byId('puesto-b-2');
  f.sitters = [];
  for (const a of window.oficina.world.avatars) if (a.seat && a.seat.furn === f) a.seat = null;
  return { x: f.x, y: f.y };
});
await clickTile(page, freeChair.x, freeChair.y, 16);
check('al hacer clic en una silla, se sienta', await until(page, () => ['sit', 'type'].includes(window.oficina.world.player.pose) && window.oficina.world.player.seat));
const seated = await state(page);
check('frente a un ordenador, teclea', seated.pose === 'type', seated.pose);
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, '02-sentado.png') });
await clickTile(page, 3, 7);
check('al hacer clic en el suelo, se levanta', await until(page, () => !window.oficina.world.player.seat));

// Fotocopiadora y mini entrevista de falso documental.
await teleport(page, 'trabajo', 11, 3);
await page.waitForTimeout(250);
await page.evaluate(() => { window.oficina.world.room('trabajo').byId('fotocopiadora').state.user = null; });
await clickTile(page, 12, 1, 22);
check('la fotocopiadora entra en animación', await until(page, () => window.oficina.world.room('trabajo').byId('fotocopiadora').state.mode === 'copy'));
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '02b-fotocopiadora.png') });
const seatedNpc = await page.evaluate(() => { const a = window.oficina.world.avatars.find((o) => !o.isPlayer && o.room === 'trabajo' && o.headY !== undefined && !o.hidden); return a ? { x: a.headX, y: a.headY + 16, name: a.name } : null; });
if (seatedNpc) {
  const box = await page.evaluate(([x, y]) => { const { renderer } = window.oficina; const r = renderer.canvas.getBoundingClientRect(); return { x: r.left + (x * r.width) / renderer.canvas.width, y: r.top + (y * r.height) / renderer.canvas.height }; }, [seatedNpc.x, seatedNpc.y]);
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(200);
  check('hablar con un compañero muestra su rótulo', await page.evaluate(() => !document.querySelector('.lower-third').hidden));
  await page.screenshot({ path: join(OUT, '02c-entrevista.png') });
}

// 5. Puerta real: de la zona de trabajo a Reuniones por su umbral.
await teleport(page, 'trabajo', 11, 7);
await page.waitForTimeout(250);
const doorTile = await page.evaluate(() => window.oficina.world.room('trabajo').door('tr-re').tile);
await clickTile(page, doorTile.x, doorTile.y);
check('la puerta frontal cambia de sala', await until(page, () => window.oficina.world.view === 'reuniones'));
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, '03-reuniones.png') });
// Puerta de pared: de Reuniones a Trabajo haciendo clic en la hoja.
const wallDoor = await page.evaluate(() => { const d = window.oficina.world.room('reuniones').door('re-tr'); return { at: d.at }; });
const dp = await clientOf(page, -0.02, wallDoor.at + 0.5, 36);
await page.mouse.click(dp.x, dp.y);
check('la puerta de pared cambia de sala', await until(page, () => window.oficina.world.view === 'trabajo'));

// 6. Cafetera.
await until(page, () => !window.oficina.world.player.locked);
await teleport(page, 'cocina', 2, 3);
await page.waitForTimeout(250);
const coffeeBefore = (await state(page)).items.cafe;
await page.evaluate(() => { window.oficina.world.room('cocina').byId('cafetera').state.user = null; });
await clickTile(page, 2, 0, 45);
check('la cafetera entra en animación', await until(page, () => window.oficina.world.room('cocina').byId('cafetera').state.mode === 'brew'));
await page.waitForTimeout(900);
await page.screenshot({ path: join(OUT, '04-cafetera.png') });
check('el café llega al inventario', await until(page, (n) => window.oficina.world.inventory.items.cafe > n, coffeeBefore));
await until(page, () => !window.oficina.world.player.locked);

// 7. Máquina expendedora.
await page.waitForTimeout(100);
await page.evaluate(() => { window.oficina.world.room('cocina').byId('expendedora').state.user = null; });
const canBefore = (await state(page)).items.lata;
await clickTile(page, 6, 0, 45);
check('la expendedora entra en animación', await until(page, () => window.oficina.world.room('cocina').byId('expendedora').state.mode === 'vend'));
await page.waitForTimeout(350);
await page.screenshot({ path: join(OUT, '05-expendedora.png') });
check('la lata llega al inventario', await until(page, (n) => window.oficina.world.inventory.items.lata > n, canBefore));
await until(page, () => !window.oficina.world.player.locked);

// 8. Cabina: entra, puerta cerrada, ocupado, un NPC espera y luego sale.
await page.evaluate(() => {
  const { world } = window.oficina;
  const s = world.room('bano').byId('cabina-2').state;
  if (s.occupant && !s.occupant.isPlayer) {
    s.occupant.locked = false;
    s.occupant.stopRoutine();
  }
  for (const a of [...(s.queue || [])]) a.stopRoutine();
  s.queue = [];
  s.occupant = null;
  s.doorTarget = 0;
});
await teleport(page, 'bano', 3, 5);
await page.waitForTimeout(250);
await clickTile(page, 2, 1, 40);
check('el avatar entra y la puerta se cierra', await until(page, () => window.oficina.world.player.hidden && window.oficina.world.room('bano').byId('cabina-2').state.door < 0.05));
await page.evaluate(() => {
  const { world, actions } = window.oficina;
  const npc = world.avatars.find((a) => a.name === 'Hugo');
  const stall = world.room('bano').byId('cabina-2');
  npc.locked = false;
  npc.stopRoutine();
  if (npc.seat) {
    npc.seat.furn.sitters[npc.seat.index] = null;
    npc.seat = null;
  }
  npc.typingAt = null;
  npc.pose = 'stand';
  npc.hidden = false;
  npc.inStall = null;
  npc.room = 'bano';
  npc.x = 3.5;
  npc.y = 5.5;
  npc.run(actions.useStallForTests(world, npc, stall, 1));
});
await until(page, () => window.oficina.world.avatars.find((a) => a.name === 'Hugo').waiting, null, 4000);
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, '06-ocupado.png') });
const q = await page.evaluate(() => {
  const { world } = window.oficina;
  const s = world.room('bano').byId('cabina-2').state;
  const npc = world.avatars.find((a) => a.name === 'Hugo');
  return { occ: s.occupant && s.occupant.isPlayer, queue: s.queue.map((a) => a.name), waiting: npc.waiting };
});
check('marca ocupado y el NPC espera', q.occ && q.queue.includes('Hugo') && q.waiting, JSON.stringify(q));
check('el avatar sale al cabo de unos segundos', await until(page, () => { const p = window.oficina.world.player; return !p.hidden && !p.locked && !p.inStall; }, null, 12000));
check('luego entra el NPC que esperaba', await until(page, () => { const s = window.oficina.world.room('bano').byId('cabina-2').state; return s.occupant && s.occupant.name === 'Hugo'; }, null, 12000));

// 9. Mapa: elegir sala y que vaya andando.
await page.click('#btn-map');
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '07-mapa.png') });
await page.click('#map-recepcion');
check('el mapa lleva hasta la sala elegida', await until(page, () => window.oficina.world.view === 'recepcion', null, 15000));

// 10. Inventario y modo edición: colocar, mover, girar, guardar.
await until(page, () => !window.oficina.world.player.locked);
await teleport(page, 'recepcion', 0, 6);
await page.waitForTimeout(200);
await page.click('#btn-inventory');
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '08-inventario.png') });
await page.click('.furn-cell[title="Colocar: Planta en maceta"]');
check('el inventario abre el modo edición con el mueble en la mano', await page.evaluate(() => window.oficina.editor.active && window.oficina.editor.ghost?.type === 'plant'));
const stock0 = await page.evaluate(() => window.oficina.world.inventory.furniture.plant);
const target = await clientOf(page, 8.5, 6.5);
await page.mouse.move(target.x, target.y);
await page.waitForTimeout(80);
await page.screenshot({ path: join(OUT, '09-edicion.png') });
await page.mouse.click(target.x, target.y);
await page.waitForTimeout(120);
const placed = await page.evaluate(() => ({ free: window.oficina.world.room('recepcion').isFree(8, 6), stock: window.oficina.world.inventory.furniture.plant, sel: window.oficina.editor.selected?.type }));
check('coloca el mueble en la baldosa elegida', !placed.free && placed.stock === stock0 - 1 && placed.sel === 'plant', JSON.stringify(placed));

// Arrastrar la mesita de revistas.
const mag = await page.evaluate(() => { const f = window.oficina.world.room('recepcion').furniture.find((o) => o.type === 'table_magazines'); return { x: f.x, y: f.y }; });
const from = await clientOf(page, mag.x + 0.5, mag.y + 0.5, 15);
const to = await clientOf(page, mag.x + 0.5, mag.y + 2.5, 15);
await page.mouse.move(from.x, from.y);
await page.mouse.down();
await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
await page.mouse.move(to.x, to.y, { steps: 4 });
await page.waitForTimeout(80);
await page.screenshot({ path: join(OUT, '10-arrastrando.png') });
await page.mouse.up();
const moved = await page.evaluate(() => { const f = window.oficina.world.room('recepcion').furniture.find((o) => o.type === 'table_magazines'); return { x: f.x, y: f.y, rot: f.rot }; });
check('arrastrar mueve el mueble sobre la cuadrícula', moved.y === mag.y + 2 && moved.x === mag.x, JSON.stringify(moved));

await page.click('#edit-rotate');
await page.waitForTimeout(80);
const rotated = await page.evaluate(() => window.oficina.world.room('recepcion').furniture.find((o) => o.type === 'table_magazines').rot);
check('el botón Girar rota el mueble', rotated !== moved.rot, String(rotated));
await page.screenshot({ path: join(OUT, '11-girado.png') });
await page.click('#edit-store');
await page.waitForTimeout(80);
check('Guardar lo devuelve al inventario', await page.evaluate(() => !window.oficina.world.room('recepcion').furniture.some((o) => o.type === 'table_magazines') && window.oficina.world.inventory.furniture.table_magazines >= 2));
await page.click('#edit-done');

// 11. Persistencia: tras recargar sigue igual.
await page.reload();
await page.waitForFunction(() => window.oficina);
check('la distribución se guarda al recargar', await page.evaluate(() => window.oficina.world.room('recepcion').isFree(8, 6) === false));

// 12. Avatar.
await page.click('#btn-avatar');
await page.waitForTimeout(150);
await page.fill('#avatar-name', 'Noelia');
await page.keyboard.press('Tab');
await page.click('.choice:has-text("Rizos")');
await page.waitForTimeout(150);
await page.screenshot({ path: join(OUT, '12-avatar.png') });
check('el avatar se personaliza', await page.evaluate(() => { const p = window.oficina.world.player; return p.name === 'Noelia' && p.look.hairStyle === 'rizos'; }));
await page.click('.close-btn');

// 13. Móvil con toque.
const phone = await open(390, 844, { deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await phone.waitForTimeout(300);
const pp = await clientOf(phone, 6.5, 6.5);
await phone.touchscreen.tap(pp.x, pp.y);
check('en móvil, tocar una baldosa hace caminar', await until(phone, () => { const p = window.oficina.world.player; return Math.floor(p.x) === 6 && Math.floor(p.y) === 6; }));
await phone.fill('#chat-input', 'Probando desde el móvil');
await phone.click('#chat-send');
await phone.waitForTimeout(250);
await phone.screenshot({ path: join(OUT, '13-movil-chat.png') });
check('en móvil, el chat funciona', (await state(phone)).bubbles.length === 1);
check('en móvil no hay scroll lateral', await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await phone.click('#btn-map');
await phone.waitForTimeout(200);
await phone.screenshot({ path: join(OUT, '14-movil-mapa.png') });
await phone.click('#btn-map');
await phone.click('#btn-edit');
await phone.waitForTimeout(200);
await phone.screenshot({ path: join(OUT, '15-movil-edicion.png') });

// Haz del proyector: ¿hay algo pintado?
await teleport(page, 'reuniones', 0, 6);
await page.waitForTimeout(300);
const beam = await page.evaluate(() => {
  const { renderer } = window.oficina;
  const entries = [...renderer.beamCache.entries()];
  if (!entries.length) return 'sin caché';
  const [key, v] = entries[0];
  const d = v.c.getContext('2d').getImageData(0, 0, v.c.width, v.c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
  return `${key} ${v.c.width}x${v.c.height} puntos=${n}`;
});
console.log('Haz del proyector:', beam);

console.log(errors.length ? `ERRORES DE PÁGINA:\n${[...new Set(errors)].join('\n')}` : 'Sin errores de página.');
console.log(failures ? `${failures} comprobaciones fallidas` : 'Todas las comprobaciones pasan.');
await browser.close();
server.close();
process.exitCode = failures ? 1 : 0;
