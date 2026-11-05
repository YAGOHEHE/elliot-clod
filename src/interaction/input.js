// Entrada por ratón y toque: clic para caminar o usar, arrastrar para mover la vista,
// pellizco y rueda para hacer zoom. En modo edición los toques van al editor.
import { interviewLine } from '../avatars/npc.js';
import { CATALOG } from '../furniture/catalog.js';
import {
  commandDoor, commandFurniture, commandWalk, commandWave, commandWindow, hintFor, isInteractive,
} from './actions.js';

const DRAG_PX = 8;

export class Input {
  constructor(canvas, world, renderer, editor) {
    this.canvas = canvas;
    this.world = world;
    this.renderer = renderer;
    this.editor = editor;
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.cancel(e));
    canvas.addEventListener('pointerleave', () => this.leave());
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  art(e) {
    return this.renderer.toArt(e.clientX, e.clientY);
  }

  down(e) {
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      this.drag = null;
      return;
    }
    const p = this.art(e);
    this.drag = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, art: p };
    if (this.editor.active) {
      const target = this.renderer.pick(p.x, p.y);
      const tile = this.renderer.screenTile(p.x, p.y);
      this.editor.pointerDown(target && target.look ? null : target, tile);
      this.drag.editing = this.editor.dragging || !!this.editor.pendingDrag;
    }
  }

  move(e) {
    const known = this.pointers.get(e.pointerId);
    if (known) {
      known.x = e.clientX;
      known.y = e.clientY;
    }
    const p = this.art(e);
    this.renderer.pointerArt = p;

    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > this.pinch.dist * 1.35) {
        this.renderer.zoom(1);
        this.pinch.dist = dist;
      } else if (dist < this.pinch.dist / 1.35) {
        this.renderer.zoom(-1);
        this.pinch.dist = dist;
      }
      return;
    }

    if (this.drag) {
      const total = Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY);
      if (this.drag.editing) {
        if (total > 2) this.editor.pointerMove(this.renderer.screenTile(p.x, p.y));
        return;
      }
      if (total > DRAG_PX) this.drag.moved = true;
      if (this.drag.moved) {
        const scale = this.canvas.width / this.canvas.getBoundingClientRect().width;
        this.renderer.panBy((e.clientX - this.drag.lastX) * scale, (e.clientY - this.drag.lastY) * scale);
        this.drag.lastX = e.clientX;
        this.drag.lastY = e.clientY;
      }
      return;
    }

    if (this.editor.active && this.editor.ghost && e.pointerType === 'mouse') {
      this.editor.pointerMove(this.renderer.screenTile(p.x, p.y));
    }
    if (e.pointerType === 'mouse') this.updateHover(p);
  }

  up(e) {
    const hadPinch = !!this.pinch;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (hadPinch) {
      this.drag = null;
      return;
    }
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    if (this.editor.active) {
      if (drag.editing) this.editor.pointerUp();
      return;
    }
    if (drag.moved) return;
    this.click(this.art(e));
  }

  cancel(e) {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    this.drag = null;
    this.editor.pendingDrag = null;
  }

  leave() {
    this.renderer.hover = null;
    this.renderer.hoverHint = '';
    this.renderer.pointerArt = null;
  }

  wheel(e) {
    e.preventDefault();
    this.wheelSum = (this.wheelSum || 0) + e.deltaY;
    if (Math.abs(this.wheelSum) > 80) {
      this.renderer.zoom(this.wheelSum < 0 ? 1 : -1);
      this.wheelSum = 0;
    }
  }

  // Qué hay bajo un punto: sprite (por píxel), luego pared y umbrales, luego baldosa.
  resolve(p) {
    const room = this.world.viewRoom;
    const sprite = this.renderer.pick(p.x, p.y);
    if (sprite && (isInteractive(sprite) || !sprite.look)) {
      if (isInteractive(sprite)) return { target: sprite };
      // Mueble sin uso: si tapa una baldosa libre, se camina a esa baldosa (las que
      // quedan detrás de algo alto siguen siendo accesibles); si no, hasta el mueble.
      const behind = this.renderer.screenTile(p.x, p.y);
      if (room.isFree(behind.x, behind.y)) return { tile: behind };
      return { target: sprite, passive: true };
    }
    const wall = this.renderer.pickWall(p.x, p.y);
    if (wall) {
      if (wall.door) return { target: { door: wall.door, toName: this.world.room(wall.door.to).name } };
      return { target: wall };
    }
    const tile = this.renderer.screenTile(p.x, p.y);
    if (room.inside(tile.x, tile.y)) return { tile };
    return {};
  }

  updateHover(p) {
    if (this.editor.active) {
      const target = this.renderer.pick(p.x, p.y);
      this.renderer.hover = null;
      const movable = target && target.type && !CATALOG[target.type].fixed;
      this.renderer.hoverHint = movable ? CATALOG[target.type].name : '';
      this.canvas.style.cursor = movable ? 'grab' : 'default';
      return;
    }
    const hit = this.resolve(p);
    const room = this.world.viewRoom;
    const interactive = hit.target && isInteractive(hit.target);
    this.renderer.hover = {
      target: hit.target || null,
      tile: hit.tile && room.isFree(hit.tile.x, hit.tile.y) ? hit.tile : null,
    };
    this.renderer.hoverHint = hit.target ? hintFor(hit.target) : '';
    this.canvas.style.cursor = interactive || (hit.tile && room.isFree(hit.tile.x, hit.tile.y)) ? 'pointer' : 'default';
  }

  click(p) {
    const world = this.world;
    const hit = this.resolve(p);
    this.renderer.resetPan();
    if (hit.target) {
      const t = hit.target;
      if (t.door) {
        commandDoor(world, t.door);
        return;
      }
      if (t.windowItem) {
        commandWindow(world, t.windowItem);
        return;
      }
      if (t.look) {
        if (t.isPlayer) commandWave(world, t);
        else {
          // Mini entrevista de falso documental: gira hacia cámara, con su rótulo debajo.
          if (!t.seat && !t.walking && !t.locked && t.dir >= 2) t.dir = 1;
          t.say(interviewLine());
          world.emit('interview', { name: t.name, job: t.job || 'Empleado de Elliot Clod' });
        }
        return;
      }
      const tile = this.renderer.screenTile(p.x, p.y);
      commandFurniture(world, t, tile.fx, tile.fy);
      return;
    }
    if (hit.tile) commandWalk(world, hit.tile.x, hit.tile.y);
  }
}
