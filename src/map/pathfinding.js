// Búsqueda de camino A* sobre la cuadrícula, en 8 direcciones y sin cortar esquinas de muebles.

const NEIGHBORS = [
  [1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10],
  [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14],
];

export function findPath(w, h, isFree, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  if (!isFree(tx, ty)) return null;
  const size = w * h;
  const id = (x, y) => y * w + x;
  const g = new Int32Array(size).fill(-1);
  const from = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heur = (x, y) => {
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
  };
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  if (!inside(sx, sy) || !inside(tx, ty)) return null;
  const open = [{ x: sx, y: sy, f: heur(sx, sy) }];
  g[id(sx, sy)] = 0;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open[best];
    open[best] = open[open.length - 1];
    open.pop();
    const cid = id(cur.x, cur.y);
    if (closed[cid]) continue;
    closed[cid] = 1;
    if (cur.x === tx && cur.y === ty) {
      const out = [];
      let n = cid;
      while (n !== id(sx, sy)) {
        out.push({ x: n % w, y: Math.floor(n / w) });
        n = from[n];
      }
      return out.reverse();
    }
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inside(nx, ny) || !isFree(nx, ny)) continue;
      if (dx && dy && (!isFree(cur.x + dx, cur.y) || !isFree(cur.x, cur.y + dy))) continue;
      const nid = id(nx, ny);
      const tentative = g[cid] + cost;
      if (g[nid] !== -1 && g[nid] <= tentative) continue;
      g[nid] = tentative;
      from[nid] = cid;
      open.push({ x: nx, y: ny, f: tentative + heur(nx, ny) });
    }
  }
  return null;
}

// Todas las baldosas alcanzables desde un punto, con su distancia en pasos.
export function reachableFrom(w, h, isFree, sx, sy) {
  const seen = new Int32Array(w * h).fill(-1);
  const queue = [[sx, sy]];
  seen[sy * w + sx] = 0;
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (seen[ny * w + nx] !== -1 || !isFree(nx, ny)) continue;
      if (dx && dy && (!isFree(x + dx, y) || !isFree(x, y + dy))) continue;
      seen[ny * w + nx] = seen[y * w + x] + 1;
      queue.push([nx, ny]);
    }
  }
  return seen;
}

// Baldosa alcanzable más cercana a un objetivo (para clics sobre muebles o zonas ocupadas).
export function nearestReachable(w, h, isFree, sx, sy, tx, ty) {
  const seen = reachableFrom(w, h, isFree, sx, sy);
  let best = null;
  let bestD = Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] < 0) continue;
      const d = (x - tx) ** 2 + (y - ty) ** 2 + seen[y * w + x] * 0.001;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}
