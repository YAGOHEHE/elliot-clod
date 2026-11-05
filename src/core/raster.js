// Primitivas de pixel art: todo se pinta con rectángulos enteros, sin suavizado.

export const OUTLINE = '#262a33';

export function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export class Pen {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
  }

  rect(x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // Bresenham siempre de izquierda a derecha, para que las líneas 2:1 sean regulares.
  line(ax, ay, bx, by, color) {
    let x0 = Math.round(ax);
    let y0 = Math.round(ay);
    let x1 = Math.round(bx);
    let y1 = Math.round(by);
    if (x0 > x1) {
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }
    this.ctx.fillStyle = color;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // Relleno de un polígono convexo por filas, usando el mismo trazado que line().
  poly(points, fill, stroke) {
    const rows = new Map();
    const visit = (x, y) => {
      const r = rows.get(y);
      if (!r) rows.set(y, [x, x]);
      else {
        if (x < r[0]) r[0] = x;
        if (x > r[1]) r[1] = x;
      }
    };
    const n = points.length;
    for (let i = 0; i < n; i++) {
      walkLine(points[i], points[(i + 1) % n], visit);
    }
    if (fill) {
      this.ctx.fillStyle = fill;
      for (const [y, [a, b]] of rows) this.ctx.fillRect(a, y, b - a + 1, 1);
    }
    if (stroke) {
      for (let i = 0; i < n; i++) {
        const p = points[i];
        const q = points[(i + 1) % n];
        this.line(p[0], p[1], q[0], q[1], stroke);
      }
    }
  }
}

function walkLine(p, q, visit) {
  let x0 = Math.round(p[0]);
  let y0 = Math.round(p[1]);
  let x1 = Math.round(q[0]);
  let y1 = Math.round(q[1]);
  if (x0 > x1) {
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
  }
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    visit(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function convexHull(points) {
  const pts = points
    .map((p) => [Math.round(p[0]), Math.round(p[1])])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Contorno de 1 px alrededor de lo ya pintado (para avatares y objetos dibujados a mano).
export function autoOutline(canvas, color = OUTLINE) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 128;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

export function flipped(canvas) {
  const c = createCanvas(canvas.width, canvas.height);
  const ctx = c.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

// Máscara de opacidad, calculada una sola vez por lienzo, para acertar clics por píxel.
export function hitsCanvas(canvas, x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
  if (!canvas._mask) {
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const m = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    canvas._mask = m;
  }
  return canvas._mask[y * canvas.width + x] === 1;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
