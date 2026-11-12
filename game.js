// ¿SE MOVIÓ? — Temblor Grado 8
// Pelea de dos en Santiago mientras tiembla cada vez más fuerte.
// Sácalo de la pantalla antes de que el temblor te saque a ti.

const W = 320;
const H = 240;
const STORAGE_KEY = 'se-movio-records-v1';
const MATCH_MS = 75000;
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

// ---------- Letra pixelada 3x5 (cada fila es un dígito de 3 bits) ----------

const FONT = {};
const FONT_SRC =
  'A25755B65656C34443D65556E74647F74644G34553H55755I72227J11152K55655L44447M57755N65555O25552P65644Q25563R65655S34216T72222U55557V55552W55775X55255Y55222Z71247' +
  '075557126227261247361216455711574616634757771122875757975716' +
  '!22202¡20222?61202¿20243.00002,00024:02020%51245-00700+02720/11244·00200_00007(12221)42224';
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
      const y0 = y + li * 7 * sc;
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
        else if (ACCENT[ch]) dot(1, -2, 2);
      });
    });
  }
}

// ---------- Personajes ----------
// Mapas de píxeles: un carácter, un píxel; '.' transparente.
// Cabezas de 14 de ancho (ancla en la columna 7), cuerpos de 12 (ancla en la 6).

const LEGS = {
  stand: ['..kllllllk..', '..klllklllk.', '..kllk.kllk.', '..kwwk.kwwk.', '.kffffkffffk', '.kkkkkkkkkk.'],
  walk: ['..kllllllk..', '.klllkkllk..', '.kllk..kllk.', 'kwwk....kwwk', 'kffk....kffk', 'kkkk....kkkk'],
  jump: ['..kllllllk..', '.klllllllk..', '.kwwkkkwwk..', '.kffk.kffk..', '............', '............'],
  kick: ['..klllllllkkkk..', '..kllllllllllfk.', '..kllkkkkkkkkkk.', '..kwwk..........', '..kffk..........', '..kkkk..........'],
  sweep: ['..kllllllk......', '.kllllllllkkkkk.', '.kllllllllllllfk', '.kffkkkkkkkkkkkk', '................', '................'],
};

const CHARS = [
  {
    n: 'PATY',
    t: 'RÁPIDA',
    spd: 1.1,
    jmp: 1.05,
    wt: 0.95,
    pow: 0.95,
    vic: 'hips',
    pal: { p: 0xe8739a, P: 0xb24f74, d: 0xffe17a, l: 0xe8739a, w: 0xf0b48a, f: 0x7fd0ea, h: 0x5a2e1c, b: 0x7fd0ea },
    head: ['...kbbkbbkb...', '..khhhhhhhhk..', '.khhhhhhhhhhk.', '.khhhsssssssk.', '.khhssssssssk.', '.khhSsssssssk.', '.khhSssssssk..', '.khhkSsssssk..', '..kk.kkkkkk...'],
    torso: ['..kkppppkk..', '.kpdppppdpk.', '.kpppdppppk.', '.kPPPPPPPPk.', '.kpdpppdppk.'],
    mouth: 6,
  },
  {
    n: 'CHEPO',
    t: 'PESADO',
    spd: 0.9,
    jmp: 0.95,
    wt: 1.18,
    pow: 1.15,
    vic: 'wave',
    pal: { p: 0xc0303a, P: 0x8a1f2a, d: WHITE, l: 0x3a2a24, w: 0x4f2e19, f: 0x4f2e19, h: 0x3b2418, b: 0xe0c070, B: 0xc0303a },
    head: ['.....kkkk.....', '....kbbbbk....', '...kBBBBBBk...', 'kkkbbbbbbbbkkk', '..ksssssssssk.', '..kSssssssssk.', '..kSssssssssk.', '...kSsssssssk.', '....kkkkkkkk..'],
    torso: ['..kkppppkk..', '.kppddddppk.', '.kppppppppk.', '.kddddddddk.', '.kkkkkkkkkk.'],
    mouth: 7,
  },
  {
    n: 'CATA',
    t: 'GOLPE FUERTE',
    spd: 1,
    jmp: 1,
    wt: 0.9,
    pow: 1.12,
    vic: 'hips',
    pal: { p: 0xa8d8f0, P: 0x78a8c8, d: 0x2c3160, l: 0xd9c9a0, w: 0xf0b48a, f: 0x7a4a2a, h: 0xe8c060, B: K },
    head: ['...kkkkkkkk...', '..kBBkhhkBBk..', '.khhhhhhhhhhk.', '.khhhsssssssk.', '.khhssssssssk.', '.khhSsssssssk.', '.khhSssssssk..', '.khhhkSsssk...', '.khhhkkkkkk...'],
    torso: ['..kkddddkk..', '.kddppppddk.', '.kppppppppk.', '.kppppppppk.', '.kkkkkkkkkk.'],
    mouth: 6,
  },
  {
    n: 'DANI',
    t: 'VELOZ',
    spd: 1.2,
    jmp: 1.05,
    wt: 0.88,
    pow: 0.95,
    vic: 'flex',
    pal: { p: 0x3a3a9a, P: WHITE, d: WHITE, l: 0x3a3a9a, w: WHITE, f: WHITE, h: 0x2a1a14, b: RED, B: 0x9a2a2a },
    head: ['...kkkkkkk....', '..kbbbbbbbk...', '..kbbbbbbbbkkk', '..kBBBBBBBBBBk', '..khssssssssk.', '..kSssssssssk.', '..kSssssssssk.', '...kSsssssssk.', '....kkkkkkkk..'],
    torso: ['..kkppppkk..', '.kdppPpppdk.', '.kdppPpppdk.', '.kdppPpppdk.', '.kkkkkkkkkk.'],
    mouth: 7,
  },
];
const BASE_PAL = { k: K, s: 0xf0b48a, S: 0xc47f5e, w: WHITE };
for (const c of CHARS) c.pal = Object.assign({}, BASE_PAL, c.pal);
const FLASH_PAL = new Proxy({}, { get: () => WHITE });

// Si los dos eligen al mismo, el segundo juega con la ropa de otro color y su nombre lleva (1).
function copyOf(c) {
  const pal = Object.assign({}, c.pal);
  for (const k of 'pPdlbB') if (pal[k] !== undefined && pal[k] !== K) pal[k] = ((pal[k] << 8) | (pal[k] >> 16)) & 0xffffff;
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

// Rectángulo con contorno relativo al centro, espejado según la cara.
function rr(g, face, cx, r0, y, w, h, c) {
  const x = face > 0 ? cx + r0 : cx - r0 - w;
  g.fillStyle(K).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(c).fillRect(x, y, w, h);
}

function drawFace(g, ch, face, cx, top, mood, t, sc) {
  const z = sc || 1;
  const px = (r, y, w, h, c) => {
    const x = face > 0 ? cx + r * z : cx - (r + w) * z;
    g.fillStyle(c).fillRect(x, top + y * z, w * z, h * z);
  };
  if (mood === 'daze') {
    px(0, 5, 2, 1, K);
    px(3, 5, 2, 1, K);
  } else if (mood === 'calm') {
    px(1, 4, 1, 2, K);
    px(4, 4, 1, 2, K);
  } else {
    px(0, 4, 2, 2, WHITE);
    px(3, 4, 2, 2, WHITE);
    const py = mood === 'terror' ? 4 : 5;
    px(1, py, 1, 1, K);
    px(4, py, 1, 1, K);
    px(2, ch.mouth, mood === 'terror' ? 2 : 1, mood === 'terror' ? 2 : 1, K);
    if (mood === 'terror') px(-5, 3 + (((t / 120) | 0) % 3), 1, 2, 0x7fd0ea);
  }
  if (ch.glasses) {
    g.lineStyle(z, K);
    for (const r of [0, 3]) {
      const x = face > 0 ? cx + r * z : cx - (r + 2) * z;
      g.strokeRect(x - z / 2, top + 3.5 * z, 3 * z, 3 * z);
    }
  }
}

// ---------- Mapas y fondos vivos ----------
// Cada mapa es un descriptor chico: nombre, piso, plataformas y puertas de la mitad
// izquierda (se reflejan), objetos, y una lista de capas de lejos a cerca.
// Las capas desde el índice `a` se redibujan cada cuadro: así lo que se mueve
// queda siempre detrás de lo que está más cerca.
const STAGES = (() => {
  let G, C, S, Tm, Sc;

  // Paleta indexada. Por hora (día, atardecer, noche): 4 franjas de cielo, astro y luz de ventana.
  // Después, los colores apagados del resto, desde el índice 6.
  const P = (
    '6a94c082a8cc9cbcd6b6cedeeee6c84e5a6e' +
    '4c41707a5c88ac707cd29a7ae8b070a88a62' +
    '161c361e284a28345c34406cd8d8ccffd27a' +
    '7d88a2d6dce26e7c684c54705c6480c2b69ea89c867a5c443e303098a0aa667e58e6d4a6c8b48a' +
    '4c7894b4ccd2a85a505c78a0c4ac6484a070b88a8a8c8c945a5a66c49a7a3a3436d6d2c6c084604c4c56'
  )
    .match(/.{6}/g)
    .map((h) => parseInt(h, 16));
  const mix = (a, b, k) => [16, 8, 0].reduce((r, s) => r | ((((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s), 0);
  // Hora del día como cambio de paleta: cielo propio y un tinte sobre todo lo demás.
  const PALS = [0, 1, 2].map((i) => P.slice(i * 6, i * 6 + 6).concat(P.slice(18).map((c) => mix(c, [0, 0x8a5070, 0x101830][i], [0, 0.25, 0.5][i]))));

  // Primitivas de dibujo. Un color menor que la paleta es un índice; si no, va tal cual.
  const R = (x, y, w, h, c) => G.fillStyle(C[c] || c).fillRect(x | 0, y | 0, w | 0, h | 0);
  const T = (a, b, c, d, e, f, k) => G.fillStyle(C[k]).fillTriangle(a, b, c, d, e, f);
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
    for (let i = 0; i < 4; i++) R(0, i * 40, W, i > 2 ? H : 40, i);
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
      R(x + w * 0.1, t + h * 0.25, w * 0.2, h * 0.3, 5);
      R(x + w * 0.7, t + h * 0.25, w * 0.2, h * 0.3, 5);
      if (w > 20) R(x + w * 0.35, b - h * 0.6, w * 0.3, h * 0.6, 14);
      if (reja) {
        R(x + 2, b - 6, 9, 6, 16);
        rep(w / 4, 4, 0, x, b - 10, 1, 10, 29);
        R(x, b - 10, w, 1, 29);
      }
    }
  };
  // Postes con luminaria y cable con comba.
  const poles = (y, b, ...xs) =>
    xs.forEach((x, i) => {
      R(x, y, 2, b - y, 29);
      R(x - 5, y + 3, 6, 1, 29);
      R(x - 6, y + 4, 3, 2, 5);
      const n = xs[i + 1];
      if (n) line(x, y + 1, (x + n) / 2, y + 9), line((x + n) / 2, y + 9, n, y + 1);
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
    for (let i = 0; i < n; i++) R(x + i * dx + Math.sin(Tm / 250 + i) * (2 + Sc.phase), y + i * dy + 1, 8, 10, [21, 30, 22, 23, 24][i % 5]);
  };
  // Lámpara colgante que se mece más con cada grado.
  const lamp = (x, y, l) => {
    const a = Math.sin(Tm / (Sc.phase > 3 ? 260 : 900)) * (0.08 + 0.1 * Math.max(0, Sc.phase));
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

  // Mapas: nombre, piso, medio ancho del piso, plataformas [x1, x2, y, 1 frágil | 2 caliente]
  // de la mitad izquierda, puertas, objetos, objeto pesado, primera capa viva y capas.
  return [
    [
      'EL DEPTO', 200, 120, [[130, 190, 168], [44, 80, 132, 1]], [[52, 72]], 'tetera taza pan taza', 'tele', 9,
      [
        [sky, 250, 30],
        [hills, 150, 3, 6, 50, 1],
        [city, 215, 13, 40],
        [36, 62, 248, 138, 11, 32, 56, 256, 6, 26, 36, 194, 248, 6, 13, 36, 200, 248, 8, 26, 136, 76, 48, 36, 14, 138, 78, 44, 32, 1],
        [T, 138, 110, 156, 92, 176, 110, 6],
        [rep, 15, 16, 0, 44, 62, 4, 132, 12],
        [159, 78, 2, 32, 14, 138, 93, 44, 2, 14, 104, 82, 16, 20, 30, 104, 82, 16, 4, 21, 205, 184, 18, 16, 13, 206, 168, 16, 16, 29, 130, 168, 60, 6, 30],
        [rep, 8, 8, 0, 130, 168, 4, 6, 21],
        [sym, 49, 160, 26, 40, 13, 52, 163, 20, 37, 14, 134, 174, 3, 26, 13],
        [noise, 208, 170, 12, 12],
        [lamp, 160, 62, 16],
      ],
    ],
    [
      'LA CASA', 205, 136, [[140, 180, 182, 2], [84, 116, 140]], [[95, 105]], 'chori pelota macetero teja', 'gas', 2,
      [
        [sky, 240, 84],
        [hills, 150, 5, 6, 55, 1],
        [walk, 162, 0, 150, 0, 21],
        [walk, 163, 0, 170, 0, 22],
        [walk, 162, 0, 278, 0, 24],
        [0, 150, 320, 55, 11],
        [rep, 6, 0, 9, 0, 158, 320, 1, 12],
        [walk, 150, 30, 0, 1, 31],
        [houses, 84, 1, 32, 205, 5, 62],
        [houses, 204, 1, 32, 205, 1, 62],
        [ropa, 124, 118, 6, 12, 1],
        [138, 182, 44, 2, 29, 140, 184, 40, 5, 27, 0, 205, 320, 35, 14, 24, 205, 272, 9, 12],
        [sym, 144, 189, 2, 16, 29],
        [smoke, 142, 183, 36],
      ],
    ],
    [
      'EL EDIFICIO', 200, 110, [[140, 180, 150], [56, 88, 162]], [[63, 81]], 'macetero balde pelota teja', 'parabolica', 3,
      [
        [sky, 250, 84],
        [hills, 175, 9, 8, 50],
        [city, 200, 29, 60],
        [birds, 40, 3, 25, 26],
        [0, 222, 320, 18, 32],
        [walk, 230, 18, 0, 3, 30],
        [walk, 237, -22, 200, 3, 21],
        [50, 200, 220, 8, 26, 54, 208, 212, 32, 27, 140, 150, 40, 50, 15, 158, 70, 3, 80, 27],
        [rep, 13, 16, 0, 60, 214, 8, 5, 5],
        [rep, 3, 0, 12, 140, 162, 40, 2, 26],
        [rep, 8, 0, 8, 154, 78, 11, 1, 27],
        [sym, 56, 162, 32, 38, 11, 54, 160, 36, 3, 26, 63, 172, 18, 28, 14],
        [ropa, 100, 148, 3, 11, 0],
        [blink, 158, 66],
      ],
    ],
    [
      'LA POBLA', 205, 128, [[136, 184, 160], [92, 128, 150]], [[146, 174]], 'pelota teja macetero pan', 'gas', 2,
      [
        [sky, 60, 84],
        [hills, 150, 3, 6, 55, 1],
        [birds, 30, 3, 30, 26],
        [houses, 0, 8, 40, 180, 5, 34, 1],
        [0, 180, 320, 25, 26],
        [walk, 198, 45, 0, 2, 22],
        [walk, 201, -12, 100, 1, 13],
        [walk, 196, -28, 250, 0, 25],
        [poles, 150, 205, 20, 300],
        [134, 158, 52, 3, 27, 140, 166, 40, 20, 27, 152, 170, 16, 8, 5, 144, 190, 32, 2, 13, 0, 205, 320, 35, 32, 32, 205, 256, 8, 26],
        [sym, 138, 161, 2, 44, 27, 90, 150, 38, 10, 16, 96, 160, 26, 4, 16, 106, 164, 4, 41, 13],
      ],
    ],
    [
      'LA PLAYA', 200, 130, [[136, 184, 150], [90, 124, 164]], [[148, 172]], 'pelota balde chori pelota', 'sandia', 4,
      [
        [sky, 250, 84],
        [hills, 140, 7, 8, 40],
        [houses, 0, 20, 16, 140, 9, 10],
        [0, 140, 320, 100, 19, 0, 140, 320, 1, 20],
        [birds, 36, 4, 22, 30],
        [walk, 160, 60, 0, 4, 21],
        [waves, 150, 6, 30],
        [30, 200, 260, 40, 17, 30, 210, 260, 30, 18, 134, 150, 52, 5, 30, 158, 124, 2, 26, 27, 160, 124, 8, 5, 21, 146, 180, 28, 20, 21, 154, 186, 12, 14, 14],
        [sym, 140, 155, 3, 45, 30, 90, 164, 34, 2, 21, 93, 166, 28, 2, 21, 97, 168, 20, 2, 21, 100, 164, 3, 6, 30, 107, 164, 3, 6, 30, 114, 164, 3, 6, 30, 106, 170, 2, 30, 27],
      ],
    ],
  ].map(([n, floor, hw, pl, dr, drops, heavy, a, L]) => ({
    n,
    floor,
    plats: [[160 - hw, 160 + hw, floor, 3], ...mir(pl)].map(([x1, x2, y, f]) => ({ x1, x2, y, solid: f > 2, brk: f == 1, hot: f == 2 })),
    doors: mir(dr),
    drops: drops.split(' '),
    heavy,
    // Estático: una vez por partido, con la hora elegida (0 día, 1 atardecer, 2 noche).
    bg(g, tod) {
      G = g;
      C = PALS[tod | 0];
      L.slice(0, a).map(draw);
    },
    // Vivo: actores y todo lo que está delante de ellos, cada cuadro.
    anim(g, t, s) {
      G = g;
      C = PALS[s.tod | 0];
      Tm = t;
      Sc = s;
      L.slice(a).map(draw);
    },
  }));
})();

const OBJS = {
  tetera: { w: 8, h: 6, dmg: 10, brk: true },
  taza: { w: 5, h: 4, dmg: 6, brk: true },
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

// El temblor: cada grado cambia una sola regla.
const GRADOS = [
  { t: 0, g: 3, amp: 0.3, drop: 0 },
  { t: 10000, g: 4, amp: 0.5, drop: 0 },
  { t: 20000, g: 5, amp: 0.7, drop: 2600 },
  { t: 32000, g: 6, amp: 1, drop: 1700, heavy: true, tilt: 0.35 },
  { t: 45000, g: 7, amp: 1.2, drop: 1400, breaks: true, tilt: 0.6 },
  { t: 58000, g: 8, amp: 1.5, drop: 1100, tilt: 1 },
];

// Golpes: arranque (s), activo (a), total (e), caja [x0,x1,y0,y1] desde los pies, daño, empuje base y crecimiento, ángulo.
const MOVES = {
  jab: { s: 50, a: 60, e: 210, box: [3, 15, -15, -8], d: 6, b: 60, gr: 1.6, an: 0.5 },
  smash: { s: 220, a: 80, e: 440, box: [3, 18, -16, -8], d: 13, b: 110, gr: 3.1, an: 0.6 },
  upper: { s: 70, a: 80, e: 320, box: [-3, 11, -30, -12], d: 9, b: 85, gr: 2.6, an: 1.35 },
  sweep: { s: 90, a: 80, e: 360, box: [1, 18, -6, 0], d: 8, b: 75, gr: 2.2, an: 1.15 },
  akick: { s: 60, a: 160, e: 320, box: [1, 14, -12, -2], d: 8, b: 70, gr: 2.5, an: 0.45, air: true },
  stomp: { s: 120, a: 120, e: 380, box: [-6, 6, -4, 7], d: 10, b: 60, gr: 2.6, an: -1.2, air: true },
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

  // Un poco más grande que la pantalla para que al inclinarse no se vean las esquinas.
  s.world = s.add.container(W / 2, H / 2).setScale(1.05);
  s.bg = s.add.graphics({ x: -W / 2, y: -H / 2 });
  s.dyn = s.add.graphics({ x: -W / 2, y: -H / 2 });
  s.world.add([s.bg, s.dyn]);
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
    if (s.stop > 0) s.stop -= delta;
    else simulate(s, dt);
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
    const [a, b] = s.sel;
    s.copy = (a.at || 0) > (b.at || 0) ? 0 : 1;
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
    dodge: 0,
    dodged: false,
    run: 0,
    tap: { d: 0, t: -1e9 },
    susto: 0,
    lives: 2,
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
    s.picks = [(Math.random() * CHARS.length) | 0, (Math.random() * CHARS.length) | 0];
    s.copy = 1;
  }
  s.f = [0, 1].map((i) => makeFighter(s, i, !humans[i], s.picks[i]));
  s.mt = demo ? 26000 : 0;
  s.phase = -1;
  s.dropT = 1000;
  s.sudden = false;
  s.objs.length = 0;
  s.parts.length = 0;
  s.msgs.length = 0;
  s.winner = null;
  s.maxG = 3;
  s.lat = { dir: 1, t: 0, k: 0 };
  s.warned = -1;
  s.countdown = null;
  s.cheer = 0;
  s.idle = 0;
  s.mus = { step: 0, next: 0 };
  s.tod = (Math.random() * 3) | 0;
  s.bg.clear();
  s.st.bg(s.bg, s.tod);
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
  for (const f of s.f) resolveAction(s, f, s.f[1 - f.i]);
  stepObjects(s, dt);
  stepParticles(s, dt);
  if (s.help > 0) s.help -= dt * 1000;
  if (s.mode === 'end') return;

  // Se revisan los dos antes de decidir: si caen en el mismo cuadro, gana el con menos susto.
  const outs = s.f.filter((f) => checkOut(s, f));
  const [a, b] = s.f;
  if (outs.length && (s.sudden || a.lives <= 0 || b.lives <= 0)) {
    if (a.lives !== b.lives) endMatch(s, a.lives > b.lives ? a : b);
    else endMatch(s, outs.length === 2 ? (a.susto <= b.susto ? a : b) : s.f[1 - outs[0].i]);
    return;
  }

  if (!s.sudden && s.mt >= MATCH_MS) {
    if (a.lives !== b.lives) {
      endMatch(s, a.lives > b.lives ? a : b);
    } else {
      s.sudden = true;
      say(s, '¡MUERTE SÚBITA!', RED);
      sfx(s, 'alert');
    }
  }
  // Tope de la muerte súbita: si nadie cae en 45 s, gana el que tiene menos susto.
  if (s.sudden && s.mt > MATCH_MS + 45000) endMatch(s, a.susto <= b.susto ? a : b);
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
    if (f.mash >= 5) {
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
    f.x = g.x + g.face * 12;
    f.y = g.y - 3;
    f.vx = f.vy = 0;
    return;
  }

  const free = f.stun <= 0 && f.daze <= 0 && f.dodge <= 0;
  f.stun = Math.max(0, f.stun - ms);
  f.daze = Math.max(0, f.daze - ms);
  const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (inp.up) f.jbuf = 100;

  if (f.dodge > 0) {
    f.dodge -= ms;
    if (f.dodge <= 0) {
      f.vx *= 0.4;
      f.vy *= 0.4;
    }
  } else if (free) {
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
        puff(s, f.x, f.y, 4, WHITE);
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

  // Grado 8: el piso arrastra hacia un lado, salvo bajo el marco de la puerta (máximo 2 s).
  const g = GRADOS[Math.max(0, s.phase)];
  const inDoor = f.ground && f.plat.solid && s.st.doors.some((d) => f.x > d[0] && f.x < d[1]);
  if (inDoor && g.tilt) {
    f.refugio += ms;
    if (f.refugio < 2000) gainCalma(s, f, 12 * dt);
  } else {
    f.refugio = 0;
  }
  if (g.tilt && f.ground && !(inDoor && f.refugio < 2000)) f.x += s.lat.dir * s.lat.k * 40 * dt;

  if (f.dodge <= 0) {
    const fast = inp.d && !f.ground && f.vy > -40;
    f.vy = Math.min(f.vy + (fast ? 1800 : 900) * dt, fast ? 420 : 300);
  }
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
        f.dodged = false;
        f.plat = p;
        if (f.act && MOVES[f.act.k] && MOVES[f.act.k].air) f.act = null;
        break;
      }
    }
  }
  if (wasGround && !f.ground && f.vy >= 0 && !f.jumping) f.coyote = 80;

  // La parrilla quema.
  if (f.ground && f.plat.hot) {
    f.hotT -= ms;
    if (f.hotT <= 0) {
      f.hotT = 350;
      f.susto += 3;
      f.vy = -180;
      f.ground = false;
      puff(s, f.x, f.y, 4, ORANGE);
      sfx(s, 'whiff');
    }
  }

  if (f.act) f.act.t += ms;
  if (f.hold) {
    f.hold.x = f.x;
    f.hold.y = f.y - 22;
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
    sfx(s, 'whiff');
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
    if (f.ground) {
      f.act = { k: 'parry', t: 0 };
    } else if (!f.dodged) {
      // Esquive aéreo hacia donde apunte el joystick.
      const dx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      const dy = (inp.d ? 1 : 0) - (inp.uh ? 1 : 0);
      const n = Math.hypot(dx, dy) || 1;
      f.vx = (dx / n) * 230;
      f.vy = (dy / n) * 230;
      f.dodge = 160;
      f.inv = 190;
      f.dodged = true;
      sfx(s, 'dodge');
    }
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
      f.act = null;
      if (inp.d) hit(s, o, dir, 9 * f.c.pow, 50, 1.6, 1.45, f);
      else hit(s, o, dir, 12 * f.c.pow, 90, 3, inp.uh ? 1.35 : 0.6, f);
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
    if (a.t > 200) f.act = null;
  }
}

function touches(f, o, box) {
  if (o.out > 0) return false;
  const ax = f.face > 0 ? f.x + box[0] : f.x - box[1];
  const bx = f.face > 0 ? f.x + box[1] : f.x - box[0];
  return o.x + 5 > ax && o.x - 5 < bx && o.y - 20 < f.y + box[3] && o.y > f.y + box[2];
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
  attacker.vx = -attacker.face * 90;
  s.stop = 110;
  ring(s, f.x, f.y - 10, WHITE);
  sfx(s, 'parry');
}

function hit(s, t, dir, dmg, base, growth, ang, by) {
  const chain = t.stun > 0;
  t.susto += dmg;
  const kb = (base + t.susto * growth) / t.c.wt;
  t.vx = dir * kb * Math.cos(ang);
  t.vy = -kb * Math.sin(ang) - (ang < 0 ? 0 : 40);
  t.stun = Math.min(700, 80 + t.susto * 1.6);
  const v = s.f[1 - t.i];
  if (v.grabbedBy === t) v.grabbedBy = null;
  t.act = null;
  t.ground = false;
  t.spiked = false;
  t.flashT = 50;
  dropHold(t);
  s.stop = Math.min(120, 50 + dmg * 4);
  s.kick = Math.min(3, 1 + t.susto / 60);
  if (by) {
    by.combo = chain ? by.combo + 1 : 1;
    if (by.combo >= 3) {
      by.comboShow = 900;
      by.sty += 40 * by.combo;
    }
  }
  const big = t.susto > 90;
  if (big) flash(s, 0.3);
  s.fx.push({ x: t.x - dir * 3, y: t.y - 12, r: big ? 10 : 6, l: 0.12 });
  puff(s, t.x, t.y - 10, big ? 10 : 6, big ? YEL : WHITE);
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
  ring(s, f.x, f.y - 10, YEL, 24);
  sfx(s, 'remezon');
  for (const ob of s.objs) {
    if (ob.st !== 'held') {
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
  const losing = f.lives < o.lives || (f.lives === o.lives && f.susto > o.susto + 30);
  f.calma = Math.min(100, f.calma + n * (losing ? 1.5 : 1));
}

// Devuelve true si el luchador salió de la pantalla en este cuadro.
function checkOut(s, f) {
  if (f.out > 0) return false;
  if (f.x > -30 && f.x < W + 30 && f.y < H + 40 && f.y > -120) return false;
  const o = s.f[1 - f.i];
  f.lives--;
  f.out = 900;
  f.act = null;
  f.grabbedBy = null;
  dropHold(f);
  if (o.grabbedBy === f) o.grabbedBy = null;
  o.base += 1000;
  if (f.lives < o.lives) f.behind = true;
  const ex = Phaser.Math.Clamp(f.x, 4, W - 4);
  const ey = Phaser.Math.Clamp(f.y, 4, H - 4);
  for (let k = 0; k < 3; k++) puff(s, ex, ey, 12, [WHITE, YEL, PCOL[f.i]][k]);
  flash(s, 0.45);
  s.kick = 4;
  s.cheer = 1500;
  sfx(s, 'ko');
  // Texto solo para lo insólito.
  if (f.spiked) say(s, '¡PISOTÓN!', WHITE, 900);
  else if (f.lastObj && s.mt - f.lastObj.t < 1500 && OBJS[f.lastObj.k].heavy) say(s, '¡CON TODO EL MUEBLE!', WHITE, 1100);
  return true;
}

function respawn(s, f) {
  f.x = f.i ? s.st.plats[0].x2 - 50 : s.st.plats[0].x1 + 50;
  f.y = 30;
  f.vx = 0;
  f.vy = 0;
  f.susto = 0;
  f.stun = 0;
  f.daze = 0;
  f.act = null;
  f.inv = 1500;
  f.blink = 1500;
  f.out = 0;
  f.dodge = 0;
  f.dodged = false;
  f.spiked = false;
}

function inHole(p, x) {
  return p.holes && p.holes.some((h) => x > h[0] && x < h[1]);
}

function dropHold(f) {
  if (f.hold) {
    f.hold.st = 'fall';
    f.hold.vy = -60;
    f.hold = null;
  }
}

// ---------- Temblor ----------

function updateQuake(s, dt) {
  let ph = 0;
  for (let i = 0; i < GRADOS.length; i++) if (s.mt >= GRADOS[i].t) ph = i;
  const next = GRADOS[ph + 1];
  if (next && s.warned !== ph + 1) {
    const lead = next.g === 6 ? 3000 : 1500;
    if (next.t - s.mt <= lead) {
      s.warned = ph + 1;
      sfx(s, 'alert');
      if (next.g === 6) s.countdown = s.mt;
    }
  }
  const g = GRADOS[ph];
  if (ph !== s.phase) {
    s.phase = ph;
    s.maxG = Math.max(s.maxG, g.g);
    if (ph > 0) {
      sfx(s, 'rumble', g.g);
      s.kick = 1 + g.g / 3;
      s.gPop = s.now;
    }
    if (g.heavy) spawnObj(s, s.st.heavy, W / 2, -20);
    if (g.breaks) {
      const fl = s.plats[0];
      const c = (fl.x1 + fl.x2) / 2;
      fl.holes = [[c - 44, c - 30], [c + 30, c + 44]];
      for (const h of fl.holes) for (let k = 0; k < 4; k++) puff(s, h[0] + 7, fl.y, 8, 0x8a8a9c);
      for (const p of s.plats) {
        if (p.brk) {
          p.broken = true;
          for (let k = 0; k < 3; k++) puff(s, (p.x1 + p.x2) / 2, p.y, 8, 0x7a4a2a);
        }
      }
      sfx(s, 'break');
    }
  }
  if (g.drop) {
    s.dropT -= dt * 1000;
    if (s.dropT <= 0 && s.objs.length < 7) {
      s.dropT = g.drop;
      const fl = s.plats[0];
      const kinds = s.st.drops;
      spawnObj(s, kinds[(Math.random() * kinds.length) | 0], fl.x1 + 20 + Math.random() * (fl.x2 - fl.x1 - 40), -10);
    }
  }
  if (g.tilt) {
    s.lat.t += dt * 1000;
    if (s.lat.t > 3000) {
      s.lat.t = 0;
      s.lat.dir *= -1;
    }
    s.lat.k = Math.sin((s.lat.t / 3000) * Math.PI) * g.tilt;
  } else {
    s.lat.k = 0;
  }
  // Remezones: desde el grado 5 el piso salta y lo que está suelto brinca.
  if (g.g >= 5) {
    s.joltT = (s.joltT || 0) - dt * 1000;
    if (s.joltT <= 0) {
      s.joltT = 1700 - g.g * 130 + Math.random() * 500;
      s.kick = g.g / 2;
      for (const f of s.f) {
        if (f.ground && f.out <= 0 && !f.grabbedBy) {
          f.vy = -40 - g.g * 9;
          f.ground = false;
        }
      }
      for (const ob of s.objs) {
        if (ob.st === 'ground') {
          ob.st = 'fall';
          ob.vy = -90 - Math.random() * 60;
          ob.vx += (Math.random() - 0.5) * 60;
        }
      }
      sfx(s, 'thud');
    }
  }
  // Desde el grado 6: polvo del techo y retumbos.
  if (g.g >= 6) {
    s.rumbleT = (s.rumbleT || 0) - dt * 1000;
    if (s.rumbleT <= 0) {
      s.rumbleT = 1300;
      sfx(s, 'rumble', g.g - 3);
    }
    if (Math.random() < dt * 10) s.parts.push({ x: 30 + Math.random() * 260, y: 0, vx: 0, vy: 30, l: 2, c: 0xd6bd86, z: 1, ng: true });
  }
  for (const f of s.f) {
    if (f.out <= 0 && g.g === 8) f.sty += 20 * dt;
  }
  if (s.cheer > 0) s.cheer -= dt * 1000;
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
      ob.x += ob.vx * dt;
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
      if (Math.abs(ob.x - f.x) < 5 + d.w / 2 && ob.y > f.y - 20 && ob.y - d.h < f.y) {
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
        } else if (ob.vy > 150) {
          hit(s, f, ob.x < f.x ? 1 : -1, 4, 50, 1.2, 1.1, null);
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
    out.b1 = Math.random() < 0.15;
    return out;
  }
  // Volver al escenario si está afuera.
  if (!f.ground && (f.x < fl.x1 + 6 || f.x > fl.x2 - 6) && f.y > fl.y - 60) {
    toward(W / 2);
    out.l = w.l;
    out.r = w.r;
    out.uh = true;
    if (f.vy > 0 && f.jumps > 0) out.up = true;
    else if (f.vy > 0 && !f.dodged && f.y > fl.y - 10) out.b3 = true;
    return out;
  }
  if (o.act && MOVES[o.act.k] && o.act.t < 50 && adx < 24 && Math.random() < 0.1) {
    out.b3 = true;
    return out;
  }
  if (ai.t > 0) return out;
  ai.t = 120 + Math.random() * 150;
  w.l = w.r = w.uh = w.d = false;

  const g = GRADOS[Math.max(0, s.phase)];
  if (g.tilt >= 1 && Math.random() < 0.3) {
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
      const def = f.i ? [15, 14, 22] : [15, 20, 12];
      s.entries.push({ f, letters: ((s.lastName && s.lastName[f.i]) || def).slice(), pos: 0, done: false, cool: 0 });
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
    r.top.push({ n, s: score(e.f), g: s.maxG });
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
    s.parts.push({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, l: 0.25, c, z: 2, ng: true });
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
  s.msgs.push({ str, col, t0: s.now, ms: ms || 1300 });
}

function approach(v, target, step) {
  return v > target ? Math.max(target, v - step) : Math.min(target, v + step);
}

// ---------- Dibujo ----------

function render(s, t) {
  const g = s.dyn;
  g.clear();
  const ph = GRADOS[Math.max(0, s.phase)];
  const env = 0.35 + 0.65 * Math.max(0, Math.sin(t / 650));
  const amp = s.mode === 'end' || s.mode === 'select' ? 0 : Math.min(1.6, ph.amp * env) + s.kick;
  s.kick = Math.max(0, s.kick - 0.25);
  s.world.x = Math.round(W / 2 + (Math.random() - 0.5) * amp * 2);
  s.world.y = Math.round(H / 2 + (Math.random() - 0.5) * amp * 2);
  s.world.rotation = s.lat.k * s.lat.dir * 0.04 + (amp ? Math.sin(t / 170) * ph.amp * 0.006 : 0);
  // El fondo tiembla a otro ritmo que el primer plano.
  s.bg.x = -W / 2 + Math.round((Math.random() - 0.5) * amp * 1.6);
  s.bg.y = -H / 2 + Math.round((Math.random() - 0.5) * amp * 1.6);

  s.st.anim(g, t, s);
  g.fillStyle(K, 0.38).fillRect(0, 0, W, H);
  // Bordes claros en todo lo que se pisa.
  for (const p of s.plats) {
    if (p.brk) continue;
    g.fillStyle(0xe8d8b0).fillRect(p.x1, p.y, p.x2 - p.x1, 2);
    g.fillStyle(K).fillRect(p.x1, p.y + 2, p.x2 - p.x1, 1);
  }
  const fl = s.plats[0];
  const c = (fl.x1 + fl.x2) / 2;
  if (s.phase >= 3) {
    for (const h of fl.holes || [[c - 44, c - 30], [c + 30, c + 44]]) {
      if (fl.holes) {
        g.fillStyle(K).fillRect(h[0], fl.y, h[1] - h[0], H - fl.y);
        g.fillStyle(0x8a8a9c).fillTriangle(h[0], fl.y, h[0] + 4, fl.y, h[0], fl.y + 8).fillTriangle(h[1], fl.y, h[1] - 4, fl.y, h[1], fl.y + 6);
      } else {
        // Grietas que crecen hasta que el piso se parte.
        const n = 2 + s.phase * 2 + ((s.mt / 800) % 4);
        for (let k = 0; k < n; k++) g.fillStyle(K).fillRect(h[0] + 3 + ((k * 5) % 9), fl.y + (k % 3), 2, 2 + (k % 2) * 2);
      }
    }
  }
  // Grado 7 y 8: cae tierra y pedazos del techo.
  if (ph.g >= 7 && Math.random() < 0.3) s.parts.push({ x: 20 + Math.random() * 280, y: 0, vx: 0, vy: 60, l: 3, c: 0x8a8a9c, z: 2 + ((Math.random() * 2) | 0) });
  for (const p of s.plats) {
    if (!p.brk) continue;
    if (p.broken) g.fillStyle(0x7a4a2a).fillTriangle(p.x1, p.y, p.x1 + 6, p.y, p.x1 + 2, p.y + 20);
    else {
      g.fillStyle(K).fillRect(p.x1 - 1, p.y - 1, p.x2 - p.x1 + 2, 5);
      g.fillStyle(0x9a6a3a).fillRect(p.x1, p.y, p.x2 - p.x1, 3);
    }
  }
  for (const ob of s.objs) drawObj(s, g, ob);
  for (const f of s.f) drawFighter(s, g, f, t);
  for (let i = s.fx.length - 1; i >= 0; i--) {
    const e = s.fx[i];
    e.l -= 1 / 60;
    if (e.l <= 0) {
      s.fx.splice(i, 1);
      continue;
    }
    // Chispa en estrella.
    g.fillStyle(YEL).fillRect(e.x - e.r, e.y - 1, e.r * 2, 3).fillRect(e.x - 1, e.y - e.r, 3, e.r * 2);
    g.fillStyle(WHITE).fillRect(e.x - e.r / 2, e.y, e.r, 1).fillRect(e.x, e.y - e.r / 2, 1, e.r);
  }
  for (const p of s.parts) g.fillStyle(p.c, Math.min(1, p.l * 4)).fillRect(Math.round(p.x), Math.round(p.y), p.z, p.z);
  // Grado 7 y 8: la luz baja de golpe, una vez por segundo como máximo.
  if (ph.g >= 7 && s.mode !== 'end' && Math.sin(t / 160) > 0.97) g.fillStyle(K, 0.3).fillRect(0, 0, W, H);

  drawHud(s, t);
}

function drawFighter(s, g, f, t) {
  if (f.out > 0 || (f.blink > 0 && ((t / 70) | 0) % 2)) return;
  if (f.dodge > 0 && ((t / 40) | 0) % 2) return;
  const c = f.c;
  const pal = f.flashT > 0 ? FLASH_PAL : c.pal;
  const d = f.face;
  const cx = Math.round(f.x);
  const a = f.act ? f.act.k : '';
  const m = MOVES[a];
  const active = m && f.act.t >= m.s && f.act.t < m.s + m.a;
  const crouch = a === 'sweep' || f.land > 0 ? 3 : 0;
  const moving = f.ground && Math.abs(f.vx) > 20;
  const step = ((t / 110) | 0) % 2;
  const bob = moving && step ? 1 : 0;
  const top = Math.round(f.y) - 20 + crouch - bob;
  const hurt = f.stun > 0 || f.grabbedBy;

  let legs = LEGS.stand;
  if (a === 'sweep' && active) legs = LEGS.sweep;
  else if ((a === 'akick' || a === 'stomp') && active) legs = LEGS.kick;
  else if (!f.ground) legs = LEGS.jump;
  else if (moving && step) legs = LEGS.walk;
  spr(g, legs, cx, top + 14 - crouch + (a === 'sweep' ? 3 : 0), d, pal, 6);
  spr(g, c.torso, cx, top + 9, d, pal, 6);
  spr(g, c.head, cx, top, d, pal, 7);
  const mood = f.daze > 0 ? 'daze' : f.susto >= 100 ? 'terror' : f.susto >= 50 ? 'scared' : 'calm';
  if (f.flashT <= 0) drawFace(g, c, d, cx, top, mood, t);
  if (f.daze > 0) {
    for (let k = 0; k < 3; k++) {
      const an = t / 150 + (k * Math.PI * 2) / 3;
      g.fillStyle(YEL).fillRect(cx + Math.cos(an) * 8, top - 3 + Math.sin(an) * 2, 2, 2);
    }
  }

  // Brazos según la acción.
  const p = pal.p;
  const sk = pal.s;
  if (a === 'jab' || a === 'smash') {
    if (active) {
      const L = a === 'smash' ? 9 : 6;
      rr(g, d, cx, 5, top + 10, L, 2, p);
      rr(g, d, cx, 5 + L, top + 9, 3, 3, sk);
    } else {
      const charging = a === 'smash' && f.act.ch > 0 && ((t / 60) | 0) % 2;
      rr(g, d, cx, -10, top + 10, 4, 2, p);
      rr(g, d, cx, -12, top + 9, 2, 3, charging ? YEL : sk);
    }
    rr(g, d, cx, -7, top + 11, 2, 3, p);
  } else if (a === 'upper') {
    rr(g, d, cx, 4, top + (active ? 0 : 6), 2, active ? 10 : 5, p);
    rr(g, d, cx, 4, top + (active ? -3 : 3), 3, 3, sk);
  } else if (a === 'grab' || a === 'hold') {
    const L = a === 'hold' || f.act.t >= 120 ? 6 : 3;
    rr(g, d, cx, 5, top + 9, L, 2, p);
    rr(g, d, cx, 5, top + 12, L, 2, p);
  } else if (f.hold || a === 'throwing' || a === 'remezon') {
    rr(g, d, cx, -7, top + 1, 2, 9, p);
    rr(g, d, cx, 5, top + 1, 2, 9, p);
    if (a === 'remezon') g.lineStyle(2, YEL, 0.9).strokeCircle(cx, top + 10, 6 + f.act.t / 4);
  } else if (a === 'parry') {
    rr(g, d, cx, 4, top + 6, 2, 6, p);
    rr(g, d, cx, 7, top + 6, 2, 6, p);
    if (f.act.t < 160) g.lineStyle(1, WHITE, 1 - f.act.t / 160).strokeCircle(cx, top + 10, 13);
  } else if (a === 'akick' || a === 'stomp') {
    rr(g, d, cx, -9, top + 8, 4, 2, p);
    rr(g, d, cx, 4, top + 5, 2, 4, p);
  } else if (hurt) {
    const wob = ((t / 60) | 0) % 2;
    rr(g, d, cx, -8, top + 2 + wob, 2, 6, p);
    rr(g, d, cx, 6, top + 3 - wob, 2, 6, p);
  } else {
    rr(g, d, cx, -7, top + 10, 2, 4, p);
    rr(g, d, cx, -7, top + 14, 2, 1, sk);
    rr(g, d, cx, 5, top + 10, 2, 4, p);
    rr(g, d, cx, 5, top + 14, 2, 1, sk);
  }
  // Marca del jugador sobre la cabeza.
  g.fillStyle(PCOL[f.i]).fillTriangle(cx - 3, top - 7, cx + 3, top - 7, cx, top - 4);
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
  } else if (k === 'taza') {
    b(WHITE, 0, 0, 4, 4);
    g.fillStyle(K).fillRect(x + 4, y + 1, 1, 2);
  } else if (k === 'pan') {
    b(0xd9a35b, 0, 0, 4, 5);
    b(0xd9a35b, 5, 0, 4, 5);
    g.fillStyle(0x6fa83a).fillRect(x, y + 3, 9, 1);
  } else if (k === 'chori') {
    b(0xd9a35b, 0, 1, 10, 3);
    g.fillStyle(0xb8433a).fillRect(x + 1, y, 8, 2);
  } else if (k === 'pelota') {
    b(WHITE, 0, 0, 6, 6);
    g.fillStyle(K).fillRect(x + 2, y + 2, 2, 2);
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
    b(0x3f7a3a, 0, 1, 12, 8);
    g.fillStyle(0x7ab04a).fillRect(x + 3, y + 1, 2, 8).fillRect(x + 7, y + 1, 2, 8);
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
  const ph = GRADOS[Math.max(0, s.phase)];

  // Sismógrafo.
  g.fillStyle(K, 0.85).fillRect(130, 2, 60, 32);
  g.lineStyle(1, YEL).strokeRect(130.5, 2.5, 59, 31);
  g.fillStyle(RED);
  for (let x = 0; x < 56; x++) g.fillRect(132 + x, 26 + Math.round(Math.sin(t / 30 + x * 0.9) * ph.amp * 2.5 * Math.random()), 1, 1);
  text(g, 'GRADO', 134, 5, 1, WHITE, 0);
  const pop = Math.max(0, 1 - (t - (s.gPop || 0)) / 400);
  text(g, String(ph.g), 160, 10 - Math.round(pop * 3), 4, YEL);
  const left = Math.max(0, Math.ceil((MATCH_MS - s.mt) / 1000));
  text(g, s.sudden ? '!!' : String(left), 187, 5, 1, WHITE, 1);

  // Cuenta antes del grado 6.
  const cd = s.countdown != null ? s.mt - s.countdown : -1;
  if (cd >= 0 && cd < 3600 && s.mode !== 'end') {
    const n = 3 - Math.floor(cd / 1000);
    if (((t / 120) | 0) % 2 === 0 || n <= 0) text(g, n > 0 ? '¡TEMBLOR!\n' + n : '¡TEMBLOR!', W / 2, 80, 5, RED);
  }

  s.f.forEach((f, i) => {
    const x = i ? W - 6 : 6;
    const al = i ? 1 : 0;
    text(g, (f.cpu ? 'CPU ' : 'P' + (i + 1) + ' ') + f.c.n, x, 4, 1, PCOL[i], al);
    text(g, Math.round(f.susto) + '%', x, 12, 3, f.susto >= 100 ? RED : f.susto >= 50 ? YEL : WHITE, al);
    text(g, String(score(f)), x, 34, 1, WHITE, al);
    for (let k = 0; k < 2; k++) {
      const hx = i ? W - 14 - k * 16 : 14 + k * 16;
      if (k < f.lives) {
        spr(g, f.c.head, hx, 42, 1, f.c.pal, 7);
        drawFace(g, f.c, 1, hx, 42, 'calm', t);
      } else {
        g.fillStyle(0x444455).fillRect(hx - 5, 44, 10, 7);
      }
    }
    const full = f.calma >= 100;
    const bx = i ? W - 52 : 6;
    g.fillStyle(WHITE).fillRect(bx, 54, 46, 5);
    g.fillStyle(K).fillRect(bx + 1, 55, 44, 3);
    g.fillStyle(full ? (((t / 100) | 0) % 2 ? YEL : WHITE) : PCOL[i]).fillRect(bx + 1, 55, 0.44 * f.calma, 3);
    text(g, full ? '1+2!' : 'CALMA', x, 62, 1, full ? YEL : WHITE, al);
    if (f.comboShow > 0) text(g, f.combo + ' GOLPES', x, 72, 1, YEL, al);
  });

  s.msgs = s.msgs.filter((m) => t - m.t0 < m.ms);
  s.msgs.forEach((m, k) => text(g, m.str, W / 2, 104 + k * 16, 2, m.col));

  if (s.help > 0 && s.mode === 'play') text(g, '1 GOLPE · 2 AGARRA · 3 PARRY · DOBLE TOQUE CORRE', W / 2, 228, 1, WHITE);

  if (s.mode === 'demo') drawTitle(s, g, t);
  if (s.mode === 'end') drawEnd(s, g, t);
}

// Antes de jugar: qué hace cada botón, con el panel del mueble dibujado.
function drawControls(g, t) {
  g.fillStyle(K, 0.96).fillRect(0, 0, W, 214);
  text(g, 'CÓMO SE JUEGA', W / 2, 8, 2, YEL);
  text(g, 'SÁCALO DE LA PANTALLA · 2 VIDAS CADA UNO', W / 2, 26, 1, WHITE);
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
  text(g, '1 GOLPE (CAMBIA CON LA DIRECCIÓN)\n2 AGARRA Y LANZA\n3 PARRY · EN EL AIRE ESQUIVA', 60, 70, 1, WHITE, 0);
  text(g, 'TRUCOS', W / 2, 110, 2, YEL);
  text(
    g,
    'DOBLE TOQUE ADELANTE: CORRE\nDOBLE TOQUE EN EL AIRE: DA VUELTA AL TIRO\nMANTÉN 1 CON DIRECCIÓN: GOLPE CARGADO\nARRIBA + 1: GOLPE HACIA ARRIBA · ABAJO + 1: BARRIDA\nEN EL AIRE ABAJO + 1: PISOTÓN\n1 + 2 CON LA BARRA LLENA: REMEZÓN',
    W / 2,
    128,
    1,
    WHITE,
  );
}

function drawTitle(s, g, t) {
  // El attract alterna el título con la pantalla de controles.
  if (((t / 7000) | 0) % 2) {
    drawControls(g, t);
    g.fillStyle(K, 0.7).fillRect(0, 214, W, 26);
    if (((t / 450) | 0) % 2) text(g, 'PRESIONA START', W / 2, 220, 2, BLUE);
    return;
  }
  g.fillStyle(K, 0.6).fillRect(0, 92, W, 58);
  text(g, '¿SE MOVIÓ?', W / 2 + (((t / 90) | 0) % 2), 98, 5, YEL);
  text(g, '¡SÁCALO DE LA PANTALLA!', W / 2, 134, 2, WHITE);
  g.fillStyle(K, 0.7).fillRect(0, 214, W, 26);
  if (((t / 450) | 0) % 2) text(g, 'PRESIONA START', W / 2, 217, 2, BLUE);
  const r = s.records;
  const pages = [CHARS.length + ' PERSONAJES · ' + STAGES.length + ' MAPAS · 2 JUGADORES', r.rey ? `REY DEL MUEBLE: ${r.rey.n} · ${r.rey.r} SEGUIDAS` : 'REY DEL MUEBLE: SE BUSCA'].concat(
    r.top.slice(0, 3).map((e, i) => `${i + 1}. ${e.n}  ${e.s} PTS  GRADO ${e.g}`),
  );
  text(g, pages[((t / 2500) | 0) % pages.length], W / 2, 232, 1, WHITE);
}

// Pose de cuerpo entero a escala, con un gesto propio de cada personaje.
function drawPose(g, c, cx, top, z, t, vic) {
  spr(g, LEGS.stand, cx, top + 14 * z, 1, c.pal, 6, z);
  spr(g, c.torso, cx, top + 9 * z, 1, c.pal, 6, z);
  spr(g, c.head, cx, top, 1, c.pal, 7, z);
  drawFace(g, c, 1, cx, top, 'calm', t, z);
  const arm = (r, y, w, h, col) => {
    g.fillStyle(K).fillRect(cx + r * z - 1, top + y * z - 1, w * z + 2, h * z + 2);
    g.fillStyle(col).fillRect(cx + r * z, top + y * z, w * z, h * z);
  };
  const k = Math.sin(t / 160) > 0 ? 0 : 1;
  const p = c.pal.p;
  if (!vic) {
    arm(-7, 10, 2, 4, p);
    arm(5, 10, 2, 4, p);
  } else if (c.vic === 'wave') {
    arm(-7, 10, 2, 4, p);
    arm(5 + k, 1, 2, 9, p);
  } else if (c.vic === 'cup') {
    arm(-7, 10, 2, 4, p);
    arm(5, 9, 3, 2, p);
    arm(7, 6 + k, 3, 3, WHITE);
  } else if (c.vic === 'thumb') {
    arm(-7, 10, 2, 4, p);
    arm(5, 9, 3, 2, p);
    arm(8, 7 - k, 2, 3, c.pal.s);
  } else if (c.vic === 'flex') {
    arm(-9, 6 + k, 3, 2, p);
    arm(-9, 4 + k, 2, 2, c.pal.s);
    arm(6, 6 + k, 3, 2, p);
    arm(7, 4 + k, 2, 2, c.pal.s);
  } else {
    arm(-8, 11, 2, 3, p);
    arm(6, 11, 2, 3, p);
  }
}

function drawSelect(s, g, t) {
  g.fillStyle(K, 0.92).fillRect(0, 0, W, H);
  text(g, 'ELIGE TU PERSONAJE', W / 2, 6, 2, YEL);
  const same = s.sel[0].on && s.sel[1].on && s.sel[0].pick === s.sel[1].pick;
  CHARS.forEach((c, k) => {
    const x0 = 8 + k * 76;
    const y0 = 26;
    const cx = x0 + 37;
    const picked = [0, 1].filter((i) => s.sel[i].on && s.sel[i].pick === k);
    g.fillStyle(picked.length ? 0x2d3a6e : 0x232040).fillRect(x0 + 1, y0, 74, 112);
    picked.forEach((i, n) => g.lineStyle(2, PCOL[i]).strokeRect(x0 + 2 + n * 3, y0 + 1 + n * 3, 72 - n * 6, 110 - n * 6));
    const ready = picked.some((i) => s.sel[i].ok);
    const bounce = picked.length && !ready ? Math.round(Math.abs(Math.sin(t / 150)) * -4) : 0;
    drawPose(g, c, cx, y0 + 12 + bounce, 3, t, ready);
    text(g, c.n, cx, y0 + 88, 2, WHITE);
    text(g, c.t, cx, y0 + 102, 1, 0xa7a7c7);
  });
  s.sel.forEach((e, i) => {
    const x = i ? W - 8 : 8;
    const al = i ? 1 : 0;
    // El que confirma segundo con el mismo personaje es la copia.
    const later = (e.ok && e.at) > (s.sel[1 - i].at || 0) || (!e.ok && s.sel[1 - i].ok) || (!e.ok && !s.sel[1 - i].ok && i);
    text(g, 'P' + (i + 1) + (e.on ? ': ' + CHARS[e.pick].n + (same && later ? ' (1)' : '') : ''), x, 150, 2, PCOL[i], al);
    text(g, !e.on ? 'START PARA JUGAR' : e.ok ? '¡LISTO!' : 'PALANCA ELIGE · 1 OK', x, 168, 1, WHITE, al);
  });
  text(g, '1 GOLPE · 2 AGARRA · 3 PARRY', W / 2, 214, 1, 0xa7a7c7);
  text(g, 'DOBLE TOQUE CORRE · 1 + 2 REMEZÓN', W / 2, 224, 1, 0xa7a7c7);
}

function drawEnd(s, g, t) {
  g.fillStyle(K, 0.88).fillRect(0, 0, W, H);
  const w = s.winner;
  text(g, 'GANA ' + w.c.n, W / 2, 10, 3, PCOL[w.i]);
  if (w.comeback) text(g, '¡REMONTADA!', W / 2, 34, 2, YEL);
  // El ganador celebra a su manera.
  const jump = Math.round(Math.abs(Math.sin(t / 220)) * -4);
  drawPose(g, w.c, W / 2, 50 + jump, 3, t, true);
  text(g, `SOBREVIVIÓ: GRADO ${s.maxG}`, W / 2, 124, 2, WHITE);
  if (s.f.every((f) => f.cpu)) return;
  text(g, s.f.map((f) => `${f.cpu ? 'CPU' : 'P' + (f.i + 1)} ${score(f)}`).join('    '), W / 2, 144, 2, WHITE);
  s.entries.forEach((e, n) => {
    const l = e.letters.map((c, k) => (k === e.pos && !e.done && ((t / 200) | 0) % 2 ? '_' : String.fromCharCode(65 + c))).join(' ');
    text(g, `P${e.f.i + 1} INICIALES: ${l}${e.done ? ' ¡LISTO!' : ''}`, W / 2, 166 + n * 16, 2, PCOL[e.f.i]);
  });
  text(g, s.entries.length && !s.saved ? 'ARRIBA/ABAJO LETRA · B1 SIGUIENTE' : 'START: ¡REVANCHA!', W / 2, 224, 1, BLUE);
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
    } else if (k === 'dodge') {
      noise(s, 0.12, 0.25, 3000, 'highpass', at);
    } else if (k === 'whiff') {
      noise(s, 0.06, 0.12, 2500, 'highpass', at);
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
      noise(s, 1.4, 0.1 * Math.max(1, n - 2), 110, 0, at);
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
  const g = GRADOS[Math.max(0, s.phase)].g;
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
