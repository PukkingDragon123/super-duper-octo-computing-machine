/* ------------------------------------------------------------------
   audio.js -- everything synthesised with WebAudio, no assets.
   ------------------------------------------------------------------ */
(function (BP) {
  'use strict';

  var ctx = null, master = null, muted = false, noiseBuf = null;

  function init() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    var len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function tone(o) {
    if (!init() || muted) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.from, t0);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.vol || 0.25, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  }

  function noise(o) {
    if (!init() || muted) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'bandpass';
    filt.frequency.setValueAtTime(o.freq || 900, t0);
    if (o.freqTo) filt.frequency.exponentialRampToValueAtTime(o.freqTo, t0 + o.dur);
    filt.Q.value = o.q || 1.2;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(o.vol || 0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(filt); filt.connect(gain); gain.connect(master);
    src.start(t0); src.stop(t0 + o.dur + 0.02);
  }

  var chompFlip = 0;
  var S = {
    chomp: function () {
      chompFlip ^= 1;
      tone({ type: 'square', from: chompFlip ? 170 : 132, to: chompFlip ? 96 : 76, dur: 0.055, vol: 0.16 });
    },
    hammer: function () {
      noise({ freq: 1800, freqTo: 260, dur: 0.28, vol: 0.34, filter: 'lowpass' });
      tone({ type: 'sawtooth', from: 320, to: 70, dur: 0.3, vol: 0.24 });
    },
    mog: function (n) {
      var base = 300 + n * 90;
      tone({ type: 'square', from: base, to: base * 2.1, dur: 0.1, vol: 0.24 });
      tone({ type: 'square', from: base * 2, to: base * 3.2, dur: 0.12, vol: 0.2, delay: 0.09 });
      noise({ freq: 2600, freqTo: 700, dur: 0.16, vol: 0.22 });
    },
    aura: function () {
      tone({ type: 'sawtooth', from: 90, to: 1400, dur: 0.45, vol: 0.3 });
      tone({ type: 'square', from: 1400, to: 180, dur: 0.5, vol: 0.16, delay: 0.12 });
      noise({ freq: 300, freqTo: 5200, dur: 0.5, vol: 0.3, filter: 'bandpass', q: 0.7 });
    },
    pickup: function () {
      tone({ type: 'triangle', from: 620, to: 1180, dur: 0.12, vol: 0.24 });
      tone({ type: 'triangle', from: 930, to: 1560, dur: 0.14, vol: 0.18, delay: 0.08 });
    },
    tierUp: function () {
      [392, 523, 659, 784, 1047].forEach(function (f, i) {
        tone({ type: 'square', from: f, to: f, dur: 0.14, vol: 0.22, delay: i * 0.09 });
      });
      noise({ freq: 600, freqTo: 6000, dur: 0.6, vol: 0.18, delay: 0.1 });
    },
    death: function () {
      tone({ type: 'sawtooth', from: 440, to: 55, dur: 0.9, vol: 0.28 });
      tone({ type: 'square', from: 220, to: 40, dur: 1.0, vol: 0.16, delay: 0.1 });
    },
    level: function () {
      [523, 659, 784, 1047, 1319].forEach(function (f, i) {
        tone({ type: 'triangle', from: f, to: f * 1.01, dur: 0.16, vol: 0.22, delay: i * 0.11 });
      });
    },
    start: function () {
      [262, 330, 392, 523].forEach(function (f, i) {
        tone({ type: 'square', from: f, to: f, dur: 0.13, vol: 0.2, delay: i * 0.13 });
      });
    },
    gameover: function () {
      [392, 349, 294, 233, 175].forEach(function (f, i) {
        tone({ type: 'square', from: f, to: f * 0.98, dur: 0.24, vol: 0.22, delay: i * 0.19 });
      });
    },
    ui: function () { tone({ type: 'square', from: 700, to: 900, dur: 0.05, vol: 0.14 }); }
  };

  BP.audio = {
    init: init, resume: resume, sfx: S,
    toggle: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; }
  };
})(window.BP = window.BP || {});
