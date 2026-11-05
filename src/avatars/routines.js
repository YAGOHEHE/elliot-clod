// Rutinas compartidas por el jugador y los NPC: caminar, sentarse, cruzar puertas,
// usar máquinas y las cabinas del baño (con su cola).
import { DIRS, dirFromDelta } from '../core/iso.js';
import { CATALOG, footprint, frontDir, seatInRoom } from '../furniture/catalog.js';
import { stallTiles } from '../map/tilemap.js';

export function* wait(seconds) {
  let left = seconds;
  while (left > 0) left -= yield;
}

export function* moveTo(av, x, y, speedMul = 1) {
  const dx = x - av.x;
  const dy = y - av.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return;
  av.walking = true;
  av.dir = dirFromDelta(dx, dy, av.dir);
  try {
    let left = dist;
    while (left > 1e-3) {
      const dt = yield;
      const step = av.speed * speedMul * dt;
      av.walkT += dt;
      if (step >= left) {
        av.x = x;
        av.y = y;
        left = 0;
      } else {
        av.x += (dx / dist) * step;
        av.y += (dy / dist) * step;
        left -= step;
      }
    }
  } finally {
    av.walking = false;
  }
}

function startTile(room, av) {
  return {
    x: Math.max(0, Math.min(room.w - 1, Math.floor(av.x))),
    y: Math.max(0, Math.min(room.h - 1, Math.floor(av.y))),
  };
}

export function* walkTo(world, av, tx, ty, opts = {}) {
  const room = world.room(av.room);
  const patience = opts.patience ?? 6;
  let tries = 0;
  for (;;) {
    const start = startTile(room, av);
    if (start.x === tx && start.y === ty) {
      yield* moveTo(av, tx + 0.5, ty + 0.5);
      return true;
    }
    const blocked = (x, y) => world.idleAvatarAt(av.room, x, y, av);
    const path = room.findPath(start.x, start.y, tx, ty, blocked);
    if (!path) {
      tries++;
      if (tries > patience) return false;
      yield* wait(0.4);
      continue;
    }
    let broken = false;
    for (const step of path) {
      if (!room.isFree(step.x, step.y) || blocked(step.x, step.y)) {
        broken = true;
        break;
      }
      yield* moveTo(av, step.x + 0.5, step.y + 0.5);
    }
    if (!broken) return true;
    tries++;
    if (tries > patience) return false;
    yield* wait(0.25);
  }
}

// Levantarse si estaba sentado, antes de hacer cualquier otra cosa.
export function* standUp(world, av) {
  if (!av.seat) return;
  const { furn, index } = av.seat;
  const room = world.room(av.room);
  const seat = seatInRoom(furn, index);
  av.typingAt = null;
  av.pose = 'stand';
  const tile = { x: Math.floor(seat.x), y: Math.floor(seat.y) };
  const order = [seat.dir, (seat.dir + 1) & 3, (seat.dir + 3) & 3, (seat.dir + 2) & 3];
  let spot = null;
  for (const d of order) {
    const c = { x: tile.x + DIRS[d].x, y: tile.y + DIRS[d].y };
    if (room.isFree(c.x, c.y) && !world.idleAvatarAt(av.room, c.x, c.y, av)) {
      spot = c;
      break;
    }
  }
  if (!spot) spot = room.nearestTo(tile.x, tile.y, tile.x, tile.y);
  furn.sitters[index] = null;
  try {
    if (spot) yield* moveTo(av, spot.x + 0.5, spot.y + 0.5, 0.8);
  } finally {
    av.seat = null;
  }
}

export function freeSeatIndex(furn, nearX, nearY) {
  const seats = CATALOG[furn.type].seats || [];
  let best = -1;
  let bestD = Infinity;
  seats.forEach((_, i) => {
    if (furn.sitters[i]) return;
    const s = seatInRoom(furn, i);
    const d = nearX === undefined ? i : (s.x - nearX) ** 2 + (s.y - nearY) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// Mesa con ordenador justo enfrente de un asiento.
export function computerAhead(world, av, furn, index) {
  const seat = seatInRoom(furn, index);
  const room = world.room(av.room);
  const ahead = room.furnitureAt(
    Math.floor(seat.x) + DIRS[seat.dir].x,
    Math.floor(seat.y) + DIRS[seat.dir].y,
  );
  return ahead && CATALOG[ahead.type].computer ? ahead : null;
}

export function* sitOn(world, av, furn, index = 0) {
  const room = world.room(av.room);
  if (furn.sitters[index]) return false;
  const seat = seatInRoom(furn, index);
  const tile = { x: Math.floor(seat.x), y: Math.floor(seat.y) };
  const start = startTile(room, av);
  const order = [seat.dir, (seat.dir + 1) & 3, (seat.dir + 3) & 3, (seat.dir + 2) & 3];
  const blocked = (x, y) => world.idleAvatarAt(av.room, x, y, av);
  let spot = null;
  let bestLen = Infinity;
  order.forEach((d, rank) => {
    const c = { x: tile.x + DIRS[d].x, y: tile.y + DIRS[d].y };
    if (!room.isFree(c.x, c.y) || blocked(c.x, c.y)) return;
    const path = room.findPath(start.x, start.y, c.x, c.y, blocked);
    if (!path) return;
    const len = path.length + rank * 0.5;
    if (len < bestLen) {
      bestLen = len;
      spot = c;
    }
  });
  if (!spot) return false;
  const arrived = yield* walkTo(world, av, spot.x, spot.y);
  if (!arrived) return false;
  if (furn.sitters[index] || !room.furniture.includes(furn)) return false;
  furn.sitters[index] = av;
  av.seat = { furn, index };
  yield* moveTo(av, seat.x, seat.y, 0.8);
  const now = seatInRoom(furn, index);
  av.x = now.x;
  av.y = now.y;
  av.dir = now.dir;
  av.pose = 'sit';
  return true;
}

export function startTyping(world, av) {
  if (!av.seat) return false;
  const desk = computerAhead(world, av, av.seat.furn, av.seat.index);
  if (!desk) return false;
  av.pose = 'type';
  av.typingAt = desk;
  return true;
}

// Cruzar una puerta: caminar hasta ella, pasar y aparecer en la sala conectada.
export function* throughDoor(world, av, door) {
  const arrived = yield* walkTo(world, av, door.inner.x, door.inner.y);
  if (!arrived) return false;
  const followView = av.isPlayer;
  const wasLocked = av.locked;
  av.locked = true;
  try {
    door.holds = (door.holds || 0) + 1;
    yield* wait(door.wall === 'L' || door.wall === 'R' ? 0.16 : 0);
    yield* moveTo(av, door.pos.x, door.pos.y);
    if (followView) world.startWipe();
    if (followView) yield* wait(world.wipeHalf);
    door.holds--;
    const target = world.room(door.to).door(door.toDoor);
    av.room = door.to;
    av.x = target.pos.x;
    av.y = target.pos.y;
    if (followView) world.showRoom(door.to);
    target.holds = (target.holds || 0) + 1;
    yield* wait(0.1);
    yield* moveTo(av, target.inner.x + 0.5, target.inner.y + 0.5);
    target.holds--;
  } finally {
    av.locked = wasLocked;
  }
  return true;
}

export function* goToRoom(world, av, roomId) {
  let guard = 0;
  while (av.room !== roomId && guard++ < 12) {
    const door = world.nextDoorTowards(av.room, roomId);
    if (!door) return false;
    const ok = yield* throughDoor(world, av, door);
    if (!ok) return false;
  }
  return av.room === roomId;
}

// Baldosa desde la que se usa una máquina: delante si se puede, si no alrededor.
export function usageSpot(world, av, f) {
  const room = world.room(av.room);
  const [fw, fh] = footprint(f.type, f.rot);
  const d = frontDir(f);
  const candidates = [];
  const front = [];
  const add = (x, y, list) => {
    if (room.isFree(x, y)) list.push({ x, y });
  };
  for (let x = f.x; x < f.x + fw; x++) {
    add(x, f.y - 1, d === 3 ? front : candidates);
    add(x, f.y + fh, d === 1 ? front : candidates);
  }
  for (let y = f.y; y < f.y + fh; y++) {
    add(f.x - 1, y, d === 2 ? front : candidates);
    add(f.x + fw, y, d === 0 ? front : candidates);
  }
  const start = startTile(room, av);
  const blocked = (x, y) => world.idleAvatarAt(av.room, x, y, av);
  const score = (c, bias) => {
    const path = room.findPath(start.x, start.y, c.x, c.y, blocked);
    return path ? path.length + bias : Infinity;
  };
  let best = null;
  let bestScore = Infinity;
  for (const c of front) {
    const s = score(c, 0);
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (!best) {
    for (const c of candidates) {
      const s = score(c, 2);
      if (s < bestScore) {
        bestScore = s;
        best = c;
      }
    }
  }
  return best;
}

function faceFurniture(av, f) {
  const [fw, fh] = footprint(f.type, f.rot);
  const cx = Math.max(f.x, Math.min(f.x + fw, av.x));
  const cy = Math.max(f.y, Math.min(f.y + fh, av.y));
  av.dir = dirFromDelta(cx - av.x, cy - av.y, av.dir);
}

export function* approach(world, av, f) {
  const spot = usageSpot(world, av, f);
  if (!spot) return false;
  const ok = yield* walkTo(world, av, spot.x, spot.y);
  if (!ok) return false;
  faceFurniture(av, f);
  return true;
}

function* takeMachine(world, av, f, patience = 12) {
  let waited = 0;
  while (f.state.user && f.state.user !== av) {
    av.waiting = true;
    yield* wait(0.3);
    waited += 0.3;
    if (waited > patience) {
      av.waiting = false;
      return false;
    }
  }
  av.waiting = false;
  f.state.user = av;
  return true;
}

function releaseMachine(f, av) {
  if (f.state.user === av) f.state.user = null;
  f.state.mode = null;
}

export function* useCoffee(world, av, f) {
  if (!(yield* approach(world, av, f))) return false;
  if (!(yield* takeMachine(world, av, f))) return false;
  av.locked = true;
  try {
    av.pose = 'use';
    f.state.mode = 'brew';
    f.state.brewUntil = world.time + 2.4;
    yield* wait(2.4);
    f.state.mode = 'done';
    yield* wait(0.5);
    f.state.mode = null;
    av.held = 'cup';
    av.pose = 'stand';
    world.gainItem(av, 'cafe');
    if (av.isPlayer) av.say('¡Café recién hecho!');
    yield* wait(0.4);
    av.pose = 'drink';
    yield* wait(1.5);
    av.pose = 'stand';
    av.held = null;
  } finally {
    av.locked = false;
    av.pose = 'stand';
    av.held = null;
    releaseMachine(f, av);
  }
  return true;
}

export function* useVending(world, av, f) {
  if (!(yield* approach(world, av, f))) return false;
  if (!(yield* takeMachine(world, av, f))) return false;
  av.locked = true;
  try {
    av.pose = 'use';
    yield* wait(0.7);
    f.state.mode = 'vend';
    f.state.shakeUntil = world.time + 0.5;
    yield* wait(1.0);
    f.state.mode = null;
    av.held = 'can';
    av.pose = 'stand';
    world.gainItem(av, 'lata');
    if (av.isPlayer) av.say('¡Clonc! Ha caído una lata.');
    yield* wait(0.5);
    av.pose = 'drink';
    yield* wait(1.3);
  } finally {
    av.locked = false;
    av.pose = 'stand';
    av.held = null;
    releaseMachine(f, av);
  }
  return true;
}

export function* useFridge(world, av, f) {
  if (!(yield* approach(world, av, f))) return false;
  if (!(yield* takeMachine(world, av, f))) return false;
  try {
    av.pose = 'use';
    f.state.open = true;
    yield* wait(1.6);
    if (av.isPlayer) av.say('Alguien se ha comido mi yogur…');
  } finally {
    f.state.open = false;
    av.pose = 'stand';
    releaseMachine(f, av);
  }
  return true;
}

export function* useArcade(world, av, f, seconds = 5) {
  if (!(yield* approach(world, av, f))) return false;
  if (!(yield* takeMachine(world, av, f, 8))) return false;
  try {
    av.pose = 'use';
    f.state.mode = 'play';
    yield* wait(seconds);
    const score = 100 * (3 + Math.floor(Math.random() * 90));
    if (av.isPlayer || Math.random() < 0.5) av.say(`¡${score} puntos!`);
  } finally {
    av.pose = 'stand';
    releaseMachine(f, av);
  }
  return true;
}

export function* useCopier(world, av, f) {
  if (!(yield* approach(world, av, f))) return false;
  if (!(yield* takeMachine(world, av, f))) return false;
  try {
    av.pose = 'use';
    f.state.mode = 'copy';
    yield* wait(2.2);
    f.state.mode = null;
    const lines = ['Atasco de papel. Otra vez.', 'Cuarenta copias, todas torcidas.', '¿Quién ha dejado esto sin tóner?'];
    if (av.isPlayer || Math.random() < 0.4) av.say(lines[Math.floor(Math.random() * lines.length)]);
    yield* wait(0.4);
  } finally {
    av.pose = 'stand';
    releaseMachine(f, av);
  }
  return true;
}

export function* useTv(world, av, f) {
  if (!(yield* approach(world, av, f))) return false;
  av.pose = 'use';
  yield* wait(0.4);
  f.state.channel = ((f.state.channel || 0) + 1) % 4;
  av.pose = 'stand';
  return true;
}

export function* useProjector(world, av, f) {
  if (!(yield* approach(world, av, f))) return false;
  av.pose = 'use';
  yield* wait(0.4);
  f.state.on = f.state.on === false;
  av.pose = 'stand';
  return true;
}

export function* useWindow(world, av, item) {
  const room = world.room(av.room);
  const mid = Math.floor(item.at + item.w / 64);
  const target = item.wall === 'L'
    ? room.nearestTo(Math.floor(av.x), Math.floor(av.y), 0, mid)
    : room.nearestTo(Math.floor(av.x), Math.floor(av.y), mid, 0);
  if (target) yield* walkTo(world, av, target.x, target.y);
  av.dir = item.wall === 'L' ? 2 : 3;
  av.pose = 'use';
  yield* wait(0.35);
  item.state.target = item.state.target > 0.5 ? 0 : 0.92;
  yield* wait(0.3);
  av.pose = 'stand';
  return true;
}

// Cabina del baño. Cola por orden de llegada: quien llega espera su turno fuera;
// al entrar se cierra la puerta y se enciende el indicador de ocupado.
export function* useStall(world, av, f, seconds) {
  const st = f.state;
  st.queue = st.queue || [];
  const tiles = stallTiles(f);
  const room = world.room(av.room);
  st.queue.push(av);
  let saidWait = false;
  try {
    // Mientras haya alguien dentro o delante, esperar en la fila.
    while (st.occupant || st.queue[0] !== av) {
      const place = Math.min(st.queue.indexOf(av), tiles.queue.length - 1);
      const spot = tiles.queue[Math.max(0, place)];
      if (Math.floor(av.x) !== spot.x || Math.floor(av.y) !== spot.y) {
        av.waiting = false;
        const free = room.isFree(spot.x, spot.y) && !world.idleAvatarAt(av.room, spot.x, spot.y, av);
        if (free) yield* walkTo(world, av, spot.x, spot.y, { patience: 2 });
      }
      av.waiting = true;
      av.dir = 3;
      if (!saidWait && room.id === world.view) {
        av.say(av.isPlayer ? 'Está ocupada, espero mi turno.' : 'Espero mi turno…');
        saidWait = true;
      }
      yield* wait(0.25);
    }
    av.waiting = false;
    // Turno propio: la cabina queda reservada desde ya.
    st.occupant = av;
    st.queue.shift();
    const ok = yield* walkTo(world, av, tiles.entry.x, tiles.entry.y, { patience: 12 });
    if (!ok) return false;

    av.locked = true;
    st.doorTarget = 1;
    av.dir = 3;
    while ((st.door || 0) < 0.98) yield;
    av.inStall = f;
    yield* moveTo(av, tiles.threshold.x, tiles.threshold.y, 0.8);
    yield* moveTo(av, tiles.inside.x, tiles.inside.y, 0.8);
    st.doorTarget = 0;
    av.dir = 1;
    while ((st.door || 0) > 0.02) yield;
    av.hidden = true;
    st.closedSince = world.time;

    yield* wait(seconds ?? 3 + Math.random() * 3);

    av.hidden = false;
    st.doorTarget = 1;
    while ((st.door || 0) < 0.98) yield;
    yield* moveTo(av, tiles.threshold.x, tiles.threshold.y, 0.8);
    yield* moveTo(av, tiles.entry.x + 0.5, tiles.entry.y + 0.5, 0.8);
    av.inStall = null;
    st.doorTarget = 0;
    // La cabina se libera aquí: el siguiente de la cola ya puede pasar.
    st.occupant = null;
    while ((st.door || 0) > 0.5) yield;
    av.locked = false;
    return true;
  } finally {
    av.waiting = false;
    av.hidden = false;
    av.inStall = null;
    av.locked = false;
    const i = st.queue.indexOf(av);
    if (i >= 0) st.queue.splice(i, 1);
    if (st.occupant === av) {
      st.occupant = null;
      st.doorTarget = 0;
    }
  }
}
