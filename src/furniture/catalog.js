// Catálogo de muebles: datos de juego (huella, asientos, uso) y arte original
// descrito con cajas y cilindros. Cada función de arte recibe un Builder y el estado visual.
import { OUTLINE } from '../core/raster.js';
import { rotatePoint, rotatedSize } from '../core/iso.js';

// Materiales: [tapa, cara izquierda, cara derecha] + arista clara opcional.
export const M = {
  wood: ['#d9c39a', '#bda57c', '#98835f', '#ebdabb'],
  woodDark: ['#8e7658', '#715d45', '#574734', '#a98f70'],
  woodRed: ['#9a7355', '#7d5b42', '#604532', '#b58f72'],
  cream: ['#efe8d6', '#d9d0bb', '#b9af98', '#fbf7ec'],
  beige: ['#e6dfca', '#cac2aa', '#a9a18a', '#f4efdf'],
  navy: ['#6f83a0', '#4f6380', '#3a4b64', '#92a5bf'],
  charcoal: ['#7a7f88', '#5b6069', '#454951', '#9599a1'],
  fabric: ['#b5bac2', '#979da8', '#7b818c', '#cfd3da'],
  carton: ['#d2b48a', '#b89868', '#96794f', '#e6cfaa'],
  white: ['#fbf9f0', '#e2ded0', '#bfb9a8', '#ffffff'],
  grey: ['#c2c6cf', '#989eac', '#747a8b', '#e0e3ea'],
  dark: ['#646a7d', '#484e63', '#343950', '#7f869c'],
  black: ['#44445a', '#2f2f42', '#232333', '#5e5e78'],
  green: ['#9db58c', '#7d9a6c', '#617d53', '#bccfae'],
  greenDark: ['#5f6f5c', '#4b5a49', '#3a4639', '#7b8b78'],
  orange: ['#d8a36a', '#bd8550', '#96663a', '#ecc595'],
  blue: ['#7f9fc4', '#5f80a8', '#476489', '#a6c0dc'],
  red: ['#c9716a', '#ad5551', '#883f40', '#dc918b'],
  yellow: ['#e8d387', '#d3b862', '#ad9346', '#f3e5aa'],
  teal: ['#8fa9a8', '#6f8e8d', '#557170', '#b3c8c6'],
  purple: ['#9c8fb3', '#7d7096', '#615677', '#b9aecb'],
  terracotta: ['#c99573', '#ad7955', '#8a5e40', '#dcb193'],
  stall: ['#e6e1d4', '#aeb3b5', '#8f9497', '#ffffff'],
};

const SCREEN_COLORS = ['#8df5a8', '#ffe066', '#8fd5ff', '#ffffff'];

function hash(n) {
  let x = Math.imul(n + 1, 2654435761);
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

// Monitor CRT crema. side: 'py' si la pantalla mira a +y, 'ny' si mira a -y.
function crt(b, x, y, z, side, s) {
  const front = side === 'py';
  b.box(x + 5, y + 3, z, 16, 12, 2, M.dark);
  b.box(x, y, z + 2, 26, 18, 20, M.beige);
  const u = 3;
  const v = 3;
  const w = 20;
  const h = 15;
  b.face(side, u - 1, v - 1, w + 2, h + 2, '#6d6650');
  const active = s && s.active;
  b.face(side, u, v, w, h, active ? '#123a3f' : '#16224a');
  const n = s ? s.n : 0;
  if (active) {
    for (let i = 0; i < 5; i++) {
      const len = 5 + (hash(i * 7 + (n >> 1) * 13) % 12);
      const col = SCREEN_COLORS[hash(i + 3) % 3];
      if (i * 3 + 2 <= h) b.face(side, u + 2, v + h - 2 - i * 3, len, 1, col);
    }
    if (n % 2) b.face(side, u + 16, v + 2, 2, 2, '#ffffff');
  } else {
    // Salvapantallas: un cuadradito que rebota y una línea de exploración.
    const px = [2, 8, 14, 10][n % 4];
    const py = [3, 9, 5, 11][n % 4];
    b.face(side, u + px, v + py, 3, 2, SCREEN_COLORS[n % 3]);
    b.face(side, u, v + ((n * 5) % h), w, 1, '#24346a');
  }
  b.face(side, u + w - 3, 1, 2, 1, n % 2 ? '#7dff7d' : '#3ca13c');
  // Parte trasera, más estrecha.
  if (front) b.box(x + 5, y - 3, z + 5, 16, 3, 14, M.beige);
  else b.box(x + 5, y + 18, z + 5, 16, 3, 14, M.beige);
}

// Flexo de sobremesa dibujado a mano: base, brazo articulado y pantalla con bombilla.
function deskLamp(b, x, y, z, shade) {
  b.custom(x, y, z, 14, (p, sx, sy) => {
    p.rect(sx - 5, sy - 1, 11, 4, OUTLINE);
    p.rect(sx - 4, sy, 9, 2, M.dark[1]);
    p.rect(sx - 3, sy, 4, 1, M.dark[0]);
    for (const [ax, ay, bx, by] of [[sx, sy - 1, sx + 3, sy - 12], [sx + 3, sy - 12, sx - 2, sy - 19]]) {
      p.line(ax - 1, ay, bx - 1, by, OUTLINE);
      p.line(ax + 1, ay, bx + 1, by, OUTLINE);
      p.line(ax, ay, bx, by, M.grey[1]);
    }
    p.rect(sx + 2, sy - 13, 3, 3, OUTLINE);
    // Pantalla: trapecio de 3 tonos que se abre hacia abajo.
    const widths = [5, 7, 9, 11, 13];
    widths.forEach((w, i) => {
      const left = sx - 5 - Math.floor(w / 2);
      const top = sy - 24 + i;
      p.rect(left - 1, top, w + 2, 1, OUTLINE);
      p.rect(left, top, w, 1, shade[1]);
      p.rect(left, top, Math.ceil(w / 3), 1, shade[0]);
      p.rect(left + w - 2, top, 2, 1, shade[2]);
    });
    p.rect(sx - 8, sy - 25, 6, 1, OUTLINE);
    p.rect(sx - 13, sy - 19, 15, 1, OUTLINE);
    p.rect(sx - 8, sy - 18, 6, 2, OUTLINE);
    p.rect(sx - 7, sy - 18, 4, 1, '#fff6b0');
  });
}

function plantArt(b, potMat = M.terracotta, spread = 1) {
  b.cyl(16, 16, 0, 9, 9, 14, potMat);
  b.cyl(16, 16, 14, 7, 7, 0, ['#5b3b22', '#5b3b22', '#5b3b22']);
  b.custom(16, 16, 14, 26, (p, sx, sy) => {
    const leaves = [
      [-2.5, 15, '#34873a'], [-0.6, 17, '#34873a'], [2.9, 15, '#2f7c36'], [-3.0, 11, '#58b645'],
      [-1.2, 22, '#58b645'], [-1.9, 19, '#58b645'], [0.1, 13, '#58b645'], [-0.3, 23, '#7fd35c'],
      [-1.5, 15, '#7fd35c'], [-2.2, 14, '#8cdc62'], [0.5, 18, '#7fd35c'],
    ];
    const stroke = (a, len, color, grow) => {
      const L = len * spread;
      for (let i = 0; i < L; i++) {
        const k = i / L;
        const x = Math.round(sx + Math.cos(a) * i);
        const y = Math.round(sy + Math.sin(a) * i * 0.95 + k * k * L * 0.42);
        const t = (k < 0.15 ? 1 : k > 0.8 ? 1 : 2) + grow;
        p.rect(x - t, y - t, t * 2 + 1, t * 2 + 1, color);
      }
    };
    for (const [a, len] of leaves) stroke(a, len, OUTLINE, 1);
    for (const [a, len, c] of leaves) stroke(a, len, c, 0);
  });
}

function swivelChair(b, mat) {
  b.cyl(16, 16, 0, 10, 10, 2, M.black);
  b.box(14, 14, 2, 4, 4, 11, M.dark, { highlight: false });
  b.box(6, 7, 12, 20, 20, 4, mat);
  b.setLayer('over');
  b.box(13, 5, 12, 6, 2, 8, M.dark, { highlight: false });
  b.box(7, 3, 20, 18, 4, 20, mat);
  b.setLayer('main');
}

function legChair(b, mat) {
  for (const [x, y] of [[7, 8], [23, 8], [7, 24], [23, 24]]) {
    b.box(x, y, 0, 2, 2, 13, M.woodDark, { highlight: false });
  }
  b.box(6, 7, 13, 20, 20, 3, mat);
  b.setLayer('over');
  b.box(7, 4, 13, 2, 3, 26, M.woodDark, { highlight: false });
  b.box(23, 4, 13, 2, 3, 26, M.woodDark, { highlight: false });
  b.box(6, 4, 26, 20, 3, 14, mat);
  b.setLayer('main');
}

function shelfBooks(b, side, seed, width, levels) {
  const palette = ['#e0524a', '#f2832a', '#58b645', '#3f85d2', '#f4bd3a', '#7d55bd', '#34a596', '#fff3d3'];
  levels.forEach((lv, li) => {
    b.face(side, 3, lv, width - 6, 18, '#5a3218');
    let u = 4;
    let i = 0;
    while (u < width - 7) {
      const h = hash(seed + li * 31 + i * 7);
      const w = 2 + (h % 3);
      const ht = 10 + ((h >> 3) % 7);
      if ((h >> 7) % 9 !== 0) b.face(side, u, lv, Math.min(w, width - 4 - u), ht, palette[(h >> 4) % palette.length]);
      u += w + ((h >> 11) % 5 === 0 ? 2 : 0);
      i++;
    }
  });
}

const speed = (t, fps, count, offset = 0) => Math.floor(t * fps + offset) % count;

function screenFrame(f, t) {
  const active = !!f.state.active;
  const offset = (f.seed || 0) % 7;
  const n = active ? speed(t, 7, 8, offset) : speed(t, 1.6, 4, offset);
  return { k: `${active ? 'a' : 'i'}${n}`, active, n };
}

export const CATALOG = {
  desk_work: {
    name: 'Escritorio con ordenador', W: 2, D: 1, computer: true, frame: screenFrame,
    art(b, s) {
      // Mampara de cubículo, tapizada, por detrás y a un lado de la mesa.
      b.box(0, 0, 0, 64, 2, 52, M.fabric);
      b.box(0, 2, 0, 2, 30, 40, M.fabric);
      b.box(2, 3, 0, 3, 26, 24, M.woodDark);
      b.box(59, 3, 0, 3, 26, 24, M.woodDark);
      b.box(5, 4, 6, 54, 2, 18, M.woodDark);
      b.box(42, 4, 2, 17, 24, 22, M.wood);
      b.face('py', 2, 13, 13, 7, M.wood[0]).face('py', 2, 3, 13, 7, M.wood[0]);
      b.face('py', 6, 16, 5, 1, OUTLINE).face('py', 6, 6, 5, 1, OUTLINE);
      b.box(0, 0, 24, 64, 32, 3, M.wood);
      crt(b, 6, 4, 27, 'py', s);
      b.box(8, 24, 27, 22, 6, 1, M.grey, { highlight: false });
      b.top(2, 1, 18, 1, '#6d7282').top(2, 3, 18, 1, '#6d7282');
      b.box(34, 25, 27, 3, 4, 1, M.grey, { highlight: false });
      b.box(40, 22, 27, 10, 7, 1, M.white, { highlight: false });
      deskLamp(b, 54, 10, 27, M.orange);
    },
  },
  chair_swivel: {
    name: 'Silla giratoria', W: 1, D: 1, layered: true,
    seats: [{ x: 0.5, y: 0.5, dir: 1, z: 16 }],
    art: (b) => swivelChair(b, M.navy),
  },
  chair_swivel_green: {
    name: 'Silla giratoria gris', W: 1, D: 1, layered: true,
    seats: [{ x: 0.5, y: 0.5, dir: 1, z: 16 }],
    art: (b) => swivelChair(b, M.charcoal),
  },
  copier: {
    name: 'Fotocopiadora', W: 1, D: 1, use: 'copier',
    frame: (f, t) => {
      const copying = f.state.mode === 'copy';
      const n = speed(t, copying ? 8 : 1.5, 4);
      return { k: `${copying ? 'c' : 'i'}${n}`, copying, n };
    },
    art(b, s) {
      b.box(2, 3, 0, 28, 26, 32, M.fabric);
      b.face('py', 3, 5, 22, 8, M.fabric[0]).face('py', 3, 16, 22, 8, M.fabric[0]);
      b.face('py', 11, 8, 6, 2, M.charcoal[2]).face('py', 11, 19, 6, 2, M.charcoal[2]);
      b.box(0, 8, 24, 3, 16, 3, M.white);
      b.box(2, 3, 32, 28, 26, 3, M.charcoal);
      b.top(16, 18, 9, 5, s.copying || s.n % 2 ? '#a8e0a0' : '#5d8a58');
      b.box(4, 4, 35, 24, 17, 3, M.fabric);
      if (s.copying) b.box(28, 10, 12, 8, 12, 1, M.white);
      if (s.copying) b.face('py', 3 + (s.n * 7) % 21, 0, 2, 3, '#fff6b0');
    },
  },
  paper_boxes: {
    name: 'Cajas de folios', W: 1, D: 1,
    art(b) {
      b.box(3, 4, 0, 26, 24, 16, M.carton);
      b.face('py', 5, 5, 14, 6, M.white[0]).face('py', 7, 7, 10, 1, M.navy[1]);
      b.face('px', 4, 5, 14, 6, M.white[1]);
      b.box(5, 6, 16, 22, 20, 14, M.carton);
      b.face('py', 4, 4, 14, 6, M.white[0]).face('py', 6, 6, 10, 1, M.navy[1]);
      b.box(6, 8, 30, 14, 10, 2, M.white);
    },
  },
  chair_meet: {
    name: 'Silla de reuniones', W: 1, D: 1, layered: true,
    seats: [{ x: 0.5, y: 0.5, dir: 1, z: 16 }],
    art: (b) => legChair(b, M.teal),
  },
  chair_exec: {
    name: 'Sillón de dirección', W: 1, D: 1, layered: true,
    seats: [{ x: 0.5, y: 0.5, dir: 1, z: 17 }],
    art(b) {
      b.cyl(16, 16, 0, 11, 11, 2, M.black);
      b.box(14, 14, 2, 4, 4, 11, M.dark, { highlight: false });
      b.box(5, 6, 12, 22, 22, 5, M.greenDark);
      b.box(3, 10, 22, 3, 14, 3, M.woodDark);
      b.box(26, 10, 22, 3, 14, 3, M.woodDark);
      b.setLayer('over');
      b.box(6, 2, 14, 20, 5, 36, M.greenDark);
      b.face('py', 3, 8, 14, 1, M.green[0]).face('py', 3, 20, 14, 1, M.green[0]);
      b.setLayer('main');
    },
  },
  stool: {
    name: 'Taburete alto', W: 1, D: 1, seats: [{ x: 0.5, y: 0.5, dir: 1, z: 31 }],
    art(b) {
      b.cyl(16, 16, 0, 8, 8, 2, M.dark);
      b.box(14, 14, 2, 4, 4, 26, M.grey, { highlight: false });
      b.cyl(16, 16, 28, 9, 9, 3, M.orange);
    },
  },
  pouf_orange: {
    name: 'Puf naranja', W: 1, D: 1, seats: [{ x: 0.5, y: 0.5, dir: 1, z: 13 }],
    art(b) {
      b.cyl(16, 16, 0, 13, 13, 9, M.orange);
      b.cyl(16, 16, 9, 10, 10, 3, M.orange);
    },
  },
  pouf_green: {
    name: 'Puf verde', W: 1, D: 1, seats: [{ x: 0.5, y: 0.5, dir: 1, z: 13 }],
    art(b) {
      b.cyl(16, 16, 0, 13, 13, 9, M.green);
      b.cyl(16, 16, 9, 10, 10, 3, M.green);
    },
  },
  pouf_blue: {
    name: 'Puf azul', W: 1, D: 1, seats: [{ x: 0.5, y: 0.5, dir: 1, z: 13 }],
    art(b) {
      b.cyl(16, 16, 0, 13, 13, 9, M.blue);
      b.cyl(16, 16, 9, 10, 10, 3, M.blue);
    },
  },
  sofa: {
    name: 'Sofá de espera', W: 3, D: 1, layered: true,
    seats: [
      { x: 0.55, y: 0.55, dir: 1, z: 16 },
      { x: 1.5, y: 0.55, dir: 1, z: 16 },
      { x: 2.45, y: 0.55, dir: 1, z: 16 },
    ],
    art(b) {
      b.box(2, 3, 0, 92, 27, 11, M.teal);
      for (const x of [9, 35, 61]) b.box(x, 10, 11, 26, 20, 4, M.teal);
      b.box(1, 3, 0, 9, 28, 24, M.teal);
      b.box(86, 3, 0, 9, 28, 24, M.teal);
      b.setLayer('over');
      b.box(9, 2, 11, 78, 8, 30, M.teal);
      b.setLayer('main');
    },
  },
  counter_reception: {
    name: 'Mostrador de recepción', W: 3, D: 1, computer: true,
    art(b) {
      b.box(2, 6, 0, 92, 22, 34, M.cream);
      b.face('py', 0, 4, 92, 4, M.orange[1]).face('py', 0, 8, 92, 2, M.green[1]);
      b.face('py', 34, 14, 24, 14, M.orange[1]).face('py', 38, 18, 16, 6, M.cream[0]);
      b.face('px', 0, 4, 22, 4, M.orange[2]).face('px', 0, 8, 22, 2, M.green[2]);
      b.box(0, 2, 34, 96, 30, 3, M.wood);
      b.box(4, 4, 37, 22, 10, 1, M.white, { highlight: false });
      crt(b, 36, 6, 37, 'ny', { active: true, n: 1 });
      b.cyl(84, 18, 37, 4, 4, 1, M.dark);
      b.cyl(84, 18, 38, 3, 3, 3, M.yellow);
      b.box(68, 10, 37, 9, 13, 2, M.blue);
    },
  },
  table_magazines: {
    name: 'Mesita con revistas', W: 2, D: 1,
    art(b) {
      for (const [x, y] of [[5, 6], [55, 6], [5, 22], [55, 22]]) b.box(x, y, 0, 3, 3, 12, M.woodDark, { highlight: false });
      b.box(2, 4, 12, 60, 24, 3, M.wood);
      b.box(10, 10, 15, 14, 10, 1, M.red, { highlight: false });
      b.box(13, 12, 16, 14, 10, 1, M.blue, { highlight: false });
      b.box(38, 12, 15, 12, 10, 1, M.green, { highlight: false });
    },
  },
  plant: {
    name: 'Planta en maceta', W: 1, D: 1,
    art: (b) => plantArt(b),
  },
  plant_small: {
    name: 'Planta pequeña', W: 1, D: 1,
    art: (b) => plantArt(b, M.blue, 0.72),
  },
  table_oval: {
    name: 'Mesa ovalada', W: 4, D: 2,
    art(b) {
      b.cyl(64, 32, 0, 20, 14, 2, M.woodDark);
      b.cyl(64, 32, 2, 8, 8, 22, M.woodDark);
      b.cyl(64, 32, 24, 62, 30, 3, M.wood);
      b.cyl(64, 32, 27, 44, 18, 0, ['#fbdba2', '#fbdba2', '#fbdba2'], { stroke: null });
      b.box(28, 14, 27, 10, 7, 1, M.white, { highlight: false });
      b.box(86, 36, 27, 10, 7, 1, M.white, { highlight: false });
      b.cyl(64, 30, 27, 5, 5, 4, M.dark);
    },
  },
  projector: {
    name: 'Proyector', W: 1, D: 1, use: 'projector',
    frame: (f, t) => {
      const on = f.state.on !== false;
      return { k: on ? `on${speed(t, 3, 2)}` : 'off', on, n: speed(t, 3, 2) };
    },
    art(b, s) {
      b.box(7, 7, 0, 18, 18, 3, M.dark);
      b.box(14, 14, 3, 4, 4, 20, M.grey, { highlight: false });
      b.box(6, 6, 23, 20, 20, 3, M.woodDark);
      b.box(9, 8, 26, 14, 16, 8, M.white);
      // La lente mira a -x en la orientación por defecto (hacia la pantalla).
      b.face('nx', 5, 2, 6, 5, s.on ? '#fff6a0' : '#4a4e60');
      b.face('py', 2, 2, 3, 2, s.on ? (s.n ? '#7dff7d' : '#3ca13c') : '#a12d33');
      b.face('px', 3, 3, 8, 1, '#747a8b').face('px', 3, 5, 8, 1, '#747a8b');
    },
  },
  counter: {
    name: 'Encimera', W: 1, D: 1,
    art(b) {
      b.box(1, 2, 0, 30, 28, 26, M.cream);
      b.face('py', 2, 3, 26, 20, M.green[1]).face('py', 13, 3, 2, 20, M.cream[1]).face('py', 9, 12, 2, 4, M.yellow[1]).face('py', 17, 12, 2, 4, M.yellow[1]);
      b.box(0, 0, 26, 32, 32, 3, M.wood);
    },
  },
  counter_micro: {
    name: 'Encimera con microondas', W: 1, D: 1,
    frame: (f, t) => ({ k: speed(t, 1, 2), n: speed(t, 1, 2) }),
    art(b, s) {
      b.box(1, 2, 0, 30, 28, 26, M.cream);
      b.face('py', 2, 3, 26, 20, M.green[1]).face('py', 13, 3, 2, 20, M.cream[1]);
      b.box(0, 0, 26, 32, 32, 3, M.wood);
      b.box(3, 5, 29, 26, 21, 15, M.white);
      b.face('py', 2, 2, 16, 11, '#39405a').face('py', 20, 9, 4, 4, s.n ? '#7dff7d' : '#2f7a2f').face('py', 20, 3, 4, 4, M.grey[1]);
    },
  },
  sink: {
    name: 'Fregadero', W: 1, D: 1,
    art(b) {
      b.box(1, 2, 0, 30, 28, 26, M.cream);
      b.face('py', 2, 3, 26, 20, M.green[1]).face('py', 13, 3, 2, 20, M.cream[1]);
      b.box(0, 0, 26, 32, 32, 3, M.wood);
      b.top(6, 10, 20, 16, M.grey[2]).top(8, 12, 16, 12, M.grey[1]);
      b.box(14, 4, 29, 4, 4, 10, M.grey, { highlight: false });
      b.box(14, 8, 37, 4, 8, 2, M.grey, { highlight: false });
    },
  },
  basin: {
    name: 'Lavabo', W: 1, D: 1,
    art(b) {
      b.box(9, 6, 0, 14, 12, 22, M.white);
      b.cyl(16, 15, 22, 13, 11, 5, M.white);
      b.cyl(16, 16, 27, 9, 7, 0, ['#9fd8ee', '#9fd8ee', '#9fd8ee'], { stroke: null });
      b.box(14, 5, 27, 4, 3, 8, M.grey, { highlight: false });
      b.box(14, 8, 33, 4, 5, 2, M.grey, { highlight: false });
    },
  },
  coffee: {
    name: 'Cafetera', W: 1, D: 1, use: 'coffee', steam: [16, 12, 62],
    frame: (f, t) => {
      const brewing = f.state.mode === 'brew';
      const done = f.state.mode === 'done';
      const n = brewing ? speed(t, 8, 4) : speed(t, 1.5, 2);
      return { k: `${brewing ? 'b' : done ? 'd' : 'i'}${n}`, brewing, done, n };
    },
    art(b, s) {
      b.box(1, 2, 0, 30, 28, 26, M.cream);
      b.face('py', 2, 3, 26, 20, M.green[1]).face('py', 13, 3, 2, 20, M.cream[1]);
      b.box(0, 0, 26, 32, 32, 3, M.wood);
      b.box(4, 4, 29, 24, 20, 8, M.black);
      b.box(4, 4, 37, 24, 9, 16, M.red);
      b.face('py', 3, 5, 6, 6, s.brewing ? (s.n % 2 ? '#fff176' : '#ffb04a') : '#4a2222');
      b.face('py', 12, 5, 2, 2, s.n % 2 ? '#7dff7d' : '#3ca13c').face('py', 16, 5, 2, 2, s.brewing ? '#ff5a4a' : '#7d2a2a');
      b.box(4, 13, 37, 24, 11, 3, M.red);
      b.box(14, 15, 34, 4, 5, 3, M.dark, { highlight: false });
      b.box(6, 4, 53, 20, 16, 3, M.grey);
      if (s.brewing || s.done) {
        b.box(13, 17, 29, 6, 6, 5, M.white);
        if (s.brewing && s.n % 2) b.box(15, 19, 34, 2, 2, 3, ['#5a3218', '#5a3218', '#5a3218'], { stroke: null, highlight: false });
      }
    },
  },
  fridge: {
    name: 'Nevera', W: 1, D: 1, use: 'fridge',
    frame: (f) => ({ k: f.state.open ? 'o' : 'c', open: !!f.state.open }),
    art(b, s) {
      b.box(2, 2, 0, 28, 26, 78, M.white);
      if (s.open) {
        b.face('py', 2, 4, 24, 70, '#dff5ff').face('py', 2, 50, 24, 1, M.grey[1]);
        b.face('py', 2, 28, 24, 2, M.grey[1]).face('py', 5, 30, 5, 10, M.red[1]).face('py', 13, 30, 8, 7, M.yellow[1]);
        b.face('py', 5, 52, 6, 8, M.green[1]).face('py', 14, 52, 5, 12, M.orange[1]);
        b.box(26, 28, 2, 3, 22, 74, M.white);
      } else {
        b.face('py', 0, 52, 28, 1, M.grey[2]).face('py', 23, 56, 2, 12, M.grey[2]).face('py', 23, 34, 2, 14, M.grey[2]);
        b.face('py', 5, 22, 7, 7, M.yellow[0]).face('py', 8, 40, 9, 6, M.orange[0]);
      }
    },
  },
  vending: {
    name: 'Máquina expendedora', W: 1, D: 1, use: 'vending', shake: true,
    frame: (f, t) => {
      const mode = f.state.mode || '';
      const n = mode ? speed(t, 8, 4) : speed(t, 2, 4);
      return { k: `${mode}${n}`, mode, n };
    },
    art(b, s) {
      b.box(2, 3, 0, 28, 25, 80, M.orange);
      b.face('py', 3, 26, 17, 48, '#26324f');
      const cans = ['#f0635a', '#62aeee', '#8cdc62', '#ffe066'];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const lit = !(s.mode === 'vend' && r === 0 && c === 1);
          if (lit) b.face('py', 5 + c * 5, 30 + r * 11, 3, 7, cans[(r + c) % 4]);
        }
        b.face('py', 3, 29 + r * 11, 17, 1, M.grey[1]);
      }
      if (s.mode === 'vend') b.face('py', 10, 28 + (3 - s.n) * 12, 3, 7, cans[1]);
      b.face('py', 21, 62, 5, 12, '#ffe066');
      b.face('py', 22, 54, 3, 3, s.n === 0 ? '#ff5a4a' : '#7d2a2a').face('py', 22, 48, 3, 3, s.n === 1 ? '#7dff7d' : '#2f7a2f').face('py', 22, 42, 3, 3, s.n === 2 ? '#8fd5ff' : '#2d4f7d');
      b.face('py', 3, 8, 17, 12, '#1a1a2a');
      if (s.mode === 'vend' && s.n >= 2) b.face('py', 8, 9, 7, 5, cans[1]);
      b.face('py', 21, 8, 5, 12, M.orange[2]);
      b.face('px', 3, 8, 19, 64, M.yellow[2]);
      b.face('px', 6, 12, 13, 56, M.orange[2]);
    },
  },
  table_high: {
    name: 'Mesa alta', W: 2, D: 2,
    art(b) {
      b.cyl(32, 32, 0, 15, 15, 2, M.dark);
      b.box(29, 29, 2, 6, 6, 34, M.grey, { highlight: false });
      b.cyl(32, 32, 36, 28, 28, 3, M.wood);
      b.cyl(24, 30, 39, 3, 3, 5, M.white);
      b.cyl(40, 36, 39, 3, 3, 6, M.red);
    },
  },
  desk_big: {
    name: 'Escritorio de dirección', W: 3, D: 2, computer: true, frame: screenFrame,
    art(b, s) {
      b.box(2, 5, 0, 24, 54, 26, M.woodRed);
      b.box(70, 5, 0, 24, 54, 26, M.woodRed);
      for (const v of [3, 13]) {
        b.prims[b.prims.length - 2].decals.push({ side: 'py', u: 3, v, w: 18, h: 8, color: M.woodRed[0] });
        b.prims[b.prims.length - 1].decals.push({ side: 'py', u: 3, v, w: 18, h: 8, color: M.woodRed[0] });
      }
      b.box(26, 40, 4, 44, 3, 22, M.woodRed);
      b.box(0, 0, 26, 96, 64, 4, M.woodDark);
      crt(b, 36, 18, 30, 'ny', s);
      b.box(38, 4, 30, 22, 7, 1, M.grey, { highlight: false });
      b.box(70, 30, 30, 14, 18, 1, M.white, { highlight: false });
      b.box(72, 32, 31, 14, 18, 1, M.cream, { highlight: false });
      deskLamp(b, 16, 16, 30, M.green);
      b.box(8, 44, 30, 16, 10, 3, M.black);
      b.box(10, 46, 33, 12, 3, 2, M.dark, { highlight: false });
      b.box(40, 54, 30, 18, 3, 6, M.wood);
    },
  },
  bookshelf: {
    name: 'Estantería', W: 3, D: 1,
    art(b) {
      b.box(1, 3, 0, 94, 22, 92, M.woodDark);
      shelfBooks(b, 'py', 11, 94, [5, 28, 51, 72]);
      b.box(0, 2, 92, 96, 24, 3, M.woodRed);
    },
  },
  file_cabinet: {
    name: 'Archivador', W: 1, D: 1,
    art(b) {
      b.box(4, 4, 0, 24, 24, 50, M.grey);
      for (const v of [4, 19, 34]) b.face('py', 3, v, 18, 12, M.grey[0]).face('py', 9, v + 7, 6, 2, M.dark[2]);
      b.box(10, 10, 50, 12, 10, 4, M.yellow);
    },
  },
  water_cooler: {
    name: 'Fuente de agua', W: 1, D: 1,
    art(b) {
      b.box(8, 8, 0, 16, 16, 34, M.white);
      b.face('py', 2, 18, 12, 8, M.blue[1]).face('py', 4, 22, 2, 3, M.red[0]).face('py', 10, 22, 2, 3, M.blue[0]);
      b.cyl(16, 16, 34, 9, 9, 22, ['#bfe8ff', '#8fd5ff', '#62aeee']);
    },
  },
  rug_round: {
    name: 'Alfombra redonda', W: 4, D: 4, flat: true,
    art(b) {
      b.cyl(64, 64, 0, 62, 62, 0, M.orange);
      b.cyl(64, 64, 0, 50, 50, 0, M.cream, { stroke: null });
      b.cyl(64, 64, 0, 44, 44, 0, M.green, { stroke: null });
      b.cyl(64, 64, 0, 28, 28, 0, M.yellow, { stroke: null });
      b.cyl(64, 64, 0, 14, 14, 0, M.orange, { stroke: null });
    },
  },
  rug_mat: {
    name: 'Alfombra de entrada', W: 3, D: 2, flat: true,
    art(b) {
      b.box(2, 2, 0, 92, 60, 0, M.red);
      b.top(6, 6, 80, 48, M.cream[1]).top(9, 9, 74, 42, M.red[1]);
    },
  },
  tv: {
    name: 'Televisor', W: 2, D: 1, use: 'tv',
    frame: (f, t) => {
      const channel = f.state.channel || 0;
      const n = speed(t, channel === 3 ? 10 : 4, 8);
      return { k: `${channel}:${n}`, channel, n };
    },
    art(b, s) {
      b.box(3, 4, 0, 58, 24, 18, M.woodDark);
      b.face('py', 3, 3, 24, 11, M.woodRed[2]).face('py', 31, 3, 24, 11, M.woodRed[2]);
      b.box(12, 6, 18, 40, 20, 32, M.dark);
      const u = 3;
      const v = 4;
      const w = 28;
      const h = 24;
      b.face('py', u - 1, v - 1, w + 2, h + 2, OUTLINE);
      if (s.channel === 0) {
        // Barras de color.
        const bars = ['#ffffff', '#ffe066', '#58cdbb', '#8cdc62', '#f28de0', '#f0635a', '#62aeee'];
        bars.forEach((c, i) => b.face('py', u + i * 4, v + 5, 4, h - 5, c));
        b.face('py', u, v, w, 5, '#26324f');
        b.face('py', u + (s.n * 3) % w, v + 1, 3, 3, '#ffffff');
      } else if (s.channel === 1) {
        // Dibujos: cielo, sol y una bola que salta.
        b.face('py', u, v, w, h, '#62aeee');
        b.face('py', u, v, w, 6, '#58b645');
        b.face('py', u + 21, v + 16, 5, 5, '#ffe066');
        b.face('py', u + 2 + s.n * 3, v + 6 + [0, 4, 7, 9, 9, 7, 4, 0][s.n], 4, 4, '#f0635a');
      } else if (s.channel === 2) {
        // Noticiario.
        b.face('py', u, v, w, h, '#2d63ad');
        b.face('py', u + 9, v + 8, 10, 10, '#ffd8a8');
        b.face('py', u + 9, v + 15, 10, 4, '#3a2a1e');
        b.face('py', u + 7, v + 5, 14, 3, '#f0635a');
        b.face('py', u, v, w, 5, '#fff3d3');
        b.face('py', u + ((s.n * 4) % 20), v + 2, 8, 1, '#2d63ad');
      } else {
        // Nieve.
        b.face('py', u, v, w, h, '#555566');
        for (let i = 0; i < 26; i++) {
          const r = hash(i * 13 + s.n * 101);
          b.face('py', u + r % (w - 1), v + (r >> 8) % (h - 1), 2, 1, (r >> 16) % 2 ? '#ffffff' : '#2a2a3a');
        }
      }
      b.box(30, 12, 50, 4, 4, 2, M.black);
      b.custom(32, 14, 52, 14, (p, sx, sy) => {
        p.line(sx, sy, sx - 9, sy - 13, OUTLINE);
        p.line(sx, sy, sx + 9, sy - 13, OUTLINE);
      });
    },
  },
  arcade: {
    name: 'Máquina recreativa', W: 1, D: 1, use: 'arcade',
    frame: (f, t) => {
      const playing = f.state.mode === 'play';
      const n = playing ? speed(t, 10, 16) : speed(t, 3, 16);
      return { k: `${playing ? 'p' : 'i'}${n}`, playing, n };
    },
    art(b, s) {
      b.box(3, 5, 0, 26, 21, 82, M.purple);
      b.face('py', 3, 70, 20, 9, M.yellow[0]);
      const label = [2, 4, 6, 8, 10, 12, 14, 16];
      label.forEach((u) => b.face('py', 3 + u, 72, 1, 5, s.n % 8 === u / 2 - 1 ? '#f0635a' : '#cc611a'));
      b.face('py', 2, 40, 22, 27, OUTLINE);
      b.face('py', 3, 41, 20, 25, '#101a33');
      // Minijuego propio: una nave que esquiva bloques.
      const n = s.n;
      for (let i = 0; i < 5; i++) {
        const r = hash(i * 17);
        const y = (r % 22) - ((n * (s.playing ? 2 : 1)) % 22);
        b.face('py', 5 + (r >> 5) % 15, 42 + ((y + 44) % 22), 3, 2, ['#f0635a', '#8cdc62', '#ffe066'][i % 3]);
      }
      b.face('py', 6 + (n % 8 > 3 ? 8 - (n % 8) : n % 8) * 3, 44, 4, 3, '#8fd5ff');
      b.face('py', 4, 8, 18, 16, M.purple[2]).face('py', 11, 13, 4, 6, '#ffe066');
      b.face('px', 3, 10, 15, 56, M.orange[1]).face('px', 6, 14, 9, 48, M.yellow[1]);
      b.box(3, 24, 26, 26, 11, 8, M.dark);
      b.top(5, 3, 3, 3, '#e0524a').top(14, 3, 3, 3, '#ffe066').top(20, 3, 3, 3, '#8cdc62');
      b.box(8, 27, 34, 2, 2, 6, M.grey, { highlight: false });
      b.box(7, 26, 40, 4, 4, 3, M.red, { highlight: false });
    },
  },
  lamp_floor: {
    name: 'Lámpara de pie', W: 1, D: 1,
    art(b) {
      b.cyl(16, 16, 0, 8, 8, 3, M.dark);
      b.box(15, 15, 3, 2, 2, 60, M.dark, { highlight: false });
      b.cyl(16, 16, 63, 12, 12, 14, M.yellow);
    },
  },
  stall: {
    name: 'Cabina de baño', W: 2, D: 2, fixed: true, use: 'stall', layered: true,
    frame: (f) => {
      const door = f.state.door || 0;
      const step = door < 0.25 ? 0 : door < 0.75 ? 1 : 2;
      const busy = !!f.state.occupant;
      return { k: `${step}${busy ? 'b' : 'f'}`, step, busy };
    },
    art(b, s) {
      // Parte trasera: detrás de quien entra.
      b.box(0, 0, 4, 3, 58, 68, M.stall);
      b.box(3, 0, 4, 58, 3, 68, M.stall);
      b.box(26, 3, 12, 12, 6, 16, M.white);
      b.cyl(32, 19, 0, 7, 9, 10, M.white);
      b.cyl(32, 19, 10, 8, 10, 2, M.grey);
      b.setLayer('over');
      b.box(61, 0, 4, 3, 58, 68, M.stall);
      b.box(0, 58, 0, 12, 3, 72, M.stall);
      b.box(52, 58, 0, 12, 3, 72, M.stall);
      b.box(12, 58, 62, 40, 3, 10, M.stall);
      b.face('py', 14, 2, 12, 6, OUTLINE);
      b.face('py', 15, 3, 10, 4, s.busy ? '#ff4a3f' : '#6dff6d');
      if (s.step === 0) {
        b.box(12, 59, 4, 40, 2, 58, M.orange);
        b.face('py', 34, 26, 3, 5, OUTLINE);
      } else if (s.step === 1) {
        b.quad([[12, 60, 62], [36, 84, 62], [36, 84, 4], [12, 60, 4]], M.orange[1]);
      } else {
        b.box(11, 60, 4, 2, 38, 58, M.orange);
      }
      b.setLayer('main');
    },
  },
};

export const STORABLE_ORDER = [
  'plant', 'plant_small', 'pouf_orange', 'pouf_green', 'pouf_blue', 'chair_swivel', 'chair_swivel_green', 'chair_meet',
  'stool', 'lamp_floor', 'water_cooler', 'file_cabinet', 'paper_boxes', 'copier', 'rug_round', 'rug_mat', 'table_magazines', 'sofa',
  'desk_work', 'chair_exec', 'table_high', 'bookshelf', 'tv', 'arcade', 'counter', 'counter_micro', 'sink',
  'basin', 'fridge', 'vending', 'coffee', 'projector', 'desk_big', 'table_oval', 'counter_reception',
];

export function footprint(type, rot) {
  const c = CATALOG[type];
  return rotatedSize(c.W, c.D, rot);
}

// Asiento en coordenadas de sala, teniendo en cuenta el giro del mueble.
export function seatInRoom(f, index) {
  const c = CATALOG[f.type];
  const s = c.seats[index];
  const [lx, ly] = rotatePoint(s.x, s.y, c.W, c.D, f.rot);
  return { x: f.x + lx, y: f.y + ly, z: s.z, dir: (s.dir + f.rot) & 3 };
}

// Hacia dónde mira el frontal del mueble (su +y local) una vez girado.
export function frontDir(f) {
  return (1 + f.rot) & 3;
}
