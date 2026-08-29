// Headless gameplay assertions.  node tools/playtest.js
const { chromium } = require('playwright');
const path = require('path');

const T = [];
function check(name, ok, detail) { T.push({ name, ok, detail }); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(400);

  const results = await page.evaluate(() => {
    const g = window.BP.game, G = g.state, M = window.BP.maze;
    const out = {};
    const step = (secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) g._update(1 / 60); };

    g._newGame();
    G.state = 'play'; G.stateT = 0;

    // --- 1. rivals all leave the alley -----------------------------
    // Hold the round open: a death would reset the rivals and their timers.
    for (let i = 0; i < 60 * 16; i++) {
      g._update(1 / 60);
      if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; }
    }
    out.modesAfter16 = G.rivals.map(r => r.mode);
    out.allOut = G.rivals.every(r => r.mode !== 'house' && r.mode !== 'leave');

    // --- 2. nobody gets wedged (player moves, so targets keep changing)
    const startPos = G.rivals.map(r => ({ x: r.x, y: r.y }));
    const visited = G.rivals.map(() => new Set());
    const lastTile = G.rivals.map(() => '');
    const runNow = G.rivals.map(() => 0);
    const runMax = G.rivals.map(() => 0);
    const dirList = [g._dirs.LEFT, g._dirs.RIGHT, g._dirs.UP, g._dirs.DOWN];
    for (let i = 0; i < 60 * 45; i++) {
      if (i % 23 === 0) g._setDir(dirList[(Math.random() * 4) | 0]);
      g._update(1 / 60);
      if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; }
      G.rivals.forEach((r, k) => {
        const key = Math.floor(r.x / M.TILE) + ',' + Math.floor(r.y / M.TILE);
        visited[k].add(key);
        // waiting in the alley is not a wedge
        if (r.mode === 'house' || r.mode === 'leave') { runNow[k] = 0; lastTile[k] = ''; return; }
        if (key === lastTile[k]) { runNow[k]++; if (runNow[k] > runMax[k]) runMax[k] = runNow[k]; }
        else { runNow[k] = 0; lastTile[k] = key; }
      });
    }
    out.tilesVisited = visited.map(v => v.size);
    out.allRoam = out.tilesVisited.every(n => n > 50);
    out.longestStallSecs = runMax.map(n => +(n / 60).toFixed(2));
    out.noStall = runMax.every(n => n < 60 * 2.5);
    out.moved = G.rivals.map((r, k) => Math.hypot(r.x - startPos[k].x, r.y - startPos[k].y) > 8);

    // --- 3. the player eats pills and gains aura -------------------
    g._newGame(); G.state = 'play';
    const pills0 = G.pillsLeft;
    const seq = [g._dirs.LEFT, g._dirs.UP, g._dirs.RIGHT, g._dirs.DOWN, g._dirs.RIGHT, g._dirs.UP];
    for (const d of seq) { g._setDir(d); step(1.6); }
    out.pillsEaten = pills0 - G.pillsLeft;
    out.auraGained = G.aura;
    out.scored = G.score;

    // --- 4. hammer -> cooked -> mog --------------------------------
    g._newGame(); G.state = 'play';
    G.grid[3][1] = M.HAMMER;
    G.player.x = (1 + 0.5) * M.TILE; G.player.y = (3 + 0.5) * M.TILE;
    step(0.05);
    out.mogModeOn = G.mogTimer > 0;
    out.rivalsCooked = G.rivals.filter(r => r.mode === 'cooked').length;

    const victim = G.rivals[0];
    victim.mode = 'cooked';
    victim.x = G.player.x; victim.y = G.player.y;
    const score0 = G.score, mogs0 = G.mogs;
    step(0.05);
    out.mogScored = G.score - score0;
    out.mogCounted = G.mogs - mogs0;
    out.victimMode = victim.mode;

    // --- 5. aura burst clears the block ----------------------------
    g._newGame(); G.state = 'play';
    G.aura = 100;
    G.rivals.forEach((r, i) => { r.mode = 'roam'; r.x = G.player.x + i * 6; r.y = G.player.y; });
    const mogs1 = G.mogs;
    g._fireAura();
    step(1.0);
    out.burstMogs = G.mogs - mogs1;
    out.auraSpent = G.aura;

    // --- 6. tier ascension fires -----------------------------------
    g._newGame(); G.state = 'play';
    G.mogs = 0; G.tier = 0;
    for (let i = 0; i < 24; i++) {
      const r = G.rivals[i % 4];
      r.mode = 'cooked'; r.x = G.player.x; r.y = G.player.y;
      G.freeze = 0; G.state = 'play';
      g._update(1 / 60);
    }
    out.tierReached = G.tier;
    out.ascended = G.ascended;

    // --- 7. caught by a hater costs a life -------------------------
    g._newGame(); G.state = 'play';
    const lives0 = G.lives;
    G.rivals[0].mode = 'roam';
    G.rivals[0].x = G.player.x; G.rivals[0].y = G.player.y;
    step(0.05);
    out.dying = G.state === 'dying';
    step(2.6);
    out.livesLost = lives0 - G.lives;
    out.backToReady = G.state === 'ready';

    // --- 8. clearing the city advances the level -------------------
    g._newGame(); G.state = 'play';
    const lvl0 = G.level;
    G.pillsLeft = 1;                       // next pill eaten finishes the city
    let sawClear = false;
    g._setDir(g._dirs.LEFT);
    for (let i = 0; i < 60 * 5; i++) { g._update(1 / 60); if (G.state === 'levelclear') sawClear = true; }
    out.cleared = sawClear;
    out.levelUp = G.level - lvl0;

    // --- 9. tunnel wrap --------------------------------------------
    g._newGame(); G.state = 'play';
    G.player.x = 6; G.player.y = (M.TUNNEL_ROW + 0.5) * M.TILE;
    G.player.dir = g._dirs.LEFT; G.player.want = null;
    step(0.6);
    out.wrapped = G.player.x > M.W - 40;

    // --- 10. the player never tunnels into a building --------------
    g._newGame(); G.state = 'play';
    let inWall = 0;
    const dirs = [g._dirs.LEFT, g._dirs.RIGHT, g._dirs.UP, g._dirs.DOWN];
    for (let i = 0; i < 60 * 40; i++) {
      if (i % 17 === 0) g._setDir(dirs[(Math.random() * 4) | 0]);
      g._update(1 / 60);
      const c = Math.floor(G.player.x / M.TILE), r = Math.floor(G.player.y / M.TILE);
      if (c >= 0 && c < M.COLS && r >= 0 && r < M.ROWS && G.grid[r][c] === M.WALL) inWall++;
      if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; }
    }
    out.wallFrames = inWall;

    return out;
  });

  const r = results;
  check('all four rivals leave the alley', r.allOut, JSON.stringify(r.modesAfter16));
  check('rivals roam widely', r.allRoam, 'tiles visited: ' + r.tilesVisited);
  check('no rival gets wedged', r.noStall, 'longest stall (s): ' + r.longestStallSecs);
  check('every rival keeps moving', r.moved.every(Boolean), JSON.stringify(r.moved));
  check('walking eats pills', r.pillsEaten > 5, 'ate ' + r.pillsEaten);
  check('pills charge aura', r.auraGained > 5, 'aura ' + r.auraGained.toFixed(1));
  check('pills score', r.scored > 50, 'score ' + r.scored);
  check('hammer starts mog mode', r.mogModeOn, 'timer');
  check('hammer cooks the rivals', r.rivalsCooked >= 1, 'cooked ' + r.rivalsCooked);
  check('mogging scores 200', r.mogScored === 200, 'got ' + r.mogScored);
  check('mogging counts toward looksmax', r.mogCounted === 1, 'got ' + r.mogCounted);
  check('mogged rival becomes eyes', r.victimMode === 'eyes', r.victimMode);
  check('aura burst mogs the block', r.burstMogs >= 3, 'mogged ' + r.burstMogs);
  check('aura burst spends the meter', r.auraSpent === 0, 'aura ' + r.auraSpent);
  check('24 mogs reaches GIGACHAD', r.tierReached === 4 && r.ascended, 'tier ' + r.tierReached);
  check('a hater costs a life', r.dying && r.livesLost === 1 && r.backToReady,
        `dying=${r.dying} lost=${r.livesLost} ready=${r.backToReady}`);
  check('clearing the city advances', r.cleared && r.levelUp === 1, `cleared=${r.cleared} levelUp=${r.levelUp}`);
  check('tunnel wraps', r.wrapped, 'x=' + r.wrapped);
  check('player never enters a building', r.wallFrames === 0, r.wallFrames + ' frames inside a wall');
  check('no runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  let bad = 0;
  for (const t of T) {
    console.log((t.ok ? '  PASS  ' : '  FAIL  ') + t.name + (t.ok ? '' : '   -> ' + t.detail));
    if (!t.ok) bad++;
  }
  console.log(bad ? `\n${bad} failing` : `\nall ${T.length} checks passed`);
  process.exit(bad ? 1 : 0);
})();
