// Render a sprite sheet of the cast so the art can be reviewed.
// node tools/sheet.js <outfile.png>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', '.shots', 'cast.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setContent('<canvas id="c"></canvas>');
  for (const f of ['face', 'human']) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8') });
  }

  const data = await page.evaluate(() => {
    const H = window.BP.human, C = H.CAST;
    const SC = 3, pad = 8, labelH = 16;
    const rows = [
      { who: 'bp',   tier: 0, poses: [['side','walk',0],['side','walk',1],['side','walk',2],['side','walk',3],['side','run',0],['side','run',1],['side','run',2],['side','run',3],['front','walk',0],['front','walk',1],['back','walk',0],['side','down',0]] },
      { who: 'bp',   tier: 4, poses: [['side','walk',0],['side','walk',1],['side','walk',2],['side','walk',3],['side','run',0],['side','run',1],['side','run',2],['side','run',3],['front','walk',0],['front','walk',1],['back','walk',0],['side','down',0]] },
      { who: 'vic',  poses: [['side','walk',0],['side','walk',1],['side','run',0],['side','run',1],['front','walk',0],['front','walk',2],['back','walk',0],['side','scared',0],['side','scared',1],['front','scared',0],['side','down',0],['front','idle',0]] },
      { who: 'desh', poses: [['side','walk',0],['side','walk',1],['side','run',0],['side','run',1],['front','walk',0],['front','walk',2],['back','walk',0],['side','scared',0],['side','scared',1],['front','scared',0],['side','down',0],['front','idle',0]] },
      { who: 'kai',  poses: [['side','walk',0],['side','walk',1],['side','run',0],['side','run',1],['front','walk',0],['front','walk',2],['back','walk',0],['side','scared',0],['side','scared',1],['front','scared',0],['side','down',0],['front','idle',0]] },
      { who: 'russ', poses: [['side','walk',0],['side','walk',1],['side','run',0],['side','run',1],['front','walk',0],['front','walk',2],['back','walk',0],['side','scared',0],['side','scared',1],['front','scared',0],['side','down',0],['front','idle',0]] },
      { who: 'apex', poses: [['side','walk',0],['side','walk',1],['side','run',0],['side','run',1],['front','walk',0],['front','walk',2],['back','walk',0],['front','idle',0]] }
    ];
    const cellW = 40 * SC, cellH = 48 * SC;
    const w = 12 * (cellW + pad) + pad + 80;
    const h = rows.length * (cellH + pad + labelH) + pad;
    const b = H.canvas(w, h);
    b.g.fillStyle = '#0d0f18'; b.g.fillRect(0, 0, w, h);
    b.g.imageSmoothingEnabled = false;
    rows.forEach((row, ri) => {
      const spec = C[row.who];
      const y = pad + ri * (cellH + pad + labelH);
      const expr = { vic: 'smug', desh: 'smug', kai: 'neutral', russ: 'smug', apex: 'angry' }[row.who];
      row.poses.forEach((p, ci) => {
        const [view, pose, frame] = p;
        const o = { tier: row.tier !== undefined ? row.tier : spec.tier, expr };
        if (row.who === 'bp' && row.tier === 4) o.chain = true;
        if (pose === 'scared' || pose === 'down') o.expr = 'scared';
        const img = H.build(spec, view, pose, frame, o);
        b.g.drawImage(img, 80 + pad + ci * (cellW + pad), y, img.width * SC, img.height * SC);
      });
      window.BP.font && 0;
      b.g.fillStyle = '#ffd75e';
      b.g.font = '13px monospace';
      b.g.fillText((spec.name || 'BP MAN') + (row.tier !== undefined ? ' PSL' + row.tier : ''), 6, y + 20);
      b.g.fillStyle = '#6f7bb0';
      b.g.fillText('walk / run / f / b', 6, y + 36);
    });
    return b.c.toDataURL();
  });
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await browser.close();
  if (errs.length) { console.log('ERRORS: ' + errs.join('\n')); process.exit(1); }
  console.log('wrote ' + out);
})();
