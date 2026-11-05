// Modo edición: seleccionar, arrastrar, girar y guardar muebles sobre la cuadrícula.
import { CATALOG, footprint } from '../furniture/catalog.js';

export class Editor {
  constructor(world, toast) {
    this.world = world;
    this.toast = toast;
    this.active = false;
    this.selected = null;
    this.ghost = null; // { type, x, y, rot, valid, source: 'room' | 'stock', reason }
    this.grab = { x: 0, y: 0 };
    this.listeners = [];
    world.on('room', () => this.clear());
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  changed() {
    for (const fn of this.listeners) fn();
  }

  get room() {
    return this.world.viewRoom;
  }

  enter() {
    this.active = true;
    this.world.editing = true;
    this.clear();
  }

  exit() {
    this.active = false;
    this.world.editing = false;
    this.clear();
  }

  clear() {
    this.selected = null;
    this.ghost = null;
    this.changed();
  }

  // Colocar algo del inventario: aparece un fantasma que sigue al puntero.
  startPlacing(type) {
    const room = this.room;
    const [fw, fh] = footprint(type, 0);
    const x = Math.max(0, Math.floor((room.w - fw) / 2));
    const y = Math.max(0, Math.floor((room.h - fh) / 2));
    this.selected = null;
    this.ghost = { type, x, y, rot: 0, source: 'stock', valid: false };
    this.validateGhost();
    this.changed();
  }

  validateGhost() {
    const g = this.ghost;
    if (!g) return;
    const ignore = g.source === 'room' ? this.selected : null;
    const r = this.world.canPlace(this.room.id, g.type, g.x, g.y, g.rot, ignore);
    g.valid = r.ok;
    g.reason = r.reason;
  }

  moveGhost(tile) {
    const g = this.ghost;
    if (!g) return;
    const [fw, fh] = footprint(g.type, g.rot);
    const room = this.room;
    const x = Math.max(0, Math.min(room.w - fw, tile.x - this.grab.x));
    const y = Math.max(0, Math.min(room.h - fh, tile.y - this.grab.y));
    if (x !== g.x || y !== g.y) {
      g.x = x;
      g.y = y;
      this.validateGhost();
    }
  }

  // Un toque o clic en modo edición.
  pointerDown(target, tile) {
    // Con un mueble del inventario en la mano, el toque decide dónde va.
    if (this.ghost && this.ghost.source === 'stock') {
      this.grab = { x: 0, y: 0 };
      this.moveGhost(tile);
      this.dragging = true;
      return;
    }
    if (target && target.type && CATALOG[target.type]) {
      const f = target;
      if (CATALOG[f.type].fixed) {
        this.toast('Esta pieza está fijada al edificio.');
        this.selected = null;
        this.changed();
        return;
      }
      this.selected = f;
      this.changed();
      if (this.world.isInUse(f)) {
        this.dragging = false;
        return;
      }
      this.grab = { x: tile.x - f.x, y: tile.y - f.y };
      this.pendingDrag = { start: tile };
      return;
    }
    // Baldosa vacía con un mueble seleccionado: llevarlo allí.
    if (this.selected && tile && this.room.inside(tile.x, tile.y)) {
      const f = this.selected;
      if (this.world.isInUse(f)) {
        this.toast('Hay alguien usándolo. Espera un momento.');
        return;
      }
      const r = this.world.moveFurniture(this.room.id, f, tile.x, tile.y, f.rot);
      if (!r.ok) this.toast(r.reason);
      this.changed();
      return;
    }
    this.selected = null;
    this.changed();
  }

  pointerMove(tile) {
    if (this.pendingDrag) {
      const f = this.selected;
      if (f && (tile.x !== this.pendingDrag.start.x || tile.y !== this.pendingDrag.start.y)) {
        this.ghost = { type: f.type, x: f.x, y: f.y, rot: f.rot, source: 'room', valid: true };
        this.pendingDrag = null;
        this.dragging = true;
        this.moveGhost(tile);
      }
      return;
    }
    if (this.ghost && (this.dragging || this.ghost.source === 'stock')) this.moveGhost(tile);
  }

  pointerUp() {
    this.pendingDrag = null;
    const g = this.ghost;
    if (!g || !this.dragging) {
      this.dragging = false;
      return;
    }
    this.dragging = false;
    if (!g.valid) {
      this.toast(g.reason || 'Aquí no cabe.');
      if (g.source === 'room') this.ghost = null;
      this.changed();
      return;
    }
    if (g.source === 'room') {
      const f = this.selected;
      const r = this.world.moveFurniture(this.room.id, f, g.x, g.y, g.rot);
      if (!r.ok) this.toast(r.reason);
      this.ghost = null;
    } else {
      const r = this.world.placeFromInventory(this.room.id, g.type, g.x, g.y, g.rot);
      if (!r.ok) this.toast(r.reason);
      else {
        this.selected = r.furniture;
        this.ghost = null;
      }
    }
    this.changed();
  }

  rotate() {
    const g = this.ghost;
    if (g) {
      g.rot = (g.rot + 1) & 3;
      const [fw, fh] = footprint(g.type, g.rot);
      g.x = Math.min(g.x, this.room.w - fw);
      g.y = Math.min(g.y, this.room.h - fh);
      this.validateGhost();
      this.changed();
      return;
    }
    const f = this.selected;
    if (!f) {
      this.toast('Selecciona primero un mueble.');
      return;
    }
    if (this.world.isInUse(f)) {
      this.toast('Hay alguien usándolo. Espera un momento.');
      return;
    }
    // Probamos los siguientes giros hasta dar con uno que quepa.
    for (let i = 1; i < 4; i++) {
      const rot = (f.rot + i) & 3;
      const r = this.world.moveFurniture(this.room.id, f, f.x, f.y, rot);
      if (r.ok) {
        this.changed();
        return;
      }
    }
    this.toast('No hay sitio para girarlo aquí.');
  }

  store() {
    if (this.ghost && this.ghost.source === 'stock') {
      this.ghost = null;
      this.changed();
      return;
    }
    const f = this.selected;
    if (!f) {
      this.toast('Selecciona primero un mueble.');
      return;
    }
    if (this.world.isInUse(f)) {
      this.toast('Hay alguien usándolo. Espera un momento.');
      return;
    }
    this.world.storeFurniture(this.room.id, f);
    this.toast(`${CATALOG[f.type].name}: guardado en el inventario.`);
    this.selected = null;
    this.changed();
  }

  // Confirmar la colocación pendiente con un botón (cómodo en móvil).
  confirmPlacing() {
    const g = this.ghost;
    if (!g || g.source !== 'stock') return;
    this.dragging = true;
    this.pointerUp();
  }
}
