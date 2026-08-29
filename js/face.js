/* ------------------------------------------------------------------
   face.js -- BP MAN's face, drawn parametrically so it can visibly
   ascend from soft-and-round to full jawline + hunter eyes.

   Everything is drawn 1:1 into a 20 x 24 pixel box; callers blit it
   at whatever integer scale they need (sprite = 1x, HUD = 2x,
   ascension cutscene = 5x).  Tier 0..4:

     0 SOFT       round skull, doe eyes, mop hair
     1 SHARPENING slight taper, brows drop
     2 JAWLINE    mandible flares, cheeks hollow
     3 HUNTER     hooded slit eyes, stubble
     4 GIGACHAD   everything, plus the chain and the glow

   Vertical budget (front):  0-5 hair | 5-6 brow | 7-11 eyes
   11-14 nose | 15-16 mouth | 16-19 chin | 19-23 neck
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var W = 20, H = 24;

  var C = {
    hi:   '#ffd9ad',
    skin: '#f0b78a',
    mid:  '#d9986a',
    sh:   '#bd7d54',
    dk:   '#96603c',
    line: '#5e3520',
    stub: '#c99873',
    hairHi: '#6d5340',
    hair:   '#3d2a20',
    hairDk: '#22150e',
    white:  '#fdfbf6',
    iris:   '#5a8cbe',
    irisDk: '#2f5680',
    pupil:  '#141821',
    lip:    '#c47a62',
    lipDk:  '#94513c'
  };

  // Skull half-width per row, index 2..19.
  //                0  1   2    3    4    5    6    7    8    9
  var SOFT = [0, 0, 5.5, 6.6, 7.2, 7.6, 7.9, 8.0, 8.0, 8.0,
  //               10   11   12   13   14   15   16   17   18   19
                   8.0, 7.9, 7.8, 7.6, 7.3, 6.9, 6.3, 5.4, 4.2, 2.6];
  var CHAD = [0, 0, 5.8, 6.9, 7.6, 8.0, 8.2, 8.3, 8.3, 8.1,
                   7.6, 7.1, 6.9, 7.1, 7.6, 8.0, 8.0, 6.8, 4.8, 2.8];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function r(g, x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  // A rect plus its mirror image about the vertical centre line.
  function mir(g, x, y, w, h, col) {
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
    var t = tier / 4;
    var hw = halfWidths(t);
    var hard = tier >= 2;
    var y, xl, xr, x;

    // --- skull ---------------------------------------------------
    for (y = 2; y <= 19; y++) {
      xl = Math.round(10 - hw[y]);
      xr = Math.round(10 + hw[y]);
      r(g, xl, y, xr - xl, 1, C.skin);
      r(g, xr - 2, y, 2, 1, C.mid);      // light comes from upper-left
      r(g, xr - 1, y, 1, 1, C.sh);
      r(g, xl, y, 1, 1, C.mid);
    }

    // forehead sheen
    r(g, 7, 5, 6, 1, C.hi);
    mir(g, 5, 6, 2, 1, C.hi);

    if (hard) {
      // cheekbone catch-light, then the hollow beneath it
      mir(g, 2, 10, 3, 1, C.hi);
      mir(g, 2, 12, 3, 2, C.sh);
      mir(g, 3, 14, 2, 1, C.mid);
      mir(g, 2, 15, 2, 2, C.sh);         // masseter
    }

    // --- jaw / chin ----------------------------------------------
    if (hard) {
      xl = Math.round(10 - hw[16]);
      r(g, xl, 16, 2, 1, C.dk);          // gonial angle
      r(g, W - xl - 2, 16, 2, 1, C.dk);
      mir(g, xl + 1, 17, 3, 1, C.sh);    // mandible border
      r(g, 7, 18, 6, 1, C.sh);
      r(g, 8, 17, 4, 2, C.hi);           // lit chin block
      if (tier >= 4) r(g, 10, 18, 1, 1, C.mid);   // cleft
    } else {
      r(g, 7, 18, 6, 1, C.mid);          // soft, rounded underside
      mir(g, 5, 17, 2, 1, C.mid);
    }

    // --- ears ----------------------------------------------------
    xl = Math.round(10 - hw[10]);
    mir(g, xl - 1, 9, 1, 4, C.mid);
    mir(g, xl - 1, 10, 1, 2, C.sh);

    // --- neck & traps --------------------------------------------
    var nh = Math.round(lerp(4, 6.5, t));
    r(g, 10 - nh, 19, nh * 2, 5, C.mid);
    r(g, 10 - nh, 19, nh * 2, 1, C.dk);  // shadow cast by the jaw
    r(g, 10 - nh, 20, 2, 4, C.sh);
    r(g, 10 + nh - 2, 20, 2, 4, C.sh);
    if (tier >= 3) { r(g, 8, 21, 1, 3, C.sh); r(g, 11, 21, 1, 3, C.sh); }

    // --- stubble (fine dither, close to skin tone) ----------------
    if (tier >= 3) {
      for (y = 15; y <= 19; y++) {
        xl = Math.round(10 - hw[y]) + 1;
        xr = Math.round(10 + hw[y]) - 1;
        for (x = xl; x < xr; x++) {
          if (((x + y) & 1) !== 0) continue;
          if (y >= 16 && y <= 17 && Math.abs(x - 10) < 4) continue;  // keep the mouth clear
          r(g, x, y, 1, 1, C.stub);
        }
      }
      mir(g, 6, 15, 2, 1, C.stub);       // moustache shadow
    }

    hairFront(g, tier, hw);

    // --- brows ----------------------------------------------------
    if (o.soy) {
      mir(g, 3, 4, 5, 1, C.hairDk);
      mir(g, 3, 5, 2, 1, C.hairDk);
    } else if (!hard) {
      mir(g, 4, 6, 4, 1, C.hairHi);
      mir(g, 5, 5, 2, 1, C.hairHi);
    } else {
      mir(g, 4, 7, 5, 1, C.hair);        // straight, low-set, heavy
      mir(g, 4, 6, 3, 1, C.hair);
      mir(g, 4, 7, 2, 1, C.hairDk);
    }

    // --- eyes -----------------------------------------------------
    if (o.soy) soyEyes(g);
    else if (o.blink) mir(g, 4, 10, 5, 1, C.line);
    else if (tier <= 1) doeEyes(g);
    else if (tier === 2) neutralEyes(g);
    else hunterEyes(g, tier);

    // --- nose -----------------------------------------------------
    if (!hard) {
      r(g, 9, 13, 2, 2, C.mid);
      r(g, 9, 14, 3, 1, C.sh);
      r(g, 9, 13, 1, 1, C.hi);
    } else {
      r(g, 11, 11, 1, 3, C.mid);         // bridge shadow
      r(g, 9, 11, 1, 3, C.hi);           // bridge highlight
      r(g, 9, 14, 3, 1, C.sh);           // tip shadow
      r(g, 8, 14, 1, 1, C.dk);           // nostrils
      r(g, 12, 14, 1, 1, C.dk);
      r(g, 9, 13, 2, 1, C.hi);
    }

    // --- mouth ----------------------------------------------------
    if (o.soy) {
      r(g, 8, 16, 4, 4, C.lipDk);
      r(g, 9, 17, 2, 2, '#2a0f0c');
    } else if (o.mouth > 0.5) {
      r(g, 7, 16, 6, 3, C.lipDk);        // chomp
      r(g, 8, 17, 4, 2, '#33120f');
      r(g, 8, 16, 4, 1, C.white);
    } else if (!hard) {
      r(g, 8, 16, 4, 1, C.lip);
      r(g, 9, 17, 2, 1, C.sh);
    } else {
      r(g, 8, 16, 5, 1, C.lipDk);        // level and unbothered
      r(g, 9, 17, 3, 1, C.lip);
      r(g, 7, 16, 1, 1, C.mid);
      r(g, 13, 16, 1, 1, C.mid);
    }
  }

  function doeEyes(g) {
    mir(g, 4, 8, 5, 1, C.line);          // lash
    mir(g, 4, 9, 5, 4, C.white);
    mir(g, 4, 9, 1, 1, C.skin);          // round off the corners
    mir(g, 8, 9, 1, 1, C.skin);
    mir(g, 4, 12, 1, 1, C.skin);
    mir(g, 8, 12, 1, 1, C.skin);
    mir(g, 5, 10, 3, 3, C.iris);
    mir(g, 6, 10, 2, 2, C.pupil);
    mir(g, 5, 10, 1, 1, C.white);        // wet glint
  }

  function neutralEyes(g) {
    mir(g, 4, 8, 6, 1, C.line);
    mir(g, 4, 9, 5, 3, C.white);
    mir(g, 5, 9, 3, 3, C.iris);
    mir(g, 6, 10, 2, 2, C.pupil);
    mir(g, 5, 9, 1, 1, C.white);
    mir(g, 4, 12, 5, 1, C.sh);
  }

  // Hooded and narrow, with a positive canthal tilt: the outer corner
  // (low x on the left eye) sits a pixel above the inner corner.
  function hunterEyes(g, tier) {
    mir(g, 4, 8, 5, 1, C.sh);            // brow-ridge shadow
    mir(g, 3, 9, 6, 1, C.line);          // heavy upper lash, gap at the bridge
    // outer half of the opening, one row high
    mir(g, 3, 10, 3, 1, C.pupil);
    mir(g, 4, 10, 2, 1, C.irisDk);
    // inner half sits a row lower -> the slit tilts down toward the nose
    mir(g, 5, 11, 4, 1, C.line);
    mir(g, 6, 11, 2, 1, C.irisDk);
    mir(g, 6, 11, 1, 1, C.iris);
    mir(g, 8, 11, 1, 1, C.white);        // inner-corner catchlight
    mir(g, 3, 11, 2, 1, C.sh);           // lower lid under the outer corner
    mir(g, 5, 12, 4, 1, C.sh);           // eye-area hollow
    if (tier >= 4) mir(g, 4, 13, 4, 1, C.mid);
  }

  function soyEyes(g) {
    mir(g, 3, 7, 6, 6, C.white);
    mir(g, 3, 7, 6, 1, C.line);
    mir(g, 5, 9, 2, 2, C.pupil);
  }

  function hairFront(g, tier, hw) {
    var y, w, xl, xr;
    if (tier <= 1) {
      // soft mop, sits low over the forehead
      for (y = 0; y <= 5; y++) {
        w = Math.round(hw[Math.max(2, y)]) - (y === 0 ? 2 : (y === 1 ? 1 : 0));
        r(g, 10 - w, y, w * 2, 1, C.hair);
      }
      r(g, 3, 6, 4, 1, C.hair);          // fringe corners hang down
      r(g, 13, 6, 4, 1, C.hair);
      r(g, 4, 7, 2, 2, C.hair);
      r(g, 14, 7, 2, 2, C.hair);
      r(g, 6, 1, 6, 1, C.hairHi);
      r(g, 5, 2, 3, 1, C.hairHi);
      r(g, 12, 3, 2, 1, C.hairHi);
    } else {
      // sharp cut: full crown, faded temples, widow's peak
      for (y = 0; y <= 4; y++) {
        w = Math.round(hw[Math.max(2, y)]) - (y === 0 ? 2 : (y === 1 ? 1 : 0));
        r(g, 10 - w, y, w * 2, 1, C.hairDk);
      }
      xl = Math.round(10 - hw[4]); xr = Math.round(10 + hw[4]);
      r(g, xl, 4, xr - xl, 1, C.hairDk); // hairline row
      r(g, 8, 5, 4, 1, C.hairDk);        // widow's peak, forehead either side
      r(g, 9, 6, 2, 1, C.hairDk);
      r(g, xl, 5, 2, 2, C.hairDk);       // temple taper
      r(g, xr - 2, 5, 2, 2, C.hairDk);
      r(g, xl, 7, 1, 2, C.hair);         // fade
      r(g, xr - 1, 7, 1, 2, C.hair);
      r(g, 5, 1, 5, 1, C.hairHi);        // strands
      r(g, 11, 2, 4, 1, C.hairHi);
      r(g, 7, 3, 3, 1, C.hairHi);
      if (tier >= 4) { r(g, 6, 0, 1, 1, C.hair); r(g, 10, 0, 1, 1, C.hair); r(g, 14, 0, 1, 1, C.hair); }
    }
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
    var t = tier / 4;
    var hard = tier >= 2;
    var y, x, a, b;
    var span = [null];

    for (y = 1; y <= 19; y++) {
      a = Math.round(lerp(SOFT_P[y][0], CHAD_P[y][0], t));
      b = Math.round(lerp(SOFT_P[y][1], CHAD_P[y][1], t));
      span[y] = [a, b];
      r(g, a, y, b - a, 1, C.skin);
      r(g, b - 2, y, 2, 1, C.hi);        // lit face front
      r(g, a, y, 2, 1, C.mid);           // shaded back of skull
    }

    // The underside edge of the face IS the jawline: trace the lowest
    // filled pixel of every column and darken it.
    for (x = 2; x < 20; x++) {
      var low = -1;
      for (y = 1; y <= 19; y++) if (span[y] && x >= span[y][0] && x < span[y][1]) low = y;
      if (low >= 13) r(g, x, low, 1, 1, hard ? C.dk : C.mid);
      if (low >= 15 && hard) r(g, x, low - 1, 1, 1, C.sh);
    }

    // brow ridge
    var bf = span[5][1];
    r(g, bf - 4, 5, 4, 1, hard ? C.hairDk : C.hairHi);
    r(g, bf - 3, 6, 3, 1, hard ? C.hairDk : C.hairHi);
    if (hard) r(g, bf - 5, 7, 4, 1, C.sh);

    // eye, tucked in behind the brow
    var ef = span[8][1];
    if (!hard) {
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

    // nose ridge and tip
    r(g, span[10][1] - 3, 10, 3, 1, C.hi);
    r(g, span[11][1] - 2, 11, 2, 1, C.hi);
    r(g, span[11][1] - 3, 11, 1, 1, C.sh);
    r(g, span[12][1] - 2, 12, 2, 1, C.sh);   // nostril shadow

    // lips
    r(g, span[13][1] - 3, 13, 2, 1, C.lipDk);
    r(g, span[14][1] - 3, 14, 2, 1, C.lip);
    r(g, span[15][1] - 3, 15, 2, 1, C.sh);   // mentolabial crease
    if (o.mouth > 0.5) {
      r(g, span[13][1] - 4, 13, 4, 2, '#33120f');
      r(g, span[13][1] - 4, 13, 3, 1, C.white);
    }
    if (hard) {                              // chin block, thrown forward
      r(g, span[16][1] - 3, 16, 3, 2, C.hi);
      r(g, span[16][1] - 4, 16, 1, 2, C.sh);
    }

    // ear
    r(g, 6, 10, 3, 4, C.mid);
    r(g, 7, 11, 1, 3, C.sh);
    r(g, 6, 10, 1, 1, C.sh);

    // stubble
    if (tier >= 3) {
      for (y = 13; y <= 18; y++) {
        if (!span[y]) continue;
        for (x = span[y][0] + 3; x < span[y][1] - 1; x++)
          if (((x + y) & 1) === 0) r(g, x, y, 1, 1, C.stub);
      }
    }

    // neck
    var nb = Math.round(lerp(8, 6, t));
    var nw = Math.round(lerp(6, 9, t));
    r(g, nb, 19, nw, 5, C.mid);
    r(g, nb, 19, 2, 5, C.sh);
    r(g, nb, 19, nw, 1, C.dk);

    hairSide(g, tier, t, span);
  }

  function hairSide(g, tier, t, span) {
    var y, a, b;
    var bottom = tier <= 1 ? 6 : 4;
    for (y = 0; y <= bottom; y++) {
      var s = span[Math.max(1, y)];
      a = s[0] - (y > 1 ? 1 : 0);
      b = s[1] - (tier <= 1 ? (y < 3 ? 1 : 0) : 2);
      r(g, a, y, b - a, 1, tier <= 1 ? C.hair : C.hairDk);
    }
    if (tier <= 1) {
      r(g, 5, 1, 5, 1, C.hairHi);
      r(g, 12, 5, 3, 1, C.hair);         // fringe over the brow
      r(g, 2, 5, 3, 4, C.hair);          // hangs at the back
      r(g, 3, 9, 2, 1, C.hair);
    } else {
      r(g, 5, 1, 5, 1, C.hairHi);
      r(g, 11, 2, 3, 1, C.hairHi);
      r(g, 12, 5, 4, 1, C.hairDk);       // quiff pushed forward
      r(g, 14, 6, 2, 1, C.hairDk);
      r(g, 2, 5, 2, 3, C.hairDk);        // faded back and sides
      r(g, 2, 8, 2, 2, C.hair);
      r(g, 3, 10, 1, 2, C.hair);
    }
  }

  /* ================================================================
     BACK
     ================================================================ */
  function back(g, tier) {
    var t = tier / 4;
    var hw = halfWidths(t);
    var y, w;
    var napeTop = tier <= 1 ? 15 : 13;

    for (y = 0; y <= napeTop; y++) {
      w = Math.round(hw[Math.max(2, y)]) - (y === 0 ? 2 : (y === 1 ? 1 : 0));
      if (y > 15) w = Math.round(hw[y]);
      r(g, 10 - w, y, w * 2, 1, tier <= 1 ? C.hair : C.hairDk);
      r(g, 10 + w - 2, y, 2, 1, tier <= 1 ? C.hairDk : '#170e07');
      r(g, 10 - w, y, 1, 1, C.hairHi);
    }
    // crown whorl + strands
    r(g, 7, 1, 5, 1, C.hairHi);
    r(g, 6, 3, 3, 1, C.hairHi);
    r(g, 12, 4, 3, 1, C.hairHi);
    if (tier >= 2) {                     // faded nape
      r(g, 5, napeTop - 1, 10, 1, C.hair);
      r(g, 6, napeTop, 8, 1, C.hairHi);
      r(g, 7, napeTop + 1, 6, 1, C.sh);
    }
    // ears peeking out
    var ew = Math.round(hw[10]);
    mir(g, 10 - ew - 1, 9, 2, 4, C.mid);
    mir(g, 10 - ew - 1, 10, 1, 2, C.sh);

    // neck & traps
    var nh = Math.round(lerp(3.5, 6, t));
    var top = napeTop + (tier <= 1 ? 1 : 2);
    r(g, 10 - nh, top, nh * 2, H - top, C.mid);
    r(g, 10 - nh, top, nh * 2, 1, C.dk);
    r(g, 10 - nh, top + 1, 2, H - top, C.sh);
    r(g, 10 + nh - 2, top + 1, 2, H - top, C.sh);
    if (tier >= 3) { r(g, 8, top + 2, 1, H, C.sh); r(g, 11, top + 2, 1, H, C.sh); }
  }

  BP.face = {
    W: W, H: H, C: C,
    front: front, side: side, back: back,
    draw: function (g, view, tier, o) {
      if (view === 'side') side(g, tier, o);
      else if (view === 'back') back(g, tier, o);
      else front(g, tier, o);
    }
  };
})(window.BP = window.BP || {});
