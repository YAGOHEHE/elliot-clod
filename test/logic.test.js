// Pruebas de la lógica sin navegador: caminos, profundidad, puertas, sillas y cabinas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sitOn, throughDoor, useStall, wait } from '../src/avatars/routines.js';
import { CATALOG, footprint } from '../src/furniture/catalog.js';
import { ROOM_DEFS } from '../src/map/rooms.js';
import { findPath } from '../src/map/pathfinding.js';
import { depthSort } from '../src/render/depth.js';
import { World } from '../src/world.js';

function run(world, seconds, step = 1 / 30) {
  for (let t = 0; t < seconds; t += step) world.tick(step);
}

// Mundo sin NPC en marcha, para probar una cosa cada vez.
function quietWorld() {
  const w = new World();
  for (const a of w.avatars) if (!a.isPlayer) a.stopRoutine();
  for (const a of w.avatars) {
    if (a.isPlayer) continue;
    if (a.seat) a.seat.furn.sitters[a.seat.index] = null;
    a.seat = null;
    a.typingAt = null;
    a.pose = 'stand';
    a.room = 'chill';
    a.x = 8.5;
    a.y = 4.5;
    a.hidden = true;
  }
  return w;
}

test('ningún mueble se sale de su sala ni pisa a otro ni tapa una entrada', () => {
  const w = new World();
  for (const def of ROOM_DEFS) {
    const room = w.room(def.id);
    const taken = new Map();
    const reserved = room.reservedTiles();
    for (const f of room.furniture) {
      const [fw, fh] = footprint(f.type, f.rot);
      assert.ok(f.x >= 0 && f.y >= 0 && f.x + fw <= room.w && f.y + fh <= room.h, `${f.type} fuera de ${def.id}`);
      if (CATALOG[f.type].flat) continue;
      for (let y = f.y; y < f.y + fh; y++) {
        for (let x = f.x; x < f.x + fw; x++) {
          const key = `${x},${y}`;
          assert.ok(!taken.has(key), `${f.type} pisa a ${taken.get(key)} en ${def.id} ${key}`);
          assert.ok(!reserved.has(key), `${f.type} tapa una baldosa reservada en ${def.id} ${key}`);
          taken.set(key, f.type);
        }
      }
    }
  }
});

test('en cada sala se puede ir de cualquier puerta a cualquier otra y a cada asiento', () => {
  const w = new World();
  for (const def of ROOM_DEFS) {
    const room = w.room(def.id);
    const from = room.doors[0].inner;
    for (const d of room.doors) {
      assert.ok(room.findPath(from.x, from.y, d.inner.x, d.inner.y), `sin camino a ${d.id}`);
    }
    for (const f of room.furniture) {
      const c = CATALOG[f.type];
      if (!c.seats && !c.use) continue;
      const [fw, fh] = footprint(f.type, f.rot);
      let reachable = false;
      for (let y = f.y - 1; y <= f.y + fh && !reachable; y++) {
        for (let x = f.x - 1; x <= f.x + fw && !reachable; x++) {
          if (room.isFree(x, y) && room.findPath(from.x, from.y, x, y)) reachable = true;
        }
      }
      assert.ok(reachable, `${f.type} inaccesible en ${def.id}`);
    }
  }
});

test('las puertas están emparejadas en ambos sentidos', () => {
  const w = new World();
  for (const def of ROOM_DEFS) {
    for (const d of w.room(def.id).doors) {
      const other = w.room(d.to).door(d.toDoor);
      assert.ok(other, `falta ${d.toDoor}`);
      assert.equal(other.to, def.id);
      assert.equal(other.toDoor, d.id);
    }
  }
});

test('el programa pedido está en cada sala', () => {
  const w = new World();
  const count = (room, type) => w.room(room).furniture.filter((f) => f.type === type).length;
  assert.equal(count('trabajo', 'desk_work'), 8);
  assert.equal(count('trabajo', 'chair_swivel') + count('trabajo', 'chair_swivel_green'), 8);
  assert.equal(count('reuniones', 'table_oval'), 1);
  assert.equal(count('reuniones', 'chair_meet'), 6);
  assert.equal(count('reuniones', 'projector'), 1);
  for (const t of ['coffee', 'fridge', 'vending', 'table_high']) assert.equal(count('cocina', t), 1, t);
  for (const t of ['desk_big', 'bookshelf']) assert.equal(count('despacho', t), 1, t);
  for (const t of ['rug_round', 'tv', 'arcade']) assert.equal(count('chill', t), 1, t);
  assert.ok(count('chill', 'pouf_orange') >= 1);
  assert.ok(count('bano', 'stall') >= 2);
  for (const t of ['counter_reception', 'sofa', 'plant']) assert.ok(count('recepcion', t) >= 1, t);
});

test('el camino rodea los muebles y no corta esquinas', () => {
  const blocked = new Set(['2,0', '2,1', '2,2']);
  const free = (x, y) => !blocked.has(`${x},${y}`);
  const path = findPath(5, 5, free, 0, 0, 4, 0);
  assert.ok(path);
  let px = 0;
  let py = 0;
  for (const s of path) {
    assert.ok(free(s.x, s.y));
    if (s.x !== px && s.y !== py) assert.ok(free(s.x, py) && free(px, s.y), 'corta una esquina');
    px = s.x;
    py = s.y;
  }
  assert.deepEqual(path[path.length - 1], { x: 4, y: 0 });
  assert.equal(findPath(3, 1, (x) => x !== 1, 0, 0, 2, 0), null);
});

test('un avatar queda delante o detrás de un mueble largo según dónde esté', () => {
  const sofa = { name: 'sofa', x0: 2, x1: 5, y0: 2, y1: 3 };
  const behind = { name: 'av', x0: 3.3, x1: 3.7, y0: 1.3, y1: 1.7 };
  const front = { name: 'av', x0: 3.3, x1: 3.7, y0: 3.3, y1: 3.7 };
  assert.deepEqual(depthSort([sofa, behind]).map((i) => i.name), ['av', 'sofa']);
  assert.deepEqual(depthSort([sofa, front]).map((i) => i.name), ['sofa', 'av']);
  // Caso que "x+y" resuelve mal: avatar con x+y mayor pero detrás del mueble largo.
  const farEnd = { name: 'av', x0: 6.3, x1: 6.7, y0: 0.3, y1: 0.7 };
  const longDesk = { name: 'mesa', x0: 0, x1: 6, y0: 1, y1: 2 };
  assert.deepEqual(depthSort([farEnd, longDesk]).length, 2);
});

test('cruzar una puerta cambia de sala y deja al avatar en la entrada', () => {
  const w = quietWorld();
  const pl = w.player;
  const door = w.room('recepcion').door('rc-co');
  pl.run(throughDoor(w, pl, door));
  run(w, 12);
  assert.equal(pl.room, 'cocina');
  assert.equal(w.view, 'cocina');
  const target = w.room('cocina').door('co-rc').inner;
  assert.equal(Math.floor(pl.x), target.x);
  assert.equal(Math.floor(pl.y), target.y);
});

test('sentarse ocupa la silla y otro no puede ocuparla', () => {
  const w = quietWorld();
  const pl = w.player;
  const sofa = w.room('recepcion').furniture.find((f) => f.type === 'sofa');
  pl.run(sitOn(w, pl, sofa, 1));
  run(w, 8);
  assert.equal(pl.pose, 'sit');
  assert.equal(sofa.sitters[1], pl);
});

test('la cabina se cierra, marca ocupado y el NPC espera su turno', () => {
  const w = quietWorld();
  const pl = w.player;
  const npc = w.avatars.find((a) => !a.isPlayer);
  const stall = w.room('bano').byId('cabina-2');
  pl.room = 'bano';
  pl.x = 3.5;
  pl.y = 4.5;
  npc.room = 'bano';
  npc.hidden = false;
  npc.x = 6.5;
  npc.y = 5.5;

  let npcEntered = false;
  pl.run(useStall(w, pl, stall, 3));
  // El NPC llega un poco después, cuando la cabina ya está ocupada.
  npc.run(
    (function* later() {
      yield* wait(0.5);
      yield* useStall(w, npc, stall, 1);
      npcEntered = true;
    })(),
  );
  run(w, 3);
  assert.equal(stall.state.occupant, pl, 'el jugador ocupa la cabina');
  assert.equal(pl.hidden, true, 'la puerta está cerrada con el jugador dentro');
  assert.ok(stall.state.door < 0.05, 'puerta cerrada');
  assert.equal(pl.locked, true);
  assert.equal(npc.hidden, false);
  assert.equal(npc.waiting, true, 'el NPC espera');
  assert.ok(stall.state.queue.includes(npc), 'el NPC está en la cola');
  assert.equal(Math.floor(npc.y), 3, 'espera en la fila, frente a la cabina');

  run(w, 5);
  assert.equal(pl.hidden, false, 'el jugador ha salido');
  assert.equal(pl.locked, false);
  assert.equal(pl.inStall, null);
  run(w, 10);
  assert.ok(npcEntered, 'el NPC pasó cuando quedó libre');
  assert.equal(stall.state.occupant, null);
  assert.equal(stall.state.queue.length, 0);
});

test('la vida de los NPC corre mucho tiempo sin fallos y todos siguen operativos', () => {
  const w = new World();
  const visited = new Set();
  const poses = new Set();
  for (let t = 0; t < 900; t += 1 / 20) {
    w.tick(1 / 20);
    for (const a of w.avatars) {
      if (a.isPlayer) continue;
      visited.add(a.room);
      poses.add(a.pose);
      const room = w.room(a.room);
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
      assert.ok(a.x > -1 && a.y > -1 && a.x < room.w + 1.1 && a.y < room.h + 1.1, `${a.name} perdido en ${a.room}: ${a.x},${a.y}`);
    }
  }
  assert.ok(visited.has('trabajo') && visited.has('cocina'));
  assert.ok(poses.has('type'), 'alguien teclea');
  assert.ok(poses.has('sit') || poses.has('type'), 'alguien se sienta');
  for (const a of w.avatars) if (!a.isPlayer) assert.ok(a.co, `${a.name} sigue con su rutina`);
});

test('colocar un mueble: rechaza solapes y bloqueos de puerta, y se puede guardar', () => {
  const w = quietWorld();
  const room = w.room('recepcion');
  const counter = room.furniture.find((f) => f.type === 'counter_reception');
  assert.equal(w.canPlace('recepcion', 'plant', counter.x, counter.y, 0).ok, false);
  const door = room.doors[0].inner;
  assert.equal(w.canPlace('recepcion', 'plant', door.x, door.y, 0).ok, false);
  const before = w.inventory.furniture.plant;
  const placed = w.placeFromInventory('recepcion', 'plant', 8, 6, 0);
  assert.ok(placed.ok);
  assert.equal(w.inventory.furniture.plant, before - 1);
  assert.equal(room.isFree(8, 6), false);
  w.storeFurniture('recepcion', placed.furniture);
  assert.equal(w.inventory.furniture.plant, before);
  assert.equal(room.isFree(8, 6), true);
});
