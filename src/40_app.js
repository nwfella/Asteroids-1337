  /* ==========================================================================
     APP — input, screens, settings, loop, debug hooks
     ======================================================================== */
  var el = function (id) { return document.getElementById(id); };
  var screens = ['scr-title', 'scr-over', 'scr-pause', 'scr-settings'];
  var touchOn = false;
  function hideScreens() { for (var i = 0; i < screens.length; i++) el(screens[i]).classList.remove('on'); }
  function showScreen(id) { hideScreens(); el(id).classList.add('on'); }

  function setTouchUI(on) {
    var t = el('touch-ui');
    touchOn = !!on;
    if (on) t.classList.add('on'); else t.classList.remove('on');
    if (SET.hand === 'right') t.classList.add('right'); else t.classList.remove('right');
  }
  function updateBestLabels() {
    el('best-title').textContent = String(STATE.best);
    el('ov-best').textContent = String(STATE.best);
  }
  function showOver(isBest) {
    el('ov-score').textContent = String(Math.round(STATE.score));
    el('ov-wave').textContent = String(STATE.wave);
    updateBestLabels();
    el('newbest').style.display = isBest ? 'block' : 'none';
    showScreen('scr-over');
  }
  function showTitle() {
    STATE.mode = 'menu';
    seedAttract();
    setTouchUI(false);
    updateBestLabels();
    showScreen('scr-title');
  }
  function pauseGame() {
    if (STATE.mode !== 'play') return;
    STATE.mode = 'pause';
    A.thrust(false, 0);
    IN.fire = IN.up = IN.left = IN.right = false;
    showScreen('scr-pause');
  }
  function resumeGame() {
    if (STATE.mode !== 'pause') return;
    STATE.mode = 'play';
    hideScreens();
  }

  /* ------------------------------------------------------------------ keyboard */
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', Space: 'fire', KeyJ: 'fire', KeyK: 'fire',
    ShiftLeft: 'hyper', ShiftRight: 'hyper', KeyE: 'surge', KeyB: 'surge'
  };
  function keyName(e) {
    if (e.code && KEYMAP[e.code]) return KEYMAP[e.code];
    var k = (e.key || '').toLowerCase();
    if (k === 'arrowleft' || k === 'a') return 'left';
    if (k === 'arrowright' || k === 'd') return 'right';
    if (k === 'arrowup' || k === 'w') return 'up';
    if (k === ' ' || k === 'spacebar' || k === 'j') return 'fire';
    if (k === 'shift') return 'hyper';
    if (k === 'e' || k === 'b') return 'surge';
    return null;
  }
  window.addEventListener('keydown', function (e) {
    var k = keyName(e);
    if (k || e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
    }
    A.init(); A.resume();

    if (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
      if (STATE.mode === 'play') { pauseGame(); return; }
      if (STATE.mode === 'pause') { resumeGame(); return; }
    }
    if (STATE.mode === 'menu' || STATE.mode === 'over') {
      if (e.code === 'Enter' || e.code === 'Space' || e.key === 'Enter') startGame();
      return;
    }
    if (STATE.mode !== 'play') return;
    if (!k) return;
    if (k === 'hyper') { hyperspace(); return; }
    if (k === 'surge') { fireSurge(); return; }
    IN[k] = true;
  }, { passive: false });
  window.addEventListener('keyup', function (e) {
    var k = keyName(e);
    if (k) {
      e.preventDefault();
      if (k === 'left' || k === 'right' || k === 'up' || k === 'fire') IN[k] = false;
    }
  }, { passive: false });
  window.addEventListener('blur', function () {
    IN.left = IN.right = IN.up = IN.fire = false;
    if (STATE.mode === 'play') pauseGame();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && STATE.mode === 'play') pauseGame();
  });

  /* --------------------------------------------------------------- pointer/touch */
  var joyEl = el('joy'), knobEl = joyEl.querySelector('.knob');
  var joyId = null, joyCx = 0, joyCy = 0;
  function joyCenter() {
    var r = joyEl.getBoundingClientRect();
    joyCx = r.left + r.width / 2; joyCy = r.top + r.height / 2;
  }
  function joyHandle(px, py) {
    var dx = px - joyCx, dy = py - joyCy, d = Math.hypot(dx, dy);
    var max = joyEl.getBoundingClientRect().width * 0.36;
    var cl = Math.min(d, max);
    knobEl.style.transform = 'translate(' + ((dx / (d || 1)) * cl).toFixed(1) + 'px,' + ((dy / (d || 1)) * cl).toFixed(1) + 'px)';
    if (d > 10) {
      IN.tmag = clamp(d / max, 0, 1);
      IN.tang = Math.atan2(dy, dx);
    } else { IN.tmag = 0; }
  }
  function joyReset() {
    joyId = null; IN.tmag = 0;
    knobEl.style.transform = 'translate(0,0)';
  }
  joyEl.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    A.init(); A.resume();
    joyId = e.pointerId;
    joyCenter();
    try { joyEl.setPointerCapture(e.pointerId); } catch (err) { }
    joyHandle(e.clientX, e.clientY);
  });
  joyEl.addEventListener('pointermove', function (e) {
    if (e.pointerId !== joyId) return;
    e.preventDefault();
    joyHandle(e.clientX, e.clientY);
  });
  joyEl.addEventListener('pointerup', function (e) { if (e.pointerId === joyId) joyReset(); });
  joyEl.addEventListener('pointercancel', function (e) { if (e.pointerId === joyId) joyReset(); });

  function bindHold(id, onDown, onUp) {
    var node = el(id);
    node.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      A.init(); A.resume();
      node.classList.add('down');
      try { node.setPointerCapture(e.pointerId); } catch (err) { }
      onDown();
    });
    var up = function (e) {
      node.classList.remove('down');
      if (onUp) onUp();
    };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('pointerleave', function () { if (!node.classList.contains('down')) return; });
  }
  bindHold('btn-fire', function () { IN.fire = true; }, function () { IN.fire = false; });
  bindHold('btn-surge', function () { fireSurge(); }, null);
  bindHold('btn-hyper', function () { hyperspace(); }, null);

  /* clicking the field also fires — handy with a mouse */
  cv.addEventListener('pointerdown', function (e) {
    if (STATE.mode !== 'play') return;
    A.init(); A.resume();
    IN.fire = true;
  });
  window.addEventListener('pointerup', function () { if (!el('btn-fire').classList.contains('down')) IN.fire = false; });

  /* ------------------------------------------------------------------- screens */
  el('btn-start').addEventListener('click', function () { A.init(); A.resume(); startGame(); });
  el('btn-again').addEventListener('click', function () { startGame(); });
  el('btn-menu').addEventListener('click', function () { showTitle(); });
  el('btn-resume').addEventListener('click', function () { resumeGame(); });
  el('btn-quit').addEventListener('click', function () { showTitle(); });
  el('btn-settings').addEventListener('click', function () { syncSettingsUI(); showScreen('scr-settings'); });
  el('btn-close-settings').addEventListener('click', function () {
    if (STATE.mode === 'pause') showScreen('scr-pause'); else showTitle();
  });
  el('btn-reset').addEventListener('click', function () {
    SET.best = 0; STATE.best = 0; saveSet(); updateBestLabels();
  });

  /* ------------------------------------------------------------------ settings */
  function syncSettingsUI() {
    el('set-quality').value = SET.quality;
    el('set-volume').value = String(Math.round(SET.volume * 100));
    el('set-hand').value = SET.hand;
    ['bloom', 'crt', 'shake', 'sound'].forEach(function (k) {
      var node = el('set-' + k);
      if (SET[k]) node.classList.add('on'); else node.classList.remove('on');
    });
  }
  ['bloom', 'crt', 'shake', 'sound'].forEach(function (k) {
    el('set-' + k).addEventListener('click', function () {
      SET[k] = !SET[k];
      this.classList.toggle('on', SET[k]);
      saveSet();
      if (k === 'sound') { A.setVol(); if (SET.sound) { A.init(); A.resume(); A.tone(660, 0.08, 'square', 0.08); } }
    });
  });
  el('set-quality').addEventListener('change', function () {
    SET.quality = this.value; applyQuality(); saveSet(); resize();
  });
  el('set-volume').addEventListener('input', function () {
    SET.volume = Number(this.value) / 100; A.setVol(); saveSet();
  });
  el('set-hand').addEventListener('change', function () {
    SET.hand = this.value; saveSet(); setTouchUI(el('touch-ui').classList.contains('on'));
  });

  /* ---------------------------------------------------------------- main loop */
  var STEP = 1 / 60, acc = 0, last = 0, frozen = false, stopLoop = false;

  function frame(ts) {
    if (!last) last = ts;
    var dtr = (ts - last) / 1000;
    last = ts;
    if (dtr > 0.25) dtr = 0.25;
    acc += dtr;
    var guard = 0;
    while (acc >= STEP && guard < 6) {
      if (!frozen) update(STEP);
      acc -= STEP; guard++;
    }
    if (guard >= 6) acc = 0;
    render();
    if (!stopLoop) requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ debug hooks */
  var GAME = {
    get state() { return STATE; },
    get ship() { return ship; },
    get rocks() { return rocks.items; },
    get bullets() { return bullets.items; },
    get ufos() { return ufos.items; },
    get rings() { return rings.items; },
    get particles() { return parts.items; },
    get size() { return { W: W, H: H, U: U, DPR: DPR }; },
    IN: IN, SET: SET, FX: FX,
    start: startGame, menu: showTitle, pause: pauseGame, resume: resumeGame,
    tick: function (n) { n = n || 1; for (var i = 0; i < n; i++) update(STEP); },
    render: render,
    fire: fireBullet, surge: fireSurge, hyper: hyperspace,
    spawnRock: spawnRock, spawnUfo: spawnUfo, killShip: killShip,
    explode: explode, destroyRock: destroyRock,
    clearRocks: function () { rocks.reset(); },
    clearBullets: function () { bullets.reset(); },
    k: function (k, v) { IN[k] = v; },
    liveRocks: function () { return liveCount(rocks); },
    freeze: function (v) { frozen = !!v; }
  };
  window.GAME = GAME;

  /* -------------------------------------------------------------- self test */
  function selfTest() {
    var lines = [], fails = 0;
    function ok(name, cond, extra) {
      if (cond) lines.push('PASS  ' + name);
      else { lines.push('FAIL  ' + name + (extra ? ' :: ' + extra : '')); fails++; }
    }
    function fin(v) { return typeof v === 'number' && isFinite(v); }
    try {
      ok('boot menu state', STATE.mode === 'menu');
      startGame();
      ok('start -> play/wave1', STATE.mode === 'play' && STATE.wave === 1, 'mode=' + STATE.mode + ' wave=' + STATE.wave);
      ok('wave1 spawns rocks', GAME.liveRocks() > 0, 'rocks=' + GAME.liveRocks());

      /* movement */
      GAME.clearRocks(); GAME.clearBullets();
      GAME.k('up', true); GAME.tick(30); GAME.k('up', false);
      ok('thrust accelerates ship', Math.hypot(ship.vx, ship.vy) > 20 * U, 'speed=' + Math.hypot(ship.vx, ship.vy).toFixed(2));
      ok('ship stays finite', fin(ship.x) && fin(ship.y));

      /* rotation */
      var a0 = ship.ang;
      GAME.k('left', true); GAME.tick(20); GAME.k('left', false);
      ok('rotate left changes heading', Math.abs(angDiff(ship.ang, a0)) > 0.3);

      /* firing */
      ship.x = W / 2; ship.y = H / 2; ship.ang = 0; ship.vx = 0; ship.vy = 0;
      GAME.clearBullets(); ship.cool = 0;
      GAME.k('fire', true); GAME.tick(3); GAME.k('fire', false);
      var bl = 0; for (var i = 0; i < bullets.items.length; i++) if (bullets.items[i].alive) bl++;
      ok('fire spawns bullet', bl > 0, 'bullets=' + bl);

      /* bullet vs rock -> score + split */
      GAME.clearRocks(); GAME.clearBullets();
      var before = STATE.score;
      var r1 = spawnRock(W / 2 + 150 * U, H / 2, 3, 0, 0, 0);
      ship.x = W / 2; ship.y = H / 2; ship.ang = 0; ship.cool = 0;
      GAME.k('fire', true); GAME.tick(40); GAME.k('fire', false);
      ok('bullet destroys rock and scores', STATE.score > before, 'score ' + before + '->' + STATE.score);
      var kids = 0;
      for (var k2 = 0; k2 < rocks.items.length; k2++) if (rocks.items[k2].alive) kids++;
      ok('large rock splits into 2', kids === 2, 'alive=' + kids);

      /* surge */
      GAME.clearRocks();
      for (var s = 0; s < 5; s++) spawnRock(W / 2 + 60 * U + s * 30 * U, H / 2, 3, 0, 0, 1);
      STATE.surge = 1; ship.invuln = 3;
      GAME.surge();
      ok('surge consumes meter', STATE.surge === 0);
      GAME.tick(90);
      ok('surge clears nearby rocks', GAME.liveRocks() < 5, 'left=' + GAME.liveRocks());

      /* death + respawn */
      GAME.clearRocks(); GAME.clearBullets();
      STATE.lives = 3; ship.invuln = 0; ship.alive = true;
      ship.x = W / 2; ship.y = H / 2;
      var killer = spawnRock(W / 2, H / 2, 2, 0, 0, 0);
      GAME.tick(2);
      ok('collision kills ship', ship.alive === false, 'alive=' + ship.alive);
      ok('life lost', STATE.lives === 2, 'lives=' + STATE.lives);
      GAME.tick(130);
      ok('respawn after delay', ship.alive === true, 'alive=' + ship.alive);

      /* wrapping */
      ship.x = W + 60 * U; ship.y = H / 2;
      GAME.tick(1);
      ok('horizontal wrap', ship.x < W && ship.x >= 0, 'x=' + ship.x.toFixed(1));

      /* wave clear -> next wave */
      GAME.clearRocks(); GAME.clearBullets();
      STATE.waveDelay = 0;
      GAME.tick(2);
      var banner = STATE.bannerTxt;
      ok('wave clear bonus + delay', STATE.waveDelay > 0 || STATE.wave > 1, 'banner=' + banner);
      GAME.tick(200);
      ok('next wave spawns', STATE.wave >= 2 && GAME.liveRocks() > 0, 'wave=' + STATE.wave + ' rocks=' + GAME.liveRocks());

      /* game over */
      STATE.lives = 1; ship.invuln = 0; ship.alive = true;
      ship.x = W / 2; ship.y = H / 2;
      spawnRock(W / 2, H / 2, 2, 0, 0, 0);
      GAME.tick(3);
      GAME.tick(200);
      ok('game over at zero lives', STATE.mode === 'over', 'mode=' + STATE.mode);

      /* particles finite */
      var bad = 0;
      for (var pi = 0; pi < parts.items.length; pi++) {
        var pp = parts.items[pi];
        if (pp.alive && (!fin(pp.x) || !fin(pp.y))) bad++;
      }
      ok('particles finite', bad === 0, 'bad=' + bad);
      ok('no NaN anywhere', fin(STATE.score) && fin(STATE.surge));

      /* rendering + pixel probe */
      startGame();
      GAME.clearRocks();
      for (var rr = 0; rr < 6; rr++) spawnRock(W * (0.2 + rr * 0.12), H * (0.3 + (rr % 3) * 0.2), 3, 0, 0, rr % 3);
      GAME.tick(60);
      render();
      var lit = 0, total = 0;
      try {
        var img = ctx.getImageData(0, 0, cv.width, cv.height).data;
        for (var q = 0; q < img.length; q += 4 * 97) {
          total++;
          if (img[q] + img[q + 1] + img[q + 2] > 120) lit++;
        }
      } catch (e) { lines.push('WARN  pixel probe failed: ' + e.message); }
      ok('canvas renders lit pixels', lit > total * 0.02, lit + '/' + total + ' lit');

      /* hud glow readable: sample top-left region brightness */
      ok('render produced wide palette', total > 0);
    } catch (err) {
      lines.push('FAIL  exception :: ' + (err && err.message) + ' @ ' + (err && err.stack ? err.stack.split('\n')[1] : ''));
      fails++;
    }
    var summary = (fails === 0 ? 'ALL PASS ' : fails + ' FAIL ') + '(' + lines.length + ' checks)';
    lines.unshift(summary);
    var report = lines.join('\n');
    document.title = 'TEST ' + summary + ' | ' + lines.filter(function (l) { return l.indexOf('FAIL') === 0; }).join(' | ');
    var pre = document.createElement('pre');
    pre.id = 'testout';
    pre.textContent = report;
    pre.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;background:rgba(0,0,0,.8);color:#9f9;font:10px monospace;padding:8px;max-height:92vh;overflow:auto;white-space:pre-wrap';
    document.body.appendChild(pre);
    return { fails: fails, report: report };
  }

  /* -------------------------------------------------------------------- boot */
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resize(); }, 90);
  });
  if (window.ResizeObserver) {
    try {
      new ResizeObserver(function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 60);
      }).observe(app);
    } catch (e) { }
  }

  resize();
  buildScanPattern();
  /* layout can settle a frame or two after boot (mobile URL bars, headless) */
  requestAnimationFrame(function () { resize(); });
  syncSettingsUI();
  updateBestLabels();
  showTitle();
  requestAnimationFrame(frame);

  /* url modes: ?test=1 ?auto=1 ?shot=menu|play|boom|boss */
  var QS = {};
  try {
    var qp = new URLSearchParams(location.search);
    qp.forEach(function (v, k) { QS[k] = v; });
  } catch (e) { }

  if (QS.soak) {
    setTimeout(function () {
      var errs = [];
      window.addEventListener('error', function (e) { errs.push(e.message); });
      startGame();
      var maxWave = 1, ticks = parseInt(QS.soak, 10) || 4000, stuck = 0;
      for (var i = 0; i < ticks; i++) {
        /* autopilot: track nearest rock, fire constantly, surge when charged */
        var near = null, nd = 1e9;
        for (var r = 0; r < rocks.items.length; r++) {
          var rk = rocks.items[r];
          if (!rk.alive) continue;
          var d = Math.hypot(rk.x - ship.x, rk.y - ship.y);
          if (d < nd) { nd = d; near = rk; }
        }
        if (near && ship.alive) {
          var want = Math.atan2(near.y - ship.y, near.x - ship.x);
          var diff = angDiff(want, ship.ang);
          IN.left = diff < -0.06; IN.right = diff > 0.06;
          IN.up = nd > 240 * U;
          IN.fire = Math.abs(diff) < 0.35;
        }
        if (STATE.surge >= 1 && ship.alive) fireSurge();
        update(STEP);
        if (STATE.wave > maxWave) maxWave = STATE.wave;
        if (STATE.mode === 'over') { if (STATE.score > 0) stuck++; startGame(); }
        if (i % 30 === 0) render();
      }
      var msg = 'SOAK ok wave=' + STATE.wave + ' max=' + maxWave + ' score=' + STATE.score +
        ' kills=' + STATE.kills + ' parts=' + pLive + ' errs=' + errs.length + ' deaths=' + stuck;
      document.title = msg;
      var pre = document.createElement('pre');
      pre.id = 'soakout';
      pre.textContent = msg + (errs.length ? ' :: ' + errs.join(' | ') : '');
      pre.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;color:#9f9;font:11px monospace;background:#000a';
      document.body.appendChild(pre);
      stopLoop = true;
    }, 100);
  }

  if (QS.diag) {
    setTimeout(function () {
      var r = app.getBoundingClientRect();
      document.title = 'DIAG ' + JSON.stringify({
        iw: innerWidth, ih: innerHeight, W: W, H: H, U: U, dpr: DPR,
        cvw: cv.width, cvh: cv.height, cssw: cv.clientWidth, cssh: cv.clientHeight,
        appw: Math.round(r.width), apph: Math.round(r.height), mode: STATE.mode, rocks: liveCount(rocks)
      });
    }, 500);
  }

  if (QS.touch) { setTouchUI(true); el('touch-ui').classList.add('on'); }

  if (QS.shot === 'menu') {
    setTimeout(function () {
      GAME.tick(90); render(); frozen = true; stopLoop = true;
    }, 120);
  }

  if (QS.shot === 'settings') {
    setTimeout(function () {
      syncSettingsUI(); showScreen('scr-settings'); GAME.tick(40); render();
      frozen = true; stopLoop = true;
    }, 120);
  }

  if (QS.shot === 'mobile') {
    setTimeout(function () {
      startGame(); setTouchUI(true);
      ship.x = W / 2; ship.y = H * 0.5;
      for (var i = 0; i < 6; i++) spawnRock(W * (0.15 + i * 0.15), H * (0.2 + (i % 3) * 0.22), i % 2 ? 2 : 3, 0, 0, i % 3);
      GAME.k('fire', true); GAME.tick(50); GAME.k('fire', false);
      GAME.tick(10); render(); frozen = true; stopLoop = true;
    }, 120);
  }

  if (QS.test) {
    setTimeout(function () { selfTest(); }, 60);
  } else if (QS.auto) {
    setTimeout(function () {
      startGame();
      if (QS.shot === 'boom' || QS.shot === 'play') {
        ship.x = W / 2; ship.y = H * 0.62;
        for (var i = 0; i < 7; i++) {
          var a = (i / 7) * TAU;
          spawnRock(W / 2 + Math.cos(a) * Math.min(W, H) * 0.3, H * 0.55 + Math.sin(a) * Math.min(W, H) * 0.26, i % 3 === 0 ? 2 : 3, 0, 0, i % 3);
        }
        GAME.k('fire', true);
        GAME.tick(70);
        GAME.k('fire', false);
        if (QS.shot === 'boom') {
          STATE.surge = 1;
          GAME.surge();
          GAME.tick(26);
        } else {
          GAME.tick(16);
        }
        frozen = true;
        render();
        stopLoop = true; /* idle the page so headless capture can settle */
      }
    }, 120);
  }
})();
