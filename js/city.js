/* ------------------------------------------------------------------
   city.js -- bakes the maze into a city: buildings with lit windows
   and neon trim, asphalt streets with markings, lamp pools and
   puddles that catch the neon.  Rendered once per level.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var M = BP.maze, S = BP.sprites;
  var T = M.TILE;

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  // Neon accent per level, cycled.
  var NEON = [
    { hot: '#4de1ff', dim: '#1b6f8c', glow: '77,225,255' },
    { hot: '#ff5bd0', dim: '#8c1b6f', glow: '255,91,208' },
    { hot: '#8cff5b', dim: '#3d8c1b', glow: '140,255,91' },
    { hot: '#ffb44d', dim: '#8c5c1b', glow: '255,180,77' },
    { hot: '#b47dff', dim: '#5a2f8c', glow: '180,125,255' }
  ];
  function neonFor(level) { return NEON[(level - 1) % NEON.length]; }

  var FACADE = ['#171b28', '#131624', '#1c2131', '#101320'];
  var WINDOW_LIT = ['#c9a15e', '#c9a15e', '#6f9fba', '#a8749a'];

  function isWall(grid, c, r) {
    if (c < 0 || c >= M.COLS || r < 0 || r >= M.ROWS) return true;
    var t = grid[r][c];
    return t === M.WALL || t === M.GATE;
  }

  /** Bake the streets, then the buildings, then the neon bleed. */
  function build(grid, level) {
    var rand = rng(0x9e37 + level * 7919);
    var neon = neonFor(level);
    var b = S.canvas(M.W, M.H), g = b.g;
    var c, r, x, y, i;

    // ---- asphalt ------------------------------------------------
    g.fillStyle = '#0b0d14';
    g.fillRect(0, 0, M.W, M.H);
    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        if (isWall(grid, c, r)) continue;
        x = c * T; y = r * T;
        g.fillStyle = '#12151f';
        g.fillRect(x, y, T, T);
        // grit
        var n = 5 + (rand() * 5 | 0);
        for (i = 0; i < n; i++) {
          g.fillStyle = rand() < 0.5 ? '#171b28' : '#0d1018';
          g.fillRect(x + (rand() * T | 0), y + (rand() * T | 0), 1, 1);
        }
        var roll = rand();
        if (roll < 0.055) {                       // manhole
          g.fillStyle = '#1d2130';
          g.fillRect(x + 4, y + 5, 8, 6);
          g.fillStyle = '#272c3e';
          g.fillRect(x + 5, y + 6, 6, 4);
          g.fillStyle = '#141824';
          g.fillRect(x + 6, y + 7, 4, 1);
          g.fillRect(x + 6, y + 9, 4, 1);
        } else if (roll < 0.10) {                 // crack
          g.fillStyle = '#0a0c12';
          var cx = x + 3 + (rand() * 8 | 0), cy = y + 2;
          for (i = 0; i < 9; i++) { g.fillRect(cx, cy + i, 1, 1); cx += rand() < 0.5 ? 1 : -1; }
        } else if (roll < 0.14) {                 // painted lane dash
          g.fillStyle = 'rgba(220,200,120,0.16)';
          g.fillRect(x + 7, y + 3, 2, 10);
        }
      }
    }

    // ---- buildings ----------------------------------------------
    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        if (!isWall(grid, c, r)) continue;
        x = c * T; y = r * T;
        var face = FACADE[(c * 7 + r * 13) & 3];
        g.fillStyle = face;
        g.fillRect(x, y, T, T);
        // brick banding
        g.fillStyle = 'rgba(255,255,255,0.02)';
        g.fillRect(x, y + 5, T, 1);
        g.fillRect(x, y + 11, T, 1);
        // a third of the blocks are blank concrete, which quiets the grid
        var solid = ((c * 5 + r * 11) % 3) === 0;
        // windows (3x3 grid of 3px panes)
        for (var wy = 0; wy < 3; wy++) {
          for (var wx = 0; wx < 3; wx++) {
            var px = x + 2 + wx * 5, py = y + 2 + wy * 5;
            var lit = !solid && rand() < 0.15;
            g.fillStyle = '#0a0c13';
            g.fillRect(px, py, 3, 3);
            if (lit) {
              g.fillStyle = WINDOW_LIT[(c + r + wx + wy) & 3];
              g.fillRect(px + 1, py, 2, 3);
              g.fillStyle = 'rgba(255,255,255,0.30)';
              g.fillRect(px + 1, py, 1, 1);
            } else if (rand() < 0.3) {
              g.fillStyle = 'rgba(120,150,220,0.055)';
              g.fillRect(px, py, 3, 3);
            }
          }
        }
      }
    }

    // ---- neon trim + wet reflection ------------------------------
    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        if (!isWall(grid, c, r)) continue;
        x = c * T; y = r * T;
        var up = !isWall(grid, c, r - 1), dn = !isWall(grid, c, r + 1),
            lf = !isWall(grid, c - 1, r), rt = !isWall(grid, c + 1, r);
        g.fillStyle = neon.hot;
        if (up) g.fillRect(x + (lf ? 1 : 0), y, T - (lf ? 1 : 0) - (rt ? 1 : 0), 1);
        if (dn) g.fillRect(x + (lf ? 1 : 0), y + T - 1, T - (lf ? 1 : 0) - (rt ? 1 : 0), 1);
        if (lf) g.fillRect(x, y + (up ? 1 : 0), 1, T - (up ? 1 : 0) - (dn ? 1 : 0));
        if (rt) g.fillRect(x + T - 1, y + (up ? 1 : 0), 1, T - (up ? 1 : 0) - (dn ? 1 : 0));
        g.fillStyle = neon.dim;
        if (up) g.fillRect(x + 1, y + 1, T - 2, 1);
        if (dn) g.fillRect(x + 1, y + T - 2, T - 2, 1);
        if (lf) g.fillRect(x + 1, y + 1, 1, T - 2);
        if (rt) g.fillRect(x + T - 2, y + 1, 1, T - 2);
        // corner dots so junctions read as clean pixel corners
        g.fillStyle = neon.hot;
        if (up && lf) g.fillRect(x + 1, y + 1, 1, 1);
        if (up && rt) g.fillRect(x + T - 2, y + 1, 1, 1);
        if (dn && lf) g.fillRect(x + 1, y + T - 2, 1, 1);
        if (dn && rt) g.fillRect(x + T - 2, y + T - 2, 1, 1);
        // glow spilling onto the wet street
        for (i = 1; i <= 3; i++) {
          g.fillStyle = 'rgba(' + neon.glow + ',' + (0.13 - i * 0.035) + ')';
          if (up) g.fillRect(x, y - i, T, 1);
          if (dn) g.fillRect(x, y + T - 1 + i, T, 1);
          if (lf) g.fillRect(x - i, y, 1, T);
          if (rt) g.fillRect(x + T - 1 + i, y, 1, T);
        }
      }
    }

    // ---- the alley gate -----------------------------------------
    for (r = 0; r < M.ROWS; r++) {
      for (c = 0; c < M.COLS; c++) {
        if (grid[r][c] !== M.GATE) continue;
        g.fillStyle = '#0b0d14';
        g.fillRect(c * T, r * T, T, T);
        g.fillStyle = '#ff9de0';
        g.fillRect(c * T, r * T + 6, T, 3);
        g.fillStyle = 'rgba(255,157,224,0.25)';
        g.fillRect(c * T, r * T + 4, T, 7);
      }
    }

    // ---- streetlamp pools ---------------------------------------
    var lamps = [];
    for (r = 2; r < M.ROWS - 2; r++) {
      for (c = 2; c < M.COLS - 2; c++) {
        if (isWall(grid, c, r) || rand() > 0.035) continue;
        lamps.push([c * T + T / 2, r * T + T / 2]);
      }
    }
    lamps.forEach(function (p) {
      var rad = 34;
      var gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
      gr.addColorStop(0, 'rgba(255,226,160,0.16)');
      gr.addColorStop(0.5, 'rgba(255,214,140,0.06)');
      gr.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = gr;
      g.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2);
      g.fillStyle = 'rgba(255,236,190,0.5)';
      g.fillRect(p[0] - 1, p[1] - 1, 2, 2);
    });

    return b.c;
  }

  /** Pills live on their own layer so eating one is a single clearRect. */
  function pillLayer(grid) {
    var b = S.canvas(M.W, M.H), g = b.g;
    g.imageSmoothingEnabled = false;
    for (var r = 0; r < M.ROWS; r++) {
      for (var c = 0; c < M.COLS; c++) {
        if (grid[r][c] !== M.PILL) continue;
        g.drawImage(S.PILL, c * T + (T - 8) / 2, r * T + (T - 6) / 2);
      }
    }
    return b.c;
  }

  /** Night sky + distant skyline, used behind the HUD strips. */
  function skyline(w, h, level, band) {
    var rand = rng(0x51ce + level * 104729);
    band = Math.min(h, band || h);
    var b = S.canvas(w, h), g = b.g;
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0a0a18');
    grd.addColorStop(0.55, '#141033');
    grd.addColorStop(1, '#2a1140');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    var i;
    for (i = 0; i < Math.round(w * h / 900); i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.15 + rand() * 0.6).toFixed(2) + ')';
      g.fillRect(rand() * w | 0, rand() * (h - band * 0.8) | 0, 1, 1);
    }
    // moon
    var mx = w - 40, my = 16, mr = 8;
    var mg = g.createRadialGradient(mx, my, 1, mx, my, mr * 3);
    mg.addColorStop(0, 'rgba(246,238,222,0.30)');
    mg.addColorStop(1, 'rgba(246,238,222,0)');
    g.fillStyle = mg;
    g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
    for (var my2 = -mr; my2 <= mr; my2++) {
      var half = Math.round(Math.sqrt(mr * mr - my2 * my2));
      g.fillStyle = '#f6eede';
      g.fillRect(mx - half, my + my2, half * 2, 1);
    }
    g.fillStyle = '#ddd2bd';
    g.fillRect(mx + 1, my - 3, 3, 3);
    g.fillRect(mx - 4, my + 2, 2, 2);
    g.fillRect(mx + 3, my + 3, 2, 2);
    // far towers
    var x = -4;
    while (x < w) {
      var bw = 8 + (rand() * 16 | 0);
      var bh = 10 + (rand() * (band - 12) | 0);
      g.fillStyle = rand() < 0.5 ? '#171436' : '#120f2b';
      g.fillRect(x, h - bh, bw, bh);
      for (var wy = h - bh + 3; wy < h - 2; wy += 4) {
        for (var wx = x + 2; wx < x + bw - 2; wx += 3) {
          if (rand() < 0.3) {
            g.fillStyle = rand() < 0.7 ? 'rgba(255,214,140,0.75)' : 'rgba(120,220,255,0.75)';
            g.fillRect(wx, wy, 1, 2);
          }
        }
      }
      x += bw + 1 + (rand() * 3 | 0);
    }
    return b.c;
  }

  BP.city = { build: build, pillLayer: pillLayer, skyline: skyline, neonFor: neonFor, rng: rng };
})(window.BP = window.BP || {});
