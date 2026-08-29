/* ------------------------------------------------------------------
   sprites.js -- pickups and props.  People live in human.js, cars in
   traffic.js; this is everything you can pick up off the pavement.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

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
  /** Build a sprite from an ASCII block; '.' is transparent. */
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

  var PILL = art([
    '..####..',
    '.#OOOO#.',
    '#OwOOOo#',
    '#OOOOOo#',
    '.#OOOO#.',
    '..####..'
  ], { '#': '#a476ff', 'O': '#150f24', 'o': '#2a1f42', 'w': '#f0e6ff' });

  // The hammer power-up: a framing hammer with a claw, so it reads at 14px.
  var HAMMER = art([
    '..............',
    '..SSSSSSSSS...',
    '.SWWWWWWWWWSS.',
    '.SWddWWWWddWSS',
    '.SWddWWWWddWS.',
    '.SWWWWWWWWWS..',
    '..SSSSSSSSS...',
    '...ss...ss....',
    '......HH......',
    '......Hh......',
    '.....GHhG.....',
    '.....GHhG.....',
    '......Hh......',
    '......hh......'
  ], { 'S': '#f2f6ff', 'W': '#9fabc6', 'd': '#4a5162', 's': '#6b7488',
       'h': '#7a4c26', 'H': '#b57a44', 'G': '#3a2b1c' });

  var PAL = {
    k: '#141822', w: '#ffffff', g: '#ffd75e', G: '#b98c1e', r: '#ff5b7a',
    s: '#aeb8d0', S: '#e8eefc', d: '#5b6478', b: '#8a5a30', B: '#b57a44',
    c: '#7cf5d0', p: '#c77dff', e: '#4de1ff', n: '#2f7fb8', t: '#6b3a2e'
  };

  // Bonus pickups.  `psl` is what each one is worth on the rating.
  var ITEMS = [
    { name: 'GYM PASS', points: 300, psl: 0.12, art: [
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
    { name: 'MOGGER SHADES', points: 500, psl: 0.18, art: [
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
    { name: 'CHIN CHISEL', points: 800, psl: 0.28, art: [
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
    { name: 'GOLD HAMMER', points: 1500, psl: 0.35, art: [
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
    { name: 'CITY CROWN', points: 3000, psl: 0.6, art: [
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

  var itemCache = {};
  function item(i) {
    if (!itemCache[i]) itemCache[i] = art(ITEMS[i].art, PAL);
    return itemCache[i];
  }

  /** A soft contact shadow, so people and props sit on the pavement. */
  var shadowCache = {};
  function shadow(w) {
    if (shadowCache[w]) return shadowCache[w];
    var b = canvas(w, 5), g = b.g;
    var gr = g.createRadialGradient(w / 2, 2.5, 0, w / 2, 2.5, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, 5);
    shadowCache[w] = b.c;
    return b.c;
  }

  BP.sprites = {
    canvas: canvas, rect: rect, art: art,
    PILL: PILL, HAMMER: HAMMER, ITEMS: ITEMS, item: item, shadow: shadow
  };
})(window.BP = window.BP || {});
