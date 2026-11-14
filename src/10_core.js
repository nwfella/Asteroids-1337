/* ============================================================================
   ASTEROIDS-1337 — single-file vector arcade shooter
   Engine core: sizing, settings, audio, object pools, effect spawners.
   ========================================================================== */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var rndi = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
  var angDiff = function (a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  /* ---------------------------------------------------------------- settings */
  var SET = {
    quality: 'high', bloom: true, crt: true, shake: true, sound: true,
    volume: 0.55, hand: 'auto', best: 0
  };
  try {
    var saved = JSON.parse(localStorage.getItem('ast1337.set') || '{}');
    for (var k in SET) if (saved[k] !== undefined) SET[k] = saved[k];
    SET.best = Number(saved.best) || 0;
  } catch (e) { }
  function saveSet() { try { localStorage.setItem('ast1337.set', JSON.stringify(SET)); } catch (e) { } }

  var Q = { maxParts: 1400, partMul: 1, dprCap: 2, aber: true, bloom: true };
  function applyQuality() {
    if (SET.quality === 'performance') { Q.maxParts = 380; Q.partMul = 0.5; Q.dprCap = 1; Q.aber = false; Q.bloom = false; }
    else if (SET.quality === 'balanced') { Q.maxParts = 820; Q.partMul = 0.78; Q.dprCap = 1.5; Q.aber = false; Q.bloom = true; }
    else { Q.maxParts = 1400; Q.partMul = 1; Q.dprCap = 2; Q.aber = true; Q.bloom = true; }
  }
  applyQuality();

  /* ------------------------------------------------------------ canvas setup */
  var app = document.getElementById('app');
  var cv = document.getElementById('game');
  var ctx = cv.getContext('2d', { alpha: false });
  var scene = document.createElement('canvas');
  var sctx = scene.getContext('2d', { alpha: false });
  var bloomCv = document.createElement('canvas');
  var bctx = bloomCv.getContext('2d');
  var redCv = document.createElement('canvas'), rctx = redCv.getContext('2d');
  var cyanCv = document.createElement('canvas'), cctx = cyanCv.getContext('2d');
  var bgCv = document.createElement('canvas'), bgx = bgCv.getContext('2d');
  var vigCv = document.createElement('canvas'), vgx = vigCv.getContext('2d');
  var W = 960, H = 600, U = 1, DPR = 1;

  function isCoarse() {
    try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
  }
  var COARSE = isCoarse();

  function resize() {
    var r = app.getBoundingClientRect();
    W = Math.max(330, Math.round(r.width || window.innerWidth));
    H = Math.max(300, Math.round(r.height || window.innerHeight));
    DPR = Math.min(window.devicePixelRatio || 1, Q.dprCap);
    while (W * H * DPR * DPR > 3400000 && DPR > 1) DPR = Math.max(1, DPR - 0.25);
    U = Math.min(W, H) / 800;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    scene.width = cv.width; scene.height = cv.height;
    bloomCv.width = Math.max(48, Math.round(cv.width * 0.22));
    bloomCv.height = Math.max(48, Math.round(cv.height * 0.22));
    redCv.width = cv.width; redCv.height = cv.height;
    cyanCv.width = cv.width; cyanCv.height = cv.height;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bgCv.width = Math.max(320, Math.round(W * 0.5)); bgCv.height = Math.max(280, Math.round(H * 0.5));
    vigCv.width = Math.max(160, Math.round(W * 0.5)); vigCv.height = Math.max(160, Math.round(H * 0.5));
    buildBackdrop();
    buildVignette();
    makeStars();
    /* a resize wipes the backing store — repaint if the RAF loop is parked */
    if (typeof stopLoop === 'undefined' || stopLoop) { try { render(); } catch (e) { } }
  }

  /* ------------------------------------------------------------ background */
  function buildBackdrop() {
    var w = bgCv.width, h = bgCv.height;
    bgx.setTransform(1, 0, 0, 1, 0, 0);
    var g = bgx.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, '#05060f');
    g.addColorStop(0.45, '#080a1a');
    g.addColorStop(1, '#04050c');
    bgx.fillStyle = g; bgx.fillRect(0, 0, w, h);
    var neb = [
      ['rgba(96,44,168,0.30)', 0.22, 0.24, 0.52], ['rgba(10,116,150,0.26)', 0.78, 0.32, 0.46],
      ['rgba(170,30,110,0.19)', 0.58, 0.82, 0.5], ['rgba(30,60,190,0.18)', 0.12, 0.78, 0.44],
      ['rgba(60,190,220,0.10)', 0.92, 0.86, 0.3]
    ];
    for (var i = 0; i < neb.length; i++) {
      var n = neb[i], cx = n[1] * w, cy = n[2] * h, rad = n[3] * Math.max(w, h) * 0.8;
      var rg = bgx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, n[0]); rg.addColorStop(0.55, n[0].replace(/[\d.]+\)$/, '0.07)'));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      bgx.fillStyle = rg;
      bgx.beginPath(); bgx.arc(cx, cy, rad, 0, TAU); bgx.fill();
    }
    /* faint dust specks baked in */
    for (var s = 0; s < 420; s++) {
      var a = Math.random() * 0.5 + 0.05;
      bgx.fillStyle = 'rgba(190,225,255,' + a.toFixed(3) + ')';
      var sz = Math.random() < 0.85 ? 1 : 1.6;
      bgx.fillRect(Math.random() * w, Math.random() * h, sz, sz);
    }
  }

  function buildVignette() {
    var w = vigCv.width, h = vigCv.height;
    vgx.setTransform(1, 0, 0, 1, 0, 0);
    vgx.clearRect(0, 0, w, h);
    var rg = vgx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.26, w / 2, h / 2, Math.max(w, h) * 0.72);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(0.62, 'rgba(0,0,0,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0.62)');
    vgx.fillStyle = rg; vgx.fillRect(0, 0, w, h);
  }

  /* ---------------------------------------------------------------- starfield */
  var stars = [];
  function makeStars() {
    stars.length = 0;
    var n = Math.round(clamp((W * H) / 5200, 90, 320));
    for (var i = 0; i < n; i++) {
      var z = rnd(0.15, 1);
      stars.push({
        x: Math.random() * W, y: Math.random() * H, z: z,
        r: z * (COARSE ? 1.1 : 1.5) + 0.35,
        tw: Math.random() * TAU, tws: rnd(0.6, 2.2),
        hue: Math.random() < 0.22 ? 'rgba(180,205,255,' : Math.random() < 0.5 ? 'rgba(255,236,214,' : 'rgba(226,246,255,'
      });
    }
  }

  /* -------------------------------------------------------------------- audio */
  var A = {
    ctx: null, master: null, noiseBuf: null, ready: false, th: null, on: true,
    init: function () {
      if (this.ready) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = SET.sound ? SET.volume : 0;
        this.master.connect(this.ctx.destination);
        var len = Math.floor(this.ctx.sampleRate * 1.4);
        var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        /* persistent thruster rumble */
        var s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
        var f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 3;
        var g = this.ctx.createGain(); g.gain.value = 0.0001;
        s.connect(f); f.connect(g); g.connect(this.master); s.start(0);
        this.th = { s: s, f: f, g: g };
        this.ready = true;
      } catch (e) { this.ready = false; }
    },
    resume: function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVol: function () { if (this.master) this.master.gain.value = (SET.sound && A.on) ? SET.volume : 0; },
    tone: function (freq, dur, type, vol, to, when) {
      if (!this.ready || !SET.sound) return;
      var t0 = this.ctx.currentTime + (when || 0);
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.15), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.03);
    },
    noise: function (dur, vol, f0, f1, type, when) {
      if (!this.ready || !SET.sound) return;
      var t0 = this.ctx.currentTime + (when || 0);
      var s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      var f = this.ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.setValueAtTime(Math.max(60, f0), t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
      f.Q.value = 0.9;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t0); s.stop(t0 + dur + 0.03);
    },
    thrust: function (on, amt) {
      if (!this.ready || !this.th) return;
      var t = this.ctx.currentTime;
      this.th.g.gain.setTargetAtTime(SET.sound && on ? 0.055 + 0.05 * (amt || 1) : 0.0001, t, 0.06);
      if (on) this.th.f.frequency.setTargetAtTime(520 + Math.random() * 620, t, 0.09);
    },
    fire: function () {
      this.tone(1180, 0.075, 'square', 0.075, 260);
      this.noise(0.06, 0.05, 3600, 900, 'highpass');
    },
    boom: function (size) {
      var s = size || 1;
      this.noise(0.30 * s + 0.18, 0.30 + 0.12 * s, 1900 * s, 70, 'lowpass');
      this.tone(150 / s, 0.32 * s, 'sine', 0.22, 34);
      this.tone(88 / s, 0.26 * s, 'triangle', 0.12, 40, 0.01);
    },
    hit: function () { this.tone(320, 0.09, 'square', 0.09, 120); this.noise(0.1, 0.14, 1500, 200); },
    ufo: function (kind) {
      this.tone(kind ? 620 : 300, 0.16, 'sawtooth', 0.07, kind ? 880 : 420);
      this.tone(kind ? 900 : 240, 0.2, 'square', 0.05, kind ? 640 : 300, 0.14);
    },
    surge: function () {
      this.tone(70, 0.9, 'sine', 0.42, 30);
      this.noise(1.0, 0.42, 500, 60, 'lowpass');
      this.tone(1400, 0.7, 'sawtooth', 0.12, 90, 0.02);
    },
    hyper: function () {
      this.tone(180, 0.34, 'sine', 0.14, 1900);
      this.noise(0.3, 0.14, 400, 5000, 'bandpass');
    },
    life: function () {
      this.tone(660, 0.1, 'square', 0.13, 660);
      this.tone(990, 0.14, 'square', 0.11, 990, 0.09);
      this.tone(1320, 0.18, 'square', 0.09, 1320, 0.18);
    },
    wave: function () {
      this.tone(220, 0.12, 'triangle', 0.10, 440);
      this.tone(330, 0.16, 'triangle', 0.10, 660, 0.1);
    }
  };

  /* ------------------------------------------------------------------ sprites */
  function glowSprite(size, rgb) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, 'rgba(' + rgb + ',1)');
    grd.addColorStop(0.22, 'rgba(' + rgb + ',0.62)');
    grd.addColorStop(0.5, 'rgba(' + rgb + ',0.20)');
    grd.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    return c;
  }
  var SPR = {
    white: glowSprite(128, '255,255,255'),
    cyan: glowSprite(128, '125,249,255'),
    violet: glowSprite(128, '185,140,255'),
    hot: glowSprite(128, '255,90,160'),
    amber: glowSprite(128, '255,190,110'),
    blue: glowSprite(128, '90,150,255'),
    smoke: glowSprite(128, '40,30,64')
  };
  var PAL = {
    ice: ['#ffffff', '#c8f8ff', '#7df9ff', '#2f9fd6'],
    violet: ['#ffffff', '#e0d0ff', '#b98cff', '#6a3cc4'],
    molten: ['#fff6d8', '#ffd08a', '#ff8a3d', '#ff3a12'],
    hot: ['#ffffff', '#ffd3e6', '#ff2e88', '#8c0036'],
    ship: ['#ffffff', '#c9f6ff', '#5fd8ff', '#1f6fb0']
  };
  var ROCKCOL = [
    { core: '#bff7ff', glow: '#4fd7ff', fill: 'rgba(8,20,32,0.94)', crater: 'rgba(120,220,255,0.30)', pal: 'ice' },
    { core: '#d9c8ff', glow: '#9a6bff', fill: 'rgba(14,9,28,0.94)', crater: 'rgba(180,140,255,0.26)', pal: 'violet' },
    { core: '#ffd9a8', glow: '#ff6a2a', fill: 'rgba(26,9,4,0.94)', crater: 'rgba(255,140,60,0.34)', pal: 'molten' }
  ];

  /* -------------------------------------------------------------------- pools */
  function makePool(count, factory) {
    var items = new Array(count);
    for (var i = 0; i < count; i++) items[i] = factory();
    var cursor = 0;
    return {
      items: items,
      spawn: function () {
        for (var k = 0; k < count; k++) {
          var idx = (cursor + k) % count, it = items[idx];
          if (!it.alive) { cursor = (idx + 1) % count; it.alive = true; return it; }
        }
        var steal = items[cursor]; cursor = (cursor + 1) % count; steal.alive = true; return steal;
      },
      reset: function () { for (var i = 0; i < count; i++) items[i].alive = false; }
    };
  }

  var parts = makePool(1500, function () {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, drag: 0, col: '#fff', kind: 0, spr: null, rot: 0, rotV: 0, len: 1 };
  });
  var debris = makePool(320, function () {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 2, rot: 0, rotV: 0, sides: 3, col: '#fff', pts: null };
  });
  var rings = makePool(48, function () {
    return { alive: false, x: 0, y: 0, r: 0, rMax: 100, life: 0, max: 1, w: 2, col: '#fff', spr: null };
  });
  var texts = makePool(48, function () {
    return { alive: false, x: 0, y: 0, vy: 0, life: 0, max: 1, txt: '', col: '#fff', size: 14 };
  });
  var bullets = makePool(80, function () { return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, friendly: true }; });
  var rocks = makePool(90, function () {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 40, size: 3, rot: 0, rotV: 0, type: 0, verts: null, craters: null, cracks: null, seed: 0, hp: 1, surf: 0 };
  });
  var ufos = makePool(4, function () {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 20, kind: 0, fire: 0, t: 0, wob: 0 };
  });

  var pLive = 0; /* active particle count for quality cap */

  /* ---------------------------------------------------------------- effect api */
  var FX = { shake: 0, flash: 0, flashCol: '255,255,255', aber: 0, zoom: 1, zoomV: 0, bloomBoost: 0, slow: 0 };

  function shake(a) { if (!SET.shake) return; FX.shake = Math.min(1.5, FX.shake + a); }
  function flash(a, col) {
    /* peak-based, not pure additive — stacked explosions were washing the frame to white */
    FX.flash = Math.min(0.62, Math.max(FX.flash, a) + a * 0.22);
    if (col) FX.flashCol = col;
  }
  function aber(a) { FX.aber = Math.min(1.4, FX.aber + a); }

  function addPart(x, y, vx, vy, life, size, col, kind, drag, spr) {
    if (pLive >= Q.maxParts) return null;
    var p = parts.spawn();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.col = col;
    p.kind = kind || 0; p.drag = drag === undefined ? 1.6 : drag; p.spr = spr || null;
    p.rot = Math.random() * TAU; p.rotV = rnd(-8, 8); p.len = 0;
    pLive++;
    return p;
  }
  function addDebris(x, y, vx, vy, r, life, col, sides) {
    var d = debris.spawn();
    d.x = x; d.y = y; d.vx = vx; d.vy = vy; d.r = r;
    d.life = life; d.max = life; d.rot = Math.random() * TAU; d.rotV = rnd(-6, 6);
    d.col = col; d.sides = sides || rndi(3, 5);
    if (!d.pts || d.pts.length !== d.sides) {
      d.pts = [];
      for (var i = 0; i < d.sides; i++) {
        var a = (i / d.sides) * TAU + rnd(-0.25, 0.25), rr = rnd(0.55, 1.15);
        d.pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
    }
    return d;
  }
  function addRing(x, y, r0, rMax, life, w, col, spr) {
    var r = rings.spawn();
    r.x = x; r.y = y; r.r = r0; r.rMax = rMax; r.life = life; r.max = life;
    r.w = w; r.col = col; r.spr = spr || null;
    return r;
  }
  function addText(x, y, txt, col, size) {
    var t = texts.spawn();
    t.x = x; t.y = y; t.vy = -46 * U; t.life = 0.95; t.max = 0.95;
    t.txt = txt; t.col = col || '#eaffff'; t.size = size || Math.round(15 * U);
    return t;
  }

  /* explosion: sparks + embers + shards + smoke + shockwave, all pooled */
  function explode(x, y, scale, palKey, opts) {
    opts = opts || {};
    var pal = PAL[palKey] || PAL.ice;
    var n = Math.round((8 + 13 * scale) * Q.partMul);
    var spd = (90 + 260 * scale) * U;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = spd * rnd(0.22, 1);
      addPart(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.24, 0.7) * (0.7 + scale * 0.5),
        rnd(1.1, 2.4) * U * (0.7 + scale * 0.45), pick(pal), 0, 2.1, null);
    }
    var m = Math.round((4 + 7 * scale) * Q.partMul);
    for (var j = 0; j < m; j++) {
      var a2 = Math.random() * TAU, s2 = spd * rnd(0.05, 0.5);
      addPart(x, y, Math.cos(a2) * s2, Math.sin(a2) * s2, rnd(0.4, 1.1), rnd(1.6, 3.4) * U * (0.6 + scale * 0.5),
        pal[2], 1, 0.9, SPR.amber);
    }
    var sm = Math.round((3 + 4 * scale) * Q.partMul);
    for (var q = 0; q < sm; q++) {
      var a3 = Math.random() * TAU, s3 = rnd(10, 60) * U * scale;
      addPart(x + rnd(-6, 6) * U, y + rnd(-6, 6) * U, Math.cos(a3) * s3, Math.sin(a3) * s3,
        rnd(0.6, 1.5), rnd(14, 34) * U * (0.6 + scale * 0.5), '#2a2044', 2, 1.2, SPR.smoke);
    }
    var shards = Math.round((2 + 4 * scale) * Q.partMul);
    for (var k2 = 0; k2 < shards; k2++) {
      var a4 = Math.random() * TAU, s4 = spd * rnd(0.1, 0.45);
      addDebris(x, y, Math.cos(a4) * s4, Math.sin(a4) * s4, rnd(1.6, 4.2) * U * scale,
        rnd(0.5, 1.3), pal[2], rndi(3, 5));
    }
    if (!opts.noRing && (opts.ring !== false)) {
      addRing(x, y, 4 * U, (34 + 62 * scale) * U, 0.40 + scale * 0.10, (1.6 + scale * 1.4) * U, pal[1]);
      if (scale > 0.9) addRing(x, y, 2 * U, (56 + 96 * scale) * U, 0.58, 1.2 * U, pal[3]);
    }
    /* core flash */
    addPart(x, y, 0, 0, 0.12 + 0.05 * scale, (15 + 22 * scale) * U, '#ffffff', 3, 0, SPR.white);
    shake(0.10 + 0.24 * scale);
    flash(0.05 + 0.07 * scale);
    if (scale > 0.7) FX.zoomV -= 0.02 * scale;
  }

  function burst(x, y, n, col, speed, life, kind, spr) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = speed * rnd(0.3, 1);
      addPart(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rnd(0.6, 1.2), rnd(1.2, 3) * U, col, kind || 0, 2.2, spr);
    }
  }
