/* ------------------------------------------------------------------
   sprites.js -- every drawable thing, pre-rendered to tiny canvases
   at 1 art-pixel : 1 canvas-pixel and blitted with smoothing off.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var F = BP.face;

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g };
  }
  function rect(g, x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  /** Build a sprite from an ASCII art block. '.' is transparent. */
  function art(rows, pal) {
    var h = rows.length, w = rows[0].length;
    var b = canvas(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y].charAt(x);
        if (ch === '.' || ch === ' ') continue;
        rect(b.g, x, y, 1, 1, pal[ch]);
      }
    }
    return b.c;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ================================================================
     BP MAN
     ================================================================ */
  var PW = 28, PH = 34;         // sprite box
  var ANCHOR_X = 14, ANCHOR_Y = 19;

  var SHIRT = [
    { base: '#5a6690', dark: '#3b4467', hi: '#7f8cb5' },
    { base: '#4d5878', dark: '#333b55', hi: '#6a7699' },
    { base: '#262a36', dark: '#15171f', hi: '#3a404f' },
    { base: '#1d1f28', dark: '#0e1015', hi: '#33374a' },
    { base: '#eceef6', dark: '#a9adc0', hi: '#ffffff' }
  ];

  function body(g, tier, frame, view) {
    var t = tier / 4;
    var sk = F.C, sh = SHIRT[tier];
    var sw = Math.round(lerp(7, 11, t));      // shoulder half-width
    var top = 22;
    var bob = frame ? 1 : 0;

    // legs first so the torso overlaps them
    var la = frame ? 1 : -1;
    rect(g, 10, 30 + bob, 4, 4 + la, '#2b2f3d');
    rect(g, 15, 30 + bob, 4, 4 - la, '#2b2f3d');
    rect(g, 10, 33, 5, 1, '#14161d');
    rect(g, 15, 33, 5, 1, '#14161d');

    // shoulders / traps
    rect(g, ANCHOR_X - sw, top + bob, sw * 2, 4, sh.base);
    rect(g, ANCHOR_X - sw, top + bob, sw * 2, 1, sh.hi);
    if (tier >= 3) {                            // delt caps
      rect(g, ANCHOR_X - sw, top + 1 + bob, 3, 3, sh.hi);
      rect(g, ANCHOR_X + sw - 3, top + 1 + bob, 3, 3, sh.dark);
    }
    // torso
    var tw = sw - (view === 'side' ? 3 : 1);
    rect(g, ANCHOR_X - tw, top + 4 + bob, tw * 2, 6, sh.base);
    rect(g, ANCHOR_X + tw - 2, top + 4 + bob, 2, 6, sh.dark);
    rect(g, ANCHOR_X - tw, top + 4 + bob, 1, 6, sh.hi);

    // arms
    var swingA = frame ? -1 : 1;
    if (view === 'side') {
      rect(g, ANCHOR_X - 2, top + 3 + bob + swingA, 4, 7, sk.mid);
      rect(g, ANCHOR_X - 2, top + 3 + bob + swingA, 1, 7, sk.sh);
    } else {
      rect(g, ANCHOR_X - sw - 1, top + 3 + bob + swingA, 3, 7, sk.mid);
      rect(g, ANCHOR_X + sw - 2, top + 3 + bob - swingA, 3, 7, sk.mid);
      rect(g, ANCHOR_X + sw - 1, top + 3 + bob - swingA, 2, 7, sk.sh);
    }

    if (tier === 4 && view !== 'back') {        // the chain
      rect(g, ANCHOR_X - 4, top + 4 + bob, 8, 1, '#f5c542');
      rect(g, ANCHOR_X - 5, top + 5 + bob, 2, 1, '#f5c542');
      rect(g, ANCHOR_X + 3, top + 5 + bob, 2, 1, '#f5c542');
      rect(g, ANCHOR_X - 1, top + 6 + bob, 2, 2, '#ffe07a');
    }
  }

  var playerCache = {};
  /**
   * @param view 'front'|'back'|'side'
   * @param state 'walk'|'mog'|'soy'
   */
  function player(view, tier, frame, mouth, state) {
    var key = view + tier + frame + mouth + state;
    var hit = playerCache[key];
    if (hit) return hit;

    var b = canvas(PW, PH);
    body(b.g, tier, frame, view);

    var head = canvas(F.W, F.H);
    F.draw(head.g, view, tier, { mouth: mouth, soy: state === 'soy' });
    b.g.drawImage(head.c, (PW - F.W) / 2, 0);

    if (state === 'mog') {
      // an aura rim so he reads as powered up
      b.g.globalCompositeOperation = 'source-atop';
      b.g.fillStyle = 'rgba(255,196,64,0.16)';
      b.g.fillRect(0, 0, PW, PH);
      b.g.globalCompositeOperation = 'source-over';
    }
    playerCache[key] = b.c;
    return b.c;
  }

  // Hammer poses: 0 shouldered, 1 raised, 2 swung down.
  var HAM_PAL = { w: '#8a5a30', W: '#b57a44', s: '#9aa3b5', S: '#cfd6e4', d: '#4a5162', g: '#ffd75e' };
  var hammerCache = {};
  function hammer(pose) {
    if (hammerCache[pose]) return hammerCache[pose];
    var rows;
    if (pose === 0) rows = [
      '....SSSSs...',
      '...SSSSSSs..',
      '...SdddddS..',
      '...SSSSSSs..',
      '....sssss...',
      '.....Ww.....',
      '.....Ww.....',
      '.....Ww.....',
      '.....Ww.....',
      '.....Ww.....',
      '.....ww.....',
      '............'
    ];
    else if (pose === 1) rows = [
      '..gSSSSSSg..',
      '.gSSSSSSSSg.',
      '..SdddddddS.',
      '..SSSSSSSSs.',
      '...sssssss..',
      '.....Ww.....',
      '.....Ww.....',
      '.....Ww.....',
      '.....ww.....',
      '............',
      '............',
      '............'
    ];
    else rows = [
      '............',
      '.........Ww.',
      '........Ww..',
      '.......Ww...',
      '......Ww....',
      '.....Ww.....',
      '..gSSSSg....',
      '.gSSSSSSg...',
      '.SdddddS....',
      '.SSSSSSs....',
      '..sssss.....',
      '............'
    ];
    hammerCache[pose] = art(rows, HAM_PAL);
    return hammerCache[pose];
  }

  /* ================================================================
     RIVALS -- the haters
     ================================================================ */
  var RW = 26, RH = 28;
  var DOME = [5, 7, 8, 9, 10, 11, 11, 12, 12, 12, 13, 13, 13];

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, Math.round((n >> 16 & 255) * f)));
    var g = Math.min(255, Math.max(0, Math.round((n >> 8 & 255) * f)));
    var b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function silhouette(g, col, frame) {
    var cx = 13, y, x, hw;
    for (y = 0; y < 23; y++) {
      hw = y < DOME.length ? DOME[y] : 13;
      rect(g, cx - hw, y, hw * 2, 1, col);
    }
    // skirt: triangular wave, 4 lobes, phase flips per frame
    var off = frame ? 3.25 : 0;
    for (x = 0; x < RW; x++) {
      var u = (((x + off) % 6.5) / 6.5);
      var tri = 1 - Math.abs(2 * u - 1);
      var depth = Math.round(4 * tri);
      rect(g, x, 23, 1, depth + 1, col);
    }
  }

  function eyes(g, dx, dy, sclera, pupil, wide) {
    var ex = wide ? 6 : 6, ey = 11;
    var sw = wide ? 7 : 6, shh = wide ? 7 : 7;
    rect(g, ex, ey, sw, shh, sclera);
    rect(g, RW - ex - sw, ey, sw, shh, sclera);
    rect(g, ex + 1, ey - 1, sw - 2, 1, sclera);
    rect(g, RW - ex - sw + 1, ey - 1, sw - 2, 1, sclera);
    var px = Math.round(2 + dx * 2), py = Math.round(2 + dy * 2);
    var ps = wide ? 2 : 3;
    rect(g, ex + px, ey + py, ps, ps + 1, pupil);
    rect(g, RW - ex - sw + px, ey + py, ps, ps + 1, pupil);
  }

  var rivalCache = {};
  /**
   * @param kind 0..3 (colour) | state 'hunt'|'cooked'|'flash'|'eyes'
   */
  function rival(kind, state, frame, dx, dy) {
    var key = kind + state + frame + dx + dy;
    if (rivalCache[key]) return rivalCache[key];
    var b = canvas(RW, RH), g = b.g;
    var COLORS = ['#ff4d4d', '#ff8fd0', '#4de1ff', '#ffab4d'];
    var base = COLORS[kind];

    if (state === 'eyes') {
      eyes(g, dx, dy, '#f2f7ff', '#2a4fd8', false);
      rect(g, 5, 10, 1, 9, 'rgba(120,180,255,0.35)');
      rect(g, 20, 10, 1, 9, 'rgba(120,180,255,0.35)');
    } else if (state === 'cooked' || state === 'flash') {
      var bc = state === 'flash' ? '#ffffff' : '#3f4fd6';
      var ac = state === 'flash' ? '#ff5b7a' : '#9fb4ff';
      silhouette(g, bc, frame);
      g.globalCompositeOperation = 'source-atop';
      rect(g, 0, 4, RW, 3, shade(bc, 1.25));
      rect(g, 16, 0, 10, RH, shade(bc, 0.85));
      g.globalCompositeOperation = 'source-over';
      // panicked eyes + wobbling mouth
      rect(g, 6, 10, 5, 5, '#ffffff'); rect(g, 15, 10, 5, 5, '#ffffff');
      rect(g, 8, 12, 2, 2, '#101426'); rect(g, 17, 12, 2, 2, '#101426');
      rect(g, 5, 9, 6, 1, ac); rect(g, 15, 9, 6, 1, ac);
      var mo = frame ? 0 : 1;
      for (var i = 0; i < 5; i++) rect(g, 6 + i * 3, 18 + ((i + mo) % 2), 3, 2, ac);
      rect(g, 21, 8, 2, 3, '#8fd6ff');        // sweat bead
      rect(g, 21, 11, 2, 1, '#d8f2ff');
    } else {
      silhouette(g, base, frame);
      g.globalCompositeOperation = 'source-atop';
      rect(g, 14, 0, 12, RH, shade(base, 0.8));     // right-side shading
      rect(g, 22, 0, 4, RH, shade(base, 0.66));
      var y, hw;
      for (y = 0; y < 23; y++) {                    // left highlight
        hw = y < DOME.length ? DOME[y] : 13;
        rect(g, 13 - hw, y, 2, 1, shade(base, 1.2));
      }
      // hood pulled over the dome
      rect(g, 0, 3, RW, 6, shade(base, 0.55));
      rect(g, 0, 0, RW, 4, shade(base, 0.55));
      rect(g, 0, 9, RW, 1, shade(base, 0.4));
      rect(g, 0, 2, RW, 1, shade(base, 0.75));
      g.globalCompositeOperation = 'source-over';
      eyes(g, dx, dy, '#fdfdff', '#141822', false);
      // smug slanted brows
      rect(g, 6, 9, 6, 2, shade(base, 0.35));
      rect(g, 14, 9, 6, 2, shade(base, 0.35));
      rect(g, 10, 10, 2, 1, shade(base, 0.35));
      rect(g, 14, 10, 2, 1, shade(base, 0.35));
      // smirk
      rect(g, 9, 20, 7, 1, shade(base, 0.4));
      rect(g, 15, 19, 2, 1, shade(base, 0.4));
      // per-rival tell
      if (kind === 0) { rect(g, 1, 6, 8, 2, '#c62828'); rect(g, 1, 6, 8, 1, '#ef5350'); }
      else if (kind === 1) { rect(g, 2, 8, 3, 9, '#ffd9ef'); rect(g, 21, 8, 3, 9, '#ffd9ef'); }
      else if (kind === 2) { rect(g, 0, 8, 3, 6, '#1c2233'); rect(g, 23, 8, 3, 6, '#1c2233'); rect(g, 2, 5, 22, 2, '#1c2233'); }
      else { rect(g, 8, 0, 10, 3, '#7a4a12'); rect(g, 12, 0, 3, 2, '#ffd75e'); }
    }
    rivalCache[key] = b.c;
    return b.c;
  }

  /* ================================================================
     PICKUPS
     ================================================================ */
  var PILL = art([
    '..####..',
    '.#OOOO#.',
    '#OwOOOo#',
    '#OOOOOo#',
    '.#OOOO#.',
    '..####..'
  ], { '#': '#8b5cf6', 'O': '#140f22', 'o': '#241a38', 'w': '#dcc6ff' });

  var BIGHAM = art([
    '..............',
    '..SSSSSSSSSS..',
    '.SWWWWWWWWWWS.',
    '.SWddWWWWddWS.',
    '.SWddWWWWddWS.',
    '.SWWWWWWWWWWS.',
    '..SSSSSSSSSS..',
    '...ss....ss...',
    '......HH......',
    '......Hh......',
    '......Hh......',
    '.....GHhG.....',
    '.....GHhG.....',
    '......hh......'
  ], { 'S': '#f2f6ff', 'W': '#9fabc6', 'd': '#4a5162', 's': '#6b7488',
       'h': '#7a4c26', 'H': '#b57a44', 'G': '#3a2b1c' });

  var ITEM_PAL = {
    'k': '#141822', 'w': '#ffffff', 'g': '#ffd75e', 'G': '#b98c1e', 'r': '#ff5b7a',
    's': '#aeb8d0', 'S': '#e8eefc', 'd': '#5b6478', 'b': '#8a5a30', 'c': '#7cf5d0',
    'p': '#c77dff', 'e': '#4de1ff'
  };
  var ITEMS = [
    { name: 'GYM', points: 200, art: [
      '..............',
      '..s........s..',
      '.sSs......sSs.',
      '.sSs.dddd.sSs.',
      '.sSssdSSdssSs.',
      '.sSssdSSdssSs.',
      '.sSs.dddd.sSs.',
      '.sSs......sSs.',
      '..s........s..',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............'] },
    { name: 'SHADES', points: 400, art: [
      '..............',
      '..............',
      '.kkkkkkkkkkkk.',
      'kkkkkkkkkkkkkk',
      'kkwkkkkkkwkkkk',
      'kkkkkkkkkkkkkk',
      '.kkkk.kk.kkkk.',
      '..kkk.kk.kkk..',
      '...k......k...',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............'] },
    { name: 'CHISEL', points: 700, art: [
      '..............',
      '.........SSS..',
      '........SSSS..',
      '.......SSSS...',
      '......SSSS....',
      '.....SSSS.....',
      '....bbbb......',
      '...bbbb.......',
      '..bbbb........',
      '..bbb.........',
      '..............',
      '..............',
      '..............',
      '..............'] },
    { name: 'GOLD HAMMER', points: 1200, art: [
      '..............',
      '...gggggggg...',
      '..gGgggggggG..',
      '..gGGGGGGGgG..',
      '..gggggggggG..',
      '...GGGGGGGG...',
      '......bb......',
      '......bB......',
      '......bB......',
      '......bB......',
      '.....BBBB.....',
      '..............',
      '..............',
      '..............'] },
    { name: 'CROWN', points: 2500, art: [
      '..............',
      '..g........g..',
      '..gg..g...gg..',
      '..ggg.gg.ggg..',
      '..gggggggggg..',
      '..gGgGgGgGgG..',
      '..gggggggggg..',
      '..GGGGGGGGGG..',
      '...r.r..r.r...',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............'] }
  ];
  ITEM_PAL.B = '#b57a44';
  var itemCache = {};
  function item(i) {
    if (!itemCache[i]) itemCache[i] = art(ITEMS[i].art, ITEM_PAL);
    return itemCache[i];
  }

  BP.sprites = {
    canvas: canvas, rect: rect, art: art, shade: shade,
    PW: PW, PH: PH, ANCHOR_X: ANCHOR_X, ANCHOR_Y: ANCHOR_Y,
    RW: RW, RH: RH,
    player: player, hammer: hammer, rival: rival,
    PILL: PILL, BIGHAM: BIGHAM, ITEMS: ITEMS, item: item
  };
})(window.BP = window.BP || {});
