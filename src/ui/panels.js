// Ventanas flotantes: inventario, mapa de salas y personalización del avatar.
import { CLOTHES, HAIRS, HAIR_STYLES, SKINS, TOP_STYLES, avatarSprite } from '../avatars/sprite.js';
import { CATALOG, STORABLE_ORDER } from '../furniture/catalog.js';
import { furnitureIcon } from '../furniture/sprites.js';
import { commandDrink, commandTravel } from '../interaction/actions.js';
import { createCanvas, hexToRgb } from '../core/raster.js';
import { FLOOR_STYLES } from '../render/floors.js';
import { clear, el } from './dom.js';
import { iconElement } from './icons.js';

const CONSUMABLES = {
  cafe: { name: 'Café', hint: 'De la cafetera de la cocina', draw: 'cup' },
  lata: { name: 'Lata', hint: 'De la máquina expendedora', draw: 'can' },
};

function thumb(type, size = 56) {
  const sprite = furnitureIcon(type).c;
  const w = sprite.width;
  const h = sprite.height;
  const data = sprite.getContext('2d').getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const scale = Math.min(size / bw, size / bh, 1);
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const dw = Math.round(bw * scale);
  const dh = Math.round(bh * scale);
  ctx.drawImage(sprite, minX, minY, bw, bh, Math.floor((size - dw) / 2), size - dh, dw, dh);
  c.className = 'px-icon';
  return c;
}

function consumableIcon(kind) {
  const c = createCanvas(16, 16);
  const g = c.getContext('2d');
  if (kind === 'cup') {
    g.fillStyle = '#2b1b33';
    g.fillRect(2, 4, 10, 10);
    g.fillRect(12, 6, 3, 6);
    g.fillStyle = '#fbf9f0';
    g.fillRect(3, 5, 8, 8);
    g.fillRect(12, 7, 2, 4);
    g.fillStyle = '#5a3218';
    g.fillRect(3, 5, 8, 2);
    g.fillStyle = '#c9c4b4';
    g.fillRect(9, 7, 2, 6);
  } else {
    g.fillStyle = '#2b1b33';
    g.fillRect(4, 1, 8, 14);
    g.fillStyle = '#3f85d2';
    g.fillRect(5, 2, 6, 12);
    g.fillStyle = '#c2c6cf';
    g.fillRect(5, 2, 6, 2);
    g.fillStyle = '#fff3d3';
    g.fillRect(5, 7, 6, 3);
    g.fillStyle = '#2d63ad';
    g.fillRect(10, 4, 1, 10);
  }
  c.className = 'px-icon';
  c.style.width = '32px';
  c.style.height = '32px';
  return c;
}

export class Panels {
  constructor({ root, world, editor, toast, onLookChange }) {
    this.root = root;
    this.world = world;
    this.editor = editor;
    this.toast = toast;
    this.onLookChange = onLookChange;
    this.open = null;
    world.on('inventory', () => {
      if (this.open === 'inventory') this.render();
    });
    setInterval(() => {
      if (this.open === 'map') this.render();
    }, 1500);
    world.on('room', () => {
      if (this.open === 'map') this.render();
    });
  }

  toggle(name) {
    if (this.open === name) this.closeAll();
    else {
      this.open = name;
      // Los avisos no deben tapar la ventana que se acaba de abrir.
      clear(document.getElementById('toasts'));
      this.render();
    }
    this.syncButtons();
  }

  closeAll() {
    this.open = null;
    clear(this.root);
    this.syncButtons();
  }

  syncButtons() {
    const map = { inventory: 'btn-inventory', map: 'btn-map', avatar: 'btn-avatar' };
    for (const [panel, id] of Object.entries(map)) {
      document.getElementById(id)?.classList.toggle('pressed', this.open === panel);
    }
  }

  frame(title, body, cls = '') {
    return el(
      'section',
      { class: `window ${cls}`, 'aria-label': title },
      el(
        'header',
        { class: 'window-title' },
        el('h2', {}, title),
        el('button', { type: 'button', class: 'close-btn', title: 'Cerrar', 'aria-label': 'Cerrar', on: { click: () => this.closeAll() } }, iconElement('close', 1.5)),
      ),
      el('div', { class: 'window-body' }, body),
    );
  }

  render() {
    const scroll = this.root.querySelector('.window-body')?.scrollTop || 0;
    clear(this.root);
    if (this.open === 'inventory') this.root.append(this.renderInventory());
    if (this.open === 'map') this.root.append(this.renderMap());
    if (this.open === 'avatar') this.root.append(this.renderAvatar());
    const body = this.root.querySelector('.window-body');
    if (body) body.scrollTop = scroll;
  }

  // ----- Inventario -----

  renderInventory() {
    const { inventory } = this.world;
    const drinks = Object.entries(CONSUMABLES).map(([id, info]) => {
      const n = inventory.items[id] || 0;
      return el(
        'li',
        { class: 'drink-row' },
        consumableIcon(info.draw),
        el('div', { class: 'drink-info' }, el('strong', {}, `${info.name} × ${n}`), el('small', {}, info.hint)),
        el(
          'button',
          {
            type: 'button',
            class: 'tool-btn small',
            disabled: n === 0,
            on: {
              click: () => {
                commandDrink(this.world, id);
                this.closeAll();
              },
            },
          },
          'Tomar',
        ),
      );
    });

    const owned = STORABLE_ORDER.filter((t) => (inventory.furniture[t] || 0) > 0);
    const cells = owned.map((type) =>
      el(
        'button',
        {
          type: 'button',
          class: 'furn-cell',
          title: `Colocar: ${CATALOG[type].name}`,
          on: { click: () => this.placeFromStock(type) },
        },
        thumb(type),
        el('span', { class: 'furn-count' }, `×${inventory.furniture[type]}`),
        el('span', { class: 'furn-name' }, CATALOG[type].name),
      ),
    );
    return this.frame(
      'Inventario',
      [
        el('h3', {}, 'Para tomar'),
        el('ul', { class: 'drink-list' }, drinks),
        el('h3', {}, 'Muebles en el almacén'),
        cells.length
          ? el('div', { class: 'furn-grid' }, cells)
          : el('p', { class: 'muted' }, 'No hay muebles guardados. En modo edición puedes guardar los de la sala.'),
      ],
      'win-inventory',
    );
  }

  placeFromStock(type) {
    const { editor } = this;
    if (!editor.active) {
      document.getElementById('btn-edit')?.click();
    }
    editor.startPlacing(type);
    this.closeAll();
    this.toast(`Toca una baldosa para colocar: ${CATALOG[type].name}.`);
  }

  // ----- Mapa de salas -----

  renderMap() {
    const { world } = this;
    const rooms = world.roomOrder.map((id) => world.room(id));
    const cols = Math.max(...rooms.map((r) => r.plan.col)) + 1;
    const rows = Math.max(...rooms.map((r) => r.plan.row)) + 1;
    const grid = el('div', { class: 'map-grid', style: { '--cols': cols, '--rows': rows } });
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--rows', rows);

    for (const room of rooms) {
      const count = world.occupantsOf(room.id).length;
      const here = world.player.room === room.id;
      const floor = FLOOR_STYLES[room.floor];
      const [fr, fg, fb] = hexToRgb(floor.a);
      const lightFloor = 0.299 * fr + 0.587 * fg + 0.114 * fb > 170;
      const cell = el(
        'button',
        {
          type: 'button',
          class: `map-room ${here ? 'here' : ''} ${lightFloor ? 'on-light' : ''}`,
          id: `map-${room.id}`,
          style: { gridColumn: room.plan.col + 1, gridRow: room.plan.row + 1, background: floor.a },
          title: here ? `Estás en ${room.name}` : `Ir a ${room.name}`,
          on: {
            click: () => {
              if (!here) commandTravel(world, room.id);
              this.closeAll();
            },
          },
        },
        el('strong', {}, room.short),
        el('span', {}, here ? 'Aquí estás' : `${count} ${count === 1 ? 'persona' : 'personas'}`),
      );
      grid.append(cell);
    }

    // Conexiones entre salas, a mitad del lado que comparten.
    const seen = new Set();
    for (const room of rooms) {
      for (const door of room.doors) {
        const pair = [room.id, door.to].sort().join('-');
        if (seen.has(pair)) continue;
        seen.add(pair);
        const other = world.room(door.to);
        const mx = (room.plan.col + other.plan.col + 1) / 2 / cols;
        const my = (room.plan.row + other.plan.row + 1) / 2 / rows;
        const horizontal = room.plan.row === other.plan.row;
        grid.append(
          el('i', {
            class: `map-door ${horizontal ? 'h' : 'v'}`,
            style: { left: `${mx * 100}%`, top: `${my * 100}%` },
          }),
        );
      }
    }
    return this.frame(
      'Mapa de salas',
      [el('p', { class: 'muted' }, 'Elige una sala y tu avatar irá andando, cruzando las puertas.'), grid],
      'win-map',
    );
  }

  // ----- Avatar -----

  renderAvatar() {
    const { world } = this;
    const pl = world.player;
    const update = (key, value) => {
      pl.look = { ...pl.look, [key]: value };
      world.save();
      this.onLookChange();
      this.render();
    };

    const preview = createCanvas(40, 68);
    const dir = this.previewDir || 0;
    preview.getContext('2d').drawImage(avatarSprite(pl.look, dir, 'stand', 0), 0, 0);
    preview.className = 'px-icon avatar-preview';

    const swatches = (label, key, palette) =>
      el(
        'div',
        { class: 'option-row' },
        el('span', { class: 'option-label' }, label),
        el(
          'div',
          { class: 'swatches' },
          palette.map((tones, i) =>
            el('button', {
              type: 'button',
              class: `swatch ${pl.look[key] === i ? 'selected' : ''}`,
              style: { background: tones[1] },
              title: `${label} ${i + 1}`,
              'aria-label': `${label} ${i + 1}`,
              'aria-pressed': pl.look[key] === i ? 'true' : 'false',
              on: { click: () => update(key, i) },
            }),
          ),
        ),
      );

    const choices = (label, key, list) =>
      el(
        'div',
        { class: 'option-row' },
        el('span', { class: 'option-label' }, label),
        el(
          'div',
          { class: 'choices' },
          list.map((item) =>
            el(
              'button',
              {
                type: 'button',
                class: `choice ${pl.look[key] === item.id ? 'selected' : ''}`,
                'aria-pressed': pl.look[key] === item.id ? 'true' : 'false',
                on: { click: () => update(key, item.id) },
              },
              item.name,
            ),
          ),
        ),
      );

    const nameInput = el('input', {
      type: 'text',
      id: 'avatar-name',
      maxLength: 16,
      value: pl.name,
      'aria-label': 'Tu nombre',
      on: {
        change: (e) => {
          pl.name = e.target.value.trim() || 'Tú';
          world.save();
        },
      },
    });

    return this.frame(
      'Tu avatar',
      el(
        'div',
        { class: 'avatar-editor' },
        el(
          'div',
          { class: 'avatar-stage' },
          preview,
          el(
            'button',
            {
              type: 'button',
              class: 'tool-btn small',
              on: {
                click: () => {
                  this.previewDir = (dir + 1) & 3;
                  this.render();
                },
              },
            },
            iconElement('rotate', 1),
            ' Girar',
          ),
        ),
        el(
          'div',
          { class: 'avatar-options' },
          el('label', { class: 'option-row' }, el('span', { class: 'option-label' }, 'Nombre'), nameInput),
          swatches('Piel', 'skin', SKINS),
          choices('Peinado', 'hairStyle', HAIR_STYLES),
          swatches('Pelo', 'hair', HAIRS),
          choices('Prenda', 'topStyle', TOP_STYLES),
          swatches('Parte de arriba', 'top', CLOTHES),
          swatches('Pantalón', 'bottom', CLOTHES),
          swatches('Zapatos', 'shoes', CLOTHES),
        ),
      ),
      'win-avatar',
    );
  }
}
