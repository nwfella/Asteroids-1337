  /* ==========================================================================
     WORLD — game state, ship, rocks, saucers, collisions, waves
     ======================================================================== */
  var STATE = {
    mode: 'menu', score: 0, lives: 3, wave: 0, chain: 0, chainT: 0, mult: 1,
    surge: 0, nextLife: 10000, t: 0, tScale: 1, hitstop: 0,
    banner: 0, bannerTxt: '', waveDelay: 0, ufoTimer: 0, kills: 0,
    best: SET.best, shots: 0, hits: 0, surgeUses: 0, pendingOver: false
  };

  var IN = { left: false, right: false, up: false, fire: false, hyper: false, surge: false, tmag: 0, tang: 0, active: false };

  var ship = {
    x: 0, y: 0, vx: 0, vy: 0, ang: -Math.PI / 2, r: 17, alive: true,
    respawn: 0, invuln: 0, cool: 0, hyperCool: 0, thrustAmt: 0, warp: 0, warpDir: 1
  };

  var surgeWave = { active: false, x: 0, y: 0, r: 0, rMax: 0, life: 0, max: 1 };
  var trail = [];   /* recent ship poses for the afterimage */
  var TRAIL_MAX = 13;

  function rockRadius(size) { return (size === 3 ? 60 : size === 2 ? 36 : 20) * U; }
  /* speeds are expressed as a fraction of the short screen edge per second so the
     field reads at the same pace on a phone and on a 1440px desktop */
  function rockSpeed(size) { return (0.10 + STATE.wave * 0.006) * Math.min(W, H) * (size === 3 ? 1 : size === 2 ? 1.45 : 2.0); }

  function wrapObj(o, m) {
    m = m || 0;
    if (o.x < -m) o.x += W + m * 2; else if (o.x > W + m) o.x -= W + m * 2;
    if (o.y < -m) o.y += H + m * 2; else if (o.y > H + m) o.y -= H + m * 2;
  }

  function liveCount(pool) {
    var n = 0, it = pool.items;
    for (var i = 0; i < it.length; i++) if (it[i].alive) n++;
    return n;
  }

  function edgePos() {
    var side = rndi(0, 3), m = 70 * U;
    if (side === 0) return { x: rnd(0, W), y: -m };
    if (side === 1) return { x: W + m, y: rnd(0, H) };
    if (side === 2) return { x: rnd(0, W), y: H + m };
    return { x: -m, y: rnd(0, H) };
  }

  function spawnRock(x, y, size, vx, vy, type) {
    var rk = rocks.spawn();
    rk.x = x || 0; rk.y = y || 0;
    rk.size = size || 3;
    rk.r = rockRadius(rk.size);
    var sp = rockSpeed(rk.size);
    if (vx === undefined) {
      var a = Math.random() * TAU;
      rk.vx = Math.cos(a) * sp * rnd(0.6, 1.1);
      rk.vy = Math.sin(a) * sp * rnd(0.6, 1.1);
      /* bias toward the field */
      if (x !== undefined) { rk.vx += (W / 2 - x) * 0.09; rk.vy += (H / 2 - y) * 0.09; }
    } else { rk.vx = vx; rk.vy = vy; }
    rk.rot = Math.random() * TAU;
    rk.rotV = rnd(-0.7, 0.7) * (4 - rk.size) * 0.6;
    rk.type = type === undefined ? (Math.random() < 0.16 ? 2 : Math.random() < 0.45 ? 1 : 0) : type;
    rk.seed = Math.random() * 100;
    rk.surf = 0;
    rk.hp = 1;
    var n = rndi(9, 13), dist = [], ux = [], uy = [];
    for (var i = 0; i < n; i++) {
      var a2 = (i / n) * TAU + rnd(-0.14, 0.14);
      ux.push(Math.cos(a2)); uy.push(Math.sin(a2)); dist.push(rnd(0.74, 1.14));
    }
    rk.ux = ux; rk.uy = uy; rk.dist = dist;
    var cr = [];
    var cn = rndi(2, 4);
    for (var c = 0; c < cn; c++) cr.push({ x: rnd(-0.5, 0.5), y: rnd(-0.5, 0.5), r: rnd(0.08, 0.2) });
    rk.craters = cr;
    var ck = [];
    var kn = rndi(2, 4);
    for (var q = 0; q < kn; q++) {
      var ka = Math.random() * TAU;
      ck.push({ x1: Math.cos(ka) * 0.15, y1: Math.sin(ka) * 0.15, x2: Math.cos(ka) * rnd(0.55, 0.95), y2: Math.sin(ka) * rnd(0.55, 0.95) });
    }
    rk.cracks = ck;
    return rk;
  }

  function spawnUfo(kind) {
    var u = ufos.spawn();
    u.kind = kind === undefined ? (STATE.wave > 3 && Math.random() < 0.55 ? 1 : 0) : kind;
    u.r = (u.kind ? 15 : 23) * U;
    u.y = rnd(H * 0.16, H * 0.84);
    var fromLeft = Math.random() < 0.5;
    u.x = fromLeft ? -u.r * 2 : W + u.r * 2;
    u.vx = (fromLeft ? 1 : -1) * (u.kind ? 0.24 : 0.17) * Math.min(W, H) * (1 + STATE.wave * 0.02);
    u.vy = 0;
    u.fire = rnd(0.7, 1.5);
    u.t = 0; u.wob = Math.random() * TAU;
    A.ufo(u.kind);
    return u;
  }

  /* --------------------------------------------------------------- game flow */
  function resetWorld() {
    rocks.reset(); bullets.reset(); ufos.reset(); parts.reset();
    debris.reset(); rings.reset(); texts.reset(); pLive = 0;
    surgeWave.active = false;
    STATE.score = 0; STATE.lives = 3; STATE.wave = 0; STATE.chain = 0; STATE.chainT = 0;
    STATE.mult = 1; STATE.surge = 0; STATE.nextLife = 10000; STATE.tScale = 1;
    STATE.hitstop = 0; STATE.waveDelay = 0; STATE.ufoTimer = rnd(14, 22);
    STATE.kills = 0; STATE.shots = 0; STATE.hits = 0; STATE.surgeUses = 0;
    STATE.pendingOver = false; STATE.banner = 0; trail.length = 0;
    FX.shake = 0; FX.flash = 0; FX.aber = 0; FX.zoom = 1; FX.zoomV = 0;
  }

  function placeShip() {
    ship.x = W / 2; ship.y = H / 2; ship.vx = 0; ship.vy = 0;
    ship.ang = -Math.PI / 2; ship.alive = true; ship.r = 17 * U;
  }

  function startGame() {
    A.init(); A.resume();
    resetWorld();
    placeShip();
    ship.invuln = 2.2; ship.cool = 0; ship.hyperCool = 0; ship.warp = 1;
    STATE.mode = 'play';
    STATE.t = 0;
    spawnWave(1);
    hideScreens();
    setTouchUI(COARSE || SET.hand !== 'auto');
  }

  function spawnWave(n) {
    STATE.wave = n;
    STATE.waveDelay = 0;
    var count = Math.min(4 + Math.floor(n * 0.85), 11);
    for (var i = 0; i < count; i++) {
      var p = edgePos();
      var size = (n >= 4 && i > count - 3) ? 2 : 3;
      spawnRock(p.x, p.y, size);
    }
    if (n % 4 === 0) spawnUfo(0);
    STATE.ufoTimer = Math.max(7, 20 - n * 0.8) + rnd(0, 6);
    STATE.banner = 1.9; STATE.bannerTxt = 'WAVE ' + n;
    A.wave();
  }

  function waveClear() {
    var bonus = 100 * STATE.wave;
    addScore(bonus, W / 2, H * 0.34, '+' + bonus + ' CLEAR');
    STATE.tScale = 0.28;
    STATE.waveDelay = 1.5;
    flash(0.16, '125,249,255');
    addRing(W / 2, H / 2, 10 * U, Math.hypot(W, H) * 0.55, 0.8, 2.4 * U, '#7df9ff');
    A.life();
  }

  function killShip() {
    if (!ship.alive || (ship.invuln > 0 && STATE.mode === 'play')) return;
    ship.alive = false;
    STATE.lives--;
    STATE.chain = 0; STATE.chainT = 0; STATE.mult = 1;
    var pal = PAL.ship;
    explode(ship.x, ship.y, 1.5, 'ice', { noRing: false });
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * TAU, s = rnd(40, 210) * U;
      addDebris(ship.x, ship.y, Math.cos(a) * s, Math.sin(a) * s, rnd(2, 5) * U, rnd(0.9, 1.9), pal[2], 3);
    }
    addRing(ship.x, ship.y, 8 * U, 260 * U, 0.9, 3 * U, '#ffffff');
    addRing(ship.x, ship.y, 4 * U, 180 * U, 1.2, 2 * U, '#5fd8ff');
    closeCall();
    flash(0.42, '160,230,255');
    aber(1.0);
    shake(1.0);
    STATE.tScale = 0.22;
    STATE.hitstop = 0.09;
    A.boom(1.7);
    ship.respawn = STATE.lives > 0 ? 1.7 : 2.1;
  }

  function reviveShip() {
    /* respawn at a spot with breathing room */
    var bestX = W / 2, bestY = H / 2, bestD = -1;
    for (var t = 0; t < 26; t++) {
      var x = rnd(W * 0.18, W * 0.82), y = rnd(H * 0.18, H * 0.82), d = 1e9;
      for (var i = 0; i < rocks.items.length; i++) {
        var rk = rocks.items[i];
        if (!rk.alive) continue;
        var dd = Math.hypot(rk.x - x, rk.y - y) - rk.r;
        if (dd < d) d = dd;
      }
      if (d > bestD) { bestD = d; bestX = x; bestY = y; }
      if (d > 190 * U) break;
    }
    ship.x = bestX; ship.y = bestY; ship.vx = 0; ship.vy = 0;
    ship.ang = -Math.PI / 2;
    ship.alive = true; ship.invuln = 2.6; ship.warp = 1;
    addRing(ship.x, ship.y, 2 * U, 96 * U, 0.6, 2.4 * U, '#7df9ff');
    burst(ship.x, ship.y, 26, '#9ff6ff', 240 * U, 0.5, 0, SPR.cyan);
    A.hyper();
  }

  function closeCall() { /* reserved hook for future stingers */ }

  function endGame() {
    STATE.mode = 'over';
    var isBest = STATE.score > STATE.best;
    if (isBest) { STATE.best = STATE.score; SET.best = STATE.score; saveSet(); }
    showOver(isBest);
    setTouchUI(false);
  }

  function addScore(n, x, y, label) {
    STATE.score += Math.round(n);
    if (x !== undefined) addText(x, y, label || ('+' + Math.round(n)), '#eaffff');
    while (STATE.score >= STATE.nextLife) {
      STATE.lives++;
      STATE.nextLife += 10000;
      addText(ship.x, ship.y - 46 * U, 'EXTRA SHIP', '#ffe08a', Math.round(17 * U));
      addRing(ship.x, ship.y, 6 * U, 120 * U, 0.7, 2.5 * U, '#ffd166');
      flash(0.18, '255,220,140');
      A.life();
    }
  }

  function bumpChain() {
    STATE.chain++;
    STATE.chainT = 2.7;
    var m = Math.min(8, 1 + Math.floor(STATE.chain / 3));
    if (m > STATE.mult) {
      STATE.mult = m;
      addText(ship.x, ship.y - 34 * U, 'x' + m, '#ffd166', Math.round(20 * U));
      A.tone(520 + m * 90, 0.12, 'square', 0.09, 760 + m * 90);
      aber(0.25);
    } else STATE.mult = m;
  }

  function addSurge(v) { STATE.surge = clamp(STATE.surge + v, 0, 1); }

  /* ------------------------------------------------------------------ shooting */
  function fireBullet() {
    if (!ship.alive || ship.cool > 0) return;
    var live = 0, bi = bullets.items;
    for (var i = 0; i < bi.length; i++) if (bi[i].alive && bi[i].friendly) live++;
    if (live >= 5) return;
    ship.cool = 0.108;
    var a = ship.ang, sp = 760 * U;
    var b = bullets.spawn();
    b.friendly = true;
    b.x = ship.x + Math.cos(a) * 16 * U;
    b.y = ship.y + Math.sin(a) * 16 * U;
    b.vx = Math.cos(a) * sp + ship.vx * 0.32;
    b.vy = Math.sin(a) * sp + ship.vy * 0.32;
    b.life = 0.95;
    STATE.shots++;
    /* muzzle flash */
    burst(b.x, b.y, 5, '#dff9ff', 170 * U, 0.16, 0, SPR.cyan);
    addPart(b.x, b.y, 0, 0, 0.1, 16 * U, '#ffffff', 3, 0, SPR.white);
    ship.vx -= Math.cos(a) * 6 * U;
    ship.vy -= Math.sin(a) * 6 * U;
    A.fire();
  }

  function enemyBullet(x, y, vx, vy) {
    var b = bullets.spawn();
    b.friendly = false;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.life = 2.1;
    return b;
  }

  function hyperspace() {
    if (!ship.alive || ship.hyperCool > 0 || STATE.mode !== 'play') return;
    ship.hyperCool = 1.25;
    A.hyper();
    var ox = ship.x, oy = ship.y;
    for (var i = 0; i < 22; i++) {
      var a = Math.random() * TAU, s = rnd(60, 300) * U;
      addPart(ox, oy, Math.cos(a) * s, Math.sin(a) * s, rnd(0.2, 0.5), rnd(1, 2.4) * U, '#c8f8ff', 0, 3, null);
    }
    addRing(ox, oy, 4 * U, 110 * U, 0.5, 2 * U, '#7df9ff');
    if (Math.random() < 0.07) { ship.invuln = 0; killShip(); return; }
    var bx = W / 2, by = H / 2, bd = -1;
    for (var t = 0; t < 30; t++) {
      var x = rnd(W * 0.1, W * 0.9), y = rnd(H * 0.1, H * 0.9), d = 1e9;
      for (var r = 0; r < rocks.items.length; r++) {
        var rk = rocks.items[r];
        if (!rk.alive) continue;
        var dd = Math.hypot(rk.x - x, rk.y - y) - rk.r;
        if (dd < d) d = dd;
      }
      if (d > bd) { bd = d; bx = x; by = y; }
    }
    ship.x = bx; ship.y = by; ship.vx *= 0.2; ship.vy *= 0.2;
    ship.warp = 1;
    addRing(bx, by, 2 * U, 90 * U, 0.5, 2 * U, '#c8f8ff');
    burst(bx, by, 18, '#9ff6ff', 200 * U, 0.4, 0, SPR.cyan);
    aber(0.5); flash(0.12, '160,230,255');
  }

  function fireSurge() {
    if (STATE.mode !== 'play' || !ship.alive || STATE.surge < 1) return;
    STATE.surge = 0;
    STATE.surgeUses++;
    surgeWave.active = true;
    surgeWave.x = ship.x; surgeWave.y = ship.y; surgeWave.r = 8 * U;
    surgeWave.rMax = Math.hypot(W, H) * 0.78;
    surgeWave.life = 0.95; surgeWave.max = 0.95;
    A.surge();
    flash(0.34, '200,245,255');
    aber(1.1);
    shake(1.3);
    STATE.tScale = 0.34;
    STATE.hitstop = 0.07;
    FX.zoomV -= 0.07;
    FX.bloomBoost = 1;
    addRing(ship.x, ship.y, 6 * U, surgeWave.rMax * 1.05, 0.95, 3.4 * U, '#ffffff');
    addRing(ship.x, ship.y, 4 * U, surgeWave.rMax * 0.92, 0.82, 2.2 * U, '#7df9ff');
    addRing(ship.x, ship.y, 2 * U, surgeWave.rMax * 0.62, 0.70, 1.6 * U, '#b98cff');
    for (var i = 0; i < 46; i++) {
      var a = Math.random() * TAU, s = rnd(120, 620) * U;
      addPart(ship.x, ship.y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.4, 1.0), rnd(1.5, 3.4) * U, pick(PAL.ice), 0, 2.0, null);
    }
    burst(ship.x, ship.y, 26, '#ffffff', 420 * U, 0.6, 0, SPR.white);
    ship.invuln = Math.max(ship.invuln, 0.9);
    addText(ship.x, ship.y - 52 * U, 'SURGE', '#7df9ff', Math.round(26 * U));
  }

  /* ------------------------------------------------------------- destruction */
  function destroyRock(rk, byPlayer, via) {
    if (!rk.alive) return;
    rk.alive = false;
    var base = rk.size === 3 ? 20 : rk.size === 2 ? 50 : 100;
    var pal = ROCKCOL[rk.type].pal;
    var sc = rk.size === 3 ? 1.35 : rk.size === 2 ? 0.9 : 0.55;
    explode(rk.x, rk.y, sc, pal, {});
    A.boom(rk.size === 3 ? 1.5 : rk.size === 2 ? 1 : 0.7);
    if (rk.size === 3) { STATE.hitstop = Math.max(STATE.hitstop, 0.045); STATE.tScale = 0.5; aber(0.42); }
    if (byPlayer) {
      bumpChain();
      STATE.kills++;
      var pts = base * STATE.mult;
      addScore(pts, rk.x, rk.y);
      addSurge(rk.size === 3 ? 0.045 : rk.size === 2 ? 0.06 : 0.075);
    }
    if (rk.size > 1) {
      var kids = 2, sp = rockSpeed(rk.size - 1);
      for (var i = 0; i < kids; i++) {
        var a = Math.atan2(rk.vy, rk.vx) + rnd(-1.2, 1.2) + (i ? Math.PI : 0);
        var k = spawnRock(rk.x + Math.cos(a) * rk.r * 0.42, rk.y + Math.sin(a) * rk.r * 0.42,
          rk.size - 1, Math.cos(a) * sp + rk.vx * 0.45, Math.sin(a) * sp + rk.vy * 0.45, rk.type);
      }
    }
  }

  function destroyUfo(u) {
    u.alive = false;
    explode(u.x, u.y, 1.0, 'hot', {});
    for (var i = 0; i < 7; i++) {
      var a = Math.random() * TAU, s = rnd(50, 200) * U;
      addDebris(u.x, u.y, Math.cos(a) * s, Math.sin(a) * s, rnd(2, 4) * U, rnd(0.7, 1.4), '#ff8ab5', 3);
    }
    A.boom(1.1);
    var base = u.kind ? 1000 : 200;
    addScore(base * STATE.mult, u.x, u.y, '+' + base * STATE.mult);
    addSurge(0.2);
    if (STATE.surge >= 1) addText(u.x, u.y - 30 * U, 'SURGE READY', '#7df9ff', Math.round(14 * U));
  }

  /* ------------------------------------------------------------------ updates */
  function updateShip(dt) {
    if (!ship.alive) {
      if (ship.respawn > 0) {
        ship.respawn -= dt;
        if (ship.respawn <= 0) {
          if (STATE.lives > 0) reviveShip();
          else endGame();
        }
      }
      return;
    }
    if (ship.invuln > 0) ship.invuln -= dt;
    if (ship.cool > 0) ship.cool -= dt;
    if (ship.hyperCool > 0) ship.hyperCool -= dt;
    if (ship.warp > 0) ship.warp = Math.max(0, ship.warp - dt * 2.6);

    var rot = 0;
    if (IN.left) rot -= 1;
    if (IN.right) rot += 1;
    var thrust = 0;
    if (IN.up) thrust = 1;
    if (IN.tmag > 0.22) {
      var d = angDiff(IN.tang, ship.ang);
      rot = clamp(rot + clamp(d * 3.0, -1, 1), -1, 1);
      if (IN.tmag > 0.34) thrust = Math.max(thrust, Math.min(1, (IN.tmag - 0.24) / 0.55));
    }
    ship.ang += rot * 4.15 * dt;
    if (thrust > 0) {
      var acc = 430 * U;
      ship.vx += Math.cos(ship.ang) * acc * thrust * dt;
      ship.vy += Math.sin(ship.ang) * acc * thrust * dt;
      /* exhaust */
      if (Math.random() < 0.85) {
        var ex = ship.x - Math.cos(ship.ang) * 15 * U, ey = ship.y - Math.sin(ship.ang) * 15 * U;
        var sa = ship.ang + Math.PI + rnd(-0.42, 0.42), ss = rnd(70, 210) * U;
        addPart(ex, ey, Math.cos(sa) * ss + ship.vx * 0.4, Math.sin(sa) * ss + ship.vy * 0.4,
          rnd(0.14, 0.36), rnd(1.6, 3.6) * U, Math.random() < 0.4 ? '#ffffff' : pick(['#7df9ff', '#5fd8ff', '#b98cff']), 0, 2.6, null);
      }
    }
    ship.thrustAmt = thrust;
    ship.vx = clamp(ship.vx, -560 * U, 560 * U);
    ship.vy = clamp(ship.vy, -560 * U, 560 * U);
    var px0 = ship.x, py0 = ship.y;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrapObj(ship, 18 * U);
    if (Math.abs(ship.x - px0) > W * 0.5 || Math.abs(ship.y - py0) > H * 0.5) trail.length = 0;
    var spd = Math.hypot(ship.vx, ship.vy);
    trail.unshift({ x: ship.x, y: ship.y, ang: ship.ang, w: clamp(spd / (560 * U), 0, 1) });
    if (trail.length > TRAIL_MAX) trail.length = TRAIL_MAX;
    if (IN.fire) fireBullet();
    A.thrust(thrust > 0.05, thrust);
  }

  function updateBullets(dt) {
    var it = bullets.items;
    for (var i = 0; i < it.length; i++) {
      var b = it[i];
      if (!b.alive) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      wrapObj(b, 6 * U);
      if (b.life <= 0) b.alive = false;
    }
  }

  function updateRocks(dt) {
    var it = rocks.items;
    for (var i = 0; i < it.length; i++) {
      var rk = it[i];
      if (!rk.alive) continue;
      rk.x += rk.vx * dt; rk.y += rk.vy * dt;
      rk.rot += rk.rotV * dt;
      wrapObj(rk, rk.r);
      rk.surf += dt;
    }
  }

  function updateUfos(dt) {
    var it = ufos.items;
    for (var i = 0; i < it.length; i++) {
      var u = it[i];
      if (!u.alive) continue;
      u.t += dt;
      u.wob += dt * 2.4;
      u.x += u.vx * dt;
      u.y += Math.sin(u.wob) * 34 * U * dt;
      u.y = clamp(u.y, H * 0.1, H * 0.9);
      if (u.x < -90 * U || u.x > W + 90 * U) { u.alive = false; continue; }
      u.fire -= dt;
      if (u.fire <= 0) {
        u.fire = u.kind ? rnd(0.7, 1.15) : rnd(1.0, 1.7);
        var a = u.kind
          ? Math.atan2(ship.y - u.y, ship.x - u.x) + rnd(-0.11, 0.11)
          : Math.random() * TAU;
        var sp = 400 * U;
        enemyBullet(u.x, u.y + u.r * 0.4, Math.cos(a) * sp, Math.sin(a) * sp);
        addPart(u.x, u.y + u.r * 0.4, 0, 0, 0.12, 12 * U, '#ff8ab5', 3, 0, SPR.hot);
        A.tone(u.kind ? 520 : 300, 0.09, 'square', 0.06, 200);
      }
    }
  }

  function updateParticles(dt) {
    var it = parts.items;
    for (var i = 0; i < it.length; i++) {
      var p = it[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; pLive--; if (pLive < 0) pLive = 0; continue; }
      var f = 1 - Math.min(0.92, p.drag * dt);
      p.vx *= f; p.vy *= f;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.rotV * dt;
      if (p.kind === 2) p.size += 26 * U * dt;
    }
  }

  function updateDebris(dt) {
    var it = debris.items;
    for (var i = 0; i < it.length; i++) {
      var d = it[i];
      if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0) { d.alive = false; continue; }
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= 1 - 0.5 * dt; d.vy *= 1 - 0.5 * dt;
      d.rot += d.rotV * dt;
    }
  }

  function updateRings(dt) {
    var it = rings.items;
    for (var i = 0; i < it.length; i++) {
      var r = it[i];
      if (!r.alive) continue;
      r.life -= dt;
      if (r.life <= 0) { r.alive = false; continue; }
      var t = 1 - r.life / r.max;
      r.r = lerp(r.r, r.rMax, Math.min(1, dt * (6 + 4 * t)));
    }
  }

  function updateTexts(dt) {
    var it = texts.items;
    for (var i = 0; i < it.length; i++) {
      var t = it[i];
      if (!t.alive) continue;
      t.life -= dt;
      if (t.life <= 0) { t.alive = false; continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - 2.2 * dt;
    }
  }

  function updateSurgeWave(dt) {
    if (!surgeWave.active) return;
    surgeWave.life -= dt;
    var t = 1 - surgeWave.life / surgeWave.max;
    surgeWave.r = surgeWave.rMax * Math.min(1, Math.pow(t, 0.55));
    var it = rocks.items;
    for (var i = 0; i < it.length; i++) {
      var rk = it[i];
      if (!rk.alive) continue;
      var d = Math.hypot(rk.x - surgeWave.x, rk.y - surgeWave.y);
      if (d < surgeWave.r + rk.r * 0.4) {
        var ang = Math.atan2(rk.y - surgeWave.y, rk.x - surgeWave.x);
        rk.vx += Math.cos(ang) * 90 * U; rk.vy += Math.sin(ang) * 90 * U;
        destroyRock(rk, true, 'surge');
      }
    }
    var bi = bullets.items;
    for (var b = 0; b < bi.length; b++) {
      var bb = bi[b];
      if (!bb.alive || bb.friendly) continue;
      if (Math.hypot(bb.x - surgeWave.x, bb.y - surgeWave.y) < surgeWave.r) bb.alive = false;
    }
    var ui = ufos.items;
    for (var u = 0; u < ui.length; u++) {
      var uu = ui[u];
      if (!uu.alive) continue;
      if (Math.hypot(uu.x - surgeWave.x, uu.y - surgeWave.y) < surgeWave.r) {
        uu.alive = false;
        explode(uu.x, uu.y, 1.0, 'hot', {});
        addScore((uu.kind ? 1000 : 200) * STATE.mult, uu.x, uu.y);
        A.boom(1.1);
      }
    }
    if (surgeWave.life <= 0) surgeWave.active = false;
  }

  /* --------------------------------------------------------------- collisions */
  function collide() {
    var bi = bullets.items, ri = rocks.items, ui = ufos.items;
    for (var b = 0; b < bi.length; b++) {
      var bl = bi[b];
      if (!bl.alive) continue;
      if (bl.friendly) {
        for (var r = 0; r < ri.length; r++) {
          var rk = ri[r];
          if (!rk.alive) continue;
          var dx = rk.x - bl.x, dy = rk.y - bl.y;
          if (dx * dx + dy * dy < rk.r * rk.r * 0.86) {
            bl.alive = false;
            STATE.hits++;
            burst(bl.x, bl.y, 7, ROCKCOL[rk.type].core, 190 * U, 0.28, 0, SPR.cyan);
            addPart(bl.x, bl.y, 0, 0, 0.1, 20 * U, '#ffffff', 3, 0, SPR.white);
            destroyRock(rk, true);
            break;
          }
        }
        if (!bl.alive) continue;
        for (var u = 0; u < ui.length; u++) {
          var uu = ui[u];
          if (!uu.alive) continue;
          var ux = uu.x - bl.x, uy = uu.y - bl.y;
          if (ux * ux + uy * uy < uu.r * uu.r * 1.15) {
            bl.alive = false;
            destroyUfo(uu);
            break;
          }
        }
      } else {
        if (!ship.alive || ship.invuln > 0) continue;
        var sx = ship.x - bl.x, sy = ship.y - bl.y;
        if (sx * sx + sy * sy < (ship.r * 0.82) * (ship.r * 0.82)) {
          bl.alive = false;
          killShip();
        }
      }
    }
    if (!ship.alive || ship.invuln > 0) return;
    for (var r2 = 0; r2 < ri.length; r2++) {
      var rk2 = ri[r2];
      if (!rk2.alive) continue;
      var ddx = rk2.x - ship.x, ddy = rk2.y - ship.y;
      var rad = rk2.r * 0.86 + ship.r * 0.72;
      if (ddx * ddx + ddy * ddy < rad * rad) { destroyRock(rk2, false); killShip(); return; }
    }
    for (var u2 = 0; u2 < ui.length; u2++) {
      var uu2 = ui[u2];
      if (!uu2.alive) continue;
      var qx = uu2.x - ship.x, qy = uu2.y - ship.y;
      var rad2 = uu2.r * 0.9 + ship.r * 0.7;
      if (qx * qx + qy * qy < rad2 * rad2) { destroyUfo(uu2); killShip(); return; }
    }
  }

  /* -------------------------------------------------------------------- update */
  function updateFxTimers(dt) {
    FX.shake *= Math.pow(0.0016, dt);
    if (FX.shake < 0.001) FX.shake = 0;
    FX.flash *= Math.pow(0.0009, dt);
    if (FX.flash < 0.002) FX.flash = 0;
    FX.aber *= Math.pow(0.0007, dt);
    if (FX.aber < 0.004) FX.aber = 0;
    FX.bloomBoost *= Math.pow(0.004, dt);
    FX.zoomV += (1 - FX.zoom) * 42 * dt;
    FX.zoomV *= Math.pow(0.02, dt);
    FX.zoom += FX.zoomV * dt;
  }

  function update(dt) {
    STATE.t += dt;
    updateFxTimers(dt);

    if (STATE.mode === 'menu') {
      updateRocks(dt * 0.6); updateParticles(dt); updateDebris(dt); updateRings(dt); updateTexts(dt);
      return;
    }
    if (STATE.mode !== 'play') { updateParticles(dt); updateRings(dt); updateTexts(dt); updateDebris(dt); return; }

    STATE.tScale += (1 - STATE.tScale) * Math.min(1, dt * 3.4);
    var sdt = dt * STATE.tScale;
    if (STATE.hitstop > 0) { STATE.hitstop -= dt; sdt *= 0.12; }

    if (STATE.chainT > 0) {
      STATE.chainT -= dt;
      if (STATE.chainT <= 0) { STATE.chain = 0; STATE.mult = 1; }
    }
    if (STATE.banner > 0) STATE.banner -= dt;

    updateShip(sdt);
    if (!ship.alive) A.thrust(false, 0);
    updateBullets(sdt);
    updateRocks(sdt);
    updateUfos(sdt);
    updateSurgeWave(sdt);
    updateParticles(sdt);
    updateDebris(sdt);
    updateRings(sdt);
    updateTexts(sdt);
    collide();

    if (STATE.mode !== 'play') return;

    /* saucer timer */
    STATE.ufoTimer -= sdt;
    if (STATE.ufoTimer <= 0) {
      STATE.ufoTimer = Math.max(8, 22 - STATE.wave * 0.9) + rnd(0, 7);
      if (liveCount(ufos) < 2) spawnUfo();
    }

    /* wave progression */
    var rockAlive = liveCount(rocks);
    if (rockAlive === 0 && !surgeWave.active && STATE.mode === 'play') {
      if (STATE.waveDelay <= 0) waveClear();
      else {
        STATE.waveDelay -= sdt;
        if (STATE.waveDelay <= 0) spawnWave(STATE.wave + 1);
      }
    }
  }

  /* ------------------------------------------------------------- attract mode */
  function seedAttract() {
    rocks.reset(); bullets.reset(); ufos.reset(); parts.reset(); debris.reset(); rings.reset(); texts.reset();
    pLive = 0;
    for (var i = 0; i < 7; i++) {
      spawnRock(rnd(0, W), rnd(0, H), Math.random() < 0.55 ? 3 : 2, undefined, undefined, undefined);
    }
  }
