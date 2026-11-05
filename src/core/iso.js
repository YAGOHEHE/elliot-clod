// Proyección isométrica 2:1.
// Coordenadas de sala en baldosas: x baja hacia la derecha, y baja hacia la izquierda.
// 1 baldosa = 32 "unidades" de mueble = rombo de 64x32 px.

export const TILE_W = 64;
export const TILE_H = 32;
export const UNIT = 32;
export const WALL_H = 104;

export function tileToScreen(x, y, z = 0) {
  return { x: Math.round((x - y) * 32), y: Math.round((x + y) * 16 - z) };
}

export function screenToTile(sx, sy) {
  const a = sy / 16;
  const b = sx / 32;
  return { x: (a + b) / 2, y: (a - b) / 2 };
}

// Direcciones: 0 = +x (abajo-derecha), 1 = +y (abajo-izquierda),
// 2 = -x (arriba-izquierda), 3 = -y (arriba-derecha).
export const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export function dirFromDelta(dx, dy, fallback = 1) {
  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return fallback;
  // En diagonal elegimos la cara que mejor se lee en pantalla.
  if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 1e-3) {
    if (dy > 0) return dx > 0 ? 0 : 1;
    return dx > 0 ? 0 : 2;
  }
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

// Giro de un punto local dentro de una huella W×D (en cualquier unidad).
export function rotatePoint(x, y, W, D, rot) {
  switch (rot & 3) {
    case 1:
      return [D - y, x];
    case 2:
      return [W - x, D - y];
    case 3:
      return [y, W - x];
    default:
      return [x, y];
  }
}

export function rotatedSize(W, D, rot) {
  return rot & 1 ? [D, W] : [W, D];
}
