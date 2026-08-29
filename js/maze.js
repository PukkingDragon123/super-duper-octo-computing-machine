/* ------------------------------------------------------------------
   maze.js -- the city block layout.
   '#' building   '.' black pill   'o' hammer   '-' alley gate
   ' ' open asphalt (no pill)
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
    '     #.##############.#     ',
    '     #.##############.#     ',
    '     #.##############.#     ',
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

  var EMPTY = 0, WALL = 1, PILL = 2, HAMMER = 3, GATE = 4;

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
        row.push(v);
      }
      grid.push(row);
    }
    return { grid: grid, pills: pills };
  }

  // Tunnel row: entities wrap horizontally here.
  var TUNNEL_ROW = 14;

  function tileAt(grid, c, r) {
    if (r < 0 || r >= ROWS) return WALL;
    if (c < 0 || c >= COLS) return (r === TUNNEL_ROW) ? EMPTY : WALL;
    return grid[r][c];
  }

  /** Can a walker occupy this tile? `gate` = may pass through the alley gate. */
  function open(grid, c, r, gate) {
    var t = tileAt(grid, c, r);
    if (t === WALL) return false;
    if (t === GATE) return !!gate;
    return true;
  }

  BP.maze = {
    RAW: RAW,
    COLS: COLS, ROWS: ROWS, TILE: TILE,
    W: COLS * TILE, H: ROWS * TILE,
    EMPTY: EMPTY, WALL: WALL, PILL: PILL, HAMMER: HAMMER, GATE: GATE,
    TUNNEL_ROW: TUNNEL_ROW,
    build: build, tileAt: tileAt, open: open,

    // Spawn points, in tile coordinates (fractional = between two tiles).
    playerSpawn: { c: 13.5, r: 23 },
    gate: { c: 13.5, r: 12 },
    houseCenter: { c: 13.5, r: 14 },
    bonusSpot: { c: 13.5, r: 23 },
    rivalSpawns: [
      { c: 13.5, r: 11 },   // ENVY  -- starts on the roof of the alley
      { c: 13.5, r: 14 },   // SMIRK
      { c: 11.5, r: 14 },   // SHADE
      { c: 15.5, r: 14 }    // LURK
    ],
    scatterTargets: [
      { c: 25, r: 0 }, { c: 2, r: 0 }, { c: 27, r: 30 }, { c: 0, r: 30 }
    ]
  };
})(window.BP = window.BP || {});
