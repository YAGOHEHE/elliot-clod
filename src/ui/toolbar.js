// Barra inferior retro (chat, inventario, mapa, edición), placa de sala, zoom y barra de edición.
import { playerChat } from '../interaction/actions.js';
import { avatarPortrait } from '../avatars/sprite.js';
import { clear, el } from './dom.js';
import { iconElement } from './icons.js';

function toolButton(id, label, icon, onClick, extra = {}) {
  return el(
    'button',
    { type: 'button', class: `tool-btn ${extra.class || ''}`, id, title: extra.title || label, on: { click: onClick } },
    typeof icon === 'string' ? iconElement(icon) : icon,
    el('span', { class: 'tool-label' }, label),
  );
}

export function portraitCanvas(look, size = 28) {
  const src = avatarPortrait(look);
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 24;
  c.getContext('2d').drawImage(src, -8, -2);
  c.className = 'px-icon';
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  c.setAttribute('aria-hidden', 'true');
  return c;
}

export class Toolbar {
  constructor({ root, hud, world, renderer, editor, panels, toast }) {
    this.world = world;
    this.renderer = renderer;
    this.editor = editor;
    this.panels = panels;
    this.toast = toast;

    // --- Barra inferior ---
    this.input = el('input', {
      id: 'chat-input',
      type: 'text',
      maxLength: 120,
      placeholder: 'Escribe un mensaje…',
      autocomplete: 'off',
      enterKeyHint: 'send',
      'aria-label': 'Mensaje de chat',
    });
    const form = el(
      'form',
      {
        class: 'chat-form',
        on: {
          submit: (e) => {
            e.preventDefault();
            this.sendChat();
          },
        },
      },
      this.input,
      el('button', { type: 'submit', class: 'tool-btn send-btn', id: 'chat-send', title: 'Enviar', 'aria-label': 'Enviar mensaje' }, iconElement('send')),
    );

    this.avatarSlot = el('span', { class: 'avatar-slot' });
    this.refreshPortrait();
    const buttons = el(
      'div',
      { class: 'tool-row' },
      toolButton('btn-avatar', 'Avatar', this.avatarSlot, () => panels.toggle('avatar')),
      toolButton('btn-inventory', 'Inventario', 'bag', () => panels.toggle('inventory')),
      toolButton('btn-map', 'Mapa', 'map', () => panels.toggle('map')),
      toolButton('btn-edit', 'Editar', 'hammer', () => this.toggleEdit()),
    );
    root.append(el('div', { class: 'bar' }, form, buttons));

    // --- Placa de sala y zoom ---
    this.roomName = el('strong', {}, '');
    this.roomCount = el('span', { class: 'room-count' }, '');
    this.plate = el('div', { class: 'room-plate' }, this.roomName, this.roomCount);
    const zoom = el(
      'div',
      { class: 'zoom-box' },
      el('button', { type: 'button', class: 'tool-btn square', id: 'zoom-out', title: 'Alejar', 'aria-label': 'Alejar', on: { click: () => renderer.zoom(-1) } }, iconElement('minus', 1.5)),
      el('button', { type: 'button', class: 'tool-btn square', id: 'zoom-in', title: 'Acercar', 'aria-label': 'Acercar', on: { click: () => renderer.zoom(1) } }, iconElement('plus', 1.5)),
    );

    // --- Barra del modo edición ---
    this.editHint = el('span', { class: 'edit-hint' }, '');
    this.editBar = el(
      'div',
      { class: 'edit-bar', hidden: true },
      el('strong', {}, 'Modo edición'),
      this.editHint,
      el(
        'div',
        { class: 'edit-actions' },
        toolButton('edit-confirm', 'Colocar', 'check', () => editor.confirmPlacing(), { class: 'only-placing' }),
        toolButton('edit-rotate', 'Girar', 'rotate', () => editor.rotate()),
        toolButton('edit-store', 'Guardar', 'box', () => editor.store()),
        toolButton('edit-reset', 'Restaurar', 'reset', () => this.resetLayout()),
        toolButton('edit-done', 'Listo', 'check', () => this.toggleEdit()),
      ),
    );
    hud.append(el('div', { class: 'hud-top' }, this.plate, zoom), this.editBar);

    // Rótulo inferior de falso documental: quién habla, o en qué sala estamos.
    this.thirdName = el('strong', {}, '');
    this.thirdJob = el('span', {}, '');
    this.lowerThird = el('div', { class: 'lower-third', hidden: true }, this.thirdName, this.thirdJob);
    hud.append(this.lowerThird);
    world.on('interview', ({ name, job }) => this.showLowerThird(name, job));

    editor.onChange(() => this.refreshEdit());
    world.on('room', () => {
      this.refreshRoom();
      this.showLowerThird(world.viewRoom.name, 'Elliot Clod');
    });
    this.refreshRoom();
    setInterval(() => this.refreshRoom(), 1000);
  }

  showLowerThird(title, subtitle) {
    this.thirdName.textContent = title;
    this.thirdJob.textContent = subtitle;
    this.lowerThird.hidden = false;
    clearTimeout(this.thirdTimer);
    this.thirdTimer = setTimeout(() => {
      this.lowerThird.hidden = true;
    }, 3500);
  }

  refreshPortrait() {
    clear(this.avatarSlot);
    this.avatarSlot.append(portraitCanvas(this.world.player.look, 24));
  }

  refreshRoom() {
    const room = this.world.viewRoom;
    this.roomName.textContent = room.name;
    const n = this.world.occupantsOf(room.id).length;
    this.roomCount.textContent = `${n} ${n === 1 ? 'persona' : 'personas'}`;
  }

  sendChat() {
    const text = this.input.value;
    if (!text.trim()) return;
    playerChat(this.world, text);
    this.input.value = '';
    if (matchMedia('(pointer: coarse)').matches) this.input.blur();
  }

  toggleEdit() {
    const editor = this.editor;
    if (editor.active) editor.exit();
    else {
      editor.enter();
      this.panels.closeAll();
      this.toast('Arrastra un mueble para moverlo. Tócalo para seleccionarlo y girarlo.');
    }
    this.refreshEdit();
  }

  refreshEdit() {
    const { editor } = this;
    this.editBar.hidden = !editor.active;
    document.getElementById('btn-edit')?.classList.toggle('pressed', editor.active);
    document.body.classList.toggle('editing', editor.active);
    const placing = editor.ghost && editor.ghost.source === 'stock';
    this.editBar.classList.toggle('placing', !!placing);
    if (placing) {
      this.editHint.textContent = editor.ghost.valid ? 'Elige dónde ponerlo.' : editor.ghost.reason || 'Aquí no cabe.';
    } else if (editor.selected) {
      this.editHint.textContent = 'Arrástralo, gíralo o guárdalo.';
    } else {
      this.editHint.textContent = 'Toca un mueble.';
    }
  }

  resetLayout() {
    if (window.confirm('¿Devolver todas las salas a su distribución original?')) {
      this.editor.clear();
      this.world.resetLayout();
      this.toast('Salas restauradas.');
    }
  }
}
