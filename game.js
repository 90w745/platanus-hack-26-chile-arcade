// ¿SE MOVIÓ? — Temblor Grado 8
// Duelo en un departamento de Santiago mientras tiembla cada vez más fuerte.
// Sácalo de la pantalla antes de que el temblor te saque a ti.

const W = 800;
const H = 600;
const STORAGE_KEY = 'se-movio-records-v1';
const MATCH_MS = 75000;
const MAX_RECORDS = 10;

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[normalizeIncomingKey(key)] = arcadeCode;
  }
}

// Paleta de 16 colores, arcade de los 90.
const C = {
  ink: 0x14101a,
  night: 0x1b1a3a,
  sky: 0x2d3a6e,
  mount: 0x5f6496,
  snow: 0xf4f1ea,
  wall: 0xe9d6a8,
  wall2: 0xd6bd86,
  wood: 0x8a4b2a,
  wood2: 0x5a2d18,
  cloth: 0xd8343a,
  p1: 0x2ec7ff,
  p2: 0xff8a1f,
  skin: 0xf2b98a,
  hair: 0x3a2214,
  white: 0xffffff,
  yellow: 0xffd23f,
};
const PANTS = 0x2b2d52;

// Escenario: piso, mesa de la once, dos repisas que se rompen y dos marcos de puerta (refugio).
const FLOOR = { x1: 110, x2: 690, y: 500, solid: true };
const PLATS = [
  FLOOR,
  { x1: 310, x2: 490, y: 410 },
  { x1: 130, x2: 262, y: 290, shelf: true },
  { x1: 538, x2: 670, y: 290, shelf: true },
];
const DOORS = [
  { x1: 140, x2: 196 },
  { x1: 604, x2: 660 },
];

// El temblor: cada grado cambia una sola regla.
const GRADOS = [
  { t: 0, g: 3, txt: '¿SE MOVIÓ?', amp: 1, drop: 0 },
  { t: 10000, g: 4, txt: 'NAH', amp: 1.5, drop: 0 },
  { t: 20000, g: 5, txt: 'TA TEMBLANDO', amp: 2, drop: 2600 },
  { t: 32000, g: 6, txt: 'YA PO, AHORA SÍ', amp: 3, drop: 1700, tele: true },
  { t: 45000, g: 7, txt: '¡AL MARCO DE LA PUERTA!', amp: 3.5, drop: 1400, breaks: true },
  { t: 58000, g: 8, txt: 'NO FUE NADA', amp: 4, drop: 1100, lateral: true },
];

// Lo que se cae de la once.
const OBJS = {
  tetera: { w: 26, h: 22, dmg: 10, brk: true, word: '¡TETERAZO!' },
  taza: { w: 16, h: 14, dmg: 6, brk: true, word: '¡TAZAZO!' },
  pan: { w: 30, h: 16, dmg: 5, brk: false, word: '¡MARRAQUETAZO!' },
  mermelada: { w: 16, h: 20, dmg: 8, brk: true, word: '¡MERMELADAZO!' },
  tele: { w: 44, h: 38, dmg: 16, brk: true, heavy: true, word: '¡TELEVISORAZO!' },
};
const DROP_KINDS = ['tetera', 'taza', 'pan', 'mermelada', 'taza', 'pan'];
const KO_TXT = ['¡SE FUE AL DEPTO DE ABAJO!', '¡CAYÓ AL PATIO DE LUZ!', '¡SALIÓ A COMPRAR PAN!', '¡RECLAMO AL CONSERJE!', '¡LO SACÓ DEL EDIFICIO!'];

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#14101a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: { create, update },
};

new Phaser.Game(config);

function create() {
  const s = this;
  s.records = { top: [], rey: null };
  s.parts = [];
  s.objs = [];
  s.stop = 0;
  s.flash = 0;
  s.kick = 0;
  s.idle = 0;

  s.world = s.add.container(W / 2, H / 2);
  const bg = s.add.graphics({ x: -W / 2, y: -H / 2 });
  drawBackground(bg);
  s.dyn = s.add.graphics({ x: -W / 2, y: -H / 2 });
  s.world.add([bg, s.dyn]);
  s.tags = [0, 1].map((i) => {
    const t = txt(s, 0, 0, 'P' + (i + 1), 18, i ? '#ff8a1f' : '#2ec7ff', 4);
    s.world.add(t);
    return t;
  });

  createHud(s);
  createOverlays(s);
  createControls(s);
  initAudio(s);

  loadRecords().then((r) => {
    s.records = r;
    refreshRecords(s);
  });

  startMatch(s, [false, false], true);
}

function update(time, delta) {
  const s = this;
  const dt = Math.min(delta, 50) / 1000;
  s.now = time;
  const pr = s.controls.pressed;

  if (s.mode === 'demo') {
    if (pr.START1 || pr.START2) {
      startMatch(s, [!!pr.START1, !!pr.START2], false);
    }
  } else if (s.mode === 'play') {
    for (let i = 0; i < 2; i++) {
      if (pr['START' + (i + 1)] && s.f[i].cpu) {
        s.f[i].cpu = false;
        banner(s, '¡P' + (i + 1) + ' SE UNE!', i ? '#ff8a1f' : '#2ec7ff');
        sfx(s, 'select');
      }
    }
  } else if (s.mode === 'end') {
    updateEnd(s, dt);
  }

  if (s.mode !== 'end') {
    if (s.stop > 0) {
      s.stop -= delta;
    } else {
      simulate(s, dt);
    }
  }

  s.idle += delta;
  render(s, time);
  for (const k in pr) {
    pr[k] = false;
  }
}

// ---------- Partido ----------

function makeFighter(i, cpu) {
  return {
    i,
    cpu,
    x: i ? 560 : 240,
    y: FLOOR.y,
    vx: 0,
    vy: 0,
    face: i ? -1 : 1,
    ground: true,
    plat: FLOOR,
    jumps: 1,
    susto: 0,
    lives: 2,
    act: null,
    stun: 0,
    daze: 0,
    inv: 0,
    hold: null,
    grabbedBy: null,
    calma: 0,
    refugio: 0,
    drop: 0,
    out: 0,
    behind: false,
    base: 0,
    sty: 0,
    b1t: -1e9,
    b2t: -1e9,
    ai: { t: 0, w: {} },
  };
}

function startMatch(s, humans, demo) {
  s.mode = demo ? 'demo' : 'play';
  s.f = [makeFighter(0, !humans[0]), makeFighter(1, !humans[1])];
  // El attract parte cerca del grado 6 para mostrar el "¡TEMBLOR!".
  s.mt = demo ? 26000 : 0;
  s.phase = -1;
  s.dropT = 0;
  s.sudden = false;
  s.objs.length = 0;
  s.parts.length = 0;
  s.winner = null;
  s.maxG = 3;
  s.lat = { dir: 1, t: 0, k: 0 };
  s.warned = -1;
  s.countdown = null;
  for (const p of PLATS) {
    p.broken = false;
  }
  s.title.setVisible(demo);
  s.endUi.setVisible(false);
  s.idle = 0;
  if (!demo) {
    banner(s, '¡A PELEAR!', '#ffd23f');
    sfx(s, 'select');
    const help = txt(s, W / 2, 575, 'B1 GOLPE · B2 AGARRA/LANZA · B3 ¡QUIETO!', 22, '#ffffff', 6).setDepth(30);
    s.tweens.add({ targets: help, alpha: 0, delay: 8000, duration: 500, onComplete: () => help.destroy() });
  }
}

function simulate(s, dt) {
  s.mt += dt * 1000;
  updateQuake(s, dt);
  for (const f of s.f) {
    const o = s.f[1 - f.i];
    const inp = f.cpu ? cpuIntent(s, f, o, dt) : humanIntent(s, f);
    stepFighter(s, f, o, inp, dt);
  }
  for (const f of s.f) {
    resolveAction(s, f, s.f[1 - f.i]);
  }
  stepObjects(s, dt);
  stepParticles(s, dt);
  for (const f of s.f) {
    checkOut(s, f);
  }

  if (!s.sudden && s.mt >= MATCH_MS && s.mode !== 'end') {
    const [a, b] = s.f;
    if (a.lives !== b.lives) {
      endMatch(s, a.lives > b.lives ? a : b);
    } else {
      s.sudden = true;
      banner(s, '¡MUERTE SÚBITA!', '#ff3b3b');
      sfx(s, 'alert');
    }
  }
}

function humanIntent(s, f) {
  const p = 'P' + (f.i + 1) + '_';
  const h = s.controls.held;
  const pr = s.controls.pressed;
  return {
    l: h[p + 'L'],
    r: h[p + 'R'],
    d: h[p + 'D'],
    up: pr[p + 'U'],
    uh: h[p + 'U'],
    // La fila de abajo repite la de arriba.
    b1: pr[p + '1'] || pr[p + '4'],
    b2: pr[p + '2'] || pr[p + '5'],
    b3: pr[p + '3'] || pr[p + '6'],
    h1: h[p + '1'] || h[p + '4'],
    h2: h[p + '2'] || h[p + '5'],
    dn: pr[p + 'D'],
  };
}

function stepFighter(s, f, o, inp, dt) {
  const ms = dt * 1000;
  f.inv = Math.max(0, f.inv - ms);
  f.drop = Math.max(0, f.drop - ms);
  if (f.out > 0) {
    f.out -= ms;
    if (f.out <= 0) {
      respawn(s, f);
    }
    return;
  }
  if (f.grabbedBy) {
    const g = f.grabbedBy;
    f.x = g.x + g.face * 34;
    f.y = g.y - 6;
    f.vx = f.vy = 0;
    return;
  }

  const free = f.stun <= 0 && f.daze <= 0;
  f.inp = inp;
  f.stun = Math.max(0, f.stun - ms);
  f.daze = Math.max(0, f.daze - ms);

  if (free) {
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    const busy = f.act && f.act.k !== 'hold';
    if (dir && !busy) {
      if (Math.abs(f.vx) < 280 || Math.sign(f.vx) !== dir) {
        f.vx += dir * (f.ground ? 2600 : 1500) * dt;
      }
      f.face = dir;
    } else if (f.ground) {
      f.vx = approach(f.vx, 0, 2400 * dt);
    }
    if (inp.up && !busy) {
      if (f.ground) {
        f.vy = -640;
        f.ground = false;
        sfx(s, 'jump');
      } else if (f.jumps > 0) {
        f.vy = -580;
        f.jumps--;
        sfx(s, 'jump');
        puff(s, f.x, f.y, 5, C.white);
      }
    }
    if (inp.dn && f.ground && !f.plat.solid) {
      f.drop = 220;
      f.ground = false;
    }
    readButtons(s, f, o, inp);
  } else if (f.ground) {
    f.vx = approach(f.vx, 0, 1600 * dt);
  } else if (f.stun > 0) {
    // Deriva: al salir volando todavía se puede pelear por volver.
    f.vx += ((inp.r ? 1 : 0) - (inp.l ? 1 : 0)) * 600 * dt;
  }

  if (!f.ground) {
    f.vx *= 1 - 0.9 * dt;
  }

  // Grado 8: el piso "se inclina" y empuja hacia un lado, salvo en el marco de la puerta.
  const g = GRADOS[Math.max(0, s.phase)];
  const inDoor = f.ground && f.plat === FLOOR && DOORS.some((d) => f.x > d.x1 && f.x < d.x2);
  if (inDoor && g.lateral) {
    f.refugio += ms;
    if (f.refugio < 2000) gainCalma(s, f, 12 * dt);
  } else {
    f.refugio = 0;
  }
  if (g.lateral && f.ground && !(inDoor && f.refugio < 2000)) {
    f.vx += s.lat.dir * s.lat.k * 560 * dt;
  }
  if (g.lateral && inDoor && f.refugio > 0) {
    f.sty += 25 * dt;
  }

  f.vy += (inp.d && !f.ground && f.vy > 0 ? 2900 : 1900) * dt;
  const py = f.y;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.ground = false;
  if (f.vy >= 0) {
    for (const p of PLATS) {
      if (p.broken || (f.drop > 0 && !p.solid)) {
        continue;
      }
      if (py <= p.y + 1 && f.y >= p.y && f.x > p.x1 - 6 && f.x < p.x2 + 6) {
        if (f.stun > 0 && f.vy > 700) {
          f.vy *= -0.35;
          f.y = p.y - 1;
          puff(s, f.x, p.y, 6, C.wall2);
          continue;
        }
        if (f.vy > 500) {
          puff(s, f.x, p.y, 6, C.wall2);
          sfx(s, 'thud');
        }
        f.y = p.y;
        f.vy = 0;
        f.ground = true;
        f.jumps = 1;
        f.plat = p;
        break;
      }
    }
  }

  if (f.act) {
    f.act.t += ms;
  }
  if (f.hold) {
    f.hold.x = f.x;
    f.hold.y = f.y - 84;
  }
}

function readButtons(s, f, o, inp) {
  const t = s.mt;
  if (inp.b1) f.b1t = t;
  if (inp.b2) f.b2t = t;
  const combo = (inp.b1 && (inp.h2 || t - f.b2t < 120)) || (inp.b2 && (inp.h1 || t - f.b1t < 120));
  if (combo && f.calma >= 100 && (!f.act || (f.act.k !== 'hold' && f.act.t < 90))) {
    f.calma = 0;
    f.act = { k: 'remezon', t: 0 };
    sfx(s, 'charge');
    return;
  }
  if (f.act && f.act.k === 'hold') {
    if (inp.b2) f.act.t = 999;
    return;
  }
  if (f.act) {
    return;
  }
  if (f.hold && (inp.b1 || inp.b2)) {
    throwObj(s, f);
    return;
  }
  if (inp.b1) {
    f.act = { k: 'punch', t: 0 };
    sfx(s, 'whiff');
  } else if (inp.b2) {
    const ob = nearObj(s, f);
    if (ob) {
      ob.st = 'held';
      f.hold = ob;
      sfx(s, 'grab');
    } else {
      f.act = { k: 'grab', t: 0 };
    }
  } else if (inp.b3) {
    f.act = { k: 'parry', t: 0 };
  }
}

// Golpe vence agarre, parry vence golpe y objeto lanzado, agarre vence parry.
function resolveAction(s, f, o) {
  const a = f.act;
  if (!a) {
    return;
  }
  const reach = (x0, x1) => {
    const ax = f.face > 0 ? f.x + x0 : f.x - x1;
    const bx = f.face > 0 ? f.x + x1 : f.x - x0;
    return o.out <= 0 && o.x + 18 > ax && o.x - 18 < bx && o.y - 64 < f.y - 20 && o.y > f.y - 64;
  };
  if (a.k === 'punch') {
    if (!a.hit && a.t >= 70 && a.t <= 150 && reach(8, 62) && o.inv <= 0 && !o.grabbedBy) {
      a.hit = true;
      if (isParrying(o)) {
        parried(s, o, f);
      } else {
        hit(s, o, f.face, 9, 200, 7.5, 0.6);
        f.sty += 50;
      }
    }
    if (a.t > 280) f.act = null;
  } else if (a.k === 'grab') {
    if (!a.hit && a.t >= 180 && a.t <= 260 && reach(4, 52) && o.inv <= 0 && o.stun <= 0 && !o.grabbedBy) {
      a.hit = true;
      o.grabbedBy = f;
      o.act = null;
      dropHold(o);
      f.act = { k: 'hold', t: 0 };
      sfx(s, 'grab');
      return;
    }
    if (a.t > 460) f.act = null;
  } else if (a.k === 'hold') {
    if (a.t > 240) {
      // Se lanza hacia donde apunte el joystick: adelante, atrás o arriba.
      const inp = f.inp || {};
      const dir = inp.r ? 1 : inp.l ? -1 : f.face;
      o.grabbedBy = null;
      f.act = null;
      hit(s, o, dir, 16, 260, 8, inp.uh ? 1.3 : 0.8);
      f.sty += 100;
      sfx(s, 'throw');
    }
  } else if (a.k === 'remezon') {
    if (a.t >= 130) {
      f.act = null;
      remezon(s, f, o);
    }
  } else if (a.k === 'parry') {
    if (a.t > 420) f.act = null;
  } else if (a.k === 'throwing') {
    if (a.t > 220) f.act = null;
  }
}

function isParrying(f) {
  return f.act && f.act.k === 'parry' && f.act.t < 170;
}

function parried(s, f, attacker) {
  f.act = null;
  f.sty += 200;
  gainCalma(s, f, 34);
  attacker.act = null;
  attacker.daze = 350;
  attacker.vx = -attacker.face * 220;
  s.stop = 120;
  ring(s, f.x, f.y - 40, C.white);
  banner(s, '¡QUIETO!', '#ffffff', f.x, f.y - 120, 600);
  sfx(s, 'parry');
}

function hit(s, t, dir, dmg, base, growth, ang) {
  t.susto += dmg;
  const kb = base + t.susto * growth;
  t.vx = dir * kb * Math.cos(ang);
  t.vy = -kb * Math.sin(ang) - 120;
  t.stun = Math.min(900, 120 + t.susto * 2.2);
  const v = s.f[1 - t.i];
  if (v.grabbedBy === t) v.grabbedBy = null;
  t.act = null;
  t.ground = false;
  dropHold(t);
  s.stop = 60 + Math.min(60, dmg * 4);
  s.kick = Math.min(10, 2 + t.susto / 20);
  const big = t.susto > 90;
  if (big) flash(s, 0.35);
  puff(s, t.x, t.y - 36, big ? 16 : 9, big ? C.yellow : C.white);
  sfx(s, big ? 'bighit' : 'hit', t.susto);
}

function remezon(s, f, o) {
  const near = o.out <= 0 && o.inv <= 0 && Math.hypot(o.x - f.x, o.y - f.y) < 190;
  if (near && isParrying(o)) {
    parried(s, o, f);
    return;
  }
  flash(s, 0.6);
  s.stop = 140;
  s.kick = 12;
  ring(s, f.x, f.y - 30, C.yellow, 30);
  banner(s, '¡REMEZÓN!', '#ffd23f');
  sfx(s, 'remezon');
  for (const ob of s.objs) {
    if (ob.st !== 'held') {
      ob.vy = -420;
      ob.st = 'fall';
    }
  }
  if (near) {
    hit(s, o, o.x >= f.x ? 1 : -1, 14, 380, 8.5, 0.75);
    f.sty += 300;
  }
}

// Tope de un destello cada 333 ms, por fotosensibilidad.
function flash(s, a) {
  if (s.now - (s.flashT || 0) > 333) {
    s.flash = a;
    s.flashT = s.now;
  }
}

function gainCalma(s, f, n) {
  const o = s.f[1 - f.i];
  const losing = f.lives < o.lives || (f.lives === o.lives && f.susto > o.susto + 30);
  f.calma = Math.min(100, f.calma + n * (losing ? 1.5 : 1));
}

function checkOut(s, f) {
  if (f.out > 0 || s.mode === 'end') {
    return;
  }
  if (f.x > -70 && f.x < W + 70 && f.y < H + 90 && f.y > -300) {
    return;
  }
  const o = s.f[1 - f.i];
  f.lives--;
  f.out = 900;
  f.grabbedBy = null;
  dropHold(f);
  if (o.grabbedBy === f) o.grabbedBy = null;
  o.base += 1000;
  if (f.lives < o.lives) {
    f.behind = true;
  }
  const ex = Phaser.Math.Clamp(f.x, 10, W - 10);
  const ey = Phaser.Math.Clamp(f.y, 10, H - 10);
  for (let k = 0; k < 3; k++) {
    puff(s, ex, ey, 14, [C.white, C.yellow, f.i ? C.p2 : C.p1][k]);
  }
  flash(s, 0.5);
  s.kick = 12;
  sfx(s, 'ko');
  if (f.lives <= 0 || s.sudden) {
    endMatch(s, o);
  } else {
    banner(s, KO_TXT[(Math.random() * KO_TXT.length) | 0], '#ffffff');
  }
}

function respawn(s, f) {
  f.x = f.i ? 520 : 280;
  f.y = 120;
  f.vx = 0;
  f.vy = 0;
  f.susto = 0;
  f.stun = 0;
  f.daze = 0;
  f.act = null;
  f.inv = 1500;
  f.out = 0;
}

function dropHold(f) {
  if (f.hold) {
    f.hold.st = 'fall';
    f.hold.vy = -100;
    f.hold = null;
  }
}

// ---------- Temblor ----------

function updateQuake(s, dt) {
  let ph = 0;
  for (let i = 0; i < GRADOS.length; i++) {
    if (s.mt >= GRADOS[i].t) ph = i;
  }
  const next = GRADOS[ph + 1];
  if (next && s.warned !== ph + 1) {
    const lead = next.g === 6 ? 3000 : 1500;
    if (next.t - s.mt <= lead) {
      s.warned = ph + 1;
      sfx(s, 'alert');
      if (next.g === 6) {
        s.countdown = s.mt;
      }
    }
  }
  if (ph !== s.phase) {
    s.phase = ph;
    const g = GRADOS[ph];
    s.maxG = Math.max(s.maxG, g.g);
    if (ph > 0) {
      sfx(s, 'rumble', g.g);
      s.kick = 4 + g.g;
      s.hud.phrasePop = s.now;
    }
    if (g.tele) {
      spawnObj(s, 'tele', 400, -40);
    }
    if (g.breaks) {
      for (const p of PLATS) {
        if (p.shelf) {
          p.broken = true;
          for (let k = 0; k < 3; k++) puff(s, (p.x1 + p.x2) / 2, p.y, 10, C.wood);
        }
      }
      sfx(s, 'break');
    }
  }
  const g = GRADOS[ph];
  if (g.drop) {
    s.dropT -= dt * 1000;
    if (s.dropT <= 0 && s.objs.length < 8) {
      s.dropT = g.drop;
      const shelf = PLATS[2 + ((Math.random() * 2) | 0)];
      const x = shelf.broken ? 200 + Math.random() * 400 : shelf.x1 + 20 + Math.random() * (shelf.x2 - shelf.x1 - 40);
      spawnObj(s, DROP_KINDS[(Math.random() * DROP_KINDS.length) | 0], x, shelf.broken ? -20 : shelf.y - 30);
    }
  }
  if (g.lateral) {
    s.lat.t += dt * 1000;
    if (s.lat.t > 3000) {
      s.lat.t = 0;
      s.lat.dir *= -1;
    }
    s.lat.k = Math.sin((s.lat.t / 3000) * Math.PI);
  } else {
    s.lat.k = 0;
  }
  // Desde el grado 6: polvo del techo y retumbos.
  if (g.g >= 6) {
    s.rumbleT = (s.rumbleT || 0) - dt * 1000;
    if (s.rumbleT <= 0) {
      s.rumbleT = 1200;
      sfx(s, 'rumble', g.g - 2);
    }
    if (Math.random() < dt * 8) {
      s.parts.push({ x: 110 + Math.random() * 580, y: 154, vx: 0, vy: 40, l: 1.2, c: C.wall2, z: 3 });
    }
  }
  if (s.phase >= 0) {
    for (const f of s.f) {
      if (f.out <= 0 && GRADOS[s.phase].g === 8) {
        f.sty += 20 * dt;
      }
    }
  }
}

// ---------- Objetos ----------

function spawnObj(s, k, x, y) {
  s.objs.push({ k, x, y, vx: (Math.random() - 0.5) * 60, vy: 0, st: 'fall', own: null, rot: 0 });
}

function nearObj(s, f) {
  let best = null;
  for (const ob of s.objs) {
    if (ob.st === 'ground' && Math.abs(ob.x - f.x) < 44 && Math.abs(ob.y - f.y) < 40) {
      best = ob;
    }
  }
  return best;
}

function throwObj(s, f) {
  const ob = f.hold;
  const heavy = OBJS[ob.k].heavy;
  f.hold = null;
  ob.st = 'fly';
  ob.own = f;
  ob.x = f.x + f.face * 30;
  ob.y = f.y - 50;
  ob.vx = f.face * (heavy ? 520 : 780);
  ob.vy = -150;
  f.act = { k: 'throwing', t: 0 };
  sfx(s, 'throw');
}

function stepObjects(s, dt) {
  for (let i = s.objs.length - 1; i >= 0; i--) {
    const ob = s.objs[i];
    const d = OBJS[ob.k];
    if (ob.st === 'held') {
      continue;
    }
    const py = ob.y;
    ob.vy += (ob.st === 'fly' ? 700 : 1500) * dt;
    ob.x += ob.vx * dt;
    ob.y += ob.vy * dt;
    if (ob.st !== 'ground') ob.rot += ob.vx * dt * 0.02;

    for (const f of s.f) {
      if (f.out > 0 || f.inv > 0 || f === ob.own || f.grabbedBy) {
        continue;
      }
      if (Math.abs(ob.x - f.x) < 18 + d.w / 2 && ob.y > f.y - 64 && ob.y - d.h < f.y) {
        if (ob.st === 'fly') {
          if (isParrying(f)) {
            ob.vx = -ob.vx * 1.1;
            ob.own = f;
            f.act = null;
            f.sty += 200;
            gainCalma(s, f, 34);
            ring(s, f.x, f.y - 40, C.white);
            banner(s, '¡DEVUELTA!', '#ffffff', f.x, f.y - 120, 600);
            sfx(s, 'parry');
            s.stop = 100;
          } else {
            hit(s, f, Math.sign(ob.vx), d.dmg, 260, d.heavy ? 8 : 6, 0.55);
            ob.own.sty += 150;
            banner(s, d.word, '#ffd23f', f.x, f.y - 120, 700);
            breakObj(s, i, ob);
          }
          break;
        } else if (ob.st === 'fall' && ob.vy > 320) {
          hit(s, f, ob.x < f.x ? 1 : -1, 4, 120, 3, 1.1);
          breakObj(s, i, ob);
          break;
        }
      }
    }
    if (!s.objs.includes(ob)) {
      continue;
    }

    if (ob.vy >= 0) {
      for (const p of PLATS) {
        if (p.broken) continue;
        if (py <= p.y && ob.y >= p.y && ob.x > p.x1 && ob.x < p.x2) {
          if (ob.st === 'fly' && d.brk) {
            breakObj(s, i, ob);
          } else {
            ob.y = p.y;
            ob.vy = ob.st === 'fly' ? -ob.vy * 0.3 : 0;
            ob.vx *= 0.5;
            if (ob.st !== 'ground') ob.gt = s.mt;
            ob.st = 'ground';
            ob.own = null;
            ob.rot = 0;
          }
          break;
        }
      }
    }
    if (ob.st === 'ground') {
      ob.vx = approach(ob.vx, 0, 600 * dt);
      ob.st = PLATS.some((p) => !p.broken && Math.abs(ob.y - p.y) < 2 && ob.x > p.x1 && ob.x < p.x2) ? 'ground' : 'fall';
    }
    if (ob.y > H + 60 || ob.x < -80 || ob.x > W + 80 || (ob.st === 'ground' && s.mt - ob.gt > 8000)) {
      s.objs.splice(i, 1);
    }
  }
}

function breakObj(s, i, ob) {
  const d = OBJS[ob.k];
  s.objs.splice(i, 1);
  puff(s, ob.x, ob.y - d.h / 2, 12, ob.k === 'pan' ? 0xd9a35b : C.white);
  sfx(s, d.brk ? 'break' : 'thud');
}

// ---------- CPU ----------

function cpuIntent(s, f, o, dt) {
  const ai = f.ai;
  ai.t -= dt * 1000;
  const w = ai.w;
  const out = { l: w.l, r: w.r, d: false, up: false, uh: false, b1: false, b2: false, b3: false, h1: false, h2: false, dn: false };
  const dx = o.x - f.x;
  const adx = Math.abs(dx);
  const toward = (x) => {
    w.l = x < f.x - 8;
    w.r = x > f.x + 8;
  };

  // Lo primero: volver al piso si está volando afuera.
  if (!f.ground && (f.x < FLOOR.x1 + 20 || f.x > FLOOR.x2 - 20)) {
    toward(W / 2);
    out.l = w.l;
    out.r = w.r;
    out.up = f.vy > 0 && f.jumps > 0 && f.y > 330;
    return out;
  }
  if (o.act && o.act.k === 'punch' && o.act.t < 50 && adx < 80 && Math.random() < 0.12) {
    out.b3 = true;
    return out;
  }
  if (ai.t > 0) {
    return out;
  }
  ai.t = 140 + Math.random() * 160;
  w.l = w.r = false;

  const g = GRADOS[Math.max(0, s.phase)];
  if (g.lateral && Math.random() < 0.35) {
    const door = DOORS[f.x < W / 2 ? 0 : 1];
    toward((door.x1 + door.x2) / 2);
    return out;
  }
  if (f.calma >= 100 && adx < 150) {
    out.b1 = true;
    out.h2 = true;
    return out;
  }
  if (f.hold) {
    f.face = Math.sign(dx) || f.face;
    if (Math.abs(o.y - f.y) < 50 && adx > 60) {
      out.b2 = true;
    } else {
      toward(o.x - Math.sign(dx) * 160);
    }
    return out;
  }
  const ob = s.objs.find((b) => b.st === 'ground' && Math.abs(b.x - f.x) < 220);
  if (ob && adx > 140) {
    if (Math.abs(ob.x - f.x) < 30) {
      out.b2 = true;
    } else {
      toward(ob.x);
    }
    return out;
  }
  if (adx > 52) {
    toward(o.x);
    if (o.y < f.y - 50 && Math.random() < 0.5) out.up = true;
    return out;
  }
  f.face = Math.sign(dx) || f.face;
  const r = Math.random();
  if (r < 0.5) out.b1 = true;
  else if (r < 0.72) out.b2 = true;
  else if (r < 0.82) out.up = true;
  else toward(f.x - dx * 3);
  return out;
}

// ---------- Fin de partido, iniciales y records ----------

function endMatch(s, winner) {
  if (s.mode === 'demo') {
    s.winner = winner;
    s.mode = 'end';
    s.endT = 0;
    s.entries = [];
    showEnd(s);
    return;
  }
  s.mode = 'end';
  s.winner = winner;
  s.endT = 0;
  winner.base += 2000;
  if (winner.behind) {
    winner.base += 1000;
    winner.comeback = true;
  }
  sfx(s, 'win');
  s.entries = [];
  for (const f of s.f) {
    const sc = score(f);
    const qualifies = s.records.top.length < MAX_RECORDS || sc > s.records.top[s.records.top.length - 1].s;
    if (!f.cpu && (f === winner || qualifies)) {
      const def = f.i ? [15, 14, 22] : [15, 20, 12];
      s.entries.push({ f, letters: (s.lastName && s.lastName[f.i]) || def, pos: 0, done: false, cool: 0 });
    }
  }
  showEnd(s);
}

function score(f) {
  return Math.round(f.base + Math.min(3000, f.sty));
}

function updateEnd(s, dt) {
  s.endT += dt * 1000;
  stepParticles(s, dt);
  const pr = s.controls.pressed;
  const h = s.controls.held;
  if (s.endT < 600) {
    return;
  }
  const wasDemo = !s.entries.length && s.f.every((f) => f.cpu);
  if (wasDemo) {
    if (s.endT > 3500 || pr.START1 || pr.START2) {
      startMatch(s, [!!pr.START1, !!pr.START2], !(pr.START1 || pr.START2));
    }
    return;
  }
  for (const e of s.entries) {
    if (e.done) continue;
    const p = 'P' + (e.f.i + 1) + '_';
    e.cool -= dt * 1000;
    if (e.cool <= 0) {
      if (h[p + 'U'] || h[p + 'D']) {
        e.letters[e.pos] = (e.letters[e.pos] + (h[p + 'U'] ? 25 : 1)) % 26;
        e.cool = 150;
        sfx(s, 'select');
      } else if (h[p + 'L'] || h[p + 'R']) {
        e.pos = Phaser.Math.Clamp(e.pos + (h[p + 'R'] ? 1 : -1), 0, 2);
        e.cool = 180;
      }
    }
    if (pr[p + '1']) {
      if (e.pos < 2) {
        e.pos++;
      } else {
        e.done = true;
        sfx(s, 'parry');
      }
    }
  }
  refreshEnd(s);
  const all = s.entries.every((e) => e.done);
  const start = (pr.START1 || pr.START2) && s.endT > 1500;
  if ((all || start || s.endT > 20000) && !s.saved) {
    saveEntries(s);
  }
  if (s.saved && (start || s.endT > (s.entries.length ? 25000 : 8000))) {
    if (start) {
      startMatch(s, s.f.map((f) => !f.cpu), false);
    } else {
      startMatch(s, [false, false], true);
    }
  }
}

function saveEntries(s) {
  s.saved = true;
  s.lastName = s.lastName || [];
  const r = s.records;
  for (const e of s.entries) {
    const n = e.letters.map((c) => String.fromCharCode(65 + c)).join('');
    s.lastName[e.f.i] = e.letters.slice();
    r.top.push({ n, s: score(e.f), g: s.maxG });
    if (e.f === s.winner && s.f.every((f) => !f.cpu)) {
      r.rey = r.rey && r.rey.n === n ? { n, r: r.rey.r + 1 } : { n, r: 1 };
    }
  }
  r.top.sort((a, b) => b.s - a.s);
  r.top.length = Math.min(r.top.length, MAX_RECORDS);
  storageSet(STORAGE_KEY, r).catch(() => {});
  refreshRecords(s);
  refreshEnd(s);
}

async function loadRecords() {
  try {
    const res = await storageGet(STORAGE_KEY);
    const v = res && res.found ? res.value : null;
    const top = v && Array.isArray(v.top)
      ? v.top
          .filter((e) => e && typeof e.n === 'string' && /^[A-Z]{3}$/.test(e.n) && Number.isFinite(e.s) && Number.isFinite(e.g))
          .slice(0, MAX_RECORDS)
      : [];
    const rey = v && v.rey && typeof v.rey.n === 'string' && /^[A-Z]{3}$/.test(v.rey.n) && Number.isFinite(v.rey.r) ? v.rey : null;
    return { top, rey };
  } catch (e) {
    return { top: [], rey: null };
  }
}

// ---------- Partículas y efectos ----------

function puff(s, x, y, n, c) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 60 + Math.random() * 260;
    s.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, l: 0.4 + Math.random() * 0.4, c, z: 3 + ((Math.random() * 4) | 0) });
  }
  if (s.parts.length > 220) s.parts.splice(0, s.parts.length - 220);
}

function ring(s, x, y, c, n) {
  for (let i = 0; i < (n || 16); i++) {
    const a = (i / (n || 16)) * Math.PI * 2;
    s.parts.push({ x, y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, l: 0.3, c, z: 5, ng: true });
  }
}

function stepParticles(s, dt) {
  for (let i = s.parts.length - 1; i >= 0; i--) {
    const p = s.parts[i];
    p.l -= dt;
    if (p.l <= 0) {
      s.parts.splice(i, 1);
      continue;
    }
    if (!p.ng) p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function banner(s, msg, color, x, y, ms) {
  const t = txt(s, x || W / 2, y || 250, msg, x ? 26 : 44, color, 8).setDepth(30);
  if (x) s.world.add(t);
  t.setScale(0.4);
  s.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
  s.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: ms || 1000, duration: 300, onComplete: () => t.destroy() });
}

function approach(v, target, step) {
  return v > target ? Math.max(target, v - step) : Math.min(target, v + step);
}

function txt(s, x, y, str, size, color, stroke) {
  return s.add
    .text(x, y, str, {
      fontFamily: '"Courier New", monospace',
      fontSize: size + 'px',
      fontStyle: 'bold',
      color: color || '#ffffff',
      stroke: '#14101a',
      strokeThickness: stroke || 6,
      align: 'center',
    })
    .setOrigin(0.5);
}

// ---------- Dibujo ----------

function drawBackground(g) {
  // Noche de Santiago con la cordillera nevada detrás.
  g.fillStyle(C.night).fillRect(0, 0, W, H);
  g.fillStyle(C.sky).fillRect(0, 300, W, 300);
  g.fillStyle(C.mount);
  g.fillPoints(pts([0, 330, 90, 250, 170, 300, 290, 200, 400, 280, 520, 190, 640, 270, 730, 220, 800, 260, 800, 600, 0, 600]), true);
  g.fillStyle(C.snow);
  for (const [x, y] of [[290, 200], [520, 190], [90, 250], [730, 220]]) {
    g.fillTriangle(x, y, x - 26, y + 22, x + 26, y + 22);
  }
  g.fillStyle(C.yellow, 0.8);
  for (let i = 0; i < 60; i++) {
    g.fillRect((i * 97) % W, 470 + ((i * 53) % 120), 3, 3);
  }
  g.fillStyle(C.white, 0.7);
  for (let i = 0; i < 40; i++) {
    g.fillRect((i * 151) % W, (i * 71) % 180, 2, 2);
  }

  // El departamento en corte.
  g.fillStyle(C.wall).fillRect(100, 150, 600, 350);
  g.fillStyle(C.wall2);
  for (let x = 112; x < 700; x += 36) g.fillRect(x, 150, 12, 350);
  g.fillStyle(C.ink).fillRect(94, 140, 612, 12);
  // Ventana con la cordillera.
  g.fillStyle(C.ink).fillRect(342, 186, 116, 96);
  g.fillStyle(C.sky).fillRect(348, 192, 104, 84);
  g.fillStyle(C.mount).fillTriangle(348, 276, 392, 222, 436, 276);
  g.fillStyle(C.snow).fillTriangle(392, 222, 380, 236, 404, 236);
  g.fillStyle(C.ink).fillRect(397, 192, 6, 84).fillRect(348, 232, 104, 5);
  // Marcos de puerta.
  for (const d of DOORS) {
    g.fillStyle(C.wood2).fillRect(d.x1 - 8, 372, d.x2 - d.x1 + 16, 128);
    g.fillStyle(0x2a1a2e).fillRect(d.x1, 380, d.x2 - d.x1, 120);
  }
  // Piso de parquet y losa.
  g.fillStyle(C.wood).fillRect(FLOOR.x1, FLOOR.y, FLOOR.x2 - FLOOR.x1, 16);
  g.fillStyle(C.wood2);
  for (let x = FLOOR.x1; x < FLOOR.x2; x += 40) g.fillRect(x, FLOOR.y, 3, 16);
  g.fillStyle(0x7a7a8c).fillRect(FLOOR.x1, FLOOR.y + 16, FLOOR.x2 - FLOOR.x1, 22);
  g.fillStyle(C.ink).fillRect(FLOOR.x1, FLOOR.y + 38, FLOOR.x2 - FLOOR.x1, 4);
  // Mesa de la once con mantel.
  const m = PLATS[1];
  g.fillStyle(C.wood2).fillRect(m.x1 + 14, m.y, 12, FLOOR.y - m.y).fillRect(m.x2 - 26, m.y, 12, FLOOR.y - m.y);
  g.fillStyle(C.cloth).fillRect(m.x1, m.y - 4, m.x2 - m.x1, 26);
  g.fillStyle(C.white);
  for (let x = m.x1; x < m.x2; x += 20) g.fillRect(x, m.y - 4, 10, 13).fillRect(x + 10, m.y + 9, 10, 13);
}

function pts(a) {
  const out = [];
  for (let i = 0; i < a.length; i += 2) out.push({ x: a[i], y: a[i + 1] });
  return out;
}

function render(s, t) {
  const g = s.dyn;
  g.clear();
  const ph = GRADOS[Math.max(0, s.phase)];
  const env = 0.35 + 0.65 * Math.max(0, Math.sin(t / 650));
  const amp = s.mode === 'end' ? 0 : Math.min(4, ph.amp * env) + s.kick;
  s.kick = Math.max(0, s.kick - 0.6);
  s.world.x = W / 2 + (Math.random() - 0.5) * amp;
  s.world.y = H / 2 + (Math.random() - 0.5) * amp;
  s.world.rotation = s.lat.k * s.lat.dir * 0.04;

  // Repisas y lámpara.
  for (const p of PLATS) {
    if (!p.shelf) continue;
    if (p.broken) {
      g.fillStyle(C.wood).fillTriangle(p.x1, p.y, p.x1 + 16, p.y, p.x1 + 6, p.y + 60);
    } else {
      g.fillStyle(C.ink).fillRect(p.x1 - 2, p.y - 2, p.x2 - p.x1 + 4, 14);
      g.fillStyle(C.wood).fillRect(p.x1, p.y, p.x2 - p.x1, 10);
      g.fillStyle(C.wood2).fillRect(p.x1 + 10, p.y + 10, 8, 16).fillRect(p.x2 - 18, p.y + 10, 8, 16);
    }
  }
  const sw = s.phase >= 4 ? Math.sin(t / 260) * 0.5 : Math.sin(t / 900) * 0.06 * ph.amp;
  const lx = 400 + Math.sin(sw) * 70;
  const ly = 152 + Math.cos(sw) * 70;
  g.lineStyle(3, C.ink).lineBetween(400, 152, lx, ly);
  g.fillStyle(C.ink).fillTriangle(lx - 20, ly + 18, lx + 20, ly + 18, lx, ly - 2);
  g.fillStyle(C.yellow).fillCircle(lx, ly + 20, 6);

  if (ph.g >= 6) {
    // Grieta en la pared.
    g.lineStyle(3, C.wood2).beginPath();
    g.moveTo(560, 152);
    for (const [cx, cy] of [[548, 190], [566, 214], [552, 250], [574, 280]]) g.lineTo(cx, cy);
    g.strokePath();
  }
  for (const ob of s.objs) drawObj(s, g, ob);
  for (const f of s.f) drawFighter(s, g, f, t);
  for (const p of s.parts) {
    g.fillStyle(p.c, Math.min(1, p.l * 3)).fillRect(p.x - p.z / 2, p.y - p.z / 2, p.z, p.z);
  }
  // Grado 7: parpadea la luz.
  if (ph.g === 7 && s.mode !== 'end' && Math.sin(t / 37) > 0.93) {
    g.fillStyle(C.ink, 0.35).fillRect(100, 150, 600, 350);
  }
  drawHud(s, t);
}

function box(g, x, y, w, h, c) {
  if (w < 0) {
    x += w;
    w = -w;
  }
  g.fillStyle(C.ink).fillRect(x - 3, y - 3, w + 6, h + 6);
  g.fillStyle(c).fillRect(x, y, w, h);
}

function circ(g, x, y, r, c) {
  g.fillStyle(C.ink).fillCircle(x, y, r + 3);
  g.fillStyle(c).fillCircle(x, y, r);
}

function drawFighter(s, g, f, t) {
  const tag = s.tags[f.i];
  if (f.out > 0 || (f.inv > 0 && ((t / 70) | 0) % 2)) {
    tag.setVisible(f.out <= 0);
    return;
  }
  const col = f.i ? C.p2 : C.p1;
  const d = f.face;
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  const a = f.act ? f.act.k : '';
  const hurt = f.stun > 0 || f.grabbedBy;
  const run = f.ground && Math.abs(f.vx) > 40 ? Math.sin(t / 55) : 0;

  // Piernas.
  if (f.ground) {
    box(g, x - 12 + run * 6, y - 20, 9, 20, PANTS);
    box(g, x + 3 - run * 6, y - 20, 9, 20, PANTS);
  } else {
    box(g, x - 13, y - 22, 10, 14, PANTS);
    box(g, x + 3, y - 18, 10, 14, PANTS);
  }
  // Cuerpo con polera.
  box(g, x - 15, y - 48, 30, 30, col);
  g.fillStyle(C.white).fillRect(x - 15, y - 36, 30, 4);

  // Brazos según la acción.
  const sh = y - 44;
  if (a === 'punch') {
    const ext = f.act.t >= 70 && f.act.t <= 150 ? 34 : 14;
    box(g, x + d * 12, sh, d * ext, 9, col);
    box(g, x + d * (12 + ext), sh - 2, d * 12, 13, C.skin);
    box(g, x - d * 14, sh + 4, -d * 8, 18, col);
  } else if (a === 'grab' || a === 'hold') {
    const ext = a === 'hold' || f.act.t >= 180 ? 30 : 12;
    box(g, x + d * 10, sh - 2, d * ext, 8, col);
    box(g, x + d * 10, sh + 10, d * ext, 8, col);
  } else if (f.hold || a === 'throwing') {
    box(g, x - 18, y - 80, 8, 34, col);
    box(g, x + 10, y - 80, 8, 34, col);
  } else if (a === 'parry') {
    box(g, x + d * 10, y - 62, 9, 24, col);
    box(g, x + d * 20, y - 62, 9, 24, col);
    if (f.act.t < 170) {
      g.lineStyle(4, C.white, 1 - f.act.t / 170).strokeCircle(x, y - 40, 44);
    }
  } else if (a === 'remezon') {
    g.lineStyle(6, C.yellow, 0.9).strokeCircle(x, y - 40, 20 + f.act.t);
    box(g, x - 22, y - 76, 8, 30, col);
    box(g, x + 14, y - 76, 8, 30, col);
  } else if (hurt) {
    box(g, x - 22, y - 70, 8, 24, col);
    box(g, x + 14, y - 70, 8, 24, col);
  } else {
    box(g, x - 22, sh, 8, 22, col);
    box(g, x + 14, sh, 8, 22, col);
  }

  // Cabeza y cara: el susto se lee en la cara.
  const hx = x + d * 2;
  const hy = y - 64;
  circ(g, hx, hy, 16, C.skin);
  g.fillStyle(C.hair).fillRect(hx - 15, hy - 16, 30, 8).fillRect(hx - d * 15 - 3, hy - 12, 6, 10);
  const ex = hx + d * 5;
  if (f.daze > 0) {
    g.lineStyle(3, C.ink);
    for (const o of [-5, 5]) {
      g.lineBetween(ex + o - 3, hy - 4, ex + o + 3, hy + 2).lineBetween(ex + o + 3, hy - 4, ex + o - 3, hy + 2);
    }
    for (let k = 0; k < 3; k++) {
      const an = t / 150 + (k * Math.PI * 2) / 3;
      g.fillStyle(C.yellow).fillCircle(hx + Math.cos(an) * 22, hy - 22 + Math.sin(an) * 6, 4);
    }
  } else if (f.susto < 50) {
    g.fillStyle(C.ink).fillRect(ex - 6, hy - 4, 4, 6).fillRect(ex + 4, hy - 4, 4, 6).fillRect(ex - 3, hy + 7, 8, 3);
  } else {
    const big = f.susto >= 100;
    for (const o of [-5, 6]) {
      g.fillStyle(C.white).fillCircle(ex + o, hy - 2, big ? 6 : 5);
      g.fillStyle(C.ink).fillCircle(ex + o + d, hy - 2, big ? 2 : 3);
    }
    g.fillStyle(C.ink).fillEllipse(ex, hy + 9, big ? 10 : 6, big ? 10 : 6);
    if (big) g.fillStyle(0x7fd4ff).fillCircle(hx - d * 15, hy - 6 + ((t / 40) % 10), 4);
  }

  tag.setVisible(true);
  tag.setPosition(x, y - 104);
  tag.setText(f.cpu ? 'CPU' : 'P' + (f.i + 1));
}

function drawObj(s, g, ob) {
  const d = OBJS[ob.k];
  if (ob.st === 'ground' && s.mt - ob.gt > 7000 && ((s.now / 90) | 0) % 2) return;
  const x = ob.x;
  const y = ob.y - d.h / 2;
  if (ob.k === 'tele') {
    box(g, x - 22, y - 19, 44, 38, 0x5c5c6e);
    g.fillStyle(0x9fe0c8).fillRect(x - 15, y - 13, 26, 24);
    g.lineStyle(2, C.ink).lineBetween(x - 4, y - 19, x - 14, y - 34).lineBetween(x + 4, y - 19, x + 14, y - 34);
  } else if (ob.k === 'tetera') {
    circ(g, x, y + 2, 11, C.white);
    box(g, x + 10, y - 2, 8, 4, C.white);
    g.fillStyle(C.cloth).fillRect(x - 6, y - 4, 12, 3);
  } else if (ob.k === 'taza') {
    box(g, x - 7, y - 6, 12, 13, C.white);
    g.lineStyle(3, C.ink).strokeCircle(x + 8, y, 4);
  } else if (ob.k === 'pan') {
    // Marraqueta: cuatro puntas con la palta asomando.
    for (const o of [-8, 8]) {
      g.fillStyle(C.ink).fillEllipse(x + o, y, 20, 20);
      g.fillStyle(0xd9a35b).fillEllipse(x + o, y, 14, 14);
    }
    g.fillStyle(0x6fa83a).fillRect(x - 12, y - 1, 24, 4);
    g.lineStyle(2, 0x8a5a24).lineBetween(x, y - 7, x, y + 7);
  } else {
    box(g, x - 7, y - 9, 14, 18, 0xb0243a);
    g.fillStyle(C.white).fillRect(x - 7, y - 9, 14, 4);
  }
}

// ---------- HUD ----------

function createHud(s) {
  const hud = { g: s.add.graphics().setDepth(10), trace: [] };
  s.hud = hud;
  hud.grado = txt(s, W / 2, 52, '3', 72, '#ffd23f', 10).setDepth(11);
  hud.label = txt(s, W / 2 - 70, 30, 'GRADO', 14, '#ffffff', 4).setDepth(11);
  hud.phrase = txt(s, W / 2, 122, '', 26, '#ffffff', 7).setDepth(11);
  hud.clock = txt(s, W / 2 + 76, 30, '', 16, '#ffffff', 4).setDepth(11);
  hud.big = txt(s, W / 2, 300, '', 96, '#ff3b3b', 12).setDepth(12);
  hud.side = [0, 1].map((i) => {
    const x = i ? W - 110 : 110;
    const color = i ? '#ff8a1f' : '#2ec7ff';
    return {
      name: txt(s, x, 24, 'P' + (i + 1), 22, color, 5).setDepth(11),
      pct: txt(s, x, 84, '0%', 56, '#ffffff', 9).setDepth(11).setStroke(color, 9),
      score: txt(s, x, 132, '0', 28, '#ffffff', 6).setDepth(11),
      calma: txt(s, x, 228, 'CALMA', 14, '#ffffff', 4).setDepth(11),
    };
  });
  // Scanlines suaves.
  const sl = s.add.graphics().setDepth(40);
  sl.fillStyle(0x000000, 0.12);
  for (let y = 0; y < H; y += 3) sl.fillRect(0, y, W, 1);
  s.flashRect = s.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(35);
}

function drawHud(s, t) {
  const hud = s.hud;
  const g = hud.g;
  g.clear();
  const ph = GRADOS[Math.max(0, s.phase)];

  // Sismógrafo.
  g.fillStyle(C.ink, 0.85).fillRect(W / 2 - 110, 8, 220, 92);
  g.lineStyle(3, C.yellow).strokeRect(W / 2 - 110, 8, 220, 92);
  hud.trace.push(Math.sin(t / 30) * ph.amp * 4 * (0.4 + Math.random() * 0.6));
  if (hud.trace.length > 100) hud.trace.shift();
  g.lineStyle(2, 0xff3b3b, 0.9).beginPath();
  hud.trace.forEach((v, i) => (i ? g.lineTo(W / 2 - 105 + i * 2.1, 78 + v) : g.moveTo(W / 2 - 105, 78 + v)));
  g.strokePath();

  hud.grado.setText(String(ph.g));
  hud.grado.setScale(1 + Math.max(0, 0.6 - (t - (hud.phrasePop || 0)) / 500));
  hud.phrase.setText(s.sudden ? '¡MUERTE SÚBITA!' : ph.txt);
  const left = Math.max(0, Math.ceil((MATCH_MS - s.mt) / 1000));
  hud.clock.setText(s.sudden ? '∞' : left + 's');

  // Cuenta del grado 6: el momento para el público.
  const cd = s.countdown != null ? s.mt - s.countdown : -1;
  if (cd >= 0 && cd < 3600 && s.mode !== 'end') {
    const n = 3 - Math.floor(cd / 1000);
    hud.big.setText(n > 0 ? '¡TEMBLOR!\n' + n : '¡TEMBLOR!');
    hud.big.setVisible(((t / 120) | 0) % 2 === 0 || n <= 0);
  } else {
    hud.big.setVisible(false);
  }

  s.f.forEach((f, i) => {
    const side = hud.side[i];
    const x = i ? W - 110 : 110;
    side.name.setText(f.cpu ? 'CPU' : 'P' + (i + 1));
    side.pct.setText(Math.round(f.susto) + '%');
    side.pct.setColor(f.susto >= 100 ? '#ff3b3b' : f.susto >= 50 ? '#ffd23f' : '#ffffff');
    side.score.setText(String(score(f)));
    // Vidas: cabezas grandes con la polera de cada uno.
    for (let k = 0; k < 2; k++) {
      const cx = x - 28 + k * 56;
      circ(g, cx, 174, 20, k < f.lives ? (i ? C.p2 : C.p1) : 0x444455);
      if (k < f.lives) g.fillStyle(C.skin).fillCircle(cx, 178, 12);
    }
    // Barra de calma: llena, se pide el remezón.
    const full = f.calma >= 100;
    g.fillStyle(C.white).fillRect(x - 74, 198, 148, 18);
    g.fillStyle(C.ink).fillRect(x - 72, 200, 144, 14);
    g.fillStyle(full ? (((t / 100) | 0) % 2 ? C.yellow : C.white) : i ? C.p2 : C.p1).fillRect(x - 70, 202, 1.4 * f.calma, 10);
    side.calma.setText(full ? '¡B1+B2: REMEZÓN!' : 'CALMA');
    side.calma.setColor(full ? '#ffd23f' : '#ffffff');
  });

  s.flash = Math.max(0, s.flash - 0.04);
  s.flashRect.setAlpha(s.flash);
}

// ---------- Pantallas ----------

function createOverlays(s) {
  const t = s.add.container(0, 0).setDepth(20);
  t.add(s.add.rectangle(W / 2, 250, W, 140, C.ink, 0.55));
  t.add(s.add.rectangle(W / 2, 572, W, 56, C.ink, 0.7));
  const title = txt(s, W / 2, 232, '¿SE MOVIÓ?', 76, '#ffd23f', 12);
  t.add(title);
  s.tweens.add({ targets: title, angle: { from: -2, to: 2 }, duration: 90, yoyo: true, repeat: -1 });
  t.add(txt(s, W / 2, 296, 'TEMBLOR GRADO 8', 26, '#ffffff', 6));
  const start = txt(s, W / 2, 560, 'PRESIONA START', 30, '#2ec7ff', 7);
  t.add(start);
  s.tweens.add({ targets: start, alpha: 0.15, duration: 450, yoyo: true, repeat: -1 });
  s.info = txt(s, W / 2, 588, '', 18, '#ffffff', 5);
  t.add(s.info);
  s.title = t;
  s.infoPage = 0;
  s.time.addEvent({ delay: 2500, loop: true, callback: () => refreshRecords(s, true) });

  const e = s.add.container(0, 0).setDepth(25);
  e.add(s.add.rectangle(W / 2, H / 2, W, H, C.ink, 0.92));
  s.endTitle = txt(s, W / 2, 120, '', 54, '#ffd23f', 10);
  s.endSub = txt(s, W / 2, 180, '', 26, '#ffffff', 6);
  s.endBody = txt(s, W / 2, 330, '', 22, '#ffffff', 5);
  s.endHint = txt(s, W / 2, 540, '', 20, '#2ec7ff', 5);
  e.add([s.endTitle, s.endSub, s.endBody, s.endHint]);
  s.endUi = e.setVisible(false);
}

function refreshRecords(s, advance) {
  const r = s.records;
  const pages = [
    'SÁCALO DE LA PANTALLA ANTES DEL GRADO 8',
    'B1 GOLPE · B2 AGARRA/LANZA · B3 ¡QUIETO!',
    'BARRA DE CALMA LLENA + B1+B2: ¡REMEZÓN!',
    r.rey ? `REY DEL MUEBLE: ${r.rey.n} · ${r.rey.r} SEGUIDAS` : 'REY DEL MUEBLE: SE BUSCA',
  ].concat(r.top.slice(0, 3).map((e, i) => `LOS QUE AGUANTARON ${i + 1}. ${e.n} ${e.s} PTS · GRADO ${e.g}`));
  if (advance) s.infoPage = (s.infoPage + 1) % pages.length;
  s.info.setText(pages[s.infoPage % pages.length]);
}

function showEnd(s) {
  s.saved = false;
  s.endUi.setVisible(true);
  s.title.setVisible(false);
  refreshEnd(s);
}

function refreshEnd(s) {
  const w = s.winner;
  const demo = s.f.every((f) => f.cpu);
  s.endTitle.setText((w.cpu && !demo ? 'GANA LA CPU' : 'GANA ' + (w.cpu ? 'CPU ' + (w.i + 1) : 'P' + (w.i + 1))) + (w.comeback ? '\n¡REMONTADA!' : ''));
  s.endTitle.setColor(w.i ? '#ff8a1f' : '#2ec7ff');
  const head = s.maxG >= 8 ? '¡Y NI SE DERRAMÓ EL TÉ!' : s.maxG >= 6 ? 'SIN DAÑOS QUE LAMENTAR' : 'ESO NI ERA TEMBLOR';
  s.endSub.setText(`SOBREVIVIÓ: GRADO ${s.maxG}\n${head}`);
  let body = s.f.map((f) => `${f.cpu ? 'CPU' : 'P' + (f.i + 1)}  ${score(f)} PTS`).join('      ');
  for (const e of s.entries) {
    const n = e.letters.map((c, k) => (k === e.pos && !e.done && ((s.now / 200) | 0) % 2 ? '_' : String.fromCharCode(65 + c))).join(' ');
    body += `\n\nP${e.f.i + 1}  TUS INICIALES:  ${n}${e.done ? '  ¡LISTO!' : ''}`;
  }
  s.endBody.setText(body);
  s.endHint.setText(s.entries.length && !s.saved ? 'ARRIBA/ABAJO LETRA · B1 SIGUIENTE' : 'START: ¡REVANCHA!');
}

// ---------- Controles ----------

function createControls(s) {
  s.controls = {
    held: Object.create(null),
    pressed: Object.create(null),
  };

  const onKeyDown = (event) => {
    const key = normalizeIncomingKey(event.key);
    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCode) {
      return;
    }
    if (s.audio && s.audio.state === 'suspended') {
      s.audio.resume();
    }
    if (!s.controls.held[arcadeCode]) {
      s.controls.pressed[arcadeCode] = true;
    }
    s.controls.held[arcadeCode] = true;
  };

  const onKeyUp = (event) => {
    const arcadeCode = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (arcadeCode) {
      s.controls.held[arcadeCode] = false;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  s.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return '';
  }
  if (key === ' ') {
    return 'space';
  }
  return key.toLowerCase();
}

// ---------- Sonido por código ----------

function initAudio(s) {
  try {
    const ctx = s.sound.context || new AudioContext();
    s.audio = ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    s.noiseBuf = buf;
    s.master = ctx.createGain();
    s.master.gain.value = 0.5;
    s.master.connect(ctx.destination);
  } catch (e) {
    s.audio = null;
  }
}

function tone(s, type, f0, f1, dur, vol, delay) {
  const ctx = s.audio;
  const t0 = ctx.currentTime + (delay || 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(s.master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(s, dur, vol, freq, type, delay) {
  const ctx = s.audio;
  const t0 = ctx.currentTime + (delay || 0);
  const src = ctx.createBufferSource();
  src.buffer = s.noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type || 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(s.master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function sfx(s, k, n) {
  if (!s.audio || (s.mode === 'demo' && k !== 'alert' && k !== 'rumble' && k !== 'ko')) {
    return;
  }
  s.master.gain.value = s.mode === 'demo' ? 0.2 : 0.5;
  try {
    if (k === 'hit') {
      noise(s, 0.12, 0.5, 1400);
      tone(s, 'square', 180 + (n || 0) * 2, 60, 0.12, 0.25);
    } else if (k === 'bighit') {
      noise(s, 0.25, 0.7, 900);
      tone(s, 'sawtooth', 160, 40, 0.3, 0.35);
    } else if (k === 'jump') {
      tone(s, 'square', 300, 640, 0.09, 0.12);
    } else if (k === 'whiff') {
      noise(s, 0.07, 0.12, 2500, 'highpass');
    } else if (k === 'parry') {
      tone(s, 'square', 1200, 1900, 0.08, 0.15);
      tone(s, 'square', 1900, 2400, 0.12, 0.12, 0.08);
    } else if (k === 'grab') {
      tone(s, 'triangle', 220, 110, 0.12, 0.25);
    } else if (k === 'throw') {
      noise(s, 0.15, 0.25, 1200, 'bandpass');
    } else if (k === 'break') {
      noise(s, 0.25, 0.35, 3000, 'highpass');
      for (let i = 0; i < 3; i++) tone(s, 'triangle', 2400 + i * 500, 1800, 0.08, 0.06, i * 0.04);
    } else if (k === 'thud') {
      tone(s, 'sine', 140, 60, 0.12, 0.3);
    } else if (k === 'ko') {
      tone(s, 'sawtooth', 700, 70, 0.6, 0.3);
      noise(s, 0.5, 0.4, 600);
    } else if (k === 'alert') {
      for (let i = 0; i < 3; i++) tone(s, 'square', 988, 980, 0.12, 0.12, i * 0.22);
    } else if (k === 'rumble') {
      noise(s, 1.6, 0.12 * (n - 2), 110);
    } else if (k === 'remezon') {
      tone(s, 'sine', 90, 30, 0.7, 0.6);
      noise(s, 0.6, 0.6, 400);
    } else if (k === 'charge') {
      tone(s, 'sawtooth', 120, 600, 0.14, 0.2);
    } else if (k === 'select') {
      tone(s, 'square', 880, 900, 0.05, 0.08);
    } else if (k === 'win') {
      [523, 659, 784, 1046].forEach((f, i) => tone(s, 'square', f, f, 0.14, 0.12, i * 0.12));
    }
  } catch (e) {
    // Sin audio no se detiene el juego.
  }
}

// ---------- Records persistentes ----------

function getStorage() {
  if (window.platanusArcadeStorage) {
    return window.platanusArcadeStorage;
  }
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Sin almacenamiento, el partido sigue sin guardar.
      }
    },
  };
}

async function storageGet(key) {
  return getStorage().get(key);
}

async function storageSet(key, value) {
  return getStorage().set(key, value);
}
