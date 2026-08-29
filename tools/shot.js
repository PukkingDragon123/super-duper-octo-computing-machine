// Headless smoke test + screenshots.  node tools/shot.js [outdir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', '.shots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1300 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, '01-title.png') });

  // start the game
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(out, '02-play.png') });

  // walk around for a while
  for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: path.join(out, '03-walk.png') });

  // force interesting states through the exposed game state
  await page.evaluate(() => {
    const G = window.BP.game.state;
    G.psl = 7.9; G.tier = 4; G.mogs = 18; G.aura = 100;
    G.mogTimer = 8;
    G.rivals.forEach(r => { if (r.mode === 'roam' || r.mode === 'club') { r.mode = 'cooked'; } });
    G.carTimer = 0.05;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, '04-mogmode.png') });

  await page.evaluate(() => {
    const G = window.BP.game.state;
    G.ascendFrom = 1; G.ascendTo = 3; G.tier = 3; G.state = 'ascend'; G.stateT = 1.2;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, '05-ascend.png') });

  // traffic: force a cab onto the avenue the player is standing on
  await page.evaluate(() => {
    const g = window.BP.game, G = g.state;
    G.state = 'play'; G.mogTimer = 0; G.aura = 40;
    G.cars = [];
    for (let i = 0; i < 3; i++) { const c = window.BP.traffic.spawn(1, null); if (c) { c.warn = 0; G.cars.push(c); } }
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, '07-traffic.png') });

  // the boss block
  await page.evaluate(() => {
    window.BP.game._newGame(4);
  });
  await page.evaluate(() => {
    const g = window.BP.game, G = g.state;
    G.state = 'play'; G.psl = 8.2; G.tier = 4;
    if (G.boss) { G.boss.stun = 0; G.boss.hp = 4; }
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, '08-boss.png') });

  // face sheet: every tier, every view, big
  const sheet = await page.evaluate(() => {
    const F = window.BP.face, S = window.BP.sprites;
    const SC = 6, pad = 8;
    const cols = 5, rows = 3;
    const w = cols * (F.W * SC + pad) + pad, h = rows * (F.H * SC + pad) + pad + 40;
    const b = S.canvas(w, h);
    b.g.fillStyle = '#0a0b14'; b.g.fillRect(0, 0, w, h);
    ['front', 'side', 'back'].forEach((v, r) => {
      for (let t = 0; t < 5; t++) {
        const c = S.canvas(F.W, F.H);
        F.draw(c.g, v, t, {});
        b.g.imageSmoothingEnabled = false;
        b.g.drawImage(c.c, pad + t * (F.W * SC + pad), pad + r * (F.H * SC + pad), F.W * SC, F.H * SC);
      }
    });
    for (let t = 0; t < 5; t++) {
      window.BP.font.text(b.g, window.BP.game.TIERS[t].name,
        pad + t * (F.W * SC + pad) + F.W * SC / 2, h - 30, { color: '#ffd75e', align: 'center', scale: 2 });
    }
    return b.c.toDataURL();
  });
  fs.writeFileSync(path.join(out, '06-faces.png'), Buffer.from(sheet.split(',')[1], 'base64'));

  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('ok - shots in ' + out);
})();
