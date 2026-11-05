// Constructor de muebles: se describen como cajas y cilindros en unidades locales
// (32 unidades = 1 baldosa). Girar un mueble es girar sus piezas; las caras ocultas
// se descartan solas y el orden interno se recalcula en cada orientación.
import { Pen, OUTLINE, convexHull, createCanvas } from '../core/raster.js';
import { rotatePoint, rotatedSize } from '../core/iso.js';

const SIDE_NORMAL = { px: [1, 0], py: [0, 1], nx: [-1, 0], ny: [0, -1] };

function rotateNormal([a, b], rot) {
  switch (rot & 3) {
    case 1:
      return [-b, a];
    case 2:
      return [-a, -b];
    case 3:
      return [b, -a];
    default:
      return [a, b];
  }
}

export function project(x, y, z = 0) {
  return [Math.floor(x - y), Math.floor((x + y) / 2) - Math.floor(z)];
}

// Caja en coordenadas de mundo ya resueltas: 3 caras planas y contorno oscuro de 1 px.
export function paintBox(pen, ox, oy, x0, y0, z0, x1, y1, z1, mat, opts = {}) {
  const P = (x, y, z) => {
    const p = project(x, y, z);
    return [p[0] + ox, p[1] + oy];
  };
  const stroke = opts.stroke === undefined ? OUTLINE : opts.stroke;
  const top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
  if (z1 > z0) {
    pen.poly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], mat[1]);
    pen.poly([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], mat[2]);
  }
  pen.poly(top, mat[0]);
  if (opts.after) opts.after();
  if (z1 > z0 && opts.highlight !== false) {
    // Arista frontal clara: el tercer tono "de luz" del material.
    const hl = mat[3] || mat[0];
    pen.line(...P(x0, y1, z1), ...P(x1, y1, z1), hl);
    pen.line(...P(x1, y0, z1), ...P(x1, y1, z1), hl);
    pen.line(...P(x1, y1, z1 - 1), ...P(x1, y1, z0), mat[2]);
  }
  if (stroke) {
    const hull = z1 > z0
      ? [P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1)]
      : top;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      pen.line(a[0], a[1], b[0], b[1], stroke);
    }
  }
}

export class Builder {
  constructor(W, D, rot = 0) {
    this.W = W * 32;
    this.D = D * 32;
    this.rot = rot & 3;
    this.prims = [];
    this.layer = 'main';
    this.last = null;
  }

  // Capa activa: 'main' por debajo de quien se siente o entre; 'over' por encima.
  setLayer(name) {
    this.layer = name;
    return this;
  }

  world(x, y) {
    return rotatePoint(x, y, this.W, this.D, this.rot);
  }

  box(x, y, z, dx, dy, dz, mat, opts = {}) {
    const [ax, ay] = this.world(x, y);
    const [bx, by] = this.world(x + dx, y + dy);
    const prim = {
      kind: 'box',
      layer: this.layer,
      x0: Math.min(ax, bx),
      x1: Math.max(ax, bx),
      y0: Math.min(ay, by),
      y1: Math.max(ay, by),
      z0: z,
      z1: z + dz,
      mat,
      opts,
      local: { x, y, z, dx, dy, dz },
      decals: [],
    };
    this.prims.push(prim);
    this.last = prim;
    return this;
  }

  // Rectángulo pintado sobre una cara de la última caja. u: a lo largo, v: altura desde su base.
  face(side, u, v, w, h, color) {
    this.last.decals.push({ side, u, v, w, h, color });
    return this;
  }

  // Rectángulo pintado sobre la tapa de la última caja.
  top(u, v, w, h, color) {
    this.last.decals.push({ side: 'top', u, v, w, h, color });
    return this;
  }

  cyl(cx, cy, z, rx, ry, h, mat, opts = {}) {
    const [wx, wy] = this.world(cx, cy);
    const swap = this.rot & 1;
    const rX = swap ? ry : rx;
    const rY = swap ? rx : ry;
    const prim = {
      kind: 'cyl',
      layer: this.layer,
      cx: wx,
      cy: wy,
      rx: rX,
      ry: rY,
      x0: wx - rX,
      x1: wx + rX,
      y0: wy - rY,
      y1: wy + rY,
      z0: z,
      z1: z + h,
      mat,
      opts,
    };
    this.prims.push(prim);
    this.last = prim;
    return this;
  }

  // Dibujo libre anclado en un punto (plantas, objetos pequeños).
  custom(x, y, z, r, fn) {
    const [wx, wy] = this.world(x, y);
    this.prims.push({
      kind: 'custom',
      layer: this.layer,
      x0: wx - r,
      x1: wx + r,
      y0: wy - r,
      y1: wy + r,
      z0: z,
      z1: z + r * 2,
      wx,
      wy,
      fn,
    });
    return this;
  }

  // Cuadrilátero libre en coordenadas locales 3D.
  quad(points, fill, stroke = OUTLINE) {
    const pts = points.map(([x, y, z]) => {
      const [wx, wy] = this.world(x, y);
      return [wx, wy, z];
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const zs = pts.map((p) => p[2]);
    this.prims.push({
      kind: 'quad',
      layer: this.layer,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
      z0: Math.min(...zs),
      z1: Math.max(...zs),
      pts,
      fill,
      stroke,
    });
    return this;
  }

  // Devuelve { c: lienzo, ox, oy }: (ox, oy) es el píxel de la esquina (0,0) de la huella.
  render(layers) {
    const prims = this.prims.filter((p) => !layers || layers.includes(p.layer));
    const [wr, dr] = rotatedSize(this.W, this.D, this.rot);
    let maxZ = 8;
    let pad = 40;
    for (const p of this.prims) {
      if (p.z1 > maxZ) maxZ = p.z1;
      const over = Math.max(p.x1 - wr, p.y1 - dr, -p.x0, -p.y0, 0);
      if (over + 12 > pad) pad = over + 12;
    }
    const w = wr + dr + pad * 2 + 8;
    const h = (wr + dr) / 2 + maxZ + pad * 2 + 8;
    const ox = dr + pad + 4;
    const oy = Math.ceil(maxZ) + pad;
    const c = createCanvas(w, h);
    const pen = new Pen(c.getContext('2d'));
    for (const prim of sortPrims(prims)) this.paint(pen, prim, ox, oy);
    return { c, ox, oy };
  }

  paint(pen, prim, ox, oy) {
    const at = (x, y, z) => {
      const p = project(x, y, z);
      return [p[0] + ox, p[1] + oy];
    };
    if (prim.kind === 'box') {
      paintBox(pen, ox, oy, prim.x0, prim.y0, prim.z0, prim.x1, prim.y1, prim.z1, prim.mat, {
        ...prim.opts,
        after: () => this.paintDecals(pen, prim, ox, oy),
      });
    } else if (prim.kind === 'cyl') {
      paintCyl(pen, prim, at);
    } else if (prim.kind === 'custom') {
      const [sx, sy] = at(prim.wx, prim.wy, prim.z0);
      prim.fn(pen, sx, sy);
    } else if (prim.kind === 'quad') {
      pen.poly(prim.pts.map(([x, y, z]) => at(x, y, z)), prim.fill, prim.stroke);
    }
  }

  paintDecals(pen, prim, ox, oy) {
    const { x, y, z, dx, dy, dz } = prim.local;
    const to = (lx, ly, lz) => {
      const [wx, wy] = this.world(lx, ly);
      const p = project(wx, wy, lz);
      return [p[0] + ox, p[1] + oy];
    };
    for (const d of prim.decals) {
      if (d.side === 'top') {
        const zt = z + dz;
        pen.poly(
          [
            to(x + d.u, y + d.v, zt),
            to(x + d.u + d.w, y + d.v, zt),
            to(x + d.u + d.w, y + d.v + d.h, zt),
            to(x + d.u, y + d.v + d.h, zt),
          ],
          d.color,
        );
        continue;
      }
      const n = rotateNormal(SIDE_NORMAL[d.side], this.rot);
      if (n[0] < 0 || n[1] < 0) continue; // cara de espaldas a la cámara
      let pts;
      const z0 = z + d.v;
      const z1 = z + d.v + d.h;
      if (d.side === 'py' || d.side === 'ny') {
        const fy = d.side === 'py' ? y + dy : y;
        pts = [to(x + d.u, fy, z1), to(x + d.u + d.w, fy, z1), to(x + d.u + d.w, fy, z0), to(x + d.u, fy, z0)];
      } else {
        const fx = d.side === 'px' ? x + dx : x;
        pts = [to(fx, y + d.u, z1), to(fx, y + d.u + d.w, z1), to(fx, y + d.u + d.w, z0), to(fx, y + d.u, z0)];
      }
      pen.poly(pts, d.color);
    }
  }
}

function paintCyl(pen, prim, at) {
  const { cx, cy, rx, ry, z0, z1, mat } = prim;
  const stroke = prim.opts.stroke === undefined ? OUTLINE : prim.opts.stroke;
  const ring = (z) => {
    const pts = [];
    const steps = Math.max(16, Math.round((rx + ry) * 1.4));
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push(at(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, z));
    }
    return pts;
  };
  const topRing = ring(z1);
  if (z1 > z0) {
    const bottom = ring(z0);
    const hull = convexHull(topRing.concat(bottom));
    pen.poly(hull, mat[1]);
    // Sombreado plano: el tercio derecho, un tono más oscuro.
    const xs = hull.map((p) => p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const cut = minX + Math.round((maxX - minX) * 0.62);
    const lower = new Map();
    const upper = new Map();
    const track = (pts) => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const n = Math.max(1, Math.abs(b[0] - a[0]));
        for (let s = 0; s <= n; s++) {
          const x = Math.round(a[0] + ((b[0] - a[0]) * s) / n);
          const y = Math.round(a[1] + ((b[1] - a[1]) * s) / n);
          if (!lower.has(x) || y > lower.get(x)) lower.set(x, y);
          if (!upper.has(x) || y < upper.get(x)) upper.set(x, y);
        }
      }
    };
    track(hull);
    for (let x = cut; x <= maxX; x++) {
      if (!lower.has(x)) continue;
      pen.rect(x, upper.get(x), 1, lower.get(x) - upper.get(x) + 1, mat[2]);
    }
    pen.poly(topRing, mat[0]);
    if (stroke) pen.poly(hull, null, stroke);
  } else {
    pen.poly(topRing, mat[0], stroke || undefined);
  }
}

// Orden interno por cajas 3D: A va antes si queda claramente detrás o debajo de B.
function sortPrims(prims) {
  const n = prims.length;
  const before = prims.map(() => []);
  const indeg = new Array(n).fill(0);
  const behind = (a, b) => a.x1 <= b.x0 + 0.01 || a.y1 <= b.y0 + 0.01 || a.z1 <= b.z0 + 0.01;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ab = behind(prims[i], prims[j]);
      const ba = behind(prims[j], prims[i]);
      if (ab && !ba) {
        before[i].push(j);
        indeg[j]++;
      } else if (ba && !ab) {
        before[j].push(i);
        indeg[i]++;
      }
    }
  }
  const out = [];
  const done = new Array(n).fill(false);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && indeg[i] <= 0) {
        pick = i;
        break;
      }
    }
    if (pick < 0) pick = done.indexOf(false);
    done[pick] = true;
    out.push(prims[pick]);
    for (const j of before[pick]) indeg[j]--;
  }
  return out;
}
