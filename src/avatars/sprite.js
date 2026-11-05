// Avatares chibi originales, de unos 32x64 px: cabeza grande, cuerpo pequeño.
// Se dibujan por código en dos vistas (de frente y de espaldas); las otras dos son su espejo.
import { Pen, autoOutline, createCanvas, flipped } from '../core/raster.js';

export const SKINS = [
  ['#ffe3c4', '#ffd2a6', '#e8ad7c'],
  ['#ffd9b0', '#f4bd8a', '#d9975f'],
  ['#e8b98a', '#d69d6c', '#b57a4b'],
  ['#c48a5c', '#a96f45', '#875432'],
  ['#8f5d3b', '#744729', '#58331c'],
];

export const HAIRS = [
  ['#5a3a22', '#3f2716', '#2c1a0e'],
  ['#2c2c3c', '#1d1d2c', '#12121e'],
  ['#f4cb5e', '#d9a53c', '#b47f24'],
  ['#d9642e', '#b24a20', '#8a3716'],
  ['#c9c9d4', '#9d9daf', '#77778a'],
  ['#f07ab0', '#d1548e', '#a93c70'],
  ['#58c7ba', '#34a596', '#267f79'],
];

export const CLOTHES = [
  ['#ffb04a', '#f2832a', '#cc611a'],
  ['#8cdc62', '#58b645', '#3b8f35'],
  ['#62aeee', '#3f85d2', '#2d63ad'],
  ['#f0635a', '#cf423f', '#a12d33'],
  ['#ffe066', '#f4bd3a', '#cf9222'],
  ['#a77be0', '#7d55bd', '#5d3d99'],
  ['#58cdbb', '#34a596', '#267f79'],
  ['#fbf9f0', '#e2ded0', '#bfb9a8'],
  ['#646a7d', '#484e63', '#343950'],
  ['#3f4d86', '#2d3866', '#1f274a'],
  ['#8a5a36', '#6b4226', '#4f2f19'],
  ['#f28dc0', '#d9649e', '#b0467c'],
];

export const HAIR_STYLES = [
  { id: 'corto', name: 'Corto' },
  { id: 'melena', name: 'Melena' },
  { id: 'mono', name: 'Moño' },
  { id: 'cresta', name: 'Cresta' },
  { id: 'coleta', name: 'Coleta' },
  { id: 'rizos', name: 'Rizos' },
  { id: 'calvo', name: 'Sin pelo' },
  { id: 'gorra', name: 'Gorra' },
];

export const TOP_STYLES = [
  { id: 'camiseta', name: 'Camiseta' },
  { id: 'rayas', name: 'Rayas' },
  { id: 'corbata', name: 'Corbata' },
  { id: 'sudadera', name: 'Sudadera' },
];

export const DEFAULT_LOOK = {
  skin: 1,
  hair: 0,
  hairStyle: 'corto',
  top: 9,
  topStyle: 'corbata',
  bottom: 8,
  shoes: 10,
};

const WIDTH = 40;
const HEIGHT = 68;
const PAD_X = 4;
const PAD_Y = 3;
// Punto del lienzo que corresponde al centro de la baldosa, a ras de suelo.
export const ANCHOR_X = 16 + PAD_X;
export const ANCHOR_Y = 60 + PAD_Y;

function hairBack(p, L, h, view, b) {
  // Lo que queda detrás del cuerpo en la vista frontal.
  if (view !== 'front') return;
  if (L.hairStyle === 'melena') p.rect(6, 18 + b, 20, 18, h[2]);
  if (L.hairStyle === 'coleta') {
    p.rect(1, 14 + b, 6, 16, h[1]);
    p.rect(2, 28 + b, 4, 4, h[2]);
  }
}

function headShape(p, s, b) {
  p.rect(9, 7 + b, 14, 24, s[1]);
  p.rect(7, 8 + b, 18, 22, s[1]);
  p.rect(6, 10 + b, 20, 18, s[1]);
  p.rect(9, 29 + b, 14, 2, s[2]);
  p.rect(7, 28 + b, 2, 2, s[2]);
  p.rect(23, 28 + b, 2, 2, s[2]);
}

function hairFront(p, L, h, top, b) {
  const y = b;
  switch (L.hairStyle) {
    case 'corto':
      p.rect(8, 4 + y, 16, 3, h[1]);
      p.rect(6, 6 + y, 20, 7, h[1]);
      p.rect(6, 13 + y, 9, 3, h[1]);
      p.rect(15, 13 + y, 3, 1, h[1]);
      p.rect(22, 13 + y, 4, 2, h[1]);
      p.rect(6, 16 + y, 3, 4, h[1]);
      p.rect(10, 5 + y, 8, 2, h[0]);
      p.rect(8, 7 + y, 4, 1, h[0]);
      p.rect(6, 15 + y, 2, 3, h[2]);
      break;
    case 'melena':
      p.rect(8, 4 + y, 16, 3, h[1]);
      p.rect(6, 6 + y, 20, 8, h[1]);
      p.rect(4, 10 + y, 6, 24, h[1]);
      p.rect(23, 10 + y, 5, 22, h[1]);
      p.rect(10, 14 + y, 4, 1, h[1]);
      p.rect(10, 5 + y, 8, 2, h[0]);
      p.rect(5, 16 + y, 1, 14, h[0]);
      p.rect(26, 16 + y, 1, 12, h[2]);
      break;
    case 'mono':
      p.rect(12, 0 + y, 9, 5, h[1]);
      p.rect(14, 1 + y, 4, 1, h[0]);
      p.rect(8, 5 + y, 16, 2, h[1]);
      p.rect(6, 7 + y, 20, 6, h[1]);
      p.rect(6, 13 + y, 4, 5, h[1]);
      p.rect(22, 13 + y, 4, 3, h[1]);
      p.rect(10, 6 + y, 7, 1, h[0]);
      break;
    case 'cresta':
      p.rect(13, 0 + y, 6, 8, h[1]);
      p.rect(9, 2 + y, 4, 6, h[1]);
      p.rect(19, 2 + y, 4, 6, h[1]);
      p.rect(8, 7 + y, 16, 5, h[1]);
      p.rect(15, 1 + y, 2, 3, h[0]);
      p.rect(10, 3 + y, 2, 2, h[0]);
      break;
    case 'coleta':
      p.rect(8, 4 + y, 16, 3, h[1]);
      p.rect(6, 6 + y, 20, 7, h[1]);
      p.rect(6, 13 + y, 5, 4, h[1]);
      p.rect(19, 13 + y, 7, 2, h[1]);
      p.rect(11, 5 + y, 8, 2, h[0]);
      p.rect(3, 13 + y, 4, 3, top[1]);
      break;
    case 'rizos':
      p.rect(7, 3 + y, 18, 8, h[1]);
      p.rect(4, 7 + y, 6, 11, h[1]);
      p.rect(23, 7 + y, 5, 11, h[1]);
      p.rect(10, 1 + y, 5, 4, h[1]);
      p.rect(18, 1 + y, 5, 4, h[1]);
      p.rect(10, 11 + y, 4, 3, h[1]);
      p.rect(16, 11 + y, 4, 2, h[1]);
      p.rect(21, 11 + y, 3, 3, h[1]);
      p.rect(11, 3 + y, 3, 2, h[0]);
      p.rect(19, 3 + y, 3, 2, h[0]);
      p.rect(5, 10 + y, 2, 2, h[0]);
      p.rect(25, 13 + y, 2, 2, h[2]);
      break;
    case 'gorra':
      p.rect(6, 12 + y, 5, 7, h[1]);
      p.rect(8, 3 + y, 16, 3, top[1]);
      p.rect(6, 5 + y, 20, 8, top[1]);
      p.rect(10, 4 + y, 8, 2, top[0]);
      p.rect(19, 11 + y, 11, 3, top[2]);
      p.rect(14, 7 + y, 5, 4, '#fff3d3');
      break;
    case 'calvo':
      p.rect(6, 13 + y, 3, 7, h[1]);
      p.rect(24, 13 + y, 2, 6, h[1]);
      p.rect(11, 8 + y, 7, 2, '#ffffff55');
      break;
    default:
      break;
  }
}

function hairRear(p, L, h, top, b) {
  const y = b;
  switch (L.hairStyle) {
    case 'corto':
      p.rect(8, 4 + y, 16, 3, h[1]);
      p.rect(6, 6 + y, 20, 20, h[1]);
      p.rect(8, 26 + y, 16, 2, h[1]);
      p.rect(12, 5 + y, 10, 2, h[0]);
      p.rect(23, 8 + y, 3, 16, h[2]);
      break;
    case 'melena':
      p.rect(8, 4 + y, 16, 3, h[1]);
      p.rect(6, 6 + y, 20, 24, h[1]);
      p.rect(5, 14 + y, 22, 22, h[1]);
      p.rect(12, 5 + y, 10, 2, h[0]);
      p.rect(23, 10 + y, 3, 24, h[2]);
      break;
    case 'mono':
      p.rect(8, 5 + y, 16, 3, h[1]);
      p.rect(6, 7 + y, 20, 19, h[1]);
      p.rect(11, 0 + y, 10, 7, h[0]);
      p.rect(12, 1 + y, 8, 5, h[1]);
      p.rect(23, 8 + y, 3, 16, h[2]);
      break;
    case 'cresta':
      p.rect(13, 0 + y, 6, 8, h[1]);
      p.rect(9, 2 + y, 4, 6, h[1]);
      p.rect(19, 2 + y, 4, 6, h[1]);
      p.rect(13, 8 + y, 6, 14, h[1]);
      p.rect(15, 1 + y, 2, 3, h[0]);
      break;
    case 'coleta':
      p.rect(8, 4 + y, 16, 3, h[1]);
      p.rect(6, 6 + y, 20, 20, h[1]);
      p.rect(12, 5 + y, 10, 2, h[0]);
      p.rect(13, 20 + y, 6, 4, top[1]);
      p.rect(13, 24 + y, 6, 14, h[1]);
      p.rect(14, 37 + y, 4, 2, h[2]);
      break;
    case 'rizos':
      p.rect(7, 3 + y, 18, 24, h[1]);
      p.rect(4, 7 + y, 24, 15, h[1]);
      p.rect(10, 1 + y, 5, 4, h[1]);
      p.rect(18, 1 + y, 5, 4, h[1]);
      p.rect(9, 8 + y, 3, 3, h[0]);
      p.rect(18, 13 + y, 3, 3, h[0]);
      p.rect(11, 20 + y, 3, 3, h[0]);
      p.rect(24, 12 + y, 3, 6, h[2]);
      break;
    case 'gorra':
      p.rect(8, 3 + y, 16, 3, top[1]);
      p.rect(6, 5 + y, 20, 9, top[1]);
      p.rect(10, 4 + y, 8, 2, top[0]);
      p.rect(12, 11 + y, 8, 3, '#3a2a1e');
      p.rect(6, 14 + y, 20, 12, h[1]);
      break;
    case 'calvo':
      p.rect(6, 14 + y, 20, 12, h[1]);
      p.rect(8, 26 + y, 16, 2, h[1]);
      p.rect(23, 15 + y, 3, 10, h[2]);
      p.rect(10, 9 + y, 8, 2, '#ffffff55');
      break;
    default:
      break;
  }
}

function face(p, s, frameInfo, b) {
  const { blink, talk } = frameInfo;
  p.rect(5, 17 + b, 2, 5, s[1]);
  p.rect(5, 19 + b, 1, 2, s[2]);
  const eyeY = 17 + b;
  for (const ex of [13, 20]) {
    if (blink) {
      p.rect(ex, eyeY + 3, 3, 1, '#2b1b33');
    } else {
      p.rect(ex, eyeY, 3, 5, '#2b1b33');
      p.rect(ex, eyeY, 1, 2, '#ffffff');
    }
  }
  p.rect(10, 23 + b, 3, 2, '#f7a79a');
  p.rect(23, 23 + b, 2, 2, '#f7a79a');
  p.px(18, 23 + b, s[2]);
  if (talk) {
    p.rect(16, 25 + b, 4, 2, '#8a2b35');
    p.rect(17, 25 + b, 2, 1, '#ffffff');
  } else {
    p.rect(16, 26 + b, 4, 1, '#8a2b35');
  }
}

function torso(p, L, top, s, b, view) {
  const y = 31 + b;
  p.rect(10, y, 12, 13 - b, top[1]);
  p.rect(20, y, 2, 13 - b, top[2]);
  p.rect(10, y, 2, 1, top[0]);
  switch (L.topStyle) {
    case 'rayas':
      for (let i = 2; i < 12; i += 3) {
        p.rect(10, y + i, 12, 1, top[0]);
      }
      break;
    case 'corbata':
      if (view === 'front') {
        p.rect(10, y, 12, 13 - b, '#fbf9f0');
        p.rect(20, y, 2, 13 - b, '#dcd8cb');
        p.rect(15, y, 3, 2, top[2]);
        p.rect(15, y + 2, 3, 8, top[1]);
        p.rect(16, y + 10, 1, 1, top[2]);
      } else {
        p.rect(10, y, 12, 13 - b, '#e2ded0');
      }
      break;
    case 'sudadera':
      if (view === 'front') {
        p.rect(12, y + 7, 8, 4, top[2]);
        p.rect(14, y, 1, 3, '#fff3d3');
        p.rect(18, y, 1, 3, '#fff3d3');
      } else {
        p.rect(11, y - 1, 10, 4, top[2]);
      }
      break;
    default:
      if (view === 'front') p.rect(14, y, 4, 1, s[1]);
      break;
  }
}

function legs(p, bottom, shoe, pose, frame, view) {
  const toe = view === 'front' ? 1 : 0;
  if (pose === 'sit' || pose === 'type') {
    if (view === 'front') {
      p.rect(11, 44, 13, 5, bottom[1]);
      p.rect(12, 44, 10, 1, bottom[0]);
      p.rect(20, 49, 5, 7, bottom[2]);
      p.rect(20, 56, 7, 3, shoe[1]);
      p.rect(16, 49, 5, 6, bottom[2]);
      p.rect(16, 55, 6, 3, shoe[2]);
    } else {
      p.rect(11, 44, 10, 4, bottom[1]);
      p.rect(21, 42, 5, 4, bottom[2]);
    }
    return;
  }
  let ax = 0;
  let bx = 0;
  let al = 0;
  let bl = 0;
  if (pose === 'walk') {
    if (frame === 0) {
      ax = -2;
      al = 1;
      bx = 3;
    } else if (frame === 2) {
      ax = 3;
      bx = -2;
      bl = 1;
    }
  }
  p.rect(11 + ax, 44, 5, 12 - al, bottom[2]);
  p.rect(11 + ax, 56 - al, 5 + toe, 4, shoe[2]);
  p.rect(17 + bx, 44, 5, 12 - bl, bottom[1]);
  p.rect(20 + bx, 44, 2, 12 - bl, bottom[2]);
  p.rect(17 + bx, 56 - bl, 5 + toe, 4, shoe[1]);
  p.rect(17 + bx, 56 - bl, 3, 1, shoe[0]);
  p.rect(10, 44, 12, 2, bottom[1]);
}

function heldItem(p, kind, x, y) {
  if (kind === 'cup') {
    p.rect(x, y, 5, 5, '#fbf9f0');
    p.rect(x, y, 5, 1, '#5a3218');
    p.rect(x + 5, y + 1, 1, 3, '#dcd8cb');
    p.rect(x + 3, y + 1, 2, 4, '#dcd8cb');
  } else if (kind === 'can') {
    p.rect(x, y, 4, 7, '#3f85d2');
    p.rect(x, y, 4, 1, '#c2c6cf');
    p.rect(x, y + 3, 4, 2, '#fff3d3');
    p.rect(x + 3, y + 1, 1, 6, '#2d63ad');
  }
}

function arms(p, top, s, pose, frame, view, b, held) {
  const sleeve = top[1];
  const dark = top[2];
  const y = 32 + b;
  if (pose === 'type') {
    const lift = frame % 2;
    if (view === 'front') {
      p.rect(7, y, 3, 8, sleeve);
      p.rect(8, y + 7, 7, 3, sleeve);
      p.rect(14, y + 7 - lift, 3, 3, s[1]);
      p.rect(22, y, 3, 7, dark);
      p.rect(23, y + 6, 6, 3, dark);
      p.rect(29, y + 6 - (1 - lift), 2, 3, s[1]);
    } else {
      p.rect(6, y, 4, 6, dark);
      p.rect(7, y + 5 - lift, 3, 3, s[1]);
      p.rect(22, y, 4, 6, sleeve);
      p.rect(22, y + 5 - (1 - lift), 3, 3, s[1]);
    }
    return;
  }
  if (pose === 'use') {
    const jig = frame % 2;
    if (view === 'front') {
      p.rect(7, y, 3, 10, sleeve);
      p.rect(7, y + 10, 3, 3, s[1]);
      p.rect(22, y + 1, 7, 3, dark);
      p.rect(29, y + jig, 2, 3, s[1]);
    } else {
      p.rect(7, y, 3, 10, dark);
      p.rect(7, y + 10, 3, 3, s[1]);
      p.rect(22, y - 3, 3, 7, sleeve);
      p.rect(22, y - 6 + jig, 3, 3, s[1]);
    }
    return;
  }
  if (pose === 'drink') {
    p.rect(7, y, 3, 10, view === 'front' ? sleeve : dark);
    p.rect(7, y + 10, 3, 3, s[1]);
    if (view === 'front') {
      p.rect(22, y, 3, 5, dark);
      p.rect(20, y - 4, 5, 4, dark);
      p.rect(20, y - 6, 3, 3, s[1]);
      heldItem(p, held || 'cup', 18, y - 11 + frame % 2);
    } else {
      p.rect(22, y - 2, 4, 5, sleeve);
      p.rect(23, y - 4, 3, 3, s[1]);
    }
    return;
  }
  if (pose === 'wave') {
    p.rect(7, y, 3, 10, view === 'front' ? sleeve : dark);
    p.rect(7, y + 10, 3, 3, s[1]);
    const off = frame % 2;
    p.rect(23, y - 8, 3, 11, view === 'front' ? dark : sleeve);
    p.rect(23 + off, y - 11, 3, 3, s[1]);
    return;
  }
  let swing = 0;
  if (pose === 'walk') swing = frame === 0 ? 2 : frame === 2 ? -2 : 0;
  p.rect(7, y + Math.max(swing, 0) * 0, 3, 10, view === 'front' ? sleeve : dark);
  p.rect(7 + (swing > 0 ? 1 : swing < 0 ? -1 : 0), y + 10, 3, 3, s[1]);
  p.rect(22, y, 3, 10, view === 'front' ? dark : sleeve);
  p.rect(22 - (swing > 0 ? 1 : swing < 0 ? -1 : 0), y + 10, 3, 3, s[1]);
  if (held && !swing) heldItem(p, held, 25, y + 6);
  else if (held) heldItem(p, held, 25, y + 7);
}

function paint(ctx, look, view, pose, frame, blink, talk, held) {
  const p = new Pen(ctx);
  ctx.save();
  ctx.translate(PAD_X, PAD_Y);
  const s = SKINS[look.skin] || SKINS[0];
  const h = HAIRS[look.hair] || HAIRS[0];
  const top = CLOTHES[look.top] || CLOTHES[0];
  const bottom = CLOTHES[look.bottom] || CLOTHES[0];
  const shoe = CLOTHES[look.shoes] || CLOTHES[0];
  const b = pose === 'walk' && frame % 2 === 1 ? -1 : 0;

  hairBack(p, look, h, view, b);
  legs(p, bottom, shoe, pose, frame, view);
  torso(p, look, top, s, b, view);
  if (view === 'front') {
    arms(p, top, s, pose, frame, view, b, held);
    headShape(p, s, b);
    face(p, s, { blink, talk }, b);
    hairFront(p, look, h, top, b);
    if (pose === 'drink') {
      // El brazo con la taza pasa por delante de la cara.
      p.rect(20, 28 + b, 5, 4, top[2]);
      heldItem(p, held || 'cup', 18, 21 + b + frame % 2);
    }
  } else {
    headShape(p, s, b);
    hairRear(p, look, h, top, b);
    arms(p, top, s, pose, frame, view, b, held);
  }
  ctx.restore();
}

const cache = new Map();

function lookKey(L) {
  return `${L.skin}.${L.hair}.${L.hairStyle}.${L.top}.${L.topStyle}.${L.bottom}.${L.shoes}`;
}

// dir: 0 abajo-derecha, 1 abajo-izquierda, 2 arriba-izquierda, 3 arriba-derecha.
export function avatarSprite(look, dir, pose, frame, blink = false, talk = false, held = null) {
  const key = `${lookKey(look)}|${dir}|${pose}|${frame}|${blink ? 1 : 0}|${talk ? 1 : 0}|${held || ''}`;
  let c = cache.get(key);
  if (c) return c;
  const view = dir === 0 || dir === 1 ? 'front' : 'back';
  c = createCanvas(WIDTH, HEIGHT);
  paint(c.getContext('2d'), look, view, pose, frame, blink, talk, held);
  autoOutline(c);
  // Vista base mirando a la derecha; 1 y 2 miran a la izquierda.
  if (dir === 1 || dir === 2) c = flipped(c);
  if (cache.size > 2500) cache.clear();
  cache.set(key, c);
  return c;
}

// Retrato a medida para el panel de avatar y el botón de la barra.
export function avatarPortrait(look) {
  return avatarSprite(look, 0, 'stand', 0);
}

// Al reflejar, el punto de anclaje queda en la columna simétrica.
export function anchorXFor(dir) {
  return dir === 1 || dir === 2 ? WIDTH - ANCHOR_X : ANCHOR_X;
}
