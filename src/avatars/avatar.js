// Entidad avatar: posición, postura, burbujas de chat y la rutina que está ejecutando.
// Las rutinas son generadores: reciben el tiempo transcurrido en cada `yield` y se
// pueden cancelar con limpieza (sus `finally` liberan sillas, colas y máquinas).

let nextAvatarId = 1;

export const BUBBLE_TIME = 6.5;

export class Avatar {
  constructor({ name, look, room, x, y, isPlayer = false, role = 'worker', home = null }) {
    this.id = nextAvatarId++;
    this.name = name;
    this.look = look;
    this.room = room;
    this.x = x;
    this.y = y;
    this.isPlayer = isPlayer;
    this.role = role;
    this.home = home;
    this.dir = 1;
    this.pose = 'stand';
    this.walking = false;
    this.walkT = 0;
    this.speed = isPlayer ? 3.1 : 2.3;
    this.seat = null;
    this.held = null;
    this.hidden = false;
    this.inStall = null;
    this.typingAt = null;
    this.locked = false;
    this.waiting = false;
    this.bubbles = [];
    this.co = null;
    this.pending = null;
    this.destination = null;
    this.blinkAt = 2 + Math.random() * 3;
    this.blinkUntil = 0;
    this.talkUntil = 0;
    this.life = 0;
  }

  // Sustituye la rutina actual. Si está en un tramo que no admite interrupción,
  // la deja pendiente para cuando acabe.
  run(generator) {
    if (this.locked) {
      if (this.pending) this.pending.return();
      this.pending = generator;
      return false;
    }
    if (this.co) this.co.return();
    this.co = generator;
    return true;
  }

  stopRoutine() {
    if (this.co) this.co.return();
    this.co = null;
  }

  tick(dt) {
    this.life += dt;
    if (this.co) {
      const r = this.co.next(dt);
      if (r.done) this.co = null;
    }
    if (this.pending && !this.locked) {
      const g = this.pending;
      this.pending = null;
      if (this.co) this.co.return();
      this.co = g;
    }
    if (this.life > this.blinkAt) {
      this.blinkUntil = this.life + 0.14;
      this.blinkAt = this.life + 2 + Math.random() * 4;
    }
    for (const b of this.bubbles) b.age += dt;
    if (this.bubbles.length && this.bubbles[0].age > BUBBLE_TIME) this.bubbles.shift();
  }

  say(text) {
    const trimmed = String(text).trim().slice(0, 140);
    if (!trimmed) return;
    this.bubbles.push({ text: trimmed, age: 0, id: Math.random() });
    if (this.bubbles.length > 3) this.bubbles.shift();
    this.talkUntil = this.life + Math.min(2.2, 0.5 + trimmed.length * 0.05);
  }

  tileX() {
    return Math.floor(this.x);
  }

  tileY() {
    return Math.floor(this.y);
  }

  // Postura y fotograma que se pintan ahora mismo.
  appearance(time) {
    let pose = this.pose;
    let frame = 0;
    if (this.walking) {
      pose = 'walk';
      frame = Math.floor(this.walkT * 8) % 4;
    } else if (pose === 'type') {
      frame = Math.floor(time * 7 + this.id) % 2;
    } else if (pose === 'use' || pose === 'wave') {
      frame = Math.floor(time * 5) % 2;
    } else if (pose === 'drink') {
      frame = Math.floor(time * 2) % 2;
    }
    return {
      pose,
      frame,
      blink: this.life < this.blinkUntil,
      talk: this.life < this.talkUntil && Math.floor(time * 7) % 2 === 0,
    };
  }
}
