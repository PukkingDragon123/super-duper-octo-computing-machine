/* Bundle the game into a single self-contained HTML file.
 *   node build.js
 * Emits:
 *   dist/bpman.html    -- full standalone document, open it anywhere
 *   dist/artifact.html -- same page as a body-only fragment
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCRIPTS = ['font', 'maze', 'face', 'sprites', 'city', 'audio', 'game'];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('css/style.css');
const js = SCRIPTS.map(n => read(`js/${n}.js`)).join('\n');
const boot = `
(function () {
  var boot = document.getElementById('boot');
  try {
    window.BP.game.start(document.getElementById('screen'));
    if (boot) boot.parentNode.removeChild(boot);
  } catch (err) {
    if (boot) boot.textContent = 'FAILED TO BOOT: ' + err.message;
    throw err;
  }
})();`;

const TITLE = 'BP MAN - MOG CITY';
const body = `<div id="stage">
  <canvas id="screen" width="448" height="598"></canvas>
  <div id="boot">LOADING MOG CITY...</div>
</div>`;

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>${TITLE}</title>
<style>
${css}</style>
</head>
<body>
${body}
<script>
${js}
${boot}
</script>
</body>
</html>
`;

// The artifact host supplies <!doctype>/<head>/<body>, so ship a fragment.
const fragment = `<title>${TITLE}</title>
<style>
${css}</style>
${body}
<script>
${js}
${boot}
</script>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/bpman.html'), standalone);
fs.writeFileSync(path.join(ROOT, 'dist/artifact.html'), fragment);
const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('dist/bpman.html    ' + kb(standalone.length));
console.log('dist/artifact.html ' + kb(fragment.length));
