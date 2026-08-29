// Sanity check: every pill reachable from the player spawn, rows well formed.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/maze.js', 'utf8');
const BP = {};
new Function('window', src)({ BP });
const m = BP.maze;

let bad = 0;
m.RAW.forEach((row, i) => {
  if (row.length !== m.COLS) { console.log(`row ${i} has ${row.length} chars (want ${m.COLS})`); bad++; }
});

const { grid, pills } = m.build();
const seen = new Set();
const start = [Math.floor(m.playerSpawn.c), m.playerSpawn.r];
const q = [start];
seen.add(start.join(','));
while (q.length) {
  const [c, r] = q.shift();
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    let nc = c + dc, nr = r + dr;
    if (nr === m.TUNNEL_ROW) { if (nc < 0) nc = m.COLS - 1; if (nc >= m.COLS) nc = 0; }
    if (nc < 0 || nc >= m.COLS || nr < 0 || nr >= m.ROWS) continue;
    const t = grid[nr][nc];
    if (t === m.WALL || t === m.GATE) continue;
    const k = nc + ',' + nr;
    if (!seen.has(k)) { seen.add(k); q.push([nc, nr]); }
  }
}

let unreachable = 0;
for (let r = 0; r < m.ROWS; r++) for (let c = 0; c < m.COLS; c++) {
  const t = grid[r][c];
  if ((t === m.PILL || t === m.HAMMER) && !seen.has(c + ',' + r)) {
    console.log(`unreachable pill at ${c},${r}`); unreachable++; bad++;
  }
}
// The rivals must be able to leave the alley and reach the player's world.
console.log(`rows ok:${m.RAW.length}  pills:${pills}  reachable tiles:${seen.size}  unreachable pills:${unreachable}`);
process.exit(bad ? 1 : 0);
