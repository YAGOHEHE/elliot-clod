// Iconos de la interfaz en pixel art propio: mapas de caracteres que se convierten a lienzo.
// # contorno oscuro · o color principal · + color secundario · . claro
import { createCanvas } from '../core/raster.js';

const COLORS = { '#': '#2b1b33', o: '#f2832a', '+': '#58b645', '.': '#fff3d3', x: '#3f85d2', r: '#cf423f', w: '#ffffff', g: '#989eac' };

const ICONS = {
  send: [
    '............',
    '.##.........',
    '.#o##.......',
    '.#ooo##.....',
    '.#ooooo##...',
    '.#oooooo.##.',
    '.#oooooo.##.',
    '.#ooooo##...',
    '.#ooo##.....',
    '.#o##.......',
    '.##.........',
    '............',
  ],
  bag: [
    '....####....',
    '...#....#...',
    '...#....#...',
    '.##########.',
    '#oooooooooo#',
    '#oooo##oooo#',
    '#oooo..oooo#',
    '#oooo##oooo#',
    '#oooooooooo#',
    '#oooooooooo#',
    '.##########.',
    '............',
  ],
  map: [
    '############',
    '#++#xxxx#oo#',
    '#++#xxxx#oo#',
    '#++.xxxx.oo#',
    '#++#xxxx#oo#',
    '####.#######',
    '#gg#.....oo#',
    '#gg.+++++oo#',
    '#gg#+++++oo#',
    '#gg#+++++oo#',
    '############',
    '............',
  ],
  hammer: [
    '..#######...',
    '.#ooooooo##.',
    '.#ooooooooo#',
    '.#ooooooo##.',
    '..###+####..',
    '....#+#.....',
    '....#+#.....',
    '....#+#.....',
    '....#+#.....',
    '....#+#.....',
    '....###.....',
    '............',
  ],
  plus: [
    '............',
    '....####....',
    '....#ww#....',
    '....#ww#....',
    '.####ww####.',
    '.#wwwwwwww#.',
    '.#wwwwwwww#.',
    '.####ww####.',
    '....#ww#....',
    '....#ww#....',
    '....####....',
    '............',
  ],
  minus: [
    '............',
    '............',
    '............',
    '............',
    '.##########.',
    '.#wwwwwwww#.',
    '.#wwwwwwww#.',
    '.##########.',
    '............',
    '............',
    '............',
    '............',
  ],
  rotate: [
    '...#####....',
    '..#+++++#.#.',
    '.#+#####+##.',
    '#+#....#+++#',
    '#+#....#####',
    '#+#.........',
    '#+#.........',
    '#+#....#+#..',
    '.#+#####+#..',
    '..#+++++#...',
    '...#####....',
    '............',
  ],
  box: [
    '.##########.',
    '#oooooooooo#',
    '############',
    '#oooo..oooo#',
    '#oooo..oooo#',
    '#oooooooooo#',
    '#oooooooooo#',
    '#oooooooooo#',
    '#oooooooooo#',
    '#oooooooooo#',
    '.##########.',
    '............',
  ],
  check: [
    '............',
    '.........###',
    '........#++#',
    '.......#++#.',
    '##....#++#..',
    '#+#..#++#...',
    '#++##++#....',
    '.#++++#.....',
    '..#++#......',
    '...##.......',
    '............',
    '............',
  ],
  close: [
    '............',
    '.##......##.',
    '.#r#....#r#.',
    '..#r#..#r#..',
    '...#r##r#...',
    '....#rr#....',
    '....#rr#....',
    '...#r##r#...',
    '..#r#..#r#..',
    '.#r#....#r#.',
    '.##......##.',
    '............',
  ],
  reset: [
    '..#.........',
    '.##.#####...',
    '#oo#ooooo#..',
    '.##.####oo#.',
    '..#.....#o#.',
    '........#o#.',
    '........#o#.',
    '.#o#....#o#.',
    '.#oo####oo#.',
    '..#oooooo#..',
    '...######...',
    '............',
  ],
};

export function iconElement(name, scale = 2) {
  const rows = ICONS[name];
  const c = createCanvas(12, 12);
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      // El punto es transparente, salvo en los iconos que lo usan como detalle claro.
      if (ch === '.' && !OPAQUE_DOT.has(name)) return;
      if (!COLORS[ch]) return;
      ctx.fillStyle = COLORS[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  c.className = 'px-icon';
  c.style.width = `${12 * scale}px`;
  c.style.height = `${12 * scale}px`;
  c.setAttribute('aria-hidden', 'true');
  return c;
}

const OPAQUE_DOT = new Set(['map']);
