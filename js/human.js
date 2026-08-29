/* ------------------------------------------------------------------
   human.js -- everybody on the street is a person: BP MAN, the four
   rivals and the boss are all built by the same routine.

   A sprite is a 20x24 face (face.js) sitting on a body that walks,
   runs, panics or hits the pavement.  Sprites are baked once into
   little canvases and cached by (who, view, pose, frame).
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var F = BP.face;

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g };
  }
  function rect(g, x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  /** A thick line, stepped one row at a time -- reads as a pixel limb. */
  function limb(g, x0, y0, x1, y1, w, col) {
    g.fillStyle = col;
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      g.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, 1);
    }
  }
  var mix = F.mix;

  /* ---------------- the cast ---------------- */
  // tops/pants carry base + a derived shade; build 0 slim .. 3 huge
  function outfit(base, alt) {
    return { base: base, dark: mix(base, '#000010', 0.42), hi: mix(base, '#ffffff', 0.26), alt: alt || null };
  }

  var CAST = {
    bp: {
      skin: '#f0b78a', hair: '#3d2a20', build: 1,
      top: outfit('#5a6690'), pants: outfit('#2b3350'), shoes: '#171922'
    },
    vic:  { name: 'VIC',  skin: '#e8b083', hair: '#241a14', tier: 3, hairStyle: 'buzz',   build: 2,
            top: outfit('#c9342e'), pants: outfit('#23262f'), shoes: '#12141a', accent: '#ff6b62' },
    desh: { name: 'DESH', skin: '#8d5a3b', hair: '#140f0c', tier: 1, hairStyle: 'fringe', build: 0,
            top: outfit('#d94ea8'), pants: outfit('#2a2d3a'), shoes: '#e8e8f0', accent: '#ff9fd8' },
    kai:  { name: 'KAI',  skin: '#f3c9a0', hair: '#3a2a1a', tier: 2, hairStyle: 'fade',   build: 1,
            top: outfit('#2fb8d6'), pants: outfit('#1f6f85'), shoes: '#f2f4f8', accent: '#7ceaff',
            gear: 'headphones' },
    russ: { name: 'RUSS', skin: '#c98d5e', hair: '#4a3524', tier: 2, hairStyle: 'beanie', build: 2,
            top: outfit('#e08a2e'), pants: outfit('#3a3020'), shoes: '#2a2018', accent: '#ffc46b' },
    apex: { name: 'APEX', skin: '#eab98c', hair: '#15100c', tier: 4, hairStyle: 'fade',   build: 3,
            top: outfit('#23262f'), pants: outfit('#15171f'), shoes: '#0a0b10', accent: '#ffd75e',
            under: '#e8ecf6', chain: true, gear: 'coat', big: true }
  };

  /* ---------------- geometry ---------------- */
  var SHOULDER = [7, 9, 11, 13];
  var WAIST    = [5, 6, 7, 9];

  function dims(spec) {
    var big = !!spec.big;
    return {
      W:  big ? 36 : 28,
      H:  big ? 50 : 44,
      ax: big ? 18 : 14,        // the point that rides the lane centre
      ay: big ? 28 : 25,
      headX: big ? 8 : 4,
      neck:  22,                // shoulders meet the face's neck here
      waist: big ? 40 : 36,
      hip:   big ? 41 : 37,
      foot:  big ? 48 : 42
    };
  }

  // Per-frame stride, knee lift, body lean and airborne hop.
  var GAIT = {
    idle:   { stride: [0, 0, 0, 0],   lift: [0, 0, 1, 0], lean: 0, hop: [0, 0, 0, 0], bent: 0, arm: 1 },
    walk:   { stride: [5, 0, -5, 0],  lift: [0, 3, 0, 3], lean: 0, hop: [0, 1, 0, 1], bent: 1, arm: 1 },
    run:    { stride: [8, 2, -8, 2],  lift: [1, 6, 1, 6], lean: 3, hop: [0, 2, 0, 2], bent: 3, arm: 2 },
    scared: { stride: [7, 2, -7, 2],  lift: [1, 6, 1, 6], lean: -3, hop: [0, 2, 0, 2], bent: 3, arm: 3 },
    down:   { stride: [0, 0, 0, 0],   lift: [0, 0, 0, 0], lean: 0, hop: [0, 0, 0, 0], bent: 0, arm: 0 }
  };

  /* ---------------- body ---------------- */
  /** One leg drawn hip -> knee -> foot, so a bent knee actually reads. */
  function oneLeg(g, hx, hy, footY, dx, lift, bent, pants, shoe, shade) {
    var kneeX = hx + Math.round(dx * 0.55);
    var kneeY = hy + Math.round((footY - hy) * 0.45) - Math.round(lift * 0.4);
    var footX = hx + dx;
    var fy = footY - lift;
    var pc = shade ? pants.dark : pants.base;
    limb(g, hx - 2, hy, kneeX - 2, kneeY, 4, pc);
    limb(g, kneeX - 2, kneeY, footX - 2, fy - 2, 4, pc);
    if (bent > 1) rect(g, kneeX - 2, kneeY, 4, 1, shade ? pants.base : pants.hi);
    rect(g, footX - 3, fy - 2, 6, 2, shade ? mix(shoe, '#000000', 0.3) : shoe);
    rect(g, footX - 3, fy - 2, 6, 1, shade ? shoe : mix(shoe, '#ffffff', 0.25));
  }

  function legs(g, d, spec, view, gait, f, hop) {
    var s = gait.stride[f], lift = gait.lift[f];
    var hy = d.hip + hop, footY = d.foot;
    var p = spec.pants;

    rect(g, d.ax - WAIST[spec.build], d.waist + hop,
         WAIST[spec.build] * 2, d.hip - d.waist + 2, p.base);      // hips
    rect(g, d.ax - WAIST[spec.build], d.waist + hop, WAIST[spec.build] * 2, 1, p.hi);

    if (view === 'side') {
      oneLeg(g, d.ax, hy, footY, -s, s < 0 ? lift : 0, gait.bent, p, spec.shoes, true);
      oneLeg(g, d.ax, hy, footY, s, s > 0 ? 0 : lift, gait.bent, p, spec.shoes, false);
    } else {
      var spread = 4;
      var la = f === 1 ? lift : (f === 3 ? -0 : 0);
      var ra = f === 3 ? lift : 0;
      oneLeg(g, d.ax - spread, hy, footY, view === 'back' ? 1 : -1, la, 0, p, spec.shoes, false);
      oneLeg(g, d.ax + spread, hy, footY, view === 'back' ? -1 : 1, ra, 0, p, spec.shoes, true);
    }
  }

  function torso(g, d, spec, view, gait, f, lean, hop) {
    var sw = SHOULDER[spec.build], ww = WAIST[spec.build];
    var top = spec.top;
    var x = d.ax + lean;
    var y0 = d.neck + hop;
    var h = d.waist - d.neck + 1;

    rect(g, x - sw, y0, sw * 2, 5, top.base);                     // shoulders
    rect(g, x - sw, y0, sw * 2, 1, top.hi);
    rect(g, x + sw - 3, y0, 3, 5, top.dark);
    if (spec.build >= 2) {                                        // delt caps
      rect(g, x - sw, y0 + 1, 3, 4, top.hi);
      rect(g, x + sw - 3, y0 + 1, 3, 4, mix(top.dark, '#000000', 0.2));
    }
    rect(g, x - ww - 1, y0 + 5, (ww + 1) * 2, h - 5, top.base);   // trunk
    rect(g, x + ww - 2, y0 + 5, 3, h - 5, top.dark);
    rect(g, x - ww - 1, y0 + 5, 1, h - 5, top.hi);
    rect(g, x - ww - 1, d.waist + hop - 1, (ww + 1) * 2, 1, top.dark);   // hem

    if (spec.under) {                                             // shirt beneath
      rect(g, x - 4, y0 + 4, 8, h - 3, spec.under);
      rect(g, x - 4, y0 + 4, 8, 1, mix(spec.under, '#ffffff', 0.5));
      rect(g, x + 2, y0 + 5, 2, h - 4, mix(spec.under, '#000018', 0.22));
    }
    if (spec.gear === 'coat') {                                   // open coat, both panels
      var cl = d.hip - y0 + 2;
      rect(g, x - sw + 1, y0 + 4, sw - 4, cl, top.base);          // left panel
      rect(g, x + 5, y0 + 4, sw - 4, cl, top.base);               // right panel
      rect(g, x + sw - 4, y0 + 4, 3, cl, top.dark);
      rect(g, x - sw + 1, y0 + 4, 1, cl, top.hi);
      rect(g, x - 5, y0 + 4, 1, cl, mix(top.dark, '#000000', 0.3));
      rect(g, x + 5, y0 + 4, 1, mix(top.dark, '#000000', 0.3));
      rect(g, x - sw + 2, y0 + 3, 4, 4, top.hi);                  // lapels
      rect(g, x + 4, y0 + 3, 4, 4, top.hi);
      rect(g, x - sw + 1, y0 + 3 + cl, sw - 4, 1, mix(top.dark, '#000000', 0.4));
      rect(g, x + 5, y0 + 3 + cl, sw - 4, 1, mix(top.dark, '#000000', 0.4));
    }
    if (spec.accent) rect(g, x - ww - 1, y0 + 6, (ww + 1) * 2, 1, spec.accent);
    return { x: x, y0: y0, sw: sw, ww: ww };
  }

  /** Shoulder -> elbow -> hand, so a pumping arm reads at run speed. */
  function oneArm(g, sx, sy, dx, reach, bend, sleeve, skin, edge) {
    var ex = sx + Math.round(dx * 0.22), ey = sy + Math.round(reach * 0.55);
    var hx = sx + dx, hy = sy + reach - Math.round(bend * 1.8);
    if (edge) {                                   // dark seam so it reads off the trunk
      limb(g, ex - 2, ey, sx - 2, sy, 5, edge);
      limb(g, hx - 2, hy, ex - 2, ey, 5, edge);
    }
    limb(g, ex - 1, ey, sx - 1, sy, 3, sleeve);
    limb(g, hx - 1, hy, ex - 1, ey, 3, sleeve);
    rect(g, hx - 2, hy, 3, 3, skin);
    rect(g, hx - 2, hy, 3, 1, mix(skin, '#ffffff', 0.25));
  }

  function arms(g, d, spec, view, gait, f, t, hop) {
    var s = gait.stride[f];
    var skin = F.palette({ skin: spec.skin }).mid;
    var skinDk = F.palette({ skin: spec.skin }).sh;
    var top = spec.top;
    var sy = t.y0 + 3, reach = d.waist - t.y0 - 1;

    var seam = mix(top.dark, '#000012', 0.35);
    var lit = mix(top.base, '#ffffff', 0.14);
    if (gait.arm === 3) {                        // panicking: both hands up
      oneArm(g, t.x - t.sw + 2, sy, -5, -10, 0, lit, skin, seam);
      oneArm(g, t.x + t.sw - 2, sy, 5, -10, 0, lit, skin, seam);
      return;
    }
    if (view === 'side') {
      // no seam here -- a wide dark edge across a side-on torso reads as a sash
      oneArm(g, t.x, sy + 1, Math.round(-s * 0.7), reach - 1, gait.bent, top.dark, skinDk, null);
      oneArm(g, t.x, sy + 1, Math.round(s * 0.7), reach - 1, gait.bent, lit, skin, null);
    } else {
      var d1 = Math.round(s * 0.35);
      oneArm(g, t.x - t.sw + 1, sy, -2, reach + d1, gait.bent, lit, skin, seam);
      oneArm(g, t.x + t.sw - 1, sy, 2, reach - d1, gait.bent, lit, skin, seam);
    }
  }

  function gear(g, d, spec, view, lean) {
    var x = d.ax + lean;
    if (spec.gear === 'headphones') {
      if (view === 'side') {
        rect(g, d.headX + 5, 6, 3, 6, '#1c2233');
        rect(g, d.headX + 3, 1, 12, 2, '#1c2233');
        rect(g, d.headX + 5, 7, 1, 3, spec.accent);
      } else {
        rect(g, d.headX - 1, 6, 3, 6, '#1c2233');
        rect(g, d.headX + 18, 6, 3, 6, '#1c2233');
        rect(g, d.headX + 1, 1, 18, 2, '#1c2233');
        rect(g, d.headX - 1, 7, 1, 3, spec.accent);
        rect(g, d.headX + 20, 7, 1, 3, spec.accent);
      }
    }
    if (spec.chain) {
      rect(g, x - 4, d.neck + 3, 8, 1, '#f5c542');
      rect(g, x - 5, d.neck + 4, 2, 1, '#f5c542');
      rect(g, x + 3, d.neck + 4, 2, 1, '#f5c542');
      rect(g, x - 1, d.neck + 5, 2, 2, '#ffe07a');
    }
  }

  /* ---------------- assembly ---------------- */
  var cache = {};

  /** Dilate the sprite by a pixel and fill that ring dark. */
  function outlined(src, col) {
    var o = canvas(src.width, src.height);
    var g = o.g;
    var d = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var i = 0; i < d.length; i++) g.drawImage(src, d[i][0], d[i][1]);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col;
    g.fillRect(0, 0, o.c.width, o.c.height);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(src, 0, 0);
    return o.c;
  }

  /**
   * @param spec  a CAST entry, optionally overridden per-frame
   * @param view  'front' | 'back' | 'side'   (side faces right; flip to go left)
   * @param pose  'idle' | 'walk' | 'run' | 'scared' | 'down'
   * @param frame 0..3
   */
  function build(spec, view, pose, frame, opts) {
    opts = opts || {};
    var key = [spec.key, view, pose, frame, opts.tier, opts.expr, opts.mouth ? 1 : 0,
               opts.chain ? 1 : 0, opts.topOverride || ''].join('|');
    if (cache[key]) return cache[key];

    var d = dims(spec);
    var b = canvas(d.W, d.H), g = b.g;
    var tier = opts.tier !== undefined ? opts.tier : (spec.tier || 0);
    var gait = GAIT[pose] || GAIT.walk;
    var f = frame & 3;
    var lean = (view === 'side') ? gait.lean : 0;

    var live = Object.create(spec);
    if (opts.topOverride) live.top = outfit(opts.topOverride);
    if (opts.chain) live.chain = true;

    if (pose === 'down') {
      drawDown(g, d, live, tier, opts);
      cache[key] = outlined(b.c, 'rgba(6,8,15,0.9)');
      return cache[key];
    }

    var hop = gait.hop[f];
    legs(g, d, live, view, gait, f, hop);
    var t = torso(g, d, live, view, gait, f, lean, hop);
    arms(g, d, live, view, gait, f, t, hop);

    var head = canvas(F.W, F.H);
    F.draw(head.g, view, tier, {
      pal: F.palette({ skin: live.skin, hair: live.hair, iris: opts.iris }),
      hairStyle: live.hairStyle,
      expr: opts.expr,
      mouth: opts.mouth,
      stubble: opts.stubble
    });
    g.drawImage(head.c, d.headX + lean, hop);

    gear(g, d, live, view, lean);
    cache[key] = outlined(b.c, 'rgba(6,8,15,0.9)');
    return cache[key];
  }

  /** Flat on the pavement -- a rival who just got mogged. */
  function drawDown(g, d, spec, tier, opts) {
    var y = d.foot - 12, x = d.ax;
    rect(g, x - 12, d.foot - 1, 26, 1, 'rgba(0,0,0,0.4)');       // ground shade
    // legs stretched out to the left, torso to the right
    rect(g, x - 12, y + 7, 9, 4, spec.pants.base);
    rect(g, x - 12, y + 7, 9, 1, spec.pants.hi);
    rect(g, x - 14, y + 7, 3, 4, spec.shoes);
    rect(g, x - 3, y + 4, 11, 7, spec.top.base);
    rect(g, x - 3, y + 4, 11, 1, spec.top.hi);
    rect(g, x - 3, y + 10, 11, 1, spec.top.dark);
    var skin = F.palette({ skin: spec.skin });
    rect(g, x + 1, y + 11, 6, 3, skin.mid);                       // an arm flung out
    var head = canvas(F.W, F.H);
    F.draw(head.g, 'front', tier, {
      pal: skin, hairStyle: spec.hairStyle, expr: opts.expr || 'scared'
    });
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(x + 8, y - 2);
    g.rotate(0.35);
    g.drawImage(head.c, 0, 0);
    g.restore();
  }

  // give every cast member a stable cache key
  Object.keys(CAST).forEach(function (k) { CAST[k].key = k; });

  BP.human = {
    CAST: CAST, build: build, dims: dims, outfit: outfit,
    canvas: canvas, rect: rect, limb: limb
  };
})(window.BP = window.BP || {});
