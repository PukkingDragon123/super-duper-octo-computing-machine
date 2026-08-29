/* ------------------------------------------------------------------
   city.js -- bakes the block plan into New York.

   Every building tile is drawn as a roof seen from above; if the tile
   below it is walkable, its bottom third becomes a street-facing
   facade with windows, an awning or a lit storefront.  Streets get
   concrete sidewalks against the buildings, asphalt down the middle,
   lane paint on the avenues and zebra stripes at the crossings.

   build() returns the baked image plus the props the game animates
   on top: steaming manholes, flickering neon, traffic lights.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var M = BP.maze, T = M.TILE;

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g };
  }
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  var mix = BP.face.mix;

  /* ---------------- districts ---------------- */
  var DISTRICTS = [
    { name: 'THE BLOCK', sub: 'BROWNSTONE ROW',
      brick: ['#4a2a20', '#3d231b', '#553328', '#331d16'],
      roof: '#1c1f28', trim: '#6b4d3a', neon: '#ff9f4d',
      sky: ['#0f0a24', '#2a1140'], towers: 0.15 },
    { name: 'THE PARK', sub: 'GREEN SIDE',
      brick: ['#3d2f26', '#4a382c', '#31261e', '#553f30'],
      roof: '#1b2320', trim: '#6d5a46', neon: '#7cf5a0',
      sky: ['#08121f', '#123a35'], towers: 0.25 },
    { name: 'MIDTOWN', sub: 'GLASS AND STEEL',
      brick: ['#1e2a3d', '#182236', '#243349', '#131c2e'],
      roof: '#171a23', trim: '#425a75', neon: '#4de1ff',
      sky: ['#050a1c', '#1b1a52'], towers: 0.8 },
    { name: 'THE ROOF', sub: 'APEX IS WAITING',
      brick: ['#1f1922', '#191320', '#261e2b', '#140f19'],
      roof: '#15111b', trim: '#5a4665', neon: '#ffd75e',
      sky: ['#12040f', '#3d0d2a'], towers: 0.6 }
  ];
  function districtFor(level) { return DISTRICTS[(level - 1) % DISTRICTS.length]; }
  function isBoss(level) { return ((level - 1) % DISTRICTS.length) === 3; }

  var WINDOW_LIT = ['#c9a05e', '#d8bd8c', '#7ba8c4', '#c48aa4'];
  var ASPHALT = '#181b24', ASPHALT_2 = '#1f222d', CURB = '#8f97a8', WALK = '#5f6572';

  function solid(c, r) {
    var t = M.terrain(c, r);
    return t === M.WALL || t === M.GATE;
  }

  /* ================================================================
     STREETS
     ================================================================ */
  function paveStreet(g, rand, c, r, D) {
    var x = c * T, y = r * T, i;
    g.fillStyle = ASPHALT;
    g.fillRect(x, y, T, T);
    for (i = 0; i < 7; i++) {
      g.fillStyle = rand() < 0.5 ? ASPHALT_2 : '#101219';
      g.fillRect(x + (rand() * T | 0), y + (rand() * T | 0), 1, 1);
    }

    // concrete sidewalk against every building face
    var up = solid(c, r - 1), dn = solid(c, r + 1),
        lf = solid(c - 1, r), rt = solid(c + 1, r);
    function walk(px, py, w, h, cx, cy, cw, ch) {
      g.fillStyle = WALK; g.fillRect(px, py, w, h);
      g.fillStyle = CURB; g.fillRect(cx, cy, cw, ch);   // painted curb: the maze outline
    }
    if (up) walk(x, y, T, 4, x, y + 4, T, 1);
    if (dn) walk(x, y + T - 4, T, 4, x, y + T - 5, T, 1);
    if (lf) walk(x, y, 4, T, x + 4, y, 1, T);
    if (rt) walk(x + T - 4, y, 4, T, x + T - 5, y, 1, T);
    // sidewalk expansion joints
    g.fillStyle = 'rgba(0,0,0,0.22)';
    if (up || dn) g.fillRect(x + (c % 2 ? 5 : 10), up ? y : y + T - 4, 1, 4);
    if (lf || rt) g.fillRect(lf ? x : x + T - 4, y + (r % 2 ? 5 : 10), 4, 1);

    var av = M.onAvenue(c, r);
    if (av) {                                   // lane paint
      g.fillStyle = 'rgba(226,196,88,0.55)';
      if (av.axis === 'h') { if ((c & 1) === 0) g.fillRect(x + 3, y + T / 2, 10, 1); }
      else if ((r & 1) === 0) g.fillRect(x + T / 2, y + 3, 1, 10);
    }
    return { up: up, dn: dn, lf: lf, rt: rt, av: av };
  }

  function streetProps(g, rand, c, r, nb, props) {
    var x = c * T, y = r * T, i;
    var roll = rand();

    // zebra crossing where an avenue meets a cross street
    if (nb.av && rand() < 0.30) {
      g.fillStyle = 'rgba(232,236,246,0.55)';
      if (nb.av.axis === 'h') {
        for (i = 0; i < 4; i++) g.fillRect(x + 1 + i * 4, y + 4, 3, T - 8);
      } else {
        for (i = 0; i < 4; i++) g.fillRect(x + 4, y + 1 + i * 4, T - 8, 3);
      }
    } else if (roll < 0.05) {                   // manhole -- these steam
      g.fillStyle = '#23262f'; g.fillRect(x + 4, y + 5, 8, 6);
      g.fillStyle = '#2e323d'; g.fillRect(x + 5, y + 6, 6, 4);
      g.fillStyle = '#14171e'; g.fillRect(x + 6, y + 7, 4, 1); g.fillRect(x + 6, y + 9, 4, 1);
      props.steam.push({ x: x + 8, y: y + 8, phase: rand() * 6 });
    } else if (roll < 0.09) {                   // storm drain at the curb
      g.fillStyle = '#0d0f15';
      if (nb.dn) for (i = 0; i < 3; i++) g.fillRect(x + 4 + i * 3, y + T - 3, 2, 2);
    } else if (roll < 0.125) {                  // trash bags on the sidewalk
      var bx = nb.lf ? x + 1 : (nb.rt ? x + T - 5 : x + 6);
      g.fillStyle = '#1c1f28'; g.fillRect(bx, y + 8, 4, 5);
      g.fillStyle = '#262a35'; g.fillRect(bx, y + 8, 4, 2);
      g.fillStyle = '#141720'; g.fillRect(bx + 4, y + 10, 3, 3);
    } else if (roll < 0.15 && (nb.lf || nb.rt)) {   // fire hydrant
      var hx = nb.lf ? x + 1 : x + T - 4;
      g.fillStyle = '#b8342c'; g.fillRect(hx, y + 7, 3, 5);
      g.fillStyle = '#e05046'; g.fillRect(hx, y + 6, 3, 2);
      g.fillStyle = '#8a221c'; g.fillRect(hx - 1, y + 8, 5, 1);
    } else if (roll < 0.17) {                   // steam grate
      g.fillStyle = '#1f232c';
      for (i = 0; i < 4; i++) g.fillRect(x + 3, y + 5 + i * 2, 10, 1);
      props.steam.push({ x: x + 8, y: y + 8, phase: rand() * 6, weak: true });
    }
  }

  /* ================================================================
     BUILDINGS
     ================================================================ */
  function roofTop(g, rand, c, r, D, props) {
    var x = c * T, y = r * T, i;
    var tone = D.brick[(c * 7 + r * 13) & 3];
    var tower = rand() < D.towers;
    var base = tower ? mix(D.roof, '#5a6a86', 0.25) : D.roof;

    g.fillStyle = base;
    g.fillRect(x, y, T, T);
    for (i = 0; i < 5; i++) {                   // tar speckle
      g.fillStyle = rand() < 0.5 ? mix(base, '#000000', 0.3) : mix(base, '#ffffff', 0.12);
      g.fillRect(x + (rand() * T | 0), y + (rand() * T | 0), 1, 1);
    }
    // parapet on every edge that overlooks a street
    var up = !solid(c, r - 1), dn = !solid(c, r + 1),
        lf = !solid(c - 1, r), rt = !solid(c + 1, r);
    g.fillStyle = mix(tone, '#ffffff', 0.28);
    if (up) g.fillRect(x, y, T, 2);
    if (lf) g.fillRect(x, y, 2, T);
    g.fillStyle = mix(tone, '#000000', 0.35);
    if (rt) g.fillRect(x + T - 2, y, 2, T);
    if (dn) g.fillRect(x, y + T - 2, T, 2);

    var roll = rand();
    if (roll < 0.13) {                          // wooden water tower
      g.fillStyle = '#5c3f28'; g.fillRect(x + 4, y + 3, 8, 7);
      g.fillStyle = '#755134'; g.fillRect(x + 4, y + 3, 8, 2);
      g.fillStyle = '#3a281a'; g.fillRect(x + 4, y + 6, 8, 1);
      g.fillStyle = '#2a1d12'; g.fillRect(x + 5, y + 10, 1, 3); g.fillRect(x + 10, y + 10, 1, 3);
      g.fillStyle = '#8a6242'; g.fillRect(x + 6, y + 1, 4, 2);
    } else if (roll < 0.26) {                   // rooftop AC plant
      g.fillStyle = '#4a4f5c'; g.fillRect(x + 3, y + 5, 7, 6);
      g.fillStyle = '#61677a'; g.fillRect(x + 3, y + 5, 7, 1);
      g.fillStyle = '#2b2f39'; g.fillRect(x + 4, y + 7, 5, 3);
      g.fillStyle = '#71778a'; g.fillRect(x + 11, y + 7, 2, 4);
    } else if (roll < 0.34) {                   // vent stacks
      for (i = 0; i < 3; i++) {
        g.fillStyle = '#4a4f5c'; g.fillRect(x + 3 + i * 4, y + 6, 2, 5);
        g.fillStyle = '#666d80'; g.fillRect(x + 3 + i * 4, y + 5, 2, 1);
      }
    } else if (roll < 0.40) {                   // skylight
      g.fillStyle = '#3a4152'; g.fillRect(x + 4, y + 5, 8, 6);
      g.fillStyle = mix(D.neon, '#ffffff', 0.4); g.fillRect(x + 5, y + 6, 6, 4);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 7, y + 6, 1, 4);
    } else if (roll < 0.44 && tower) {          // aircraft warning light
      props.blinkers.push({ x: x + 8, y: y + 5 });
      g.fillStyle = '#3a2028'; g.fillRect(x + 7, y + 4, 2, 3);
    }
  }

  /** A quiet stretch of wall: brick and a couple of dark windows. */
  function plainFace(g, rand, c, r, D) {
    var x = c * T, y = r * T + 8, i;
    var tone = mix(D.brick[(c * 5 + r * 11) & 3], '#000000', 0.15);
    g.fillStyle = tone;
    g.fillRect(x, y, T, T - 8);
    g.fillStyle = mix(tone, '#ffffff', 0.16);
    g.fillRect(x, y, T, 1);
    for (i = 0; i < 4; i++) {
      g.fillStyle = rand() < 0.5 ? mix(tone, '#ffffff', 0.06) : mix(tone, '#000000', 0.2);
      g.fillRect(x + (rand() * T | 0), y + 2 + (rand() * 5 | 0), 2, 1);
    }
    for (i = 0; i < 2; i++) {
      var wx = x + 3 + i * 7;
      g.fillStyle = '#0b0d13'; g.fillRect(wx, y + 3, 4, 4);
      if (rand() < 0.16) { g.fillStyle = WINDOW_LIT[(c + r + i) & 3]; g.fillRect(wx + 1, y + 3, 2, 4); }
      g.fillStyle = mix(tone, '#ffffff', 0.22); g.fillRect(wx - 1, y + 2, 6, 1);
    }
  }

  /** The street-facing side of a building: windows, then a shopfront. */
  function facade(g, rand, c, r, D, props) {
    var x = c * T, y = r * T + 6, i;
    var tone = D.brick[(c * 5 + r * 11) & 3];
    var h = T - 6;

    g.fillStyle = tone;
    g.fillRect(x, y, T, h);
    g.fillStyle = mix(tone, '#ffffff', 0.22);   // cornice
    g.fillRect(x, y, T, 1);
    g.fillStyle = mix(tone, '#000000', 0.3);
    g.fillRect(x, y + 1, T, 1);
    for (i = 0; i < 6; i++) {                   // brick grain
      g.fillStyle = rand() < 0.5 ? mix(tone, '#ffffff', 0.08) : mix(tone, '#000000', 0.18);
      g.fillRect(x + (rand() * T | 0), y + 2 + (rand() * (h - 2) | 0), 2, 1);
    }

    // upper windows
    for (i = 0; i < 2; i++) {
      var wx = x + 2 + i * 8, wy = y + 2;
      g.fillStyle = '#0e1017'; g.fillRect(wx, wy, 4, 3);
      if (rand() < 0.24) {
        g.fillStyle = WINDOW_LIT[(c + r + i) & 3];
        g.fillRect(wx, wy, 4, 3);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(wx + 2, wy + 1, 1, 2);
      }
      g.fillStyle = mix(tone, '#ffffff', 0.3);
      g.fillRect(wx - 1, wy - 1, 6, 1);         // stone lintel
    }

    // ground floor
    var gy = y + 6, roll = rand();
    if (roll < 0.30) {                          // shopfront with an awning
      var col = ['#8a2a26', '#26597e', '#256b45', '#7e5d22'][(c + r) & 3];
      g.fillStyle = '#101219'; g.fillRect(x + 1, gy + 2, T - 2, h - 8);
      g.fillStyle = mix(D.neon, '#ffffff', 0.25);
      g.fillRect(x + 3, gy + 3, T - 6, 2);
      for (i = 0; i < 4; i++) {                 // striped awning
        g.fillStyle = (i & 1) ? col : '#9aa2b4';
        g.fillRect(x + i * 4, gy, 4, 2);
      }
      g.fillStyle = mix(col, '#000000', 0.4); g.fillRect(x, gy + 2, T, 1);
      props.neon.push({ x: x + 3, y: gy + 3, w: T - 6, h: 2, col: D.neon, phase: rand() * 7 });
    } else if (roll < 0.55) {                   // stoop and door
      g.fillStyle = '#101219'; g.fillRect(x + 6, gy + 1, 5, h - 7);
      g.fillStyle = mix(tone, '#ffe0a0', 0.35); g.fillRect(x + 6, gy + 1, 5, 1);
      g.fillStyle = '#3c4150';
      for (i = 0; i < 3; i++) g.fillRect(x + 5 - i, gy + h - 6 + i, 7 + i * 2, 1);
      g.fillStyle = '#5a6070'; g.fillRect(x + 3, gy + 1, 1, 4); g.fillRect(x + 13, gy + 1, 1, 4);
    } else if (roll < 0.72) {                   // barred basement windows
      g.fillStyle = '#0e1017'; g.fillRect(x + 2, gy + 2, T - 4, h - 9);
      if (rand() < 0.3) { g.fillStyle = 'rgba(201,160,94,0.4)'; g.fillRect(x + 2, gy + 2, T - 4, h - 9); }
      g.fillStyle = mix(tone, '#000000', 0.5);
      for (i = 0; i < 4; i++) g.fillRect(x + 3 + i * 3, gy + 2, 1, h - 9);
    } else if (roll < 0.80) {                   // roll-down shutter
      g.fillStyle = '#3f4450'; g.fillRect(x + 1, gy + 1, T - 2, h - 7);
      g.fillStyle = '#2c3038';
      for (i = 0; i < 4; i++) g.fillRect(x + 1, gy + 2 + i * 2, T - 2, 1);
      g.fillStyle = mix(D.neon, '#000000', 0.4); g.fillRect(x + 3, gy + 1, 5, 1);
    }

    // fire escape, the most New York thing there is
    if (rand() < 0.28) {
      g.fillStyle = '#20242e';
      g.fillRect(x + 1, y + 2, T - 2, 1);
      g.fillRect(x + 1, y + 6, T - 2, 1);
      for (i = 0; i < 5; i++) g.fillRect(x + 2 + i * 3, y + 3, 1, 3);
      g.fillStyle = '#171a22';
      for (i = 0; i < 3; i++) g.fillRect(x + 4 + i * 2, y + 3 + i, 2, 1);
    }
  }

  /* ================================================================
     THE PARK
     ================================================================ */
  function parkGround(g, rand, c, r, D, props) {
    var x = c * T, y = r * T, i;
    g.fillStyle = '#2f5c37';
    g.fillRect(x, y, T, T);
    for (i = 0; i < 22; i++) {                  // grass tufts
      g.fillStyle = rand() < 0.5 ? '#3a7042' : '#26492c';
      g.fillRect(x + (rand() * T | 0), y + (rand() * T | 0), 1, 1);
    }
    // a gravel path threads the walkable row
    g.fillStyle = '#7d715a';
    g.fillRect(x, y + 6, T, 5);
    g.fillStyle = '#8d8067';
    for (i = 0; i < 6; i++) g.fillRect(x + (rand() * T | 0), y + 6 + (rand() * 5 | 0), 1, 1);
    g.fillStyle = '#5c5343';
    g.fillRect(x, y + 6, T, 1); g.fillRect(x, y + 10, T, 1);

    var roll = rand();
    if (roll < 0.14) {                          // bench
      g.fillStyle = '#5c3f28'; g.fillRect(x + 3, y + 1, 10, 3);
      g.fillStyle = '#755134'; g.fillRect(x + 3, y + 1, 10, 1);
      g.fillStyle = '#2a2018'; g.fillRect(x + 4, y + 4, 1, 1); g.fillRect(x + 11, y + 4, 1, 1);
    } else if (roll < 0.24) {                   // park lamp
      g.fillStyle = '#23262f'; g.fillRect(x + 7, y + 1, 2, 4);
      g.fillStyle = '#ffe6a8'; g.fillRect(x + 6, y, 4, 2);
      var gr = g.createRadialGradient(x + 8, y + 1, 0, x + 8, y + 1, 16);
      gr.addColorStop(0, 'rgba(255,230,168,0.22)');
      gr.addColorStop(1, 'rgba(255,230,168,0)');
      g.fillStyle = gr; g.fillRect(x - 8, y - 15, 32, 32);
    } else if (roll < 0.30) {                   // shrubs
      g.fillStyle = '#2c5c33'; g.fillRect(x + 2, y + 12, 5, 3);
      g.fillStyle = '#3a7541'; g.fillRect(x + 2, y + 12, 5, 1);
      g.fillStyle = '#2c5c33'; g.fillRect(x + 9, y + 12, 4, 3);
    }
  }

  function tree(g, rand, c, r) {
    var x = c * T, y = r * T;
    g.fillStyle = '#2f5c37'; g.fillRect(x, y, T, T);
    g.fillStyle = '#3d2a18';                    // trunk
    g.fillRect(x + 7, y + 9, 3, 7);
    g.fillStyle = '#553a22'; g.fillRect(x + 7, y + 9, 1, 7);
    var can = ['#3f8a4a', '#489a53', '#357a3f'][(c + r) % 3];
    g.fillStyle = can;                          // canopy, a rounded blob
    g.fillRect(x + 2, y + 3, 12, 7);
    g.fillRect(x + 3, y + 1, 10, 3);
    g.fillRect(x + 1, y + 5, 14, 3);
    g.fillStyle = mix(can, '#a8e06a', 0.35);
    g.fillRect(x + 3, y + 2, 6, 2);
    g.fillRect(x + 2, y + 5, 3, 2);
    g.fillStyle = mix(can, '#000000', 0.35);
    g.fillRect(x + 10, y + 6, 4, 3);
    g.fillRect(x + 5, y + 8, 7, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)';           // shade on the grass
    g.fillRect(x + 4, y + 14, 9, 2);
  }

  /* ================================================================
     BAKE
     ================================================================ */
  function build(grid, level) {
    var D = districtFor(level);
    var rand = rng(0x9e37 + level * 7919);
    var b = canvas(M.W, M.H), g = b.g;
    var props = { steam: [], neon: [], blinkers: [], lights: [] };
    var c, r, t;

    g.fillStyle = '#0a0c12';
    g.fillRect(0, 0, M.W, M.H);

    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        t = M.terrain(c, r);
        if (t === M.TREE) { tree(g, rand, c, r); continue; }
        if (t === M.PARK) { parkGround(g, rand, c, r, D, props); continue; }
        if (t === M.WALL) continue;
        if (t === M.GATE) continue;
        var nb = paveStreet(g, rand, c, r, D);
        streetProps(g, rand, c, r, nb, props);
      }
    }

    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        if (M.terrain(c, r) !== M.WALL) continue;
        roofTop(g, rand, c, r, D, props);
        if (!solid(c, r + 1) && ((c * 5 + r * 7) % 8) < 5) facade(g, rand, c, r, D, props);
        else if (!solid(c, r + 1)) plainFace(g, rand, c, r, D);
      }
    }

    // the club door
    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        if (M.terrain(c, r) !== M.GATE) continue;
        var x = c * T, y = r * T;
        g.fillStyle = '#101219'; g.fillRect(x, y, T, T);
        g.fillStyle = '#7a1f4a'; g.fillRect(x, y + 5, T, 5);
        g.fillStyle = mix(D.neon, '#ffffff', 0.3); g.fillRect(x, y + 6, T, 2);
        g.fillStyle = 'rgba(255,120,190,0.25)'; g.fillRect(x, y + 3, T, 9);
        props.neon.push({ x: x, y: y + 6, w: T, h: 2, col: '#ff8fd0', phase: rand() * 7 });
      }
    }

    // traffic lights where two avenues cross
    M.AVENUES.forEach(function (a) {
      M.AVENUES.forEach(function (bAv) {
        if (a.axis !== 'h' || bAv.axis !== 'v') return;
        var cc = bAv.at, rr = a.at;
        if (cc < bAv.from || cc > bAv.to) return;
        props.lights.push({ x: cc * T + 8, y: rr * T + 8 });
      });
    });

    // grade the plate down to night: the brightest things on screen should
    // be the pills, the people and the hammers, all drawn after this.
    g.fillStyle = 'rgba(18,14,42,0.34)';
    g.fillRect(0, 0, M.W, M.H);
    var vig = g.createRadialGradient(M.W / 2, M.H / 2, M.H * 0.3, M.W / 2, M.H / 2, M.H * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vig;
    g.fillRect(0, 0, M.W, M.H);

    return { img: b.c, props: props, district: D };
  }

  /** Pills live on their own layer: eating one is a single clearRect. */
  function pillLayer(grid, sprites) {
    var b = canvas(M.W, M.H), g = b.g;
    g.imageSmoothingEnabled = false;
    for (var r = 0; r < M.ROWS; r++) {
      for (var c = 0; c < M.COLS; c++) {
        var t = grid[r][c];
        if (t !== M.PILL && t !== M.PARKPILL) continue;
        g.drawImage(sprites.PILL, c * T + (T - 8) / 2, r * T + (T - 6) / 2);
      }
    }
    return b.c;
  }

  /** Night sky and a distant skyline, used behind the HUD. */
  function skyline(w, h, level, band) {
    var D = districtFor(level);
    var rand = rng(0x51ce + level * 104729);
    band = Math.min(h, band || h);
    var b = canvas(w, h), g = b.g, i;
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#05060f');
    grd.addColorStop(0.5, D.sky[0]);
    grd.addColorStop(1, D.sky[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    for (i = 0; i < Math.round(w * h / 900); i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.12 + rand() * 0.5).toFixed(2) + ')';
      g.fillRect(rand() * w | 0, rand() * Math.max(1, h - band * 0.8) | 0, 1, 1);
    }
    var mx = w - 40, my = 16, mr = 8;
    var mg = g.createRadialGradient(mx, my, 1, mx, my, mr * 3);
    mg.addColorStop(0, 'rgba(246,238,222,0.28)');
    mg.addColorStop(1, 'rgba(246,238,222,0)');
    g.fillStyle = mg;
    g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
    for (var yy = -mr; yy <= mr; yy++) {
      var half = Math.round(Math.sqrt(mr * mr - yy * yy));
      g.fillStyle = '#f6eede';
      g.fillRect(mx - half, my + yy, half * 2, 1);
    }
    g.fillStyle = '#ddd2bd';
    g.fillRect(mx + 1, my - 3, 3, 3);
    g.fillRect(mx - 4, my + 2, 2, 2);

    var x = -4;
    while (x < w) {
      var bw = 9 + (rand() * 18 | 0);
      var bh = 12 + (rand() * (band - 14) | 0);
      g.fillStyle = rand() < 0.5 ? mix(D.sky[1], '#000000', 0.45) : mix(D.sky[1], '#000000', 0.62);
      g.fillRect(x, h - bh, bw, bh);
      if (rand() < 0.22) {                      // a spire
        g.fillRect(x + (bw >> 1) - 1, h - bh - 7, 2, 7);
      }
      for (var wy = h - bh + 3; wy < h - 2; wy += 4) {
        for (var wx = x + 2; wx < x + bw - 2; wx += 3) {
          if (rand() < 0.28) {
            g.fillStyle = rand() < 0.7 ? 'rgba(255,208,122,0.7)' : 'rgba(120,220,255,0.7)';
            g.fillRect(wx, wy, 1, 2);
          }
        }
      }
      x += bw + 1 + (rand() * 3 | 0);
    }
    return b.c;
  }

  BP.city = {
    build: build, pillLayer: pillLayer, skyline: skyline,
    districtFor: districtFor, isBoss: isBoss, DISTRICTS: DISTRICTS,
    canvas: canvas, rng: rng
  };
})(window.BP = window.BP || {});
