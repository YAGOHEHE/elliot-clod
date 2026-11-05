// Mapa de baldosas de una sala: qué hay en cada casilla, puertas y zonas reservadas.
import { CATALOG, footprint } from '../furniture/catalog.js';
import { findPath, nearestReachable, reachableFrom } from './pathfinding.js';

let nextId = 1;
let nextSeed = 3;

export function makeFurniture(spec) {
  return {
    uid: nextId++,
    id: spec.id,
    type: spec.type,
    x: spec.x,
    y: spec.y,
    rot: spec.rot || 0,
    seed: nextSeed++ * 5,
    state: {},
    sitters: [],
  };
}

export class Room {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.short = def.short;
    this.w = def.w;
    this.h = def.h;
    this.floor = def.floor;
    this.walls = def.walls;
    this.plan = def.plan;
    this.wall = def.wall.map((w) => ({ ...w, state: { blinds: w.blinds ?? 0, target: w.blinds ?? 0 } }));
    this.doors = def.doors.map((d) => ({ ...d, room: def.id, open: 0, ...doorGeometry(d, def.w, def.h) }));
    this.furniture = def.furniture.map(makeFurniture);
    this.grid = new Int32Array(this.w * this.h);
    this.version = 0;
    this.rebuild();
  }

  rebuild() {
    this.grid.fill(0);
    for (const f of this.furniture) {
      const c = CATALOG[f.type];
      if (c.flat) continue;
      const [fw, fh] = footprint(f.type, f.rot);
      for (let y = f.y; y < f.y + fh; y++) {
        for (let x = f.x; x < f.x + fw; x++) {
          if (this.inside(x, y)) this.grid[y * this.w + x] = f.uid;
        }
      }
    }
    this.version++;
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isFree(x, y) {
    return this.inside(x, y) && this.grid[y * this.w + x] === 0;
  }

  furnitureAt(x, y) {
    if (!this.inside(x, y)) return null;
    const uid = this.grid[y * this.w + x];
    return uid ? this.furniture.find((f) => f.uid === uid) || null : null;
  }

  byId(id) {
    return this.furniture.find((f) => f.id === id) || null;
  }

  door(id) {
    return this.doors.find((d) => d.id === id);
  }

  findPath(sx, sy, tx, ty, extraBlocked) {
    const free = extraBlocked
      ? (x, y) => this.isFree(x, y) && !extraBlocked(x, y)
      : (x, y) => this.isFree(x, y);
    return findPath(this.w, this.h, free, sx, sy, tx, ty);
  }

  nearestTo(sx, sy, tx, ty) {
    return nearestReachable(this.w, this.h, (x, y) => this.isFree(x, y) || (x === sx && y === sy), sx, sy, tx, ty);
  }

  // Baldosas que nunca deben quedar tapadas: entradas de puerta y colas de las cabinas.
  reservedTiles() {
    const out = new Set();
    const add = (x, y) => out.add(`${x},${y}`);
    for (const d of this.doors) add(d.inner.x, d.inner.y);
    for (const f of this.furniture) {
      if (f.type !== 'stall') continue;
      const e = stallTiles(f);
      add(e.entry.x, e.entry.y);
      for (const s of e.queue) add(s.x, s.y);
    }
    return out;
  }

  // ¿Se puede colocar aquí este mueble? Devuelve { ok, reason }.
  canPlace(type, x, y, rot, ignore = null, occupied = () => false) {
    const c = CATALOG[type];
    const [fw, fh] = footprint(type, rot);
    if (x < 0 || y < 0 || x + fw > this.w || y + fh > this.h) return { ok: false, reason: 'Se sale de la sala' };
    if (c.flat) return { ok: true };
    const reserved = this.reservedTiles();
    for (let ty = y; ty < y + fh; ty++) {
      for (let tx = x; tx < x + fw; tx++) {
        if (reserved.has(`${tx},${ty}`)) return { ok: false, reason: 'Tapa un paso necesario' };
        const other = this.furnitureAt(tx, ty);
        if (other && other !== ignore) return { ok: false, reason: 'Ya hay otro mueble ahí' };
        if (occupied(tx, ty)) return { ok: false, reason: 'Hay alguien en esa baldosa' };
      }
    }
    // Comprobamos que todas las puertas sigan conectadas entre sí.
    const blocked = (tx, ty) => tx >= x && ty >= y && tx < x + fw && ty < y + fh;
    const free = (tx, ty) => {
      if (!this.inside(tx, ty) || blocked(tx, ty)) return false;
      const uid = this.grid[ty * this.w + tx];
      return uid === 0 || (ignore && uid === ignore.uid);
    };
    const first = this.doors[0].inner;
    const seen = reachableFrom(this.w, this.h, free, first.x, first.y);
    for (const d of this.doors) {
      if (seen[d.inner.y * this.w + d.inner.x] < 0) return { ok: false, reason: 'Bloquearía una puerta' };
    }
    return { ok: true };
  }
}

function doorGeometry(d, w, h) {
  switch (d.wall) {
    case 'R':
      return { inner: { x: d.at, y: 0 }, pos: { x: d.at + 0.5, y: -0.12 }, tile: { x: d.at, y: -1 } };
    case 'L':
      return { inner: { x: 0, y: d.at }, pos: { x: -0.12, y: d.at + 0.5 }, tile: { x: -1, y: d.at } };
    case 'FX':
      return { inner: { x: w - 1, y: d.at }, pos: { x: w + 0.5, y: d.at + 0.5 }, tile: { x: w, y: d.at } };
    case 'FY':
    default:
      return { inner: { x: d.at, y: h - 1 }, pos: { x: d.at + 0.5, y: h + 0.5 }, tile: { x: d.at, y: h } };
  }
}

// Geometría del recorrido de una cabina: baldosa de entrada, cola y puntos del guion.
export function stallTiles(f) {
  const ex = f.x + 1;
  const ey = f.y + 2;
  return {
    entry: { x: ex, y: ey },
    queue: [
      { x: ex, y: ey + 1 },
      { x: ex, y: ey + 2 },
    ],
    threshold: { x: f.x + 1, y: f.y + 2.15 },
    inside: { x: f.x + 1, y: f.y + 1.05 },
  };
}
