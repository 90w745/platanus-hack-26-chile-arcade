// ¿SE MOVIÓ? — Temblor hasta el grado 12
// Pelea de dos en Santiago mientras tiembla cada vez más fuerte.
// Bájale la vida y sácalo de la pantalla antes de que el temblor te saque a ti: no hay reloj, pierde el que se queda sin vidas.

// Todo va dentro de una función para que el minificador acorte también los nombres de arriba.
(() => {
const W = 320;
const H = 240;
const STORAGE_KEY = 'se-movio-records-v1';
// La vida es lo que falta para este susto: cada golpe suma, y sin vida el golpe saca volando.
const MAX_SUSTO = 100;
// Cada caída gasta una vida y se vuelve con la barra llena.
const LIVES = 3;
// Un golpe asusta una parte de su daño: así la vida alcanza para llegar a los grados fuertes.
const HIT_SUSTO = 0.23;
// La vida que muestra la barra: sin vida es cero, aunque el susto siga subiendo.
const life = (f) => Math.max(0, MAX_SUSTO - f.susto);
const MAX_RECORDS = 10;
const IDLE_MS = 30000;

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

const K = 0x1a1220;
const WHITE = 0xf6f1e7;
const YEL = 0xffd23f;
const RED = 0xe0403a;
const BLUE = 0x4fc3f7;
const ORANGE = 0xff8a24;
const PCOL = [BLUE, ORANGE];
// Los golpes por dirección, en la selección y al empezar el partido.
const MOVE_HELP = '1 GOLPE · ↑1 GANCHO · >1 FUERTE · ↓1 BARRIDA';

// ---------- Letra pixelada 3x5 (cada fila es un dígito de 3 bits) ----------

const FONT = {};
const FONT_SRC =
  'A25755B65656C34443D65556E74647F74644G34553H55755I72227J11152K55655L44447M57755N65555O25552P65644Q25563R65655S34216T72222U55557V55552W55775X55255Y55222Z71247' +
  '075557126227261247361216455711574616634757771122875757975716' +
  '!22202¡20222?61202¿20243.00002,00024:02020%51245-00700+02720/11244·00200_00007(12221)42224↑02500↓05200>42124';
for (let i = 0; i < FONT_SRC.length; i += 6) {
  FONT[FONT_SRC[i]] = [...FONT_SRC.slice(i + 1, i + 6)].map(Number);
}
const ACCENT = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N' };

// Texto con contorno. align: 0 izquierda, 0.5 centro, 1 derecha.
function text(g, str, x, y, sc, col, align) {
  const lines = String(str).toUpperCase().split('\n');
  const a = align === undefined ? 0.5 : align;
  for (let pass = 0; pass < 2; pass++) {
    lines.forEach((line, li) => {
      const x0 = Math.round(x - (line.length * 4 * sc - sc) * a);
      const y0 = y + li * 8 * sc;
      [...line].forEach((ch, ci) => {
        const rows = FONT[ACCENT[ch] || ch];
        if (!rows) return;
        const cx = x0 + ci * 4 * sc;
        const dot = (px, py, w) => {
          if (pass === 0) g.fillStyle(K).fillRect(cx + px * sc - 1, y0 + py * sc - 1, w * sc + 2, sc + 2);
          else g.fillStyle(col).fillRect(cx + px * sc, y0 + py * sc, w * sc, sc);
        };
        rows.forEach((r, ry) => {
          for (let b = 0; b < 3; b++) if (r & (4 >> b)) dot(b, ry, 1);
        });
        if (ch === 'Ñ') dot(0, -2, 3);
        // La tilde es una diagonal de dos píxeles; en letra chica va pegada a su letra para que no parezca de la línea de arriba.
        else if (ACCENT[ch]) {
          const o = sc > 1 ? -1 : 0;
          dot(2, o - 2, 1);
          dot(1, o - 1, 1);
        }
      });
    });
  }
}

// ---------- Personajes ----------
// Mapas de píxeles comprimidos por fila: un número antes de una letra la repite y '/' separa filas.
// Un cuerpo compartido por cuadro [ancla, corrimiento x e y de la cabeza, mapa] y una cabeza por personaje.
const unrle = (str) => str.split('/').map((r) => r.replace(/(\d+)(\D)/g, (_, n, c) => c.repeat(n)));
const BODY = {
  idle0: [4, 0, 0, 'kpp4dpk5./k4pkppk.3k./k4pkppk.kssk/k4pkppkkssk./k4pk3pssk../k4p6k3./.k6lk5./k8lk4./.kwwk.kwwk4./.kwwk..kwwk3./kwwk3.kwwk3./kwwk4.kwwk../k3fk3.k3fk./5k3.5k.'],
  run0: [6, 1, 0, '3.kpp4dk4./3.k7p3k./..kk6pkSSk./.kss5pkSSk../.kss5p3k3./..kk5pk5./3.k6lk4./..k8lk3./..kwwk..kwwk3./.kwwk4.kwwk../kwwk6.kwwk./kfk7.kwwk./kk8.k3fk/10.5k'],
  run1: [5, 1, 0, '..kpp4dk5./..k4pkppk4./..k4pkppk.kk./.kk4pkppkkssk/kSSk3pk3pssk./kSSk3p6k../.kk6lk5./.k8lkk3./..kwwk.k4wk../..kwwk.4kwwk./..kwwk4.kffk./..kwwk4.3k../.k3fk9./.5k9.'],
  jump: [4, 0, 0, 'kpp4dpk.kk./k4pkppkkssk/k4pkppkssk./k4pk3pkk../k4p4k4./.k6lk4./k8lkk../k6l3wk../.kww4kwwk../.kwwk..kffk../.kffk..3k3./.4k8.'],
  fall: [10, 0, 4, 'kk18.kk./kss9k7.kssk/.kss9k5.kssk./..kPP9k3.kppk../3.kPP3kpp4dpkkppk../4.5k8p3k3./8.k8pk5./8.k8pk5./8.k8lk5./7.k10lk4./8.kwwk..kwwk5./7.kwwk4.kwwk4./7.kwwk4.kwwk4./7.kffk4.kffk4./7.4k4.4k4.'],
  jab0: [6, -1, 0, '..kpp4dpk3./..k6pkk3./.k5pkssk3./.k5pkssk3./.k4pk3pk3./.k4p5k3./..k6lk4./.k8lk3./.kwwk..kwwk3./kwwk4.kwwk../kwwk4.kwwk../kwwk5.kwwk./k3fk4.k3fk/5k4.5k'],
  jab1: [5, 1, 0, '..kpp4dpk6./.k9p4k../.k11p3sk/.k11p3sk/.k7p8k/.k8pk6./..k6lk7./.k8lk6./.kwwk..kwwk6./kwwk4.kwwk5./kwwk4.kwwk5./kwwk5.kwwk4./k3fk4.k3fk3./5k4.5k3.'],
  smash0: [8, -2, 0, '5.kpp4dpk3./.5k7pk3./k4s8pkk../k4s8pkSSk/.5k7pkSSk/5.k7p3k./6.k6lk3./5.k8lk../4.kwwk3.kwwk../3.kwwk5.kwwk./..kwwk6.kwwk./.kwwk7.kwwk./k3fk7.k3fk/5k7.5k'],
  smash1: [6, 3, 1, '20.3k./4.k9p6kssk./3.k16p3sk/3.k16p3sk/..k8p9k3sk/..k8pk8.3k./..k8lk12./.kwwk6lk12./.kwwk.k4wk12./kwwk4.kwwk12./kwwk5.kwwk11./kwwk5.kwwk11./k3fk4.k3fk10./5k4.5k10.'],
  upper1: [5, 0, 13, '13.3k./12.k3sk/12.k3sk/12.kppk./13kppk./15pk./15pk./15pk./15pk./15pk./13kppk./13kppk./9.5pk../.kpp4dk3pkk3./.k7p3k5./.k7pk7./.k7pk7./.k7pk7./..k6lk7./.k8lk6./..kwwk.kwwk6./..kwwk..kwwk5./..kwwk..kwwk5./.k3fk3.kwk5./.5k3.kfk5./9.kk6.'],
  sweep1: [6, -1, 1, '10.pk12./3.k7pk12./..kk7pk12./.kssk6pk12./.kssk6pk12./..3k6l10k3./..k8l9w3k./..k8l9w3fk/.k6w16k/.k5fk16./.7k16.'],
  akick1: [6, -2, 1, '9.dpk7./..k7pk8./.k10pk6./kSS8pk7./kSSk6pk8./.kk8lkk6./.k4w6lwk5./.k4wk4l3wk4./..3kww5k3wk3./4.kffk4.k3wk../4.3k6.k3wk./14.k3fk/15.kffk/15.3k.'],
  stomp1: [9, 0, 3, 'kk15.kk/kss13kssk/.kpp11kppk./..kppkkp3dpkkppk../3.3k6p3k4./6.k6pk5./6.k6pk5./6.k6pk5./6.k6lk5./7.k4lk6./7.kwkkwk6./7.kwkkwk6./7.kwkkwk6./7.kwkkwk6./7.k4fk6./7.kfkkfk6./7.kk..kk6.'],
  grab1: [5, 1, 0, '.kpp4dpk9./.k8p7k../.k13pssk./.k7p7kssk/.k7p8Ssk/.k7p10k/..k6lk9./.k8lk8./.kwwk..kwwk8./kwwk4.kwwk7./kwwk4.kwwk7./kwwk5.kwwk6./k3fk4.k3fk5./5k4.5k5.'],
  hold: [11, 0, 14, '4k16.4k/kssk16.kssk/kssk16.kssk/kssk16.kssk/kssk16.kssk/kssk16.kssk/kssk16.kssk/kssk16.kssk/kssk16.kssk/kppk16.kppk/kppk16.kppk/k17pkk3pk/.9k9p4k./..4k13p4k./6.kpp4d4pk6./7.k8pk7./7.k8pk7./7.k8pk7./8.k6lk8./7.k8lk7./7.kwwk..kwwk7./6.kwwk4.kwwk6./5.k3fk4.k3fk5./5.5k4.5k5.'],
  parry: [5, -1, 0, '.kpp4dp3k..kk../.k5pkkssk.kssk./.k5pk.kssk3sk./.k5pk..k4sk../.k5pk..k4sk../.k5pk.kssk.kssk/..k6l3k3.3k/.k8lk7./.kwwk..kwwk7./kwwk4.kwwk6./kwwk4.kwwk6./kwwk5.kwwk5./k3fk4.k3fk4./5k4.5k4.'],
  hurt: [8, -4, 1, '16.kk/.kssk..5k..kssk/..k3pkppddpkkppk./3.kk8pkk3./5.k8pk3./6.k8pk../7.k6pk3./7.k6lk3./6.k8lk../6.kwwk..kwwk../5.kwwk4.kwwk./4.kwwk6.kffk/3.k3fk6.3k./3.5k10.'],
  dodge: [5, 1, 0, '.kpp4dpk4./.k4pkppk.kk./.k4pkppkkssk/.k4pk3pssk./.k4p6k../.k8lk3./k10lk../kww6k3wk./k3fk3.k4fk/5k3.6k'],
  cubre: [11, 0, 14, '5.14k5./4.k14sk4./3.kssk10.kssk3./3.kssk10.kssk3./4.kk12.kk4./24./24./24./24./24./24./24./24./24./5.k11pk6./4.k14lk4./..k3fk12lk4./..17k5.'],
};
const HEADS = {
  PATY: [6, '..kk.kk.kk4./.kbbkbbkbbk3./.kbBkbBkbBkk../k11hk./k12hk/k5h6shk/k3h9sk/k3h3sekseksk/k3h3sessessk/k3hSsr4srsk/k3hkS3srrsk./.khh8k..'],
  CATA: [7, '4.7k4./3.k7hk3./..k9hk../.k5hkbbkbbk./.k12hk/k6h6shk/k4h9sk/k4h3sekseksk/k4h3sessessk/k4hSsr4srsk/k4hkS3srrsk./k3h8k3.'],
  CHEPO: [8, '5.7k6./4.k7bk5./4.k7Bk5./.4k7b5k./k16bk/.16k./..khh3skkskkssk../..khh4sessessk../..khh4sessessk../..kS4s6hsk../3.kS3sh4shk3./4.10k4.'],
  DANI: [6, '3.7k6./..k7bk5./.k9bk4./.k10b4k/k11b3Bk/khh12k./khh3skkskkssk../khh4sessessk../khh4sessessk../kS10sk3./.kS4sksssk4./..10k4.'],
};
const PALS = {
  PATY: { k: 0x1a1220, s: 0xf2c09a, S: 0xc98a68, h: 0x6a3a22, H: 0x4a2416, b: 0x6fd0f0, B: 0x3a98c0, p: 0xf07aa8, P: 0xc0507e, d: 0xfff0a0, l: 0xf07aa8, w: 0xf2c09a, f: 0x8ad8f0, e: 0x1a1220, r: 0xe0506a },
  CATA: { k: 0x1a1220, s: 0xf2c09a, S: 0xc98a68, h: 0xf0d060, H: 0xc8a040, b: 0x2a2a3a, B: 0x6a6a7a, p: 0xf4f0e6, P: 0xc8c0b0, d: 0x4a8ae0, l: 0xc4a46c, w: 0xf2c09a, f: 0x8a4a24, e: 0x1a1220, r: 0xe0506a },
  CHEPO: { k: 0x1a1220, s: 0xd9a07a, S: 0xa8704f, h: 0x2a1a14, H: 0x2a1a14, b: 0xe8cc7a, B: 0x5a3020, p: 0xd02c34, P: 0x901c24, d: 0xf0e0b0, l: 0x56506e, w: 0x56506e, f: 0x5a3020, e: 0x1a1220, r: 0xc0504a },
  DANI: { k: 0x1a1220, s: 0xd8a07c, S: 0xa87050, h: 0x2a1a14, H: 0x2a1a14, b: 0xeceef4, B: 0x9aa0b4, p: 0xf2b42c, P: 0xb87a18, d: 0xf8d878, l: 0x44608c, w: 0x44608c, f: 0xf6f6f6, e: 0x1a1220, r: 0xc0504a },
};
for (const k in BODY) BODY[k][3] = unrle(BODY[k][3]);

const CHARS = [
  { n: 'PATY', t: 'SALTA ALTO', spd: 1.05, jmp: 1.18, wt: 0.95, pow: 0.96, lg: 0, at: 1 },
  { n: 'CHEPO', t: 'PESADO', spd: 0.88, jmp: 0.92, wt: 1.2, pow: 1.06, lg: -1, at: 0.85 },
  { n: 'CATA', t: 'GOLPE FUERTE', spd: 1, jmp: 1, wt: 0.95, pow: 1.22, lg: 2, at: 1 },
  { n: 'DANI', t: 'VELOZ', spd: 1.2, jmp: 1.02, wt: 0.9, pow: 0.95, lg: 1, at: 1.12 },
];
// Cada uno con su largo de piernas sobre el mismo cuerpo: la primera fila de pierna se repite o se quita.
for (const c of CHARS) {
  c.pal = PALS[c.n];
  c.head = [HEADS[c.n][0], unrle(HEADS[c.n][1])];
  c.body = {};
  for (const k in BODY) {
    const [a, hx, hy, m] = BODY[k];
    // En el salto, la barrida y el agachado la primera fila de pierna es horizontal o de cadera: ahí no se alarga.
    const i = /^[jsd][uwo]/.test(k) ? -1 : m.findIndex((r) => r.includes('w'));
    const legs = m.filter((r) => r.includes('w')).length;
    c.body[k] = [a, hx, hy, i < 0 || (c.lg < 0 && legs < 3) ? m : m.slice(0, i).concat(Array(Math.max(0, c.lg)).fill(m[i]), m.slice(c.lg < 0 ? i + 1 : i))];
  }
}
// Un solo color para todo el cuerpo, salvo el contorno.
const tint = (c) => new Proxy({}, { get: (o, k) => (k === 'k' ? K : c) });
const FLASH_PAL = tint(WHITE);

// Pose de cada golpe: [arranque, golpe]. La del golpe se mantiene hasta el final.
const POSES = { jab: ['jab0', 'jab1'], smash: ['smash0', 'smash1'], upper: ['jab0', 'upper1'], sweep: ['dodge', 'sweep1'], akick: ['jump', 'akick1'], stomp: ['fall', 'stomp1'], grab: ['dodge', 'grab1'] };

// Si los dos eligen al mismo, el segundo juega con la ropa de otro color y su nombre lleva (1).
const copyIdx = ([a, b]) => (b.ok && (!a.ok || a.at > b.at) ? 0 : 1);
function copyOf(c) {
  const pal = Object.assign({}, c.pal);
  for (const k of 'pPdlbB') {
    const v = pal[k];
    const r = v >> 16;
    const g = (v >> 8) & 255;
    const b = v & 255;
    // Los grises y blancos no cambian al rotar el color: se tiñen de verde.
    pal[k] = Math.max(r, g, b) - Math.min(r, g, b) < 48 ? (((r * 0.5) | 0) << 16) | (((g * 0.85) | 0) << 8) | ((b * 0.55) | 0) : (b << 16) | (r << 8) | g;
  }
  // El pantalón sigue siendo uno solo.
  if (c.pal.w === c.pal.l) pal.w = pal.l;
  return Object.assign({}, c, { n: c.n + ' (1)', pal });
}

// Dibuja un mapa de píxeles uniendo tramos del mismo color. sc escala (pantallas).
function spr(g, map, cx, top, face, pal, anchor, sc) {
  const z = sc || 1;
  for (let j = 0; j < map.length; j++) {
    const row = map[j];
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      let n = 1;
      while (row[i + n] === ch) n++;
      if (ch !== '.') {
        const r0 = i - anchor;
        const x = face > 0 ? cx + r0 * z : cx - (r0 + n) * z;
        g.fillStyle(pal[ch]).fillRect(x, top + j * z, n * z, z);
      }
      i += n;
    }
  }
}

// Dibuja un cuadro del cuerpo y encima la cabeza. Devuelve el borde de arriba de la cabeza.
function drawChar(g, c, fr, cx, feet, face, pal, z) {
  const [a, hx, hy, m] = c.body[fr];
  const top = feet - m.length * z;
  spr(g, m, cx, top, face, pal, a, z);
  const [ha, hm] = c.head;
  const ht = top + (hy - hm.length + (fr === 'idle0' && (Date.now() / 450) & 1)) * z;
  spr(g, hm, cx + hx * z * face, ht, face, pal, ha, z);
  return ht;
}

// ---------- Mapas y fondos vivos ----------
// Cada mapa es un descriptor chico: nombre, piso, plataformas y puertas de la mitad
// izquierda (se reflejan), objetos, y una lista de capas de lejos a cerca.
// Las capas desde el índice `a` se redibujan cada cuadro: así lo que se mueve
// queda siempre detrás de lo que está más cerca.
const STAGES = (() => {
  let G, C, S, Tm, Sc, Q;

  // Paleta indexada. Por hora (día, atardecer, noche): 4 franjas de cielo, astro y luz de ventana.
  // Después, los colores apagados del resto, desde el índice 6.
  const P = (
    '6a94c082a8cc9cbcd6b6cedef6d8604e5a6e' +
    '4c41707a5c88ac707cd29a7ae8b070a88a62' +
    '161c361e284a28345c34406cd8d8ccffd27a' +
    '7d88a2d6dce26e7c684c54705c6480c2b69ea89c867a5c443e303098a0aa667e58e6d4a6c8b48a' +
    '4c7894b4ccd2a85a505c78a0c4ac6484a070b88a8a8c8c945a5a66c49a7a3a3436d6d2c6c084604c4c56'
  )
    .match(/.{6}/g)
    .map((h) => parseInt(h, 16));
  const mix = (a, b, k) => [16, 8, 0].reduce((r, s) => r | ((((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s), 0);
  // Hora del día como cambio de paleta: cielo propio y un tinte sobre todo lo demás.
  const PALS = [0, 1, 2].map((i) => P.slice(i * 6, i * 6 + 6).concat(P.slice(18).map((c) => mix(c, [0, 0x8a5070, 0x101830][i], [0, 0.2, 0.35][i]))));

  // Primitivas de dibujo. Un color menor que la paleta es un índice; si no, va tal cual.
  const R = (x, y, w, h, c) => G.fillStyle(C[c] || c).fillRect(x | 0, y | 0, w | 0, h | 0);
  const T = (a, b, c, d, e, f, k) => G.fillStyle(C[k] || k).fillTriangle(a, b, c, d, e, f);
  const line = (a, b, c, d) => G.lineStyle(1, C[29]).lineBetween(a, b, c, d);
  const rnd = (n) => ((S = (S * 69069 + 1) >>> 0) >>> 16) % n;
  const wrap = (v, m) => ((v % m) + m) % m;
  const rects = (...a) => {
    for (let i = 0; i < a.length; i += 5) R(...a.slice(i, i + 5));
  };
  // Rectángulos reflejados en el eje central: props simétricos con la mitad de datos.
  const sym = (...a) => {
    rects(...a);
    for (let i = 0; i < a.length; i += 5) R(W - a[i] - a[i + 2], ...a.slice(i + 1, i + 5));
  };
  // Un rectángulo repetido con paso fijo: franjas, barrotes, ventanas en fila.
  const rep = (n, dx, dy, x, y, w, h, c) => {
    for (let i = 0; i < n; i++) R(x + i * dx, y + i * dy, w, h, c);
  };

  // Cielo en franjas y astro: sol, sol bajo o luna según la paleta.
  const sky = (x, y) => {
    // 7 franjas: las 4 de la paleta y su mezcla entre ellas. De noche, estrellas.
    for (let i = 0; i < 7; i++) R(0, i * 20, W, i > 5 ? H : 20, i & 1 ? mix(C[i >> 1], C[(i >> 1) + 1], 0.5) : C[i >> 1]);
    S = 7;
    if (C == PALS[2]) for (let i = 0; i < 26; i++) R(rnd(W), rnd(110), 1, 1, 4);
    G.fillStyle(C[4]).fillCircle(x, y, 9);
  };
  // Cerros por semilla; la cordillera lleva nieve.
  const hills = (y, s, c, h, snow) => {
    S = s;
    for (let x = -30; x < W + 30; x += 30 + rnd(40)) {
      const k = h / 2 + rnd(h / 2);
      T(x - k * 1.6, y, x, y - k, x + k * 1.6, y, c);
      if (snow) T(x - k * 0.4, y - k * 0.75, x, y - k, x + k * 0.4, y - k * 0.75, 7);
    }
    R(0, y, W, H, c);
  };
  // Ciudad por semilla: bloques y ventanas que se prenden con la hora.
  const city = (y, s, hm) => {
    S = s;
    for (let x = 0, w; x < W; x += w) {
      w = 10 + rnd(16);
      const h = 10 + rnd(hm);
      R(x, y - h, w, H, 9 + rnd(2));
      for (let v = y - h + 3; v < y - 2; v += 6) for (let u = x + 2; u < x + w - 2; u += 4) rnd(3) || R(u, v, 1, 2, 5);
    }
  };
  // Fila de casas por semilla: color, techo, ventanas y puerta; reja y antejardín si se pide.
  // Sirve para la pobla, el patio y la costanera.
  const houses = (x0, n, w, b, s, h, reja) => {
    S = s;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * w;
      const t = b - h;
      R(x + 1, t, w - 2, h, [21, 22, 23, 24, 25, 31, 11][rnd(7)]);
      rnd(2) ? R(x, t - 3, w, 3, 15) : T(x - 1, t, x + w / 2, t - w / 4, x + w + 1, t, 21);
      // Desde el grado 6 las ventanas vibran en su marco, cada casa a su ritmo.
      const q = Q && Math.sin(Tm / 40 + i) * Q;
      R(x + w * 0.1 + q, t + h * 0.25, w * 0.2, h * 0.3, 5);
      R(x + w * 0.7 + q, t + h * 0.25, w * 0.2, h * 0.3, 5);
      if (w > 20) R(x + w * 0.35, b - h * 0.6, w * 0.3, h * 0.6, 14);
      if (reja) {
        R(x + 2, b - 6, 9, 6, 16);
        rep(w / 4, 4, 0, x, b - 10, 1, 10, 29);
        R(x, b - 10, w, 1, 29);
      }
    }
  };
  // Postes con luminaria y cable con comba, que se mece más con cada grado. En el cable, un volantín enredado con su cola.
  const poles = (y, b, ...xs) =>
    xs.forEach((x, i) => {
      R(x, y, 2, b - y, 29);
      R(x - 5, y + 3, 6, 1, 29);
      R(x - 6, y + 4, 3, 2, 5);
      const n = xs[i + 1];
      if (n) {
        const u = (x + n) / 2 + Math.sin(Tm / 230) * (Sc.g - 2) * Sc.st.sw;
        const v = y + 9 + Math.sin(Tm / 140) * (Sc.g - 3) * 0.7;
        const k = v + ((y + 1 - v) * (262 - u)) / (n - u);
        line(x, y + 1, u, v);
        line(u, v, n, y + 1);
        T(257, k - 7, 262, k - 14, 267, k - 7, 0xe53935);
        T(257, k - 7, 262, k, 267, k - 7, 0xfdd835);
        rects(262, k, 1, 9, 29, 263, k + 8, 1, 4, 29);
      }
    });

  // Actores. Sprites en grupos de 5 letras: x+20, alto, ancho, largo, color.
  // Color 0 = el del parámetro; 1 y 2 = piernas de cada paso.
  const PER = 'BD52MBB55LA=780B5251E5251A5252F5252';
  const SPR = [
    PER, // persona
    '<9230>7;40H:540H;22MK911M?3231G3231@3232F3232', // perro
    PER + 'G;41LJ:@6=K=53?Q>64JV<32EL444MU444M', // chatarrero con carretón
    '6:L8089F3565L1J:242MJ242M', // micro
    ':4D20<2@20C935FC<33L', // bote
  ];
  // Caminante genérico: persona, perro, chatarrero con carretón, micro o bote.
  // Velocidad 0 = quieto (vecino asomado). Persona y perro saltan después de un KO.
  const walk = (y, sp, off, k, c) => {
    const d = sp < 0 ? -1 : 1;
    const st = sp ? ((Tm / Math.abs(sp * 5)) | 0) % 2 : 0;
    const x = sp ? wrap(Tm / sp + off, 400) - 40 : off;
    y -= k < 2 && Sc.cheer > 0 ? Math.abs(Math.sin(Tm / 90 + off)) * 5 : st;
    const s = SPR[k];
    for (let i = 0; i < s.length; i += 5) {
      const [dx, up, w, h, q] = [...s.substr(i, 5)].map((ch) => ch.charCodeAt() - 48);
      if (q > 2 || q == st + 1 || !q) R(d > 0 ? x + dx - 20 : x + 20 - dx - w, y - up, w, h, q > 2 ? q : q ? 29 : c);
    }
  };
  // Bandada: gaviotas o palomas que cruzan aleteando.
  const birds = (y, n, sp, c) => {
    for (let i = 0; i < n; i++) {
      const x = ((Tm / sp + i * 97) % 380) - 30;
      const v = y + i * 9 + Math.sin(Tm / 300 + i) * 3;
      R(x, v, 5, 1, c);
      R(x + 1, v + (((Tm / 120 + i) | 0) % 2 ? -2 : 1), 3, 2, c);
    }
  };
  // Olas: líneas de espuma que corren, más largas mientras más cerca, y la orilla que va y viene.
  const waves = (y, n, sx) => {
    for (let i = 0; i < n; i++) for (let k = 0; k < 5; k++) R(wrap(k * 67 + i * 31 + (Tm / (40 - i * 4)) * (i % 2 || -1), 360) - 20, y + i * 8, 6 + i * 2, 1, 20);
    const f = 3 + Math.sin(Tm / 500) * 3;
    R(sx - 6 - f, 199, 6 + f, 2, 20);
    R(W - sx, 199, 6 + f, 2, 20);
  };
  // Desde el grado 6 el mar se recoge, como antes de un tsunami: queda a la vista la arena mojada, con algas.
  const tide = (y) => Sc.g > 5 && (rects(0, (y -= Sc.g * 6), W, H, 13, 0, y, W, 1, 20), rep(9, 37, 0, 8, y + 6, 4, 2, 16));
  // Parrilla: brasas que titilan y humo que sube.
  const smoke = (x, y, w) => {
    for (let i = 0; i < w; i += 6) R(x + i, y, 3, 1, Math.random() < 0.5 ? ORANGE : RED);
    for (let i = 0; i < 5; i++) {
      const k = ((Tm / 40 + i * 37) % 80) / 80;
      G.fillStyle(C[30], 0.5 * (1 - k)).fillRect(x + w / 2 - 8 + i * 4 + Math.sin(Tm / 300 + i) * 4, y - 4 - k * 60, 3, 3);
    }
  };
  // Ropa tendida en un cordel; flamea más con cada grado.
  const ropa = (x, y, n, dx, dy) => {
    line(x - 8, y, x + n * dx, y + n * dy);
    for (let i = 0; i < n; i++) R(x + i * dx + Math.sin(Tm / 250 + i) * Math.min(5, Sc.g - 1) * Sc.st.sw, y + i * dy + 1, 8, 10, [21, 30, 22, 23, 24][i % 5]);
  };
  // Lámpara colgante que se mece más con cada grado.
  const lamp = (x, y, l) => {
    const a = Math.sin(Tm / (Sc.g > 6 ? 260 : 900)) * Math.min(0.6, 0.1 * Sc.g - 0.22) * Sc.st.sw;
    const u = x + Math.sin(a) * l;
    const v = y + Math.cos(a) * l;
    line(x, y, u, v);
    T(u - 6, v + 5, u + 6, v + 5, u, v - 1, 29);
    R(u - 1, v + 5, 3, 2, 5);
  };
  // Estática de la tele y luz que parpadea.
  const noise = (x, y, w, h) => {
    for (let v = 0; v < h; v += 2) for (let u = 0; u < w; u += 2) R(x + u, y + v, 2, 2, Math.random() < 0.5 ? 20 : 22);
  };
  const blink = (x, y) => ((Tm / 600) | 0) % 2 && R(x, y, 3, 3, RED);

  const draw = (e) => (e[0].call ? e[0](...e.slice(1)) : rects(...e));
  const mir = (l) => l.flatMap(([a, b, ...r]) => (a + b - W ? [[a, b, ...r], [W - b, W - a, ...r]] : [[a, b, ...r]]));

  // Mapas: nombre, piso, medio ancho del piso, plataformas [x1, x2, y, 1 frágil | 2 caliente | 4 mesa: abajo no cae nada]
  // de la mitad izquierda, puertas, objetos, objeto pesado, primera capa viva, cuánto se mece de lado y capas.
  return [
    [
      'EL DEPTO', 200, 120, [[130, 190, 168, 4], [44, 80, 132, 1]], [[52, 72, 40]], 'tetera pan macetero pan', 'tele', 10, 1.15,
      [
        [sky, 306, 50],
        [hills, 150, 3, 6, 50, 1],
        [city, 215, 13, 40],
        [36, 62, 248, 138, 11, 32, 56, 256, 6, 26, 36, 194, 248, 6, 13, 36, 200, 248, 8, 26, 136, 76, 48, 36, 14, 138, 78, 44, 32, 1, 36, 208, 248, 32, 27],
        // Bajo el piso, la fachada con las ventanas del depto de abajo.
        [rep, 8, 30, 0, 48, 216, 14, 9, 5],
        [T, 138, 110, 156, 92, 176, 110, 6],
        // Por la ventana, la cordillera con nieve.
        [T, 149, 99, 156, 92, 163, 99, 7],
        [rep, 15, 16, 0, 44, 62, 4, 132, 12],
        [159, 78, 2, 32, 14, 138, 93, 44, 2, 14, 104, 82, 16, 20, 30, 104, 82, 16, 4, 21, 205, 184, 18, 16, 13, 206, 168, 16, 16, 29, 130, 168, 60, 6, 30],
        [rep, 8, 8, 0, 130, 168, 4, 6, 21],
        [sym, 49, 160, 26, 40, 13, 52, 163, 20, 37, 14, 134, 174, 3, 26, 13],
        // Mochila de emergencia con linterna, al lado de la puerta.
        [40, 189, 7, 11, 0x0c5930, 41, 186, 5, 3, 29, 42, 192, 3, 4, 0x1d7a45],
        [noise, 208, 170, 12, 12],
        [lamp, 160, 62, 16],
      ],
    ],
    [
      'LA CASA', 205, 136, [[140, 180, 182, 2], [84, 116, 140]], [[95, 105, 37]], 'chori pelota macetero teja', 'gas', 2, 0.8,
      [
        [sky, 240, 84],
        [hills, 150, 5, 6, 55, 1],
        [walk, 162, 0, 150, 0, 21],
        [walk, 163, 0, 170, 0, 22],
        [walk, 162, 0, 278, 0, 24],
        // Limonero del patio, asomado sobre el muro.
        [21, 132, 4, 18, 13, 10, 116, 26, 20, 16, 14, 110, 18, 6, 16, 15, 121, 2, 2, 23, 27, 125, 2, 2, 23, 20, 129, 2, 2, 23, 31, 116, 2, 2, 23],
        [0, 150, 320, 55, 11],
        [rep, 6, 0, 9, 0, 158, 320, 1, 12],
        [rep, 5, 64, 0, 28, 150, 5, 55, 12],
        [0, 148, 320, 3, 30],
        [walk, 150, 30, 0, 1, 31],
        [houses, 84, 1, 32, 205, 5, 62],
        [houses, 204, 1, 32, 205, 1, 62],
        [ropa, 124, 118, 6, 12, 1],
        [138, 182, 44, 2, 29, 140, 184, 40, 5, 27, 140, 180, 40, 2, 0xf0903a, 0, 205, 320, 35, 14, 24, 205, 272, 9, 12],
        [sym, 144, 189, 2, 16, 29],
        [smoke, 142, 183, 36],
      ],
    ],
    [
      'EL EDIFICIO', 200, 110, [[140, 180, 150], [56, 88, 162, 4]], [[63, 81, 28]], 'macetero balde pelota teja', 'parabolica', 3, 1.3,
      [
        [sky, 250, 84],
        [hills, 175, 9, 8, 50],
        [city, 200, 29, 60],
        // La torre alta de vidrio de Santiago, sin nombre.
        [200, 80, 13, 120, 22, 202, 82, 2, 118, 20, 202, 72, 9, 8, 22, 204, 64, 5, 8, 22, 206, 52, 1, 12, 29],
        [birds, 40, 3, 25, 26],
        [0, 222, 320, 18, 32],
        [walk, 230, 18, 0, 3, 30],
        [walk, 237, -22, 200, 3, 21],
        [50, 200, 220, 8, 26, 54, 208, 212, 32, 27, 140, 150, 40, 50, 15, 158, 70, 3, 80, 27],
        [rep, 13, 16, 0, 60, 214, 8, 5, 5],
        [rep, 3, 0, 12, 140, 162, 40, 2, 26],
        [rep, 8, 0, 8, 154, 78, 11, 1, 27],
        [sym, 56, 162, 32, 38, 11, 54, 160, 36, 3, 26, 63, 172, 18, 28, 14],
        // Señal verde de salida sobre cada puerta: se ve igual de noche.
        [sym, 66, 165, 12, 7, 0xf6f1e7, 67, 166, 10, 5, 0x0c5930, 69, 167, 2, 3, 0xf6f1e7, 72, 168, 3, 1, 0xf6f1e7, 74, 167, 1, 3, 0xf6f1e7],
        [ropa, 100, 148, 3, 11, 0],
        [blink, 158, 66],
      ],
    ],
    [
      'LA POBLA', 205, 128, [[136, 184, 160, 4], [92, 128, 150]], [[136, 184, 42]], 'pelota teja macetero pan', 'gas', 2, 0.85,
      [
        [sky, 60, 84],
        [hills, 150, 3, 6, 55, 1],
        [birds, 30, 3, 30, 26],
        [houses, 0, 8, 40, 180, 5, 34, 1],
        [0, 180, 320, 25, 26],
        [walk, 190, 45, 0, 2, 22],
        [walk, 192, -12, 100, 1, 13],
        [walk, 189, -28, 250, 0, 25],
        [poles, 150, 205, 20, 300],
        [134, 158, 52, 3, 27, 140, 166, 40, 20, 26, 152, 170, 16, 8, 5, 144, 196, 32, 2, 13, 0, 205, 320, 35, 32, 32, 205, 256, 8, 26],
        [sym, 138, 161, 2, 44, 27, 90, 150, 38, 10, 16, 96, 160, 26, 4, 16, 106, 164, 4, 41, 13],
      ],
    ],
    [
      'LA PLAYA', 200, 130, [[136, 184, 150, 4], [90, 124, 164, 4]], [[136, 184, 47]], 'pelota balde chori pelota', 'sandia', 4, 1,
      [
        [sky, 250, 84],
        [hills, 140, 7, 8, 40],
        // Cerro de Valparaíso: casas apiladas y el ascensor que sube en diagonal.
        [T, -30, 140, 40, 96, 120, 140, 13],
        [houses, 4, 5, 15, 130, 3, 8],
        [houses, 14, 4, 13, 120, 5, 8],
        [houses, 26, 2, 13, 110, 8, 7],
        [line, 70, 138, 96, 112],
        [84, 120, 6, 6, 21],
        [houses, 0, 20, 16, 140, 9, 10],
        [0, 140, 320, 100, 19, 0, 140, 320, 1, 20],
        [birds, 36, 4, 22, 30],
        [walk, 160, 60, 0, 4, 21],
        [waves, 150, 6, 30],
        [tide, 230],
        [30, 200, 260, 40, 17, 30, 210, 260, 30, 18, 134, 150, 52, 5, 30, 158, 124, 2, 26, 27, 160, 124, 8, 5, 21, 146, 180, 28, 20, 21, 154, 186, 12, 14, 14],
        // Vía de evacuación de tsunami: señal verde con flecha hacia el cerro.
        [264, 178, 2, 22, 29, 258, 166, 14, 12, 0xf6f1e7, 259, 167, 12, 10, 0x0c5930, 263, 171, 6, 2, 0xf6f1e7],
        [T, 263, 168, 263, 176, 259, 172, 0xf6f1e7],
        [sym, 140, 155, 3, 45, 30, 90, 164, 34, 2, 21, 93, 166, 28, 2, 21, 97, 168, 20, 2, 21, 100, 164, 3, 6, 30, 107, 164, 3, 6, 30, 114, 164, 3, 6, 30, 106, 170, 2, 30, 27],
      ],
    ],
  ].map(([n, floor, hw, pl, dr, drops, heavy, a, sw, L]) => ({
    n,
    floor,
    sw,
    plats: [[160 - hw, 160 + hw, floor, 3], ...mir(pl)].map(([x1, x2, y, f]) => ({ x1, x2, y, solid: f == 3, brk: f == 1, hot: f == 2, mesa: f > 3 })),
    doors: mir(dr),
    drops: drops.split(' '),
    heavy,
    // Estático: una vez por partido, con la hora elegida (0 día, 1 atardecer, 2 noche).
    bg(g, tod) {
      G = g;
      C = PALS[tod | 0];
      Q = 0;
      L.slice(0, a).map(draw);
    },
    // Vivo: actores y todo lo que está delante de ellos, cada cuadro.
    anim(g, t, s) {
      G = g;
      C = PALS[s.tod | 0];
      Tm = t;
      Sc = s;
      Q = Math.min(2, Math.max(0, s.g - 5) / 2);
      L.slice(a).map(draw);
    },
  }));
})();

const OBJS = {
  tetera: { w: 8, h: 6, dmg: 10, brk: true },
  pan: { w: 9, h: 5, dmg: 5 },
  chori: { w: 10, h: 4, dmg: 5 },
  pelota: { w: 6, h: 6, dmg: 4, bounce: true },
  macetero: { w: 7, h: 8, dmg: 9, brk: true },
  teja: { w: 9, h: 3, dmg: 7, brk: true },
  balde: { w: 7, h: 7, dmg: 7 },
  tele: { w: 13, h: 11, dmg: 16, brk: true, heavy: true },
  gas: { w: 8, h: 12, dmg: 16, heavy: true },
  parabolica: { w: 13, h: 10, dmg: 15, brk: true, heavy: true },
  sandia: { w: 12, h: 9, dmg: 15, brk: true, heavy: true },
};

// Cuánto tiembla la imagen en cada grado.
const shake = (s) => s.g * 0.2 - 0.3;

// Golpes: arranque (s), activo (a), total (e), caja [x0,x1,y0,y1] desde los pies, daño, empuje base y crecimiento, ángulo.
// Estela (w): color, centro x e y desde los pies, radio y ángulos del arco mirando a la derecha.
const MOVES = {
  jab: { s: 50, a: 60, e: 180, box: [3, 15, -15, -8], d: 6, b: 40, gr: 1.6, an: 0.35, w: [WHITE, 2, -12, 12, -0.9, 0.9] },
  smash: { s: 220, a: 80, e: 440, box: [3, 18, -16, -8], d: 13, b: 110, gr: 3.1, an: 0.6, w: [YEL, 0, -12, 18, -1, 0.6] },
  upper: { s: 70, a: 80, e: 320, box: [2, 12, -27, 6], d: 9, b: 85, gr: 2.6, an: 1.35, w: [WHITE, 0, -16, 13, -1.7, 0.5] },
  sweep: { s: 90, a: 80, e: 360, box: [1, 18, -6, 0], d: 8, b: 75, gr: 2.2, an: 0.2, w: [0xd6bd86, 2, 14, 16, -2.2, -0.9] },
  akick: { s: 60, a: 160, e: 320, box: [3, 13, -9, 0], d: 8, b: 70, gr: 2.5, an: 0.45, air: true, w: [WHITE, 0, -10, 14, -1.2, 0.7] },
  stomp: { s: 120, a: 120, e: 380, box: [-6, 6, -4, 7], d: 10, b: 60, gr: 2.6, an: -1.2, air: true, w: [WHITE, 0, -6, 10, 0.4, 2.7] },
  grab: { s: 120, a: 80, e: 400, box: [1, 12, -16, -4] },
};

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#1a1220',
  pixelArt: true,
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
  s.fx = [];
  s.msgs = [];
  s.objs = [];
  s.stop = 0;
  s.flash = 0;
  s.kick = 0;
  s.now = 0;
  s.idle = 0;
  s.picks = [0, 1];

  // El mundo va en un contenedor que se inclina y se acerca con el temblor.
  // El zoom justo para que el temblor no deje ver los bordes vacíos.
  s.world = s.add.container(W / 2, H / 2).setScale(1.04);
  s.bg = s.make.graphics({}, false);
  s.bgt = s.add.renderTexture(-W / 2, -H / 2, W, H).setOrigin(0);
  s.dyn = s.add.graphics({ x: -W / 2, y: -H / 2 });
  s.world.add([s.bgt, s.dyn]);
  s.hud = s.add.graphics().setDepth(10);
  s.flashRect = s.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setAlpha(0).setDepth(20);

  createControls(s);
  initAudio(s);
  loadRecords().then((r) => {
    s.records = r;
  });
  startMatch(s, [false, false], true);
}

function update(time, delta) {
  const s = this;
  const dt = Math.min(delta, 50) / 1000;
  s.now = time;
  s.idle += delta;
  const pr = s.controls.pressed;

  if (s.mode === 'demo') {
    if (pr.START1 || pr.START2) openSelect(s, [!!pr.START1, !!pr.START2]);
  } else if (s.mode === 'select') {
    updateSelect(s, dt);
  } else if (s.mode === 'play') {
    for (let i = 0; i < 2; i++) {
      if (pr['START' + (i + 1)] && s.f[i].cpu) {
        s.f[i].cpu = false;
        say(s, 'P' + (i + 1) + ' ENTRA', PCOL[i]);
        sfx(s, 'select');
      }
    }
    // Partido abandonado: vuelve al attract.
    if (s.idle > IDLE_MS) startMatch(s, [false, false], true);
  } else if (s.mode === 'end') {
    updateEnd(s, dt);
  }

  if (s.mode === 'play' || s.mode === 'demo') {
    if (s.stop > 0) {
      s.stop -= delta;
      // El destello blanco dura 50 ms aunque la pausa de impacto siga: después se ve la pose de dolor.
      for (const f of s.f) f.flashT -= delta;
    } else simulate(s, dt);
    music(s);
  }
  if (s.mode === 'end') stepParticles(s, dt);

  render(s, time);
  for (const k in pr) pr[k] = false;
}

// ---------- Selección de personaje ----------

function openSelect(s, humans) {
  s.mode = 'select';
  s.sel = [0, 1].map((i) => ({ on: humans[i], pick: i, ok: !humans[i], cool: 0 }));
  s.selT = 0;
  sfx(s, 'select');
}

function updateSelect(s, dt) {
  const pr = s.controls.pressed;
  const h = s.controls.held;
  const n = CHARS.length;
  s.selT += dt * 1000;
  s.sel.forEach((e, i) => {
    const p = 'P' + (i + 1) + '_';
    // Entrar con START no confirma: primero se elige.
    if (pr['START' + (i + 1)] && !e.on) {
      e.on = true;
      e.ok = false;
      return;
    }
    if (!e.on || e.ok) return;
    e.cool -= dt * 1000;
    const step = h[p + 'R'] ? 1 : h[p + 'L'] ? n - 1 : 0;
    if (e.cool <= 0 && step) {
      e.pick = (e.pick + step) % n;
      e.cool = 170;
      sfx(s, 'select');
    }
    if (pr[p + '1'] || pr[p + '4'] || (pr['START' + (i + 1)] && s.selT > 300)) {
      e.ok = true;
      e.at = s.selT;
      sfx(s, 'parry');
    }
  });
  if (s.sel.every((e) => e.ok) || s.selT > 20000) {
    s.sel.forEach((e, i) => {
      if (!e.on) e.pick = (s.sel[1 - i].pick + 1 + ((Math.random() * (n - 1)) | 0)) % n;
      s.picks[i] = e.pick;
    });
    s.copy = copyIdx(s.sel);
    startMatch(s, s.sel.map((e) => e.on), false);
  }
}

// ---------- Partido ----------

function makeFighter(s, i, cpu, ci) {
  const st = s.st;
  return {
    i,
    cpu,
    c: s.copy === i && s.picks[0] === s.picks[1] ? copyOf(CHARS[ci]) : CHARS[ci],
    x: i ? st.plats[0].x2 - 50 : st.plats[0].x1 + 50,
    y: st.floor,
    vx: 0,
    vy: 0,
    face: i ? -1 : 1,
    ground: true,
    plat: s.plats[0],
    coyote: 0,
    jbuf: 0,
    jumps: 1,
    jumping: false,
    run: 0,
    tap: { d: 0, t: -1e9 },
    susto: 0,
    lives: LIVES,
    vt: 1,
    act: null,
    stun: 0,
    daze: 0,
    inv: 0,
    blink: 0,
    hold: null,
    grabbedBy: null,
    mash: 0,
    calma: 0,
    refugio: 0,
    drop: 0,
    out: 0,
    behind: false,
    base: 0,
    sty: 0,
    combo: 0,
    comboShow: 0,
    flashT: 0,
    land: 0,
    hotT: 0,
    b1t: -1e9,
    b2t: -1e9,
    inp: {},
    ai: { t: 0, w: {}, h1: 0 },
  };
}

function startMatch(s, humans, demo) {
  s.mode = demo ? 'demo' : 'play';
  let k;
  do k = (Math.random() * STAGES.length) | 0;
  while (STAGES[k] === s.st);
  s.st = STAGES[k];
  s.plats = s.st.plats.map((p) => Object.assign({}, p));
  if (demo) {
    const a = (Math.random() * CHARS.length) | 0;
    s.picks = [a, (a + 1 + ((Math.random() * (CHARS.length - 1)) | 0)) % CHARS.length];
  }
  s.f = [0, 1].map((i) => makeFighter(s, i, !humans[i], s.picks[i]));
  s.mt = 0;
  s.g = demo ? 5 : 3;
  s.nextT = 6000 + Math.random() * 4000;
  s.dropT = 1000;
  s.objs.length = 0;
  s.parts.length = 0;
  s.msgs.length = 0;
  s.winner = null;
  s.lat = { dir: 1, t: 0, k: 0 };
  // Lo que se va a romper, en orden al azar: tramos de 16 del piso. Uno hacia el medio de cada tercio aguanta hasta el grado 12.
  const fl = s.plats[0];
  const n = ((fl.x2 - fl.x1) / 16) | 0;
  s.segW = (fl.x2 - fl.x1) / n;
  s.keep = [0, 1, 2].map((k) => (((k + 0.2 + Math.random() * 0.6) * n) / 3) | 0);
  s.plan = [...Array(n).keys()].filter((i) => !s.keep.includes(i)).sort(() => Math.random() - 0.5);
  s.cracks = [];
  s.crackT = 0;
  s.warned = -1;
  s.countdown = null;
  s.cheer = 0;
  s.idle = 0;
  s.mus = { step: 0, next: 0 };
  s.tod = (Math.random() * 3) | 0;
  paintBg(s);
  s.help = 0;
  if (!demo) {
    say(s, s.st.n, YEL, 2200);
    s.help = 7000;
    sfx(s, 'select');
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
  // Los cuerpos no se atraviesan en el piso; nadie empuja al otro fuera de su plataforma ni a un hoyo.
  const [p, q] = s.f;
  const d = q.x - p.x;
  if (p.ground && q.ground && p.plat === q.plat && Math.abs(d) < 14 && !p.grabbedBy && !q.grabbedBy) {
    const m = ((14 - Math.abs(d)) / 2) * (d < 0 ? -1 : 1);
    for (const [f, v] of [[p, -m], [q, m]]) {
      const x = Phaser.Math.Clamp(f.x + v, f.plat.x1, f.plat.x2);
      if (!inHole(f.plat, x)) f.x = x;
    }
  }
  for (const f of s.f) resolveAction(s, f, s.f[1 - f.i]);
  stepObjects(s, dt);
  stepParticles(s, dt);
  if (s.help > 0) s.help -= dt * 1000;
  if (s.mode === 'end') return;

  // Pierde el que se queda sin vidas. Si se quedan sin vidas los dos en el mismo cuadro, gana el de más puntos.
  const [a, b] = s.f;
  const ko = s.f.filter((f) => checkOut(s, f) && f.lives < 1);
  if (ko.length) endMatch(s, ko.length > 1 ? (score(a) < score(b) ? b : a) : s.f[1 - ko[0].i]);
}

function humanIntent(s, f) {
  const p = 'P' + (f.i + 1) + '_';
  const h = s.controls.held;
  const pr = s.controls.pressed;
  // La fila de abajo repite la de arriba.
  return {
    l: h[p + 'L'],
    r: h[p + 'R'],
    uh: h[p + 'U'],
    d: h[p + 'D'],
    up: pr[p + 'U'],
    dn: pr[p + 'D'],
    tl: pr[p + 'L'],
    tr: pr[p + 'R'],
    b1: pr[p + '1'] || pr[p + '4'],
    b2: pr[p + '2'] || pr[p + '5'],
    b3: pr[p + '3'] || pr[p + '6'],
    h1: h[p + '1'] || h[p + '4'],
    h2: h[p + '2'] || h[p + '5'],
  };
}

function stepFighter(s, f, o, inp, dt) {
  const ms = dt * 1000;
  const c = f.c;
  f.inp = inp;
  f.inv = Math.max(0, f.inv - ms);
  f.blink = Math.max(0, f.blink - ms);
  f.drop = Math.max(0, f.drop - ms);
  f.flashT = Math.max(0, f.flashT - ms);
  f.land = Math.max(0, f.land - ms);
  f.jbuf = Math.max(0, f.jbuf - ms);
  f.coyote = Math.max(0, f.coyote - ms);
  if (f.comboShow > 0) f.comboShow -= ms;
  if (f.out > 0) {
    f.out -= ms;
    if (f.out <= 0) respawn(s, f);
    return;
  }
  if (f.grabbedBy) {
    const g = f.grabbedBy;
    // Machacar botones para zafarse.
    if (inp.b1 || inp.b2 || inp.b3 || inp.up) f.mash++;
    if (f.mash >= 2 + Math.min(2, f.susto / 50)) {
      f.mash = 0;
      f.grabbedBy = null;
      g.act = null;
      g.daze = 250;
      f.vx = g.face * 110;
      f.vy = -150;
      f.inv = 200;
      sfx(s, 'parry');
      return;
    }
    // En alto, sobre la cabeza del que agarra.
    f.x = g.x;
    f.y = g.y - 21;
    f.vx = f.vy = 0;
    return;
  }

  const free = f.stun <= 0 && f.daze <= 0;
  f.stun = Math.max(0, f.stun - ms);
  f.daze = Math.max(0, f.daze - ms);
  const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (inp.up) f.jbuf = 100;

  if (free) {
    const busy = f.act && f.act.k !== 'hold' && !(MOVES[f.act.k] && MOVES[f.act.k].air);
    // Doble toque: en el piso corre; en el aire da vuelta al tiro.
    const td = inp.tr ? 1 : inp.tl ? -1 : 0;
    if (td) {
      if (f.tap.d === td && s.mt - f.tap.t < 260) {
        if (f.ground) f.run = td;
        else {
          f.vx = td * 150 * c.spd;
          f.face = td;
        }
        puff(s, f.x - td * 6, f.y - 2, 4, WHITE);
        f.tap.t = -1e9;
      } else f.tap = { d: td, t: s.mt };
    }
    if (f.ground && f.run !== dir) f.run = 0;
    if (f.run && f.ground && Math.random() < 0.6) puff(s, f.x - f.run * 6, f.y - 1, 1, 0xc8bca8);
    const max = 118 * c.spd * (f.run ? 1.45 : 1);
    if (dir && !(busy && f.ground)) {
      // En el aire no se frena lo que ya va más rápido que el tope.
      if (Math.abs(f.vx) < max || Math.sign(f.vx) !== dir) {
        f.vx += dir * (f.ground ? 2200 : 1600) * c.spd * dt;
        if (Math.abs(f.vx) > max && Math.sign(f.vx) === dir) f.vx = dir * max;
      } else if (f.ground) {
        f.vx = approach(f.vx, dir * max, 700 * dt);
      }
      if (!f.act) f.face = dir;
      if (f.run && f.ground && Math.random() < dt * 20) puff(s, f.x - dir * 5, f.y, 1, 0xd6bd86);
    } else if (f.ground) {
      f.vx = approach(f.vx, 0, 2400 * dt);
    } else if (!dir) {
      f.vx = approach(f.vx, 0, 120 * dt);
    }
    if (f.jbuf > 0 && !busy) {
      if (f.ground || f.coyote > 0) {
        f.vy = -300 * c.jmp;
        f.ground = false;
        f.coyote = 0;
        f.jbuf = 0;
        f.jumping = true;
        sfx(s, 'jump');
      } else if (f.jumps > 0) {
        f.vy = -270 * c.jmp;
        f.jumps--;
        f.jbuf = 0;
        f.jumping = true;
        sfx(s, 'jump');
        ring(s, f.x, f.y, WHITE, 16);
      }
    }
    // Salto variable: soltar antes es un salto corto.
    if (f.jumping && !inp.uh && f.vy < -110) f.vy = -110;
    if (inp.dn && f.ground && !f.plat.solid) {
      f.drop = 200;
      f.ground = false;
    }
    readButtons(s, f, o, inp);
  } else if (f.ground) {
    f.vx = approach(f.vx, 0, 1100 * dt);
  } else if (f.stun > 0) {
    // Deriva: al salir volando todavía se puede pelear por volver.
    f.vx += dir * 260 * dt;
  }
  if (f.vy >= 0) f.jumping = false;
  if (!f.ground && f.stun > 0) f.vx *= 1 - 0.9 * dt;

  // Desde el grado 6 el piso arrastra hacia un lado, menos al más pesado, y nunca en un lugar seguro.
  // Hasta el grado 10 no lleva a un hoyo ni fuera del piso. En un lugar seguro la calma sube durante 2 s, que se recargan afuera.
  const safe = sheltered(s, f);
  if (safe && s.g > 5) {
    f.refugio = Math.min(2000, f.refugio + ms);
    if (f.refugio < 2000) gainCalma(s, f, 12 * dt);
  } else {
    f.refugio = Math.max(0, f.refugio - ms);
  }
  const nx = f.x + s.lat.dir * 8;
  // Al reaparecer, mientras parpadea, el piso no lo arrastra: alcanza a pararse.
  if (s.lat.k && f.ground && !safe && f.inv <= 0 && (s.g > 10 || (nx > f.plat.x1 && nx < f.plat.x2 && !inHole(f.plat, nx)))) {
    f.x += (s.lat.dir * s.lat.k * 40 * dt) / c.wt;
    // Polvo que queda atrás en los pies: dice hacia dónde arrastra el piso.
    if (Math.random() < s.lat.k / 3) s.parts.push({ x: f.x, y: f.y - 2, vx: -s.lat.dir * 20, vy: -12, l: 0.4, c: 0xd6bd86, z: 2, ng: 1 });
  }

  const fast = inp.d && !f.ground && f.vy > -40;
  f.vy = Math.min(f.vy + (fast ? 1800 : 900) * dt, fast ? 420 : 300);
  const py = f.y;
  const wasGround = f.ground;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.ground = false;
  if (f.vy >= 0) {
    for (const p of s.plats) {
      if (p.broken || (f.drop > 0 && !p.solid)) continue;
      if (py <= p.y + 1 && f.y >= p.y && f.x > p.x1 - 3 && f.x < p.x2 + 3 && !inHole(p, f.x)) {
        // Rebote al caer volando contra el piso.
        if (f.stun > 0 && f.vy > 260) {
          f.vy *= -0.35;
          f.y = p.y - 1;
          puff(s, f.x, p.y, 5, 0xd6bd86);
          sfx(s, 'thud');
          continue;
        }
        if (f.vy > 200) {
          f.land = 90;
          puff(s, f.x, p.y, 3, 0xd6bd86);
        }
        f.y = p.y;
        f.vy = 0;
        f.ground = true;
        f.jumps = 1;
        f.plat = p;
        if (f.act && MOVES[f.act.k] && MOVES[f.act.k].air) f.act = null;
        break;
      }
    }
  }
  if (wasGround && !f.ground && f.vy >= 0 && !f.jumping) f.coyote = 80;

  // En la grieta se cae: las paredes no dejan salir de lado.
  const fl = s.plats[0];
  const h = f.y > fl.y + 2 && f.x > fl.x1 - 3 && f.x < fl.x2 + 3 && fl.holes && fl.holes.find((h) => f.x > h[0] - 12 && f.x < h[1] + 12);
  if (h) f.x = Phaser.Math.Clamp(f.x, h[0] + 2, h[1] - 2);

  // La parrilla quema.
  if (f.ground && f.plat.hot) {
    f.hotT -= ms;
    if (f.hotT <= 0) {
      f.hotT = 350;
      f.stun = f.stun || 120;
      f.susto += 3;
      f.vy = -180;
      f.ground = false;
      puff(s, f.x, f.y, 4, ORANGE);
      sfx(s, 'whiff');
    }
  }

  // Cada personaje golpea a su ritmo: Chepo arranca más lento y Dani más rápido.
  if (f.act) f.act.t += MOVES[f.act.k] ? ms * c.at : ms;
  if (f.hold) {
    f.hold.x = f.x;
    f.hold.y = f.y - 24;
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
    if (inp.b2 && f.act.t > 350) f.act.t = 999;
    return;
  }
  if (f.act) return;
  if (f.hold && (inp.b1 || inp.b2)) {
    throwObj(s, f);
    return;
  }
  if (inp.b1) {
    // B1 según la dirección: arriba uppercut (también en el aire), abajo barrida o pisotón.
    let k;
    if (inp.uh) k = 'upper';
    else if (f.ground) k = inp.d ? 'sweep' : inp.l || inp.r ? 'smash' : 'jab';
    else k = inp.d ? 'stomp' : 'akick';
    f.act = { k, t: 0, ch: 0, hold: true };
    sfx(s, 'whiff', Object.keys(MOVES).indexOf(k));
  } else if (inp.b2) {
    const ob = nearObj(s, f);
    if (ob) {
      ob.st = 'held';
      f.hold = ob;
      sfx(s, 'grab');
    } else if (f.ground) {
      f.act = { k: 'grab', t: 0 };
    }
  } else if (inp.b3) {
    f.act = { k: 'parry', t: 0 };
  }
}

// Golpe vence agarre, parry vence golpe y objeto lanzado, agarre vence parry.
function resolveAction(s, f, o) {
  const a = f.act;
  if (!a) return;
  const m = MOVES[a.k];
  if (m) {
    // Mantener B1 carga el golpe fuerte.
    if (a.k === 'smash' && a.hold) {
      if (f.inp.h1 && a.ch < 600 && a.t >= 100) {
        a.ch += a.t - 100;
        a.t = 100;
      } else if (!f.inp.h1) {
        a.hold = false;
      }
    }
    // Al soltar, el fuerte se lanza hacia adelante y el gancho despega del piso.
    if (!a.go && a.t >= m.s) {
      a.go = 1;
      if (a.k === 'smash') f.vx = f.face * 230;
      if (a.k === 'upper' && f.ground) {
        f.vy = -150;
        f.ground = false;
      }
    }
    const live = a.t >= m.s && a.t < m.s + m.a && touches(f, o, m.box) && o.inv <= 0 && !o.grabbedBy;
    if (a.k !== 'grab' && !a.hit && live) {
      a.hit = true;
      if (isParrying(o)) {
        parried(s, o, f);
      } else {
        const ch = 1 + (a.ch / 600) * 0.7;
        const an = a.k === 'stomp' && o.ground ? 1.2 : m.an;
        hit(s, o, f.face, m.d * ch * f.c.pow, m.b * ch, m.gr, an, f);
        f.sty += 50;
        if (a.k === 'stomp' && !o.ground) o.spiked = true;
      }
    }
    if (a.k === 'grab' && !a.hit && live && o.stun <= 0 && o.out <= 0) {
      a.hit = true;
      o.grabbedBy = f;
      o.mash = 0;
      o.act = null;
      dropHold(o);
      f.act = { k: 'hold', t: 0 };
      sfx(s, 'grab');
      return;
    }
    if (a.t > m.e) f.act = null;
  } else if (a.k === 'hold') {
    if (a.t > 450) {
      // Se lanza hacia donde apunte el joystick: adelante, atrás, arriba o abajo.
      const inp = f.inp;
      const dir = inp.r ? 1 : inp.l ? -1 : f.face;
      o.grabbedBy = null;
      f.act = { k: 'throwing', t: 0 };
      if (inp.d) hit(s, o, dir, 9 * f.c.pow, 50, 1.6, 1.45, f);
      else hit(s, o, dir, 12 * f.c.pow, 90, 3, inp.uh ? 1.35 : 0.6, f);
      f.sty += 100;
      puff(s, o.x, f.y, 8, 0xd6bd86);
      s.kick = 3;
      sfx(s, 'throw');
    }
  } else if (a.k === 'remezon') {
    if (a.t >= 220) {
      f.act = null;
      remezon(s, f, o);
    }
  } else if (a.k === 'parry') {
    if (a.t > 420) f.act = null;
  } else if (a.k === 'throwing') {
    if (a.t > 200) f.act = null;
  }
}

function touches(f, o, box) {
  if (o.out > 0) return false;
  const ax = f.face > 0 ? f.x + box[0] : f.x - box[1];
  const bx = f.face > 0 ? f.x + box[1] : f.x - box[0];
  return o.x + 5 > ax && o.x - 5 < bx && o.y - 26 - o.c.lg < f.y + box[3] && o.y > f.y + box[2];
}

function isParrying(f) {
  return f.act && f.act.k === 'parry' && f.act.t < 160;
}

function parried(s, f, attacker) {
  f.act = null;
  f.sty += 200;
  gainCalma(s, f, 34);
  attacker.act = null;
  attacker.daze = 350;
  attacker.vx = -attacker.face * 200;
  s.stop = 110;
  ring(s, f.x, f.y - 12, 0x9fe8ff, 24);
  sfx(s, 'parry');
}

function hit(s, t, dir, dmg, base, growth, ang, by) {
  const chain = t.stun > 0;
  t.susto += dmg * HIT_SUSTO;
  gainCalma(s, t, dmg * 0.8);
  // Sin vida, cualquier golpe lo saca volando.
  const kb = t.susto >= MAX_SUSTO ? 700 : (base + t.susto * growth) / t.c.wt;
  t.vx = dir * kb * Math.cos(ang);
  t.vy = -kb * Math.sin(ang) - (ang < 0 ? 0 : 40);
  t.stun = Math.min(700, 120 + t.susto * 1.4);
  const v = s.f[1 - t.i];
  if (v.grabbedBy === t) v.grabbedBy = null;
  t.act = null;
  t.ground = false;
  t.spiked = false;
  t.flashT = 50;
  dropHold(t);
  // Si el golpe probablemente saca, la pausa es más larga.
  s.stop = kb > 400 ? 200 : Math.min(120, 50 + dmg * 4);
  s.kick = Math.min(3, 1 + t.susto / 60);
  if (by) {
    by.combo = chain ? by.combo + 1 : 1;
    if (by.combo >= 3) {
      by.comboShow = 900;
      by.sty += 40 * by.combo;
    }
  }
  const big = t.susto > 70;
  if (big) flash(s, 0.3);
  s.fx.push({ x: t.x - dir * 4, y: t.y - 14, r: big || kb > 400 ? 14 : 9, l: 0.16, d: dir });
  puff(s, t.x, t.y - 12, big ? 10 : 6, big ? ORANGE : YEL);
  sfx(s, big ? 'bighit' : 'hit', t.susto);
}

function remezon(s, f, o) {
  const near = o.out <= 0 && o.inv <= 0 && Math.hypot(o.x - f.x, o.y - f.y) < 60;
  if (near && isParrying(o)) {
    parried(s, o, f);
    return;
  }
  flash(s, 0.5);
  s.stop = 140;
  s.kick = 4;
  ring(s, f.x, f.y - 10, RED, 24);
  sfx(s, 'remezon');
  for (const ob of s.objs) {
    if (ob.st !== 'held' && !OBJS[ob.k].heavy) {
      ob.vy = -200;
      ob.st = 'fall';
    }
  }
  if (near) {
    hit(s, o, o.x >= f.x ? 1 : -1, 14 * f.c.pow, 140, 3.4, 0.75, f);
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
  const losing = f.lives < o.lives || f.susto > o.susto + 30;
  f.calma = Math.min(100, f.calma + n * (losing ? 1.5 : 1));
}

// Devuelve true si el luchador salió de la pantalla en este cuadro.
function checkOut(s, f) {
  if (f.out > 0) return false;
  if (f.x > -30 && f.x < W + 30 && f.y < H + 40 && f.y > -120) return false;
  const o = s.f[1 - f.i];
  f.lives--;
  f.susto = 0;
  f.out = 900;
  f.act = null;
  f.grabbedBy = null;
  dropHold(f);
  if (o.grabbedBy === f) o.grabbedBy = null;
  o.base += 1000;
  if (f.lives < o.lives - 1) f.behind = true;
  const ex = Phaser.Math.Clamp(f.x, 4, W - 4);
  const ey = Phaser.Math.Clamp(f.y, 4, H - 4);
  for (let k = 0; k < 3; k++) puff(s, ex, ey, 12, [WHITE, YEL, PCOL[f.i]][k]);
  ring(s, ex, ey, PCOL[f.i], 20);
  s.ko = { t: s.now, x: ex, y: ey, c: PCOL[o.i] };
  flash(s, 0.45);
  s.kick = 4;
  s.cheer = 1500;
  sfx(s, 'ko');
  // Texto solo para lo insólito.
  if (f.spiked) say(s, '¡PISOTÓN!', WHITE, 900);
  else if (f.lastObj && s.mt - f.lastObj.t < 1500 && OBJS[f.lastObj.k].heavy) say(s, '¡CON TODO EL MUEBLE!', WHITE, 1100);
  return true;
}

// Reaparece sobre lo primero firme desde su lado, con 6 de piso detrás.
function respawn(s, f) {
  const d = f.i ? -1 : 1;
  let x = f.i ? s.plats[0].x2 - 50 : s.plats[0].x1 + 50;
  while (Math.max(below(s, x, 0), below(s, x - 6 * d, 0)) > H && x > 0 && x < W) x += 4 * d;
  f.x = x;
  f.y = 30;
  f.vx = 0;
  f.vy = 0;
  f.stun = 0;
  f.daze = 0;
  f.act = null;
  f.inv = 1500;
  f.blink = 1500;
  f.out = 0;
  f.spiked = false;
}

function inHole(p, x) {
  return p.holes && p.holes.some((h) => x > h[0] && x < h[1]);
}

// Bajo una mesa o bajo el marco de la puerta el temblor no hace nada: ni arrastra, ni levanta, ni le cae algo encima.
// Desde el grado 10 ya no hay lugar seguro.
function sheltered(s, f) {
  return s.g < 10 && f.ground && f.plat.solid && (s.st.doors.some((d) => f.x > d[0] && f.x < d[1]) || s.plats.some((p) => p.mesa && f.x > p.x1 && f.x < p.x2));
}

// Lo primero que hay bajo un punto: ahí van las sombras.
function below(s, x, y) {
  return Math.min(...s.plats.filter((p) => !p.broken && p.y >= y - 1 && x > p.x1 && x < p.x2 && !inHole(p, x)).map((p) => p.y));
}

function dropHold(f) {
  if (f.hold) {
    f.hold.st = 'fall';
    f.hold.vy = -60;
    f.hold = null;
  }
}

// ---------- Temblor ----------

// Cada grado dura de 6 a 10 s, al azar, y suma una regla: en el 5 cae de todo y el piso se corre de golpe, en el 6 se mece y se agrieta,
// en el 7 se rompe lo frágil y las grietas se abren, en el 10 ya no hay lugar seguro, en el 11 el piso lleva al hoyo y en el 12 no aguanta nada.
function updateQuake(s, dt) {
  const ms = dt * 1000;
  const fl = s.plats[0];
  if (s.g < 12 && s.warned !== s.g && s.nextT - s.mt <= (s.g === 5 ? 3000 : 1500)) {
    s.warned = s.g;
    sfx(s, 'alert');
    if (s.g === 5) s.countdown = s.mt;
  }
  if (s.g < 12 && s.mt >= s.nextT) {
    const g = ++s.g;
    s.nextT = s.mt + 6000 + Math.random() * 4000;
    sfx(s, 'rumble', g);
    s.kick = 1 + g / 3;
    s.gPop = s.now;
    if (g === 6) spawnObj(s, s.st.heavy, W / 2, -20);
    if (g === 7) {
      for (const p of s.plats) {
        if (p.brk) {
          p.broken = true;
          for (let k = 0; k < 3; k++) puff(s, (p.x1 + p.x2) / 2, p.y, 8, 0x7a4a2a);
        }
      }
      sfx(s, 'break');
    }
    if (g === 10) say(s, '¡YA NO HAY LUGAR SEGURO!', RED, 1500);
    if (g === 12) s.plan.push(...s.keep);
  }
  const g = s.g;
  // Grietas al azar, cada vez más seguido. Desde el grado 7, la que lleva 3 s se abre en un hoyo.
  if (g > 5) {
    s.crackT -= ms;
    if (s.crackT <= 0 && s.plan.length) {
      const i = s.plan.shift();
      // Mientras haya lugares seguros, el piso de abajo no se rompe: ese tramo vuelve a la cola.
      if ([-0.2, 0.5, 1.2].some((e) => sheltered(s, { ground: 1, plat: fl, x: fl.x1 + (i + e) * s.segW }))) s.plan.push(i);
      else {
        s.cracks.push({ i, t: s.mt });
        s.crackT = 20000 / (g - 3);
      }
    }
    s.cracks = s.cracks.filter((c) => {
      if (g < 7 || s.mt - c.t < 3000) return true;
      const a = fl.x1 + c.i * s.segW;
      // El hoyo nuevo se junta con los que toca: el piso roto es un solo hoyo, sin dientes de tierra entre medio.
      let h = [a - Math.random() * 2, a + s.segW + Math.random() * 2];
      fl.holes = (fl.holes || []).filter((o) => o[1] < h[0] || o[0] > h[1] || !(h = [Math.min(h[0], o[0]), Math.max(h[1], o[1])]));
      fl.holes.push(h);
      for (let k = 0; k < 4; k++) puff(s, a + s.segW / 2, fl.y, 8, 0x8a8a9c);
      sfx(s, 'break');
      s.kick = 2;
    });
  }
  if (g > 4) {
    s.dropT -= ms;
    // Caen pocas: una cada 4,4 s en el grado 5 y cada 1,2 s en el 12.
    if (s.dropT <= 0 && s.objs.length < 5) {
      s.dropT = 12000 / (g - 2.3);
      const kinds = s.st.drops;
      spawnObj(s, kinds[(Math.random() * kinds.length) | 0], fl.x1 + 20 + Math.random() * (fl.x2 - fl.x1 - 40), -10);
    }
  }
  // El vaivén cambia de lado cada 3 s. Desde el grado 6 el piso se mece con él: más en un edificio que en una casa.
  s.lat.t += ms;
  if (s.lat.t > 3000) {
    s.lat.t = 0;
    s.lat.dir *= -1;
  }
  s.lat.k = g > 5 ? Math.sin((s.lat.t / 3000) * Math.PI) * Math.min(1.5, (g - 5) * 0.3) * s.st.sw : 0;
  // Remezones: desde el grado 5 el piso se corre de golpe. Lo liviano apenas salta y se desliza; lo pesado solo se desliza, y menos.
  // A los luchadores no los levanta: el arrastre del piso ya los mueve.
  if (g > 4) {
    s.joltT = (s.joltT || 0) - ms;
    if (s.joltT < 250 && Math.random() < 0.5) puff(s, fl.x1 + Math.random() * (fl.x2 - fl.x1), fl.y, 1, 0x8a8a9c);
    if (s.joltT <= 0) {
      s.joltT = 900 + Math.random() * (2400 - g * 130);
      s.kick = g / 4;
      for (const ob of s.objs) {
        if (ob.st === 'ground') {
          const hv = OBJS[ob.k].heavy;
          ob.vx += s.lat.dir * (hv ? 20 : 50);
          if (!hv) {
            ob.st = 'fall';
            ob.vy = -50;
          }
        }
      }
      sfx(s, 'thud');
    }
  }
  // Desde el grado 6: polvo del techo y retumbos.
  if (g > 5) {
    s.rumbleT = (s.rumbleT || 0) - ms;
    if (s.rumbleT <= 0) {
      s.rumbleT = 1300;
      sfx(s, 'rumble', g - 3);
    }
    if (Math.random() < dt * 10) s.parts.push({ x: 30 + Math.random() * 260, y: 0, vx: 0, vy: 30, l: 2, c: 0xd6bd86, z: 1, ng: true });
  }
  for (const f of s.f) {
    if (f.out <= 0 && g > 7) f.sty += 20 * dt;
  }
  if (s.cheer > 0) s.cheer -= ms;
}

// ---------- Objetos ----------

function spawnObj(s, k, x, y) {
  s.objs.push({ k, x, y, vx: (Math.random() - 0.5) * 30, vy: 0, st: 'fall', own: null, gt: 0 });
}

function nearObj(s, f) {
  return s.objs.find((ob) => ob.st === 'ground' && Math.abs(ob.x - f.x) < 14 && Math.abs(ob.y - f.y) < 12);
}

function throwObj(s, f) {
  const ob = f.hold;
  const heavy = OBJS[ob.k].heavy;
  f.hold = null;
  ob.st = 'fly';
  ob.own = f;
  ob.x = f.x + f.face * 10;
  ob.y = f.y - 14;
  ob.vx = f.face * (heavy ? 220 : 320);
  ob.vy = f.inp.uh ? -200 : -60;
  f.act = { k: 'throwing', t: 0 };
  sfx(s, 'throw');
}

function stepObjects(s, dt) {
  for (let i = s.objs.length - 1; i >= 0; i--) {
    const ob = s.objs[i];
    const d = OBJS[ob.k];
    if (ob.st === 'held') continue;
    if (ob.st === 'ground') {
      ob.vx = approach(ob.vx, 0, 300 * dt);
      // El piso que se mece arrastra lo suelto; lo pesado, menos.
      ob.x += (ob.vx + s.lat.dir * s.lat.k * (d.heavy ? 12 : 30)) * dt;
      if (!s.plats.some((p) => !p.broken && Math.abs(ob.y - p.y) < 2 && ob.x > p.x1 && ob.x < p.x2 && !inHole(p, ob.x))) ob.st = 'fall';
      if (s.mt - ob.gt > 8000) s.objs.splice(i, 1);
      continue;
    }
    const py = ob.y;
    ob.vy += (ob.st === 'fly' ? 320 : 640) * dt;
    ob.x += ob.vx * dt;
    ob.y += ob.vy * dt;
    let gone = false;

    for (const f of s.f) {
      if (f.out > 0 || f.inv > 0 || f === ob.own || f.grabbedBy) continue;
      if (Math.abs(ob.x - f.x) < 5 + d.w / 2 && ob.y > f.y - 26 && ob.y - d.h < f.y) {
        if (ob.st === 'fly') {
          if (isParrying(f)) {
            ob.vx = -ob.vx * 1.1;
            ob.own = f;
            f.act = null;
            f.sty += 200;
            gainCalma(s, f, 34);
            ring(s, f.x, f.y - 10, WHITE);
            sfx(s, 'parry');
            s.stop = 90;
          } else {
            hit(s, f, Math.sign(ob.vx), d.dmg * ob.own.c.pow, 110, d.heavy ? 3.2 : 2.4, 0.55, ob.own);
            f.lastObj = { k: ob.k, t: s.mt };
            ob.own.sty += 150;
            if (d.brk) gone = breakObj(s, i, ob);
            else {
              ob.vx *= -0.3;
              ob.st = 'fall';
              ob.own = null;
            }
          }
          break;
        } else if (ob.vy > 150 && !sheltered(s, f)) {
          hit(s, f, ob.x < f.x ? 1 : -1, 4, 50, 1.2, 1.1, null);
          f.stun = Math.min(f.stun, 150);
          f.lastObj = { k: ob.k, t: s.mt };
          gone = d.brk ? breakObj(s, i, ob) : false;
          if (!gone) ob.vy = -120;
          break;
        }
      }
    }
    if (gone) continue;

    if (ob.vy >= 0) {
      for (const p of s.plats) {
        if (p.broken || py > p.y || ob.y < p.y || ob.x <= p.x1 || ob.x >= p.x2 || inHole(p, ob.x)) continue;
        if (ob.st === 'fly' && d.brk) {
          gone = breakObj(s, i, ob);
        } else if (d.bounce && ob.vy > 60) {
          ob.y = p.y;
          ob.vy *= -0.6;
        } else {
          ob.gt = s.mt;
          ob.y = p.y;
          ob.vy = 0;
          ob.vx *= 0.5;
          ob.st = 'ground';
          ob.own = null;
          if (d.heavy) s.kick = 2;
        }
        break;
      }
    }
    if (!gone && (ob.y > H + 30 || ob.x < -30 || ob.x > W + 30)) s.objs.splice(i, 1);
  }
}

function breakObj(s, i, ob) {
  s.objs.splice(i, 1);
  puff(s, ob.x, ob.y - 3, 10, WHITE);
  sfx(s, 'break');
  return true;
}

// ---------- CPU ----------

function cpuIntent(s, f, o, dt) {
  const ai = f.ai;
  ai.t -= dt * 1000;
  ai.h1 -= dt * 1000;
  const w = ai.w;
  const out = { l: w.l, r: w.r, uh: w.uh, d: w.d, up: false, dn: false, b1: false, b2: false, b3: false, h1: ai.h1 > 0, h2: false };
  const fl = s.plats[0];
  const dx = o.x - f.x;
  const adx = Math.abs(dx);
  const toward = (x) => {
    w.l = x < f.x - 4;
    w.r = x > f.x + 4;
  };
  if (f.grabbedBy) {
    out.b1 = Math.random() < 0.08;
    return out;
  }
  // Volver al escenario si está afuera.
  if (!f.ground && (f.x < fl.x1 + 6 || f.x > fl.x2 - 6) && f.y > fl.y - 60) {
    toward(W / 2);
    out.l = w.l;
    out.r = w.r;
    out.uh = true;
    if (f.vy > 0 && f.jumps > 0) out.up = true;
    return out;
  }
  // Salta las grietas en vez de caer en ellas.
  const nx = f.x + f.vx * 0.12;
  if (f.ground && Math.abs(f.vx) > 20 && fl.holes && fl.holes.some((h) => nx > h[0] - 6 && nx < h[1] + 6)) {
    out.up = out.uh = w.uh = true;
    ai.t = 300;
    return out;
  }
  if (o.act && MOVES[o.act.k] && o.act.t < 50 && adx < 24 && Math.random() < 0.1) {
    out.b3 = true;
    return out;
  }
  if (ai.t > 0) return out;
  ai.t = 120 + Math.random() * 150;
  w.l = w.r = w.uh = w.d = false;

  if (s.g > 7 && s.g < 10 && Math.random() < 0.3) {
    const door = s.st.doors[0];
    toward((door[0] + door[1]) / 2);
    return out;
  }
  if (f.calma >= 100 && adx < 50) {
    out.b1 = true;
    out.h2 = true;
    return out;
  }
  if (f.hold) {
    f.face = Math.sign(dx) || f.face;
    if (Math.abs(o.y - f.y) < 16 && adx > 20) out.b2 = true;
    else toward(o.x - Math.sign(dx) * 60);
    return out;
  }
  const ob = s.objs.find((b) => b.st === 'ground' && Math.abs(b.x - f.x) < 80);
  if (ob && adx > 50 && Math.random() < 0.6) {
    if (Math.abs(ob.x - f.x) < 10) out.b2 = true;
    else toward(ob.x);
    return out;
  }
  if (o.y < f.y - 22 && adx < 30) {
    if (f.ground && Math.random() < 0.5) {
      out.uh = true;
      out.b1 = true;
    } else {
      out.up = true;
      w.uh = true;
    }
    return out;
  }
  if (!f.ground && adx < 22) {
    out.b1 = true;
    if (o.y > f.y + 8) out.d = true;
    return out;
  }
  f.run = adx > 70 && f.ground ? Math.sign(dx) : f.run;
  if (adx > 16) {
    toward(o.x);
    if (o.y < f.y - 20 && Math.random() < 0.4) {
      out.up = true;
      w.uh = true;
    }
    return out;
  }
  f.face = Math.sign(dx) || f.face;
  const r = Math.random();
  if (r < 0.35) out.b1 = true;
  else if (r < 0.5) {
    out.b1 = true;
    out[dx > 0 ? 'r' : 'l'] = true;
    ai.h1 = Math.random() * 500;
  } else if (r < 0.64) out.b2 = true;
  else if (r < 0.74) {
    out.d = true;
    out.b1 = true;
  } else if (r < 0.84) {
    out.up = true;
    w.uh = true;
  } else toward(f.x - dx * 4);
  return out;
}

// ---------- Fin de partido, iniciales y records ----------

function endMatch(s, winner) {
  s.mode = 'end';
  s.winner = winner;
  s.endT = 0;
  s.saved = false;
  s.entries = [];
  if (s.f.every((f) => f.cpu)) return;
  winner.base += 2000;
  if (winner.behind) {
    winner.base += 1000;
    winner.comeback = true;
  }
  sfx(s, 'win');
  for (const f of s.f) {
    const sc = score(f);
    const top = s.records.top;
    const qualifies = sc > 0 && (top.length < MAX_RECORDS || sc > top[top.length - 1].s);
    if (!f.cpu && (f === winner || qualifies)) {
      s.entries.push({ f, letters: ((s.lastName && s.lastName[f.i]) || [0, 0, 0]).slice(), pos: 0, done: false, cool: 0 });
    }
  }
}

function score(f) {
  return Math.round(f.base + Math.min(3000, f.sty));
}

function updateEnd(s, dt) {
  s.endT += dt * 1000;
  const pr = s.controls.pressed;
  const h = s.controls.held;
  if (s.endT < 600) return;
  if (s.f.every((f) => f.cpu)) {
    if (pr.START1 || pr.START2) openSelect(s, [!!pr.START1, !!pr.START2]);
    else if (s.endT > 4000) startMatch(s, [false, false], true);
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
    if (pr[p + '1'] || pr[p + '4']) {
      if (e.pos < 2) e.pos++;
      else {
        e.done = true;
        sfx(s, 'parry');
      }
    }
  }
  const all = s.entries.every((e) => e.done);
  const start = (pr.START1 || pr.START2) && s.endT > 1500;
  if ((all || start || s.endT > 20000) && !s.saved) saveEntries(s);
  if (s.saved && (start || s.endT > (s.entries.length ? 25000 : 8000))) {
    if (start) startMatch(s, s.f.map((f) => !f.cpu), false);
    else startMatch(s, [false, false], true);
  }
}

// Solo se guardan las iniciales confirmadas.
function saveEntries(s) {
  s.saved = true;
  s.lastName = s.lastName || [];
  const r = s.records;
  for (const e of s.entries) {
    if (!e.done) continue;
    const n = e.letters.map((c) => String.fromCharCode(65 + c)).join('');
    s.lastName[e.f.i] = e.letters.slice();
    r.top.push({ n, s: score(e.f), g: s.g });
    if (e.f === s.winner && s.f.every((f) => !f.cpu)) {
      r.rey = r.rey && r.rey.n === n ? { n, r: r.rey.r + 1 } : { n, r: 1 };
    }
  }
  r.top.sort((a, b) => b.s - a.s);
  r.top.length = Math.min(r.top.length, MAX_RECORDS);
  storageSet(STORAGE_KEY, r).catch(() => {});
}

async function loadRecords() {
  try {
    const res = await storageGet(STORAGE_KEY);
    const v = res && res.found ? res.value : null;
    const ok = (e) => e && typeof e.n === 'string' && /^[A-Z]{3}$/.test(e.n);
    const top = v && Array.isArray(v.top) ? v.top.filter((e) => ok(e) && Number.isFinite(e.s) && Number.isFinite(e.g)) : [];
    top.sort((a, b) => b.s - a.s);
    const rey = v && ok(v.rey) && Number.isFinite(v.rey.r) ? v.rey : null;
    return { top: top.slice(0, MAX_RECORDS), rey };
  } catch (e) {
    return { top: [], rey: null };
  }
}

// ---------- Partículas y mensajes ----------

function puff(s, x, y, n, c) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 20 + Math.random() * 100;
    s.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, l: 0.3 + Math.random() * 0.4, c, z: 1 + ((Math.random() * 2) | 0) });
  }
  if (s.parts.length > 260) s.parts.splice(0, s.parts.length - 260);
}

function ring(s, x, y, c, n) {
  const k = n || 14;
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    s.parts.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, l: 0.25, c, z: 2, ng: true });
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
    if (!p.ng) p.vy += 380 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function say(s, str, col, ms) {
  // En el demo no hay mensajes: chocarían con el título.
  if (s.mode !== 'demo') s.msgs.push({ str, col, t0: s.now, ms: ms || 1300 });
}

function approach(v, target, step) {
  return v > target ? Math.max(target, v - step) : Math.min(target, v + step);
}

// ---------- Dibujo ----------

// Fondo estático: se dibuja una vez por partido en una textura, con un grano fijo para que lo plano no se vea plano.
function paintBg(s) {
  const g = s.bg.clear();
  s.st.bg(g, s.tod);
  for (let k = 0; k < 9000; k++) g.fillStyle(k & 1 ? 0xffffff : 0, 0.04).fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
  s.bgt.clear().draw(g);
}

function render(s, t) {
  const g = s.dyn;
  g.clear();
  const env = 0.35 + 0.65 * Math.max(0, Math.sin(t / 650));
  // La imagen tiembla entera y sin girar, más de lado que de arriba abajo: girar, acercarse o saltar de ida y vuelta marea.
  const amp = s.mode === 'end' || s.mode === 'select' ? 0 : (shake(s) * env) / 2 + s.kick;
  s.kick = Math.max(0, s.kick - 0.25);
  s.world.x = Math.round(W / 2 + (Math.random() - 0.5) * amp * 2);
  s.world.y = Math.round(H / 2 + (Math.random() - 0.5) * amp * 0.7);

  s.st.anim(g, t, s);
  // El velo separa el fondo de lo que se pisa; de noche es más suave porque la hora ya oscurece.
  g.fillStyle(K, [0.38, 0.3, 0.2][s.tod]).fillRect(0, 0, W, H);
  // Bordes claros en todo lo que se pisa.
  for (const p of s.plats) {
    if (p.brk) continue;
    g.fillStyle(0xe8d8b0).fillRect(p.x1, p.y, p.x2 - p.x1, 2);
    g.fillStyle(K).fillRect(p.x1, p.y + 2, p.x2 - p.x1, 1);
  }
  const fl = s.plats[0];
  // Del grado 5 al 9, cuando cae de todo, los lugares seguros se marcan en verde.
  if (s.g > 4 && s.g < 10) {
    g.lineStyle(2, 0x3fd07a, 0.6 + 0.4 * Math.sin(t / 120));
    for (const d of s.st.doors) g.strokeRect(d[0], fl.y - d[2], d[1] - d[0], d[2]);
    for (const p of s.plats) if (p.mesa) g.strokeRect(p.x1, p.y + 3, p.x2 - p.x1, fl.y - p.y - 3);
  }
  // Piso partido: dos paredes dentadas que se cierran hacia abajo, dentro del hoyo, y pedazos que siguen cayendo.
  // En el depto y el edificio, los que más se mecen, la pared es de concreto.
  for (const h of fl.holes || []) {
    for (let y = 0; y < H - fl.y; y += 3) {
      const l = h[0] + y / 20 + ((y * 7) % 4);
      const w = h[1] - y / 20 - ((y * y) % 5) - l;
      g.fillStyle(s.st.sw > 1.1 ? 0x8a8a9c : 0x7a4a2a).fillRect(l, fl.y + y, w, 3);
      g.fillStyle(K).fillRect(l + 2, fl.y + y, w - 4, 3);
    }
    if (Math.random() < 0.06) s.parts.push({ x: h[0] + Math.random() * (h[1] - h[0]), y: fl.y, vx: 0, vy: 0, l: 0.8, c: 0x8a8a9c, z: 2 });
  }
  // Grietas que crecen sobre el piso: una línea quebrada que corta el borde claro y se abre hacia los lados.
  g.fillStyle(K);
  for (const c of s.cracks) {
    const x = fl.x1 + (c.i + 0.5) * s.segW;
    const n = Math.min(10, 2 + (s.mt - c.t) / 300);
    for (let k = -n; k < n; k++) g.fillRect(x + k, fl.y + (((k * 5) & 2) >> 1), 1, Math.abs(k) < n / 3 ? 3 : 2);
  }
  // Grado 7 y 8, bajo techo: caen pedazos del techo.
  if (s.g > 6 && s.st.n === 'EL DEPTO' && Math.random() < 0.3) s.parts.push({ x: 20 + Math.random() * 280, y: 0, vx: 0, vy: 60, l: 3, c: 0xd6bd86, z: 2 + ((Math.random() * 2) | 0) });
  for (const p of s.plats) {
    if (!p.brk) continue;
    if (p.broken) g.fillStyle(0x7a4a2a).fillTriangle(p.x1, p.y, p.x1 + 6, p.y, p.x1 + 2, p.y + 20);
    else {
      g.fillStyle(K).fillRect(p.x1 - 1, p.y - 1, p.x2 - p.x1 + 2, 5);
      g.fillStyle(0x9a6a3a).fillRect(p.x1, p.y, p.x2 - p.x1, 3);
    }
  }
  // Lo que cae avisa con una sombra que crece.
  for (const ob of s.objs) {
    const sy = ob.st === 'fall' && ob.vy > 150 ? below(s, ob.x, ob.y) : H;
    const w = Math.min(14, 2 + 600 / (sy - ob.y + 40));
    if (sy < H) g.fillStyle(K, 0.6).fillEllipse(ob.x, sy, w, 3).lineStyle(1, WHITE, 0.8).strokeEllipse(ob.x, sy, w, 3);
    drawObj(s, g, ob);
  }
  // El golpeado se dibuja primero, para que no tape el puño ni la pierna que le pegó.
  for (const f of [...s.f].sort((a, b) => b.stun - a.stun)) drawFighter(s, g, f, t);
  for (let i = s.fx.length - 1; i >= 0; i--) {
    const e = s.fx[i];
    e.l -= 1 / 60;
    if (e.l <= 0) {
      s.fx.splice(i, 1);
      continue;
    }
    // Chispa en estrella y rayas hacia donde sale el golpe.
    const r = e.r * Math.min(1, 0.4 + e.l * 6);
    g.fillStyle(YEL).fillRect(e.x - r, e.y - 1, r * 2, 3).fillRect(e.x - 1, e.y - r, 3, r * 2);
    g.fillStyle(WHITE).fillRect(e.x - r / 2, e.y, r, 1).fillRect(e.x, e.y - r / 2, 1, r);
    for (let k = -1; k < 2; k++) g.fillRect(e.d > 0 ? e.x + 5 : e.x - 5 - r, e.y + k * 5, r, 1);
  }
  for (const p of s.parts) g.fillStyle(p.c, Math.min(1, p.l * 4)).fillRect(Math.round(p.x), Math.round(p.y), p.z, p.z);
  // Al sacar: la pantalla toma el color del que saca y un trazo de sismógrafo sale de donde cayó el otro.
  s.koK = s.ko ? Math.max(0, 1 - (t - s.ko.t) / 400) : 0;
  if (s.koK > 0) {
    g.fillStyle(s.ko.c, s.koK * 0.3).fillRect(0, 0, W, H);
    g.lineStyle(3, WHITE, s.koK).beginPath().moveTo(s.ko.x, s.ko.y);
    for (let k = 1; k < 9; k++) g.lineTo(s.ko.x + ((W / 2 - s.ko.x) * k) / 8, s.ko.y + ((H / 2 - s.ko.y) * k) / 8 + (k & 1 ? -10 : 10));
    g.strokePath();
  }
  // Grado 7 y 8: la luz baja de golpe, una vez por segundo como máximo, salvo de noche, que ya está oscuro.
  if (s.g > 6 && s.tod < 2 && s.mode !== 'end' && Math.sin(t / 160) > 0.97) g.fillStyle(K, 0.3).fillRect(0, 0, W, H);

  drawHud(s, t);
}

function drawFighter(s, g, f, t) {
  if (f.out > 0 || (f.blink > 0 && ((t / 70) | 0) % 2)) return;
  // Agarrado: acostado sobre las manos del otro y pataleando.
  if (f.grabbedBy) {
    g.save().translateCanvas(Math.round(f.x) + ((t / 70) & 1), Math.round(f.y) - 8).rotateCanvas((f.grabbedBy.face * Math.PI) / 2);
    drawChar(g, f.c, 'fall', 0, 13, f.face, f.c.pal, 1);
    g.restore();
    return;
  }
  const a = f.act ? f.act.k : '';
  const m = MOVES[a];
  let fr = 'idle0';
  if (f.stun > 0 || f.grabbedBy || f.daze > 0) fr = 'hurt';
  else if (f.land > 0) fr = 'dodge';
  // En un lugar seguro, con el temblor fuerte y sin hacer nada: agachado y cubriéndose la cabeza.
  else if (!f.act && s.g > 4 && Math.abs(f.vx) < 20 && sheltered(s, f)) fr = 'cubre';
  else if (m) fr = POSES[a][f.act.t >= m.s ? 1 : 0];
  else if (a === 'parry') fr = 'parry';
  else if (a === 'throwing') fr = 'jab1';
  else if (a === 'remezon') fr = 'dodge';
  else if (a === 'hold' || f.hold) fr = 'hold';
  else if (!f.ground) fr = f.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(f.vx) > 20) fr = ((t / (f.run ? 70 : 110)) | 0) % 2 ? 'run1' : 'run0';
  // Se inclina hacia atrás al preparar el golpe y hacia adelante al soltarlo.
  const cx = Math.round(f.x) + (m ? (f.act.t < m.s ? -1 : f.act.t < m.s + m.a ? 2 : 0) * f.face : 0);
  const feet = Math.round(f.y);
  if (f.stun > 0 && Math.hypot(f.vx, f.vy) > 260) s.parts.push({ x: f.x, y: f.y - 12, vx: 0, vy: 0, l: 0.3, c: 0xc8c8d8, z: 3, ng: true });
  // Óvalo del color del jugador en lo que tiene debajo: se sabe quién es quién y dónde va a caer.
  const sy = below(s, f.x, f.y);
  // De noche se cortó la luz: cada uno anda con su linterna.
  if (s.tod > 1) g.fillStyle(0xffe8a0, 0.06).fillCircle(cx, feet - 12, 26).fillCircle(cx, feet - 12, 15);
  if (sy < H) g.fillStyle(PCOL[f.i], 0.7).fillEllipse(cx, sy, Math.max(6, 16 - (sy - f.y) / 8), 3);
  const ht = drawChar(g, f.c, fr, cx, feet, f.face, f.flashT > 0 && (t / 33) & 1 ? FLASH_PAL : f.c.pal, 1);
  // Golpe cargado: chispas alrededor mientras se mantiene el botón.
  if (a === 'smash' && f.act.hold && f.act.ch > 0) g.lineStyle(2, ((t / 80) | 0) % 2 ? YEL : WHITE).strokeCircle(cx, feet - 14, 18 - f.act.ch / 50);
  if (f.daze > 0) {
    for (let k = 0; k < 3; k++) {
      const an = t / 150 + (k * Math.PI * 2) / 3;
      g.fillStyle(YEL).fillRect(cx + Math.cos(an) * 8, ht - 3 + Math.sin(an) * 2, 3, 3);
    }
  }
  // Con mucho susto, transpira.
  if (f.susto >= 70 && f.flashT <= 0) g.fillStyle(0x7fd0ea).fillRect(cx - f.face * 7, ht + 3 + (((t / 120) | 0) % 3), 1, 2);
  if (a === 'remezon') g.lineStyle(2, RED, 0.9).strokeCircle(cx, feet - 13, 6 + f.act.t / 4);
  // Cada golpe deja su estela: corta al frente, ancha y amarilla la del fuerte, hacia arriba el gancho, a ras de piso la barrida.
  const sw = m && m.w && (f.act.t - m.s) / (m.a + 100);
  if (sw >= 0 && sw < 1) {
    const [c, ox, oy, r, lo, hi] = m.w;
    g.lineStyle(a === 'smash' ? 3 : 2, c, 1 - sw).beginPath().arc(cx + ox * f.face, feet + oy, r, f.face > 0 ? lo : Math.PI - lo, f.face > 0 ? hi : Math.PI - hi, f.face < 0).strokePath();
  }
  if (a === 'parry' && f.act.t < 160) g.lineStyle(2, 0x9fe8ff, 1 - f.act.t / 200).strokeCircle(cx - f.face * 3, feet - 14, 16);
  // Marca del jugador sobre la cabeza.
  const mk = ht - (f.hold ? 14 : 7);
  g.fillStyle(PCOL[f.i]).fillTriangle(cx - 3, mk, cx + 3, mk, cx, mk + 3);
}

function drawObj(s, g, ob) {
  if (ob.st === 'ground' && s.mt - ob.gt > 7000 && ((s.now / 90) | 0) % 2) return;
  const d = OBJS[ob.k];
  const x = Math.round(ob.x - d.w / 2);
  const y = Math.round(ob.y - d.h);
  const b = (c, X, Y, w, h) => {
    g.fillStyle(K).fillRect(x + X - 1, y + Y - 1, w + 2, h + 2);
    g.fillStyle(c).fillRect(x + X, y + Y, w, h);
  };
  const k = ob.k;
  if (k === 'tetera') {
    b(WHITE, 0, 1, 7, 5);
    b(WHITE, 7, 2, 2, 1);
    g.fillStyle(RED).fillRect(x, y + 2, 7, 1);
  } else if (k === 'pan') {
    b(0xd9a35b, 0, 0, 4, 5);
    b(0xd9a35b, 5, 0, 4, 5);
    g.fillStyle(0x6fa83a).fillRect(x, y + 3, 9, 1);
  } else if (k === 'chori') {
    b(0xd9a35b, 0, 1, 10, 3);
    g.fillStyle(0xb8433a).fillRect(x + 1, y, 8, 2);
  } else if (k === 'pelota') {
    // Pelota de playa: redonda y con franja.
    g.fillStyle(K).fillCircle(x + 3, y + 3, 4);
    g.fillStyle(WHITE).fillCircle(x + 3, y + 3, 3);
    g.fillStyle(RED).fillRect(x, y + 2, 6, 2);
  } else if (k === 'macetero') {
    b(0xc0603a, 1, 3, 5, 5);
    g.fillStyle(0x4f9a3a).fillRect(x, y, 7, 3);
  } else if (k === 'teja') {
    b(0xa84a2a, 0, 0, 9, 3);
  } else if (k === 'balde') {
    b(0x3a7ac0, 0, 1, 7, 6);
    g.fillStyle(K).fillRect(x, y, 7, 1);
  } else if (k === 'tele') {
    b(0x5c5c6e, 0, 2, 13, 9);
    g.fillStyle(0x9fe0c8).fillRect(x + 2, y + 4, 8, 5);
    g.fillStyle(K).fillRect(x + 3, y, 1, 2).fillRect(x + 9, y, 1, 2);
  } else if (k === 'sandia') {
    // Una tajada: carne roja, cáscara verde y pepas.
    g.fillStyle(K).slice(x + 6, y + 1, 8, 0, Math.PI).fillPath().fillStyle(0x3f7a3a).slice(x + 6, y + 1, 7, 0, Math.PI).fillPath().fillStyle(RED).slice(x + 6, y + 1, 5, 0, Math.PI).fillPath();
    g.fillStyle(K).fillRect(x + 3, y + 3, 1, 1).fillRect(x + 6, y + 2, 1, 1).fillRect(x + 9, y + 3, 1, 1);
  } else if (k === 'gas') {
    b(ORANGE, 0, 2, 8, 10);
    b(0x8a8a9c, 2, 0, 4, 2);
  } else {
    b(0xb8c0cc, 0, 0, 13, 7);
    g.fillStyle(K).fillRect(x + 6, y + 7, 1, 3);
  }
}

// ---------- HUD y pantallas ----------

function drawHud(s, t) {
  const g = s.hud;
  g.clear();
  s.flash = Math.max(0, s.flash - 0.04);
  s.flashRect.setAlpha(s.flash);
  if (s.mode === 'select') return drawSelect(s, g, t);
  if (s.mode === 'end') return drawEnd(s, g, t);

  // Sismógrafo.
  g.fillStyle(K, 0.85).fillRect(130, 2, 60, 32);
  g.lineStyle(1, YEL).strokeRect(130.5, 2.5, 59, 31);
  g.fillStyle(RED);
  for (let x = 0; x < 56; x++) g.fillRect(132 + x, 26 + Math.round(Math.sin(t / 30 + x * 0.9) * (shake(s) * 2.5 + s.koK * 7) * Math.random()), 1, 1);
  text(g, 'GRADO', 134, 5, 1, WHITE, 0);
  const pop = Math.max(0, 1 - (t - (s.gPop || 0)) / 400);
  text(g, String(s.g), 160, 12 - Math.round(pop * 2), 4, YEL);

  // Cuenta antes del grado 6.
  const cd = s.countdown != null ? s.mt - s.countdown : -1;
  if (cd >= 0 && cd < 3600 && s.mode === 'play') {
    const n = 3 - Math.floor(cd / 1000);
    if (((t / 120) | 0) % 2 === 0 || n <= 0) text(g, n > 0 ? '¡TEMBLOR!\n' + n : '¡TEMBLOR!', W / 2, 80, 5, RED);
  }

  s.f.forEach((f, i) => {
    const x = i ? W - 6 : 6;
    const al = i ? 1 : 0;
    text(g, (f.cpu ? 'CPU ' : 'P' + (i + 1) + ' ') + f.c.n, x, 4, 1, PCOL[i], al);
    // Vida: se vacía hacia afuera, lo recién perdido queda un rato en rojo y con poca vida parpadea.
    const v = life(f) / MAX_SUSTO;
    f.vt = approach(f.vt, v, 0.006);
    const bx = i ? W - 120 : 6;
    g.fillStyle(WHITE).fillRect(bx, 12, 114, 9);
    g.fillStyle(K).fillRect(bx + 1, 13, 112, 7);
    g.fillStyle(RED).fillRect(i ? bx + 113 - 112 * f.vt : bx + 1, 13, 112 * f.vt, 7);
    g.fillStyle(v < 0.3 && ((t / 150) | 0) % 2 ? WHITE : PCOL[i]).fillRect(i ? bx + 113 - 112 * v : bx + 1, 13, 112 * v, 7);
    // Una cabeza por vida.
    for (let k = 0; k < f.lives; k++) spr(g, f.c.head[1], i ? W - 14 - k * 14 : 14 + k * 14, 24, i ? -1 : 1, f.c.pal, f.c.head[0]);
    const full = f.calma >= 100;
    const lx = 14 + LIVES * 14;
    const cx = i ? W - lx - 46 : lx;
    g.fillStyle(WHITE).fillRect(cx, 26, 46, 5);
    g.fillStyle(K).fillRect(cx + 1, 27, 44, 3);
    g.fillStyle(full ? (((t / 100) | 0) % 2 ? YEL : WHITE) : PCOL[i]).fillRect(cx + 1, 27, 0.44 * f.calma, 3);
    text(g, full ? '1+2!' : 'CALMA', i ? W - lx : lx, 33, full ? 2 : 1, full ? YEL : WHITE, al);
    if (f.comboShow > 0) text(g, f.combo + ' GOLPES', x, 46, 1, YEL, al);
  });

  s.msgs = s.msgs.filter((m) => t - m.t0 < m.ms);
  s.msgs.forEach((m, k) => text(g, m.str, W / 2, 104 + k * 16, 2, m.col));

  if (s.help > 0 && s.mode === 'play') text(g, MOVE_HELP + ' · 2 AGARRA', W / 2, 228, 1, WHITE);

  if (s.mode === 'demo') drawTitle(s, g, t);
}

// Antes de jugar: qué hace cada botón, con los controles del mueble dibujados.
function drawControls(g, t) {
  g.fillStyle(K).fillRect(0, 0, W, 214);
  text(g, 'CÓMO SE JUEGA', W / 2, 8, 2, YEL);
  text(g, `GOLPES QUITAN VIDA · SIN VIDA, UN GOLPE LO SACA · ${LIVES} CAÍDAS Y PIERDES`, W / 2, 26, 1, WHITE);
  const tilt = Math.round(Math.sin(t / 300) * 3);
  g.fillStyle(0x444455).fillCircle(28, 52, 8);
  g.lineStyle(3, WHITE).lineBetween(28, 52, 28 + tilt, 42);
  g.fillStyle(RED).fillCircle(28 + tilt, 41, 4);
  text(g, 'MUEVE · ARRIBA SALTA (DOBLE)\nABAJO CAE RÁPIDO O BAJA', 44, 44, 1, WHITE, 0);
  const cols = [RED, YEL, BLUE];
  for (let i = 0; i < 6; i++) {
    const x = 16 + (i % 3) * 13;
    const y = 76 + ((i / 3) | 0) * 13;
    const on = ((t / 400) | 0) % 6 === i;
    g.fillStyle(i < 3 ? cols[i] : 0x8a8a9c).fillCircle(x, y + (on ? 1 : 0), 5);
    text(g, String(i + 1), x + 1, y - 2, 1, WHITE);
  }
  text(g, '1 GOLPE: ↑ GANCHO · > FUERTE · ↓ BARRIDA\n2 AGARRA, LEVANTA Y LANZA\n3 PARRY, EN EL PISO O EN EL AIRE', 60, 70, 1, WHITE, 0);
  text(g, 'TRUCOS', W / 2, 110, 2, YEL);
  text(
    g,
    'GOLPE LE GANA AL AGARRE, AGARRE AL PARRY Y PARRY AL GOLPE\nEN LO VERDE EL TEMBLOR NO TE HACE NADA\nDOBLE TOQUE ADELANTE: CORRE · EN EL AIRE: DA VUELTA\nMANTÉN > + 1: GOLPE CARGADO · EN EL AIRE ↓ + 1: PISOTÓN\nLA CALMA SUBE AL RECIBIR, CON PARRY Y EN LO SEGURO\n1 + 2 CON LA BARRA DE CALMA LLENA: REMEZÓN',
    W / 2,
    128,
    1,
    WHITE,
  );
}

function drawTitle(s, g, t) {
  // El attract alterna el título con la pantalla de controles.
  if (((t / 5000) | 0) % 3 > 1) {
    drawControls(g, t);
    g.fillStyle(K, 0.7).fillRect(0, 214, W, 26);
    if (((t / 450) | 0) % 2) text(g, 'PRESIONA START', W / 2, 220, 2, BLUE);
    return;
  }
  g.fillStyle(K, 0.6).fillRect(0, 42, W, 74);
  // Cada letra tiembla por su cuenta y el trazo de abajo es un sismograma: los dos crecen con el grado.
  const a = Math.min(6, s.g - 2);
  [...'¿SE MOVIÓ?'].forEach((ch, i) => {
    text(g, ch, 63 + i * 20, 62 + Math.round(Math.sin(i * 9 + ((t / 90) | 0)) * a * 0.6), 5, YEL, 0);
  });
  g.lineStyle(1, RED).beginPath().moveTo(64, 91);
  for (let x = 70; x < 260; x += 6) g.lineTo(x, 91 + ((x / 6) & 1 ? 1 : -1) * Math.min(a, 3));
  g.strokePath();
  text(g, '¡SÁCALO DE LA PANTALLA!', W / 2, 98, 2, WHITE);
  g.fillStyle(K, 0.7).fillRect(0, 214, W, 26);
  if (((t / 450) | 0) % 2) text(g, 'PRESIONA START', W / 2, 217, 2, BLUE);
  const r = s.records;
  const pages = [r.rey ? `REY DEL MUEBLE: ${r.rey.n} · ${r.rey.r} SEGUIDAS` : 'REY DEL MUEBLE: SE BUSCA'].concat(
    r.top.slice(0, 3).map((e, i) => `${i + 1}. ${e.n}  ${e.s} PTS  GRADO ${e.g}`),
  );
  text(g, pages[((t / 2500) | 0) % pages.length], W / 2, 232, 1, WHITE);
}

function drawSelect(s, g, t) {
  g.fillStyle(K).fillRect(0, 0, W, H);
  text(g, 'ELIGE TU PERSONAJE', W / 2, 6, 2, YEL);
  const same = s.sel[0].on && s.sel[1].on && s.sel[0].pick === s.sel[1].pick;
  const cp = copyIdx(s.sel);
  CHARS.forEach((c, k) => {
    const x0 = 8 + k * 76;
    const y0 = 26;
    const cx = x0 + 37;
    const picked = [0, 1].filter((i) => s.sel[i].on && s.sel[i].pick === k);
    g.fillStyle(picked.length ? 0x2d3a6e : 0x232040).fillRect(x0 + 1, y0, 74, 112);
    picked.forEach((i, n) => g.lineStyle(2, PCOL[i]).strokeRect(x0 + 2 + n * 3, y0 + 1 + n * 3, 72 - n * 6, 110 - n * 6));
    const ready = picked.some((i) => s.sel[i].ok);
    const bounce = picked.length && !ready ? Math.round(Math.abs(Math.sin(t / 150)) * -4) : 0;
    if (same && picked.length > 1)
      [0, 1].forEach((i) => {
        const cc = i === cp ? copyOf(c) : c;
        drawChar(g, cc, 'idle0', cx + (i ? 17 : -17), y0 + 86, 1, cc.pal, 2);
      });
    else drawChar(g, c, ready ? 'hold' : 'idle0', cx, y0 + 86 + bounce, 1, c.pal, 3);
    text(g, c.n, cx, y0 + 88, 2, WHITE);
    text(g, c.t, cx, y0 + 102, 1, 0xa7a7c7);
  });
  s.sel.forEach((e, i) => {
    const x = i ? W - 8 : 8;
    const al = i ? 1 : 0;
    text(g, 'P' + (i + 1) + (e.on ? ': ' + CHARS[e.pick].n + (same && i === cp ? ' (1)' : '') : ''), x, 150, 2, PCOL[i], al);
    text(g, !e.on ? 'START PARA JUGAR' : e.ok ? '¡LISTO!' : 'PALANCA ELIGE · 1 OK', x, 168, 1, WHITE, al);
  });
  text(g, MOVE_HELP, W / 2, 214, 1, 0xa7a7c7);
  text(g, '2 AGARRA · 3 PARRY · 1 + 2 REMEZÓN', W / 2, 224, 1, 0xa7a7c7);
}

function drawEnd(s, g, t) {
  g.fillStyle(K).fillRect(0, 0, W, H);
  const w = s.winner;
  text(g, 'GANA ' + w.c.n, W / 2, 10, 3, PCOL[w.i]);
  if (w.comeback) text(g, '¡REMONTADA!', W / 2, 34, 2, YEL);
  // El ganador celebra.
  const jump = Math.round(Math.abs(Math.sin(t / 220)) * -4);
  drawChar(g, w.c, 'hold', W / 2, 122 + jump, 1, w.c.pal, 3);
  text(g, `SOBREVIVIÓ: GRADO ${s.g}`, W / 2, 127, 2, WHITE);
  if (s.f.every((f) => f.cpu)) return;
  text(g, s.f.map((f) => `${f.cpu ? 'CPU' : 'P' + (f.i + 1)} ${score(f)} PTS`).join('    '), W / 2, 146, 2, WHITE);
  s.entries.forEach((e, n) => {
    const l = e.letters.map((c, k) => (k === e.pos && !e.done && ((t / 200) | 0) % 2 ? '_' : String.fromCharCode(65 + c))).join(' ');
    text(g, `P${e.f.i + 1} INICIALES: ${l}${e.done ? ' ¡LISTO!' : ''}`, W / 2, 166 + n * 16, 2, PCOL[e.f.i]);
  });
  text(g, s.entries.length && !s.saved ? 'ARRIBA/ABAJO LETRA · 1 SIGUIENTE' : 'START: ¡REVANCHA!', W / 2, 224, 1, BLUE);
}

// ---------- Controles ----------

function createControls(s) {
  s.controls = {
    held: Object.create(null),
    pressed: Object.create(null),
  };

  const onKeyDown = (event) => {
    const arcadeCode = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (!arcadeCode) return;
    s.idle = 0;
    if (s.audio && s.audio.state === 'suspended') s.audio.resume();
    if (!s.controls.held[arcadeCode]) s.controls.pressed[arcadeCode] = true;
    s.controls.held[arcadeCode] = true;
  };

  const onKeyUp = (event) => {
    const arcadeCode = KEYBOARD_TO_ARCADE[normalizeIncomingKey(event.key)];
    if (arcadeCode) s.controls.held[arcadeCode] = false;
  };

  // Sin foco no llegan los keyup: se sueltan todas.
  const onBlur = () => {
    for (const k in s.controls.held) s.controls.held[k] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  s.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  });
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

// ---------- Sonido y música por código ----------

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

function tone(s, type, f0, f1, dur, vol, at) {
  const ctx = s.audio;
  const t0 = at || ctx.currentTime;
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

function noise(s, dur, vol, freq, type, at) {
  const ctx = s.audio;
  const t0 = at || ctx.currentTime;
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
  // El attract solo suena en los KO, para no retumbar todo el día.
  if (!s.audio || (s.mode === 'demo' && k !== 'ko')) return;
  s.master.gain.value = s.mode === 'demo' ? 0.2 : 0.5;
  const at = s.audio.currentTime + 0.001;
  try {
    if (k === 'hit') {
      noise(s, 0.12, 0.5, 1400, 0, at);
      tone(s, 'square', 160 + (n || 0) * 2, 50, 0.12, 0.25, at);
    } else if (k === 'bighit') {
      noise(s, 0.25, 0.7, 900, 0, at);
      tone(s, 'sawtooth', 110 + (n || 0), 35, 0.3, 0.35, at);
    } else if (k === 'jump') {
      tone(s, 'square', 300, 640, 0.08, 0.1, at);
    } else if (k === 'whiff') {
      // Cada golpe suena más grave que el anterior en la lista: se distinguen sin mirar.
      noise(s, 0.06, 0.14, 2600 - (n || 0) * 350, 'highpass', at);
    } else if (k === 'parry') {
      tone(s, 'square', 1200, 1900, 0.08, 0.15, at);
      tone(s, 'square', 1900, 2400, 0.12, 0.12, at + 0.08);
    } else if (k === 'grab') {
      tone(s, 'triangle', 220, 110, 0.12, 0.25, at);
    } else if (k === 'throw') {
      noise(s, 0.15, 0.25, 1200, 'bandpass', at);
    } else if (k === 'break') {
      noise(s, 0.25, 0.35, 3000, 'highpass', at);
      for (let i = 0; i < 3; i++) tone(s, 'triangle', 2400 + i * 500, 1800, 0.08, 0.06, at + i * 0.04);
    } else if (k === 'thud') {
      tone(s, 'sine', 140, 50, 0.12, 0.3, at);
    } else if (k === 'ko') {
      tone(s, 'sawtooth', 700, 70, 0.6, 0.3, at);
      noise(s, 0.5, 0.4, 600, 0, at);
    } else if (k === 'alert') {
      for (let i = 0; i < 3; i++) tone(s, 'square', 988, 980, 0.12, 0.12, at + i * 0.22);
    } else if (k === 'rumble') {
      noise(s, 1.4, 0.1 * Phaser.Math.Clamp(n - 2, 1, 6), 110, 0, at);
    } else if (k === 'remezon') {
      tone(s, 'sine', 90, 30, 0.7, 0.6, at);
      noise(s, 0.6, 0.6, 400, 0, at);
    } else if (k === 'charge') {
      tone(s, 'sawtooth', 120, 600, 0.14, 0.2, at);
    } else if (k === 'select') {
      tone(s, 'square', 880, 900, 0.05, 0.08, at);
    } else if (k === 'win') {
      [523, 659, 784, 1046].forEach((f, i) => tone(s, 'square', f, f, 0.14, 0.12, at + i * 0.12));
    }
  } catch (e) {
    // Sin audio no se detiene el juego.
  }
}

// Cumbia chiptune: bajo, melodía y güiro. Acelera con el grado.
const MEL = [0, 99, 3, 99, 7, 99, 5, 3, 2, 99, -2, 99, 0, 99, 99, 99, 7, 99, 10, 99, 8, 7, 5, 99, 3, 99, 2, 99, 0, 99, 99, 99];
const BASS = [-24, -29, -26, -19];

function music(s) {
  if (!s.audio || s.mode !== 'play' || s.audio.state !== 'running') return;
  const ctx = s.audio;
  const g = s.g;
  const stepDur = 60 / (96 + (g - 3) * 7) / 4;
  if (s.mus.next < ctx.currentTime) s.mus.next = ctx.currentTime + 0.05;
  while (s.mus.next < ctx.currentTime + 0.12) {
    const st = s.mus.step % 32;
    const at = s.mus.next;
    const n = MEL[st];
    // Desafina y se corta más con cada grado.
    const wob = 1 + (Math.sin(at * 7) + Math.random() - 0.5) * (g - 3) * 0.006;
    if (n !== 99 && !(g >= 7 && Math.random() < 0.1)) tone(s, 'square', 440 * 2 ** (n / 12) * wob, 440 * 2 ** (n / 12) * wob, stepDur * 1.6, 0.035, at);
    const b = st % 16;
    if (b === 0 || b === 6 || b === 8 || b === 14) {
      const root = BASS[(st >= 16 ? 2 : 0) + (b === 6 || b === 14 ? 1 : 0)];
      tone(s, 'triangle', 440 * 2 ** (root / 12) * wob, 440 * 2 ** (root / 12) * wob, stepDur * 2, 0.16, at);
    }
    if (st % 2 === 0) noise(s, 0.04, st % 4 === 0 ? 0.06 : 0.03, 6000, 'highpass', at);
    s.mus.next += stepDur;
    s.mus.step++;
  }
}

// ---------- Records persistentes ----------

function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
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
})();
