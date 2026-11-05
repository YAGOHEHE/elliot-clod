// Estado completo de la oficina: salas, avatares, inventario y guardado.
// No toca el DOM, así que también se puede simular en pruebas.
import { Avatar } from './avatars/avatar.js';
import { NPC_DEFS, ROUTINES, continueWorking, npcLife } from './avatars/npc.js';
import { DEFAULT_LOOK } from './avatars/sprite.js';
import { CATALOG, footprint, seatInRoom } from './furniture/catalog.js';
import { ROOM_DEFS, STARTING_STOCK } from './map/rooms.js';
import { Room, makeFurniture } from './map/tilemap.js';

const SAVE_KEY = 'elliot-clod-oficina-v1';
const OLD_SAVE_KEY = 'baldosa-oficina-v1';

export class World {
  constructor(storage = null) {
    this.storage = storage;
    this.rooms = {};
    for (const def of ROOM_DEFS) this.rooms[def.id] = new Room(def);
    this.roomOrder = ROOM_DEFS.map((d) => d.id);
    this.avatars = [];
    this.time = 0;
    this.view = 'recepcion';
    this.wipeHalf = 0.28;
    this.wipeT = -1;
    this.listeners = new Map();
    this.inventory = { items: { cafe: 0, lata: 0 }, furniture: { ...STARTING_STOCK } };
    this.routes = new Map();
    this.editing = false;
    this.createPlayer();
    this.load();
    this.createNpcs();
  }

  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
  }

  emit(name, data) {
    for (const fn of this.listeners.get(name) || []) fn(data);
  }

  room(id) {
    return this.rooms[id];
  }

  get viewRoom() {
    return this.rooms[this.view];
  }

  createPlayer() {
    this.player = new Avatar({
      name: 'Tú',
      look: { ...DEFAULT_LOOK },
      room: 'recepcion',
      x: 5.5,
      y: 4.5,
      isPlayer: true,
    });
    this.player.dir = 1;
    this.avatars.push(this.player);
  }

  createNpcs() {
    for (const def of NPC_DEFS) {
      const startRoom = def.start === 'seat' ? def.homeRoom : def.startRoom;
      const [sx, sy] = def.startAt || [1, 1];
      const av = new Avatar({
        name: def.name,
        look: def.look,
        room: startRoom,
        x: sx + 0.5,
        y: sy + 0.5,
        role: def.role,
        home: { room: def.homeRoom, chair: def.home },
      });
      av.job = def.job;
      this.avatars.push(av);
      let first = null;
      if (def.start === 'seat') {
        const chair = this.rooms[def.homeRoom].byId(def.home);
        if (chair && !chair.sitters[0]) {
          const seat = seatInRoom(chair, 0);
          chair.sitters[0] = av;
          av.seat = { furn: chair, index: 0 };
          av.x = seat.x;
          av.y = seat.y;
          av.dir = seat.dir;
          av.pose = 'sit';
          first = continueWorking;
        } else {
          const r = this.rooms[def.homeRoom];
          const spot = r.nearestTo(r.doors[0].inner.x, r.doors[0].inner.y, 3, 3);
          av.x = spot.x + 0.5;
          av.y = spot.y + 0.5;
        }
      }
      if (!first && def.start === 'walk') {
        first = def.startRoom === 'chill' ? ROUTINES.chill : def.startRoom === 'cocina' ? ROUTINES.coffee : ROUTINES.wander;
      }
      av.run(npcLife(this, av, first));
    }
  }

  // Ruta entre salas (BFS sobre el grafo de puertas), memorizada.
  nextDoorTowards(from, to) {
    const key = `${from}>${to}`;
    if (this.routes.has(key)) return this.rooms[from].door(this.routes.get(key));
    const seen = new Set([from]);
    const queue = [{ room: from, first: null }];
    while (queue.length) {
      const cur = queue.shift();
      for (const door of this.rooms[cur.room].doors) {
        if (seen.has(door.to)) continue;
        seen.add(door.to);
        const first = cur.first || door.id;
        if (door.to === to) {
          this.routes.set(key, first);
          return this.rooms[from].door(first);
        }
        queue.push({ room: door.to, first });
      }
    }
    return null;
  }

  // Quien está parado (sin sentar ni escondido) ocupa su baldosa.
  idleAvatarAt(roomId, x, y, except) {
    for (const a of this.avatars) {
      if (a === except || a.room !== roomId || a.walking || a.hidden || a.seat || a.inStall) continue;
      if (Math.floor(a.x) === x && Math.floor(a.y) === y) return a;
    }
    return null;
  }

  anyAvatarAt(roomId, x, y) {
    for (const a of this.avatars) {
      if (a.room === roomId && !a.hidden && Math.floor(a.x) === x && Math.floor(a.y) === y) return a;
    }
    return null;
  }

  occupantsOf(roomId) {
    return this.avatars.filter((a) => a.room === roomId);
  }

  tick(dt) {
    this.time += dt;
    if (this.wipeT >= 0) {
      this.wipeT += dt;
      if (this.wipeT > this.wipeHalf * 2) this.wipeT = -1;
    }
    for (const id of this.roomOrder) {
      const room = this.rooms[id];
      for (const f of room.furniture) {
        if (CATALOG[f.type].computer) f.state.active = false;
        if (f.type === 'stall') this.tickStall(f, dt);
      }
      for (const w of room.wall) {
        if (w.kind === 'window') {
          const s = w.state;
          if (Math.abs(s.blinds - s.target) > 0.01) {
            s.blinds += Math.sign(s.target - s.blinds) * Math.min(dt * 1.6, Math.abs(s.target - s.blinds));
          }
        }
      }
    }
    for (const a of this.avatars) {
      a.tick(dt);
      if (a.typingAt) a.typingAt.state.active = true;
    }
    for (const id of this.roomOrder) {
      for (const door of this.rooms[id].doors) this.tickDoor(id, door, dt);
    }
  }

  tickDoor(roomId, door, dt) {
    let near = (door.holds || 0) > 0;
    if (!near) {
      for (const a of this.avatars) {
        if (a.room === roomId && Math.hypot(a.x - door.pos.x, a.y - door.pos.y) < 1.15) {
          near = true;
          break;
        }
      }
    }
    door.open = Math.max(0, Math.min(1, door.open + (near ? dt * 4 : -dt * 3)));
  }

  tickStall(f, dt) {
    const s = f.state;
    s.door = s.door || 0;
    const target = s.doorTarget || 0;
    if (s.door < target) s.door = Math.min(target, s.door + dt * 3.5);
    if (s.door > target) s.door = Math.max(target, s.door - dt * 3.5);
  }

  startWipe() {
    this.wipeT = 0;
  }

  showRoom(id) {
    this.view = id;
    this.emit('room', id);
  }

  gainItem(av, item) {
    if (!av.isPlayer) return;
    this.inventory.items[item] = (this.inventory.items[item] || 0) + 1;
    this.emit('inventory');
    this.save();
  }

  // ----- Muebles -----

  isOccupiedTile(roomId) {
    return (x, y) => !!this.anyAvatarAt(roomId, x, y);
  }

  canPlace(roomId, type, x, y, rot, ignore) {
    const room = this.rooms[roomId];
    const skip = (tx, ty) => {
      const a = this.anyAvatarAt(roomId, tx, ty);
      if (!a) return false;
      // Quien está sentado en el propio mueble no cuenta aquí: eso se valida aparte.
      return true;
    };
    return room.canPlace(type, x, y, rot, ignore, skip);
  }

  isInUse(f) {
    return f.sitters.some(Boolean) || !!f.state.user || !!f.state.occupant;
  }

  moveFurniture(roomId, f, x, y, rot) {
    const room = this.rooms[roomId];
    const r = this.canPlace(roomId, f.type, x, y, rot, f);
    if (!r.ok) return r;
    f.x = x;
    f.y = y;
    f.rot = rot;
    room.rebuild();
    this.emit('layout', roomId);
    this.save();
    return { ok: true };
  }

  storeFurniture(roomId, f) {
    const room = this.rooms[roomId];
    room.furniture = room.furniture.filter((o) => o !== f);
    room.rebuild();
    this.inventory.furniture[f.type] = (this.inventory.furniture[f.type] || 0) + 1;
    this.emit('layout', roomId);
    this.emit('inventory');
    this.save();
  }

  placeFromInventory(roomId, type, x, y, rot) {
    const r = this.canPlace(roomId, type, x, y, rot, null);
    if (!r.ok) return r;
    if (!this.inventory.furniture[type]) return { ok: false, reason: 'No te quedan' };
    const room = this.rooms[roomId];
    const f = makeFurniture({ type, x, y, rot });
    room.furniture.push(f);
    room.rebuild();
    this.inventory.furniture[type]--;
    this.emit('layout', roomId);
    this.emit('inventory');
    this.save();
    return { ok: true, furniture: f };
  }

  resetLayout() {
    // Todos de pie y a empezar de nuevo, sin dejar a nadie en una silla que ya no existe.
    for (const a of this.avatars) {
      a.locked = false;
      a.stopRoutine();
      a.seat = null;
      a.typingAt = null;
      a.pose = 'stand';
      a.walking = false;
    }
    for (const def of ROOM_DEFS) {
      const room = this.rooms[def.id];
      room.furniture = def.furniture.map(makeFurniture);
      room.rebuild();
      for (const door of room.doors) door.holds = 0;
    }
    this.inventory.furniture = { ...STARTING_STOCK };
    for (const a of this.avatars) {
      const r = this.rooms[a.room];
      const t = r.nearestTo(r.doors[0].inner.x, r.doors[0].inner.y, Math.floor(a.x), Math.floor(a.y));
      if (t && !r.isFree(Math.floor(a.x), Math.floor(a.y))) {
        a.x = t.x + 0.5;
        a.y = t.y + 0.5;
      }
      if (!a.isPlayer) a.run(npcLife(this, a));
    }
    for (const id of this.roomOrder) this.emit('layout', id);
    this.emit('inventory');
    this.save();
  }

  // ----- Guardado -----

  save() {
    if (!this.storage) return;
    const layouts = {};
    for (const id of this.roomOrder) {
      layouts[id] = this.rooms[id].furniture.map((f) => ({ type: f.type, x: f.x, y: f.y, rot: f.rot, id: f.id }));
    }
    const data = {
      name: this.player.name,
      look: this.player.look,
      inventory: this.inventory,
      layouts,
    };
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Sin espacio o sin permiso: el juego sigue sin guardar.
    }
  }

  load() {
    if (!this.storage) return;
    let data = null;
    try {
      data = JSON.parse(this.storage.getItem(SAVE_KEY) || 'null');
      if (!data) {
        // Partida de antes del cambio de empresa: conserva tu avatar y tus bebidas,
        // pero no la distribución antigua, para que se vean los muebles nuevos.
        const old = JSON.parse(this.storage.getItem(OLD_SAVE_KEY) || 'null');
        if (old) data = { name: old.name, look: old.look, inventory: { items: old.inventory?.items, furniture: { ...STARTING_STOCK } } };
      }
    } catch {
      return;
    }
    if (!data) return;
    if (typeof data.name === 'string' && data.name) this.player.name = data.name.slice(0, 16);
    if (data.look) this.player.look = { ...DEFAULT_LOOK, ...data.look };
    if (data.inventory) {
      this.inventory.items = { ...this.inventory.items, ...data.inventory.items };
      this.inventory.furniture = { ...data.inventory.furniture };
    }
    if (data.layouts) {
      for (const id of this.roomOrder) {
        const saved = data.layouts[id];
        if (!Array.isArray(saved)) continue;
        const room = this.rooms[id];
        const valid = saved.filter((s) => {
          if (!CATALOG[s.type]) return false;
          const [fw, fh] = footprint(s.type, s.rot || 0);
          return s.x >= 0 && s.y >= 0 && s.x + fw <= room.w && s.y + fh <= room.h;
        });
        room.furniture = valid.map(makeFurniture);
        room.rebuild();
      }
    }
  }
}
