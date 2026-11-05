// Compañeros de oficina: deambulan, se sientan a teclear, van a por café, al baño,
// a reuniones y a la zona chill. Viven en todas las salas aunque no se estén viendo.
import {
  freeSeatIndex, goToRoom, sitOn, standUp, startTyping, useArcade, useCoffee, useCopier, useStall, useVending,
  wait, walkTo,
} from './routines.js';

// Plantilla propia de Elliot Clod: ropa de oficina y puestos de empresa corriente.
export const NPC_DEFS = [
  { name: 'Marta', job: 'Recepción', role: 'reception', home: 'recepcion-silla', homeRoom: 'recepcion', start: 'seat',
    look: { skin: 1, hair: 3, hairStyle: 'mono', top: 6, topStyle: 'camiseta', bottom: 8, shoes: 10 } },
  { name: 'Diego', job: 'Ventas', role: 'worker', home: 'puesto-a-0', homeRoom: 'trabajo', start: 'seat',
    look: { skin: 2, hair: 1, hairStyle: 'corto', top: 2, topStyle: 'corbata', bottom: 8, shoes: 10 } },
  { name: 'Lucía', job: 'Contabilidad', role: 'worker', home: 'puesto-a-2', homeRoom: 'trabajo', start: 'seat',
    look: { skin: 0, hair: 0, hairStyle: 'melena', top: 7, topStyle: 'rayas', bottom: 9, shoes: 8 } },
  { name: 'Iván', job: 'Soporte informático', role: 'worker', home: 'puesto-b-1', homeRoom: 'trabajo', start: 'seat',
    look: { skin: 3, hair: 1, hairStyle: 'corto', top: 8, topStyle: 'sudadera', bottom: 9, shoes: 8 } },
  { name: 'Sara', job: 'Ventas', role: 'worker', home: 'puesto-b-3', homeRoom: 'trabajo', start: 'seat',
    look: { skin: 4, hair: 1, hairStyle: 'rizos', top: 4, topStyle: 'camiseta', bottom: 8, shoes: 10 } },
  { name: 'Hugo', job: 'Almacén', role: 'worker', home: 'puesto-a-3', homeRoom: 'trabajo', start: 'walk', startRoom: 'cocina', startAt: [6, 3],
    look: { skin: 1, hair: 2, hairStyle: 'gorra', top: 9, topStyle: 'camiseta', bottom: 10, shoes: 8 } },
  { name: 'Noa', job: 'Recursos humanos', role: 'worker', home: 'puesto-b-0', homeRoom: 'trabajo', start: 'walk', startRoom: 'chill', startAt: [6, 5],
    look: { skin: 2, hair: 3, hairStyle: 'coleta', top: 11, topStyle: 'rayas', bottom: 9, shoes: 10 } },
  { name: 'Pablo', job: 'Contabilidad', role: 'worker', home: 'puesto-a-1', homeRoom: 'trabajo', start: 'walk', startRoom: 'recepcion', startAt: [6, 5],
    look: { skin: 0, hair: 4, hairStyle: 'calvo', top: 10, topStyle: 'corbata', bottom: 10, shoes: 10 } },
  { name: 'Elena', job: 'Dirección regional', role: 'boss', home: 'direccion-silla', homeRoom: 'despacho', start: 'seat',
    look: { skin: 1, hair: 1, hairStyle: 'melena', top: 8, topStyle: 'corbata', bottom: 8, shoes: 8 } },
];

// Humor seco de oficina, escrito para Elliot Clod.
const LINES = {
  work: [
    'Este informe no se acaba nunca.', '¿Alguien ha visto mi grapadora?', 'Según el correo, ya es urgente.',
    'Reinicio y a ver si va.', 'Otro formulario para pedir un formulario.', '¿Hoy es viernes?', 'Faltan seis horas. Y doce minutos.',
  ],
  coffee: ['Sin café no funciono.', '¿Quién ha dejado la jarra vacía?', 'Este café sabe a lunes.'],
  chill: ['Cinco minutitos y vuelvo.', 'Oficialmente, estoy en el almacén.', 'Aquí no hay cobertura de jefes.'],
  meeting: ['¿Empezamos ya?', 'Esto podría haber sido un correo.', 'Paso a la siguiente diapositiva.'],
  wander: ['Voy a estirar las piernas.', 'Mmm… ¿a qué venía yo aquí?', 'Buenos días, supongo.'],
  camera: ['(mira a la cámara)', '(mira a la cámara, en silencio)', '(suspira y mira a la cámara)'],
};

const INTERVIEW = [
  'Llevo aquí seis años. Parece menos. No, parece más.',
  'Lo mejor de mi trabajo es la silla. Es buena silla.',
  'No sé qué vendemos exactamente, pero vamos bien.',
  'Mi plan a cinco años es seguir sentándome aquí.',
  'Aquí somos una familia. Por eso nadie habla en las comidas.',
  'La reunión de hoy era sobre las reuniones.',
];

export function interviewLine() {
  return INTERVIEW[Math.floor(Math.random() * INTERVIEW.length)];
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);

function maybeSay(world, av, kind, chance = 0.35) {
  if (av.room === world.view && Math.random() < chance) av.say(pick(LINES[kind]));
}

function* work(world, av) {
  const room = world.room(av.home.room);
  let chair = room.byId(av.home.chair);
  if (!(yield* goToRoom(world, av, av.home.room))) return;
  if (!chair || chair.sitters[0]) {
    // Su silla no está disponible: busca cualquier puesto libre de esta sala.
    chair = room.furniture.find((f) => f.id && f.id.startsWith('puesto') && !f.sitters[0]) || null;
    if (!chair) return;
  }
  if (!(yield* sitOn(world, av, chair, 0))) return;
  startTyping(world, av);
  const total = between(14, 38);
  let t = 0;
  while (t < total) {
    const step = between(5, 12);
    yield* wait(step);
    t += step;
    maybeSay(world, av, 'work', 0.25);
  }
  yield* standUp(world, av);
}

function* wander(world, av) {
  const room = world.room(av.room);
  const hops = 1 + Math.floor(Math.random() * 3);
  const reserved = room.reservedTiles();
  for (let i = 0; i < hops; i++) {
    let target = null;
    for (let tries = 0; tries < 8 && !target; tries++) {
      const x = Math.floor(Math.random() * room.w);
      const y = Math.floor(Math.random() * room.h);
      // No se queda parado en entradas de puerta ni en la cola de las cabinas.
      if (room.isFree(x, y) && !reserved.has(`${x},${y}`) && !world.idleAvatarAt(room.id, x, y, av)) target = { x, y };
    }
    if (target) yield* walkTo(world, av, target.x, target.y, { patience: 2 });
    if (i === 0) maybeSay(world, av, 'wander', 0.15);
    yield* wait(between(1, 3.5));
  }
}

function* stroll(world, av) {
  const rooms = ['recepcion', 'trabajo', 'cocina', 'chill', 'reuniones'];
  yield* goToRoom(world, av, pick(rooms));
  yield* wander(world, av);
}

function* coffee(world, av) {
  if (!(yield* goToRoom(world, av, 'cocina'))) return;
  const machine = world.room('cocina').byId('cafetera');
  if (machine && (yield* useCoffee(world, av, machine))) {
    maybeSay(world, av, 'coffee', 0.5);
  }
  // A veces se queda un rato en un taburete.
  if (Math.random() < 0.5) {
    const stools = world.room('cocina').furniture.filter((f) => f.type === 'stool' && !f.sitters[0]);
    if (stools.length && (yield* sitOn(world, av, pick(stools), 0))) {
      yield* wait(between(6, 16));
      yield* standUp(world, av);
    }
  }
}

function* vending(world, av) {
  if (!(yield* goToRoom(world, av, 'cocina'))) return;
  const machine = world.room('cocina').byId('expendedora');
  if (machine) yield* useVending(world, av, machine);
}

function* bathroom(world, av) {
  if (!(yield* goToRoom(world, av, 'bano'))) return;
  const stalls = world.room('bano').furniture.filter((f) => f.type === 'stall');
  if (!stalls.length) return;
  // Cada NPC tiene su cabina favorita: si está ocupada, espera su turno.
  const favorite = stalls[av.id % stalls.length];
  yield* useStall(world, av, favorite);
  yield* wait(between(0.5, 1.5));
}

function* meeting(world, av) {
  if (!(yield* goToRoom(world, av, 'reuniones'))) return;
  const chairs = world.room('reuniones').furniture.filter((f) => f.type === 'chair_meet' && !f.sitters[0]);
  if (!chairs.length) return;
  if (yield* sitOn(world, av, pick(chairs), 0)) {
    yield* wait(between(5, 10));
    maybeSay(world, av, 'meeting', 0.6);
    yield* wait(between(8, 22));
    yield* standUp(world, av);
  }
}

function* chill(world, av) {
  if (!(yield* goToRoom(world, av, 'chill'))) return;
  const room = world.room('chill');
  const arcade = room.byId('recreativa');
  if (arcade && !arcade.state.user && Math.random() < 0.45) {
    yield* useArcade(world, av, arcade, between(6, 14));
    maybeSay(world, av, 'chill', 0.3);
    return;
  }
  const seats = room.furniture.filter((f) => (f.type.startsWith('pouf') || f.type === 'sofa') && freeSeatIndex(f) >= 0);
  if (seats.length) {
    const f = pick(seats);
    const i = freeSeatIndex(f);
    if (yield* sitOn(world, av, f, i)) {
      maybeSay(world, av, 'chill', 0.3);
      yield* wait(between(10, 24));
      yield* standUp(world, av);
    }
  }
}

function* copies(world, av) {
  if (!(yield* goToRoom(world, av, 'trabajo'))) return;
  const machine = world.room('trabajo').byId('fotocopiadora');
  if (machine) yield* useCopier(world, av, machine);
}

// El gesto del falso documental: se para y mira a cámara un momento.
function* lookAtCamera(world, av) {
  yield* wander(world, av);
  av.dir = av.dir % 2 === 0 ? 0 : 1;
  if (av.room === world.view) av.say(pick(LINES.camera));
  yield* wait(between(2, 3.5));
}

const WEIGHTS = {
  worker: [[work, 5], [coffee, 1.3], [copies, 0.9], [vending, 0.5], [bathroom, 1.2], [meeting, 0.9], [chill, 0.9], [stroll, 0.8], [wander, 0.6], [lookAtCamera, 0.6]],
  boss: [[work, 6], [coffee, 1], [bathroom, 0.7], [meeting, 1], [wander, 0.6], [lookAtCamera, 0.5]],
  reception: [[work, 8], [bathroom, 0.5], [coffee, 0.5], [wander, 0.4], [lookAtCamera, 0.3]],
};

function chooseRoutine(role) {
  const table = WEIGHTS[role] || WEIGHTS.worker;
  let total = 0;
  for (const [, w] of table) total += w;
  let r = Math.random() * total;
  for (const [fn, w] of table) {
    r -= w;
    if (r <= 0) return fn;
  }
  return table[0][0];
}

export function* npcLife(world, av, firstRoutine) {
  let routine = firstRoutine;
  for (;;) {
    try {
      yield* (routine || chooseRoutine(av.role))(world, av);
    } finally {
      routine = null;
    }
    yield* standUp(world, av);
    yield* wait(between(0.6, 2.5));
  }
}

// Si ya empieza sentado, sigue tecleando un rato antes de elegir qué hacer.
export function* continueWorking(world, av) {
  startTyping(world, av);
  yield* wait(between(10, 34));
  yield* standUp(world, av);
}

export const ROUTINES = { work, wander, coffee, vending, bathroom, meeting, chill, stroll };
