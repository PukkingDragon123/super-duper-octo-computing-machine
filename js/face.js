/* ------------------------------------------------------------------
   face.js -- a parametric human face, 20 x 24 pixels.

   Drives BP MAN's PSL ascent (soft and round -> jawline + hunter eyes)
   and doubles as the face of every rival, boss and pedestrian by way
   of a palette override.  Callers blit it at whatever integer scale
   they need: 1x on the street sprite, 2x in the HUD, 5x in a cutscene.

   Vertical budget:  0-5 hair | 5-6 brow | 7-11 eyes | 11-14 nose
                     15-16 mouth | 16-19 chin | 19-23 neck
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var W = 20, H = 24;

  /* ---------------- colour ---------------- */
  function hex(c) {
    var n = parseInt(c.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function str(a) {
    return '#' + ((1 << 24) + (a[0] << 16) + (a[1] << 8) + a[2]).toString(16).slice(1);
  }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return str([
      Math.round(x[0] + (y[0] - x[0]) * t),
      Math.round(x[1] + (y[1] - x[1]) * t),
      Math.round(x[2] + (y[2] - x[2]) * t)
    ]);
  }

  /** Build a full shading ramp from a base skin and hair colour. */
  function palette(o) {
    o = o || {};
    var skin = o.skin || '#f0b78a';
    var hair = o.hair || '#3d2a20';
    return {
      hi:   mix(skin, '#fff2e0', 0.45),
      skin: skin,
      mid:  mix(skin, '#7a3f20', 0.22),
      sh:   mix(skin, '#7a3f20', 0.42),
      dk:   mix(skin, '#5c2c14', 0.60),
      line: mix(skin, '#3a1608', 0.78),
      stub: mix(skin, '#4a2a18', 0.30),
      lip:   mix(skin, '#b8402e', 0.45),
      lipDk: mix(skin, '#7a2418', 0.62),
      hairHi: mix(hair, '#ffe0b0', 0.26),
      hair:   hair,
      hairDk: mix(hair, '#000000', 0.42),
      white: '#fdfbf6',
      iris:   o.iris || '#5a8cbe',
      irisDk: mix(o.iris || '#5a8cbe', '#000018', 0.45),
      pupil: '#141821'
    };
  }
  var DEFAULT = palette();

  // Skull half-width per row, index 2..19.
  var SOFT = [0, 0, 5.5, 6.6, 7.2, 7.6, 7.9, 8.0, 8.0, 8.0,
                   8.0, 7.9, 7.8, 7.6, 7.3, 6.9, 6.3, 5.4, 4.2, 2.6];
  var CHAD = [0, 0, 5.8, 6.9, 7.6, 8.0, 8.2, 8.3, 8.3, 8.1,
                   7.6, 7.1, 6.9, 7.1, 7.6, 8.0, 8.0, 6.8, 4.8, 2.8];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function r(g, x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function mir(g, x, y, w, h, col) {   // a rect and its mirror image
    r(g, x, y, w, h, col);
    r(g, W - x - w, y, w, h, col);
  }

  function halfWidths(t) {
    var out = [];
    for (var i = 0; i < SOFT.length; i++) out.push(lerp(SOFT[i], CHAD[i], t));
    return out;
  }

  /* ================================================================
     FRONT
     ================================================================ */
  function front(g, tier, o) {
    o = o || {};
    var C = o.pal || DEFAULT;
    var ex = o.expr || 'neutral';
    var t = tier / 4;
    var hw = halfWidths(t);
    var hard = tier >= 2;
    var y, xl, xr, x;

    for (y = 2; y <= 19; y++) {                // skull
      xl = Math.round(10 - hw[y]);
      xr = Math.round(10 + hw[y]);
      r(g, xl, y, xr - xl, 1, C.skin);
      r(g, xr - 2, y, 2, 1, C.mid);            // light from upper-left
      r(g, xr - 1, y, 1, 1, C.sh);
      r(g, xl, y, 1, 1, C.mid);
    }

    r(g, 7, 5, 6, 1, C.hi);                    // forehead sheen
    mir(g, 5, 6, 2, 1, C.hi);

    if (hard) {
      mir(g, 2, 10, 3, 1, C.hi);               // cheekbone catch-light
      mir(g, 2, 12, 3, 2, C.sh);               // hollow beneath it
      mir(g, 3, 14, 2, 1, C.mid);
      mir(g, 2, 15, 2, 2, C.sh);               // masseter
    }

    if (hard) {                                // jaw
      xl = Math.round(10 - hw[16]);
      r(g, xl, 16, 2, 1, C.dk);                // gonial angle
      r(g, W - xl - 2, 16, 2, 1, C.dk);
      mir(g, xl + 1, 17, 3, 1, C.sh);          // mandible border
      r(g, 7, 18, 6, 1, C.sh);
      r(g, 8, 17, 4, 2, C.hi);                 // lit chin block
      if (tier >= 4) r(g, 10, 18, 1, 1, C.mid);
    } else {
      r(g, 7, 18, 6, 1, C.mid);
      mir(g, 5, 17, 2, 1, C.mid);
    }

    xl = Math.round(10 - hw[10]);              // ears
    mir(g, xl - 1, 9, 1, 4, C.mid);
    mir(g, xl - 1, 10, 1, 2, C.sh);

    var nh = Math.round(lerp(4, 6.5, t));      // neck & traps
    r(g, 10 - nh, 19, nh * 2, 5, C.mid);
    r(g, 10 - nh, 19, nh * 2, 1, C.dk);
    r(g, 10 - nh, 20, 2, 4, C.sh);
    r(g, 10 + nh - 2, 20, 2, 4, C.sh);
    if (tier >= 3) { r(g, 8, 21, 1, 3, C.sh); r(g, 11, 21, 1, 3, C.sh); }

    if (o.stubble !== false && tier >= 3) {
      for (y = 15; y <= 19; y++) {
        xl = Math.round(10 - hw[y]) + 1;
        xr = Math.round(10 + hw[y]) - 1;
        for (x = xl; x < xr; x++) {
          if (((x + y) & 1) !== 0) continue;
          if (y >= 16 && y <= 17 && Math.abs(x - 10) < 4) continue;
          r(g, x, y, 1, 1, C.stub);
        }
      }
      mir(g, 6, 15, 2, 1, C.stub);
    }

    hairFront(g, tier, hw, C, o.hairStyle);
    brows(g, tier, hard, ex, C);
    eyes(g, tier, hard, ex, C, o);
    nose(g, hard, C);
    mouth(g, hard, ex, C, o);
  }

  function brows(g, tier, hard, ex, C) {
    if (ex === 'scared' || ex === 'soy') {
      mir(g, 3, 4, 5, 1, C.hairDk);            // shot up
      mir(g, 3, 5, 2, 1, C.hairDk);
      return;
    }
    if (ex === 'angry' || ex === 'smug') {
      mir(g, 3, 6, 6, 2, C.hairDk);            // driven down at the inner end
      mir(g, 7, 8, 2, 1, C.hairDk);
      return;
    }
    if (!hard) {
      mir(g, 4, 6, 4, 1, C.hairHi);
      mir(g, 5, 5, 2, 1, C.hairHi);
    } else {
      mir(g, 4, 7, 5, 1, C.hair);
      mir(g, 4, 6, 3, 1, C.hair);
      mir(g, 4, 7, 2, 1, C.hairDk);
    }
  }

  function eyes(g, tier, hard, ex, C, o) {
    if (ex === 'soy' || ex === 'scared') {
      mir(g, 3, 8, 6, 6, C.white);
      mir(g, 3, 8, 6, 1, C.line);
      mir(g, 5, 10, 2, 2, C.pupil);
      return;
    }
    if (o.blink) { mir(g, 4, 10, 5, 1, C.line); return; }
    if (ex === 'smug') {                       // lidded and amused
      mir(g, 4, 9, 6, 1, C.line);
      mir(g, 4, 10, 5, 2, C.white);
      mir(g, 5, 10, 3, 2, C.iris);
      mir(g, 6, 10, 2, 2, C.pupil);
      mir(g, 4, 12, 5, 1, C.sh);
      return;
    }
    if (tier <= 1) {                           // doe
      mir(g, 4, 8, 5, 1, C.line);
      mir(g, 4, 9, 5, 4, C.white);
      mir(g, 4, 9, 1, 1, C.skin); mir(g, 8, 9, 1, 1, C.skin);
      mir(g, 4, 12, 1, 1, C.skin); mir(g, 8, 12, 1, 1, C.skin);
      mir(g, 5, 10, 3, 3, C.iris);
      mir(g, 6, 10, 2, 2, C.pupil);
      mir(g, 5, 10, 1, 1, C.white);
      return;
    }
    if (tier === 2) {
      mir(g, 4, 8, 6, 1, C.line);
      mir(g, 4, 9, 5, 3, C.white);
      mir(g, 5, 9, 3, 3, C.iris);
      mir(g, 6, 10, 2, 2, C.pupil);
      mir(g, 5, 9, 1, 1, C.white);
      mir(g, 4, 12, 5, 1, C.sh);
      return;
    }
    // hunter: hooded, narrow, outer corner a pixel above the inner
    mir(g, 4, 8, 5, 1, C.sh);
    mir(g, 3, 9, 6, 1, C.line);
    mir(g, 3, 10, 3, 1, C.pupil);
    mir(g, 4, 10, 2, 1, C.irisDk);
    mir(g, 5, 11, 4, 1, C.line);
    mir(g, 6, 11, 2, 1, C.irisDk);
    mir(g, 6, 11, 1, 1, C.iris);
    mir(g, 8, 11, 1, 1, C.white);
    mir(g, 3, 11, 2, 1, C.sh);
    mir(g, 5, 12, 4, 1, C.sh);
    if (tier >= 4) mir(g, 4, 13, 4, 1, C.mid);
  }

  function nose(g, hard, C) {
    if (!hard) {
      r(g, 9, 13, 2, 2, C.mid);
      r(g, 9, 14, 3, 1, C.sh);
      r(g, 9, 13, 1, 1, C.hi);
    } else {
      r(g, 11, 11, 1, 3, C.mid);
      r(g, 9, 11, 1, 3, C.hi);
      r(g, 9, 14, 3, 1, C.sh);
      r(g, 8, 14, 1, 1, C.dk);
      r(g, 12, 14, 1, 1, C.dk);
      r(g, 9, 13, 2, 1, C.hi);
    }
  }

  function mouth(g, hard, ex, C, o) {
    if (ex === 'soy' || ex === 'scared') {
      r(g, 8, 16, 4, 4, C.lipDk);
      r(g, 9, 17, 2, 2, '#2a0f0c');
      return;
    }
    if (o.mouth > 0.5) {                       // chewing
      r(g, 7, 16, 6, 3, C.lipDk);
      r(g, 8, 17, 4, 2, '#33120f');
      r(g, 8, 16, 4, 1, C.white);
      return;
    }
    if (ex === 'smug') {                       // one corner up
      r(g, 8, 16, 5, 1, C.lipDk);
      r(g, 12, 15, 2, 1, C.lipDk);
      r(g, 9, 17, 3, 1, C.lip);
      return;
    }
    if (!hard) {
      r(g, 8, 16, 4, 1, C.lip);
      r(g, 9, 17, 2, 1, C.sh);
    } else {
      r(g, 8, 16, 5, 1, C.lipDk);
      r(g, 9, 17, 3, 1, C.lip);
      r(g, 7, 16, 1, 1, C.mid);
      r(g, 13, 16, 1, 1, C.mid);
    }
  }

  function hairFront(g, tier, hw, C, style) {
    var y, w, xl, xr;
    style = style || (tier <= 1 ? 'mop' : 'fade');

    if (style === 'buzz') {
      for (y = 1; y <= 5; y++) {
        w = Math.round(hw[Math.max(2, y)]) - (y === 1 ? 1 : 0);
        r(g, 10 - w, y, w * 2, 1, C.hairDk);
      }
      r(g, 6, 2, 8, 1, C.hairHi);
      xl = Math.round(10 - hw[6]); xr = Math.round(10 + hw[6]);
      r(g, xl, 6, 2, 2, C.hair);
      r(g, xr - 2, 6, 2, 2, C.hair);
      return;
    }
    if (style === 'fringe') {                  // long hair over the brow
      for (y = 0; y <= 7; y++) {
        w = Math.round(hw[Math.max(2, y)]) + (y > 4 ? 1 : 0) - (y === 0 ? 2 : 0);
        r(g, 10 - w, y, w * 2, 1, C.hair);
      }
      r(g, 4, 8, 4, 2, C.hair);
      r(g, 12, 8, 4, 2, C.hair);
      r(g, 3, 6, 2, 5, C.hair);
      r(g, 15, 6, 2, 5, C.hair);
      r(g, 6, 1, 7, 1, C.hairHi);
      r(g, 11, 4, 4, 1, C.hairHi);
      return;
    }
    if (style === 'beanie') {
      for (y = 0; y <= 6; y++) {
        w = Math.round(hw[Math.max(2, y)]) + 1 - (y === 0 ? 2 : 0);
        r(g, 10 - w, y, w * 2, 1, C.hair);
      }
      r(g, 2, 5, 16, 2, C.hairHi);             // the fold
      r(g, 8, 0, 4, 1, C.hairHi);              // bobble
      return;
    }
    if (style === 'mop') {
      for (y = 0; y <= 5; y++) {
        w = Math.round(hw[Math.max(2, y)]) - (y === 0 ? 2 : (y === 1 ? 1 : 0));
        r(g, 10 - w, y, w * 2, 1, C.hair);
      }
      r(g, 3, 6, 4, 1, C.hair); r(g, 13, 6, 4, 1, C.hair);
      r(g, 4, 7, 2, 2, C.hair); r(g, 14, 7, 2, 2, C.hair);
      r(g, 6, 1, 6, 1, C.hairHi);
      r(g, 5, 2, 3, 1, C.hairHi);
      r(g, 12, 3, 2, 1, C.hairHi);
      return;
    }
    // 'fade' -- sharp cut, faded temples, widow's peak
    for (y = 0; y <= 3; y++) {
      w = Math.round(hw[Math.max(2, y)]) - (y === 0 ? 2 : (y === 1 ? 1 : 0));
      r(g, 10 - w, y, w * 2, 1, C.hairDk);
    }
    xl = Math.round(10 - hw[4]); xr = Math.round(10 + hw[4]);
    r(g, xl, 4, xr - xl, 1, C.hairDk);
    r(g, 8, 5, 4, 1, C.hairDk);
    r(g, 9, 6, 2, 1, C.hairDk);
    r(g, xl, 5, 2, 2, C.hairDk);
    r(g, xr - 2, 5, 2, 2, C.hairDk);
    r(g, xl, 7, 1, 2, C.hair);
    r(g, xr - 1, 7, 1, 2, C.hair);
    r(g, 5, 1, 5, 1, C.hairHi);
    r(g, 11, 2, 4, 1, C.hairHi);
    r(g, 7, 3, 3, 1, C.hairHi);
    if (tier >= 4) { r(g, 6, 0, 1, 1, C.hair); r(g, 10, 0, 1, 1, C.hair); r(g, 14, 0, 1, 1, C.hair); }
  }

  /* ================================================================
     SIDE -- facing right.  [back, front) skin span per row.
     ================================================================ */
  var SOFT_P = [null, [6, 14], [5, 15], [4, 15], [4, 16], [3, 16], [3, 16], [3, 15],
                [3, 15], [3, 16], [3, 17], [3, 17], [3, 15], [3, 15], [3, 15],
                [4, 14], [4, 13], [5, 13], [6, 12], [7, 12]];
  var CHAD_P = [null, [6, 14], [5, 15], [4, 16], [3, 17], [3, 18], [3, 18], [3, 16],
                [3, 16], [3, 17], [3, 19], [3, 19], [3, 16], [3, 17], [3, 17],
                [3, 16], [3, 18], [3, 18], [3, 14], [5, 11]];

  function side(g, tier, o) {
    o = o || {};
    var C = o.pal || DEFAULT;
    var ex = o.expr || 'neutral';
    var t = tier / 4;
    var hard = tier >= 2;
    var y, x, a, b;
    var span = [null];

    for (y = 1; y <= 19; y++) {
      a = Math.round(lerp(SOFT_P[y][0], CHAD_P[y][0], t));
      b = Math.round(lerp(SOFT_P[y][1], CHAD_P[y][1], t));
      span[y] = [a, b];
      r(g, a, y, b - a, 1, C.skin);
      r(g, b - 2, y, 2, 1, C.hi);
      r(g, a, y, 2, 1, C.mid);
    }

    // The underside of the face is the jawline: trace the lowest filled
    // pixel of every column and darken it.
    for (x = 2; x < 20; x++) {
      var low = -1;
      for (y = 1; y <= 19; y++) if (span[y] && x >= span[y][0] && x < span[y][1]) low = y;
      if (low >= 13) r(g, x, low, 1, 1, hard ? C.dk : C.mid);
      if (low >= 15 && hard) r(g, x, low - 1, 1, 1, C.sh);
    }

    var bf = span[5][1];                        // brow ridge
    r(g, bf - 4, 5, 4, 1, hard ? C.hairDk : C.hairHi);
    r(g, bf - 3, 6, 3, 1, hard ? C.hairDk : C.hairHi);
    if (hard) r(g, bf - 5, 7, 4, 1, C.sh);

    var ef = span[8][1];                        // eye
    if (ex === 'scared') {
      r(g, ef - 5, 8, 4, 4, C.white);
      r(g, ef - 4, 9, 2, 2, C.pupil);
    } else if (!hard) {
      r(g, ef - 5, 8, 4, 1, C.line);
      r(g, ef - 5, 9, 4, 2, C.white);
      r(g, ef - 4, 9, 2, 2, C.pupil);
      r(g, ef - 5, 11, 4, 1, C.sh);
    } else {
      r(g, ef - 6, 7, 5, 1, C.sh);
      r(g, ef - 6, 8, 5, 1, C.line);
      r(g, ef - 5, 9, 3, 1, C.irisDk);
      r(g, ef - 5, 9, 2, 1, C.pupil);
      r(g, ef - 6, 10, 4, 1, C.sh);
    }

    r(g, span[10][1] - 3, 10, 3, 1, C.hi);      // nose
    r(g, span[11][1] - 2, 11, 2, 1, C.hi);
    r(g, span[11][1] - 3, 11, 1, 1, C.sh);
    r(g, span[12][1] - 2, 12, 2, 1, C.sh);

    r(g, span[13][1] - 3, 13, 2, 1, C.lipDk);   // lips
    r(g, span[14][1] - 3, 14, 2, 1, C.lip);
    r(g, span[15][1] - 3, 15, 2, 1, C.sh);
    if (o.mouth > 0.5 || ex === 'scared') {
      r(g, span[13][1] - 4, 13, 4, 2, '#33120f');
      r(g, span[13][1] - 4, 13, 3, 1, C.white);
    }
    if (hard) {
      r(g, span[16][1] - 3, 16, 3, 2, C.hi);
      r(g, span[16][1] - 4, 16, 1, 2, C.sh);
    }

    r(g, 6, 10, 3, 4, C.mid);                   // ear
    r(g, 7, 11, 1, 3, C.sh);
    r(g, 6, 10, 1, 1, C.sh);

    if (o.stubble !== false && tier >= 3) {
      for (y = 13; y <= 18; y++) {
        if (!span[y]) continue;
        for (x = span[y][0] + 3; x < span[y][1] - 1; x++)
          if (((x + y) & 1) === 0) r(g, x, y, 1, 1, C.stub);
      }
    }

    var nb = Math.round(lerp(8, 6, t));         // neck
    var nw = Math.round(lerp(6, 9, t));
    r(g, nb, 19, nw, 5, C.mid);
    r(g, nb, 19, 2, 5, C.sh);
    r(g, nb, 19, nw, 1, C.dk);

    hairSide(g, tier, t, span, C, o.hairStyle);
  }

  function hairSide(g, tier, t, span, C, style) {
    style = style || (tier <= 1 ? 'mop' : 'fade');
    var y, a, b;
    var longHair = (style === 'mop' || style === 'fringe' || style === 'beanie');
    var bottom = longHair ? (style === 'fringe' ? 7 : 6) : 4;
    var col = (style === 'beanie') ? C.hair : (longHair ? C.hair : C.hairDk);

    for (y = 0; y <= bottom; y++) {
      var s = span[Math.max(1, y)];
      a = s[0] - (y > 1 ? 1 : 0);
      b = s[1] - (longHair ? (y < 3 ? 1 : 0) : 2);
      r(g, a, y, b - a, 1, col);
    }
    r(g, 5, 1, 5, 1, C.hairHi);
    if (style === 'beanie') { r(g, 2, 5, 15, 2, C.hairHi); return; }
    if (longHair) {
      r(g, 12, 5, 3, 1, col);
      r(g, 2, 5, 3, 4, col);
      r(g, 3, 9, 2, 1, col);
      if (style === 'fringe') { r(g, 2, 9, 3, 4, col); r(g, 13, 7, 3, 1, col); }
      return;
    }
    r(g, 11, 2, 3, 1, C.hairHi);
    r(g, 12, 5, 4, 1, C.hairDk);
    r(g, 14, 6, 2, 1, C.hairDk);
    r(g, 2, 5, 2, 3, C.hairDk);
    r(g, 2, 8, 2, 2, C.hair);
    r(g, 3, 10, 1, 2, C.hair);
  }

  /* ================================================================
     BACK
     ================================================================ */
  function back(g, tier, o) {
    o = o || {};
    var C = o.pal || DEFAULT;
    var style = o.hairStyle || (tier <= 1 ? 'mop' : 'fade');
    var t = tier / 4;
    var hw = halfWidths(t);
    var y, w;
    var longHair = (style === 'mop' || style === 'fringe' || style === 'beanie');
    var napeTop = style === 'fringe' ? 18 : (longHair ? 15 : 13);
    var col = longHair ? C.hair : C.hairDk;

    for (y = 0; y <= napeTop; y++) {
      w = Math.round(hw[Math.max(2, Math.min(19, y))]) - (y === 0 ? 2 : (y === 1 ? 1 : 0));
      r(g, 10 - w, y, w * 2, 1, col);
      r(g, 10 + w - 2, y, 2, 1, mix(col, '#000000', 0.3));
      r(g, 10 - w, y, 1, 1, C.hairHi);
    }
    r(g, 7, 1, 5, 1, C.hairHi);
    r(g, 6, 3, 3, 1, C.hairHi);
    r(g, 12, 4, 3, 1, C.hairHi);
    if (style === 'beanie') r(g, 2, 5, 16, 2, C.hairHi);
    if (!longHair) {
      r(g, 5, napeTop - 1, 10, 1, C.hair);
      r(g, 6, napeTop, 8, 1, C.hairHi);
      r(g, 7, napeTop + 1, 6, 1, C.sh);
    }

    var ew = Math.round(hw[10]);
    mir(g, 10 - ew - 1, 9, 2, 4, C.mid);
    mir(g, 10 - ew - 1, 10, 1, 2, C.sh);

    var nh = Math.round(lerp(3.5, 6, t));
    var top = napeTop + (longHair ? 1 : 2);
    r(g, 10 - nh, top, nh * 2, H - top, C.mid);
    r(g, 10 - nh, top, nh * 2, 1, C.dk);
    r(g, 10 - nh, top + 1, 2, H - top, C.sh);
    r(g, 10 + nh - 2, top + 1, 2, H - top, C.sh);
    if (tier >= 3) { r(g, 8, top + 2, 1, H, C.sh); r(g, 11, top + 2, 1, H, C.sh); }
  }

  BP.face = {
    W: W, H: H, palette: palette, DEFAULT: DEFAULT, mix: mix,
    front: front, side: side, back: back,
    draw: function (g, view, tier, o) {
      if (view === 'side') side(g, tier, o);
      else if (view === 'back') back(g, tier, o);
      else front(g, tier, o);
    }
  };
})(window.BP = window.BP || {});
