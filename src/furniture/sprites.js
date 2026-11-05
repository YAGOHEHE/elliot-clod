// Caché de sprites de muebles: se pintan una vez por tipo, giro, fotograma y capa.
import { Builder } from './builder.js';
import { CATALOG } from './catalog.js';

const cache = new Map();

const EMPTY = { k: 0 };

export function frameFor(f, t) {
  const c = CATALOG[f.type];
  return c.frame ? c.frame(f, t) : EMPTY;
}

export function furnitureSprite(type, rot, frame = EMPTY, layers = null) {
  const key = `${type}|${rot}|${frame.k}|${layers ? layers.join('+') : '*'}`;
  let s = cache.get(key);
  if (s) return s;
  const c = CATALOG[type];
  const b = new Builder(c.W, c.D, rot);
  c.art(b, frame);
  s = b.render(layers);
  cache.set(key, s);
  return s;
}

// Icono para el inventario: el mueble en su orientación base, recortado.
export function furnitureIcon(type) {
  const c = CATALOG[type];
  const frame = c.frame ? c.frame({ type, rot: 0, state: {}, seed: 0 }, 0) : EMPTY;
  return furnitureSprite(type, 0, frame);
}
