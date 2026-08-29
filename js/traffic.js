/* ------------------------------------------------------------------
   traffic.js -- the avenues are live.  Cabs, sedans, box trucks and
   the crosstown bus run the long straight shots; getting clipped
   costs you PSL, not a life.

   Every car is telegraphed: headlights flare at the mouth of the
   avenue and the horn sounds before it enters.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var M = BP.maze, T = M.TILE;

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g };
  }
  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  var mix = BP.face.mix;

  /* ---------------- vehicles ---------------- */
  var TYPES = [
    { key: 'cab',   len: 30, body: '#f2c12e', roof: '#d9a71c', trim: '#141821', weight: 5, speed: 2.7 },
    { key: 'sedan', len: 30, body: '#2c3140', roof: '#20242f', trim: '#0e1017', weight: 3, speed: 2.9 },
    { key: 'van',   len: 36, body: '#dfe4ee', roof: '#b8bfcd', trim: '#171a22', weight: 2, speed: 2.3 },
    { key: 'bus',   len: 46, body: '#3f7fc4', roof: '#31649b', trim: '#101319', weight: 1, speed: 1.9 }
  ];
  var WID = 14;

  /** Top-down car, nose pointing right. */
  function drawCar(g, t) {
    var L = t.len, W = WID, i;
    rect(g, 1, 1, L - 2, W - 2, t.body);                 // body, corners nipped
    rect(g, 0, 3, L, W - 6, t.body);
    rect(g, 2, 0, L - 4, 1, t.trim);
    rect(g, 2, W - 1, L - 4, 1, t.trim);
    rect(g, 1, 1, L - 2, 1, mix(t.body, '#ffffff', 0.4));  // top highlight
    rect(g, 1, W - 3, L - 2, 2, mix(t.body, '#000000', 0.35));

    var cabX = t.key === 'bus' ? 6 : Math.round(L * 0.30);
    var cabW = t.key === 'bus' ? L - 12 : Math.round(L * 0.40);
    rect(g, cabX, 2, cabW, W - 4, t.roof);               // roof
    rect(g, cabX, 2, cabW, 1, mix(t.roof, '#ffffff', 0.25));
    rect(g, cabX + cabW, 3, 3, W - 6, '#8fb6d8');        // windshield
    rect(g, cabX - 3, 3, 3, W - 6, '#6f93b4');           // rear glass
    rect(g, cabX + cabW + 3, 4, 1, W - 8, 'rgba(255,255,255,0.5)');

    rect(g, L - 2, 2, 2, 3, '#fff6d0');                  // headlights
    rect(g, L - 2, W - 5, 2, 3, '#fff6d0');
    rect(g, 0, 2, 1, 3, '#d8322c');                      // tail lights
    rect(g, 0, W - 5, 1, 3, '#d8322c');
    rect(g, cabX + cabW - 1, 1, 2, 1, t.trim);           // mirrors
    rect(g, cabX + cabW - 1, W - 2, 2, 1, t.trim);
    rect(g, 4, 0, 5, 1, '#0c0e14');                      // tyres
    rect(g, 4, W - 1, 5, 1, '#0c0e14');
    rect(g, L - 10, 0, 5, 1, '#0c0e14');
    rect(g, L - 10, W - 1, 5, 1, '#0c0e14');

    if (t.key === 'cab') {
      rect(g, cabX + 2, 5, 6, 4, '#141821');             // roof light
      rect(g, cabX + 3, 6, 4, 2, '#ffe07a');
      for (i = 0; i < 5; i++)                            // checker band
        rect(g, 3 + i * 2, W - 4, 1, 1, (i & 1) ? '#141821' : '#ffffff');
    } else if (t.key === 'bus') {
      for (i = 0; i < 5; i++) rect(g, 10 + i * 6, 3, 4, W - 6, '#7fb4e0');
      rect(g, 2, 4, 3, W - 8, '#ffd75e');
    } else if (t.key === 'van') {
      rect(g, 4, 4, 10, W - 8, mix(t.body, '#000000', 0.12));
      rect(g, 6, 6, 6, 2, '#2f7fb8');
    }
  }

  var cache = {};
  function sprite(t, dir) {
    var key = t.key + dir;
    if (cache[key]) return cache[key];
    var base = canvas(t.len, WID);
    drawCar(base.g, t);
    var out;
    if (dir === 'right') out = base.c;
    else if (dir === 'left') {
      out = canvas(t.len, WID);
      out.g.translate(t.len, 0); out.g.scale(-1, 1);
      out.g.drawImage(base.c, 0, 0);
      out = out.c;
    } else {                                             // exact 90 degree turns
      var o = canvas(WID, t.len);
      o.g.save();
      if (dir === 'down') { o.g.translate(WID, 0); o.g.rotate(Math.PI / 2); }
      else { o.g.translate(0, t.len); o.g.rotate(-Math.PI / 2); }
      o.g.imageSmoothingEnabled = false;
      o.g.drawImage(base.c, 0, 0);
      o.g.restore();
      out = o.c;
    }
    cache[key] = out;
    return out;
  }

  /* ---------------- fleet ---------------- */
  function pickType() {
    var total = 0, i;
    for (i = 0; i < TYPES.length; i++) total += TYPES[i].weight;
    var v = Math.random() * total;
    for (i = 0; i < TYPES.length; i++) { v -= TYPES[i].weight; if (v <= 0) return TYPES[i]; }
    return TYPES[0];
  }

  /**
   * @param level  drives how fast and how often traffic runs
   * @param avoid  {c,r} tile the car must not spawn on top of
   */
  function spawn(level, avoid) {
    var av = M.AVENUES[(Math.random() * M.AVENUES.length) | 0];
    var t = pickType();
    var fwd = Math.random() < 0.5;
    var speed = t.speed * (1 + (level - 1) * 0.05);
    var car = {
      type: t, av: av, speed: speed,
      warn: 1.15, honked: false,
      len: t.len, wid: WID
    };
    if (av.axis === 'h') {
      car.axis = 'h';
      car.dir = fwd ? 1 : -1;
      car.y = av.at * T + (T - WID) / 2;
      car.x = fwd ? -t.len - 4 : M.W + 4;
      car.sprite = sprite(t, fwd ? 'right' : 'left');
      car.warnX = fwd ? 3 : M.W - 8;
      car.warnY = car.y + WID / 2;
    } else {
      car.axis = 'v';
      car.dir = fwd ? 1 : -1;
      car.x = av.at * T + (T - WID) / 2;
      car.y = fwd ? -t.len - 4 : M.H + 4;
      car.sprite = sprite(t, fwd ? 'down' : 'up');
      car.warnX = car.x + WID / 2;
      car.warnY = fwd ? 3 : M.H - 8;
    }
    if (avoid) {                                   // never materialise on the player
      var pc = Math.floor(avoid.x / T), pr = Math.floor(avoid.y / T);
      if (av.axis === 'h' && pr === av.at && Math.abs(pc - (car.dir > 0 ? 0 : M.COLS)) < 4) return null;
      if (av.axis === 'v' && pc === av.at && Math.abs(pr - (car.dir > 0 ? 0 : M.ROWS)) < 4) return null;
    }
    return car;
  }

  function update(car, dt) {
    if (car.warn > 0) { car.warn -= dt; return true; }
    if (car.axis === 'h') {
      car.x += car.dir * car.speed;
      return car.x > -car.len - 20 && car.x < M.W + 20;
    }
    car.y += car.dir * car.speed;
    return car.y > -car.len - 20 && car.y < M.H + 20;
  }

  function bounds(car) {
    if (car.axis === 'h') return { x: car.x, y: car.y, w: car.len, h: car.wid };
    return { x: car.x, y: car.y, w: car.wid, h: car.len };
  }

  function hits(car, px, py, pad) {
    if (car.warn > 0) return false;
    var b = bounds(car);
    pad = pad || 5;
    return px > b.x - pad && px < b.x + b.w + pad &&
           py > b.y - pad && py < b.y + b.h + pad;
  }

  /** Cars are drawn with their headlight wash so they read at speed. */
  function draw(g, car, oy, t) {
    if (car.warn > 0) {
      var blink = Math.floor(t * 12) % 2;
      if (!blink) return;
      var wx = car.warnX, wy = car.warnY + oy;
      var gr = g.createRadialGradient(wx, wy, 1, wx, wy, 26);
      gr.addColorStop(0, 'rgba(255,238,180,0.55)');
      gr.addColorStop(1, 'rgba(255,238,180,0)');
      g.fillStyle = gr;
      g.fillRect(wx - 26, wy - 26, 52, 52);
      g.fillStyle = '#ffe07a';
      if (car.axis === 'h') {
        g.fillRect(wx - 2, wy - 5, 4, 10);
        g.fillRect(wx + (car.dir > 0 ? 3 : -6), wy - 2, 3, 4);
      } else {
        g.fillRect(wx - 5, wy - 2, 10, 4);
        g.fillRect(wx - 2, wy + (car.dir > 0 ? 3 : -6), 4, 3);
      }
      return;
    }
    var b = bounds(car);
    // headlight cone thrown down the avenue
    var hx = car.axis === 'h' ? (car.dir > 0 ? b.x + b.w : b.x) : b.x + b.w / 2;
    var hy = car.axis === 'h' ? b.y + b.h / 2 : (car.dir > 0 ? b.y + b.h : b.y);
    var cone = g.createRadialGradient(hx, hy + oy, 2, hx, hy + oy, 40);
    cone.addColorStop(0, 'rgba(255,244,206,0.30)');
    cone.addColorStop(1, 'rgba(255,244,206,0)');
    g.fillStyle = cone;
    g.fillRect(hx - 40, hy + oy - 40, 80, 80);
    g.drawImage(car.sprite, Math.round(b.x), Math.round(b.y + oy));
    // wet-road reflection under the chassis
    g.fillStyle = 'rgba(255,220,150,0.10)';
    g.fillRect(Math.round(b.x), Math.round(b.y + oy + b.h), b.w, 2);
  }

  BP.traffic = {
    TYPES: TYPES, WID: WID,
    spawn: spawn, update: update, draw: draw, hits: hits, bounds: bounds, sprite: sprite
  };
})(window.BP = window.BP || {});
