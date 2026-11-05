// Órdenes del jugador: traducen un clic o un botón a una rutina del avatar.
import {
  approach, freeSeatIndex, goToRoom, sitOn, standUp, startTyping, throughDoor, useArcade, useCoffee, useCopier, useFridge,
  useProjector, useStall, useTv, useVending, useWindow, wait, walkTo,
} from '../avatars/routines.js';
import { CATALOG } from '../furniture/catalog.js';

const USES = {
  coffee: useCoffee,
  copier: useCopier,
  vending: useVending,
  fridge: useFridge,
  arcade: useArcade,
  tv: useTv,
  projector: useProjector,
  stall: useStall,
};

const HINTS = {
  coffee: 'Preparar un café',
  copier: 'Hacer fotocopias',
  vending: 'Sacar una lata',
  fridge: 'Abrir la nevera',
  arcade: 'Jugar una partida',
  tv: 'Cambiar de canal',
  projector: 'Encender o apagar',
  stall: 'Usar la cabina',
};

export function hintFor(target) {
  if (!target) return '';
  if (target.door) return `Ir a: ${target.toName}`;
  if (target.windowItem) return 'Subir o bajar la persiana';
  if (target.name && target.look) return ''; // avatar: se muestra su nombre sobre la cabeza
  const c = CATALOG[target.type];
  if (!c) return '';
  if (c.use === 'stall') return target.state.occupant ? 'Ocupada: esperar turno' : HINTS.stall;
  if (c.use) return HINTS[c.use];
  if (c.seats) return `Sentarse: ${c.name}`;
  return c.name;
}

export function isInteractive(target) {
  if (!target) return false;
  if (target.door || target.windowItem) return true;
  if (target.look) return true;
  const c = CATALOG[target.type];
  return !!(c && (c.use || c.seats));
}

function clearDestination(world) {
  world.player.destination = null;
}

export function commandWalk(world, x, y) {
  const pl = world.player;
  const room = world.room(pl.room);
  let target = { x, y };
  const blocked = !room.isFree(x, y) || world.idleAvatarAt(pl.room, x, y, pl);
  if (blocked) {
    const sx = Math.max(0, Math.min(room.w - 1, Math.floor(pl.x)));
    const sy = Math.max(0, Math.min(room.h - 1, Math.floor(pl.y)));
    target = room.nearestTo(sx, sy, x, y);
    if (!target) return;
  }
  pl.destination = { x: target.x, y: target.y, room: pl.room };
  pl.run(
    (function* run() {
      try {
        yield* standUp(world, pl);
        yield* walkTo(world, pl, target.x, target.y, { patience: 3 });
      } finally {
        clearDestination(world);
      }
    })(),
  );
}

export function commandDoor(world, door) {
  const pl = world.player;
  pl.destination = { x: door.inner.x, y: door.inner.y, room: pl.room };
  pl.run(
    (function* run() {
      try {
        yield* standUp(world, pl);
        yield* throughDoor(world, pl, door);
      } finally {
        clearDestination(world);
      }
    })(),
  );
}

export function commandTravel(world, roomId) {
  const pl = world.player;
  if (pl.room === roomId) return;
  pl.run(
    (function* run() {
      yield* standUp(world, pl);
      const ok = yield* goToRoom(world, pl, roomId);
      if (!ok) pl.say('No encuentro el camino…');
    })(),
  );
}

export function commandFurniture(world, f, nearX, nearY) {
  const pl = world.player;
  const c = CATALOG[f.type];

  if (c.seats) {
    // Volver a tocar tu propio asiento te levanta.
    if (pl.seat && pl.seat.furn === f) {
      pl.run(standUp(world, pl));
      return;
    }
    const index = freeSeatIndex(f, nearX, nearY);
    if (index < 0) {
      pl.say('Ese sitio está ocupado.');
      return;
    }
    pl.run(
      (function* run() {
        yield* standUp(world, pl);
        const ok = yield* sitOn(world, pl, f, index);
        if (ok) startTyping(world, pl);
        else pl.say('No puedo llegar hasta ahí.');
      })(),
    );
    return;
  }

  if (c.use) {
    const use = USES[c.use];
    pl.run(
      (function* run() {
        yield* standUp(world, pl);
        const ok = yield* use(world, pl, f);
        if (ok === false) pl.say('Ahora mismo no puedo.');
      })(),
    );
    return;
  }

  // Mueble sin uso: acercarse.
  pl.run(
    (function* run() {
      yield* standUp(world, pl);
      yield* approach(world, pl, f);
    })(),
  );
}

export function commandWindow(world, item) {
  const pl = world.player;
  pl.run(
    (function* run() {
      yield* standUp(world, pl);
      yield* useWindow(world, pl, item);
    })(),
  );
}

export function commandWave(world, av) {
  if (!av.isPlayer || av.locked || av.seat || av.walking) return;
  av.run(
    (function* run() {
      av.pose = 'wave';
      yield* wait(1.2);
      av.pose = 'stand';
    })(),
  );
}

export function commandDrink(world, item) {
  const pl = world.player;
  if ((world.inventory.items[item] || 0) <= 0) return;
  pl.run(
    (function* run() {
      yield* standUp(world, pl);
      world.inventory.items[item]--;
      world.emit('inventory');
      world.save();
      try {
        pl.held = item === 'cafe' ? 'cup' : 'can';
        pl.dir = pl.dir < 2 ? pl.dir : 1;
        pl.pose = 'drink';
        yield* wait(1.8);
        pl.say(item === 'cafe' ? 'Ahora sí que empieza el día.' : '¡Qué fresquita!');
      } finally {
        pl.pose = 'stand';
        pl.held = null;
      }
    })(),
  );
}

// Chat: burbuja propia y, a veces, respuesta de quien esté en la sala.
export function playerChat(world, text) {
  const pl = world.player;
  const clean = text.trim();
  if (!clean) return;
  pl.say(clean);
  const lower = clean.toLowerCase();
  const others = world.occupantsOf(pl.room).filter((a) => !a.isPlayer && !a.hidden);
  if (!others.length) return;
  const named = others.find((a) => lower.includes(a.name.toLowerCase()));
  let reply = null;
  if (/\b(hola|buenas|hey|ey|saludos)\b/.test(lower)) reply = `¡Hola, ${pl.name === 'Tú' ? 'compi' : pl.name}!`;
  else if (lower.includes('caf')) reply = 'La cafetera está en la cocina. ¡Y funciona!';
  else if (/ba[nñ]o|aseo|servicio/.test(lower)) reply = 'Los baños están pasada la recepción.';
  else if (/reuni/.test(lower)) reply = '¿Otra reunión? Voy cogiendo sitio.';
  else if (/gracias/.test(lower)) reply = '¡De nada!';
  else if (named) reply = '¿Sí? Dime.';
  else if (lower.endsWith('?') && Math.random() < 0.6) reply = 'Buena pregunta… ¿lo miramos luego?';
  if (!reply) return;
  const responder = named || others[Math.floor(Math.random() * others.length)];
  setTimeout(() => responder.say(reply), 900 + Math.random() * 700);
}
