/* ------------------------------------------------------------------
   maze.js -- the city block plan.

     '#' building      '.' black pill on the sidewalk
     'o' hammer        '-' club door        ' ' bare street
     ',' park path with a pill   ';' bare park path   'T' tree

   Long uninterrupted runs are AVENUES: traffic drives down them.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var RAW = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '     #.##### ## #####.#     ',
    '     #.##          ##.#     ',
    '     #.## ###--### ##.#     ',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.####      ####.######',
    '     #.,,,########,,,.#     ',
    '     #.,,TT,,TT,,TT,,.#     ',
    '     #.,,,TT,,,TT,,,,.#     ',
    '######.##############.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################'
  ];

  var EMPTY = 0, WALL = 1, PILL = 2, HAMMER = 3, GATE = 4, PARK = 5, TREE = 6, PARKPILL = 7;

  var COLS = 28, ROWS = 31, TILE = 16;

  function build() {
    var grid = [], pills = 0, r, c;
    for (r = 0; r < ROWS; r++) {
      var row = [];
      for (c = 0; c < COLS; c++) {
        var ch = RAW[r].charAt(c);
        var v = EMPTY;
        if (ch === '#') v = WALL;
        else if (ch === '.') { v = PILL; pills++; }
        else if (ch === 'o') { v = HAMMER; pills++; }
        else if (ch === '-') v = GATE;
        else if (ch === 'T') v = TREE;
        else if (ch === ';') v = PARK;
        else if (ch === ',') { v = PARKPILL; pills++; }
        row.push(v);
      }
      grid.push(row);
    }
    return { grid: grid, pills: pills };
  }

  /** Static terrain lookup -- what the tile is regardless of pickups. */
  function terrain(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return EMPTY;
    var ch = RAW[r].charAt(c);
    if (ch === 'T') return TREE;
    if (ch === ',' || ch === ';') return PARK;
    if (ch === '#') return WALL;
    if (ch === '-') return GATE;
    return EMPTY;
  }

  var TUNNEL_ROW = 14;

  function tileAt(grid, c, r) {
    if (r < 0 || r >= ROWS) return WALL;
    if (c < 0 || c >= COLS) return (r === TUNNEL_ROW) ? EMPTY : WALL;
    return grid[r][c];
  }

  /** Can a walker stand here?  `gate` = allowed through the club door. */
  function open(grid, c, r, gate) {
    var t = tileAt(grid, c, r);
    if (t === WALL || t === TREE) return false;
    if (t === GATE) return !!gate;
    return true;
  }

  function isPark(c, r) { return terrain(c, r) === PARK; }

  // Traffic runs these straight shots.  dir is the axis; `at` is the row
  // (for 'h') or column (for 'v'); span is the open stretch.
  var AVENUES = [
    { axis: 'h', at: 5,  from: 1, to: 26, name: 'FIFTH AVE' },
    { axis: 'h', at: 29, from: 1, to: 26, name: 'CANAL ST' },
    { axis: 'v', at: 6,  from: 1, to: 26, name: 'BROADWAY' },
    { axis: 'v', at: 21, from: 1, to: 26, name: 'PARK AVE' }
  ];

  function onAvenue(c, r) {
    for (var i = 0; i < AVENUES.length; i++) {
      var a = AVENUES[i];
      if (a.axis === 'h' && r === a.at && c >= a.from && c <= a.to) return a;
      if (a.axis === 'v' && c === a.at && r >= a.from && r <= a.to) return a;
    }
    return null;
  }

  BP.maze = {
    RAW: RAW,
    COLS: COLS, ROWS: ROWS, TILE: TILE,
    W: COLS * TILE, H: ROWS * TILE,
    EMPTY: EMPTY, WALL: WALL, PILL: PILL, HAMMER: HAMMER,
    GATE: GATE, PARK: PARK, TREE: TREE, PARKPILL: PARKPILL,
    TUNNEL_ROW: TUNNEL_ROW, AVENUES: AVENUES,
    build: build, tileAt: tileAt, open: open, terrain: terrain,
    isPark: isPark, onAvenue: onAvenue,

    playerSpawn: { c: 13.5, r: 23 },
    gate: { c: 13.5, r: 12 },
    clubCenter: { c: 13.5, r: 14 },
    bonusSpot: { c: 13.5, r: 17 },        // in the park
    rivalSpawns: [
      { c: 13.5, r: 11 },
      { c: 13.5, r: 14 },
      { c: 11.5, r: 14 },
      { c: 15.5, r: 14 }
    ],
    scatterTargets: [
      { c: 25, r: 0 }, { c: 2, r: 0 }, { c: 27, r: 30 }, { c: 0, r: 30 }
    ]
  };
})(window.BP = window.BP || {});
