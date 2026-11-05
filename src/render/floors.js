// Baldosas de suelo: rombos 64x31 px que encajan sin huecos, con su textura plana.
import { createCanvas, hash2, hexToRgb } from '../core/raster.js';

// Medio ancho de cada fila del rombo. Elegido para que los rombos vecinos teselen exactos.
export function rowHalf(r) {
  return r <= 15 ? 2 * r + 2 : 30 - 2 * (r - 16);
}

export const FLOOR_STYLES = {
  carpetTaupe: { kind: 'carpet', a: '#a69c8c', b: '#b3a999', c: '#978d7e', grid: '#8c8374', dark: '#5c554a' },
  carpetSlate: { kind: 'carpet', a: '#6d7686', b: '#7a8393', c: '#606978', grid: '#59626f', dark: '#3a414c' },
  carpetBlue: { kind: 'carpet', a: '#7b8999', b: '#8996a5', c: '#6e7c8c', grid: '#667381', dark: '#414b57' },
  carpetGray: { kind: 'carpet', a: '#8d9198', b: '#9a9ea5', c: '#80848b', grid: '#767a81', dark: '#4c4f55' },
  carpetGreen: { kind: 'carpet', a: '#87927f', b: '#949f8c', c: '#7a8573', grid: '#717c6b', dark: '#4a5246' },
  checkerWarm: { kind: 'checker', a: '#e8e2d2', b: '#cfc8b7', grid: '#b3ac9b', c: '#f0ebdd', d: '#c4bdac', dark: '#6e685a' },
  checkerBlue: { kind: 'checker', a: '#f2f3f0', b: '#d4dadd', grid: '#b5bcc0', c: '#ffffff', d: '#c7ced2', dark: '#5f686e' },
  mat: { kind: 'mat', a: '#56687c', b: '#6b7d90', c: '#3f4f60', grid: '#2f3c49', dark: '#20282f' },
};

const VARIANTS = 4;
const cache = new Map();

function buildTile(style, parity, variant) {
  const c = createCanvas(64, 31);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 31);
  const put = (x, y, hex) => {
    const [r, g, b] = hexToRgb(hex);
    const i = (y * 64 + x) * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  };
  for (let r = 0; r <= 30; r++) {
    const half = rowHalf(r);
    for (let px = -half; px < half; px++) {
      // u corre a lo largo de x, v a lo largo de y: coordenadas dentro de la baldosa.
      const u = ((r + 0.5) / 16 + (px + 0.5) / 32) / 2;
      const v = ((r + 0.5) / 16 - (px + 0.5) / 32) / 2;
      const edge = r >= 15 && (px < -half + 2 || px >= half - 2);
      let color;
      if (style.kind === 'planks') {
        const plank = Math.floor(v * 4);
        const fv = v * 4 - plank;
        const shift = hash2(plank + variant * 7, parity) % 3;
        color = shift === 0 ? style.a : shift === 1 ? style.b : style.c;
        if (fv < 0.09) color = style.seam;
        const joint = (hash2(plank, variant + 11) % 10) / 10;
        if (Math.abs(u - joint) < 0.018) color = style.seam;
      } else if (style.kind === 'carpet') {
        const h = hash2(px + variant * 91, r + parity * 37);
        color = style.a;
        if (h % 7 === 0) color = style.b;
        else if (h % 11 === 0) color = style.c;
      } else if (style.kind === 'checker') {
        color = parity ? style.a : style.b;
        if (hash2(px + variant, r) % 53 === 0) color = parity ? style.c : style.d;
      } else {
        const stripe = Math.floor((u + v) * 5) % 2;
        color = stripe ? style.a : style.b;
        if (u < 0.08 || v < 0.08 || u > 0.92 || v > 0.92) color = style.c;
      }
      if (edge) color = style.grid;
      put(px + 32, r, color);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function tileImage(styleName, x, y) {
  const parity = (x + y) & 1;
  const variant = hash2(x, y) % VARIANTS;
  const key = `${styleName}|${parity}|${variant}`;
  let c = cache.get(key);
  if (!c) {
    c = buildTile(FLOOR_STYLES[styleName], parity, variant);
    cache.set(key, c);
  }
  return c;
}

// Rombo de una baldosa como relleno o trazo, para cursores y modo edición.
export function drawDiamond(ctx, sx, sy, stroke, fill, checker = false) {
  for (let r = 0; r <= 30; r++) {
    const half = rowHalf(r);
    const y = sy + r;
    if (fill) {
      ctx.fillStyle = fill;
      if (checker) {
        for (let x = -half; x < half; x++) if ((x + r) % 2 === 0) ctx.fillRect(sx + x, y, 1, 1);
      } else {
        ctx.fillRect(sx - half, y, half * 2, 1);
      }
    }
    if (stroke) {
      ctx.fillStyle = stroke;
      ctx.fillRect(sx - half, y, 2, 1);
      ctx.fillRect(sx + half - 2, y, 2, 1);
    }
  }
}
