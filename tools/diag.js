const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const g = window.BP.game, G = g.state, M = window.BP.maze;
    const runs = [];
    for (let trial = 0; trial < 12; trial++) {
      g._newGame(); G.state = 'play';
      const dirs = [g._dirs.LEFT, g._dirs.RIGHT, g._dirs.UP, g._dirs.DOWN];
      const seen = G.rivals.map(() => new Set());
      for (let i = 0; i < 60 * 45; i++) {
        if (i % 23 === 0) g._setDir(dirs[(Math.random() * 4) | 0]);
        g._update(1 / 60);
        if (G.state !== 'play') { G.state = 'play'; G.stateT = 0; }
        G.rivals.forEach((r, k) =>
          seen[k].add(Math.floor(r.x / M.TILE) + ',' + Math.floor(r.y / M.TILE)));
      }
      const counts = seen.map(s => s.size);
      const worst = counts.indexOf(Math.min.apply(null, counts));
      runs.push({
        counts,
        worstRival: G.rivals[worst].name,
        worstMode: G.rivals[worst].mode,
        worstTiles: counts[worst] < 30 ? Array.from(seen[worst]).sort() : null
      });
    }
    return runs;
  });
  out.forEach((r, i) => {
    console.log(`trial ${i}: ${r.counts.join(',')}  worst=${r.worstRival}(${r.worstMode})`);
    if (r.worstTiles) console.log('   tiles: ' + r.worstTiles.join(' '));
  });
  await browser.close();
})();
