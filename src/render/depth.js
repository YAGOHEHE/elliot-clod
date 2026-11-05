// Orden de dibujado por profundidad. Cada elemento ocupa una caja en el suelo
// (x0..x1, y0..y1). Si A acaba antes de que empiece B en x o en y, A va detrás.
// Una ordenación topológica resuelve muebles grandes que un simple "x+y" pintaría mal.

const EPS = 1e-3;

export function depthSort(items) {
  const n = items.length;
  if (n < 2) return items.slice();
  const out = new Array(n);
  const edges = new Array(n);
  const indegree = new Int32Array(n);
  for (let i = 0; i < n; i++) edges[i] = [];
  const key = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = items[i];
    key[i] = a.x0 + a.x1 + a.y0 + a.y1;
  }
  for (let i = 0; i < n; i++) {
    const a = items[i];
    for (let j = i + 1; j < n; j++) {
      const b = items[j];
      const aBehind = a.x1 <= b.x0 + EPS || a.y1 <= b.y0 + EPS;
      const bBehind = b.x1 <= a.x0 + EPS || b.y1 <= a.y0 + EPS;
      let first = -1;
      if (aBehind && !bBehind) first = i;
      else if (bBehind && !aBehind) first = j;
      else if (!aBehind && !bBehind) first = key[i] <= key[j] ? i : j; // huellas solapadas
      if (first === i) {
        edges[i].push(j);
        indegree[j]++;
      } else if (first === j) {
        edges[j].push(i);
        indegree[i]++;
      }
      // Si ambos son ciertos, no se solapan en pantalla: da igual el orden.
    }
  }
  const done = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    let cycle = -1;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      if (indegree[i] <= 0 && (pick < 0 || key[i] < key[pick])) pick = i;
      if (cycle < 0 || key[i] < key[cycle]) cycle = i;
    }
    if (pick < 0) pick = cycle;
    done[pick] = 1;
    out[k] = items[pick];
    for (const j of edges[pick]) indegree[j]--;
  }
  return out;
}
