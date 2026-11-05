// Capas fijas de una sala: losa, suelo, alfombras, paredes en dos caras y bordes recortados.
// Lo animado (puertas, relojes, ventanas, pantalla) se pinta en cada fotograma.
import { UNIT, WALL_H, tileToScreen } from '../core/iso.js';
import { drawText, drawWallText, textWidth } from '../core/font.js';
import { OUTLINE, Pen, createCanvas } from '../core/raster.js';
import { paintBox } from '../furniture/builder.js';
import { CATALOG, M } from '../furniture/catalog.js';
import { furnitureSprite } from '../furniture/sprites.js';
import { COMPANY_NAME } from '../map/rooms.js';
import { FLOOR_STYLES, tileImage } from './floors.js';

const MARGIN = 72;

export function roomBounds(room) {
  return {
    left: -room.h * UNIT,
    right: room.w * UNIT,
    top: -WALL_H - 10,
    bottom: (room.w + room.h) * 16 + 34,
  };
}

// Punto de una pared. u: distancia desde la esquina del fondo; v: altura sobre el suelo.
export function wallPoint(wall, u, v, ox = 0, oy = 0) {
  return wall === 'R'
    ? [ox + u, oy + Math.floor(u / 2) - v]
    : [ox - u, oy + Math.floor(u / 2) - v];
}

export function wallRect(pen, wall, ox, oy, u, v, w, h, color, stroke) {
  pen.poly(
    [
      wallPoint(wall, u, v + h, ox, oy),
      wallPoint(wall, u + w, v + h, ox, oy),
      wallPoint(wall, u + w, v, ox, oy),
      wallPoint(wall, u, v, ox, oy),
    ],
    color,
    stroke,
  );
}

function paintWallFace(pen, room, wall, ox, oy) {
  const length = (wall === 'R' ? room.w : room.h) * UNIT;
  const main = room.walls[wall];
  const shade = wall === 'R' ? '#c5bda9' : '#dcd5c4';
  const [trimLight, trimDark] = room.walls.trim;
  const trim = wall === 'R' ? trimDark : trimLight;
  const seam = wall === 'R' ? '#00000030' : '#00000020';
  for (let col = 0; col < length; col++) {
    const x = wall === 'R' ? ox + col : ox - col - 1;
    const base = oy + Math.floor(col / 2);
    pen.rect(x, base - WALL_H, 1, WALL_H, main);
    pen.rect(x, base - WALL_H, 1, 4, shade);
    pen.rect(x, base - 34, 1, 26, trim);
    pen.rect(x, base - 36, 1, 3, M.wood[wall === 'R' ? 1 : 0]);
    pen.rect(x, base - 37, 1, 1, OUTLINE);
    pen.rect(x, base - 8, 1, 2, OUTLINE);
    pen.rect(x, base - 6, 1, 6, M.woodDark[wall === 'R' ? 2 : 1]);
    if (col % 16 === 0) pen.rect(x, base - 34, 1, 26, seam);
    if (col % 32 === 0) pen.rect(x, base - WALL_H + 4, 1, WALL_H - 41, wall === 'R' ? '#00000010' : '#00000008');
  }
}

function paintBackDoor(pen, ctx, room, door, ox, oy) {
  const u = door.at * UNIT + 3;
  const w = UNIT - 6;
  const h = 76;
  // Hueco: se entrevé el color del suelo de la sala de destino.
  wallRect(pen, door.wall, ox, oy, u - 3, 0, w + 6, h + 3, M.woodDark[door.wall === 'R' ? 2 : 1], OUTLINE);
  wallRect(pen, door.wall, ox, oy, u, 0, w, h, '#20252c');
  const label = door.toRoomShort;
  const tw = textWidth(label);
  const plateW = tw + 8;
  const centerU = door.at * UNIT + UNIT / 2;
  // Placa con el destino, sobre el marco.
  wallRect(pen, door.wall, ox, oy, centerU - plateW / 2, 83, plateW, 13, M.cream[0], OUTLINE);
  const start = wallPoint(door.wall, door.wall === 'R' ? centerU - tw / 2 : centerU + tw / 2, 94, ox, oy);
  drawWallText(ctx, label, start[0], start[1], '#5b3418', door.wall);
}

function paintPoster(pen, wall, ox, oy, item) {
  const u = item.at * UNIT;
  const v = item.v;
  const w = 34;
  const h = 42;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, ox, oy, u + a, v + b, c, d, color, stroke);
  if (item.art === 'diploma') {
    R(0, 0, w, 28, M.woodDark[1], OUTLINE);
    R(3, 3, w - 6, 22, '#fff8e0');
    R(7, 19, w - 14, 2, '#5a3218');
    R(7, 14, w - 14, 1, '#b3a37c');
    R(7, 10, w - 14, 1, '#b3a37c');
    R(w - 12, 5, 5, 4, M.red[0]);
    return;
  }
  R(0, 0, w, h, M.woodDark[1], OUTLINE);
  if (item.art === 'team') {
    // Póster motivador de oficina: una cumbre y una sola palabra.
    R(2, 2, w - 4, h - 4, '#26303d');
    pen.poly(
      [wallPoint(wall, u + 7, v + 14, ox, oy), wallPoint(wall, u + 17, v + 34, ox, oy), wallPoint(wall, u + 27, v + 14, ox, oy)],
      '#8996a5',
    );
    const label = 'META';
    const lw = textWidth(label);
    const at = wallPoint(wall, wall === 'R' ? u + (w - lw) / 2 : u + (w + lw) / 2, v + 11, ox, oy);
    drawWallText(pen.ctx, label, at[0], at[1], '#f1ede2', wall);
  } else if (item.art === 'cork') {
    // Tablón de corcho con avisos y chinchetas.
    R(2, 2, w - 4, h - 4, '#b58f60');
    R(5, 24, 11, 13, '#fbf9f2');
    R(7, 32, 7, 1, '#6d7686');
    R(7, 29, 7, 1, '#6d7686');
    R(19, 26, 10, 10, '#e8d387');
    R(6, 6, 10, 14, '#fbf9f2');
    R(8, 15, 6, 1, '#6d7686');
    R(8, 11, 6, 1, '#6d7686');
    R(19, 8, 10, 13, '#bcd0e4');
    R(10, 36, 2, 2, '#ad5551');
    R(23, 35, 2, 2, '#ad5551');
  } else if (item.art === 'mountain') {
    R(2, 2, w - 4, h - 4, '#8fd5ff');
    R(2, 2, w - 4, 11, '#58b645');
    pen.poly(
      [wallPoint(wall, u + 6, v + 13, ox, oy), wallPoint(wall, u + 16, v + 32, ox, oy), wallPoint(wall, u + 28, v + 13, ox, oy)],
      '#7d6a9c',
    );
    pen.poly(
      [wallPoint(wall, u + 13, v + 26, ox, oy), wallPoint(wall, u + 16, v + 32, ox, oy), wallPoint(wall, u + 20, v + 26, ox, oy)],
      '#ffffff',
    );
    R(25, 29, 5, 5, '#ffe066');
  } else if (item.art === 'chart') {
    R(2, 2, w - 4, h - 4, '#fff3d3');
    const heights = [8, 14, 11, 20, 26];
    heights.forEach((bar, i) => R(5 + i * 5, 5, 4, bar, [M.green[1], M.orange[1], M.blue[1]][i % 3]));
    R(4, 4, w - 8, 1, OUTLINE);
  } else if (item.art === 'sun') {
    R(2, 2, w - 4, h - 4, '#ff9d4a');
    R(2, 2, w - 4, 12, '#d9642e');
    R(11, 16, 12, 12, '#ffe066');
    R(13, 14, 8, 16, '#ffe066');
    R(9, 18, 16, 8, '#ffe066');
    R(2, 12, w - 4, 2, '#7d3b2a');
  } else if (item.art === 'cup') {
    R(2, 2, w - 4, h - 4, '#58b645');
    R(9, 9, 13, 14, '#fff3d3');
    R(22, 13, 4, 7, '#fff3d3');
    R(10, 20, 11, 3, '#5a3218');
    R(12, 27, 2, 5, '#ffffff');
    R(17, 27, 2, 5, '#ffffff');
  } else if (item.art === 'wc') {
    R(2, 2, w - 4, h - 4, '#3f85d2');
    R(9, 22, 6, 6, '#ffffff');
    R(9, 8, 6, 13, '#ffffff');
    R(20, 22, 6, 6, '#ffffff');
    R(18, 8, 10, 13, '#ffffff');
  }
}

function paintWhiteboard(pen, wall, ox, oy, item) {
  const u = item.at * UNIT;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, ox, oy, u + a, item.v + b, c, d, color, stroke);
  R(0, 0, item.w, item.h, M.grey[1], OUTLINE);
  R(2, 3, item.w - 4, item.h - 5, '#fbfdfa');
  R(8, 40, 44, 2, M.blue[1]);
  R(8, 34, 30, 1, M.dark[1]);
  R(8, 30, 36, 1, M.dark[1]);
  R(8, 26, 22, 1, M.dark[1]);
  [10, 16, 22, 15, 30].forEach((h, i) => R(66 + i * 9, 8, 6, h, [M.green[1], M.orange[1], M.red[1], M.blue[1], M.green[1]][i]));
  R(62, 7, 52, 1, OUTLINE);
  R(10, 8, 12, 10, M.yellow[0]);
  R(26, 8, 12, 10, M.orange[0]);
  R(20, -3, 10, 3, M.grey[2], OUTLINE);
  R(22, -2, 3, 1, M.red[1]);
  R(26, -2, 3, 1, M.blue[1]);
}

function paintCabinets(pen, wall, ox, oy, item) {
  const u = item.at * UNIT;
  const n = Math.round(item.w / 30);
  const w = item.w / n;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, ox, oy, u + a, item.v + b, c, d, color, stroke);
  R(0, -3, item.w, 3, '#00000030');
  for (let i = 0; i < n; i++) {
    R(i * w, 0, w, item.h, M.cream[1], OUTLINE);
    R(i * w + 3, 3, w - 6, item.h - 6, M.cream[0]);
    R(i * w + (i % 2 ? 5 : w - 8), 6, 2, 8, M.orange[1]);
  }
}

function paintMirror(pen, wall, ox, oy, item) {
  const u = item.at * UNIT;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, ox, oy, u + a, item.v + b, c, d, color, stroke);
  R(0, 0, item.w, item.h, M.grey[1], OUTLINE);
  R(2, 2, item.w - 4, item.h - 4, '#c9eaf5');
  R(10, 6, 3, 18, '#ffffff');
  R(16, 10, 2, 14, '#ffffff');
  R(36, 4, 2, 10, '#ffffff');
}

function paintSign(pen, ctx, wall, ox, oy, item) {
  const u = item.at * UNIT;
  const textW = textWidth(COMPANY_NAME, 2);
  const w = textW + 12;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, ox, oy, u + a, item.v + b, c, d, color, stroke);
  R(0, 0, w, 26, M.woodDark[1], OUTLINE);
  R(2, 2, w - 4, 22, '#2c4666');
  R(2, 2, w - 4, 3, M.fabric[1]);
  const start = wallPoint(wall, u + 6, item.v + 21, ox, oy);
  drawWallText(ctx, COMPANY_NAME, start[0] + 1, start[1] + 1, OUTLINE, wall, 2);
  drawWallText(ctx, COMPANY_NAME, start[0], start[1], '#fff3d3', wall, 2);
}

// Capa base: todo lo que queda por detrás de muebles y avatares.
function buildBase(room, world) {
  const width = (room.w + room.h) * UNIT + MARGIN * 2;
  const height = (room.w + room.h) * 16 + WALL_H + MARGIN * 2 + 48;
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  const pen = new Pen(ctx);
  const ox = room.h * UNIT + MARGIN;
  const oy = WALL_H + MARGIN;
  const style = FLOOR_STYLES[room.floor];
  const slab = ['#3c434d', '#3c434d', '#2f353e'];

  // Losa bajo el suelo.
  paintBox(pen, ox, oy, 0, 0, -18, room.w * UNIT, room.h * UNIT, 0, slab, { highlight: false });

  // Baldosas.
  for (let y = 0; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) {
      const p = tileToScreen(x, y);
      ctx.drawImage(tileImage(room.floor, x, y), ox + p.x - 32, oy + p.y);
    }
  }
  // Borde exterior oscuro del suelo.
  pen.line(ox, oy + (room.w + room.h) * 16, ox + (room.w - room.h) * 32, oy + room.w * 16 + room.h * 16, style.dark);

  // Alfombras: planas, siempre por debajo de todo.
  for (const f of room.furniture) {
    if (!CATALOG[f.type].flat) continue;
    const s = furnitureSprite(f.type, f.rot);
    const p = tileToScreen(f.x, f.y);
    ctx.drawImage(s.c, ox + p.x - s.ox, oy + p.y - s.oy);
  }

  // Sombra de contacto de las paredes sobre el suelo.
  for (let col = 0; col < room.w * UNIT; col += 2) {
    pen.rect(ox + col, oy + Math.floor(col / 2) + 1, 2, 3, '#00000022');
  }
  for (let col = 0; col < room.h * UNIT; col += 2) {
    pen.rect(ox - col - 2, oy + Math.floor(col / 2) + 1, 2, 3, '#00000018');
  }

  // Paredes.
  paintWallFace(pen, room, 'R', ox, oy);
  paintWallFace(pen, room, 'L', ox, oy);
  // Esquina del fondo y remates de pared.
  pen.rect(ox - 1, oy - WALL_H, 1, WALL_H, OUTLINE);
  const capMat = [M.cream[0], M.cream[1], M.cream[2], '#ffffff'];
  paintBox(pen, ox, oy, -10, -10, WALL_H, room.w * UNIT, 0, WALL_H + 3, capMat, { highlight: false });
  paintBox(pen, ox, oy, -10, 0, WALL_H, 0, room.h * UNIT, WALL_H + 3, capMat, { highlight: false });
  paintBox(pen, ox, oy, room.w * UNIT - 1, -10, -18, room.w * UNIT, 0, WALL_H, [M.cream[0], M.cream[1], M.cream[2]], { highlight: false });
  paintBox(pen, ox, oy, -10, room.h * UNIT - 1, -18, 0, room.h * UNIT, WALL_H, [M.cream[0], M.cream[1], M.cream[2]], { highlight: false });

  // Puertas en las paredes y decoración fija.
  for (const door of room.doors) {
    if (door.wall === 'R' || door.wall === 'L') {
      paintBackDoor(pen, ctx, room, { ...door, toRoomShort: world.room(door.to).short }, ox, oy);
    }
  }
  for (const item of room.wall) {
    const wall = item.wall;
    if (item.kind === 'poster') paintPoster(pen, wall, ox, oy, item);
    else if (item.kind === 'whiteboard') paintWhiteboard(pen, wall, ox, oy, item);
    else if (item.kind === 'cabinets') paintCabinets(pen, wall, ox, oy, item);
    else if (item.kind === 'mirror') paintMirror(pen, wall, ox, oy, item);
    else if (item.kind === 'sign') paintSign(pen, ctx, wall, ox, oy, item);
  }
  return { c, ox, oy };
}

// Capa frontal: los bordes bajos de las paredes recortadas, por delante de lo demás.
function buildFront(room, world) {
  const width = (room.w + room.h) * UNIT + MARGIN * 2;
  const height = (room.w + room.h) * 16 + WALL_H + MARGIN * 2 + 48;
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  const pen = new Pen(ctx);
  const ox = room.h * UNIT + MARGIN;
  const oy = WALL_H + MARGIN;
  const lip = [M.cream[0], M.cream[1], M.cream[2], '#ffffff'];
  const slab = ['#3c434d', '#3c434d', '#2f353e'];
  // Cada borde se pinta de atrás hacia delante: tramos de muro y umbrales intercalados,
  // porque un umbral sobresale y tapa el tramo anterior, pero el siguiente lo tapa a él.
  const paintEdge = (axis, length) => {
    const doors = room.doors.filter((d) => d.wall === axis).sort((a, b) => a.at - b.at);
    const steps = [];
    let from = 0;
    for (const d of doors) {
      if (d.at > from) steps.push({ wall: [from, d.at] });
      steps.push({ door: d });
      from = d.at + 1;
    }
    if (from < length) steps.push({ wall: [from, length] });
    for (const step of steps) {
      if (step.door) {
        const { tile } = step.door;
        const tx = tile.x * UNIT;
        const ty = tile.y * UNIT;
        paintBox(pen, ox, oy, tx, ty, -18, tx + UNIT, ty + UNIT, 0, slab, { highlight: false });
        const p = tileToScreen(tile.x, tile.y);
        ctx.drawImage(tileImage('mat', tile.x, tile.y), ox + p.x - 32, oy + p.y);
      } else if (axis === 'FY') {
        const [a, b] = step.wall;
        paintBox(pen, ox, oy, a * UNIT, room.h * UNIT, -18, b * UNIT, room.h * UNIT + 8, 8, lip, { highlight: false });
      } else {
        const [a, b] = step.wall;
        const end = b === room.h ? room.h * UNIT + 8 : b * UNIT;
        paintBox(pen, ox, oy, room.w * UNIT, a * UNIT, -18, room.w * UNIT + 8, end, 8, lip, { highlight: false });
      }
    }
  };
  paintEdge('FY', room.w);
  paintEdge('FX', room.h);
  // Rótulos de destino junto a los umbrales.
  for (const door of room.doors) {
    if (door.wall !== 'FY' && door.wall !== 'FX') continue;
    const p = tileToScreen(door.pos.x, door.pos.y);
    const label = world.room(door.to).short;
    const w = textWidth(label) + 8;
    const dir = door.wall === 'FX' ? 1 : -1;
    const lx = ox + p.x + dir * 20 + (dir < 0 ? -w : 0);
    const ly = oy + p.y + 10;
    pen.rect(lx, ly, w, 13, M.cream[0]);
    pen.rect(lx, ly, w, 1, OUTLINE);
    pen.rect(lx, ly + 12, w, 1, OUTLINE);
    pen.rect(lx, ly, 1, 13, OUTLINE);
    pen.rect(lx + w - 1, ly, 1, 13, OUTLINE);
    drawText(ctx, label, lx + 4, ly + 3, '#5b3418');
  }
  return { c, ox, oy };
}

const layers = new Map();

export function roomLayers(room, world) {
  const entry = layers.get(room.id);
  if (entry && entry.version === room.version) return entry;
  const fresh = { version: room.version, base: buildBase(room, world), front: buildFront(room, world) };
  layers.set(room.id, fresh);
  return fresh;
}

// ----- Partes animadas de la pared -----

export function drawDoorLeaf(pen, door, vx, vy) {
  const wall = door.wall;
  const u = door.at * UNIT + 3;
  const w = UNIT - 6;
  const h = 76;
  const open = door.open;
  const leafW = Math.max(3, Math.round(w * (1 - open * 0.86)));
  const shadeA = wall === 'R' ? M.orange[1] : M.orange[0];
  const shadeB = wall === 'R' ? M.orange[2] : M.orange[1];
  if (open > 0.02) {
    // La sala siguiente se entrevé con luz cálida en el suelo del hueco.
    wallRect(pen, wall, vx, vy, u + leafW, 0, w - leafW, 6, '#d9c39a');
    wallRect(pen, wall, vx, vy, u + leafW, 6, w - leafW, h - 6, '#39414c');
  }
  wallRect(pen, wall, vx, vy, u, 0, leafW, h, shadeA, OUTLINE);
  if (leafW > 12) {
    wallRect(pen, wall, vx, vy, u + 4, 42, leafW - 8, 26, shadeB);
    wallRect(pen, wall, vx, vy, u + 4, 8, leafW - 8, 26, shadeB);
    wallRect(pen, wall, vx, vy, u + leafW - 5, 34, 3, 5, M.yellow[0]);
  }
}

export function drawClock(pen, item, vx, vy, now) {
  const wall = item.wall;
  const cu = item.at * UNIT;
  const cv = item.v + 13;
  const circle = (radius) => {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      pts.push(wallPoint(wall, cu + Math.cos(t) * radius, cv + Math.sin(t) * radius, vx, vy));
    }
    return pts;
  };
  pen.poly(circle(13), M.orange[1], OUTLINE);
  pen.poly(circle(10), '#fffbe8');
  for (let i = 0; i < 12; i += 3) {
    const a = (i / 12) * Math.PI * 2;
    const p = wallPoint(wall, cu + Math.sin(a) * 8, cv + Math.cos(a) * 8, vx, vy);
    pen.px(p[0], p[1], OUTLINE);
  }
  const hand = (fraction, len, color) => {
    const a = fraction * Math.PI * 2;
    const from = wallPoint(wall, cu, cv, vx, vy);
    const to = wallPoint(wall, cu + Math.sin(a) * len, cv + Math.cos(a) * len, vx, vy);
    pen.line(from[0], from[1], to[0], to[1], color);
  };
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  hand((h + m / 60) / 12, 5, OUTLINE);
  hand((m + s / 60) / 60, 8, OUTLINE);
  hand(s / 60, 8, M.red[1]);
}

export function drawWindow(pen, item, vx, vy, t) {
  const wall = item.wall;
  const u = item.at * UNIT;
  const { v, w, h } = item;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, vx, vy, u + a, v + b, c, d, color, stroke);
  R(-3, -3, w + 6, h + 6, M.woodDark[1], OUTLINE);
  R(0, 0, w, h, '#8fd5ff');
  R(0, 0, w, 12, '#58b645');
  R(0, 12, w, 3, '#7fd35c');
  // Edificios lejanos y nubes que se desplazan muy despacio.
  const buildings = [[4, 14], [16, 9], [w - 26, 12], [w - 12, 18]];
  for (const [bu, bh] of buildings) {
    R(bu, 12, 9, bh, '#7d8fb8');
    R(bu + 2, 12 + bh - 4, 2, 2, '#ffe066');
    R(bu + 5, 12 + bh - 8 > 12 ? 12 + bh - 8 : 13, 2, 2, '#ffe066');
  }
  const drift = (t * 1.6) % (w + 18);
  R(Math.min(w - 12, (drift + 6) % w), h - 15, Math.min(12, w - Math.min(w - 12, (drift + 6) % w)), 4, '#ffffff');
  R(Math.min(w - 8, (drift + 8 + w / 2) % w), h - 9, 8, 3, '#ffffff');
  // Persiana: las lamas bajan desde arriba.
  const covered = Math.round(item.state.blinds * h);
  for (let y = 0; y < covered; y += 4) {
    R(0, h - y - 4, w, 3, '#fff3d3');
    R(0, h - y - 4, w, 1, '#d2b67f');
  }
  R(-2, h, w + 4, 4, M.cream[1], OUTLINE);
  R(w - 4, h - covered - 10 > 2 ? h - covered - 10 : 2, 1, 10, OUTLINE);
  // Marco central.
  R(w / 2 - 1, 0, 2, h, M.woodDark[1]);
}

export function drawProjectionScreen(pen, item, vx, vy, on, t) {
  const wall = item.wall;
  const u = item.at * UNIT;
  const R = (a, b, c, d, color, stroke) => wallRect(pen, wall, vx, vy, u + a, item.v + b, c, d, color, stroke);
  R(-3, item.h, item.w + 6, 5, M.dark[1], OUTLINE);
  R(0, 0, item.w, item.h, '#fbfdfa', OUTLINE);
  if (!on) return;
  const slide = Math.floor(t / 6) % 3;
  R(4, item.h - 12, item.w - 8, 8, M.blue[1]);
  R(9, item.h - 9, 40, 2, '#ffffff');
  if (slide === 0) {
    [14, 24, 19, 34, 42].forEach((h, i) => R(14 + i * 17, 8, 12, h, [M.green[1], M.orange[1], M.blue[1], M.red[1], M.green[1]][i]));
    R(10, 7, item.w - 20, 1, OUTLINE);
  } else if (slide === 1) {
    for (let i = 0; i < 4; i++) {
      R(12, 38 - i * 10, 4, 4, M.orange[1]);
      R(20, 38 - i * 10, 44 + ((i * 17) % 30), 3, M.dark[1]);
    }
  } else {
    R(16, 10, 34, 34, M.orange[1]);
    R(16, 27, 17, 17, M.green[1]);
    R(33, 10, 17, 17, M.yellow[1]);
    R(60, 34, 30, 3, M.dark[1]);
    R(60, 26, 38, 3, M.dark[1]);
    R(60, 18, 24, 3, M.dark[1]);
  }
}
