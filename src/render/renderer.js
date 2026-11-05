// Renderizador del lienzo: cámara, orden por profundidad, avatares, burbujas y efectos.
// Se pinta a baja resolución y se amplía por factor entero: píxel nítido sin suavizado.
import { WALL_H, screenToTile, tileToScreen } from '../core/iso.js';
import { LINE_H, drawText, textSprite, textWidth, wrapText } from '../core/font.js';
import { OUTLINE, Pen, createCanvas, hitsCanvas } from '../core/raster.js';
import { ANCHOR_Y, anchorXFor, avatarSprite } from '../avatars/sprite.js';
import { CATALOG, footprint, seatInRoom } from '../furniture/catalog.js';
import { frameFor, furnitureSprite } from '../furniture/sprites.js';
import { rotatePoint } from '../core/iso.js';
import { depthSort } from './depth.js';
import { drawDiamond, rowHalf } from './floors.js';
import { drawClock, drawDoorLeaf, drawProjectionScreen, drawWindow, roomBounds, roomLayers, wallPoint } from './walls.js';

const REF_W = 700;
const REF_H = 500;

function backgroundPattern(ctx) {
  const c = createCanvas(64, 32);
  const g = c.getContext('2d');
  g.fillStyle = '#2b3038';
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#323842';
  for (let r = 0; r <= 30; r += 1) {
    const h = rowHalf(r);
    g.fillRect(32 - h, r, 1, 1);
    g.fillRect(32 + h - 1, r, 1, 1);
  }
  return ctx.createPattern(c, 'repeat');
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.pen = new Pen(this.ctx);
    this.scale = 2;
    this.zoomStep = 0;
    this.viewW = 0;
    this.viewH = 0;
    this.reserveBottom = 0;
    this.reserveTop = 0;
    this.camera = { x: 0, y: 0, snapped: false };
    this.pan = { x: 0, y: 0 };
    this.hits = [];
    this.hover = null;
    this.hoverHint = '';
    this.pointerArt = null;
    this.editor = null;
    this.playerArrowUntil = 6;
    this.beamCache = new Map();
    this.pattern = null;
    this.toolbarCss = 0;
    this.topCss = 0;
    world.on('room', () => {
      this.camera.snapped = false;
      this.pan.x = 0;
      this.pan.y = 0;
      this.playerArrowUntil = world.time + 4;
      // Lo que señalaba el puntero era de la sala anterior.
      this.hover = null;
      this.hoverHint = '';
    });
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const W = Math.max(1, rect.width);
    const H = Math.max(1, rect.height);
    const availableH = Math.max(120, H - this.toolbarCss - this.topCss);
    // Factor entero en píxeles físicos, para que cada píxel del arte sea idéntico.
    const fit = Math.min(W / REF_W, availableH / REF_H) * dpr;
    // Móvil y tableta priorizan el tamaño de toque; la sala se recorre con la cámara.
    const minCss = W < 700 ? 1.34 : W < 1100 ? 1.5 : 1;
    let s = Math.max(1, Math.round(Math.max(fit, minCss * dpr)));
    s = Math.max(1, s + this.zoomStep);
    s = Math.min(s, Math.round(6 * dpr));
    this.scale = s;
    this.dpr = dpr;
    this.canvas.width = Math.ceil((W * dpr) / s);
    this.canvas.height = Math.ceil((H * dpr) / s);
    this.canvas.style.width = `${(this.canvas.width * s) / dpr}px`;
    this.canvas.style.height = `${(this.canvas.height * s) / dpr}px`;
    this.viewW = this.canvas.width;
    this.viewH = this.canvas.height;
    this.reserveBottom = Math.ceil((this.toolbarCss * dpr) / s);
    this.reserveTop = Math.ceil((this.topCss * dpr) / s);
    this.ctx.imageSmoothingEnabled = false;
    this.pattern = backgroundPattern(this.ctx);
    this.camera.snapped = false;
  }

  setReserved(topCss, toolbarCss) {
    if (topCss === this.topCss && toolbarCss === this.toolbarCss) return;
    this.topCss = topCss;
    this.toolbarCss = toolbarCss;
    this.resize();
  }

  zoom(delta) {
    const previous = this.scale;
    this.zoomStep += delta;
    this.resize();
    if (this.scale === previous) this.zoomStep -= delta;
  }

  toArt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * this.canvas.width) / r.width,
      y: ((clientY - r.top) * this.canvas.height) / r.height,
    };
  }

  // ----- Cámara -----

  updateCamera(dt) {
    const world = this.world;
    const room = world.viewRoom;
    const b = roomBounds(room);
    const usableH = this.viewH - this.reserveBottom - this.reserveTop;
    const roomW = b.right - b.left;
    const roomH = b.bottom - b.top;
    const pl = world.player;
    const follow = pl.room === room.id ? tileToScreen(pl.x, pl.y) : { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };

    const axis = (viewSize, roomSize, lo, focus, topOffset) => {
      if (roomSize + 16 <= viewSize) return Math.round((viewSize - roomSize) / 2 - lo) + topOffset;
      const ideal = viewSize / 2 - focus + topOffset;
      const min = viewSize - (lo + roomSize) - 12 + topOffset;
      const max = -lo + 12 + topOffset;
      return Math.max(min, Math.min(max, ideal));
    };
    const tx = axis(this.viewW, roomW, b.left, follow.x, 0);
    const ty = axis(usableH, roomH, b.top, follow.y - 24, this.reserveTop);

    const panned = { x: tx + this.pan.x, y: ty + this.pan.y };
    if (!this.camera.snapped) {
      this.camera.x = panned.x;
      this.camera.y = panned.y;
      this.camera.snapped = true;
    } else {
      const k = Math.min(1, dt * 7);
      this.camera.x += (panned.x - this.camera.x) * k;
      this.camera.y += (panned.y - this.camera.y) * k;
    }
    this.vx = Math.round(this.camera.x);
    this.vy = Math.round(this.camera.y);
  }

  panBy(dx, dy) {
    const room = this.world.viewRoom;
    const b = roomBounds(room);
    const limitX = Math.max(60, (b.right - b.left) / 2);
    const limitY = Math.max(60, (b.bottom - b.top) / 2);
    this.pan.x = Math.max(-limitX, Math.min(limitX, this.pan.x + dx));
    this.pan.y = Math.max(-limitY, Math.min(limitY, this.pan.y + dy));
  }

  resetPan() {
    this.pan.x = 0;
    this.pan.y = 0;
  }

  screenTile(ax, ay) {
    const t = screenToTile(ax - this.vx, ay - this.vy);
    return { x: Math.floor(t.x), y: Math.floor(t.y), fx: t.x, fy: t.y };
  }

  // ----- Dibujo por fotograma -----

  frame(dt) {
    const { ctx, world } = this;
    const room = world.viewRoom;
    const t = world.time;
    this.updateCamera(dt);
    const { vx, vy } = this;
    this.hits.length = 0;

    ctx.fillStyle = this.pattern || '#2b3038';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const layers = roomLayers(room, world);
    ctx.drawImage(layers.base.c, vx - layers.base.ox, vy - layers.base.oy);

    this.drawWallAnimated(room, t);
    this.drawFloorOverlays(room, t);

    // Lista de elementos con huella, ordenados por profundidad.
    const items = [];
    const sitters = new Map();
    const stalled = new Map();
    const outside = [];
    for (const a of world.avatars) {
      if (a.room !== room.id) continue;
      if (a.seat) {
        if (!sitters.has(a.seat.furn)) sitters.set(a.seat.furn, []);
        sitters.get(a.seat.furn).push(a);
      } else if (a.inStall) {
        if (!stalled.has(a.inStall)) stalled.set(a.inStall, []);
        stalled.get(a.inStall).push(a);
      } else if (!a.hidden) {
        const item = { x0: a.x - 0.2, x1: a.x + 0.2, y0: a.y - 0.2, y1: a.y + 0.2, avatar: a };
        if (a.x >= room.w || a.y >= room.h) outside.push(item);
        else items.push(item);
      }
    }
    for (const f of room.furniture) {
      if (CATALOG[f.type].flat) continue;
      const [fw, fh] = footprint(f.type, f.rot);
      items.push({ x0: f.x, x1: f.x + fw, y0: f.y, y1: f.y + fh, furniture: f });
    }
    for (const item of depthSort(items)) {
      if (item.avatar) this.drawAvatar(item.avatar, t);
      else this.drawFurniture(item.furniture, t, sitters, stalled);
    }

    ctx.drawImage(layers.front.c, vx - layers.front.ox, vy - layers.front.oy);
    this.drawDoorArrows(room, t);
    for (const item of outside) this.drawAvatar(item.avatar, t);

    this.drawSteam(room, t);
    this.drawBeam(room);
    if (this.editor && this.editor.active) this.drawEditorOverlay(room);
    this.drawStallTags(room);
    this.drawLabels(room, t);
    this.drawBubbles(room);
    this.drawHint();
    this.drawWipe();
  }

  drawWallAnimated(room, t) {
    const { vx, vy, pen } = this;
    const now = new Date();
    for (const door of room.doors) {
      if (door.wall === 'R' || door.wall === 'L') drawDoorLeaf(pen, door, vx, vy);
    }
    const projector = room.furniture.find((f) => f.type === 'projector');
    for (const item of room.wall) {
      if (item.kind === 'clock') drawClock(pen, item, vx, vy, now);
      else if (item.kind === 'window') drawWindow(pen, item, vx, vy, t);
      else if (item.kind === 'screen') {
        const on = projector ? projector.state.on !== false : false;
        drawProjectionScreen(pen, item, vx, vy, on, t);
      }
    }
  }

  drawDoorArrows(room, t) {
    const { vx, vy, pen } = this;
    const bob = Math.floor(t * 2.5) % 2;
    for (const door of room.doors) {
      if (door.wall !== 'FX' && door.wall !== 'FY') continue;
      const p = tileToScreen(door.pos.x, door.pos.y);
      const dir = door.wall === 'FX' ? 1 : -1;
      // Flecha plana sobre el suelo, siguiendo el eje de salida.
      const cx = vx + p.x + dir * bob * 2;
      const cy = vy + p.y + bob;
      pen.poly(
        [[cx + dir * 12, cy + 6], [cx, cy - 6], [cx - dir * 12, cy]],
        '#fff3d3',
        OUTLINE,
      );
    }
  }

  drawFloorOverlays(room, t) {
    const { vx, vy, ctx } = this;
    const pl = this.world.player;
    // Destino marcado al hacer clic.
    if (pl.destination && pl.destination.room === room.id) {
      const d = pl.destination;
      const p = tileToScreen(d.x, d.y);
      const color = Math.floor(t * 5) % 2 ? '#ffb04a' : '#fff3d3';
      drawDiamond(ctx, vx + p.x, vy + p.y, color, null);
    }
    // Baldosa bajo el puntero.
    const h = this.hover;
    if (h && h.tile && !(this.editor && this.editor.active)) {
      const p = tileToScreen(h.tile.x, h.tile.y);
      drawDiamond(ctx, vx + p.x, vy + p.y, '#ffffff', null);
    }
  }

  blit(sprite, x, y, target) {
    this.ctx.drawImage(sprite.c, x, y);
    if (target) this.hits.push({ canvas: sprite.c, x, y, target });
  }

  drawFurniture(f, t, sitters, stalled) {
    const c = CATALOG[f.type];
    const frame = frameFor(f, t);
    const p = tileToScreen(f.x, f.y);
    let sx = this.vx + p.x;
    const sy = this.vy + p.y;
    if (f.state.shakeUntil && f.state.shakeUntil > t) sx += Math.floor(t * 30) % 2 ? 1 : -1;
    const place = (sprite) => this.blit(sprite, sx - sprite.ox, sy - sprite.oy, f);

    if (f.type === 'stall') {
      place(furnitureSprite(f.type, f.rot, frame, ['main']));
      for (const a of stalled.get(f) || []) if (!a.hidden) this.drawAvatar(a, t);
      place(furnitureSprite(f.type, f.rot, frame, ['over']));
      return;
    }
    const seated = (sitters.get(f) || []).slice().sort((a, b) => a.x + a.y - (b.x + b.y));
    if (seated.length && c.layered) {
      // Si miran hacia el fondo, el respaldo les tapa; si miran a cámara, queda detrás.
      const facingAway = seated.some((a) => a.seat && seatInRoom(f, a.seat.index).dir >= 2);
      if (facingAway) {
        place(furnitureSprite(f.type, f.rot, frame, ['main']));
        for (const a of seated) this.drawAvatar(a, t);
        place(furnitureSprite(f.type, f.rot, frame, ['over']));
        return;
      }
    }
    place(furnitureSprite(f.type, f.rot, frame));
    for (const a of seated) this.drawAvatar(a, t);
  }

  drawAvatar(a, t) {
    const { ctx, vx, vy } = this;
    const p = tileToScreen(a.x, a.y);
    const look = a.appearance(t);
    const seat = a.seat && !a.walking ? seatInRoom(a.seat.furn, a.seat.index) : null;
    const z = seat ? seat.z - 16 : 0;
    const sx = vx + p.x;
    const sy = vy + p.y;
    if (!a.seat) this.drawShadow(sx, sy);
    const sprite = avatarSprite(a.look, a.dir, look.pose, look.frame, look.blink, look.talk, a.held);
    const dx = sx - anchorXFor(a.dir);
    const dy = sy - ANCHOR_Y - z;
    ctx.drawImage(sprite, dx, dy);
    this.hits.push({ canvas: sprite, x: dx, y: dy, target: a });
    a.headX = sx;
    a.headY = dy;
  }

  drawShadow(sx, sy) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(40,20,50,.34)';
    const rows = [
      [-8, -4, 16], [-12, -3, 24], [-14, -2, 28], [-15, -1, 30], [-15, 0, 30],
      [-14, 1, 28], [-12, 2, 24], [-8, 3, 16],
    ];
    for (const [x, y, w] of rows) ctx.fillRect(sx + x, sy + y, w, 1);
  }

  drawSteam(room, t) {
    const { ctx, vx, vy } = this;
    for (const f of room.furniture) {
      const c = CATALOG[f.type];
      if (!c.steam) continue;
      const [lx, ly] = rotatePoint(c.steam[0], c.steam[1], c.W * 32, c.D * 32, f.rot);
      const p = tileToScreen(f.x, f.y);
      const bx = vx + p.x + Math.floor(lx - ly);
      const by = vy + p.y + Math.floor((lx + ly) / 2) - c.steam[2];
      const puffs = f.state.mode === 'brew' ? 9 : 5;
      for (let i = 0; i < puffs; i++) {
        const phase = (t * 0.45 + i / puffs) % 1;
        if (phase > 0.9) continue;
        const wob = Math.round(Math.sin(i * 2.1 + phase * 7) * (1 + phase * 4));
        const y = by - phase * 30;
        const size = phase < 0.35 ? 3 : phase < 0.7 ? 2 : 1;
        ctx.fillStyle = OUTLINE;
        if (phase < 0.6) ctx.fillRect(bx + wob - 1, Math.round(y) - 1, size + 2, size + 2);
        ctx.fillStyle = phase < 0.55 ? '#ffffff' : '#e8e4ee';
        ctx.fillRect(bx + wob, Math.round(y), size, size);
      }
    }
  }

  // Haz del proyector: tramado de puntos sobre la sala, sin transparencias suaves.
  drawBeam(room) {
    const f = room.furniture.find((o) => o.type === 'projector');
    const screen = room.wall.find((w) => w.kind === 'screen');
    if (!f || !screen || f.state.on === false) return;
    const key = `${room.id}|${f.x}|${f.y}|${f.rot}`;
    let cached = this.beamCache.get(key);
    if (!cached) {
      const from = tileToScreen(f.x + 0.3, f.y + 0.5, 36);
      const u = screen.at * 32;
      const a = wallPoint(screen.wall, u + 2, screen.v + screen.h - 2);
      const b = wallPoint(screen.wall, u + screen.w - 2, screen.v + 2);
      // Coordenadas enteras: el tramado de puntos solo funciona sobre píxeles exactos.
      const pts = [[from.x, from.y], a, b].map(([px, py]) => [Math.round(px), Math.round(py)]);
      const minX = Math.min(...pts.map((q) => q[0]));
      const maxX = Math.max(...pts.map((q) => q[0]));
      const minY = Math.min(...pts.map((q) => q[1]));
      const maxY = Math.max(...pts.map((q) => q[1]));
      const c = createCanvas(maxX - minX + 2, maxY - minY + 2);
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(255,246,176,.55)';
      const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (((x + y * 3) % 4 + 4) % 4 !== 0) continue;
          const pt = [x, y];
          const d1 = sign(pt, pts[0], pts[1]);
          const d2 = sign(pt, pts[1], pts[2]);
          const d3 = sign(pt, pts[2], pts[0]);
          const neg = d1 < 0 || d2 < 0 || d3 < 0;
          const pos = d1 > 0 || d2 > 0 || d3 > 0;
          if (!(neg && pos)) g.fillRect(x - minX, y - minY, 1, 1);
        }
      }
      cached = { c, minX, minY };
      this.beamCache.set(key, cached);
    }
    this.ctx.drawImage(cached.c, this.vx + cached.minX, this.vy + cached.minY);
  }

  drawTag(text, cx, cy, bg, fg) {
    const { ctx, pen } = this;
    const w = textWidth(text) + 8;
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy);
    pen.rect(x, y + 1, w, 11, OUTLINE);
    pen.rect(x + 1, y, w - 2, 13, OUTLINE);
    pen.rect(x + 1, y + 1, w - 2, 11, bg);
    drawText(ctx, text, x + 4, y + 3, fg);
  }

  drawStallTags(room) {
    const { vx, vy } = this;
    for (const f of room.furniture) {
      if (f.type !== 'stall') continue;
      const st = f.state;
      const p = tileToScreen(f.x + 1, f.y + 2, 92);
      const cx = vx + p.x;
      const cy = vy + p.y;
      if (st.occupant) {
        const n = (st.queue || []).length;
        this.drawTag(n ? `OCUPADO · ${n} en cola` : 'OCUPADO', cx, cy, '#cf423f', '#ffffff');
      }
    }
  }

  drawLabels(room, t) {
    const { ctx, world } = this;
    const pl = world.player;
    // Flecha que señala tu avatar al empezar y al cambiar de sala.
    if (pl.room === room.id && t < this.playerArrowUntil && !pl.hidden && pl.headY !== undefined) {
      const bob = Math.floor(t * 4) % 2;
      const x = pl.headX;
      const y = pl.headY - 10 - bob - (pl.bubbles.length ? 0 : 0);
      if (!pl.bubbles.length) {
        ctx.fillStyle = OUTLINE;
        for (let i = 0; i < 6; i++) ctx.fillRect(x - 6 + i, y + i - 1, 12 - i * 2, 2);
        ctx.fillStyle = '#ffb04a';
        for (let i = 0; i < 5; i++) ctx.fillRect(x - 5 + i, y + i, 10 - i * 2, 1);
      }
    }
    for (const a of world.avatars) {
      if (a.room !== room.id || a.hidden || a.headY === undefined) continue;
      const hovered = this.hover && this.hover.target === a;
      if (hovered) {
        const s = textSprite(a.name, '#ffffff', OUTLINE);
        ctx.drawImage(s, Math.round(a.headX - s.width / 2), a.headY - 12);
      }
      if (a.waiting && !a.bubbles.length) {
        // Tres puntos que avanzan: está esperando turno.
        const n = Math.floor(t * 3) % 4;
        const s = textSprite('.'.repeat(Math.max(1, n)), '#ffffff', OUTLINE);
        ctx.drawImage(s, Math.round(a.headX - 6), a.headY - 10);
      }
    }
  }

  drawBubbles(room) {
    const { world, viewW, viewH } = this;
    const maxTextW = Math.min(150, Math.max(70, viewW - 40));
    for (const a of world.avatars) {
      if (a.room !== room.id || a.hidden || !a.bubbles.length || a.headY === undefined) continue;
      let bottom = a.headY - 1;
      // De la más nueva (junto a la cabeza) a la más antigua (arriba).
      for (let i = a.bubbles.length - 1; i >= 0; i--) {
        const bubble = a.bubbles[i];
        if (!bubble.lines || bubble.maxW !== maxTextW) {
          bubble.lines = wrapText(bubble.text, maxTextW);
          bubble.maxW = maxTextW;
        }
        const height = this.paintBubble(a, bubble, a.headX, bottom, i === a.bubbles.length - 1, viewW, viewH);
        bottom -= height + 2;
      }
    }
  }

  paintBubble(a, bubble, headX, bottom, withTail) {
    const { pen, ctx, viewW } = this;
    const name = a.name;
    const nameW = textWidth(`${name}:`);
    const lines = bubble.lines;
    let textW = 0;
    for (const l of lines) textW = Math.max(textW, textWidth(l));
    const contentW = Math.max(textW, nameW);
    const w = contentW + 10;
    const h = (lines.length + 1) * LINE_H + 5;
    const tail = withTail ? 4 : 0;
    const x = Math.max(2, Math.min(viewW - w - 2, Math.round(headX - w / 2)));
    const y = Math.max(2 + this.reserveTop, Math.round(bottom - h - tail));
    // Caja con esquinas recortadas y sombra dura.
    pen.rect(x + 2, y + h, w - 2, 1, '#00000055');
    pen.rect(x + w, y + 2, 1, h - 1, '#00000055');
    pen.rect(x + 1, y, w - 2, h, OUTLINE);
    pen.rect(x, y + 1, w, h - 2, OUTLINE);
    pen.rect(x + 1, y + 1, w - 2, h - 2, a.isPlayer ? '#fff8d8' : '#ffffff');
    drawText(ctx, `${name}:`, x + 5, y + 3, a.isPlayer ? '#cc611a' : '#2d63ad');
    lines.forEach((line, i) => drawText(ctx, line, x + 5, y + 3 + (i + 1) * LINE_H, '#2b1b33'));
    if (withTail) {
      const tx = Math.max(x + 3, Math.min(x + w - 8, Math.round(headX - 3)));
      for (let i = 0; i < 4; i++) {
        pen.rect(tx + i, y + h - 1 + i, 7 - i * 2, 1, a.isPlayer ? '#fff8d8' : '#ffffff');
        pen.px(tx + i - 1, y + h - 1 + i, OUTLINE);
        pen.px(tx + 7 - i, y + h - 1 + i - 0, OUTLINE);
      }
      pen.rect(tx + 3, y + h + 3, 2, 1, OUTLINE);
    }
    return h + tail;
  }

  drawHint() {
    if (!this.hoverHint || !this.pointerArt) return;
    const { ctx } = this;
    const s = textSprite(this.hoverHint, '#ffffff', OUTLINE);
    const x = Math.max(2, Math.min(this.viewW - s.width - 2, Math.round(this.pointerArt.x + 8)));
    const y = Math.max(2, Math.round(this.pointerArt.y - 16));
    ctx.drawImage(s, x, y);
  }

  drawWipe() {
    const { ctx, world, viewW, viewH } = this;
    if (world.wipeT < 0) return;
    const half = world.wipeHalf;
    const p = world.wipeT < half ? world.wipeT / half : 2 - world.wipeT / half;
    ctx.fillStyle = '#1c2026';
    if (p >= 0.99) {
      ctx.fillRect(0, 0, viewW, viewH);
      return;
    }
    // Rombos que crecen desde una rejilla isométrica hasta cubrir la pantalla.
    const size = Math.ceil(p * 17) * 2;
    for (let gy = 0; gy * 16 <= viewH + 16; gy++) {
      for (let gx = 0; gx * 64 <= viewW + 64; gx++) {
        const cx = gx * 64 + (gy & 1 ? 32 : 0);
        const cy = gy * 16;
        for (let r = -size; r <= size; r += 1) {
          const w = (size - Math.abs(r)) * 4;
          if (w > 0) ctx.fillRect(cx - w / 2, cy + Math.round(r / 2), w, 1);
        }
      }
    }
  }

  drawEditorOverlay(room) {
    const { ctx, vx, vy, editor } = this;
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        const p = tileToScreen(x, y);
        drawDiamond(ctx, vx + p.x, vy + p.y, 'rgba(255,255,255,.28)', null);
      }
    }
    const sel = editor.selected;
    if (sel && !editor.ghost) {
      const [fw, fh] = footprint(sel.type, sel.rot);
      this.tintFootprint(sel.x, sel.y, fw, fh, '#ffe066', 'rgba(255,224,102,.45)');
    }
    const g = editor.ghost;
    if (g) {
      const [fw, fh] = footprint(g.type, g.rot);
      const ok = g.valid;
      this.tintFootprint(g.x, g.y, fw, fh, ok ? '#8cdc62' : '#f0635a', ok ? 'rgba(140,220,98,.55)' : 'rgba(240,99,90,.55)');
      const frame = frameFor({ type: g.type, rot: g.rot, state: {}, seed: 0 }, this.world.time);
      const sprite = furnitureSprite(g.type, g.rot, frame);
      const p = tileToScreen(g.x, g.y);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(sprite.c, vx + p.x - sprite.ox, vy + p.y - sprite.oy);
      ctx.globalAlpha = 1;
    }
  }

  tintFootprint(x, y, fw, fh, stroke, fill) {
    const { ctx, vx, vy } = this;
    for (let ty = y; ty < y + fh; ty++) {
      for (let tx = x; tx < x + fw; tx++) {
        const p = tileToScreen(tx, ty);
        drawDiamond(ctx, vx + p.x, vy + p.y, stroke, fill, true);
      }
    }
  }

  // ----- Selección por píxel -----

  pick(ax, ay) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (hitsCanvas(h.canvas, ax - h.x, ay - h.y)) return h.target;
    }
    return null;
  }

  // Puertas y objetos de pared bajo el puntero.
  pickWall(ax, ay) {
    const room = this.world.viewRoom;
    const sx = ax - this.vx;
    const sy = ay - this.vy;
    const inWall = (wall) => {
      const u = wall === 'R' ? sx : -sx;
      const v = Math.floor(u / 2) - sy;
      return { u, v };
    };
    for (const door of room.doors) {
      if (door.wall !== 'R' && door.wall !== 'L') continue;
      const { u, v } = inWall(door.wall);
      if (u >= door.at * 32 && u <= (door.at + 1) * 32 && v >= -2 && v <= 98) return { door };
    }
    for (const item of room.wall) {
      if (item.kind !== 'window') continue;
      const { u, v } = inWall(item.wall);
      const left = item.at * 32;
      if (u >= left && u <= left + item.w && v >= item.v && v <= item.v + item.h) return { windowItem: item };
    }
    // Umbrales frontales.
    const t = this.screenTile(ax, ay);
    for (const door of room.doors) {
      if (door.wall !== 'FX' && door.wall !== 'FY') continue;
      if (t.x === door.tile.x && t.y === door.tile.y) return { door };
    }
    return null;
  }
}

export { WALL_H };
