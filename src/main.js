// Arranque: monta el mundo, el renderizador, la entrada y la interfaz, y lanza el bucle.
import '@fontsource/vt323/400.css';
import './ui/styles.css';
import { useStall } from './avatars/routines.js';
import * as actions from './interaction/actions.js';
import { Editor } from './interaction/editor.js';
import { Input } from './interaction/input.js';
import { Renderer } from './render/renderer.js';
import { el } from './ui/dom.js';
import { Panels } from './ui/panels.js';
import { Toolbar } from './ui/toolbar.js';
import { World } from './world.js';

function safeStorage() {
  try {
    const probe = '__baldosa__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const canvas = document.getElementById('stage');
const toastRoot = document.getElementById('toasts');

function toast(message, seconds = 4) {
  const node = el('div', { class: 'toast' }, message);
  toastRoot.append(node);
  while (toastRoot.children.length > 1) toastRoot.firstChild.remove();
  setTimeout(() => node.remove(), seconds * 1000);
}

const world = new World(safeStorage());
const renderer = new Renderer(canvas, world);
const editor = new Editor(world, toast);
renderer.editor = editor;
new Input(canvas, world, renderer, editor);

let toolbar = null;
const panels = new Panels({
  root: document.getElementById('panels'),
  world,
  editor,
  toast,
  onLookChange: () => toolbar && toolbar.refreshPortrait(),
});
toolbar = new Toolbar({
  root: document.getElementById('toolbar'),
  hud: document.getElementById('hud'),
  world,
  renderer,
  editor,
  panels,
  toast,
});

// El lienzo reserva el sitio de la barra para no tapar la sala con ella.
function measureChrome() {
  const bar = document.getElementById('toolbar').getBoundingClientRect();
  const top = document.querySelector('.hud-top').getBoundingClientRect();
  renderer.setReserved(Math.ceil(top.height * 0.2), Math.ceil(bar.height));
}

const relayout = () => {
  renderer.resize();
  measureChrome();
};
window.addEventListener('resize', relayout);
window.visualViewport?.addEventListener('resize', relayout);
window.addEventListener('orientationchange', relayout);
if (window.ResizeObserver) new ResizeObserver(measureChrome).observe(document.getElementById('toolbar'));
measureChrome();

// Atajos de teclado.
window.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
  if (e.key === 'Escape') {
    if (panels.open) panels.closeAll();
    else if (editor.active) toolbar.toggleEdit();
    else if (typing) document.activeElement.blur();
    return;
  }
  if (typing) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    toolbar.input.focus();
  } else if (editor.active && (e.key === 'r' || e.key === 'R')) {
    editor.rotate();
  }
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.tick(dt);
  renderer.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

toast('Toca una baldosa para caminar. Prueba con sillas, la fotocopiadora o habla con un compañero…', 6);

// Punto de acceso para depurar y para las pruebas automáticas.
window.oficina = { world, renderer, editor, actions: { ...actions, useStallForTests: useStall } };
