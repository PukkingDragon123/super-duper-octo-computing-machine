// Headless gameplay assertions for BP MAN: PSL CITY.
//   node tools/playtest.js
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

  const r = await page.evaluate(() => {
    const g = window.BP.game, G = g.state, M = window.BP.maze, TR = window.BP.traffic;
    const out = {};
    const D = g._dirs;
    // Run frames while holding the round open -- a death would reset the actors.
    const hold = (secs) => {
      const n = Math.round(secs * 60);
      for (let i = 0; i < n; i++) { g._update(1 / 60); if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; } }
    };
    const step = (secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) g._update(1 / 60); };
    const noCars = () => { G.cars = []; G.carTimer = 9999; };

    // --- 1. everyone leaves the club --------------------------------
    g._newGame(); G.state = 'play'; noCars();
    hold(18);
    out.modes = G.rivals.map(x => x.mode);
    out.allOut = G.rivals.every(x => x.mode !== 'club' && x.mode !== 'leave');

    // --- 2. nobody gets wedged --------------------------------------
    const seen = G.rivals.map(() => new Set());
    const last = G.rivals.map(() => ''), runNow = G.rivals.map(() => 0), runMax = G.rivals.map(() => 0);
    const dirs = [D.LEFT, D.RIGHT, D.UP, D.DOWN];
    for (let i = 0; i < 60 * 45; i++) {
      if (i % 23 === 0) g._setDir(dirs[(Math.random() * 4) | 0]);
      g._update(1 / 60);
      if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; }
      noCars();
      G.rivals.forEach((x, k) => {
        const key = Math.floor(x.x / M.TILE) + ',' + Math.floor(x.y / M.TILE);
        seen[k].add(key);
        if (x.mode === 'club' || x.mode === 'leave' || x.mode === 'down' || x.mode === 'hit') {
          runNow[k] = 0; last[k] = ''; return;
        }
        if (key === last[k]) { runNow[k]++; if (runNow[k] > runMax[k]) runMax[k] = runNow[k]; }
        else { runNow[k] = 0; last[k] = key; }
      });
    }
    out.tiles = seen.map(s => s.size);
    out.roams = out.tiles.every(n => n > 50);
    out.stalls = runMax.map(n => +(n / 60).toFixed(2));
    out.noStall = runMax.every(n => n < 60 * 2.5);

    // --- 3. pills raise PSL, aura and score -------------------------
    // park the rivals so a chance catch does not muddy the PSL delta
    g._newGame(); G.state = 'play'; noCars();
    const parkRivals = () => G.rivals.forEach(x => { x.mode = 'club'; x.clubT = 9999; });
    parkRivals();
    const p0 = G.pillsLeft, psl0 = G.psl;
    for (const d of [D.LEFT, D.UP, D.RIGHT, D.DOWN, D.RIGHT, D.UP]) {
      g._setDir(d); hold(1.6); noCars(); parkRivals();
    }
    out.ate = p0 - G.pillsLeft;
    out.pslUp = G.psl - psl0;
    out.aura = G.aura;
    out.score = G.score;

    // --- 4. running is faster and costs stamina ---------------------
    g._newGame(); G.state = 'play'; noCars();
    G.player.x = (1 + 0.5) * M.TILE; G.player.y = (5 + 0.5) * M.TILE;
    G.player.dir = D.RIGHT; G.player.want = null; G.player.wantRun = false;
    let x0 = G.player.x; hold(1.0); noCars();
    const walkDist = G.player.x - x0;
    g._newGame(); G.state = 'play'; noCars();
    G.player.x = (1 + 0.5) * M.TILE; G.player.y = (5 + 0.5) * M.TILE;
    G.player.dir = D.RIGHT; G.player.want = null; G.player.wantRun = true;
    x0 = G.player.x; const st0 = G.stamina; hold(1.0); noCars();
    out.runDist = G.player.x - x0;
    out.walkDist = walkDist;
    out.staminaDrained = st0 - G.stamina;

    // --- 5. hammer cooks them, mogging raises PSL -------------------
    g._newGame(); G.state = 'play'; noCars();
    G.grid[3][1] = M.HAMMER;
    G.player.x = 1.5 * M.TILE; G.player.y = 3.5 * M.TILE;
    step(0.05);
    out.mogMode = G.mogTimer > 0;
    out.cooked = G.rivals.filter(x => x.mode === 'cooked').length;
    const victim = G.rivals[0];
    victim.mode = 'cooked'; victim.x = G.player.x; victim.y = G.player.y;
    const s1 = G.score, ps1 = G.psl, mg1 = G.mogs;
    step(0.05);
    out.mogScore = G.score - s1;
    out.mogPsl = +(G.psl - ps1).toFixed(4);
    out.mogCount = G.mogs - mg1;
    out.victimDown = victim.mode === 'down';

    // --- 6. aura burst clears the block -----------------------------
    g._newGame(); G.state = 'play'; noCars();
    G.aura = 100;
    G.rivals.forEach((x, i) => { x.mode = 'roam'; x.x = G.player.x + i * 6; x.y = G.player.y; });
    const mg2 = G.mogs;
    g._fireAura();
    out.auraSpent = G.aura;              // read before pills can recharge it
    step(1.0);
    out.burst = G.mogs - mg2;

    // --- 7. a hater costs a life and PSL ----------------------------
    g._newGame(); G.state = 'play'; noCars();
    const lives0 = G.lives, psl2 = G.psl;
    G.rivals[0].mode = 'roam'; G.rivals[0].x = G.player.x; G.rivals[0].y = G.player.y;
    step(0.05);
    out.dying = G.state === 'dying';
    out.caughtPsl = +(psl2 - G.psl).toFixed(2);
    step(2.6);
    out.lifeLost = lives0 - G.lives;

    // --- 8. a cab costs PSL but never a life ------------------------
    g._newGame(); G.state = 'play'; noCars();
    const lives1 = G.lives, psl3 = G.psl;
    G.player.x = 8 * M.TILE; G.player.y = (5 + 0.5) * M.TILE;
    const car = TR.spawn(1, null);
    car.axis = 'h'; car.dir = 1; car.warn = 0;
    car.y = G.player.y - TR.WID / 2; car.x = G.player.x - 10;
    G.cars = [car];
    step(0.05);
    out.carPsl = +(psl3 - G.psl).toFixed(2);
    out.carLives = lives1 - G.lives;
    out.carStun = G.player.stun > 0 && G.player.invuln > 0;
    out.carNotDying = G.state === 'play';

    // --- 9. clearing the block advances -----------------------------
    g._newGame(); G.state = 'play'; noCars();
    const lvl0 = G.level;
    G.pillsLeft = 1;
    let sawClear = false;
    g._setDir(D.LEFT);
    for (let i = 0; i < 60 * 5; i++) { g._update(1 / 60); noCars(); if (G.state === 'levelclear') sawClear = true; }
    out.cleared = sawClear;
    out.levelUp = G.level - lvl0;

    // --- 10. tunnel wrap --------------------------------------------
    g._newGame(); G.state = 'play'; noCars();
    G.player.x = 6; G.player.y = (M.TUNNEL_ROW + 0.5) * M.TILE;
    G.player.dir = D.LEFT; G.player.want = null;
    hold(0.6);
    out.wrapped = G.player.x > M.W - 40;

    // --- 11. never walk into a building or a tree -------------------
    g._newGame(); G.state = 'play'; noCars();
    let bad = 0;
    for (let i = 0; i < 60 * 40; i++) {
      if (i % 17 === 0) g._setDir(dirs[(Math.random() * 4) | 0]);
      if (i % 40 === 0) G.player.wantRun = !G.player.wantRun;
      g._update(1 / 60);
      noCars();
      if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; }
      const c = Math.floor(G.player.x / M.TILE), rr = Math.floor(G.player.y / M.TILE);
      if (c >= 0 && c < M.COLS && rr >= 0 && rr < M.ROWS) {
        const t = M.terrain(c, rr);
        if (t === M.WALL || t === M.TREE) bad++;
      }
    }
    out.wallFrames = bad;

    // --- 12. PSL tiers track the rating -----------------------------
    out.tierAt = [1.0, 3.1, 4.6, 6.1, 7.6, 10].map(v => g._tierFor(v));

    // --- 13. block 4 is APEX ----------------------------------------
    g._newGame(4); G.state = 'play'; noCars();
    out.bossExists = !!G.boss;
    out.bossRivals = G.rivals.length;
    out.bossHp = G.boss ? G.boss.hp : -1;
    out.district = G.district.name;

    // contact with no hammer costs a life
    const lives2 = G.lives;
    G.boss.stun = 0; G.mogTimer = 0;
    G.boss.x = G.player.x; G.boss.y = G.player.y;
    step(0.05);
    out.bossKills = G.state === 'dying';
    out.bossHpUnchanged = G.boss.hp === out.bossHp;
    step(2.6);
    out.bossLifeLost = lives2 - G.lives;

    // hammer contact damages him
    g._newGame(4); G.state = 'play'; noCars();
    G.mogTimer = 6; G.boss.stun = 0;
    const hp0 = G.boss.hp;
    G.boss.x = G.player.x; G.boss.y = G.player.y;
    step(0.05);
    out.hammerDmg = hp0 - G.boss.hp;
    out.bossStunned = G.boss.stun > 0;

    // aura burst does double, and finishing him clears the block
    g._newGame(4); G.state = 'play'; noCars();
    G.aura = 100; G.boss.stun = 0;
    G.boss.x = G.player.x + 10; G.boss.y = G.player.y;
    const hp1 = G.boss.hp;
    g._fireAura();
    step(0.4);
    out.auraDmg = hp1 - G.boss.hp;

    g._newGame(4); G.state = 'play'; noCars();
    const psl4 = G.psl;
    G.boss.hp = 1; G.boss.stun = 0; G.mogTimer = 6;
    G.boss.x = G.player.x; G.boss.y = G.player.y;
    step(0.9);
    out.bossDownPsl = +(G.psl - psl4).toFixed(2);
    out.bossClears = G.state === 'levelclear' || G.bossDown;

    // --- 14. PSL stays inside 1..10 ---------------------------------
    g._newGame(); G.state = 'play'; noCars();
    for (let i = 0; i < 400; i++) G.psl = Math.min(10, G.psl + 0.3);
    out.pslMax = G.psl;
    G.psl = 1.05;
    G.rivals[0].mode = 'roam'; G.rivals[0].x = G.player.x; G.rivals[0].y = G.player.y;
    step(0.05);
    out.pslMin = G.psl;

    return out;
  });

  check('everyone leaves the club', r.allOut, JSON.stringify(r.modes));
  check('rivals roam widely', r.roams, 'tiles: ' + r.tiles);
  check('no rival gets wedged', r.noStall, 'longest stall (s): ' + r.stalls);
  check('walking eats pills', r.ate > 5, 'ate ' + r.ate);
  check('pills raise PSL', r.pslUp > 0.01, '+' + r.pslUp.toFixed(3));
  check('pills charge aura', r.aura > 5, 'aura ' + r.aura.toFixed(1));
  check('running outpaces walking', r.runDist > r.walkDist * 1.35,
        `run ${r.runDist.toFixed(0)} vs walk ${r.walkDist.toFixed(0)}`);
  check('running drains stamina', r.staminaDrained > 15, 'drained ' + r.staminaDrained.toFixed(1));
  check('hammer starts mog mode', r.mogMode, '');
  check('hammer cooks the rivals', r.cooked >= 1, 'cooked ' + r.cooked);
  check('mogging scores 200', r.mogScore === 200, 'got ' + r.mogScore);
  check('mogging raises PSL', r.mogPsl > 0.02, '+' + r.mogPsl);
  check('mogged rival goes down', r.victimDown, '');
  check('aura burst mogs the block', r.burst >= 3, 'mogged ' + r.burst);
  check('aura burst spends the meter', r.auraSpent === 0, 'aura ' + r.auraSpent);
  check('a hater costs a life and PSL', r.dying && r.lifeLost === 1 && r.caughtPsl > 0.5,
        `dying=${r.dying} life=${r.lifeLost} psl=-${r.caughtPsl}`);
  check('a cab costs PSL but no life', r.carPsl > 0.3 && r.carLives === 0 && r.carNotDying,
        `psl=-${r.carPsl} lives=-${r.carLives} state ok=${r.carNotDying}`);
  check('a cab stuns and grants i-frames', r.carStun, '');
  check('clearing the block advances', r.cleared && r.levelUp === 1, `cleared=${r.cleared}`);
  check('tunnel wraps', r.wrapped, '');
  check('player never enters a building or tree', r.wallFrames === 0, r.wallFrames + ' frames');
  check('PSL maps to the right tier', JSON.stringify(r.tierAt) === '[0,1,2,3,4,4]', JSON.stringify(r.tierAt));
  check('block 4 is APEX', r.bossExists && r.bossRivals === 2 && r.district === 'THE ROOF',
        `boss=${r.bossExists} rivals=${r.bossRivals} district=${r.district}`);
  check('APEX kills you bare-handed', r.bossKills && r.bossHpUnchanged && r.bossLifeLost === 1,
        `dying=${r.bossKills} hpSafe=${r.bossHpUnchanged} life=${r.bossLifeLost}`);
  check('hammer damages APEX', r.hammerDmg === 1 && r.bossStunned, 'dmg ' + r.hammerDmg);
  check('aura burst hits APEX for 2', r.auraDmg === 2, 'dmg ' + r.auraDmg);
  check('downing APEX pays PSL and clears', r.bossDownPsl > 0.1 && r.bossClears,
        `psl=+${r.bossDownPsl} cleared=${r.bossClears}`);
  check('PSL stays within 1 to 10', r.pslMax === 10 && r.pslMin >= 1,
        `max=${r.pslMax} min=${r.pslMin}`);
  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  let bad = 0;
  for (const t of T) {
    console.log((t.ok ? '  PASS  ' : '  FAIL  ') + t.name + (t.ok ? '' : '   -> ' + t.detail));
    if (!t.ok) bad++;
  }
  console.log(bad ? `\n${bad} failing` : `\nall ${T.length} checks passed`);
  process.exit(bad ? 1 : 0);
})();
