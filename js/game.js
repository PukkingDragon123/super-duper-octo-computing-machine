/* ------------------------------------------------------------------
   game.js -- BP MAN: PSL CITY

   You are on foot in New York.  Eat black pills, swing hammers, mog
   the haters, dodge the cabs and run the park.  Everything you do
   moves one number: your PSL rating, 1.00 to 10.00.  Getting the
   highest PSL is the whole point.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var M = BP.maze, S = BP.sprites, CITY = BP.city, FT = BP.font,
      A = BP.audio, FACE = BP.face, HU = BP.human, TR = BP.traffic;
  var T = M.TILE;

  var HUD_TOP = 46, HUD_BOT = 68;
  var VIEW_W = M.W, VIEW_H = HUD_TOP + M.H + HUD_BOT;
  var MAZE_Y = HUD_TOP, HUD_Y = HUD_TOP + M.H;

  // The rating ladder.  `face` indexes face.js's five looks.
  var TIERS = [
    { name: 'SOFT',        psl: 0,   face: 0, blurb: 'ROUND SKULL. NO ANGLES. NPC ENERGY.' },
    { name: 'SHARPENING',  psl: 3.0, face: 1, blurb: 'THE BLOAT IS LEAVING. BROWS DROPPED.' },
    { name: 'JAWLINE',     psl: 4.5, face: 2, blurb: 'MANDIBLE ACQUIRED. CHEEKS HOLLOW.' },
    { name: 'HUNTER EYES', psl: 6.0, face: 3, blurb: 'HOODED. TILTED. UNBOTHERED.' },
    { name: 'GIGACHAD',    psl: 7.5, face: 4, blurb: 'MAXIMUM HANDSOME. THE CITY IS YOURS.' }
  ];
  var PLAYER_TOPS = ['#5a6690', '#4d5878', '#2a2e3c', '#1d1f28', '#eceef6'];

  var RIVAL_KEYS = ['vic', 'desh', 'kai', 'russ'];
  var UP = [0, -1], DOWN = [0, 1], LEFT = [-1, 0], RIGHT = [1, 0];
  var DIRS = [UP, LEFT, DOWN, RIGHT];

  /* ---------------- canvas ---------------- */
  var view, vg, buf, bg;

  function setup(el) {
    view = el;
    var b = S.canvas(VIEW_W, VIEW_H);
    buf = b.c; bg = b.g;
    bg.imageSmoothingEnabled = false;
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    var aw = Math.max(160, window.innerWidth - 16);
    var ah = Math.max(160, window.innerHeight - 16);
    var fit = Math.min(aw / VIEW_W, ah / VIEW_H);
    var k = fit >= 1 ? Math.floor(fit) : fit;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cw = Math.round(VIEW_W * k), ch = Math.round(VIEW_H * k);
    view.style.width = cw + 'px';
    view.style.height = ch + 'px';
    view.width = Math.round(cw * dpr);
    view.height = Math.round(ch * dpr);
    vg = view.getContext('2d');
    vg.imageSmoothingEnabled = false;
  }

  /* ---------------- state ---------------- */
  var G = {
    state: 'title', t: 0, stateT: 0,
    psl: 2.0, best: 2.0, peak: 2.0, score: 0,
    level: 1, lives: 3, tier: 0, mogs: 0,
    aura: 0, stamina: 100, mogTimer: 0, mogStreak: 0,
    grid: null, pillsLeft: 0, pillsEaten: 0,
    mazeImg: null, pillImg: null, skyImg: null, props: null, district: null,
    hammers: [], bonus: null,
    player: null, rivals: [], boss: null, cars: [], carTimer: 6,
    phase: 0, phaseT: 0, freeze: 0, shake: 0, flash: 0,
    particles: [], pops: [], wave: null,
    ascendFrom: 0, ascendTo: 0, paused: false,
    titleSky: null, bossDown: false
  };
  try { G.best = parseFloat(localStorage.getItem('bpman.bestpsl')) || 2.0; } catch (e) {}

  var PHASES = [7, 20, 7, 20, 5, 20, 5, 1e9];

  /* ---------------- PSL ---------------- */
  function tierFor(psl) {
    var t = 0;
    for (var i = 0; i < TIERS.length; i++) if (psl >= TIERS[i].psl) t = i;
    return t;
  }
  /** Gains taper as you climb -- the last point of PSL is the hardest. */
  function gainPSL(v) {
    G.psl = Math.min(10, G.psl + v * Math.max(0.18, (10 - G.psl) / 8));
    G.peak = Math.max(G.peak, G.psl);
    checkTier();
  }
  function losePSL(v) {
    G.psl = Math.max(1, G.psl - v);
    checkTier();
  }
  function checkTier() {
    var nt = tierFor(G.psl);
    if (nt > G.tier) {
      G.ascendFrom = TIERS[G.tier].face; G.ascendTo = TIERS[nt].face; G.tier = nt;
      G.state = 'ascend'; G.stateT = 0;
      A.sfx.tierUp();
    } else if (nt < G.tier) {
      G.tier = nt;
    }
  }
  function faceTier() { return TIERS[G.tier].face; }
  function saveBest() {
    if (G.peak > G.best) {
      G.best = G.peak;
      try { localStorage.setItem('bpman.bestpsl', G.best.toFixed(2)); } catch (e) {}
    }
  }

  /* ---------------- actors ---------------- */
  function mkPlayer() {
    return {
      x: (M.playerSpawn.c + 0.5) * T, y: (M.playerSpawn.r + 0.5) * T,
      dir: LEFT, want: null, view: 'side', flip: true,
      anim: 0, frame: 0, mouth: 0, moving: false,
      running: false, swing: 0, invuln: 0, stun: 0
    };
  }

  function mkRival(i) {
    var s = M.rivalSpawns[i];
    return {
      i: i, key: RIVAL_KEYS[i], spec: HU.CAST[RIVAL_KEYS[i]],
      x: (s.c + 0.5) * T, y: (s.r + 0.5) * T,
      home: { x: (s.c + 0.5) * T, y: (s.r + 0.5) * T },
      dir: i === 0 ? LEFT : (i === 1 ? UP : DOWN),
      mode: i === 0 ? 'roam' : 'club',
      clubT: [0, 1.4, 4.5, 8][i],
      bob: 0, anim: 0, frame: 0, tileKey: '', downT: 0, vw: 'side', flip: false
    };
  }

  function mkBoss() {
    return {
      spec: HU.CAST.apex, hp: 5, maxHp: 5,
      x: (M.gate.c + 0.5) * T, y: (M.gate.r - 1.5) * T,
      dir: LEFT, anim: 0, frame: 0, tileKey: '', stun: 2.5,
      vw: 'side', flip: false, flashT: 0
    };
  }

  function loadLevel() {
    var built = M.build();
    G.grid = built.grid;
    G.pillsLeft = built.pills;
    G.pillsEaten = 0;
    var baked = CITY.build(G.grid, G.level);
    G.mazeImg = baked.img;
    G.props = baked.props;
    G.district = baked.district;
    G.pillImg = CITY.pillLayer(G.grid, S);
    G.skyImg = CITY.skyline(VIEW_W, HUD_TOP, G.level);
    G.hammers = [];
    for (var r = 0; r < M.ROWS; r++)
      for (var c = 0; c < M.COLS; c++)
        if (G.grid[r][c] === M.HAMMER) G.hammers.push({ c: c, r: r });
    G.bonus = null;
    G.cars = [];
    G.carTimer = 5;
    G.bossDown = false;
    resetActors();
  }

  function resetActors() {
    G.player = mkPlayer();
    var boss = CITY.isBoss(G.level);
    G.rivals = [];
    var n = boss ? 2 : 4;
    for (var i = 0; i < n; i++) G.rivals.push(mkRival(i));
    G.boss = boss ? mkBoss() : null;
    G.phase = 0; G.phaseT = 0;
    G.mogTimer = 0; G.mogStreak = 0;
    G.freeze = 0;
    G.stamina = 100;
    G.cars = [];
  }

  /* ---------------- movement ---------------- */
  function canEnter(c, r, gate) { return M.open(G.grid, c, r, gate); }

  function step(e, spd, gate) {
    var c = Math.floor(e.x / T), r = Math.floor(e.y / T);
    var cx = (c + 0.5) * T, cy = (r + 0.5) * T;

    if (e.want) {
      var w = e.want;
      if (w[0] === -e.dir[0] && w[1] === -e.dir[1]) { e.dir = w; e.want = null; }
      else if (canEnter(c + w[0], r + w[1], gate)) {
        if (w[0] !== 0 && Math.abs(e.y - cy) <= spd + 0.6) { e.y = cy; e.dir = w; e.want = null; }
        else if (w[1] !== 0 && Math.abs(e.x - cx) <= spd + 0.6) { e.x = cx; e.dir = w; e.want = null; }
      }
    }
    var nx = e.x + e.dir[0] * spd, ny = e.y + e.dir[1] * spd;
    if (!canEnter(c + e.dir[0], r + e.dir[1], gate)) {
      if (e.dir[0] > 0 && nx > cx) nx = cx;
      if (e.dir[0] < 0 && nx < cx) nx = cx;
      if (e.dir[1] > 0 && ny > cy) ny = cy;
      if (e.dir[1] < 0 && ny < cy) ny = cy;
    }
    e.moving = (nx !== e.x || ny !== e.y);
    e.x = nx; e.y = ny;
    if (Math.floor(e.y / T) === M.TUNNEL_ROW) {
      if (e.x < -T) e.x = M.W + T - 1;
      else if (e.x > M.W + T) e.x = -T + 1;
    }
    return e.moving;
  }

  function tileC(e) { return Math.floor(e.x / T); }
  function tileR(e) { return Math.floor(e.y / T); }

  function facing(e) {
    if (e.dir === UP) { e.vw = 'back'; }
    else if (e.dir === DOWN) { e.vw = 'front'; }
    else { e.vw = 'side'; e.flip = e.dir[0] < 0; }
  }

  /* ---------------- rival brains ---------------- */
  function chaseTarget(gh) {
    var p = G.player, pc = tileC(p), pr = tileR(p);
    if (gh.i === 0) return { c: pc, r: pr };
    if (gh.i === 1) return { c: pc + p.dir[0] * 4, r: pr + p.dir[1] * 4 };
    if (gh.i === 2) {
      var b = G.rivals[0] || gh;
      var ax = pc + p.dir[0] * 2, ay = pr + p.dir[1] * 2;
      return { c: ax + (ax - tileC(b)), r: ay + (ay - tileR(b)) };
    }
    var d = Math.hypot(pc - tileC(gh), pr - tileR(gh));
    return d > 6 ? { c: pc, r: pr } : { c: pc - p.dir[0] * 6, r: pr - p.dir[1] * 6 };
  }

  function think(e, target, gate, antiLoop) {
    var c = Math.floor(e.x / T), r = Math.floor(e.y / T);
    var key = c + ',' + r;
    if (e.tileKey === key) return;
    e.tileKey = key;

    // Greedy no-reverse steering can settle into a small orbit when the
    // target sits far off the grid.  If a tile keeps coming round again,
    // turn back and break the loop.
    if (antiLoop) {
      if (!e.trail) e.trail = [];
      e.trail.push(key);
      if (e.trail.length > 12) e.trail.shift();
      var seen = 0;
      for (var k = 0; k < e.trail.length; k++) if (e.trail[k] === key) seen++;
      if (seen >= 3) { e.trail.length = 0; e.dir = [-e.dir[0], -e.dir[1]]; return; }
    }

    var best = null, bestD = Infinity, opts = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i];
      if (d[0] === -e.dir[0] && d[1] === -e.dir[1]) continue;
      if (!canEnter(c + d[0], r + d[1], gate)) continue;
      opts.push(d);
      var dist = (c + d[0] - target.c) * (c + d[0] - target.c) +
                 (r + d[1] - target.r) * (r + d[1] - target.r);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    if (!opts.length) { e.dir = [-e.dir[0], -e.dir[1]]; return; }
    e.dir = best;
  }

  function scattering() { return (G.phase % 2) === 0; }

  function rivalSpeed(gh) {
    var base = Math.min(1.78, 1.30 + (G.level - 1) * 0.05);
    if (gh.mode === 'home') return 3.4;
    if (gh.mode === 'cooked') return 0.86;
    if (Math.floor(gh.y / T) === M.TUNNEL_ROW && (tileC(gh) < 6 || tileC(gh) > 21)) return base * 0.62;
    if (M.isPark(tileC(gh), tileR(gh))) return base * 0.82;   // grass is slower
    return base;
  }

  function playerSpeed() {
    var s = Math.min(1.72, 1.40 + (G.level - 1) * 0.04);
    if (G.mogTimer > 0) s += 0.14;
    if (G.player.running) s *= 1.5;
    return s;
  }

  /* ---------------- effects ---------------- */
  function burst(x, y, n, cols, power) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * (power || 2);
      G.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        col: cols[(Math.random() * cols.length) | 0],
        size: 1 + ((Math.random() * 2) | 0)
      });
    }
  }
  function pop(x, y, text, col) { G.pops.push({ x: x, y: y, text: text, col: col, life: 1.2 }); }
  function shake(v) { G.shake = Math.max(G.shake, v); }

  /* ---------------- scoring ---------------- */
  function addScore(n) { G.score += n; }

  function mogRival(gh) {
    var pts = 200 * Math.pow(2, Math.min(3, G.mogStreak));
    G.mogStreak++;
    G.mogs++;
    addScore(pts);
    gh.mode = 'down'; gh.downT = 0.9; gh.tileKey = '';
    G.player.swing = 0.4;
    pop(gh.x, gh.y - 22, 'MOGGED', '#ff5bd0');
    pop(gh.x, gh.y - 34, '+' + pts, '#ffd75e');
    burst(gh.x, gh.y - 8, 26, ['#ffd75e', '#ff5bd0', '#ffffff', '#4de1ff'], 3);
    shake(5);
    G.freeze = 0.4;
    A.sfx.hammer(); A.sfx.mog(G.mogStreak);
    gainPSL(0.15);
  }

  function damageBoss(n) {
    var b = G.boss;
    if (!b || b.stun > 0 || b.hp <= 0) return;
    b.hp -= n;
    b.stun = 1.8;
    b.flashT = 0.5;
    shake(8);
    burst(b.x, b.y - 10, 34, ['#ffd75e', '#ff5b7a', '#ffffff'], 3.4);
    A.sfx.hammer();
    if (b.hp <= 0) {
      G.bossDown = true;
      pop(b.x, b.y - 40, 'APEX MOGGED', '#ffd75e');
      addScore(5000);
      gainPSL(1.2);
      G.freeze = 0.6;
      A.sfx.tierUp();
    } else {
      pop(b.x, b.y - 40, b.hp + ' LEFT', '#ff5b7a');
      A.sfx.mog(1);
    }
  }

  function startMogMode() {
    var dur = Math.max(3.2, 8.5 - (G.level - 1) * 0.4);
    G.mogTimer = dur;
    G.mogStreak = 0;
    G.rivals.forEach(function (gh) {
      if (gh.mode === 'roam') { gh.mode = 'cooked'; gh.dir = [-gh.dir[0], -gh.dir[1]]; gh.tileKey = ''; }
    });
    shake(3);
    A.sfx.pickup();
  }

  function fireAura() {
    if (G.aura < 100 || G.state !== 'play') return;
    G.aura = 0;
    G.wave = { x: G.player.x, y: G.player.y, r: 0, life: 0.85, hit: [], boss: false };
    G.mogStreak = Math.max(G.mogStreak, 1);
    shake(9); G.flash = 0.25;
    burst(G.player.x, G.player.y - 10, 46, ['#ffd75e', '#fff3c4', '#ff5bd0'], 4);
    pop(G.player.x, G.player.y - 44, 'AURA BURST', '#ffd75e');
    A.sfx.aura();
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    G.t += dt; G.stateT += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.6);
    updateFx(dt);

    switch (G.state) {
      case 'title': break;
      case 'ready': if (G.stateT > 2.0) { G.state = 'play'; G.stateT = 0; } break;
      case 'play': play(dt); break;
      case 'dying':
        if (G.stateT > 2.3) {
          G.lives--;
          if (G.lives <= 0) { saveBest(); G.state = 'gameover'; G.stateT = 0; A.sfx.gameover(); }
          else { resetActors(); G.state = 'ready'; G.stateT = 0; A.sfx.start(); }
        }
        break;
      case 'levelclear':
        if (G.stateT > 2.6) {
          G.level++; loadLevel(); G.state = 'ready'; G.stateT = 0; A.sfx.start();
        }
        break;
      case 'ascend':
        if (G.stateT > 3.6) { G.state = G.pillsLeft <= 0 ? 'levelclear' : 'play'; G.stateT = 0; }
        break;
      default: break;
    }
  }

  function updateFx(dt) {
    var i, p;
    for (i = G.particles.length - 1; i >= 0; i--) {
      p = G.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.98;
      p.life -= dt;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    for (i = G.pops.length - 1; i >= 0; i--) {
      p = G.pops[i];
      p.y -= dt * 16; p.life -= dt;
      if (p.life <= 0) G.pops.splice(i, 1);
    }
    if (G.wave) {
      G.wave.r += dt * 620;
      G.wave.life -= dt;
      for (i = 0; i < G.rivals.length; i++) {
        var gh = G.rivals[i];
        if (gh.mode === 'home' || gh.mode === 'club' || gh.mode === 'down') continue;
        if (G.wave.hit.indexOf(i) >= 0) continue;
        if (Math.hypot(gh.x - G.wave.x, gh.y - G.wave.y) <= G.wave.r) {
          G.wave.hit.push(i);
          gh.mode = 'cooked';
          mogRival(gh);
          G.freeze = 0;
        }
      }
      if (G.boss && !G.wave.boss && G.boss.hp > 0 &&
          Math.hypot(G.boss.x - G.wave.x, G.boss.y - G.wave.y) <= G.wave.r) {
        G.wave.boss = true;
        G.boss.stun = 0;
        damageBoss(2);
      }
      if (G.wave.life <= 0) G.wave = null;
    }
  }

  function play(dt) {
    if (G.freeze > 0) { G.freeze -= dt; return; }
    var p = G.player;

    if (G.mogTimer <= 0) {
      G.phaseT += dt;
      if (G.phaseT > PHASES[Math.min(G.phase, PHASES.length - 1)]) {
        G.phaseT = 0; G.phase++;
        G.rivals.forEach(function (gh) {
          if (gh.mode === 'roam') { gh.dir = [-gh.dir[0], -gh.dir[1]]; gh.tileKey = ''; }
        });
      }
    } else {
      G.mogTimer -= dt;
      if (G.mogTimer <= 0) {
        G.mogTimer = 0;
        G.rivals.forEach(function (gh) { if (gh.mode === 'cooked') { gh.mode = 'roam'; gh.tileKey = ''; } });
      }
    }

    // --- player ---
    if (p.stun > 0) { p.stun -= dt; p.moving = false; }
    else {
      p.running = p.wantRun && G.stamina > 1 && p.moving !== false;
      var moved = step(p, playerSpeed(), false);
      if (p.running && moved) G.stamina = Math.max(0, G.stamina - dt * 30);
      else G.stamina = Math.min(100, G.stamina + dt * (moved ? 14 : 26));
      if (G.stamina <= 0) p.running = false;
      if (moved) {
        p.anim += playerSpeed();
        p.frame = Math.floor(p.anim / (p.running ? 3.4 : 4.6)) & 3;
        p.mouth = (Math.floor(p.anim / 6) & 1);
      } else { p.mouth = 0; }
      facing(p);
      eat();
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.swing > 0) p.swing -= dt;

    // --- rivals ---
    G.rivals.forEach(function (gh) {
      gh.anim += 1;
      if (gh.mode === 'club') {
        gh.clubT -= dt; gh.bob += dt * 4;
        gh.y = gh.home.y + Math.sin(gh.bob) * 3;
        gh.frame = (Math.floor(G.t * 3) & 3);
        gh.vw = 'front';
        if (gh.clubT <= 0) { gh.mode = 'leave'; gh.tileKey = ''; }
        return;
      }
      if (gh.mode === 'down') {
        gh.downT -= dt;
        if (gh.downT <= 0) { gh.mode = 'home'; gh.tileKey = ''; }
        return;
      }
      if (gh.mode === 'hit') {
        gh.downT -= dt;
        if (gh.downT <= 0) { gh.mode = 'roam'; gh.tileKey = ''; }
        return;
      }
      if (gh.mode === 'leave') {
        var gx = (M.gate.c + 0.5) * T, gy = (M.gate.r - 0.6) * T, sp = 1.5;
        if (Math.abs(gh.x - gx) > sp) gh.x += Math.sign(gx - gh.x) * sp;
        else {
          gh.x = gx; gh.y -= sp;
          if (gh.y <= gy) {
            gh.y = gy; gh.mode = G.mogTimer > 0 ? 'cooked' : 'roam';
            gh.tileKey = ''; gh.dir = Math.random() < 0.5 ? LEFT : RIGHT;
          }
        }
        gh.vw = 'back'; gh.frame = (Math.floor(G.t * 8) & 3);
        return;
      }
      if (gh.mode === 'home') {
        var hx = (M.clubCenter.c + 0.5) * T, hy = (M.clubCenter.r + 0.5) * T;
        if (Math.hypot(gh.x - hx, gh.y - hy) < 6) {
          gh.mode = 'club'; gh.clubT = 1.4; gh.x = hx; gh.y = hy; gh.tileKey = '';
          return;
        }
        think(gh, { c: Math.floor(M.gate.c), r: M.gate.r }, true);
        step(gh, rivalSpeed(gh), true);
        facing(gh);
        gh.frame = (Math.floor(gh.anim / 3) & 3);
        return;
      }
      var target;
      if (gh.mode === 'cooked') {
        var pc = tileC(G.player), pr = tileR(G.player);
        target = { c: tileC(gh) * 2 - pc, r: tileR(gh) * 2 - pr };
      } else {
        target = scattering() ? M.scatterTargets[gh.i] : chaseTarget(gh);
      }
      think(gh, target, false, true);
      step(gh, rivalSpeed(gh), false);
      facing(gh);
      gh.frame = (Math.floor(gh.anim / (gh.mode === 'roam' ? 4 : 3.4)) & 3);
    });

    // --- boss ---
    if (G.boss && G.boss.hp > 0) {
      var b = G.boss;
      if (b.flashT > 0) b.flashT -= dt;
      if (b.stun > 0) { b.stun -= dt; }
      else {
        think(b, { c: tileC(G.player), r: tileR(G.player) }, true);
        step(b, Math.min(2.0, 1.62 + (G.level - 1) * 0.02), true);
        facing(b);
        b.anim += 1;
        b.frame = (Math.floor(b.anim / 3.2) & 3);
      }
    }

    // --- traffic ---
    G.carTimer -= dt;
    if (G.carTimer <= 0 && G.cars.length < 3) {
      var car = TR.spawn(G.level, p);
      if (car) { G.cars.push(car); A.sfx.horn && A.sfx.horn(); }
      G.carTimer = Math.max(2.6, 7.5 - (G.level - 1) * 0.5) * (0.7 + Math.random() * 0.6);
    }
    for (var i = G.cars.length - 1; i >= 0; i--) {
      var cr = G.cars[i];
      var alive = TR.update(cr, dt);
      if (!alive) { G.cars.splice(i, 1); continue; }
      if (p.invuln <= 0 && p.stun <= 0 && TR.hits(cr, p.x, p.y, 4)) hitByCar(cr);
      G.rivals.forEach(function (gh) {
        if (gh.mode !== 'roam' && gh.mode !== 'cooked') return;
        if (!TR.hits(cr, gh.x, gh.y, 2)) return;
        gh.mode = 'hit'; gh.downT = 1.8;
        burst(gh.x, gh.y - 8, 12, ['#ffffff', '#ffd75e'], 2);
        pop(gh.x, gh.y - 24, 'SPLAT', '#8fb6d8');
      });
    }

    collide();

    if (G.bonus) { G.bonus.life -= dt; if (G.bonus.life <= 0) G.bonus = null; }

    if (G.boss && G.bossDown && G.state === 'play') {
      G.state = 'levelclear'; G.stateT = 0; A.sfx.level();
    }
  }

  function hitByCar(car) {
    var p = G.player;
    p.stun = 0.85; p.invuln = 2.0;
    losePSL(0.35);
    shake(9);
    burst(p.x, p.y - 8, 20, ['#ffffff', '#ffd75e', '#8fb6d8'], 3);
    pop(p.x, p.y - 40, '-0.35 PSL', '#ff5b7a');
    pop(p.x, p.y - 52, 'CLIPPED', '#ffffff');
    A.sfx.crash ? A.sfx.crash() : A.sfx.death();
  }

  function eat() {
    var p = G.player;
    var c = tileC(p), r = tileR(p);
    if (c < 0 || c >= M.COLS || r < 0 || r >= M.ROWS) return;
    var t = G.grid[r][c];
    if (t === M.PILL || t === M.PARKPILL || t === M.HAMMER) {
      G.grid[r][c] = M.terrain(c, r) === M.PARK ? M.PARK : M.EMPTY;
      G.pillsLeft--; G.pillsEaten++;
      G.pillImg.getContext('2d').clearRect(c * T, r * T, T, T);
      if (t === M.HAMMER) {
        addScore(60); G.aura = Math.min(100, G.aura + 14);
        gainPSL(0.05);
        for (var i = 0; i < G.hammers.length; i++)
          if (G.hammers[i].c === c && G.hammers[i].r === r) G.hammers.splice(i, 1);
        burst(p.x, p.y - 10, 18, ['#ffd75e', '#e8eefc', '#ff5bd0'], 2.4);
        pop(p.x, p.y - 42, 'HAMMER TIME', '#ffd75e');
        startMogMode();
      } else {
        addScore(10); G.aura = Math.min(100, G.aura + 1.7);
        gainPSL(0.005);
        A.sfx.chomp();
      }
      if ((G.pillsEaten === 70 || G.pillsEaten === 180) && !G.bonus) {
        G.bonus = {
          idx: Math.min(G.level - 1, S.ITEMS.length - 1),
          x: (M.bonusSpot.c + 0.5) * T, y: (M.bonusSpot.r + 0.5) * T, life: 11
        };
      }
      if (G.pillsLeft <= 0 && !(G.boss && G.boss.hp > 0)) {
        gainPSL(0.3);
        G.state = 'levelclear'; G.stateT = 0;
        A.sfx.level();
      }
    }
    if (G.bonus && Math.hypot(p.x - G.bonus.x, p.y - G.bonus.y) < 14) {
      var it = S.ITEMS[G.bonus.idx];
      addScore(it.points);
      G.aura = Math.min(100, G.aura + 20);
      G.stamina = 100;
      gainPSL(it.psl);
      pop(G.bonus.x, G.bonus.y - 24, it.name, '#7cf5d0');
      pop(G.bonus.x, G.bonus.y - 36, '+' + it.psl.toFixed(2) + ' PSL', '#ffd75e');
      burst(G.bonus.x, G.bonus.y, 22, ['#7cf5d0', '#ffd75e', '#ffffff'], 2.6);
      if (G.bonus.idx === 3) startMogMode();
      G.bonus = null;
      A.sfx.pickup();
    }
  }

  function collide() {
    var p = G.player;
    if (p.invuln > 0) return;
    for (var i = 0; i < G.rivals.length; i++) {
      var gh = G.rivals[i];
      if (gh.mode !== 'roam' && gh.mode !== 'cooked') continue;
      if (Math.hypot(p.x - gh.x, p.y - gh.y) > 14) continue;
      if (gh.mode === 'cooked') mogRival(gh);
      else return caught();
    }
    if (G.boss && G.boss.hp > 0 && Math.hypot(p.x - G.boss.x, p.y - G.boss.y) < 18) {
      if (G.mogTimer > 0) { p.swing = 0.4; damageBoss(1); }
      else return caught();
    }
  }

  function caught() {
    G.state = 'dying'; G.stateT = 0;
    G.mogTimer = 0;
    losePSL(0.7);
    shake(7);
    A.sfx.death();
  }

  /* ---------------- render ---------------- */
  var faceCache = {};
  function faceImg(v, tier) {
    var key = v + tier;
    if (faceCache[key]) return faceCache[key];
    var b = S.canvas(FACE.W, FACE.H);
    FACE.draw(b.g, v, tier, {});
    faceCache[key] = b.c;
    return b.c;
  }

  function render() {
    bg.save();
    bg.fillStyle = '#05060b';
    bg.fillRect(0, 0, VIEW_W, VIEW_H);

    if (G.state === 'title') { drawTitle(); bg.restore(); blit(); return; }

    var sx = 0, sy = 0;
    if (G.shake > 0.2) { sx = (Math.random() - 0.5) * G.shake; sy = (Math.random() - 0.5) * G.shake; }
    bg.translate(Math.round(sx), Math.round(sy));
    drawCity();
    drawActors();
    drawFx();
    bg.translate(-Math.round(sx), -Math.round(sy));

    if (G.flash > 0) {
      bg.fillStyle = 'rgba(255,240,190,' + (G.flash * 0.6).toFixed(3) + ')';
      bg.fillRect(0, MAZE_Y, M.W, M.H);
    }
    drawHud();
    drawOverlays();
    bg.restore();
    blit();
  }

  function blit() {
    vg.imageSmoothingEnabled = false;
    vg.clearRect(0, 0, view.width, view.height);
    vg.drawImage(buf, 0, 0, view.width, view.height);
  }

  function drawCity() {
    bg.drawImage(G.mazeImg, 0, MAZE_Y);
    bg.drawImage(G.pillImg, 0, MAZE_Y);

    var P = G.props, i, s;
    for (i = 0; i < P.neon.length; i++) {        // flickering shop signs
      s = P.neon[i];
      var f = 0.55 + 0.45 * Math.sin(G.t * 3 + s.phase);
      if (Math.sin(G.t * 21 + s.phase * 4) > 0.93) f *= 0.25;
      bg.globalAlpha = f;
      bg.fillStyle = s.col;
      bg.fillRect(s.x, MAZE_Y + s.y, s.w, s.h);
      bg.globalAlpha = f * 0.3;
      bg.fillRect(s.x - 1, MAZE_Y + s.y - 2, s.w + 2, s.h + 4);
      bg.globalAlpha = 1;
    }
    for (i = 0; i < P.blinkers.length; i++) {    // tower warning lights
      s = P.blinkers[i];
      if (Math.sin(G.t * 2.4 + i) > 0.4) {
        bg.fillStyle = '#ff4d4d';
        bg.fillRect(s.x - 1, MAZE_Y + s.y - 1, 2, 2);
      }
    }
    for (i = 0; i < P.steam.length; i++) {       // steam off the manholes
      s = P.steam[i];
      var k = ((G.t * 0.55 + s.phase) % 2.2) / 2.2;
      var a = (1 - k) * (s.weak ? 0.13 : 0.22);
      var rad = 3 + k * 12;
      var gy = MAZE_Y + s.y - k * 20;
      var gr = bg.createRadialGradient(s.x, gy, 0, s.x, gy, rad);
      gr.addColorStop(0, 'rgba(214,224,246,' + a.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(214,224,246,0)');
      bg.fillStyle = gr;
      bg.fillRect(s.x - rad, gy - rad, rad * 2, rad * 2);
    }
    for (i = 0; i < P.lights.length; i++) {      // traffic signals
      s = P.lights[i];
      var ph = Math.floor((G.t * 0.5 + i * 0.7) % 3);
      bg.fillStyle = '#171a22';
      bg.fillRect(s.x - 2, MAZE_Y + s.y - 5, 4, 10);
      bg.fillStyle = ph === 0 ? '#ff4d4d' : '#3a1416';
      bg.fillRect(s.x - 1, MAZE_Y + s.y - 4, 2, 2);
      bg.fillStyle = ph === 1 ? '#ffd75e' : '#3a3216';
      bg.fillRect(s.x - 1, MAZE_Y + s.y - 1, 2, 2);
      bg.fillStyle = ph === 2 ? '#4dff88' : '#153a22';
      bg.fillRect(s.x - 1, MAZE_Y + s.y + 2, 2, 2);
    }

    var pulse = 0.55 + 0.45 * Math.sin(G.t * 6);
    G.hammers.forEach(function (h) {
      var x = h.c * T + 1, y = MAZE_Y + h.r * T + 1 + Math.round(Math.sin(G.t * 4 + h.c) * 1.2);
      var cx = x + 7, cy = y + 7, rad = 13 + pulse * 4;
      var gr = bg.createRadialGradient(cx, cy, 1, cx, cy, rad);
      gr.addColorStop(0, 'rgba(255,215,94,' + (0.42 * pulse + 0.18).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,215,94,0)');
      bg.fillStyle = gr;
      bg.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      bg.drawImage(S.HAMMER, x, y);
    });

    if (G.bonus) {
      var by = MAZE_Y + G.bonus.y - 8 + Math.round(Math.sin(G.t * 5) * 2);
      if (G.bonus.life > 2.5 || Math.floor(G.t * 8) % 2) {
        bg.drawImage(S.item(G.bonus.idx), Math.round(G.bonus.x) - 7, Math.round(by));
      }
    }

    if (G.state === 'levelclear' && Math.floor(G.stateT * 6) % 2) {
      bg.globalAlpha = 0.35;
      bg.fillStyle = G.district.neon;
      bg.fillRect(0, MAZE_Y, M.W, M.H);
      bg.globalAlpha = 1;
    }
  }

  function drawPerson(spec, x, y, vw, flip, pose, frame, opts, alpha) {
    var img = HU.build(spec, vw, pose, frame, opts);
    var d = HU.dims(spec);
    var px = Math.round(x), py = MAZE_Y + Math.round(y);
    bg.save();
    bg.imageSmoothingEnabled = false;
    if (alpha !== undefined) bg.globalAlpha = alpha;
    bg.drawImage(S.shadow(d.W - 6), px - (d.W - 6) / 2, py + (d.H - d.ay) - 5);
    if (vw === 'side' && flip) {
      bg.translate(px, 0);
      bg.scale(-1, 1);
      bg.drawImage(img, -d.ax, py - d.ay);
    } else {
      bg.drawImage(img, px - d.ax, py - d.ay);
    }
    bg.restore();
  }

  function drawActors() {
    var i, gh;
    if (G.state !== 'dying') {
      for (i = 0; i < G.rivals.length; i++) {
        gh = G.rivals[i];
        var pose = 'walk', expr = 'smug', alpha;
        if (gh.mode === 'cooked') { pose = 'scared'; expr = 'scared'; }
        else if (gh.mode === 'down' || gh.mode === 'hit') { pose = 'down'; expr = 'scared'; }
        else if (gh.mode === 'home') { pose = 'run'; expr = 'scared'; alpha = 0.55; }
        else if (gh.mode === 'club') { pose = 'idle'; }
        else if (!scattering()) pose = 'run';
        var flashOff = (gh.mode === 'cooked' && G.mogTimer < 2.2 && Math.floor(G.t * 8) % 2);
        drawPerson(gh.spec, gh.x, gh.y, gh.vw, gh.flip, pose, gh.frame,
                   { expr: expr, iris: flashOff ? '#ffffff' : undefined }, alpha);
      }
    }
    if (G.boss && G.boss.hp > 0) drawBoss();
    G.cars.forEach(function (c) { TR.draw(bg, c, MAZE_Y, G.t); });
    drawPlayer();
  }

  function drawBoss() {
    var b = G.boss;
    if (b.flashT > 0 && Math.floor(G.t * 20) % 2) return;
    var rad = 26 + Math.sin(G.t * 5) * 3;
    var gr = bg.createRadialGradient(b.x, MAZE_Y + b.y - 6, 2, b.x, MAZE_Y + b.y - 6, rad);
    gr.addColorStop(0, 'rgba(255,60,90,0.28)');
    gr.addColorStop(1, 'rgba(255,60,90,0)');
    bg.fillStyle = gr;
    bg.fillRect(b.x - rad, MAZE_Y + b.y - 6 - rad, rad * 2, rad * 2);
    drawPerson(b.spec, b.x, b.y, b.vw, b.flip,
               b.stun > 0 ? 'idle' : 'run', b.frame, { expr: 'angry' });
    // health pips over his head
    var w = b.maxHp * 7;
    bg.fillStyle = 'rgba(6,8,15,0.8)';
    bg.fillRect(b.x - w / 2 - 2, MAZE_Y + b.y - 44, w + 4, 7);
    for (var i = 0; i < b.maxHp; i++) {
      bg.fillStyle = i < b.hp ? '#ff4d6a' : '#3a2030';
      bg.fillRect(b.x - w / 2 + i * 7, MAZE_Y + b.y - 43, 5, 5);
    }
  }

  function drawPlayer() {
    var p = G.player;
    var tier = faceTier();
    var opts = { tier: tier, chain: tier >= 4, topOverride: PLAYER_TOPS[tier], mouth: p.mouth };

    if (G.state === 'dying') {
      var k = Math.min(1, G.stateT / 2.0);
      bg.save();
      bg.globalAlpha = Math.max(0, 1 - k);
      bg.imageSmoothingEnabled = false;
      bg.translate(Math.round(p.x), MAZE_Y + Math.round(p.y));
      bg.rotate(k * 2.6);
      bg.scale(1 - k * 0.5, 1 - k * 0.5);
      var d0 = HU.dims(HU.CAST.bp);
      var o2 = { tier: tier, expr: 'soy', topOverride: PLAYER_TOPS[tier] };
      bg.drawImage(HU.build(HU.CAST.bp, 'front', 'idle', 0, o2), -d0.ax, -d0.ay);
      bg.restore();
      if (G.stateT < 1.2) {
        FT.text(bg, 'MOGGED  -0.70 PSL', VIEW_W / 2, MAZE_Y + p.y - 52,
          { color: '#ff5b7a', align: 'center', shadow: '#000' });
      }
      return;
    }

    if (G.aura >= 100 || G.mogTimer > 0) {
      var rad = 24 + Math.sin(G.t * 8) * 3;
      var col = G.mogTimer > 0 ? '255,215,94' : '255,180,60';
      var gr = bg.createRadialGradient(p.x, MAZE_Y + p.y - 8, 2, p.x, MAZE_Y + p.y - 8, rad);
      gr.addColorStop(0, 'rgba(' + col + ',0.30)');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      bg.fillStyle = gr;
      bg.fillRect(p.x - rad, MAZE_Y + p.y - 8 - rad, rad * 2, rad * 2);
      for (var i = 0; i < 6; i++) {
        var a = G.t * 3 + i * (Math.PI / 3);
        var rr = rad - 5 + Math.sin(G.t * 9 + i) * 2;
        bg.fillStyle = i % 2 ? '#ffd75e' : '#fff3c4';
        bg.fillRect(Math.round(p.x + Math.cos(a) * rr), Math.round(MAZE_Y + p.y - 8 + Math.sin(a) * rr), 2, 2);
      }
    }
    if (p.running && p.moving) {                 // speed streaks
      for (var s = 0; s < 3; s++) {
        bg.fillStyle = 'rgba(200,220,255,' + (0.3 - s * 0.08) + ')';
        bg.fillRect(Math.round(p.x - p.dir[0] * (8 + s * 5) - 3), MAZE_Y + Math.round(p.y - 6 + s * 4), 6, 1);
      }
    }

    if (p.invuln > 0 && Math.floor(G.t * 16) % 2) return;
    var pose = p.stun > 0 ? 'down' : (p.moving ? (p.running ? 'run' : 'walk') : 'idle');
    drawPerson(HU.CAST.bp, p.x, p.y, p.vw, p.flip, pose, p.frame, opts);

    if (G.mogTimer > 0 && p.stun <= 0) {         // the hammer, shouldered
      var hx = Math.round(p.x) + (p.vw === 'side' && p.flip ? -19 : 5);
      bg.save();
      bg.imageSmoothingEnabled = false;
      if (p.swing > 0) {
        bg.translate(hx + 7, MAZE_Y + Math.round(p.y) - 4);
        bg.rotate(Math.PI * 0.55 * (p.flip ? -1 : 1));
        bg.drawImage(S.HAMMER, -7, -7);
      } else {
        bg.drawImage(S.HAMMER, hx, MAZE_Y + Math.round(p.y) - 14);
      }
      bg.restore();
    }
  }

  function drawFx() {
    var i, p;
    if (G.wave) {
      var a = Math.max(0, G.wave.life / 0.85);
      bg.strokeStyle = 'rgba(255,215,94,' + (a * 0.9) + ')';
      bg.lineWidth = 3;
      bg.beginPath(); bg.arc(G.wave.x, MAZE_Y + G.wave.y, G.wave.r, 0, Math.PI * 2); bg.stroke();
      bg.strokeStyle = 'rgba(255,91,208,' + (a * 0.55) + ')';
      bg.lineWidth = 6;
      bg.beginPath(); bg.arc(G.wave.x, MAZE_Y + G.wave.y, Math.max(0, G.wave.r - 9), 0, Math.PI * 2); bg.stroke();
      bg.lineWidth = 1;
    }
    for (i = 0; i < G.particles.length; i++) {
      p = G.particles[i];
      bg.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      bg.fillStyle = p.col;
      bg.fillRect(Math.round(p.x), MAZE_Y + Math.round(p.y), p.size, p.size);
    }
    bg.globalAlpha = 1;
    for (i = 0; i < G.pops.length; i++) {
      p = G.pops[i];
      bg.globalAlpha = Math.max(0, Math.min(1, p.life / 0.8));
      FT.text(bg, p.text, p.x, MAZE_Y + p.y, { color: p.col, align: 'center', shadow: '#000' });
    }
    bg.globalAlpha = 1;
  }

  /* ---------------- HUD ---------------- */
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function pslBar(x, y, w, h) {
    bg.fillStyle = '#0b0e18';
    bg.fillRect(x, y, w, h);
    var i, tx;
    for (i = 1; i < TIERS.length; i++) {          // tier gates
      tx = x + Math.round(w * (TIERS[i].psl - 1) / 9);
      bg.fillStyle = 'rgba(255,255,255,0.16)';
      bg.fillRect(tx, y, 1, h);
    }
    var fw = Math.round(w * Math.max(0, (G.psl - 1) / 9));
    var grd = bg.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, '#4de1ff');
    grd.addColorStop(0.55, '#ff5bd0');
    grd.addColorStop(1, '#ffd75e');
    bg.fillStyle = grd;
    bg.fillRect(x, y, fw, h);
    bg.fillStyle = 'rgba(255,255,255,0.28)';
    bg.fillRect(x, y, fw, 1);
    // best-so-far marker
    var bx = x + Math.round(w * Math.max(0, (G.best - 1) / 9));
    bg.fillStyle = '#ffffff';
    bg.fillRect(bx, y - 2, 1, h + 4);
    bg.strokeStyle = 'rgba(255,255,255,0.3)';
    bg.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function meter(x, y, w, h, v, col, back) {
    bg.fillStyle = back; bg.fillRect(x, y, w, h);
    var fw = Math.round(w * Math.max(0, Math.min(1, v)));
    bg.fillStyle = col; bg.fillRect(x, y, fw, h);
    bg.fillStyle = 'rgba(255,255,255,0.2)'; bg.fillRect(x, y, fw, 1);
    bg.strokeStyle = 'rgba(255,255,255,0.22)';
    bg.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawHud() {
    bg.drawImage(G.skyImg, 0, 0);
    bg.fillStyle = 'rgba(5,6,11,0.5)';
    bg.fillRect(0, 0, VIEW_W, HUD_TOP);

    FT.text(bg, 'PSL', 8, 5, { color: '#9fb4ff' });
    FT.text(bg, G.psl.toFixed(2), 8, 15, { color: '#ffffff', scale: 4, shadow: '#2a1140' });
    pslBar(112, 31, 240, 9);
    FT.text(bg, TIERS[G.tier].name, 112, 19, { color: '#ffd75e' });
    var nx = TIERS[Math.min(TIERS.length - 1, G.tier + 1)];
    FT.text(bg, G.tier >= TIERS.length - 1 ? 'MAX TIER' : 'NEXT ' + nx.psl.toFixed(1),
      352, 19, { color: '#6f7bb0', align: 'right' });
    FT.text(bg, G.district ? G.district.name : '', VIEW_W - 8, 5,
      { color: G.district ? G.district.neon : '#fff', align: 'right' });
    FT.text(bg, 'BEST ' + G.best.toFixed(2), VIEW_W - 8, 16, { color: '#ffd75e', align: 'right' });
    FT.text(bg, 'SCORE ' + pad(G.score, 6), VIEW_W - 8, 27, { color: '#cfd6e4', align: 'right' });
    FT.text(bg, 'BLOCK ' + pad(G.level, 2), VIEW_W - 8, 38, { color: '#6f7bb0', align: 'right' });

    bg.fillStyle = G.district ? G.district.neon : '#4de1ff';
    bg.fillRect(0, HUD_TOP - 1, VIEW_W, 1);
    bg.fillRect(0, HUD_Y, VIEW_W, 1);

    var grd = bg.createLinearGradient(0, HUD_Y, 0, VIEW_H);
    grd.addColorStop(0, '#141033');
    grd.addColorStop(1, '#07060f');
    bg.fillStyle = grd;
    bg.fillRect(0, HUD_Y + 1, VIEW_W, HUD_BOT);

    var py = HUD_Y + 8;
    bg.fillStyle = '#0b0d18';
    bg.fillRect(6, py, 44, 50);
    bg.strokeStyle = G.district ? G.district.neon : '#4de1ff';
    bg.strokeRect(6.5, py + 0.5, 43, 49);
    bg.save();
    bg.imageSmoothingEnabled = false;
    bg.drawImage(faceImg('front', faceTier()), 8, py + 1, FACE.W * 2, FACE.H * 2);
    bg.restore();

    FT.text(bg, 'STAMINA', 58, HUD_Y + 8, { color: '#9fb4ff' });
    meter(112, HUD_Y + 7, 120, 7, G.stamina / 100,
      G.stamina < 20 ? '#ff5b7a' : '#4dff9e', '#101a33');
    FT.text(bg, 'SHIFT TO RUN', 240, HUD_Y + 8, { color: G.player && G.player.running ? '#4dff9e' : '#4a5578' });

    FT.text(bg, 'AURA', 58, HUD_Y + 22, { color: '#9fb4ff' });
    var ready = G.aura >= 100;
    meter(112, HUD_Y + 21, 120, 7, G.aura / 100,
      ready ? (Math.floor(G.t * 8) % 2 ? '#fff3c4' : '#ffd75e') : '#4de1ff', '#101a33');
    FT.text(bg, ready ? 'SPACE = BURST' : 'CHARGING',
      240, HUD_Y + 22, { color: ready ? (Math.floor(G.t * 4) % 2 ? '#ffd75e' : '#ff5bd0') : '#4a5578' });

    if (G.mogTimer > 0) {
      FT.text(bg, 'HAMMER ' + G.mogTimer.toFixed(1) + '  X' + Math.max(1, G.mogStreak),
        58, HUD_Y + 36, { color: '#ffd75e' });
    } else if (G.boss && G.boss.hp > 0) {
      FT.text(bg, 'APEX HP ' + G.boss.hp + '  -  HAMMER OR AURA ONLY',
        58, HUD_Y + 36, { color: '#ff5b7a' });
    } else {
      FT.text(bg, 'MOGS ' + G.mogs + '   PILLS LEFT ' + G.pillsLeft, 58, HUD_Y + 36, { color: '#6f7bb0' });
    }
    FT.text(bg, 'GOAL: HIGHEST PSL     CABS COST YOU RATING', 58, HUD_Y + 48, { color: '#4a5578' });

    for (var i = 0; i < Math.max(0, G.lives - 1); i++) {
      bg.save();
      bg.imageSmoothingEnabled = false;
      bg.drawImage(faceImg('front', faceTier()), VIEW_W - 26 - i * 22, HUD_Y + 10, 20, 24);
      bg.restore();
    }
    FT.text(bg, 'LIVES', VIEW_W - 8, HUD_Y + 38, { color: '#6f7bb0', align: 'right' });
    if (A.isMuted()) FT.text(bg, 'MUTED', VIEW_W - 8, HUD_Y + 50, { color: '#ff5b7a', align: 'right' });
  }

  /* ---------------- overlays ---------------- */
  function dim(a) { bg.fillStyle = 'rgba(4,5,12,' + a + ')'; bg.fillRect(0, 0, VIEW_W, VIEW_H); }

  function drawOverlays() {
    var cy = MAZE_Y + M.H / 2;
    if (G.state === 'ready') {
      var boss = CITY.isBoss(G.level);
      FT.text(bg, G.district.name, VIEW_W / 2, cy - 46,
        { color: G.district.neon, align: 'center', scale: 3, shadow: '#000' });
      FT.text(bg, G.district.sub, VIEW_W / 2, cy - 18, { color: '#9fb4ff', align: 'center' });
      if (Math.floor(G.stateT * 3) % 2 === 0 || G.stateT > 1.4) {
        FT.text(bg, boss ? 'APEX IS HERE' : 'RAISE YOUR PSL', VIEW_W / 2, cy + 6,
          { color: '#ffd75e', align: 'center', scale: 3, shadow: '#5a1a3a' });
      }
      FT.text(bg, 'ARROWS OR WASD - WALK     SHIFT - RUN', VIEW_W / 2, cy + 44,
        { color: '#9fb4ff', align: 'center' });
    }
    if (G.paused) {
      dim(0.72);
      FT.text(bg, 'PAUSED', VIEW_W / 2, cy - 10, { color: '#fff', align: 'center', scale: 4, shadow: '#ff5bd0' });
      FT.text(bg, 'P TO RESUME   M MUTE', VIEW_W / 2, cy + 30, { color: '#9fb4ff', align: 'center' });
    }
    if (G.state === 'ascend') drawAscend();
    if (G.state === 'levelclear' && G.bossDown) {
      FT.text(bg, 'APEX IS MOGGED', VIEW_W / 2, cy - 30,
        { color: '#ffd75e', align: 'center', scale: 3, shadow: '#000' });
      FT.text(bg, '+1.20 PSL', VIEW_W / 2, cy + 6, { color: '#7cf5d0', align: 'center', scale: 2 });
    }
    if (G.state === 'gameover') drawGameOver(cy);
  }

  function drawGameOver(cy) {
    dim(0.85);
    var best = G.peak >= G.best;
    FT.text(bg, 'RUN OVER', VIEW_W / 2, cy - 150, { color: '#ff5b7a', align: 'center', scale: 3, shadow: '#000' });
    bg.save(); bg.imageSmoothingEnabled = false;
    bg.drawImage(faceImg('front', faceTier()), VIEW_W / 2 - 110, cy - 110, 100, 120);
    bg.drawImage(faceImg('side', faceTier()), VIEW_W / 2 + 10, cy - 110, 100, 120);
    bg.restore();
    FT.text(bg, 'FINAL PSL', VIEW_W / 2, cy + 26, { color: '#9fb4ff', align: 'center' });
    FT.text(bg, G.peak.toFixed(2), VIEW_W / 2, cy + 40,
      { color: '#ffd75e', align: 'center', scale: 5, shadow: '#2a1140' });
    FT.text(bg, TIERS[tierFor(G.peak)].name, VIEW_W / 2, cy + 86,
      { color: '#7cf5d0', align: 'center', scale: 2 });
    if (best && Math.floor(G.t * 3) % 2) {
      FT.text(bg, 'NEW PERSONAL BEST', VIEW_W / 2, cy + 112, { color: '#ff5bd0', align: 'center', scale: 2 });
    } else {
      FT.text(bg, 'BEST ' + G.best.toFixed(2), VIEW_W / 2, cy + 112, { color: '#6f7bb0', align: 'center' });
    }
    FT.text(bg, 'MOGS ' + G.mogs + '   BLOCKS ' + G.level + '   SCORE ' + pad(G.score, 6),
      VIEW_W / 2, cy + 136, { color: '#cfd6e4', align: 'center' });
    if (Math.floor(G.t * 2) % 2) {
      FT.text(bg, 'PRESS ENTER TO RUN IT BACK', VIEW_W / 2, cy + 162, { color: '#4de1ff', align: 'center' });
    }
  }

  function drawAscend() {
    var k = Math.min(1, G.stateT / 0.35);
    dim(0.88 * k);
    var cy = MAZE_Y + M.H / 2;
    var to = TIERS[G.tier];
    FT.text(bg, 'PSL ' + G.psl.toFixed(2), VIEW_W / 2, cy - 150, { color: '#9fb4ff', align: 'center', scale: 2 });
    FT.text(bg, to.name, VIEW_W / 2, cy - 122,
      { color: Math.floor(G.t * 8) % 2 ? '#ffd75e' : '#ff5bd0', align: 'center', scale: 4, shadow: '#000' });

    var sc = 4, fw = FACE.W * sc, fh = FACE.H * sc, gap = 20;
    var x0 = Math.round((VIEW_W - (fw * 3 + gap * 2)) / 2);
    var top = cy - 60, showNew = G.stateT > 0.85;
    bg.save();
    bg.imageSmoothingEnabled = false;
    bg.globalAlpha = 0.4;
    bg.drawImage(faceImg('front', G.ascendFrom), x0, top, fw, fh);
    bg.globalAlpha = 1;
    if (showNew) {
      bg.globalAlpha = Math.min(1, (G.stateT - 0.85) / 0.35);
      bg.drawImage(faceImg('front', G.ascendTo), x0 + fw + gap, top, fw, fh);
      bg.drawImage(faceImg('side', G.ascendTo), x0 + (fw + gap) * 2, top, fw, fh);
      bg.globalAlpha = 1;
      bg.strokeStyle = '#ffd75e';
      bg.strokeRect(x0 + fw + gap - 2.5, top - 2.5, fw * 2 + gap + 5, fh + 5);
    }
    bg.restore();
    FT.text(bg, 'BEFORE', x0 + fw / 2, top + fh + 8, { color: '#6f7bb0', align: 'center' });
    if (showNew) {
      FT.text(bg, 'AFTER', x0 + fw * 2 + gap * 1.5, top + fh + 8, { color: '#ffd75e', align: 'center' });
      FT.text(bg, to.blurb, VIEW_W / 2, top + fh + 30, { color: '#7cf5d0', align: 'center' });
    }
    FT.text(bg, '>', x0 + fw + gap / 2 - 1, top + fh / 2 - 10, { color: '#ffd75e', align: 'center', scale: 2 });
  }

  /* ---------------- title ---------------- */
  function drawTitle() {
    if (!G.titleSky) G.titleSky = CITY.skyline(VIEW_W, VIEW_H, 1, 190);
    bg.drawImage(G.titleSky, 0, 0);
    bg.fillStyle = 'rgba(5,6,14,0.5)';
    bg.fillRect(0, 0, VIEW_W, VIEW_H);

    FT.text(bg, 'BP MAN', VIEW_W / 2, 34, { color: '#ffd75e', align: 'center', scale: 6, shadow: '#ff5bd0' });
    FT.text(bg, 'PSL CITY', VIEW_W / 2, 88, { color: '#4de1ff', align: 'center', scale: 3, shadow: '#0b2a3a' });
    FT.text(bg, 'RAISE YOUR RATING ON THE STREETS OF NEW YORK',
      VIEW_W / 2, 118, { color: '#9fb4ff', align: 'center' });

    var sc = 3, fw = FACE.W * sc, fh = FACE.H * sc;
    var total = 5 * fw + 4 * 6, x0 = Math.round((VIEW_W - total) / 2);
    var lit = Math.floor(G.t * 1.6) % 5;
    bg.save(); bg.imageSmoothingEnabled = false;
    for (var i = 0; i < 5; i++) {
      var x = x0 + i * (fw + 6);
      bg.fillStyle = i === lit ? '#191330' : '#0d0b1c';
      bg.fillRect(x - 2, 138, fw + 4, fh + 4);
      bg.globalAlpha = i === lit ? 1 : 0.82;
      bg.drawImage(faceImg('front', i), x, 140, fw, fh);
      bg.globalAlpha = 1;
      bg.strokeStyle = i === lit ? '#ffd75e' : '#2a2450';
      bg.strokeRect(x - 1.5, 138.5, fw + 3, fh + 3);
      FT.text(bg, TIERS[i].psl ? TIERS[i].psl.toFixed(1) : '1.0', x + fw / 2, 140 + fh + 4,
        { color: i === lit ? '#ffd75e' : '#4a5578', align: 'center' });
    }
    bg.restore();
    FT.text(bg, TIERS[lit].name, VIEW_W / 2, 140 + fh + 18, { color: '#ffd75e', align: 'center', scale: 2 });
    FT.text(bg, TIERS[lit].blurb, VIEW_W / 2, 140 + fh + 38, { color: '#9fb4ff', align: 'center' });

    var y = 300;
    [['BLACK PILLS', 'EVERY ONE NUDGES YOUR PSL AND YOUR AURA'],
     ['HAMMERS', 'THE HATERS TURN COOKED - GO SMASH THEM'],
     ['FULL AURA', 'SPACE FOR A BURST THAT MOGS THE WHOLE BLOCK'],
     ['YELLOW CABS', 'THE AVENUES ARE LIVE - GETTING CLIPPED COSTS PSL'],
     ['APEX', 'EVERY FOURTH BLOCK. HAMMER OR AURA ONLY'],
     ['GOAL', 'FINISH WITH THE HIGHEST PSL YOU CAN']
    ].forEach(function (l, i) {
      FT.text(bg, l[0], 26, y + i * 17, { color: '#ffd75e' });
      FT.text(bg, l[1], 128, y + i * 17, { color: '#cfd6e4' });
    });

    y = 412;
    bg.save(); bg.imageSmoothingEnabled = false;
    RIVAL_KEYS.forEach(function (k, i) {
      var spec = HU.CAST[k], d = HU.dims(spec);
      bg.drawImage(HU.build(spec, 'front', 'walk', 0, { expr: 'smug' }), 22 + i * 52, y);
      FT.text(bg, spec.name, 22 + i * 52 + d.ax, y + d.H + 2, { color: '#9fb4ff', align: 'center' });
    });
    var ad = HU.dims(HU.CAST.apex);
    bg.drawImage(HU.build(HU.CAST.apex, 'front', 'idle', 0, { expr: 'angry' }), 236, y - 4);
    FT.text(bg, 'APEX', 236 + ad.ax, y + ad.H, { color: '#ff5b7a', align: 'center' });
    bg.drawImage(TR.sprite(TR.TYPES[0], 'right'), 290, y + 14);
    FT.text(bg, 'CAB', 305, y + 34, { color: '#f2c12e', align: 'center' });
    bg.drawImage(S.HAMMER, 340, y + 10);
    FT.text(bg, 'HAMMER', 347, y + 34, { color: '#ffd75e', align: 'center' });
    bg.drawImage(S.PILL, 384, y + 14, 24, 18);
    FT.text(bg, 'PILL', 396, y + 34, { color: '#b47dff', align: 'center' });
    bg.restore();

    if (Math.floor(G.t * 2) % 2) {
      FT.text(bg, 'PRESS ENTER OR CLICK TO START', VIEW_W / 2, VIEW_H - 54,
        { color: '#ffffff', align: 'center', scale: 2, shadow: '#ff5bd0' });
    }
    FT.text(bg, 'ARROWS / WASD  MOVE    SHIFT  RUN    SPACE  AURA    P  PAUSE    M  MUTE',
      VIEW_W / 2, VIEW_H - 26, { color: '#6f7bb0', align: 'center' });
    FT.text(bg, 'BEST PSL ' + G.best.toFixed(2), VIEW_W / 2, VIEW_H - 12,
      { color: '#ffd75e', align: 'center' });
  }

  /* ---------------- input ---------------- */
  function setDir(d) { if (G.state === 'play' || G.state === 'ready') G.player.want = d; }

  function newGame(startLevel) {
    G.score = 0; G.level = startLevel || 1; G.lives = 3;
    G.psl = 2.0; G.peak = 2.0; G.tier = 0; G.mogs = 0;
    G.aura = 0; G.stamina = 100;
    G.particles = []; G.pops = []; G.wave = null;
    loadLevel();
    G.state = 'ready'; G.stateT = 0;
    A.init(); A.resume(); A.sfx.start();
  }

  function keydown(e) {
    var k = e.key;
    A.resume();
    if (k === 'ArrowUp' || k === 'w' || k === 'W') setDir(UP);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') setDir(DOWN);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') setDir(LEFT);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') setDir(RIGHT);
    else if (k === 'Shift') { if (G.player) G.player.wantRun = true; }
    else if (k === ' ') fireAura();
    else if (k === 'p' || k === 'P') { if (G.state === 'play') { G.paused = !G.paused; A.sfx.ui(); } }
    else if (k === 'm' || k === 'M') { A.toggle(); A.sfx.ui(); }
    else if (k === 'Enter') { if (G.state === 'title' || G.state === 'gameover') newGame(); }
    else return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(k) >= 0) e.preventDefault();
  }
  function keyup(e) { if (e.key === 'Shift' && G.player) G.player.wantRun = false; }

  function bindTouch(el) {
    var sx = 0, sy = 0, st = 0, held = null;
    el.addEventListener('touchstart', function (e) {
      var t0 = e.changedTouches[0];
      sx = t0.clientX; sy = t0.clientY; st = Date.now();
      A.resume();
      held = setTimeout(function () { if (G.player) G.player.wantRun = true; }, 220);
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      clearTimeout(held);
      if (G.player) G.player.wantRun = false;
      var t0 = e.changedTouches[0];
      var dx = t0.clientX - sx, dy = t0.clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && Date.now() - st < 400) {
        if (G.state === 'title' || G.state === 'gameover') newGame();
        else fireAura();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? RIGHT : LEFT);
      else setDir(dy > 0 ? DOWN : UP);
    }, { passive: true });
    el.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  function start(el) {
    setup(el);
    loadLevel();
    G.state = 'title';
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    el.addEventListener('keydown', keydown);
    el.addEventListener('keyup', keyup);
    el.setAttribute('tabindex', '0');
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    bindTouch(el);
    el.addEventListener('mousedown', function () {
      A.resume();
      try { el.focus({ preventScroll: true }); } catch (e) {}
      if (G.state === 'title' || G.state === 'gameover') newGame();
    });

    var last = performance.now(), acc = 0, STEP = 1 / 60;
    function frame(now) {
      var dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!G.paused) {
        acc += dt;
        var guard = 0;
        while (acc >= STEP && guard++ < 8) { update(STEP); acc -= STEP; }
      } else G.t += dt;
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  BP.game = {
    start: start, state: G, TIERS: TIERS, VIEW_W: VIEW_W, VIEW_H: VIEW_H,
    _update: update, _newGame: newGame, _fireAura: fireAura, _setDir: setDir,
    _tierFor: tierFor, _dirs: { UP: UP, DOWN: DOWN, LEFT: LEFT, RIGHT: RIGHT }
  };
})(window.BP = window.BP || {});
