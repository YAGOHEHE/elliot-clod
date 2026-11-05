// Fuente de mapa de bits 5x7 propia del lienzo (texto de burbujas, carteles y letreros),
// para que todo el texto dentro del juego sea píxel nítido sin suavizado.
import { createCanvas } from './raster.js';

const TABLE = {
  ' ': '0000000000', '!': '00005F0000', '"': '0007000700', '#': '147F147F14', $: '242A7F2A12',
  '%': '2313086462', '&': '3649562050', "'": '0008070300', '(': '001C224100', ')': '0041221C00',
  '*': '2A1C7F1C2A', '+': '08083E0808', ',': '0080703000', '-': '0808080808', '.': '0000606000',
  '/': '2010080402', 0: '3E5149453E', 1: '00427F4000', 2: '7249494946', 3: '2141494D33',
  4: '1814127F10', 5: '2745454539', 6: '3C4A494931', 7: '4121110907', 8: '3649494936',
  9: '464949291E', ':': '0000140000', ';': '0040340000', '<': '0008142241', '=': '1414141414',
  '>': '0041221408', '?': '0201590906', '@': '3E415D594E', A: '7C1211127C', B: '7F49494936',
  C: '3E41414122', D: '7F4141413E', E: '7F49494941', F: '7F09090901', G: '3E41415173',
  H: '7F0808087F', I: '00417F4100', J: '2040413F01', K: '7F08142241', L: '7F40404040',
  M: '7F021C027F', N: '7F0408107F', O: '3E4141413E', P: '7F09090906', Q: '3E4151215E',
  R: '7F09192946', S: '2649494932', T: '03017F0103', U: '3F4040403F', V: '1F2040201F',
  W: '3F4038403F', X: '6314081463', Y: '0304780403', Z: '6159494D43', '[': '007F414141',
  '\\': '0204081020', ']': '004141417F', '^': '0402010204', _: '4040404040', '`': '0003070800',
  a: '2054547840', b: '7F28444438', c: '3844444428', d: '384444287F', e: '3854545418',
  f: '00087E0902', g: '18A4A49C78', h: '7F08040478', i: '00447D4000', j: '2040403D00',
  k: '7F10284400', l: '00417F4000', m: '7C04780478', n: '7C08040478', o: '3844444438',
  p: 'FC18242418', q: '18242418FC', r: '7C08040408', s: '4854545424', t: '04043F4424',
  u: '3C4040207C', v: '1C2040201C', w: '3C4030403C', x: '4428102844', y: '4C9090907C',
  z: '4464544C44', '{': '0008364100', '|': '00007F0000', '}': '0041360800', '~': '0201020402',
};

// Letras acentuadas: glifo base + píxeles extra por encima (filas negativas).
const ACUTE = [[3, -1], [2, 0]];
const ACCENTS = {
  á: ['a', [[3, 0], [2, 1]]], é: ['e', [[3, 0], [2, 1]]], í: ['i', [[3, 0], [2, 0]]],
  ó: ['o', [[3, 0], [2, 1]]], ú: ['u', [[3, 0], [2, 1]]], ü: ['u', [[1, 0], [3, 0]]],
  ñ: ['n', [[0, 1], [1, 0], [2, 1], [3, 0]]],
  Á: ['A', ACUTE], É: ['E', ACUTE], Í: ['I', ACUTE], Ó: ['O', ACUTE], Ú: ['U', ACUTE],
  Ü: ['U', [[1, -1], [3, -1]]],
  Ñ: ['N', [[0, 0], [1, -1], [2, 0], [3, -1]]],
};

const GLYPHS = new Map();

function buildGlyph(hex, extra = []) {
  const cols = [];
  for (let i = 0; i < 10; i += 2) cols.push(parseInt(hex.slice(i, i + 2), 16));
  const pixels = [];
  cols.forEach((bits, x) => {
    for (let y = 0; y < 8; y++) if (bits & (1 << y)) pixels.push([x, y]);
  });
  for (const p of extra) pixels.push(p);
  // Ancho proporcional: recortamos las columnas vacías.
  let min = 5;
  let max = -1;
  for (const [x] of pixels) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (max < 0) return { pixels: [], w: 3 };
  return { pixels: pixels.map(([x, y]) => [x - min, y]), w: max - min + 1 };
}

for (const [ch, hex] of Object.entries(TABLE)) GLYPHS.set(ch, buildGlyph(hex));
for (const [ch, [base, extra]] of Object.entries(ACCENTS)) GLYPHS.set(ch, buildGlyph(TABLE[base], extra));
// Signos de apertura: invertidos respecto a su pareja.
GLYPHS.set('¡', { pixels: [[0, 1], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7]], w: 1 });
GLYPHS.set('¿', { pixels: [[2, 1], [2, 3], [1, 4], [0, 5], [0, 6], [1, 7], [2, 7], [3, 7], [4, 6]], w: 5 });
GLYPHS.set('…', { pixels: [[0, 6], [2, 6], [4, 6]], w: 5 });
GLYPHS.set('·', { pixels: [[0, 3], [1, 3], [0, 4], [1, 4]], w: 2 });
GLYPHS.set('×', { pixels: [[0, 2], [4, 2], [1, 3], [3, 3], [2, 4], [1, 5], [3, 5], [0, 6], [4, 6]], w: 5 });
GLYPHS.set('€', { pixels: [[2, 0], [3, 0], [4, 0], [1, 1], [0, 2], [1, 2], [2, 2], [3, 2], [1, 3], [0, 4], [1, 4], [2, 4], [3, 4], [1, 5], [2, 6], [3, 6], [4, 6]], w: 5 });
GLYPHS.set('º', { pixels: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]], w: 3 });

function glyph(ch) {
  return GLYPHS.get(ch) || GLYPHS.get('?');
}

export function textWidth(text, scale = 1) {
  let w = 0;
  for (const ch of text) w += glyph(ch).w + 1;
  return Math.max(0, w - 1) * scale;
}

export const LINE_H = 10;

export function drawText(ctx, text, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text) {
    const g = glyph(ch);
    for (const [gx, gy] of g.pixels) ctx.fillRect(cx + gx * scale, cy + gy * scale, scale, scale);
    cx += (g.w + 1) * scale;
  }
}

// Texto en el plano de una pared: cada columna baja o sube medio píxel, como el muro.
export function drawWallText(ctx, text, x, y, color, wall, scale = 1) {
  ctx.fillStyle = color;
  let col = 0;
  const slope = wall === 'R' ? 0.5 : -0.5;
  for (const ch of text) {
    const g = glyph(ch);
    for (const [gx, gy] of g.pixels) {
      for (let s = 0; s < scale; s++) {
        const px = col + gx * scale + s;
        ctx.fillRect(Math.round(x) + px, Math.round(y) + gy * scale + Math.floor(px * slope), 1, scale);
      }
    }
    col += (g.w + 1) * scale;
  }
}

export function wrapText(text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let word of words) {
    while (textWidth(word) > maxWidth) {
      // Palabra larguísima: la partimos.
      let cut = word.length - 1;
      while (cut > 1 && textWidth(word.slice(0, cut)) > maxWidth) cut--;
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const cache = new Map();

// Texto cacheado en su propio lienzo, con cerco opcional para que se lea sobre cualquier fondo.
export function textSprite(text, color, halo) {
  const key = `${text}|${color}|${halo || ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = createCanvas(textWidth(text) + 4, 13);
  const ctx = c.getContext('2d');
  if (halo) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      drawText(ctx, text, 2 + dx, 2 + dy, halo);
    }
  }
  drawText(ctx, text, 2, 2, color);
  if (cache.size > 300) cache.clear();
  cache.set(key, c);
  return c;
}
