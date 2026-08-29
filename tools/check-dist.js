// Verify the bundled single-file build boots and plays.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'dist', 'bpman.html'));
  await page.waitForTimeout(500);
  const booted = await page.evaluate(() => !!(window.BP && window.BP.game && window.BP.game.state));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const G = window.BP.game.state;
    return { state: G.state, pills: G.pillsLeft, rivals: G.rivals.length, boot: !!document.getElementById('boot') };
  });
  await page.screenshot({ path: path.join(process.argv[2] || '.', 'dist-boot.png') });
  await browser.close();
  const ok = booted && info.state === 'play' && info.pills > 200 && info.rivals === 4 && !info.boot && !errors.length;
  console.log(JSON.stringify({ booted, ...info, errors }, null, 1));
  console.log(ok ? 'dist build OK' : 'dist build FAILED');
  process.exit(ok ? 0 : 1);
})();
