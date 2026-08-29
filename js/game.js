/* ------------------------------------------------------------------
   game.js -- BP MAN: MOG CITY
   Eat black pills for AURA, grab hammers to go loud, mog the haters,
   and ascend from soft-faced NPC to jawline + hunter eyes.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var M = BP.maze, S = BP.sprites, CITY = BP.city, FT = BP.font, A = BP.audio, FACE = BP.face;
  var T = M.TILE;

  var HUD_TOP = 40, HUD_BOT = 62;
  var VIEW_W = M.W, VIEW_H = HUD_TOP + M.H + HUD_BOT;
  var MAZE_Y = HUD_TOP, HUD_Y = HUD_TOP + M.H;

  var TIERS = [
    { name: 'SOFT',        need: 0,  blurb: 'ROUND SKULL. NO ANGLES. NPC ENERGY.' },
    { name: 'SHARPENING',  need: 3,  blurb: 'THE BLOAT IS LEAVING. BROWS DROPPED.' },
    { name: 'JAWLINE',     need: 8,  blurb: 'MANDIBLE ACQUIRED. CHEEKS HOLLOW.' },
    { name: 'HUNTER EYES', need: 15, blurb: 'HOODED. TILTED. PERMANENTLY UNBOTHERED.' },
    { name: 'GIGACHAD',    need: 24, blurb: 'MAXIMUM HANDSOME. THE CITY IS MOGGED.' }
  ];
  var RIVAL_NAMES = ['ENVY', 'SMIRK', 'SHADE', 'LURK'];

  var UP = [0, -1], DOWN = [0, 1], LEFT = [-1, 0], RIGHT = [1, 0];
  var DIRS = [UP, LEFT, DOWN, RIGHT];   // classic tie-break order

  /* ---------------- canvas plumbing ---------------- */
  var view, vg, buf, bg;

  function setup(canvasEl) {
    view = canvasEl;
    vg = view.getContext('2d');
    var b = S.canvas(VIEW_W, VIEW_H);
    buf = b.c; bg = b.g;
    bg.imageSmoothingEnabled = false;
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    var pad = 8;
    var aw = Math.max(160, window.innerWidth - pad * 2);
    var ah = Math.max(160, window.innerHeight - pad * 2);
    var fit = Math.min(aw / VIEW_W, ah / VIEW_H);
    var k = fit >= 1 ? Math.floor(fit) : fit;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cssW = Math.round(VIEW_W * k), cssH = Math.round(VIEW_H * k);
    view.style.width = cssW + 'px';
    view.style.height = cssH + 'px';
    view.width = Math.round(cssW * dpr);
    view.height = Math.round(cssH * dpr);
    vg = view.getContext('2d');
    vg.imageSmoothingEnabled = false;
  }

  /* ---------------- world state ---------------- */
  var G = {
    state: 'title', t: 0, stateT: 0,
    score: 0, high: 0, level: 1, lives: 3,
    mogs: 0, tier: 0, ascended: false,
    aura: 0, mogTimer: 0, mogStreak: 0,
    grid: null, pillsLeft: 0, pillsEaten: 0,
    mazeImg: null, pillImg: null, skyImg: null, neon: null,
    hammers: [], bonus: null, bonusShown: 0,
    player: null, rivals: [],
    phase: 0, phaseT: 0, freeze: 0, shake: 0,
    particles: [], pops: [], wave: null,
    ascendFrom: 0, ascendTo: 0,
    paused: false, hintT: 0, titleSky: null
  };

  try { G.high = parseInt(localStorage.getItem('bpman.high'), 10) || 0; } catch (e) { G.high = 0; }

  var PHASES = [7, 20, 7, 20, 5, 20, 5, 1e9];  // scatter / chase alternation

  function mkPlayer() {
    return {
      x: (M.playerSpawn.c + 0.5) * T, y: (M.playerSpawn.r + 0.5) * T,
      dir: LEFT, want: null, view: 'side', flip: true,
      anim: 0, frame: 0, mouth: 0, moving: false, swing: 0
    };
  }

  function mkRival(i) {
    var s = M.rivalSpawns[i];
    return {
      kind: i, name: RIVAL_NAMES[i],
      x: (s.c + 0.5) * T, y: (s.r + 0.5) * T,
      home: { x: (s.c + 0.5) * T, y: (s.r + 0.5) * T },
      dir: i === 0 ? LEFT : (i === 1 ? UP : DOWN),
      mode: i === 0 ? 'roam' : 'house',
      houseT: [0, 1.2, 4.0, 7.5][i],
      bob: 0, anim: 0, frame: 0, tileKey: '', revive: 0
    };
  }

  function loadLevel(full) {
    var built = M.build();
    G.grid = built.grid;
    G.pillsLeft = built.pills;
    G.pillsEaten = 0;
    G.neon = CITY.neonFor(G.level);
    G.mazeImg = CITY.build(G.grid, G.level);
    G.pillImg = CITY.pillLayer(G.grid);
    G.skyImg = CITY.skyline(VIEW_W, HUD_TOP, G.level);
    G.hammers = [];
    for (var r = 0; r < M.ROWS; r++)
      for (var c = 0; c < M.COLS; c++)
        if (G.grid[r][c] === M.HAMMER) G.hammers.push({ c: c, r: r });
    G.bonus = null; G.bonusShown = 0;
    resetActors();
    if (full) { G.mogTimer = 0; G.mogStreak = 0; }
  }

  function resetActors() {
    G.player = mkPlayer();
    G.rivals = [mkRival(0), mkRival(1), mkRival(2), mkRival(3)];
    G.phase = 0; G.phaseT = 0;
    G.mogTimer = 0; G.mogStreak = 0;
    G.freeze = 0;
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
    var blocked = !canEnter(c + e.dir[0], r + e.dir[1], gate);
    if (blocked) {
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
    return !blocked;
  }

  /* ---------------- rival brains ---------------- */
  function tileC(e) { return Math.floor(e.x / T); }
  function tileR(e) { return Math.floor(e.y / T); }

  function chaseTarget(gh) {
    var p = G.player, pc = tileC(p), pr = tileR(p);
    if (gh.kind === 0) return { c: pc, r: pr };
    if (gh.kind === 1) return { c: pc + p.dir[0] * 4, r: pr + p.dir[1] * 4 };
    if (gh.kind === 2) {
      var b = G.rivals[0];
      var ax = pc + p.dir[0] * 2, ay = pr + p.dir[1] * 2;
      return { c: ax + (ax - tileC(b)), r: ay + (ay - tileR(b)) };
    }
    // LURK: charges from range, but backs off along your trail when
    // close, so he circles instead of parking in a corner.
    var d = Math.hypot(pc - tileC(gh), pr - tileR(gh));
    return d > 6 ? { c: pc, r: pr } : { c: pc - p.dir[0] * 6, r: pr - p.dir[1] * 6 };
  }

  function think(gh) {
    var c = tileC(gh), r = tileR(gh);
    var key = c + ',' + r;
    if (gh.tileKey === key) return;
    gh.tileKey = key;

    var gate = gh.mode === 'eyes';
    var target;
    if (gh.mode === 'eyes') target = { c: Math.floor(M.gate.c), r: M.gate.r };
    else if (gh.mode === 'cooked') target = null;
    else target = scattering() ? M.scatterTargets[gh.kind] : chaseTarget(gh);

    var best = null, bestD = Infinity, opts = [];
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i];
      if (d[0] === -gh.dir[0] && d[1] === -gh.dir[1]) continue;
      if (!canEnter(c + d[0], r + d[1], gate)) continue;
      opts.push(d);
      if (target) {
        var dist = (c + d[0] - target.c) * (c + d[0] - target.c) +
                   (r + d[1] - target.r) * (r + d[1] - target.r);
        if (dist < bestD) { bestD = dist; best = d; }
      }
    }
    if (!opts.length) { gh.dir = [-gh.dir[0], -gh.dir[1]]; return; }
    gh.dir = target ? best : opts[(Math.random() * opts.length) | 0];
  }

  function scattering() {
    return (G.phase % 2) === 0;
  }

  function rivalSpeed(gh) {
    var base = Math.min(1.85, 1.36 + (G.level - 1) * 0.055);
    if (gh.mode === 'eyes') return 3.4;
    if (gh.mode === 'cooked') return 0.82;
    if (Math.floor(gh.y / T) === M.TUNNEL_ROW &&
        (tileC(gh) < 6 || tileC(gh) > 21)) return base * 0.62;
    return base;
  }

  function playerSpeed() {
    var s = Math.min(1.98, 1.56 + (G.level - 1) * 0.05);
    return G.mogTimer > 0 ? s + 0.16 : s;
  }

  /* ---------------- effects ---------------- */
  function burstParticles(x, y, n, colors, power) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * (power || 2);
      G.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        col: colors[(Math.random() * colors.length) | 0],
        size: 1 + ((Math.random() * 2) | 0)
      });
    }
  }
  function pop(x, y, text, col) {
    G.pops.push({ x: x, y: y, text: text, col: col, life: 1.1 });
  }
  function shake(v) { G.shake = Math.max(G.shake, v); }

  /* ---------------- scoring / progression ---------------- */
  function addScore(n) {
    G.score += n;
    if (G.score > G.high) {
      G.high = G.score;
      try { localStorage.setItem('bpman.high', String(G.high)); } catch (e) {}
    }
  }

  function tierFor(mogs) {
    var t = 0;
    for (var i = 0; i < TIERS.length; i++) if (mogs >= TIERS[i].need) t = i;
    return t;
  }

  function addMog(x, y) {
    G.mogs++;
    var nt = tierFor(G.mogs);
    if (nt !== G.tier) {
      G.ascendFrom = G.tier; G.ascendTo = nt; G.tier = nt;
      if (nt === 4) G.ascended = true;
      G.state = 'ascend'; G.stateT = 0;
      A.sfx.tierUp();
    }
  }

  function mogRival(gh) {
    var pts = 200 * Math.pow(2, Math.min(3, G.mogStreak));
    G.mogStreak++;
    addScore(pts);
    gh.mode = 'eyes'; gh.tileKey = ''; gh.revive = 0;
    G.player.swing = 0.4;
    pop(gh.x, gh.y - 12, String(pts), '#ffd75e');
    pop(gh.x, gh.y - 24, 'MOGGED', '#ff5bd0');
    burstParticles(gh.x, gh.y, 26, ['#ffd75e', '#ff5bd0', '#ffffff', '#4de1ff'], 3);
    shake(5);
    G.freeze = 0.42;
    A.sfx.hammer();
    A.sfx.mog(G.mogStreak);
    addMog(gh.x, gh.y);
  }

  function startMogMode() {
    var dur = Math.max(3, 8.5 - (G.level - 1) * 0.5) + (G.ascended ? 2.5 : 0);
    G.mogTimer = dur;
    G.mogStreak = 0;
    G.rivals.forEach(function (gh) {
      if (gh.mode === 'roam') {
        gh.mode = 'cooked';
        gh.dir = [-gh.dir[0], -gh.dir[1]];
        gh.tileKey = '';
      }
    });
    shake(3);
    A.sfx.pickup();
  }

  function fireAura() {
    if (G.aura < 100 || G.state !== 'play') return;
    G.aura = 0;
    G.wave = { x: G.player.x, y: G.player.y, r: 0, life: 0.85, hit: [] };
    G.mogStreak = Math.max(G.mogStreak, 1);
    shake(9);
    burstParticles(G.player.x, G.player.y, 46, ['#ffd75e', '#fff3c4', '#ff5bd0'], 4);
    pop(G.player.x, G.player.y - 34, 'AURA BURST', '#ffd75e');
    A.sfx.aura();
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    G.t += dt; G.stateT += dt; G.hintT += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
    updateFx(dt);

    switch (G.state) {
      case 'title': break;
      case 'ready':
        if (G.stateT > 2.0) { G.state = 'play'; G.stateT = 0; }
        break;
      case 'play': play(dt); break;
      case 'dying':
        if (G.stateT > 2.3) {
          G.lives--;
          if (G.lives <= 0) {
            G.state = 'gameover'; G.stateT = 0; A.sfx.gameover();
          } else {
            resetActors(); G.state = 'ready'; G.stateT = 0; A.sfx.start();
          }
        }
        break;
      case 'levelclear':
        if (G.stateT > 2.6) {
          if (G.ascended) { G.state = 'victory'; G.stateT = 0; A.sfx.tierUp(); }
          else { G.level++; loadLevel(true); G.state = 'ready'; G.stateT = 0; A.sfx.start(); }
        }
        break;
      case 'ascend':
        if (G.stateT > 3.6) {
          G.state = G.pillsLeft <= 0 ? 'levelclear' : 'play';
          G.stateT = 0;
        }
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
        if (gh.mode === 'eyes' || gh.mode === 'house' || G.wave.hit.indexOf(i) >= 0) continue;
        if (Math.hypot(gh.x - G.wave.x, gh.y - G.wave.y) <= G.wave.r) {
          G.wave.hit.push(i);
          gh.mode = 'cooked';
          mogRival(gh);
          G.freeze = 0;
        }
      }
      if (G.wave.life <= 0) G.wave = null;
    }
  }

  function play(dt) {
    if (G.freeze > 0) { G.freeze -= dt; return; }

    // scatter/chase clock (frozen while the hammer is out)
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
        G.rivals.forEach(function (gh) {
          if (gh.mode === 'cooked' || gh.mode === 'flash') { gh.mode = 'roam'; gh.tileKey = ''; }
        });
      }
    }

    var p = G.player;
    step(p, playerSpeed(), false);
    if (p.moving) {
      p.anim += dt;
      p.mouth = (Math.floor(p.anim * 9) % 2);
      if (Math.floor(p.anim * 9) % 4 === 0) p.frame = 1; else p.frame = 0;
      p.frame = Math.floor(p.anim * 8) % 2;
    } else { p.mouth = 0; }
    if (p.dir === UP) p.view = 'back';
    else if (p.dir === DOWN) p.view = 'front';
    else { p.view = 'side'; p.flip = p.dir[0] < 0; }
    if (p.swing > 0) p.swing -= dt;

    eat();

    // rivals
    G.rivals.forEach(function (gh) {
      gh.anim += dt;
      gh.frame = Math.floor(gh.anim * 6) % 2;

      if (gh.mode === 'house') {
        gh.houseT -= dt;
        gh.bob += dt * 4;
        gh.y = gh.home.y + Math.sin(gh.bob) * 4;
        if (gh.houseT <= 0) { gh.mode = 'leave'; gh.tileKey = ''; }
        return;
      }
      if (gh.mode === 'leave') {
        var gx = (M.gate.c + 0.5) * T, gy = (M.gate.r - 0.6) * T;
        var sp = 1.5;
        if (Math.abs(gh.x - gx) > sp) gh.x += Math.sign(gx - gh.x) * sp;
        else {
          gh.x = gx;
          gh.y -= sp;
          if (gh.y <= gy) {
            gh.y = gy; gh.mode = 'roam'; gh.tileKey = '';
            gh.dir = Math.random() < 0.5 ? LEFT : RIGHT;
            if (G.mogTimer > 0) gh.mode = 'cooked';
          }
        }
        return;
      }
      if (gh.mode === 'eyes') {
        var hx = (M.houseCenter.c + 0.5) * T, hy = (M.houseCenter.r + 0.5) * T;
        if (Math.hypot(gh.x - hx, gh.y - hy) < 6) {
          gh.mode = 'house'; gh.houseT = 1.1; gh.x = hx; gh.y = hy; gh.tileKey = '';
          return;
        }
        think(gh);
        step(gh, rivalSpeed(gh), true);
        return;
      }
      think(gh);
      step(gh, rivalSpeed(gh), false);
    });

    collide();

    // bonus pickup lifetime
    if (G.bonus) {
      G.bonus.life -= dt;
      if (G.bonus.life <= 0) G.bonus = null;
    }
  }

  function eat() {
    var p = G.player;
    var c = tileC(p), r = tileR(p);
    if (c < 0 || c >= M.COLS || r < 0 || r >= M.ROWS) return;
    var t = G.grid[r][c];
    if (t === M.PILL || t === M.HAMMER) {
      G.grid[r][c] = M.EMPTY;
      G.pillsLeft--; G.pillsEaten++;
      G.pillImg.getContext('2d').clearRect(c * T, r * T, T, T);
      if (t === M.PILL) {
        addScore(10);
        G.aura = Math.min(100, G.aura + 1.8);
        A.sfx.chomp();
      } else {
        addScore(60);
        G.aura = Math.min(100, G.aura + 14);
        for (var i = 0; i < G.hammers.length; i++)
          if (G.hammers[i].c === c && G.hammers[i].r === r) G.hammers.splice(i, 1);
        burstParticles(p.x, p.y, 18, ['#ffd75e', '#e8eefc', '#ff5bd0'], 2.4);
        pop(p.x, p.y - 26, 'HAMMER TIME', '#ffd75e');
        startMogMode();
      }
      if ((G.pillsEaten === 70 || G.pillsEaten === 170) && !G.bonus) {
        G.bonusShown++;
        G.bonus = {
          idx: Math.min(G.level - 1, S.ITEMS.length - 1),
          x: (M.bonusSpot.c + 0.5) * T, y: (M.bonusSpot.r + 0.5) * T,
          life: 10
        };
      }
      if (G.pillsLeft <= 0) {
        G.state = 'levelclear'; G.stateT = 0;
        A.sfx.level();
      }
    }
    if (G.bonus && Math.hypot(p.x - G.bonus.x, p.y - G.bonus.y) < 13) {
      var it = S.ITEMS[G.bonus.idx];
      addScore(it.points);
      G.aura = Math.min(100, G.aura + 20);
      pop(G.bonus.x, G.bonus.y - 20, it.name, '#7cf5d0');
      pop(G.bonus.x, G.bonus.y - 32, '+' + it.points, '#ffd75e');
      burstParticles(G.bonus.x, G.bonus.y, 22, ['#7cf5d0', '#ffd75e', '#ffffff'], 2.6);
      if (G.bonus.idx === 3) startMogMode();
      G.bonus = null;
      A.sfx.pickup();
    }
  }

  function collide() {
    var p = G.player;
    for (var i = 0; i < G.rivals.length; i++) {
      var gh = G.rivals[i];
      if (gh.mode === 'eyes' || gh.mode === 'house' || gh.mode === 'leave') continue;
      if (Math.hypot(p.x - gh.x, p.y - gh.y) > 13) continue;
      if (gh.mode === 'cooked') mogRival(gh);
      else {
        G.state = 'dying'; G.stateT = 0;
        G.mogTimer = 0;
        shake(7);
        A.sfx.death();
        return;
      }
    }
  }

  /* ---------------- rendering ---------------- */
  var faceCache = {};
  function faceImg(v, tier, o) {
    var key = v + tier + (o && o.soy ? 's' : '') + (o && o.mouth ? 'm' : '');
    if (faceCache[key]) return faceCache[key];
    var b = S.canvas(FACE.W, FACE.H);
    FACE.draw(b.g, v, tier, o || {});
    faceCache[key] = b.c;
    return b.c;
  }

  function render() {
    bg.save();
    bg.fillStyle = '#05060b';
    bg.fillRect(0, 0, VIEW_W, VIEW_H);

    var sx = 0, sy = 0;
    if (G.shake > 0.2) {
      sx = (Math.random() - 0.5) * G.shake;
      sy = (Math.random() - 0.5) * G.shake;
    }

    if (G.state === 'title') { drawTitle(); bg.restore(); blit(); return; }

    bg.translate(Math.round(sx), Math.round(sy));
    drawMaze();
    drawActors();
    drawFx();
    bg.translate(-Math.round(sx), -Math.round(sy));

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

  function drawMaze() {
    bg.drawImage(G.mazeImg, 0, MAZE_Y);
    bg.drawImage(G.pillImg, 0, MAZE_Y);

    // hammers pulse on their pedestals
    var pulse = 0.55 + 0.45 * Math.sin(G.t * 6);
    G.hammers.forEach(function (h) {
      var x = h.c * T + 1, y = MAZE_Y + h.r * T + 1 + Math.round(Math.sin(G.t * 4 + h.c) * 1.2);
      var cx = x + 7, cy = y + 7, rad = 13 + pulse * 4;
      var gr = bg.createRadialGradient(cx, cy, 1, cx, cy, rad);
      gr.addColorStop(0, 'rgba(255,215,94,' + (0.42 * pulse + 0.18).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,215,94,0)');
      bg.fillStyle = gr;
      bg.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      bg.drawImage(S.BIGHAM, x, y);
    });

    if (G.bonus) {
      var by = MAZE_Y + G.bonus.y - 8 + Math.round(Math.sin(G.t * 5) * 2);
      if (G.bonus.life > 2 || Math.floor(G.t * 8) % 2) {
        bg.drawImage(S.item(G.bonus.idx), Math.round(G.bonus.x) - 7, Math.round(by));
      }
    }

    if (G.state === 'levelclear' && Math.floor(G.stateT * 6) % 2) {
      bg.globalAlpha = 0.5;
      bg.fillStyle = G.neon.hot;
      bg.globalCompositeOperation = 'overlay';
      bg.fillRect(0, MAZE_Y, M.W, M.H);
      bg.globalCompositeOperation = 'source-over';
      bg.globalAlpha = 1;
    }
  }

  function drawActors() {
    var i, gh, img;
    if (G.state !== 'dying') {
      for (i = 0; i < G.rivals.length; i++) {
        gh = G.rivals[i];
        var st = 'hunt';
        if (gh.mode === 'eyes') st = 'eyes';
        else if (gh.mode === 'cooked') {
          st = (G.mogTimer < 2.2 && Math.floor(G.t * 8) % 2) ? 'flash' : 'cooked';
        }
        img = S.rival(gh.kind, st, gh.frame, gh.dir[0], gh.dir[1]);
        bg.drawImage(img, Math.round(gh.x) - S.RW / 2, MAZE_Y + Math.round(gh.y) - S.RH / 2 - 2);
      }
    }
    drawPlayer();
  }

  function drawPlayer() {
    var p = G.player;
    var px = Math.round(p.x) - S.ANCHOR_X;
    var py = MAZE_Y + Math.round(p.y) - S.ANCHOR_Y;

    if (G.state === 'dying') {
      var k = Math.min(1, G.stateT / 2.0);
      bg.save();
      bg.globalAlpha = Math.max(0, 1 - k);
      bg.translate(Math.round(p.x), MAZE_Y + Math.round(p.y));
      bg.rotate(k * 3.6);
      var sc = 1 - k * 0.6;
      bg.scale(sc, sc);
      bg.imageSmoothingEnabled = false;
      bg.drawImage(S.player('front', 0, 0, 0, 'soy'), -S.ANCHOR_X, -S.ANCHOR_Y);
      bg.restore();
      if (G.stateT < 1.0) {
        FT.text(bg, 'MOGGED BY A HATER', VIEW_W / 2, MAZE_Y + p.y - 44,
          { color: '#ff5b7a', align: 'center', scale: 1, shadow: '#000' });
      }
      return;
    }

    // aura glow when charged / powered
    if (G.aura >= 100 || G.mogTimer > 0) {
      var rad = 22 + Math.sin(G.t * 8) * 3;
      var col = G.mogTimer > 0 ? '255,215,94' : '255,180,60';
      var grd = bg.createRadialGradient(p.x, MAZE_Y + p.y, 2, p.x, MAZE_Y + p.y, rad);
      grd.addColorStop(0, 'rgba(' + col + ',0.30)');
      grd.addColorStop(1, 'rgba(' + col + ',0)');
      bg.fillStyle = grd;
      bg.fillRect(p.x - rad, MAZE_Y + p.y - rad, rad * 2, rad * 2);
      for (var i = 0; i < 6; i++) {
        var a = G.t * 3 + i * (Math.PI / 3);
        var rr = rad - 4 + Math.sin(G.t * 9 + i) * 2;
        bg.fillStyle = i % 2 ? '#ffd75e' : '#fff3c4';
        bg.fillRect(Math.round(p.x + Math.cos(a) * rr), Math.round(MAZE_Y + p.y + Math.sin(a) * rr), 2, 2);
      }
    }

    var state = G.mogTimer > 0 ? 'mog' : 'walk';
    var img = S.player(p.view, G.tier, p.frame, p.mouth, state);
    bg.save();
    bg.imageSmoothingEnabled = false;
    if (p.view === 'side' && p.flip) {
      bg.translate(Math.round(p.x), 0);
      bg.scale(-1, 1);
      bg.drawImage(img, -S.ANCHOR_X, py);
      if (G.mogTimer > 0) bg.drawImage(S.hammer(p.swing > 0 ? 2 : 0), 2, py + 10);
      bg.restore();
      return;
    }
    bg.drawImage(img, px, py);
    if (G.mogTimer > 0) {
      var hp = p.swing > 0 ? 2 : (p.view === 'back' ? 1 : 0);
      bg.drawImage(S.hammer(hp), px + 16, py + 10);
    }
    bg.restore();
  }

  function drawFx() {
    var i, p;
    if (G.wave) {
      var a = Math.max(0, G.wave.life / 0.85);
      bg.strokeStyle = 'rgba(255,215,94,' + (a * 0.9) + ')';
      bg.lineWidth = 3;
      bg.beginPath();
      bg.arc(G.wave.x, MAZE_Y + G.wave.y, G.wave.r, 0, Math.PI * 2);
      bg.stroke();
      bg.strokeStyle = 'rgba(255,91,208,' + (a * 0.55) + ')';
      bg.lineWidth = 6;
      bg.beginPath();
      bg.arc(G.wave.x, MAZE_Y + G.wave.y, Math.max(0, G.wave.r - 9), 0, Math.PI * 2);
      bg.stroke();
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
      bg.globalAlpha = Math.max(0, Math.min(1, p.life / 0.7));
      FT.text(bg, p.text, p.x, MAZE_Y + p.y, { color: p.col, align: 'center', shadow: '#000' });
    }
    bg.globalAlpha = 1;
  }

  /* ---------------- HUD ---------------- */
  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }

  function drawHud() {
    // top strip
    bg.drawImage(G.skyImg, 0, 0);
    bg.fillStyle = 'rgba(5,6,11,0.45)';
    bg.fillRect(0, 0, VIEW_W, HUD_TOP);
    FT.text(bg, 'SCORE', 8, 6, { color: '#9fb4ff' });
    FT.text(bg, pad(G.score, 6), 8, 17, { color: '#ffffff', scale: 2, shadow: '#2a1140' });
    FT.text(bg, 'HI', VIEW_W - 8, 6, { color: '#9fb4ff', align: 'right' });
    FT.text(bg, pad(G.high, 6), VIEW_W - 8, 17, { color: '#ffd75e', scale: 2, align: 'right', shadow: '#2a1140' });
    FT.text(bg, 'BP MAN', VIEW_W / 2, 6, { color: G.neon.hot, align: 'center' });
    FT.text(bg, 'CITY ' + pad(G.level, 2), VIEW_W / 2, 20, { color: '#ffffff', align: 'center' });

    bg.fillStyle = G.neon.hot;
    bg.fillRect(0, HUD_TOP - 1, VIEW_W, 1);
    bg.fillRect(0, HUD_Y, VIEW_W, 1);

    // bottom panel
    var grd = bg.createLinearGradient(0, HUD_Y, 0, VIEW_H);
    grd.addColorStop(0, '#141033');
    grd.addColorStop(1, '#07060f');
    bg.fillStyle = grd;
    bg.fillRect(0, HUD_Y + 1, VIEW_W, HUD_BOT);

    // portrait
    var py = HUD_Y + 6;
    bg.fillStyle = '#0b0d18';
    bg.fillRect(6, py, 44, 50);
    bg.strokeStyle = G.neon.hot;
    bg.strokeRect(6.5, py + 0.5, 43, 49);
    bg.save();
    bg.imageSmoothingEnabled = false;
    bg.drawImage(faceImg('front', G.tier, {}), 8, py + 1, FACE.W * 2, FACE.H * 2);
    bg.restore();

    // tier + progress
    var tier = TIERS[G.tier];
    FT.text(bg, tier.name, 56, HUD_Y + 7, { color: '#ffd75e', shadow: '#000' });
    var next = TIERS[Math.min(TIERS.length - 1, G.tier + 1)];
    var prog, label;
    if (G.tier >= TIERS.length - 1) { prog = 1; label = 'MAXED'; }
    else {
      var lo = tier.need, hi = next.need;
      prog = Math.max(0, Math.min(1, (G.mogs - lo) / (hi - lo)));
      label = G.mogs + '/' + hi + ' MOGS';
    }
    barMeter(56, HUD_Y + 17, 150, 6, prog, '#ff5bd0', '#2a1140');
    FT.text(bg, label, 212, HUD_Y + 17, { color: '#9fb4ff' });

    // aura
    FT.text(bg, 'AURA', 56, HUD_Y + 30, { color: '#9fb4ff' });
    var ready = G.aura >= 100;
    barMeter(90, HUD_Y + 29, 150, 8, G.aura / 100,
      ready ? (Math.floor(G.t * 8) % 2 ? '#fff3c4' : '#ffd75e') : '#4de1ff', '#101a33');
    if (ready) {
      FT.text(bg, 'SPACE = BURST', 248, HUD_Y + 30,
        { color: Math.floor(G.t * 4) % 2 ? '#ffd75e' : '#ff5bd0' });
    } else if (G.mogTimer > 0) {
      FT.text(bg, 'HAMMER ' + G.mogTimer.toFixed(1), 248, HUD_Y + 30, { color: '#ffd75e' });
    }

    // goal line
    FT.text(bg, G.ascended ? 'GOAL COMPLETE: CLEAR THE CITY' : 'GOAL: JAWLINE + HUNTER EYES',
      56, HUD_Y + 44, { color: '#6f7bb0' });

    // lives
    for (var i = 0; i < G.lives - 1; i++) {
      bg.save();
      bg.imageSmoothingEnabled = false;
      bg.drawImage(faceImg('front', G.tier, {}), VIEW_W - 26 - i * 22, HUD_Y + 8, 20, 24);
      bg.restore();
    }
    FT.text(bg, 'LIVES', VIEW_W - 8, HUD_Y + 36, { color: '#6f7bb0', align: 'right' });
    if (A.isMuted()) FT.text(bg, 'MUTED', VIEW_W - 8, HUD_Y + 46, { color: '#ff5b7a', align: 'right' });
  }

  function barMeter(x, y, w, h, v, col, back) {
    bg.fillStyle = back;
    bg.fillRect(x, y, w, h);
    bg.fillStyle = col;
    bg.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), h);
    bg.fillStyle = 'rgba(255,255,255,0.18)';
    bg.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), 1);
    bg.strokeStyle = 'rgba(255,255,255,0.25)';
    bg.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  /* ---------------- overlays ---------------- */
  function dim(a) {
    bg.fillStyle = 'rgba(4,5,12,' + a + ')';
    bg.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawOverlays() {
    var cy = MAZE_Y + M.H / 2;
    if (G.state === 'ready') {
      FT.text(bg, 'CITY ' + pad(G.level, 2), VIEW_W / 2, cy - 34,
        { color: '#4de1ff', align: 'center', scale: 2, shadow: '#000' });
      if (Math.floor(G.stateT * 3) % 2 === 0 || G.stateT > 1.4) {
        FT.text(bg, 'GET HANDSOME', VIEW_W / 2, cy + 4,
          { color: '#ffd75e', align: 'center', scale: 3, shadow: '#5a1a3a' });
      }
      FT.text(bg, 'ARROWS OR WASD TO WALK', VIEW_W / 2, cy + 40, { color: '#9fb4ff', align: 'center' });
    }
    if (G.paused) {
      dim(0.72);
      FT.text(bg, 'PAUSED', VIEW_W / 2, cy - 10, { color: '#ffffff', align: 'center', scale: 4, shadow: '#ff5bd0' });
      FT.text(bg, 'P TO RESUME   M MUTE', VIEW_W / 2, cy + 30, { color: '#9fb4ff', align: 'center' });
    }
    if (G.state === 'ascend') drawAscend();
    if (G.state === 'gameover') {
      dim(0.82);
      FT.text(bg, 'YOU GOT MOGGED', VIEW_W / 2, cy - 70, { color: '#ff5b7a', align: 'center', scale: 3, shadow: '#000' });
      bg.save(); bg.imageSmoothingEnabled = false;
      bg.drawImage(faceImg('front', G.tier, {}), VIEW_W / 2 - 60, cy - 30, 120, 144);
      bg.restore();
      FT.text(bg, 'FINAL LOOK: ' + TIERS[G.tier].name, VIEW_W / 2, cy + 124, { color: '#ffd75e', align: 'center', scale: 2 });
      FT.text(bg, 'MOGS ' + G.mogs + '   SCORE ' + pad(G.score, 6), VIEW_W / 2, cy + 150, { color: '#ffffff', align: 'center' });
      if (Math.floor(G.t * 2) % 2) FT.text(bg, 'PRESS ENTER TO RUN IT BACK', VIEW_W / 2, cy + 176, { color: '#4de1ff', align: 'center' });
    }
    if (G.state === 'victory') {
      dim(0.86);
      FT.text(bg, 'CITY MOGGED', VIEW_W / 2, 90, { color: '#ffd75e', align: 'center', scale: 4, shadow: '#ff5bd0' });
      FT.text(bg, 'JAWLINE: SHARP    HUNTER EYES: ONLINE', VIEW_W / 2, 140, { color: '#7cf5d0', align: 'center' });
      bg.save(); bg.imageSmoothingEnabled = false;
      bg.drawImage(faceImg('front', 4, {}), VIEW_W / 2 - 130, 170, 120, 144);
      bg.drawImage(faceImg('side', 4, {}), VIEW_W / 2 + 10, 170, 120, 144);
      bg.restore();
      FT.text(bg, 'GIGACHAD', VIEW_W / 2, 330, { color: '#ffffff', align: 'center', scale: 3, shadow: '#2a1140' });
      FT.text(bg, 'SCORE ' + pad(G.score, 6) + '   MOGS ' + G.mogs, VIEW_W / 2, 366, { color: '#ffd75e', align: 'center', scale: 2 });
      if (Math.floor(G.t * 2) % 2) FT.text(bg, 'PRESS ENTER FOR ENDLESS CITY', VIEW_W / 2, 404, { color: '#4de1ff', align: 'center' });
    }
  }

  function drawAscend() {
    var k = Math.min(1, G.stateT / 0.35);
    dim(0.88 * k);
    var cy = MAZE_Y + M.H / 2;
    var to = TIERS[G.ascendTo];
    FT.text(bg, 'LOOKSMAX', VIEW_W / 2, cy - 148, { color: '#9fb4ff', align: 'center', scale: 2 });
    FT.text(bg, to.name, VIEW_W / 2, cy - 120,
      { color: Math.floor(G.t * 8) % 2 ? '#ffd75e' : '#ff5bd0', align: 'center', scale: 4, shadow: '#000' });

    var sc = 4, fw = FACE.W * sc, fh = FACE.H * sc, gap = 20;
    var x0 = Math.round((VIEW_W - (fw * 3 + gap * 2)) / 2);
    var top = cy - 60;
    var showNew = G.stateT > 0.85;

    bg.save();
    bg.imageSmoothingEnabled = false;
    bg.globalAlpha = 0.4;
    bg.drawImage(faceImg('front', G.ascendFrom, {}), x0, top, fw, fh);
    bg.globalAlpha = 1;
    if (showNew) {
      var t2 = Math.min(1, (G.stateT - 0.85) / 0.35);
      bg.globalAlpha = t2;
      bg.drawImage(faceImg('front', G.ascendTo, {}), x0 + fw + gap, top, fw, fh);
      bg.drawImage(faceImg('side', G.ascendTo, {}), x0 + (fw + gap) * 2, top, fw, fh);
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
    if (!G.titleSky) G.titleSky = CITY.skyline(VIEW_W, VIEW_H, 1, 150);
    bg.drawImage(G.titleSky, 0, 0);
    bg.fillStyle = 'rgba(5,6,14,0.55)';
    bg.fillRect(0, 0, VIEW_W, VIEW_H);

    FT.text(bg, 'BP MAN', VIEW_W / 2, 40, { color: '#ffd75e', align: 'center', scale: 6, shadow: '#ff5bd0' });
    FT.text(bg, 'MOG CITY', VIEW_W / 2, 96, { color: '#4de1ff', align: 'center', scale: 3, shadow: '#0b2a3a' });

    bg.save();
    bg.imageSmoothingEnabled = false;
    var sc = 3, fw = FACE.W * sc, fh = FACE.H * sc;
    var total = 5 * fw + 4 * 6;
    var x0 = Math.round((VIEW_W - total) / 2);
    var lit = Math.floor(G.t * 1.6) % 5;
    for (var i = 0; i < 5; i++) {
      var x = x0 + i * (fw + 6);
      bg.fillStyle = i === lit ? '#191330' : '#0d0b1c';
      bg.fillRect(x - 2, 148, fw + 4, fh + 4);
      bg.globalAlpha = i === lit ? 1 : 0.82;
      bg.drawImage(faceImg('front', i, {}), x, 150, fw, fh);
      bg.globalAlpha = 1;
      bg.strokeStyle = i === lit ? '#ffd75e' : '#2a2450';
      bg.strokeRect(x - 1.5, 148.5, fw + 3, fh + 3);
    }
    bg.restore();
    FT.text(bg, TIERS[lit].name, VIEW_W / 2, 150 + fh + 14, { color: '#ffd75e', align: 'center', scale: 2 });
    FT.text(bg, TIERS[lit].blurb, VIEW_W / 2, 150 + fh + 36, { color: '#9fb4ff', align: 'center' });

    var y = 320;
    var lines = [
      ['EAT BLACK PILLS', 'THEY CHARGE YOUR AURA'],
      ['GRAB THE HAMMER', 'HATERS TURN COOKED - SMASH THEM'],
      ['FULL AURA', 'PRESS SPACE FOR AN AURA BURST'],
      ['EVERY MOG', 'SHARPENS THE JAW AND HOODS THE EYES'],
      ['GOAL', 'REACH GIGACHAD AND CLEAR THE CITY']
    ];
    lines.forEach(function (l, i) {
      FT.text(bg, l[0], 40, y + i * 20, { color: '#ffd75e' });
      FT.text(bg, l[1], 168, y + i * 20, { color: '#cfd6e4' });
    });

    y = 434;
    bg.save(); bg.imageSmoothingEnabled = false;
    for (var k = 0; k < 4; k++) {
      bg.drawImage(S.rival(k, 'hunt', 0, -1, 0), 40 + k * 46, y);
      FT.text(bg, RIVAL_NAMES[k], 40 + k * 46 + 13, y + 32, { color: '#9fb4ff', align: 'center' });
    }
    bg.drawImage(S.BIGHAM, 228, y - 2, 28, 28);
    FT.text(bg, 'HAMMER', 242, y + 32, { color: '#ffd75e', align: 'center' });
    bg.drawImage(S.PILL, 302, y + 10, 24, 18);
    FT.text(bg, 'BLACK PILL', 312, y + 32, { color: '#b47dff', align: 'center' });
    bg.drawImage(S.item(4), 360, y + 8);
    FT.text(bg, 'BONUS', 367, y + 32, { color: '#7cf5d0', align: 'center' });
    bg.restore();

    if (Math.floor(G.t * 2) % 2) {
      FT.text(bg, 'PRESS ENTER OR CLICK TO START', VIEW_W / 2, VIEW_H - 60,
        { color: '#ffffff', align: 'center', scale: 2, shadow: '#ff5bd0' });
    }
    FT.text(bg, 'ARROWS / WASD  MOVE     SPACE  AURA     P  PAUSE     M  MUTE',
      VIEW_W / 2, VIEW_H - 26, { color: '#6f7bb0', align: 'center' });
    if (G.high) FT.text(bg, 'HI ' + pad(G.high, 6), VIEW_W / 2, VIEW_H - 12, { color: '#ffd75e', align: 'center' });
  }

  /* ---------------- input ---------------- */
  function setDir(d) {
    if (G.state === 'play' || G.state === 'ready') G.player.want = d;
  }

  function newGame() {
    G.score = 0; G.level = 1; G.lives = 3;
    G.mogs = 0; G.tier = 0; G.ascended = false;
    G.aura = 0; G.particles = []; G.pops = []; G.wave = null;
    loadLevel(true);
    G.state = 'ready'; G.stateT = 0;
    A.init(); A.resume(); A.sfx.start();
  }

  function continueEndless() {
    G.level++; G.ascended = false;
    loadLevel(true);
    G.state = 'ready'; G.stateT = 0;
    A.sfx.start();
  }

  function keydown(e) {
    var k = e.key;
    A.resume();
    if (k === 'ArrowUp' || k === 'w' || k === 'W') setDir(UP);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') setDir(DOWN);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') setDir(LEFT);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') setDir(RIGHT);
    else if (k === ' ') fireAura();
    else if (k === 'p' || k === 'P') { if (G.state === 'play') { G.paused = !G.paused; A.sfx.ui(); } }
    else if (k === 'm' || k === 'M') { A.toggle(); A.sfx.ui(); }
    else if (k === 'Enter') {
      if (G.state === 'title' || G.state === 'gameover') newGame();
      else if (G.state === 'victory') continueEndless();
    } else return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(k) >= 0) e.preventDefault();
  }

  function bindTouch(el) {
    var sx = 0, sy = 0, st = 0;
    el.addEventListener('touchstart', function (e) {
      var t0 = e.changedTouches[0];
      sx = t0.clientX; sy = t0.clientY; st = Date.now();
      A.resume();
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      var t0 = e.changedTouches[0];
      var dx = t0.clientX - sx, dy = t0.clientY - sy;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && Date.now() - st < 400) {
        if (G.state === 'title' || G.state === 'gameover') newGame();
        else if (G.state === 'victory') continueEndless();
        else fireAura();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? RIGHT : LEFT);
      else setDir(dy > 0 ? DOWN : UP);
    }, { passive: true });
    el.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  /* ---------------- boot ---------------- */
  function start(canvasEl) {
    setup(canvasEl);
    loadLevel(true);
    G.state = 'title';
    window.addEventListener('keydown', keydown);
    canvasEl.addEventListener('keydown', keydown);
    canvasEl.setAttribute('tabindex', '0');
    try { canvasEl.focus({ preventScroll: true }); } catch (e) { canvasEl.focus(); }
    bindTouch(canvasEl);
    canvasEl.addEventListener('mousedown', function () {
      A.resume();
      try { canvasEl.focus({ preventScroll: true }); } catch (e) {}
      if (G.state === 'title' || G.state === 'gameover') newGame();
      else if (G.state === 'victory') continueEndless();
    });

    var last = performance.now(), acc = 0, STEP = 1 / 60;
    function frame(now) {
      var dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!G.paused) {
        acc += dt;
        var guard = 0;
        while (acc >= STEP && guard++ < 8) { update(STEP); acc -= STEP; }
      } else {
        G.t += dt;
      }
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  BP.game = {
    start: start, state: G, TIERS: TIERS, VIEW_W: VIEW_W, VIEW_H: VIEW_H,
    // exposed for tools/playtest.js -- lets a test drive the sim without rAF
    _update: update, _newGame: newGame, _fireAura: fireAura, _setDir: setDir,
    _dirs: { UP: UP, DOWN: DOWN, LEFT: LEFT, RIGHT: RIGHT }
  };
})(window.BP = window.BP || {});
